(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Geofence = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Ray casting. ring: [[lng,lat],...]. Devuelve true si (lng,lat) está adentro.
  function pointInPolygon(lng, lat, ring) {
    if (!Array.isArray(ring) || ring.length < 3) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function matches(lng, lat, g) {
    const rings = g && g.polygon;
    if (!Array.isArray(rings) || !rings.length) return false;
    return pointInPolygon(lng, lat, rings[0]); // anillo exterior; ignora huecos
  }

  // Prioridad: primero una locación que matchee, si no una base que matchee.
  function zoneForPoint(lng, lat, geofences) {
    if (!Array.isArray(geofences)) return null;
    const loc = geofences.find((g) => g.kind === "locacion" && matches(lng, lat, g));
    if (loc) return loc;
    const base = geofences.find((g) => g.kind === "base" && matches(lng, lat, g));
    return base || null;
  }

  function deviceGeoState(device, geofences) {
    const rawLat = device && device.last_fix_lat_approx;
    const rawLng = device && device.last_fix_lon_approx;
    const lat = rawLat === null || rawLat === undefined || rawLat === "" ? NaN : Number(rawLat);
    const lng = rawLng === null || rawLng === undefined || rawLng === "" ? NaN : Number(rawLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { state: null, zoneId: null, zoneName: null };
    }
    const z = zoneForPoint(lng, lat, geofences);
    if (!z) return { state: "en_transito", zoneId: null, zoneName: null };
    return {
      state: z.kind === "locacion" ? "en_locacion" : "en_base",
      zoneId: z.id, zoneName: z.name,
    };
  }

  return { pointInPolygon, zoneForPoint, deviceGeoState };
});
