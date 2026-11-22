/*
 * Validación y normalización de un Pokémon recibido por POST o PUT.
 * `partial = true` (PUT) permite enviar sólo los campos que cambian.
 */
'use strict';

const TYPES = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost',
  'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon',
  'dark', 'fairy'
];
const STATS = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];

/* «Mr. Mime» → «mr-mime» (mismo formato que PokeAPI). */
function slug(str) {
  return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function validate(body, partial) {
  const errors = [];
  const out = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['El cuerpo debe ser un objeto JSON.'], value: null };
  }
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined;

  /* name */
  if (has('name')) {
    const name = slug(body.name);
    if (!name || name.length > 40) errors.push('name: obligatorio, de 1 a 40 caracteres (letras, números o guiones).');
    else out.name = name;
  } else if (!partial) errors.push('name: obligatorio.');

  /* types */
  if (has('types')) {
    const types = Array.isArray(body.types)
      ? [...new Set(body.types.map((t) => String(t).toLowerCase().trim()).filter(Boolean))]
      : [];
    if (types.length < 1 || types.length > 2 || types.some((t) => !TYPES.includes(t))) {
      errors.push('types: lista de 1 o 2 tipos válidos (' + TYPES.join(', ') + ').');
    } else out.types = types;
  } else if (!partial) errors.push('types: obligatorio.');

  /* stats */
  if (has('stats')) {
    const s = body.stats;
    if (!s || typeof s !== 'object' || Array.isArray(s)) errors.push('stats: debe ser un objeto.');
    else {
      const stats = {};
      STATS.forEach((k) => {
        const v = Number(s[k]);
        if (!Number.isInteger(v) || v < 1 || v > 255) errors.push('stats.' + k + ': entero entre 1 y 255.');
        else stats[k] = v;
      });
      if (Object.keys(stats).length === STATS.length) out.stats = stats;
    }
  } else if (!partial) errors.push('stats: obligatorio.');

  /* height (m) / weight (kg), opcionales */
  [['height', 0, 100], ['weight', 0, 10000]].forEach(([k, min, max]) => {
    if (!has(k)) { if (!partial) out[k] = 0; return; }
    const v = Number(body[k]);
    if (body[k] === '' || !Number.isFinite(v) || v < min || v > max) errors.push(k + ': número entre ' + min + ' y ' + max + '.');
    else out[k] = Math.round(v * 10) / 10;
  });

  /* abilities, opcional: lista o texto separado por comas */
  if (has('abilities')) {
    const list = Array.isArray(body.abilities) ? body.abilities : String(body.abilities).split(',');
    const abilities = [...new Set(list.map(slug).filter(Boolean))];
    if (abilities.length > 4 || abilities.some((a) => a.length > 40)) errors.push('abilities: hasta 4 habilidades de máximo 40 caracteres.');
    else out.abilities = abilities;
  } else if (!partial) out.abilities = [];

  /* description, opcional */
  if (has('description')) {
    const d = String(body.description).trim();
    if (d.length > 500) errors.push('description: máximo 500 caracteres.');
    else out.description = d;
  } else if (!partial) out.description = '';

  /* image, opcional: URL http(s) */
  if (has('image')) {
    const img = String(body.image).trim();
    if (img && (!/^https?:\/\/\S+$/i.test(img) || img.length > 500)) errors.push('image: URL http(s) válida o vacía.');
    else out.image = img;
  } else if (!partial) out.image = '';

  if (partial && !errors.length && !Object.keys(out).length) errors.push('No se envió ningún campo para actualizar.');
  return { errors, value: errors.length ? null : out };
}

module.exports = { validate, TYPES, STATS };
