/*
 * Genera data/pokemon-seed.json con los primeros 100 Pokémon de PokeAPI.
 * Sólo hace falta ejecutarlo una vez (el resultado ya va en el repositorio):
 *   npm run seed:build
 */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const API = 'https://pokeapi.co/api/v2';
const TOTAL = 100;
const OUT = path.join(__dirname, '..', 'data', 'pokemon-seed.json');

const STAT_KEYS = {
  hp: 'hp',
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'specialAttack',
  'special-defense': 'specialDefense',
  speed: 'speed'
};

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' en ' + url);
  return res.json();
}

/* Descripción en español (o inglés si no hay) desde la especie. */
function flavor(species) {
  const entries = species.flavor_text_entries || [];
  const pick = entries.find((e) => e.language.name === 'es') || entries.find((e) => e.language.name === 'en');
  return pick ? pick.flavor_text.replace(/[\f\n\r\u00ad]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

async function one(id) {
  const [p, s] = await Promise.all([
    getJson(API + '/pokemon/' + id + '/'),
    getJson(API + '/pokemon-species/' + id + '/')
  ]);
  const stats = {};
  p.stats.forEach((st) => { if (STAT_KEYS[st.stat.name]) stats[STAT_KEYS[st.stat.name]] = st.base_stat; });
  return {
    id: p.id,
    name: p.name,
    types: p.types.slice().sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    stats,
    height: p.height / 10,
    weight: p.weight / 10,
    abilities: p.abilities.slice().sort((a, b) => a.slot - b.slot).map((a) => a.ability.name),
    description: flavor(s),
    image: (p.sprites.other && p.sprites.other['official-artwork'] && p.sprites.other['official-artwork'].front_default) ||
      p.sprites.front_default || ''
  };
}

(async () => {
  const out = [];
  const ids = Array.from({ length: TOTAL }, (_, i) => i + 1);
  // De 10 en 10 para no saturar PokeAPI.
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.all(ids.slice(i, i + 10).map(one));
    out.push(...batch);
    process.stdout.write('.');
  }
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('\nListo: ' + out.length + ' Pokémon en ' + OUT);
})().catch((err) => { console.error(err); process.exit(1); });
