/* Pruebas de las rutas /get /post /put /delete:  npm test */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

// Base de datos temporal para no tocar data/db.json.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokedexedit-'));
process.env.DB_FILE = path.join(tmpDir, 'db.json');
process.env.NODE_ENV = 'production';

const app = require('../server');

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => { server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); });

const call = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json() };
};

const nuevo = {
  name: 'Pokémon de Prueba',
  types: ['fire', 'fairy'],
  stats: { hp: 50, attack: 60, defense: 70, specialAttack: 80, specialDefense: 90, speed: 100 },
  height: 1.23, weight: 45.6, abilities: 'blaze, pixilate', description: 'Creado por las pruebas.'
};

test('GET /get devuelve los 100 Pokémon semilla', async () => {
  const r = await call('GET', '/get');
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 100);
  assert.equal(r.body.results[0].name, 'bulbasaur');
  assert.equal(r.body.results[99].name, 'voltorb');
});

test('GET /get admite filtros y /get/:id un registro', async () => {
  const fuego = await call('GET', '/get?type=fire');
  assert.ok(fuego.body.results.every((p) => p.types.includes('fire')));
  const pika = await call('GET', '/get/25');
  assert.equal(pika.body.name, 'pikachu');
  assert.equal((await call('GET', '/get/9999')).status, 404);
  assert.equal((await call('GET', '/get/abc')).status, 400);
});

test('POST, PUT y DELETE completan el ciclo', async () => {
  const c = await call('POST', '/post', nuevo);
  assert.equal(c.status, 201);
  assert.equal(c.body.id, 101);
  assert.equal(c.body.name, 'pokemon-de-prueba');
  assert.deepEqual(c.body.abilities, ['blaze', 'pixilate']);
  assert.equal(c.body.height, 1.2);

  const u = await call('PUT', '/put/101', { name: 'renombrado', types: ['water'] });
  assert.equal(u.status, 200);
  assert.equal(u.body.name, 'renombrado');
  assert.deepEqual(u.body.types, ['water']);
  assert.equal(u.body.stats.speed, 100); // lo no enviado se conserva

  const d = await call('DELETE', '/delete/101');
  assert.equal(d.status, 200);
  assert.equal(d.body.deleted.id, 101);
  assert.equal((await call('GET', '/get/101')).status, 404);
  assert.equal((await call('DELETE', '/delete/101')).status, 404);

  // Los ids no se reutilizan.
  const c2 = await call('POST', '/post', nuevo);
  assert.equal(c2.body.id, 102);
});

test('valida los datos de entrada', async () => {
  const sinNombre = await call('POST', '/post', { ...nuevo, name: '' });
  assert.equal(sinNombre.status, 400);
  const tipoMalo = await call('POST', '/post', { ...nuevo, types: ['lava'] });
  assert.equal(tipoMalo.status, 400);
  const statMala = await call('PUT', '/put/1', { stats: { ...nuevo.stats, hp: 999 } });
  assert.equal(statMala.status, 400);
  const vacio = await call('PUT', '/put/1', {});
  assert.equal(vacio.status, 400);
  const img = await call('PUT', '/put/1', { image: 'javascript:alert(1)' });
  assert.equal(img.status, 400);
});

test('POST /reset restaura la semilla', async () => {
  await call('DELETE', '/delete/1');
  const r = await call('POST', '/reset');
  assert.equal(r.body.count, 100);
  assert.equal((await call('GET', '/get/1')).body.name, 'bulbasaur');
});
