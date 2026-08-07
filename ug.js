(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UG = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Unidades de Gestión de PAE. Para agregar una UG nueva hay que editar ESTA
  // lista Y actualizar el test "UGS son las seis UGs válidas" en ug.test.js
  // (lista la misma lista y se pone rojo si no coinciden). Un código que no
  // esté acá cae en "Sin UG — revisar nombre" en el dashboard. El orden de
  // los elementos no afecta el resultado: gana el primer token del nombre
  // del equipo, no el primer elemento de esta lista.
  const UGS = ["GSJ", "NQN", "MX", "CHB", "BA", "ACA"];

  // Extrae la UG del nombre del device (Intune {{devicename}}) reconociéndola por
  // CONTENIDO, no por posición: parte el nombre en tokens y devuelve el primero
  // que sea una UG conocida. La regla vieja tomaba el token que seguía a "TAB",
  // así que "TAB PAE NQN AMBULANCIA CANEPA" la clasificaba en una UG inexistente
  // ("PAE"); acá PAE se ignora porque no es UG y gana NQN. Todo lo que no sea
  // letra ni dígito separa tokens, así que comas, guiones y espacios dobles no
  // molestan. Sin UG conocida -> null.
  function ugOf(name) {
    if (name === null || name === undefined) return null;
    const tokens = String(name).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(" ");
    for (let i = 0; i < tokens.length; i++) {
      if (UGS.indexOf(tokens[i]) !== -1) return tokens[i];
    }
    return null;
  }

  return { UGS, ugOf };
});
