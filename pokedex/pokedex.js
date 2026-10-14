(function () {
  'use strict';

  /* ======================================================================
     Configuración
     ====================================================================== */
  const API = 'https://pokeapi.co/api/v2';
  const PAGE_SIZES = [24, 48, 96];
  const SEARCH_BATCH = 120;   // coincidencias pintadas antes de «Mostrar más»
  const CONCURRENCY = 6;      // solicitudes simultáneas máximas
  const CACHE_TTL = 30 * 60 * 1000;
  const CACHE_KEY = 'pokedex.catalogo.v1';

  const TYPES = [
    'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost',
    'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon',
    'dark', 'fairy', 'stellar'
  ];
  const TYPE_ES = {
    normal: 'Normal', fighting: 'Lucha', flying: 'Volador', poison: 'Veneno',
    ground: 'Tierra', rock: 'Roca', bug: 'Bicho', ghost: 'Fantasma',
    steel: 'Acero', fire: 'Fuego', water: 'Agua', grass: 'Planta',
    electric: 'Eléctrico', psychic: 'Psíquico', ice: 'Hielo', dragon: 'Dragón',
    dark: 'Siniestro', fairy: 'Hada', stellar: 'Estelar', unknown: 'Desconocido',
    shadow: 'Sombra'
  };
  const STATS = [
    ['hp', 'PS'],
    ['attack', 'Ataque'],
    ['defense', 'Defensa'],
    ['special-attack', 'At. Esp.'],
    ['special-defense', 'Def. Esp.'],
    ['speed', 'Velocidad']
  ];
  const STAT_MAX = 255; // máximo real: PS de Blissey

  /* ======================================================================
     Utilidades
     ====================================================================== */
  const $ = (sel) => document.querySelector(sel);

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* Normaliza texto: minúsculas, sin acentos (é → e, ñ → n) y con los guiones de
     la API convertidos en espacios, para que «mr mime» encuentre a «mr-mime». */
  function norm(str) {
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function cap(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* «bulbasaur» → «Bulbasaur»; «nidoran-f» → «Nidoran F»; «mr-mime» → «Mr Mime» */
  function prettyName(raw) {
    return raw.split('-').map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
  }

  const pad4 = (id) => String(id).padStart(4, '0');

  function detailFromUrl(url) {
    const m = /\/(?:pokemon)\/(\d+)\/?$/.exec(String(url));
    return m ? Number(m[1]) : null;
  }

  const artworkOf = (id) => 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + id + '.png';
  const spriteOf = (id) => 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + id + '.png';

  function debounce(fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  /* Alternativas de imagen: official-artwork → sprite → marcador.
     Necesario porque las formas alternas no siempre tienen artwork oficial. */
  function artCandidates(d) {
    if (!d) return [];
    const list = [];
    if (d.artwork) list.push(d.artwork);
    if (d.sprite && d.sprite !== d.artwork) list.push(d.sprite);
    if (d.id) { if (!list.includes(artworkOf(d.id))) list.push(artworkOf(d.id)); if (!list.includes(spriteOf(d.id))) list.push(spriteOf(d.id)); }
    return [...new Set(list)];
  }

  /* Crea <img> con cascada de respaldo; nunca deja un hueco roto. */
  function makeImage(d, opts) {
    opts = opts || {};
    const cands = artCandidates(d);
    const img = document.createElement('img');
    img.alt = opts.alt || ('Imagen de ' + prettyName(d ? d.name : 'Pokémon'));
    img.loading = opts.eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (d && d.id) img.dataset.pending = '1';
    let i = 0;
    img.addEventListener('load', () => { delete img.dataset.pending; });
    img.addEventListener('error', () => {
      delete img.dataset.pending;
      i += 1;
      if (i < cands.length) img.src = cands[i];
      else placeFallback(img.parentNode || img, d);
    });
    if (cands.length) img.src = cands[0];
    else { placeFallback(opts.host || document.createElement('div'), d); return null; }
    return img;
  }

  function placeFallback(host, d) {
    const olds = host.querySelectorAll('img[data-broken], .ph');
    if (host.querySelector('.ph')) return;
    olds.forEach((n) => n.remove());
    const ph = document.createElement('span');
    ph.className = 'ph';
    ph.textContent = d && d.id ? ('#' + pad4(d.id)) : '???';
    host.appendChild(ph);
  }

  let toastTimer = null;
  function toast(msg) {
    const hint = $('#hint');
    if (!hint) return;
    hint.classList.add('err');
    hint.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { hint.classList.remove('err'); updateHint(); }, 2600);
  }

  /* ======================================================================
     Estado
     ====================================================================== */
  const state = {
    catalog: [],        // [{id, name}] — los 1351 registros
    ready: false,
    partial: true,      // true mientras sólo hay la semilla inicial
    page: 1,
    pageSize: 48,
    type: '',           // '' = todos
    typeList: null,     // ids del tipo activo
    query: '',
    matches: [],
    shown: SEARCH_BATCH,
    searchLoading: false
  };

  const detailCache = new Map();  // id → detalle normalizado (o null si falló)
  const pending = new Set();      // ids en cola o en vuelo
  const cards = new Map();        // id → elemento de tarjeta
  const MAX_CARDS = 240;          // techo de tarjetas vivos en el DOM

  /* ======================================================================
     Peticiones
     ====================================================================== */
  async function getJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' en ' + url);
    return res.json();
  }

  function normalizeDetail(raw) {
    const byKey = {};
    (raw.stats || []).forEach((s) => { byKey[s.stat.name] = s.base_stat; });
    const stats = STATS.map(([key, label]) => ({ key, label, value: byKey[key] || 0, max: STAT_MAX }));
    const types = (raw.types || [])
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name);
    const abilities = (raw.abilities || [])
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((a) => ({ name: a.ability.name, hidden: !!a.is_hidden }));
    return {
      id: raw.id,
      name: raw.name,
      types,
      stats,
      total: stats.reduce((sum, s) => sum + s.value, 0),
      abilities,
      heightM: (raw.height || 0) / 10,
      weightKg: (raw.weight || 0) / 10,
      baseExp: raw.base_experience || 0,
      artwork: (raw.sprites && raw.sprites.other && raw.sprites.other['official-artwork'] && raw.sprites.other['official-artwork'].front_default) || null,
      sprite: (raw.sprites && raw.sprites.front_default) || null,
      cry: (raw.cries && raw.cries.latest) || null,
      // La cadena evolutiva se obtiene a partir de la especie (no viene en /pokemon).
      speciesUrl: (raw.species && raw.species.url) || null
    };
  }

  /* Semilla de la primera tanda: los primeros n identificadores. Los nombres
     reales llegan con el catálogo, así que aquí van vacíos. */
  function seedCatalog(n) {
    const out = [];
    for (let i = 1; i <= n; i += 1) out.push({ id: i, name: '' });
    return out;
  }

  async function loadCatalog() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (raw && Date.now() - raw.t < CACHE_TTL && Array.isArray(raw.list) && raw.list.length) {
        state.catalog = raw.list;
        state.ready = true;
        state.partial = false;
        render();
      }
    } catch (_) { /* sessionStorage no disponible: se ignora */ }

    try {
      const data = await getJson(API + '/pokemon?limit=20000&offset=0');
      const list = (data.results || []).map((r) => ({ id: detailFromUrl(r.url), name: r.name }))
        .filter((x) => x.id);
      if (!list.length) throw new Error('catálogo vacío');
      state.catalog = list;
      state.ready = true;
      state.partial = false;
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), list })); } catch (_) {}
      render();
    } catch (err) {
      if (state.partial) {
        // No se pudo traer el catálogo completo: se dejan los primeros Pokémon.
        state.partial = false;
        render();
        toast('No se pudo cargar el catálogo completo. Revisa tu conexión y reintenta.');
      }
    }
  }

  /* Responsabilidades de carga de detalle: 1 = tarjeta, 2 = diálogo abierto */
  const want = new Map();
  let running = 0;
  let rafPending = false;

  /* Datos de apoyo de cada tarjeta: cadena evolutiva y relaciones de daño.
     Se cargan en un carril aparte (menos simultáneas) para que nunca retrasen
     la imagen y las estadísticas del Pokémon en sí. */
  const evoCache = new Map();      // id (o cadena) → {family, stages, inFamily}
  const evoPending = new Set();
  const evoPendiente = new Map();  // id → true (todavía sin resolver)
  const typeRelCache = new Map();  // tipo → {weakTo, resistTo, immuneTo, noEffectTo, halfTo}
  const typeRelPending = new Set();
  const typeRelPendiente = new Set();
  let runningBg = 0;
  const BG_CONCURRENCY = 4;

  const KEY_CHAIN = 'cadena:';

  function queue(ids, prio) {
    ids.forEach((id) => {
      if (!id) return;
      const cur = want.get(id);
      if (cur === undefined || prio > cur) want.set(id, prio);
    });
    schedule();
  }

  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; pump(); });
  }

  function pump() {
    // 1) Primero las tarjetas (imagen + estadísticas).
    while (running < CONCURRENCY) {
      const id = nextWanted();
      if (id == null) break;
      running += 1;
      want.delete(id);
      pending.add(id);
      loadDetail(id)
        .catch(() => {})
        .finally(() => { running -= 1; pending.delete(id); schedule(); });
    }
    // 2) Evoluciones y ventajas en su propio carril, sin depender de que el
    //    primer carril esté lleno (si no, al abrir el detalle de un Pokémon ya
    //    cargado nunca se pedirían). Cede el paso mientras haya tarjetas
    //    pendientes para que el detalle rápido no se retrase.
    while (running < CONCURRENCY && reservar()) { /* reservar ya lanzó la tarea */ }
  }

  function nextWanted() {
    let best = null;
    let bestPrio = -1;
    for (const [id, prio] of want) {
      if (detailCache.has(id) || pending.has(id)) { want.delete(id); continue; }
      if (prio > bestPrio) { bestPrio = prio; best = id; }
    }
    return best;
  }

  /* Toma la siguiente tarea de apoyo y la lanza. Los tipos van antes que las
     cadenas porque cuestan una sola petición y se reutilizan entre tarjetas. */
  function reservar() {
    if (runningBg >= BG_CONCURRENCY) return false;

    for (const t of [...typeRelPendiente]) {
      if (typeRelCache.has(t) || typeRelPending.has(t)) { typeRelPendiente.delete(t); continue; }
      typeRelPendiente.delete(t);
      lanzarBg(loadTypeRel(t), t, typeRelPending);
      return true;
    }
    for (const id of [...evoPendiente.keys()]) {
      if (evoCache.has(id) || evoPending.has(id)) { evoPendiente.delete(id); continue; }
      evoPendiente.delete(id);
      lanzarBg(loadEvo(id), id, evoPending);
      return true;
    }
    return false;
  }

  function lanzarBg(promesa, clave, enVuelo) {
    runningBg += 1;
    enVuelo.add(clave);
    promesa
      .catch(() => {})
      .finally(() => { runningBg -= 1; enVuelo.delete(clave); schedule(); });
  }

  async function loadTypeRel(type) {
    try {
      const t = (await getJson(API + '/type/' + type)).damage_relations || {};
      const m = (l) => (l || []).map((x) => x.name);
      typeRelCache.set(type, {
        /* Ofensiva: lo que este tipo pega cuando ataca. */
        pegaDoble: m(t.double_damage_to),
        pegaMitad: m(t.half_damage_to),
        pegaNada: m(t.no_damage_to),
        /* Defensiva: lo que recibe este tipo cuando le atacan. */
        recibeDoble: m(t.double_damage_from),
        recibeMitad: m(t.half_damage_from),
        recibeNada: m(t.no_damage_from)
      });
    } catch (err) {
      typeRelCache.set(type, null);
    }
    repintarExtras();
    return typeRelCache.get(type);
  }

  async function loadEvo(id) {
    try {
      const d = detailCache.get(id);
      const sp = await getJson(d.speciesUrl || (API + '/pokemon-species/' + id + '/'));
      const chainUrl = sp.evolution_chain && sp.evolution_chain.url;
      if (!chainUrl) throw new Error('sin cadena evolutiva');
      const chainId = String(chainUrl).match(/\/(\d+)\/?$/)[1];
      const { family, stages } = await cadenaDe(id, chainUrl, chainId);
      evoCache.set(id, { family, stages, inFamily: family.some((m) => m.id === id) });
    } catch (err) {
      evoCache.set(id, null);
    }
    repintarExtras();
    return evoCache.get(id);
  }

  /* La cadena evolutiva se pide una sola vez por familia y se reutiliza.
     Si el Pokémon es una forma alterna (id > 1025), se añade a la copia de su
     familia marcada con la bandera `form`, sin alterar la entrada compartida. */
  async function cadenaDe(id, url, chainId) {
    const d = detailCache.get(id);
    const base = d && d.id <= 1025 ? d.id : id;
    let entrada = evoCache.get(KEY_CHAIN + chainId);
    if (!entrada) {
      const raw = await getJson(url);
      entrada = flattenChain(raw.chain); // { family, stages }
      evoCache.set(KEY_CHAIN + chainId, entrada);
    }
    const family = entrada.family.slice();
    const stages = entrada.stages.map((st) => st.slice());

    if (!family.some((m) => m.id === id)) {
      const forma = { id, name: (d && d.name) || String(id), form: true };
      family.push(forma);
      const idx = stages.findIndex((st) => st.some((m) => m.id === base));
      if (idx !== -1) stages[idx].push(forma);
      else stages.push([forma]);
    }
    return { family, stages };
  }

  /* Convierte el árbol de la cadena en una lista de etapas. */
  function flattenChain(nodo) {
    const stages = [];
    const family = [];
    (function rec(n, prof) {
      const item = {
        id: Number((String(n.species.url).match(/\/(\d+)\/?$/) || [])[1]),
        name: n.species.name
      };
      if (!stages[prof]) stages[prof] = [];
      stages[prof].push(item);
      if (!family.some((m) => m.id === item.id)) family.push(item);
      (n.evolves_to || []).forEach((h) => rec(h, prof + 1));
    })(nodo, 0);
    return { family, stages: stages.filter(Boolean) };
  }

  async function loadDetail(id) {
    try {
      const raw = await getJson(API + '/pokemon/' + id + '/');
      const d = normalizeDetail(raw);
      detailCache.set(id, d);
      fillCard(id, d);
      return d;
    } catch (err) {
      detailCache.set(id, null); // se marca para permitir «reintentar»
      markCardError(id);
      throw err;
    }
  }

  function retryDetail(id) {
    detailCache.delete(id);
    const card = cards.get(id);
    if (card) {
      card.classList.remove('errtag');
      const old = card.querySelector('.reload');
      if (old) old.remove();
      const name = (state.catalog.find((p) => p.id === id) || {}).name;
      setCardSkeleton(card, id, name);
    }
    queue([id], 1);
  }

  /* ======================================================================
     Búsqueda
     ====================================================================== */
  /* Puntaje: 0 exacto · 100 prefijo · 200 inicio de palabra · 300 parte ·
     400 subsecuencia flexible · Infinity sin coincidencia. */
  function scoreOf(name, q, qn) {
    const n = norm(name);
    if (n === qn) return 0;
    if (n.indexOf(qn) === 0) return 100;
    const words = n.split(' ');
    if (words.some((w) => w.indexOf(qn) === 0)) return 200;
    if (n.indexOf(qn) !== -1) return 300;
    let i = 0;
    for (let k = 0; k < n.length && i < qn.length; k += 1) { if (n[k] === qn[i]) i += 1; }
    return i === qn.length && qn.length >= 3 ? 400 : Infinity;
  }

  function runSearch() {
    const q = state.query.trim();
    const all = state.catalog;
    if (!q) { state.matches = []; state.shown = SEARCH_BATCH; return; }

    const qn = norm(q);
    const digits = q.replace(/^#/, '');
    const numeric = /^\d{1,4}$/.test(digits);
    const pool = state.typeList ? all.filter((p) => state.typeList.has(p.id)) : all;
    const out = [];

    for (const p of pool) {
      let score = Infinity;
      if (numeric) {
        const id = Number(digits);
        if (p.id === id) score = 0;
        else if (String(p.id).indexOf(digits) === 0) score = 150;
      }
      if (!numeric && qn) {
        const s = scoreOf(p.name, q, qn);
        if (s < score) score = s;
      }
      if (score !== Infinity) out.push({ id: p.id, name: p.name, score });
    }

    out.sort((a, b) => (a.score - b.score) || (a.id - b.id) || a.name.localeCompare(b.name));
    state.matches = out;
    state.shown = SEARCH_BATCH;
  }

  /* ======================================================================
     Filtro por tipo
     ====================================================================== */
  function buildTypeChips() {
    const host = $('#typeChips');
    host.textContent = '';
    const mk = (label, value, cls) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip ' + (cls || '');
      b.dataset.type = value;
      b.textContent = label;
      if (value) b.style.setProperty('--c', 'var(--t-' + value + ')');
      b.setAttribute('aria-pressed', 'false');
      return b;
    };
    host.appendChild(mk('Todos', '', 'todos on'));
    TYPES.forEach((t) => host.appendChild(mk(TYPE_ES[t] || cap(t), t, '')));
  }

  async function selectType(type) {
    state.type = type;
    state.typeList = null;
    document.querySelectorAll('#typeChips .chip').forEach((c) => {
      const on = c.dataset.type === type;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (!type) {
      state.page = 1;
      runSearch(); // vuelve a la vista completa (o al catálogo si hay búsqueda)
      render();
      return;
    }

    state.searchLoading = true;
    state.page = 1;
    renderGrid();
    updateHint();

    try {
      const data = await getJson(API + '/type/' + type);
      const ids = new Set();
      (data.pokemon || []).forEach((p) => {
        const id = detailFromUrl(p.pokemon.url);
        if (id) ids.add(id);
      });
      // El endpoint de tipo no incluye formas alternas: se restringe al catálogo.
      state.typeList = new Set(state.catalog.filter((p) => ids.has(p.id)).map((p) => p.id));
      state.searchLoading = false;
      state.page = 1;
      runSearch();
      render();
    } catch (err) {
      state.searchLoading = false;
      state.type = '';
      state.typeList = null;
      render();
      toast('No se pudo aplicar el filtro de tipo.');
    }
  }

  /* ======================================================================
     Vista: qué se pinta
     ====================================================================== */
  const searching = () => state.query.trim().length > 0;
  const typeActivo = () => !!state.typeList;

  /* Vista base: todo el catálogo, o sólo los Pokémon del tipo elegido. */
  function browseList() {
    return typeActivo()
      ? state.catalog.filter((p) => state.typeList.has(p.id))
      : state.catalog;
  }

  function currentList() {
    // Con búsqueda activa se usan las coincidencias (ya filtradas por tipo);
    // si no, se pagina la vista base, que respeta el filtro de tipo.
    if (searching()) return state.matches.slice(0, state.shown);
    const all = browseList();
    const total = all.length;
    const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > maxPage) state.page = maxPage;
    if (state.page < 1) state.page = 1;
    const start = (state.page - 1) * state.pageSize;
    return all.slice(start, start + state.pageSize);
  }

  /* ======================================================================
     Render
     ====================================================================== */
  function render() {
    renderGrid();
    renderPager();
    updateHint();
  }

  function renderGrid() {
    const grid = $('#grid');
    const items = state.ready ? currentList() : [];

    if (!state.ready) {
      // Esqueletos de espera: sólo si la cuadrícula está vacía, para que un
      // segundo render (caché → red) no acumule una tanda encima de otra.
      grid.setAttribute('aria-busy', 'true');
      if (!grid.children.length) {
        for (let i = 0; i < state.pageSize; i += 1) grid.appendChild(skeletonCard(null));
      }
      return;
    }

    const keys = items.map((i) => i.id);
    const stale = [...cards.keys()].filter((id) => !keys.includes(id));
    stale.forEach((id) => { const el = cards.get(id); if (el) el.remove(); cards.delete(id); });

    if (!items.length && !state.searchLoading) {
      grid.setAttribute('aria-busy', 'false');
      [...cards.values()].forEach((el) => el.remove());
      cards.clear();
      grid.textContent = '';
      grid.appendChild(emptyState());
      return;
    }

    grid.setAttribute('aria-busy', 'false');

    // Se descarta lo que quedó de un render anterior: los esqueletos de espera
    // (sin id) no están en `cards`, así que nunca los quitaría el barrido de
    // obsoletos y se quedarían cargando para siempre.
    [...grid.children].forEach((el) => {
      const id = el.dataset ? Number(el.dataset.id) : NaN;
      if (!id || !cards.has(id)) el.remove();
    });
    const moreEl = grid.querySelector('.more');
    if (moreEl) moreEl.remove();

    // Mantiene el orden pedido, creando o moviendo sólo lo necesario (sin parpadeo).
    const frag = document.createDocumentFragment();
    const queueIds = [];

    items.forEach((item) => {
      let card = cards.get(item.id);
      if (!card) {
        const d = detailCache.get(item.id);
        card = d ? fullCard(d) : skeletonCard(item.id, item.name);
        cards.set(item.id, card);
      }
      paintName(card, item.name);
      frag.appendChild(card);
      if (!detailCache.has(item.id)) queueIds.push(item.id);
    });

    grid.appendChild(frag);

    // Techo de tarjetas vivas para no acumular nodos al recorrer todo el catálogo.
    if (cards.size > MAX_CARDS) {
      const live = new Set(keys);
      for (const [id, el] of cards) {
        if (cards.size <= MAX_CARDS) break;
        if (!live.has(id)) { el.remove(); cards.delete(id); }
      }
    }

    if (queueIds.length) queue(queueIds, state.partial ? 0 : 1);
    renderMore();
  }

  /* Botón «Mostrar más» cuando la búsqueda supera el lote visible. */
  function renderMore() {
    const grid = $('#grid');
    const prev = grid.querySelector('.more');
    if (prev) prev.remove();
    if (!searching()) return;
    const rest = state.matches.length - state.shown;
    if (rest <= 0) return;

    const wrap = document.createElement('div');
    wrap.className = 'more';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary';
    btn.dataset.more = '1';
    btn.textContent = 'Mostrar ' + Math.min(rest, SEARCH_BATCH) + ' más (' + rest + ' restantes)';
    wrap.appendChild(btn);
    grid.appendChild(wrap);
  }

  function emptyState() {
    const div = document.createElement('div');
    div.className = 'empty';
    if (state.searchLoading) {
      div.innerHTML = '<b>Filtrando por tipo…</b>Cargando la lista de Pokémon de ese tipo.';
    } else if (searching()) {
      const tipo = state.type ? ' en el tipo ' + esc(TYPE_ES[state.type] || state.type) : '';
      div.innerHTML = '<b>Sin resultados</b>No hay Pokémon que coincidan con «' +
        esc(state.query.trim()) + '»' + tipo + '.';
      if (state.type) div.appendChild(botonLimpiarTipo());
    } else if (state.type) {
      div.innerHTML = '<b>Sin Pokémon</b>Este tipo no tiene registros.';
      div.appendChild(botonLimpiarTipo());
    } else {
      div.innerHTML = '<b>Catálogo vacío</b>No se recibieron datos de la API.';
    }
    return div;
  }

  function botonLimpiarTipo() {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.clearType = '1';
    b.className = 'primary';
    b.textContent = 'Quitar filtro de tipo';
    return b;
  }

  /* Mapa índice→índice entre el texto tal cual (menos acentos) y el mismo texto
     en minúsculas, para poder buscar y aun así pintar las mayúsculas originales. */
  function indexMap(text) {
    let hay = '';
    const idx = [];
    for (let i = 0; i < text.length; i += 1) {
      const dec = text[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (let k = 0; k < dec.length; k += 1) { hay += dec[k]; idx.push(i); }
    }
    return { hay, idx };
  }

  /* Envuelve en <mark> el fragmento de `raw` que coincide con `qn` (ya
     normalizado). Devuelve HTML escapado, o null si no se puede resaltar. */
  function highlight(raw, qn) {
    if (!qn) return null;
    const { hay, idx } = indexMap(raw);
    const i = hay.indexOf(qn);
    if (i !== -1) {
      const s = idx[i];
      const e = idx[i + qn.length - 1] + 1;
      return esc(raw.slice(0, s)) + '<mark>' + esc(raw.slice(s, e)) + '</mark>' + esc(raw.slice(e));
    }
    // El texto ya venía normalizado (los nombres de la API son ASCII simple).
    const d = raw.indexOf(qn);
    if (d === -1) return null;
    return esc(raw.slice(0, d)) + '<mark>' + esc(raw.slice(d, d + qn.length)) + '</mark>' + esc(raw.slice(d + qn.length));
  }

  function paintName(card, name) {
    const el = card.querySelector('.pname');
    if (!el) return;
    // La clave incluye la consulta: si sólo se comparara el nombre, una tarjeta
    // ya pintada sin búsqueda nunca se volvería a pintar con el resaltado.
    const q = state.query.trim();
    const clave = name + '\u0000' + q;
    if (el.dataset.name === clave) return;
    el.dataset.name = clave;
    const marked = highlight(prettyName(name), norm(q));
    if (marked) el.innerHTML = marked;
    else el.textContent = prettyName(name);
  }

  function skeletonCard(id, name) {
    const card = document.createElement('article');
    card.className = 'card skeleton loading';
    if (id) {
      card.dataset.id = id;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', '#' + pad4(id) + ', cargando…');
      cards.set(id, card);
    }
    card.setAttribute('aria-busy', 'true');
    card.innerHTML = '<div class="imgbox"><span class="sk img"></span></div>' +
      '<div class="meta"><h2 class="pname"></h2><span class="sk line s1"></span><span class="sk line s2"></span></div>' +
      '<span class="pid">' + (id ? '#' + pad4(id) : '') + '</span>';
    if (id && name) paintName(card, name);
    return card;
  }

  function setCardSkeleton(card, id, name) {
    card.className = 'card skeleton loading';
    card.setAttribute('aria-busy', 'true');
    card.innerHTML = '<div class="imgbox"><span class="sk img"></span></div>' +
      '<div class="meta"><h2 class="pname"></h2><span class="sk line s1"></span><span class="sk line s2"></span></div>' +
      '<span class="pid">#' + pad4(id) + '</span>';
    if (name) paintName(card, name);
  }

  /* Franja superior con el color del tipo (referencia visual en cada tarjeta). */
  function addTint(card, types) {
    const tint = document.createElement('span');
    tint.className = 'tint';
    const lista = (types && types.length ? types : ['normal']);
    tint.style.background = lista.length > 1
      ? 'linear-gradient(90deg,' + lista.map((t) => 'var(--t-' + t + ')').join(' 50%,') + ' 50%)'
      : 'var(--t-' + lista[0] + ')';
    if (types && types.length) tint.title = 'Tipo: ' + types.map((t) => TYPE_ES[t] || cap(t)).join(' / ');
    card.appendChild(tint);
  }

  /* Encola los datos de apoyo de un Pokémon: su cadena evolutiva y las
     relaciones de daño. Las relaciones de los 18 tipos ya se piden una sola vez
     al arrancar (ver precalentarTipos), porque las debilidades cruzan todos los
     tipos atacantes y con unas pocas la lista saldría incompleta. */
  function pedirDatosApoyo(d) {
    if (!evoCache.has(d.id) && !evoPending.has(d.id)) evoPendiente.set(d.id, true);
    scheduleExtras();
  }

  /* Precarga (una única vez, en el carril de apoyo) las relaciones de los 18
     tipos. Con ellas en caché, cualquier Pokémon calcula sus debilidades al
     instante y sin resultados a medias. */
  function precalentarTipos() {
    TYPES.forEach((t) => {
      if (!typeRelCache.has(t) && !typeRelPending.has(t)) typeRelPendiente.add(t);
    });
    scheduleExtras();
  }

  function fullCard(d) {
    const card = document.createElement('article');
    card.className = 'card ' + tintClass(d.types);
    card.dataset.id = d.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', prettyName(d.name) + ', ver estadísticas');
    card.setAttribute('aria-busy', 'false');

    const box = document.createElement('div');
    box.className = 'imgbox';
    const img = makeImage(d, { host: box });
    if (img) box.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('h2');
    name.className = 'pname';
    meta.appendChild(name);

    const chips = document.createElement('div');
    chips.className = 'tchips';
    d.types.forEach((t) => chips.appendChild(typeChip(t)));
    meta.appendChild(chips);

    const pid = document.createElement('span');
    pid.className = 'pid';
    pid.textContent = '#' + pad4(d.id);

    addTint(card, d.types);
    card.append(box, meta, pid);
    name.textContent = prettyName(d.name);
    name.dataset.name = d.name;
    return card;
  }

  function fillCard(id, d) {
    const card = cards.get(id);
    if (!card || !d) return;
    const fresh = fullCard(d);
    card.replaceWith(fresh);
    cards.set(id, fresh);
  }

  function markCardError(id) {
    const card = cards.get(id);
    if (!card) return;
    const name = (state.catalog.find((p) => p.id === id) || {}).name;
    card.className = 'card errtag';
    card.removeAttribute('aria-busy');
    card.innerHTML = '<div class="imgbox"><span class="ph">#' + pad4(id) + '</span></div>' +
      '<div class="meta"><h2 class="pname"></h2><span class="sk line s1"></span></div>';
    if (name) paintName(card, name);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reload';
    btn.dataset.retry = String(id);
    btn.title = 'Reintentar';
    btn.setAttribute('aria-label', 'Reintentar cargar #' + pad4(id));
    btn.textContent = '↻';
    card.appendChild(btn);
  }

  function typeChip(type) {
    const span = document.createElement('span');
    span.className = 'tchip';
    span.style.setProperty('--c', 'var(--t-' + type + ')');
    span.textContent = TYPE_ES[type] || cap(type);
    return span;
  }

  /* ----------------------------------------------------------------------
     Ventajas de tipo
     ---------------------------------------------------------------------- */

  /* Clase de tinte para el color del tipo en la tarjeta. */
  function tintClass(types) {
    return 't-' + ((types && types[0]) || 'normal');
  }

  /* Relaciones de daño de un tipo. Devuelve null mientras están en camino. */
  function relationsOf(type) {
    if (!typeRelCache.has(type) && !typeRelPending.has(type)) typeRelPendiente.add(type);
    const r = typeRelCache.get(type);
    if (!r) return null;
    return { doble: new Set(r.pegaDoble) };
  }

  /* Ventajas de tipo de un Pokémon:
     - `strong`: tipos a los que hace daño doble (según sus tipos de ataque).
     - `weak`: tipos de los que recibe daño multiplicado, con su factor, que
       puede ser 4× si sus dos tipos son débiles al mismo atacante. */
  function efectosDe(types) {
    const rels = (types || []).map(relationsOf);
    if (!rels.length || rels.some((r) => !r)) return null;

    /* Ofensiva: se acota a lo que cada tipo pega doble. Los medios daños y las
       inmunidades NO se restan entre tipos: si Fuego pega doble a Acero, sigue
       siendo una ventaja aunque Volador pegue medio al mismo Acero. */
    const fuerte = new Set();
    rels.forEach((r) => r.doble.forEach((t) => fuerte.add(t)));

    /* Defensiva: para cada tipo atacante se consulta SU `double_damage_from`
       (contra qué es débil), y se multiplica por cada tipo del Pokémon. Así un
       tipo con dos debilidades al mismo atacante da 4×. */
    const debil = {};
    TYPES.forEach((atk) => {
      const rel = typeRelCache.get(atk);
      if (!rel) return;
      let m = 1;
      types.forEach((def) => {
        if ((rel.recibeDoble || []).includes(def)) m *= 2;
        else if ((rel.recibeMitad || []).includes(def)) m *= 0.5;
        else if ((rel.recibeNada || []).includes(def)) m = 0;
      });
      if (m > 1) debil[atk] = m;
    });

    return {
      strong: [...fuerte].sort(porNombreTipo),
      weak: Object.keys(debil).sort(porNombreTipo),
      factores: debil
    };
  }

  function porNombreTipo(a, b) {
    return (TYPE_ES[a] || a).localeCompare(TYPE_ES[b] || b);
  }

  function efChip(t, factor) {
    const s = document.createElement('span');
    s.className = 'efchip';
    s.style.setProperty('--c', 'var(--t-' + t + ')');
    s.textContent = TYPE_ES[t] || cap(t);
    if (factor && factor !== 2) {
      const i = document.createElement('i');
      i.textContent = ' ' + factor + '×';
      s.appendChild(i);
    }
    return s;
  }

  function efFila(etiqueta, tipos, factores, nota) {
    const fila = document.createElement('div');
    fila.className = 'efrow';
    const tag = document.createElement('span');
    tag.className = 'eftag';
    tag.textContent = etiqueta;
    fila.appendChild(tag);
    if (!tipos.length) {
      const vacio = document.createElement('span');
      vacio.className = 'evoempty';
      vacio.textContent = 'ninguno';
      fila.appendChild(vacio);
      return fila;
    }
    tipos.forEach((t) => fila.appendChild(efChip(t, factores && factores[t])));
    if (nota) {
      const n = document.createElement('span');
      n.className = 'evoempty';
      n.textContent = nota;
      fila.appendChild(n);
    }
    return fila;
  }

  /* Rellena la sección de ventajas. El título lo pone la sección que la
     contiene, así que aquí sólo van las filas. */
  function actualizarVentajas(host, d) {
    const ef = efectosDe(d.types);
    host.textContent = '';
    if (!ef) { // las relaciones de daño todavía están en camino
      host.appendChild(phLine('w70'));
      host.appendChild(phLine('w45'));
      return;
    }
    const tieneCuatro = ef.weak.some((t) => ef.factores[t] === 4);
    host.appendChild(efFila('Fuerte c.', ef.strong, null, null));
    host.appendChild(efFila('Débil c.', ef.weak, ef.factores, tieneCuatro ? '· 4× = muy débil' : null));
  }

  /* ----------------------------------------------------------------------
     Línea evolutiva
     ---------------------------------------------------------------------- */
  function phLine(cls) {
    const s = document.createElement('span');
    s.className = 'ph-line ' + (cls || '');
    return s;
  }

  function evoItem(miembro, actual) {
    const esActual = miembro.id === actual;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'evoitem' + (esActual ? ' este' : '');
    item.dataset.id = String(miembro.id);
    if (esActual) {
      // El Pokémon que se está viendo no lleva a ninguna parte: es el actual.
      item.disabled = true;
      item.setAttribute('aria-current', 'true');
      item.setAttribute('aria-label', prettyName(miembro.name) + ', es el Pokémon que estás viendo');
    } else {
      item.setAttribute('aria-label', 'Ver características de ' + prettyName(miembro.name));
    }
    if (miembro.form) item.title = prettyName(miembro.name) + ' (forma alterna: lleva a su especie base)';
    else if (!esActual) item.title = 'Ver características de ' + prettyName(miembro.name);
    const img = makeImage({ id: miembro.id, name: miembro.name, artwork: null, sprite: spriteOf(miembro.id) },
      { host: item, alt: prettyName(miembro.name) });
    if (img) item.appendChild(img);
    const n = document.createElement('span');
    n.className = 'evon';
    n.textContent = prettyName(miembro.name);
    item.appendChild(n);
    return item;
  }

  function actualizarEvo(host, id) {
    const evo = evoCache.get(id);
    host.textContent = '';

    if (evo === undefined) { // todavía en camino
      host.appendChild(phLine('w70'));
      host.appendChild(phLine('w45'));
      return;
    }
    if (!evo || !evo.stages || evo.stages.length < 2) {
      const p = document.createElement('span');
      p.className = 'evoempty';
      p.textContent = 'Este Pokémon no tiene evoluciones.';
      host.appendChild(p);
      return;
    }

    const lista = document.createElement('div');
    lista.className = 'evolist';
    evo.stages.forEach((etapa, i) => {
      if (i) {
        const fl = document.createElement('span');
        fl.className = 'evoarrow';
        fl.textContent = '›';
        lista.appendChild(fl);
      }
      const grupo = document.createElement('span');
      grupo.className = 'evostage';
      etapa.forEach((m) => grupo.appendChild(evoItem(m, id)));
      lista.appendChild(grupo);
    });
    host.appendChild(lista);
  }

  /* Repinta el panel de detalle si está abierto y acaban de llegar datos de
     apoyo. Las secciones se reemplazan sólo cuando su dato ya está en caché. */
  function repintarExtras() {
    const dlg = $('#detail');
    const abierto = dlg && (dlg.open || dlg.hasAttribute('open'));
    if (!abierto) return;
    const caja = $('#dBody');
    if (!caja) return;
    const id = Number(caja.dataset.id);
    const d = detailCache.get(id);
    if (!d) return;
    const cuerpoEvo = caja.querySelector('.devo');
    const cuerpoAdv = caja.querySelector('.dadv');
    const evo = cuerpoEvo && cuerpoEvo.querySelector('.dcuerpo');
    const adv = cuerpoAdv && cuerpoAdv.querySelector('.dcuerpo');
    if (evo && evoCache.has(id)) actualizarEvo(evo, id);
    if (adv && typeRelCache.size) actualizarVentajas(adv, d);
  }

  function hayPendientes() {
    // Hay trabajo mientras quede algo encolado o alguna tarea en vuelo (al
    // terminar, cada `finally` vuelve a llamar a schedule()).
    return typeRelPendiente.size > 0 || evoPendiente.size > 0 ||
           typeRelPending.size > 0 || evoPending.size > 0 || runningBg > 0;
  }

  function scheduleExtras() {
    if (hayPendientes()) schedule();
  }

  /* ======================================================================
     Paginación y estado
     ====================================================================== */
  function renderPager() {
    // Con un tipo activo el total es el del subconjunto, no el del catálogo.
    const total = browseList().length;
    const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
    const pageBox = $('#pageJump');
    pageBox.max = String(maxPage);
    pageBox.disabled = searching() || !total;
    pageBox.value = String(state.page);

    const showJump = !searching();
    pageBox.hidden = !showJump;
    $('#go').hidden = !showJump;
    document.querySelector('label[for="pageJump"]').hidden = !showJump;

    const prevDisabled = searching() || state.page <= 1;
    const nextDisabled = searching() || state.page >= maxPage || !total;
    ['#prev', '#prev2'].forEach((s) => { $(s).disabled = prevDisabled; });
    ['#next', '#next2'].forEach((s) => { $(s).disabled = nextDisabled; });

    $('#pageStatus').textContent = total
      ? 'página ' + state.page + ' / ' + maxPage
      : '—';
  }

  function updateHint() {
    const hint = $('#hint');
    if (!hint) return;
    if (state.searchLoading) { hint.textContent = 'Filtrando por tipo…'; return; }

    const total = state.catalog.length;
    if (!total) { hint.textContent = 'No se pudo cargar el catálogo.'; return; }

    if (state.partial) {
      const from = (state.page - 1) * state.pageSize + 1;
      const to = Math.min(state.page * state.pageSize, total);
      hint.innerHTML = 'Mostrando <b>' + from + '–' + to + '</b> · cargando el catálogo completo…';
      return;
    }

    if (searching()) {
      const n = state.matches.length;
      const tipo = state.type ? ' en ' + (TYPE_ES[state.type] || state.type) : '';
      hint.innerHTML = n
        ? '<b>' + n + '</b> resultado' + (n === 1 ? '' : 's') + ' para «' + esc(state.query.trim()) + '»' + esc(tipo)
        : 'Sin coincidencias para «' + esc(state.query.trim()) + '»' + esc(tipo) + ' · prueba con otro nombre o número';
      return;
    }

    if (state.type) {
      const n = browseList().length;
      const from = (state.page - 1) * state.pageSize + 1;
      const to = Math.min(state.page * state.pageSize, n);
      hint.innerHTML = 'Tipo <b>' + esc(TYPE_ES[state.type] || state.type) + '</b> · mostrando <b>' +
        from + '–' + to + '</b> de ' + n + ' · catálogo: ' + total;
      return;
    }

    const from = (state.page - 1) * state.pageSize + 1;
    const to = Math.min(state.page * state.pageSize, total);
    hint.innerHTML = 'Mostrando <b>' + from + '–' + to + '</b> de ' + total + ' Pokémon · escribe un nombre para buscar en todos';
  }

  /* ======================================================================
     Detalle
     ====================================================================== */
  let lastTrigger = null;

  async function openDetail(id, trigger) {
    const dlg = $('#detail');
    lastTrigger = trigger || null;
    $('#dName').textContent = 'Cargando…';
    $('#dId').textContent = '#' + pad4(id);
    $('#dArt').textContent = '';
    $('#dTypes').textContent = '';
    // Se limpia el id para no confundir el panel mientras carga el nuevo.
    delete $('#dBody').dataset.id;
    $('#dBody').innerHTML = '<p class="hint">Cargando datos de #' + pad4(id) + '…</p>';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');

    try {
      const d = detailCache.get(id) || await loadDetail(id);
      if (!d) throw new Error('sin datos');
      fillDetail(d);
    } catch (err) {
      $('#dName').textContent = 'No se pudo cargar';
      $('#dBody').innerHTML = '<p class="err">Hubo un problema al pedir los datos de este Pokémon.</p>';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'primary';
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', () => { retryDetail(id); openDetail(id, lastTrigger); });
      $('#dBody').appendChild(retry);
    }
  }

  /* Sección del panel que se rellena después, cuando llegan los datos de apoyo. */
  function bloqueDiferido(titulo, clase) {
    const section = document.createElement('section');
    section.className = 'block ' + clase;
    const h = document.createElement('h3');
    h.textContent = titulo;
    section.appendChild(h);
    const cuerpo = document.createElement('div');
    cuerpo.className = 'dcuerpo';
    section.appendChild(cuerpo);
    return { section, cuerpo };
  }

  function fillDetail(d) {
    $('#dName').textContent = prettyName(d.name);
    $('#dId').textContent = '#' + pad4(d.id);

    const art = $('#dArt');
    art.textContent = '';
    const img = makeImage(d, { host: art, eager: true, alt: 'Imagen de ' + prettyName(d.name) });
    if (img) art.appendChild(img);

    const types = $('#dTypes');
    types.textContent = '';
    d.types.forEach((t) => types.appendChild(typeChip(t)));

    const body = $('#dBody');
    body.textContent = '';
    // Ya con los datos del Pokémon, el panel sabe a quién representa: es lo que
    // permite repintar evoluciones y ventajas cuando llegan.
    body.dataset.id = String(d.id);

    /* Habilidades */
    if (d.abilities.length) body.appendChild(block('Habilidades', () => {
      const ul = document.createElement('ul');
      ul.className = 'plain';
      d.abilities.forEach((a) => {
        const li = document.createElement('li');
        li.textContent = prettyName(a.name);
        if (a.hidden) {
          const h = document.createElement('span');
          h.className = 'h';
          h.textContent = 'oculta';
          li.appendChild(h);
        }
        ul.appendChild(li);
      });
      return ul;
    }));

    /* Datos físicos */
    body.appendChild(block('Datos', () => {
      const wrap = document.createElement('div');
      wrap.className = 'facts';
      const facts = [
        ['Altura', d.heightM.toFixed(1) + ' m'],
        ['Peso', d.weightKg.toFixed(1) + ' kg'],
        ['Exp. base', String(d.baseExp)],
        ['Tipos', String(d.types.length)]
      ];
      facts.forEach(([label, value]) => {
        const f = document.createElement('div');
        f.className = 'fact';
        const s = document.createElement('span');
        s.textContent = label;
        const b = document.createElement('b');
        b.textContent = value;
        f.append(s, b);
        wrap.appendChild(f);
      });
      if (d.cry) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '▶ Grito';
        btn.title = 'Reproducir el grito';
        btn.addEventListener('click', () => {
          const audio = new Audio(d.cry);
          audio.play().catch(() => toast('El navegador no pudo reproducir el grito.'));
        });
        wrap.appendChild(btn);
      }
      return wrap;
    }));

    /* Estadísticas base */
    body.appendChild(block('Estadísticas base', () => {
      const wrap = document.createElement('div');
      wrap.className = 'stats';
      d.stats.forEach((s) => {
        const row = document.createElement('div');
        row.className = 'stat';

        const lab = document.createElement('span');
        lab.className = 'lab';
        lab.textContent = s.label;

        const track = document.createElement('div');
        track.className = 'track';
        track.setAttribute('role', 'meter');
        track.setAttribute('aria-label', s.label);
        track.setAttribute('aria-valuenow', String(s.value));
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', String(s.max));
        const fill = document.createElement('i');
        fill.style.background = statColor(s.value);
        track.appendChild(fill);

        const val = document.createElement('span');
        val.className = 'val';
        val.textContent = String(s.value);

        row.append(lab, track, val);
        wrap.appendChild(row);

        // Se anima tras insertar en el documento.
        requestAnimationFrame(() => { fill.style.width = Math.min(100, (s.value / s.max) * 100).toFixed(1) + '%'; });
      });

      const total = document.createElement('div');
      total.className = 'total';
      const t1 = document.createElement('span');
      t1.textContent = 'Total de estadísticas';
      const t2 = document.createElement('b');
      t2.textContent = String(d.total);
      total.append(t1, t2);
      wrap.appendChild(total);
      return wrap;
    }));

    /* Evoluciones y ventajas de tipo: se piden al abrir el detalle. */
    const evoBlock = bloqueDiferido('Evoluciones', 'devo');
    const advBlock = bloqueDiferido('Ventajas y debilidades', 'dadv');
    body.append(evoBlock.section, advBlock.section);
    actualizarEvo(evoBlock.cuerpo, d.id);
    actualizarVentajas(advBlock.cuerpo, d);
    pedirDatosApoyo(d);
  }

  function block(title, build) {
    const section = document.createElement('section');
    section.className = 'block';
    const h = document.createElement('h3');
    h.textContent = title;
    section.append(h, build());
    return section;
  }

  function statColor(v) {
    if (v < 50) return 'linear-gradient(90deg,#f87171,#fb923c)';
    if (v < 80) return 'linear-gradient(90deg,#fbbf24,#facc15)';
    if (v < 110) return 'linear-gradient(90deg,#4ade80,#22d3ee)';
    return 'linear-gradient(90deg,#7cc4ff,#4ade80)';
  }

  function closeDetail() {
    const dlg = $('#detail');
    if (dlg.open) dlg.close();
    else dlg.removeAttribute('open');
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  }

  /* ======================================================================
     Eventos
     ====================================================================== */
  function goToPage(p) {
    const maxPage = Math.max(1, Math.ceil(browseList().length / state.pageSize));
    const next = Math.min(maxPage, Math.max(1, Number(p) || 1));
    if (next === state.page) return;
    state.page = next;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function wire() {
    /* Buscador */
    const q = $('#q');
    const onQuery = debounce(() => {
      state.query = q.value;
      state.shown = SEARCH_BATCH;
      runSearch();
      render();
    }, 150);
    q.addEventListener('input', () => {
      const has = q.value.length > 0;
      $('#clear').hidden = !has;
      onQuery();
    });
    $('#clear').addEventListener('click', () => {
      q.value = '';
      $('#clear').hidden = true;
      state.query = '';
      runSearch();
      render();
      q.focus();
    });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && q.value) {
        e.stopPropagation();
        q.value = '';
        $('#clear').hidden = true;
        state.query = '';
        runSearch();
        render();
      }
    });
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement || {}).tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        q.focus();
        q.select();
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        q.focus();
      }
    });

    /* Filtro por tipo */
    $('#typeChips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      selectType(chip.dataset.type || '');
    });

    /* Paginación */
    const back = () => goToPage(state.page - 1);
    const fwd = () => goToPage(state.page + 1);
    $('#prev').addEventListener('click', back);
    $('#prev2').addEventListener('click', back);
    $('#next').addEventListener('click', fwd);
    $('#next2').addEventListener('click', fwd);
    $('#go').addEventListener('click', () => goToPage($('#pageJump').value));
    $('#pageJump').addEventListener('keydown', (e) => { if (e.key === 'Enter') goToPage(e.target.value); });
    $('#pageSize').addEventListener('change', (e) => {
      const size = Number(e.target.value);
      state.pageSize = PAGE_SIZES.includes(size) ? size : 48;
      state.page = 1;
      render();
    });

    /* «Mostrar más» en resultados de búsqueda y quitar el filtro de tipo */
    document.addEventListener('click', (e) => {
      const more = e.target.closest('[data-more]');
      if (more) {
        state.shown += SEARCH_BATCH;
        renderGrid();
        updateHint();
        return;
      }
      if (e.target.closest('[data-clear-type]')) selectType('');
    });

    /* Tarjetas: abrir detalle y reintentar */
    $('#grid').addEventListener('click', (e) => {
      const retry = e.target.closest('[data-retry]');
      if (retry) { e.stopPropagation(); retryDetail(Number(retry.dataset.retry)); return; }
      const card = e.target.closest('.card');
      if (!card || !card.dataset.id || card.classList.contains('skeleton')) return;
      openDetail(Number(card.dataset.id), card);
    });
    $('#grid').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.card');
      if (!card || !card.dataset.id || card.classList.contains('skeleton')) return;
      e.preventDefault();
      openDetail(Number(card.dataset.id), card);
    });

    /* Detalle */
    $('#dClose').addEventListener('click', closeDetail);
    $('#detail').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDetail(); });
    $('#detail').addEventListener('cancel', (e) => { e.preventDefault(); closeDetail(); });

    /* Saltar de una evolución a sus características: al pulsar Pichu, Pikachu
       o Raichu se abre ese Pokémon en el mismo panel. El botón de la forma
       actual está deshabilitado, así que sólo responden sus evoluciones. */
    const irAEvolucion = (e) => {
      const item = e.target.closest('.evoitem');
      if (!item || item.disabled || !item.dataset.id) return;
      e.stopPropagation();
      openDetail(Number(item.dataset.id), item);
    };
    $('#dBody').addEventListener('click', irAEvolucion);
    $('#dBody').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      irAEvolucion(e);
    });
  }

  /* ======================================================================
     Arranque
     ====================================================================== */
  function boot() {
    buildTypeChips();
    wire();
    // Primera tanda visible al instante (con sus datos e imágenes); el catálogo
    // completo llega después y sólo sustituye los nombres.
    state.partial = true;
    state.catalog = seedCatalog(state.pageSize);
    state.ready = true;
    render();
    precalentarTipos();
    loadCatalog();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
