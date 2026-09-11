// dashboard/intune-reconcile.js
// Conciliación con el export de dispositivos de Intune (spec
// docs/superpowers/specs/2026-09-11-intune-reconcile-design.md).
// Puro: sin DOM, sin Supabase. Se usa desde index.html (global IntuneReconcile)
// y desde los tests (CJS). El archivo se procesa en memoria y no se persiste.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.IntuneReconcile = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MIN_ANDROID_ROWS = 100;   // menos que esto = export filtrado por error
  const MAX_RETIRE_RATIO = 0.10;  // más bajas que esto de golpe = advertir

  // CSV RFC-4180: separador ",", comillas dobles con escape "", CRLF o LF, BOM opcional.
  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
        } else field += c;
      } else if (c === '"') {
        quoted = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ""));
  }

  function parseIntuneExport(text) {
    const rows = parseCsv(String(text || ""));
    if (!rows.length) throw new Error("El archivo está vacío.");
    const header = rows[0].map(h => h.trim());
    const col = name => header.indexOf(name);
    const iOs = col("OS"), iSerial = col("Serial number"), iName = col("Device name");
    const iCheck = col("Last check-in"), iVer = col("OS version");
    if (iOs < 0 || iSerial < 0 || iName < 0) {
      throw new Error("No parece un export de Intune: faltan las columnas OS, Serial number o Device name.");
    }
    const serials = new Set();
    const tablets = [];
    const seenTablet = new Set();
    let androidRows = 0;
    for (const r of rows.slice(1)) {
      const os = (r[iOs] || "").trim();
      if (!/^(Android|AOSP)/.test(os)) continue;
      androidRows++;
      const serial = (r[iSerial] || "").trim();
      if (!serial || serial === "0") continue;
      serials.add(serial);
      const name = (r[iName] || "").trim();
      if (/^TAB/i.test(name) && !seenTablet.has(serial)) {
        seenTablet.add(serial);
        tablets.push({
          serial,
          name,
          lastCheckIn: iCheck < 0 ? "" : (r[iCheck] || "").trim().slice(0, 10),
          osVersion: iVer < 0 ? "" : (r[iVer] || "").trim(),
        });
      }
    }
    return { serials, tablets, androidRows };
  }

  // fleet: equipos con al menos un latido [{serial, lastSeen(ms|null)}].
  // retired: Map serial -> {retired_at, retired_reason} (los que hoy están de baja).
  function reconcile(fleet, retired, intune, opts) {
    const o = Object.assign({ minAndroidRows: MIN_ANDROID_ROWS, maxRetireRatio: MAX_RETIRE_RATIO }, opts || {});
    const bySerial = new Map(fleet.map(f => [f.serial, f]));
    const toRetire = [], toReactivate = [];
    let activeCount = 0;
    for (const f of fleet) {
      const isRetired = retired.has(f.serial);
      const inIntune = intune.serials.has(f.serial);
      if (!isRetired) activeCount++;
      if (!isRetired && !inIntune) toRetire.push(f);
      else if (isRetired && inIntune) toReactivate.push(Object.assign({}, f, retired.get(f.serial)));
    }
    const noApp = intune.tablets.filter(t => !bySerial.has(t.serial));
    const desc = k => (a, b) => (b[k] || 0) - (a[k] || 0);
    toRetire.sort(desc("lastSeen"));
    toReactivate.sort(desc("lastSeen"));
    noApp.sort((a, b) => (b.lastCheckIn || "").localeCompare(a.lastCheckIn || ""));
    // tooFew cuenta seriales únicos (no filas) — un export con muchas filas
    // duplicadas o sin serie no debería pasar la guarda solo por volumen de filas.
    const tooFew = intune.serials.size < o.minAndroidRows;
    const tooMany = activeCount > 0 && toRetire.length > o.maxRetireRatio * activeCount;
    return { toRetire, toReactivate, noApp, activeCount, guards: { tooFew, tooMany } };
  }

  return { parseIntuneExport, reconcile, MIN_ANDROID_ROWS, MAX_RETIRE_RATIO };
});
