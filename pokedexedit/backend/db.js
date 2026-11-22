/*
 * Base de datos pequeña en un archivo JSON.
 *  - data/pokemon-seed.json  → los 100 Pokémon originales (versionado en git).
 *  - data/db.json            → copia de trabajo que modifica la API (ignorada por git).
 * Si db.json no existe, se crea a partir de la semilla. Las escrituras son
 * atómicas (archivo temporal + rename) y se encadenan en una cola.
 */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const SEED_FILE = path.join(__dirname, 'data', 'pokemon-seed.json');
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');

let cache = null;          // { nextId, pokemon: [] }
let writing = Promise.resolve();

async function readSeed() {
  const list = JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));
  return { nextId: Math.max(0, ...list.map((p) => p.id)) + 1, pokemon: list };
}

function persist() {
  const data = JSON.stringify(cache, null, 2);
  writing = writing.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    const tmp = DB_FILE + '.' + process.pid + '.tmp';
    await fs.writeFile(tmp, data, 'utf8');
    await fs.rename(tmp, DB_FILE);
  });
  return writing;
}

async function load() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
    if (!raw || !Array.isArray(raw.pokemon) || !Number.isInteger(raw.nextId)) throw new Error('formato inválido');
    cache = raw;
  } catch (_) {
    cache = await readSeed();
    await persist();
  }
  return cache;
}

async function all() {
  const db = await load();
  return db.pokemon.slice().sort((a, b) => a.id - b.id);
}

async function get(id) {
  const db = await load();
  return db.pokemon.find((p) => p.id === id) || null;
}

async function create(data) {
  const db = await load();
  const item = { id: db.nextId, ...data };
  item.id = db.nextId;
  db.nextId += 1;
  db.pokemon.push(item);
  await persist();
  return item;
}

async function update(id, data) {
  const db = await load();
  const i = db.pokemon.findIndex((p) => p.id === id);
  if (i === -1) return null;
  db.pokemon[i] = { ...db.pokemon[i], ...data, id };
  await persist();
  return db.pokemon[i];
}

async function remove(id) {
  const db = await load();
  const i = db.pokemon.findIndex((p) => p.id === id);
  if (i === -1) return null;
  const [gone] = db.pokemon.splice(i, 1);
  await persist();
  return gone;
}

async function count() {
  return (await load()).pokemon.length;
}

async function reset() {
  cache = await readSeed();
  await persist();
  return cache.pokemon.length;
}

module.exports = { all, get, create, update, remove, count, reset, DB_FILE };
