(function () {
  'use strict';

  /* ======================================================================
     Configuración
     ====================================================================== */
  const API = (window.POKEDEX_API || '').replace(/\/$/, '');
  const PAGE_SIZES = [24, 48, 96];
  const SLOW_MS = 3500;      // a partir de aquí se avisa que el servidor «despierta»
  const TIMEOUT_MS = 70000;  // el plan gratuito puede tardar ~1 min en arrancar

  const TYPES = [
    'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost',
    'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon',
    'dark', 'fairy'
  ];
  const TYPE_ES = {
    normal: 'Normal', fighting: 'Lucha', flying: 'Volador', poison: 'Veneno',
    ground: 'Tierra', rock: 'Roca', bug: 'Bicho', ghost: 'Fantasma',
    steel: 'Acero', fire: 'Fuego', water: 'Agua', grass: 'Planta',
    electric: 'Eléctrico', psychic: 'Psíquico', ice: 'Hielo', dragon: 'Dragón',
    dark: 'Siniestro', fairy: 'Hada'
  };
  const STATS = [
    ['hp', 'PS'],
    ['attack', 'Ataque'],
    ['defense', 'Defensa'],
    ['specialAttack', 'At. Esp.'],
    ['specialDefense', 'Def. Esp.'],
    ['speed', 'Velocidad']
  ];
  const STAT_MAX = 255;

  /* ======================================================================
     Utilidades
     ====================================================================== */
  const $ = (sel) => document.querySelector(sel);
  const pad4 = (id) => String(id).padStart(4, '0');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const prettyName = (raw) => String(raw || '').split('-').map((w) => (w ? cap(w) : w)).join(' ');
  const typeName = (t) => TYPE_ES[t] || cap(t);

  function norm(str) {
    return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  let toastTimer = null;
  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 5000 : 2800);
  }

  /* Imagen con respaldo: si la URL falla o no hay, se muestra un marcador. */
  function makeArt(p, host) {
    host.textContent = '';
    const ph = () => {
      host.textContent = '';
      host.appendChild(el('span', 'ph', p && p.name ? p.name.charAt(0).toUpperCase() : '?'));
    };
    if (!p || !p.image) { ph(); return; }
    const img = document.createElement('img');
    img.alt = 'Imagen de ' + prettyName(p.name);
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.pending = '1';
    img.addEventListener('load', () => { delete img.dataset.pending; });
    img.addEventListener('error', ph);
    img.src = p.image;
    host.appendChild(img);
  }

  /* ======================================================================
     Cliente del API
     ====================================================================== */
  const logItems = [];

  function logRequest(method, path, status, ms) {
    logItems.unshift({ method, path, status, ms, at: new Date() });
    if (logItems.length > 30) logItems.pop();
    const ok = status >= 200 && status < 300;
    $('#apiLast').textContent = method + ' ' + path + ' → ' + (status || 'sin respuesta');
    const list = $('#apiLog');
    const li = document.createElement('li');
    const m = el('span', 'm m-' + method, method);
    const s = el('span', ok ? 's-ok' : 's-err', String(status || 'ERR'));
    li.append(m, document.createTextNode(path + ' → '), s, document.createTextNode(' · ' + ms + ' ms'));
    list.prepend(li);
    while (list.children.length > 30) list.lastChild.remove();
  }

  function setApiState(stateName, text) {
    const pill = $('#apiPill');
    pill.dataset.state = stateName;
    $('#apiPillText').textContent = text;
  }

  class ApiError extends Error {
    constructor(message, status, details) {
      super(message);
      this.status = status;
      this.details = details || [];
    }
  }

  async function api(method, path, body) {
    const ctrl = new AbortController();
    const started = performance.now();
    const slow = setTimeout(() => setApiState('waking', 'Despertando el servidor…'), SLOW_MS);
    const abort = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(API + path, {
        method,
        headers: Object.assign({ Accept: 'application/json' }, body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal
      });
    } catch (err) {
      logRequest(method, path, 0, Math.round(performance.now() - started));
      setApiState('error', 'Sin conexión con el API');
      throw new ApiError('No se pudo conectar con el backend (' + (API || location.origin) + ').', 0);
    } finally {
      clearTimeout(slow);
      clearTimeout(abort);
    }
    logRequest(method, path, res.status, Math.round(performance.now() - started));
    setApiState('ok', 'API en línea');
    let data = null;
    try { data = await res.json(); } catch (_) { /* sin cuerpo */ }
    if (!res.ok) {
      throw new ApiError((data && data.error) || ('HTTP ' + res.status), res.status, data && data.details);
    }
    return data;
  }

  const Pokedex = {
    list: () => api('GET', '/get'),
    one: (id) => api('GET', '/get/' + id),
    create: (data) => api('POST', '/post', data),
    update: (id, data) => api('PUT', '/put/' + id, data),
    remove: (id) => api('DELETE', '/delete/' + id),
    reset: () => api('POST', '/reset')
  };

  /* ======================================================================
     Estado
     ====================================================================== */
  const state = {
    items: [],        // lo que devolvió GET /get
    loaded: false,
    error: null,
    page: 1,
    pageSize: 48,
    type: '',
    query: '',
    recent: new Set() // ids creados en esta sesión (marca «nuevo»)
  };

  function upsert(p) {
    const i = state.items.findIndex((x) => x.id === p.id);
    if (i === -1) state.items.push(p);
    else state.items[i] = p;
    state.items.sort((a, b) => a.id - b.id);
  }

  /* ======================================================================
     Filtro y búsqueda (sobre los datos del GET)
     ====================================================================== */
  function filtered() {
    let list = state.items;
    if (state.type) list = list.filter((p) => p.types.includes(state.type));
    const q = state.query.trim();
    if (!q) return list;
    const digits = q.replace(/^#/, '');
    if (/^\d{1,4}$/.test(digits)) return list.filter((p) => String(p.id).startsWith(digits));
    const qn = norm(q);
    return list
      .map((p) => {
        const n = norm(p.name);
        const score = n === qn ? 0 : n.startsWith(qn) ? 1 : n.includes(qn) ? 2 : -1;
        return { p, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score || a.p.id - b.p.id)
      .map((x) => x.p);
  }

  /* ======================================================================
     Render
     ====================================================================== */
  function render() {
    const all = filtered();
    const maxPage = Math.max(1, Math.ceil(all.length / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), maxPage);
    const start = (state.page - 1) * state.pageSize;
    renderGrid(all.slice(start, start + state.pageSize), all.length);
    renderPager(all.length, maxPage);
    renderHint(all.length, start);
  }

  function renderGrid(items) {
    const grid = $('#grid');
    grid.textContent = '';

    if (!state.loaded) {
      grid.setAttribute('aria-busy', 'true');
      if (state.error) { grid.appendChild(errorState()); return; }
      for (let i = 0; i < 12; i += 1) {
        const c = el('article', 'card skeleton loading');
        c.innerHTML = '<div class="imgbox"><span class="sk img"></span></div>' +
          '<div class="meta"><span class="sk line s1"></span><span class="sk line s2"></span></div>';
        grid.appendChild(c);
      }
      return;
    }
    grid.setAttribute('aria-busy', 'false');

    if (!items.length) {
      const div = el('div', 'empty');
      div.appendChild(el('b', null, state.items.length ? 'Sin resultados' : 'La base de datos está vacía'));
      div.appendChild(document.createTextNode(state.items.length
        ? 'Ningún Pokémon coincide con la búsqueda o el filtro.'
        : 'Crea un Pokémon nuevo o restaura los 100 originales.'));
      grid.appendChild(div);
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach((p) => frag.appendChild(card(p)));
    grid.appendChild(frag);
  }

  function card(p) {
    const c = el('article', 'card t-' + (p.types[0] || 'normal'));
    c.dataset.id = p.id;
    c.tabIndex = 0;
    c.setAttribute('role', 'button');
    c.setAttribute('aria-label', prettyName(p.name) + ', ver detalle');
    if (state.recent.has(p.id)) { c.classList.add('nuevo'); c.appendChild(el('span', 'badge-new', 'nuevo')); }

    const tint = el('span', 'tint');
    tint.style.background = p.types.length > 1
      ? 'linear-gradient(90deg,var(--t-' + p.types[0] + ') 50%,var(--t-' + p.types[1] + ') 50%)'
      : 'var(--t-' + p.types[0] + ')';

    const box = el('div', 'imgbox');
    makeArt(p, box);

    const meta = el('div', 'meta');
    meta.appendChild(el('h2', 'pname', prettyName(p.name)));
    const chips = el('div', 'tchips');
    p.types.forEach((t) => chips.appendChild(typeChip(t)));
    meta.appendChild(chips);

    c.append(tint, box, meta, el('span', 'pid', '#' + pad4(p.id)));
    return c;
  }

  function typeChip(t) {
    const s = el('span', 'tchip', typeName(t));
    s.style.setProperty('--c', 'var(--t-' + t + ')');
    return s;
  }

  function errorState() {
    const div = el('div', 'empty');
    div.appendChild(el('b', null, 'No se pudo cargar la base de datos'));
    div.appendChild(document.createTextNode(state.error || ''));
    const b = el('button', 'primary', 'Reintentar');
    b.type = 'button';
    b.addEventListener('click', load);
    div.appendChild(document.createElement('br'));
    div.appendChild(b);
    return div;
  }

  function renderPager(total, maxPage) {
    const prevOff = state.page <= 1;
    const nextOff = state.page >= maxPage;
    ['#prev', '#prev2'].forEach((s) => { $(s).disabled = prevOff; });
    ['#next', '#next2'].forEach((s) => { $(s).disabled = nextOff; });
    $('#pageStatus').textContent = total ? 'página ' + state.page + ' / ' + maxPage : '—';
  }

  function renderHint(total, start) {
    const hint = $('#hint');
    if (!state.loaded) { hint.textContent = state.error ? 'Error al cargar.' : 'Cargando la base de datos…'; return; }
    const parts = [];
    if (total) parts.push('Mostrando <b>' + (start + 1) + '–' + Math.min(start + state.pageSize, total) + '</b> de ' + total);
    else parts.push('0 resultados');
    if (state.type) parts.push('tipo <b>' + typeName(state.type) + '</b>');
    parts.push(state.items.length + ' Pokémon en la base de datos');
    hint.innerHTML = parts.join(' · ');
  }

  function buildTypeChips() {
    const host = $('#typeChips');
    const mk = (label, value) => {
      const b = el('button', 'chip' + (value ? '' : ' todos on'), label);
      b.type = 'button';
      b.dataset.type = value;
      b.setAttribute('aria-pressed', value ? 'false' : 'true');
      if (value) b.style.setProperty('--c', 'var(--t-' + value + ')');
      return b;
    };
    host.appendChild(mk('Todos', ''));
    TYPES.forEach((t) => host.appendChild(mk(typeName(t), t)));
  }

  /* ======================================================================
     Detalle
     ====================================================================== */
  let current = null;   // Pokémon abierto en el detalle
  let lastTrigger = null;

  function openModal(dlg) {
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  }
  function closeModal(dlg) {
    if (dlg.open && typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }

  async function openDetail(id, trigger) {
    lastTrigger = trigger || null;
    const cached = state.items.find((p) => p.id === id);
    if (cached) fillDetail(cached);
    openModal($('#detail'));
    // Se consulta GET /get/:id para mostrar siempre la versión del servidor.
    try {
      const fresh = await Pokedex.one(id);
      upsert(fresh);
      if (current && current.id === id) fillDetail(fresh);
    } catch (err) {
      if (err.status === 404) {
        state.items = state.items.filter((p) => p.id !== id);
        closeModal($('#detail'));
        render();
        toast('Ese Pokémon ya no existe en la base de datos.', true);
      } else if (!cached) {
        $('#dName').textContent = 'No se pudo cargar';
        $('#dBody').innerHTML = '';
        $('#dBody').appendChild(el('p', 'err', err.message));
      }
    }
  }

  function fillDetail(p) {
    current = p;
    $('#dName').textContent = prettyName(p.name);
    $('#dId').textContent = '#' + pad4(p.id);
    makeArt(p, $('#dArt'));
    const types = $('#dTypes');
    types.textContent = '';
    p.types.forEach((t) => types.appendChild(typeChip(t)));

    const body = $('#dBody');
    body.textContent = '';

    if (p.description) body.appendChild(block('Descripción', () => el('p', 'ddesc', p.description)));

    if (p.abilities && p.abilities.length) body.appendChild(block('Habilidades', () => {
      const ul = el('ul', 'plain');
      p.abilities.forEach((a) => ul.appendChild(el('li', null, prettyName(a))));
      return ul;
    }));

    body.appendChild(block('Datos', () => {
      const wrap = el('div', 'facts');
      [['Altura', Number(p.height || 0).toFixed(1) + ' m'], ['Peso', Number(p.weight || 0).toFixed(1) + ' kg'], ['Tipos', String(p.types.length)]]
        .forEach(([label, value]) => {
          const f = el('div', 'fact');
          f.append(el('span', null, label), el('b', null, value));
          wrap.appendChild(f);
        });
      return wrap;
    }));

    body.appendChild(block('Estadísticas base', () => {
      const wrap = el('div', 'stats');
      let total = 0;
      STATS.forEach(([key, label]) => {
        const v = (p.stats && p.stats[key]) || 0;
        total += v;
        const row = el('div', 'stat');
        const track = el('div', 'track');
        track.setAttribute('role', 'meter');
        track.setAttribute('aria-label', label);
        track.setAttribute('aria-valuenow', String(v));
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', String(STAT_MAX));
        const fill = document.createElement('i');
        fill.style.background = statColor(v);
        track.appendChild(fill);
        row.append(el('span', 'lab', label), track, el('span', 'val', String(v)));
        wrap.appendChild(row);
        requestAnimationFrame(() => { fill.style.width = Math.min(100, (v / STAT_MAX) * 100).toFixed(1) + '%'; });
      });
      const t = el('div', 'total');
      t.append(el('span', null, 'Total de estadísticas'), el('b', null, String(total)));
      wrap.appendChild(t);
      return wrap;
    }));
  }

  function block(title, build) {
    const s = el('section', 'block');
    s.append(el('h3', null, title), build());
    return s;
  }

  function statColor(v) {
    if (v < 50) return 'linear-gradient(90deg,#f87171,#fb923c)';
    if (v < 80) return 'linear-gradient(90deg,#fbbf24,#facc15)';
    if (v < 110) return 'linear-gradient(90deg,#4ade80,#22d3ee)';
    return 'linear-gradient(90deg,#7cc4ff,#4ade80)';
  }

  /* ======================================================================
     Formulario: crear (POST) y editar (PUT)
     ====================================================================== */
  let editingId = null;

  function buildForm() {
    const f = $('#form');
    const opts = (sel, withEmpty) => {
      if (withEmpty) sel.appendChild(new Option('— ninguno —', ''));
      TYPES.forEach((t) => sel.appendChild(new Option(typeName(t), t)));
    };
    opts(f.type1, false);
    opts(f.type2, true);

    const grid = $('#fStats');
    STATS.forEach(([key, label]) => {
      const l = el('label', null, label);
      const i = document.createElement('input');
      i.type = 'number';
      i.name = 'stat_' + key;
      i.min = '1';
      i.max = '255';
      i.step = '1';
      i.required = true;
      l.appendChild(i);
      grid.appendChild(l);
    });

    f.addEventListener('input', (e) => {
      const n = (e.target.getAttribute && e.target.getAttribute('name')) || '';
      if (n.startsWith('stat_')) updateTotal();
      if (n === 'image' || n === 'name') previewArt();
      if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid');
    });
    f.addEventListener('submit', onSubmit);
  }

  function updateTotal() {
    const f = $('#form');
    $('#fTotal').textContent = String(STATS.reduce((s, [k]) => s + (Number(f['stat_' + k].value) || 0), 0));
  }

  const previewArt = debounce(() => {
    const f = $('#form');
    const img = f.image.value.trim();
    makeArt({ name: f.name.value.trim(), image: /^https?:\/\//i.test(img) ? img : '' }, $('#fArt'));
  }, 250);

  function openEditor(p) {
    const f = $('#form');
    f.reset();
    editingId = p ? p.id : null;
    $('#fTitle').textContent = p ? 'Editar ' + prettyName(p.name) : 'Nuevo Pokémon';
    $('#fMethod').textContent = p ? 'PUT /put/' + p.id : 'POST /post';
    $('#fSubmit').textContent = p ? 'Guardar cambios' : 'Crear Pokémon';
    $('#fErrors').hidden = true;
    f.querySelectorAll('[aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));

    const d = p || {
      name: '', types: ['normal'], height: 1, weight: 10, abilities: [], image: '', description: '',
      stats: { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 }
    };
    f.name.value = prettyName(d.name);
    f.type1.value = d.types[0] || 'normal';
    f.type2.value = d.types[1] || '';
    f.height.value = d.height;
    f.weight.value = d.weight;
    f.abilities.value = (d.abilities || []).join(', ');
    f.image.value = d.image || '';
    f.description.value = d.description || '';
    STATS.forEach(([k]) => { f['stat_' + k].value = d.stats[k]; });
    updateTotal();
    makeArt({ name: d.name, image: d.image }, $('#fArt'));
    openModal($('#editor'));
    setTimeout(() => f.name.focus(), 30);
  }

  function readForm() {
    const f = $('#form');
    const types = [f.type1.value, f.type2.value].filter(Boolean);
    const stats = {};
    STATS.forEach(([k]) => { stats[k] = Number(f['stat_' + k].value); });
    return {
      name: f.name.value.trim(),
      types: [...new Set(types)],
      stats,
      height: f.height.value === '' ? 0 : Number(f.height.value),
      weight: f.weight.value === '' ? 0 : Number(f.weight.value),
      abilities: f.abilities.value.split(',').map((s) => s.trim()).filter(Boolean),
      image: f.image.value.trim(),
      description: f.description.value.trim()
    };
  }

  /* Validación en el navegador (el servidor vuelve a validar todo). */
  function checkForm(data) {
    const f = $('#form');
    const errs = [];
    const bad = (input, msg) => { input.setAttribute('aria-invalid', 'true'); errs.push(msg); };
    if (!data.name) bad(f.name, 'El nombre es obligatorio.');
    STATS.forEach(([k, label]) => {
      const v = data.stats[k];
      if (!Number.isInteger(v) || v < 1 || v > 255) bad(f['stat_' + k], label + ': entero entre 1 y 255.');
    });
    if (data.image && !/^https?:\/\/\S+$/i.test(data.image)) bad(f.image, 'La imagen debe ser una URL http(s).');
    if (data.abilities.length > 4) bad(f.abilities, 'Máximo 4 habilidades.');
    return errs;
  }

  function showErrors(list) {
    const ul = $('#fErrors');
    ul.textContent = '';
    list.forEach((m) => ul.appendChild(el('li', null, m)));
    ul.hidden = !list.length;
    if (list.length) ul.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const data = readForm();
    const errs = checkForm(data);
    if (errs.length) { showErrors(errs); return; }
    showErrors([]);

    const btn = $('#fSubmit');
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Guardando…';
    try {
      let saved;
      if (editingId == null) {
        saved = await Pokedex.create(data);
        state.recent.add(saved.id);
        toast('Creado ' + prettyName(saved.name) + ' (#' + pad4(saved.id) + ').');
      } else {
        saved = await Pokedex.update(editingId, data);
        toast('Guardados los cambios de ' + prettyName(saved.name) + '.');
      }
      upsert(saved);
      closeModal($('#editor'));
      render();
      if (current && current.id === saved.id && $('#detail').open) fillDetail(saved);
      if (editingId == null) goToItem(saved.id);
    } catch (err) {
      showErrors(err.details && err.details.length ? err.details : [err.message]);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  /* Lleva a la página donde quedó un Pokémon (p. ej. el recién creado). */
  function goToItem(id) {
    state.query = '';
    $('#q').value = '';
    $('#clear').hidden = true;
    const list = filtered();
    let idx = list.findIndex((p) => p.id === id);
    if (idx === -1) { selectType(''); idx = filtered().findIndex((p) => p.id === id); }
    if (idx === -1) return;
    state.page = Math.floor(idx / state.pageSize) + 1;
    render();
    const c = document.querySelector('.card[data-id="' + id + '"]');
    if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ======================================================================
     Eliminar (DELETE) y restaurar
     ====================================================================== */
  function confirmar(title, text, okLabel) {
    return new Promise((resolve) => {
      const dlg = $('#confirm');
      $('#cTitle').textContent = title;
      $('#cText').textContent = text;
      $('#cOk').textContent = okLabel;
      const done = (v) => { cleanup(); closeModal(dlg); resolve(v); };
      const ok = () => done(true);
      const no = () => done(false);
      const cleanup = () => {
        $('#cOk').removeEventListener('click', ok);
        dlg.removeEventListener('close', no);
      };
      $('#cOk').addEventListener('click', ok);
      dlg.addEventListener('close', no);
      openModal(dlg);
      $('#cOk').focus();
    });
  }

  async function deleteCurrent() {
    if (!current) return;
    const p = current;
    const yes = await confirmar('¿Eliminar a ' + prettyName(p.name) + '?',
      'Se enviará DELETE /delete/' + p.id + ' y el registro #' + pad4(p.id) + ' se borrará de la base de datos. Puedes recuperarlo con «Restaurar» si es uno de los 100 originales.',
      'Eliminar');
    if (!yes) return;
    try {
      await Pokedex.remove(p.id);
      state.items = state.items.filter((x) => x.id !== p.id);
      state.recent.delete(p.id);
      closeModal($('#detail'));
      current = null;
      render();
      toast('Eliminado ' + prettyName(p.name) + '.');
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function resetAll() {
    const yes = await confirmar('¿Restaurar la base de datos?',
      'Se borrarán los cambios y se volverá a los 100 Pokémon originales (POST /reset).', 'Restaurar');
    if (!yes) return;
    try {
      await Pokedex.reset();
      state.recent.clear();
      await load();
      toast('Base de datos restaurada.');
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ======================================================================
     Carga inicial
     ====================================================================== */
  async function load() {
    state.error = null;
    state.loaded = false;
    setApiState('loading', 'Conectando…');
    render();
    try {
      const data = await Pokedex.list();
      state.items = (data.results || []).sort((a, b) => a.id - b.id);
      state.loaded = true;
    } catch (err) {
      state.error = err.message;
    }
    render();
  }

  /* ======================================================================
     Eventos
     ====================================================================== */
  function selectType(type) {
    state.type = type;
    state.page = 1;
    document.querySelectorAll('#typeChips .chip').forEach((c) => {
      const on = c.dataset.type === type;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    render();
  }

  function goToPage(p) {
    state.page = p;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function wire() {
    const q = $('#q');
    const onQuery = debounce(() => { state.query = q.value; state.page = 1; render(); }, 120);
    q.addEventListener('input', () => { $('#clear').hidden = !q.value; onQuery(); });
    $('#clear').addEventListener('click', () => {
      q.value = ''; $('#clear').hidden = true; state.query = ''; render(); q.focus();
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); q.focus(); q.select(); }
    });

    $('#typeChips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) selectType(chip.dataset.type || '');
    });

    const back = () => goToPage(state.page - 1);
    const fwd = () => goToPage(state.page + 1);
    $('#prev').addEventListener('click', back);
    $('#prev2').addEventListener('click', back);
    $('#next').addEventListener('click', fwd);
    $('#next2').addEventListener('click', fwd);
    $('#pageSize').addEventListener('change', (e) => {
      const size = Number(e.target.value);
      state.pageSize = PAGE_SIZES.includes(size) ? size : 48;
      state.page = 1;
      render();
    });

    $('#btnNew').addEventListener('click', () => openEditor(null));
    $('#btnReset').addEventListener('click', resetAll);

    const openFromCard = (e) => {
      const c = e.target.closest('.card');
      if (!c || !c.dataset.id) return;
      openDetail(Number(c.dataset.id), c);
    };
    $('#grid').addEventListener('click', openFromCard);
    $('#grid').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromCard(e); }
    });

    $('#dEdit').addEventListener('click', () => { if (current) openEditor(current); });
    $('#dDelete').addEventListener('click', deleteCurrent);

    // Cerrar diálogos: botón ✕/Cancelar y clic fuera del cuadro.
    document.querySelectorAll('dialog').forEach((dlg) => {
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg || e.target.closest('[data-close]')) closeModal(dlg);
      });
    });
    $('#detail').addEventListener('close', () => {
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
      lastTrigger = null;
    });
  }

  function boot() {
    $('#apiBase').textContent = API || location.origin;
    buildTypeChips();
    buildForm();
    wire();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
