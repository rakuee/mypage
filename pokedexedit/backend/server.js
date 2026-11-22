/*
 * API de la Pokédex editable — tonatiuhliera.com/pokedexedit/
 *
 * Rutas:
 *   GET    /get            → lista todos los Pokémon (filtros opcionales ?q=&type=)
 *   GET    /get/:id        → un Pokémon
 *   POST   /post           → crea un Pokémon            (cuerpo JSON completo)
 *   PUT    /put/:id        → actualiza un Pokémon       (cuerpo JSON con los campos a cambiar)
 *   DELETE /delete/:id     → elimina un Pokémon
 *   POST   /reset          → restaura los 100 originales
 *   GET    /health         → estado del servicio
 */
'use strict';

const path = require('node:path');
const fs = require('node:fs');

/* Variables de .env sin dependencias extra (Node ≥ 20.6 trae loadEnvFile). */
const ENV_FILE = path.join(__dirname, '.env');
try { if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE); } catch (_) { /* opcional */ }

const express = require('express');
const cors = require('cors');
const db = require('./db');
const { validate, TYPES } = require('./validate');

const PORT = Number(process.env.PORT) || 3000;
const MAX_RECORDS = 500;
const ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://tonatiuhliera.com,https://www.tonatiuhliera.com,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map((s) => s.trim()).filter(Boolean);

const app = express();
app.disable('x-powered-by');
app.use(cors({
  // Sin cabecera Origin (curl, Postman, mismo origen) se permite.
  origin: (origin, cb) => cb(null, !origin || ORIGINS.includes(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '20kb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const notFound = (res, id) => res.status(404).json({ error: 'No existe un Pokémon con id ' + id + '.' });

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'El id debe ser un entero positivo.' });
    return null;
  }
  return id;
}

/* ---------- GET ---------- */
app.get('/get', wrap(async (req, res) => {
  let list = await db.all();
  const q = String(req.query.q || '').toLowerCase().trim().replace(/^#/, '');
  const type = String(req.query.type || '').toLowerCase().trim();
  if (type) list = list.filter((p) => p.types.includes(type));
  if (q) list = list.filter((p) => p.name.includes(q.replace(/\s+/g, '-')) || String(p.id) === q);
  res.json({ count: list.length, results: list });
}));

app.get('/get/:id', wrap(async (req, res) => {
  const id = parseId(req, res);
  if (id == null) return;
  const p = await db.get(id);
  if (!p) return notFound(res, id);
  res.json(p);
}));

/* ---------- POST ---------- */
app.post('/post', wrap(async (req, res) => {
  const { errors, value } = validate(req.body, false);
  if (errors.length) return res.status(400).json({ error: 'Datos inválidos.', details: errors });
  if (await db.count() >= MAX_RECORDS) {
    return res.status(409).json({ error: 'Se alcanzó el máximo de ' + MAX_RECORDS + ' Pokémon.' });
  }
  const created = await db.create(value);
  res.status(201).location('/get/' + created.id).json(created);
}));

/* ---------- PUT ---------- */
app.put('/put/:id', wrap(async (req, res) => {
  const id = parseId(req, res);
  if (id == null) return;
  const { errors, value } = validate(req.body, true);
  if (errors.length) return res.status(400).json({ error: 'Datos inválidos.', details: errors });
  const updated = await db.update(id, value);
  if (!updated) return notFound(res, id);
  res.json(updated);
}));

/* ---------- DELETE ---------- */
app.delete('/delete/:id', wrap(async (req, res) => {
  const id = parseId(req, res);
  if (id == null) return;
  const gone = await db.remove(id);
  if (!gone) return notFound(res, id);
  res.json({ deleted: gone });
}));

/* ---------- Extras ---------- */
app.post('/reset', wrap(async (req, res) => {
  res.json({ ok: true, count: await db.reset() });
}));

app.get('/health', wrap(async (req, res) => {
  res.json({ ok: true, count: await db.count(), types: TYPES });
}));

/* En desarrollo el servidor también sirve el sitio completo, para probar
   http://localhost:3000/pokedexedit/ igual que en el dominio. */
if (process.env.NODE_ENV !== 'production') {
  const siteRoot = path.resolve(__dirname, '..', '..');
  app.get('/', (req, res) => res.redirect('/pokedexedit/'));
  app.use('/pokedexedit/backend', (req, res) => res.status(404).end());
  app.use(express.static(siteRoot, { dotfiles: 'ignore' }));
} else {
  app.get('/', (req, res) => res.json({
    name: 'pokedexedit-api',
    routes: ['GET /get', 'GET /get/:id', 'POST /post', 'PUT /put/:id', 'DELETE /delete/:id', 'POST /reset', 'GET /health']
  }));
}

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado.' });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Cuerpo demasiado grande.' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('API Pokédex editable en http://localhost:' + PORT);
    console.log('Frontend local:       http://localhost:' + PORT + '/pokedexedit/');
    console.log('Base de datos:        ' + db.DB_FILE);
  });
}

module.exports = app;
