/*
 * Dirección del backend (API) que consume la Pokédex editable.
 *
 * - En el dominio (tonatiuhliera.com, servido por GitHub Pages) se usa la URL
 *   pública del backend desplegado. Cámbiala aquí si tu servicio tiene otra URL.
 * - En local se usa el servidor de desarrollo: `npm start` dentro de backend/.
 */
window.POKEDEX_API = (function () {
  'use strict';
  var PRODUCCION = 'https://pokedexedit-api.onrender.com';

  var host = location.hostname;
  var local = host === 'localhost' || host === '127.0.0.1' || host === '' || host.endsWith('.localhost');
  if (local) {
    // Si la página la sirve el propio backend (puerto 3000) se usa el mismo origen.
    return location.port === '3000' ? '' : 'http://localhost:3000';
  }
  return PRODUCCION;
})();
