/* ==========================================================================
   tonatiuhliera.com — comportamiento mínimo
   Sin dependencias. Todo degrada bien si el JS no carga.
   ========================================================================== */
(function () {
  'use strict';

  /* ---- Año actual en el footer ---- */
  var year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  /* ---- Menú móvil ---- */
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('menu');

  function closeMenu() {
    if (!menu || !toggle) { return; }
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    /* Cerrar al elegir un destino */
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) { closeMenu(); }
    });

    /* Cerrar con Escape y devolver el foco */
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.classList.contains('is-open')) {
        closeMenu();
        toggle.focus();
      }
    });
  }

  /* ---- Aviso de correo pendiente (TODO_EMAIL) ---- */
  var mailBtn = document.getElementById('mailBtn');
  var mailNote = document.getElementById('mailNote');
  if (mailBtn && mailNote) {
    mailBtn.addEventListener('click', function () {
      mailNote.textContent = 'Correo pendiente de publicar. Escríbeme por LinkedIn mientras tanto.';
      mailNote.hidden = false;
    });
  }

  /* ---- Copiar comandos de git clone ---- */
  var copyButtons = document.querySelectorAll('.copy[data-copy]');
  Array.prototype.forEach.call(copyButtons, function (button) {
    button.addEventListener('click', function () {
      var text = button.getAttribute('data-copy') || '';

      function done(ok) {
        button.textContent = ok ? 'Copiado' : 'Copia manual';
        button.setAttribute('data-done', '1');
        window.setTimeout(function () {
          button.textContent = 'Copiar comando';
          button.removeAttribute('data-done');
        }, 2000);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  });

  /* ---- Fichas de los proyectos en ventana modal ----
     Cada botón abre el <dialog> que indica su data-abre. Se cierra con el
     botón ✕, con Escape (nativo) o pulsando el fondo.
     Al abrir, la página NO se mueve: se enfoca con preventScroll (porque el
     <dialog> vive dentro de la sección y el navegador arrastraba la vista al
     principio al enfocarlo) y, por si acaso, se repone la posición. */
  function scrollActual() {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  /* Coloca el scroll sin animación (html usa scroll-behavior: smooth) */
  function fijarScroll(y) {
    var raiz = document.documentElement;
    var previo = raiz.style.scrollBehavior;
    raiz.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    raiz.style.scrollBehavior = previo;
  }

  function mantenerScroll(y) {
    if (scrollActual() !== y) { fijarScroll(y); }
    window.requestAnimationFrame(function () {
      if (scrollActual() !== y) { fijarScroll(y); }
    });
  }

  var abridores = document.querySelectorAll('[data-abre]');
  Array.prototype.forEach.call(abridores, function (boton) {
    boton.addEventListener('click', function () {
      var modal = document.getElementById(boton.getAttribute('data-abre'));
      if (!modal) { return; }

      var y = scrollActual();
      modal.focoPrevio = boton;

      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        /* Navegadores sin <dialog> modal: se muestra como bloque y se cierra
           con el botón, que sigue funcionando. */
        modal.setAttribute('open', '');
      }

      var cerrar = modal.querySelector('.modal-cerrar');
      if (cerrar) {
        try {
          cerrar.focus({ preventScroll: true });
        } catch (e) {
          cerrar.focus();
        }
      }
      mantenerScroll(y);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('dialog.modal'), function (modal) {
    function cerrar() {
      var y = scrollActual();
      if (typeof modal.close === 'function') {
        modal.close();   /* el navegador devuelve el foco al botón de origen */
      } else {
        modal.removeAttribute('open');
        if (modal.focoPrevio && modal.focoPrevio.focus) {
          try { modal.focoPrevio.focus({ preventScroll: true }); } catch (e) { modal.focoPrevio.focus(); }
        }
      }
      mantenerScroll(y);
    }

    modal.addEventListener('click', function (evento) {
      /* Clic en el fondo (fuera de la ficha) o en el botón de cerrar */
      if (evento.target === modal || evento.target.closest('[data-cierra]')) { cerrar(); }
    });

    /* Escape u otro cierre nativo: que tampoco salte la vista */
    modal.addEventListener('close', function () { mantenerScroll(scrollActual()); });
  });

  /* ---- Rejilla reactiva ----
     Las líneas se desplazan con el scroll (paralaje) y con el puntero; el brillo
     sigue al cursor. Todo por transform, agrupado en un requestAnimationFrame. */
  var rejilla = document.getElementById('rejilla');
  var puntero = { x: 0, y: 0, vivo: false };
  var rejillaPendiente = false;
  var sinMovimiento = !!(window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var conPunteroFino = !!(window.matchMedia
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  function pintarRejilla() {
    rejillaPendiente = false;
    if (!rejilla || !puntero.vivo) { return; }

    var y = scrollActual();
    var paso = 64;
    var gx = ((puntero.x - (window.innerWidth || 0) / 2) * 0.012) % paso;
    var gy = (-(y * 0.06)) % paso;
    rejilla.style.setProperty('--gx', gx.toFixed(1) + 'px');
    rejilla.style.setProperty('--gy', gy.toFixed(1) + 'px');
    rejilla.style.setProperty('--px', puntero.x.toFixed(1) + 'px');
    rejilla.style.setProperty('--py', puntero.y.toFixed(1) + 'px');
  }

  if (rejilla && !sinMovimiento) {
    window.addEventListener('pointermove', function (evento) {
      puntero.x = evento.clientX;
      puntero.y = evento.clientY;
      if (!puntero.vivo) {
        puntero.vivo = true;
        rejilla.classList.add('rejilla-viva');
      }
      if (!rejillaPendiente) {
        rejillaPendiente = true;
        window.requestAnimationFrame(pintarRejilla);
      }
    }, { passive: true });
  }

  /* ---- Tarjetas 3D: se inclinan siguiendo al puntero ----
     Sólo con ratón (hover + puntero fino) y sin "reducir movimiento". */
  var tarjetasTilt = document.querySelectorAll('.pitem, .card');

  if (tarjetasTilt.length && conPunteroFino && !sinMovimiento) {
    Array.prototype.forEach.call(tarjetasTilt, function (tarjeta) {
      var programado = false;
      var ultimo = null;

      function inclinar() {
        programado = false;
        if (!ultimo) { return; }
        var caja = tarjeta.getBoundingClientRect();
        if (!caja.width || !caja.height) { return; }

        var relX = (ultimo.x - caja.left) / caja.width;
        var relY = (ultimo.y - caja.top) / caja.height;
        tarjeta.style.setProperty('--tx', ((relY - 0.5) * -9).toFixed(2) + 'deg');
        tarjeta.style.setProperty('--ty', ((relX - 0.5) * 11).toFixed(2) + 'deg');
        tarjeta.style.setProperty('--mx', (relX * 100).toFixed(1) + '%');
        tarjeta.style.setProperty('--my', (relY * 100).toFixed(1) + '%');
      }

      tarjeta.addEventListener('pointermove', function (evento) {
        ultimo = { x: evento.clientX, y: evento.clientY };
        if (!programado) {
          programado = true;
          window.requestAnimationFrame(inclinar);
        }
      }, { passive: true });

      tarjeta.addEventListener('pointerleave', function () {
        ultimo = null;
        tarjeta.style.setProperty('--tx', '0deg');
        tarjeta.style.setProperty('--ty', '0deg');
      });
    });
  }

  /* ---- Barrido glitch al cambiar de sección ---- */
  var glitch = document.getElementById('glitch');
  var glitchUltimo = 0;

  function glitchar() {
    if (!glitch || sinMovimiento) { return; }
    var ahora = Date.now();
    if (ahora - glitchUltimo < 700) { return; }   /* sin aspamear al desplazar */
    glitchUltimo = ahora;
    glitch.classList.remove('glitch-activo');
    void glitch.offsetWidth;                      /* reinicia la animación */
    glitch.classList.add('glitch-activo');
  }

  if (glitch) {
    glitch.addEventListener('animationend', function () {
      glitch.classList.remove('glitch-activo');
    });
  }

  /* ---- Entrada del calendario ----
     Sin pantalla de carga: el disco aparece en cuanto se pinta la página
     (dos frames para que la transición de entrada llegue a verse). */
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () { document.body.classList.add('sol-listo'); });
  });

  /* ---- Encabezado: se compacta al bajar y marca la sección en la que estás ----
     Un único escucha de scroll, agrupado con requestAnimationFrame. */
  var enlacesNav = document.querySelectorAll('.nav a[href^="#"]');
  var destinos = [];
  var seccionActiva = null;

  Array.prototype.forEach.call(enlacesNav, function (enlace) {
    var destino = document.getElementById(enlace.getAttribute('href').slice(1));
    if (destino) { destinos.push({ enlace: enlace, destino: destino }); }
    /* Al pulsar una opción del menú, barrido glitch */
    enlace.addEventListener('click', glitchar);
  });

  var pendienteEncabezado = false;

  function pintarEncabezado() {
    pendienteEncabezado = false;

    var y = scrollActual();
    document.body.classList.toggle('desplazado', y > 8);
    pintarRejilla();

    if (!destinos.length) { return; }

    /* La sección activa es la última cuyo borde superior pasó la línea de lectura */
    var linea = (window.innerHeight || 0) * 0.35;
    var activo = destinos[0];
    var i;
    for (i = 0; i < destinos.length; i++) {
      if (destinos[i].destino.getBoundingClientRect().top <= linea) { activo = destinos[i]; }
    }
    /* Al final de la página gana siempre la última */
    if (y + (window.innerHeight || 0) >= document.documentElement.scrollHeight - 2) {
      activo = destinos[destinos.length - 1];
    }

    /* Al cambiar de sección, barrido glitch (con su propio antifrecuencia) */
    if (seccionActiva && activo !== seccionActiva) { glitchar(); }
    seccionActiva = activo;

    for (i = 0; i < destinos.length; i++) {
      var esActivo = destinos[i] === activo;
      destinos[i].enlace.classList.toggle('is-activo', esActivo);
      if (esActivo) {
        destinos[i].enlace.setAttribute('aria-current', 'true');
      } else {
        destinos[i].enlace.removeAttribute('aria-current');
      }
    }
  }

  function alDesplazarPagina() {
    if (!pendienteEncabezado) {
      pendienteEncabezado = true;
      window.requestAnimationFrame(pintarEncabezado);
    }
  }

  /* ---- Calendario del sol (portada animada) ----
     Dibuja el disco en el <svg id="solDisco"> con el origen en el centro.
     De dentro hacia fuera: cara del sol (imagen), Nahui Ollin con 4 cartuchos
     que llevan a las secciones, anillo de puntos, anillo de los 20 días (cada
     cuadro abre la ficha de un proyecto), anillo de rayos y banda exterior con
     texto. Los proyectos se leen de la propia página (.pitem-head[data-abre]). */
  var solSvg = document.getElementById('solDisco');
  if (solSvg) { construirSol(solSvg); }

  function construirSol(svg) {
    var NS = 'http://www.w3.org/2000/svg';

    function el(tag, attrs, padre) {
      var nodo = document.createElementNS(NS, tag);
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) { nodo.setAttribute(k, attrs[k]); }
      }
      if (padre) { padre.appendChild(nodo); }
      return nodo;
    }
    function polar(r, grados) {
      var a = (grados - 90) * Math.PI / 180;
      return (r * Math.cos(a)).toFixed(2) + ',' + (r * Math.sin(a)).toFixed(2);
    }
    function circulo(r, clase, padre) { return el('circle', { cx: 0, cy: 0, r: r, 'class': clase }, padre); }
    function anillo(orden, segundos, inverso) {
      var entra = el('g', { 'class': 'sol-entra', style: '--i:' + orden }, svg);
      return el('g', {
        'class': 'sol-gira' + (inverso ? ' sol-inverso' : ''),
        style: '--t:' + segundos + 's'
      }, entra);
    }
    function sigla(nombre) {
      var palabras = nombre.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_\-]+/)
        .filter(function (p) { return p && !/^(of|de|la|el|the)$/i.test(p); });
      if (palabras.length > 1) { return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase(); }
      return (palabras[0] || '?').slice(0, 2).toUpperCase();
    }

    /* Proyectos de la página */
    var proyectos = [];
    Array.prototype.forEach.call(document.querySelectorAll('.pitem-head[data-abre]'), function (boton) {
      var ficha = boton.getAttribute('data-abre');
      var modal = document.getElementById(ficha);
      var seccion = boton.closest('section');
      var badge = modal && modal.querySelector('.badge');
      var nombre = boton.textContent.replace(/\s+/g, ' ').trim();
      proyectos.push({
        ficha: ficha,
        nombre: nombre,
        sigla: boton.getAttribute('data-sigla') || sigla(nombre),
        tipo: badge ? badge.textContent.trim() : 'Proyecto',
        seccion: seccion ? seccion.id : ''
      });
    });

    /* Secciones del menú (sin Inicio) para los cartuchos */
    var secciones = [];
    Array.prototype.forEach.call(document.querySelectorAll('.nav a[href^="#"]'), function (enlace) {
      var href = enlace.getAttribute('href');
      if (href !== '#inicio' && secciones.length < 4) { secciones.push({ href: href, nombre: enlace.textContent.trim() }); }
    });

    /* Recorte circular de la cara */
    var defs = el('defs', {}, svg);
    var clip = el('clipPath', { id: 'solCaraRecorte' }, defs);
    circulo(100, '', clip);
    el('path', { id: 'solTextoCamino', d: 'M0,-482 A482,482 0 1 1 0,482 A482,482 0 1 1 0,-482' }, defs);

    var i, g, a;

    /* 6 · Banda exterior: marcas y texto en círculo */
    g = anillo(5, 320, false);
    circulo(498, 'sol-trazo', g);
    circulo(468, 'sol-trazo', g);
    circulo(455, 'sol-tenue', g);
    for (i = 0; i < 104; i++) {
      el('circle', { cx: 0, cy: -461.5, r: 2, 'class': 'sol-punto', transform: 'rotate(' + (i * 360 / 104) + ')' }, g);
    }
    var texto = el('text', { 'class': 'sol-texto' }, g);
    var camino = el('textPath', { href: '#solTextoCamino', textLength: 2990, lengthAdjust: 'spacing' }, texto);
    camino.textContent = 'Tonatiuh Liera · UNAM · ENES Morelia · Tecnologías para la Información en Ciencias · Proyectos · ';

    /* 5 · Rayos y plumas */
    g = anillo(4, 210, true);
    circulo(448, 'sol-trazo', g);
    circulo(402, 'sol-trazo', g);
    for (i = 0; i < 120; i++) {
      el('line', { x1: 0, y1: -406, x2: 0, y2: -444, 'class': 'sol-tenue', transform: 'rotate(' + (i * 3) + ')' }, g);
    }
    for (i = 0; i < 8; i++) {
      var ang = i * 45;
      el('polygon', { points: polar(400, ang - 10) + ' ' + polar(476, ang) + ' ' + polar(400, ang + 10), 'class': 'sol-fondo' }, g);
      el('line', { x1: 0, y1: -404, x2: 0, y2: -462, 'class': 'sol-tenue', transform: 'rotate(' + ang + ')' }, g);
      el('polygon', { points: polar(400, ang + 22.5 - 4) + ' ' + polar(440, ang + 22.5) + ' ' + polar(400, ang + 22.5 + 4), 'class': 'sol-fondo' }, g);
    }

    /* 4 · Anillo de los 20 días: los accesos a los proyectos */
    g = anillo(3, 150, false);
    circulo(394, 'sol-trazo', g);
    circulo(318, 'sol-trazo', g);
    var vistos = {};
    for (i = 0; i < 20; i++) {
      var p = proyectos.length ? proyectos[i % proyectos.length] : null;
      a = el('a', {
        'class': 'sol-cuadro',
        transform: 'rotate(' + (i * 18) + ') translate(0,-356)'
      }, g);
      if (p) {
        a.setAttribute('href', '#' + p.seccion);
        a.setAttribute('data-ficha', p.ficha);
        a.setAttribute('data-nombre', p.nombre);
        a.setAttribute('data-tipo', p.tipo);
        a.setAttribute('aria-label', p.nombre + ': abrir ficha');
        /* Sólo el primer cuadro de cada proyecto entra en el orden del tabulador */
        if (vistos[p.ficha]) {
          a.setAttribute('tabindex', '-1');
          a.setAttribute('aria-hidden', 'true');
        }
        vistos[p.ficha] = true;
      }
      el('rect', { x: -32, y: -32, width: 64, height: 64, rx: 2, 'class': 'sol-caja' }, a);
      el('rect', { x: -26, y: -26, width: 52, height: 52, 'class': 'sol-marco' }, a);
      var num = el('text', { x: 0, y: -14, 'class': 'sol-num' }, a);
      num.textContent = (i < 9 ? '0' : '') + (i + 1);
      var letras = el('text', { x: 0, y: 16, 'class': 'sol-sigla' }, a);
      letras.textContent = p ? p.sigla : '·';
    }

    /* 3 · Anillo de puntos (quincunces) */
    g = anillo(2, 110, true);
    circulo(312, 'sol-tenue', g);
    circulo(280, 'sol-trazo', g);
    for (i = 0; i < 40; i++) {
      var q = el('g', { transform: 'rotate(' + (i * 9) + ') translate(0,-296)' }, g);
      [[0, 0], [-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(function (d) {
        el('circle', { cx: d[0], cy: d[1], r: 1.8, 'class': 'sol-punto' }, q);
      });
      el('line', { x1: 0, y1: -283, x2: 0, y2: -309, 'class': 'sol-tenue', transform: 'rotate(' + (i * 9 + 4.5) + ')' }, g);
    }

    /* 2 · Nahui Ollin: aspa, flechas y 4 cartuchos hacia las secciones */
    g = anillo(1, 170, false);
    circulo(112, 'sol-trazo', g);
    for (i = 0; i < 4; i++) {
      var cardinal = i * 90;
      var diagonal = 45 + i * 90;
      el('polygon', { points: polar(112, diagonal - 14) + ' ' + polar(150, diagonal - 7) + ' ' + polar(150, diagonal + 7) + ' ' + polar(112, diagonal + 14), 'class': 'sol-fondo' }, g);
      el('polygon', { points: polar(114, cardinal - 12) + ' ' + polar(178, cardinal) + ' ' + polar(114, cardinal + 12), 'class': 'sol-fondo' }, g);
      var s = secciones[i];
      a = el('a', { 'class': 'sol-cartucho', transform: 'rotate(' + diagonal + ') translate(0,-200)' }, g);
      if (s) {
        a.setAttribute('href', s.href);
        a.setAttribute('aria-label', 'Ir a ' + s.nombre);
        a.setAttribute('data-nombre', s.nombre);
        a.setAttribute('data-tipo', 'Sección');
      }
      el('rect', { x: -50, y: -48, width: 100, height: 96, rx: 2, 'class': 'sol-caja' }, a);
      el('rect', { x: -43, y: -41, width: 86, height: 82, 'class': 'sol-marco' }, a);
      var rom = el('text', { x: 0, y: -18, 'class': 'sol-num' }, a);
      rom.textContent = ['I', 'II', 'III', 'IV'][i];
      var et = el('text', { x: 0, y: 8, 'class': 'sol-sigla' }, a);
      et.textContent = s ? s.nombre.split(' ')[0] : '';
      if (s && s.nombre.split(' ')[1]) {
        var et2 = el('text', { x: 0, y: 24, 'class': 'sol-sigla' }, a);
        et2.textContent = s.nombre.split(' ').slice(1).join(' ');
      }
    }

    /* 1 · Cara del sol: la de la piedra, recortada y en grises (no gira) */
    var cara = el('g', { 'class': 'sol-entra', style: '--i:0' }, svg);
    circulo(104, 'sol-fondo', cara);
    el('image', {
      href: 'assets/calendariodelsol.jpg',
      x: -645, y: -583, width: 1273, height: 1167,
      'clip-path': 'url(#solCaraRecorte)',
      'class': 'sol-cara',
      'aria-hidden': 'true'
    }, cara);
    circulo(100, 'sol-trazo', cara);

    /* Etiqueta flotante con el nombre completo y resaltado de los cuadros
       del mismo proyecto. Sigue al puntero; con teclado se coloca junto al
       cuadro enfocado. */
    var tip = document.getElementById('solTip');
    var tipTipo = document.getElementById('solTipo');
    var tipNombre = document.getElementById('solNombre');
    var senalado = null;

    function colocarTip(x, y) {
      if (!tip || tip.hidden) { return; }
      var ancho = tip.offsetWidth;
      var alto = tip.offsetHeight;
      var vw = document.documentElement.clientWidth;
      /* A la izquierda del puntero (el disco está pegado a la derecha) */
      var tx = x - ancho - 18;
      if (tx < 8) { tx = Math.min(x + 18, vw - ancho - 8); }
      var ty = Math.max(8, y - alto / 2);
      tip.style.setProperty('--tx', Math.round(tx) + 'px');
      tip.style.setProperty('--ty', Math.round(ty) + 'px');
    }

    function senalar(objetivo) {
      if (objetivo === senalado) { return; }
      senalado = objetivo;
      var ficha = objetivo && objetivo.getAttribute('data-ficha');
      Array.prototype.forEach.call(svg.querySelectorAll('.sol-cuadro'), function (c) {
        c.classList.toggle('is-hl', !!ficha && c.getAttribute('data-ficha') === ficha);
      });
      svg.classList.toggle('sol-enfoque', !!ficha);
      if (!tip) { return; }
      if (objetivo) {
        tipTipo.textContent = objetivo.getAttribute('data-tipo');
        tipNombre.textContent = objetivo.getAttribute('data-nombre');
        tip.hidden = false;
      } else {
        tip.hidden = true;
      }
    }

    svg.addEventListener('pointermove', function (evento) {
      if (evento.pointerType === 'touch') { return; }
      senalar(evento.target.closest('a[data-nombre]'));
      colocarTip(evento.clientX, evento.clientY);
    });
    svg.addEventListener('pointerleave', function () { senalar(null); });
    svg.addEventListener('focusin', function (evento) {
      var objetivo = evento.target.closest('a[data-nombre]');
      senalar(objetivo);
      if (objetivo) {
        var r = objetivo.getBoundingClientRect();
        colocarTip(r.left, r.top + r.height / 2);
      }
    });
    svg.addEventListener('focusout', function () { senalar(null); });
    window.addEventListener('scroll', function () { senalar(null); }, { passive: true });

    /* Clic: los cartuchos bajan a su sección (enlace nativo); los cuadros
       saltan a la sección del proyecto y abren su ficha. */
    svg.addEventListener('click', function (evento) {
      var enlace = evento.target.closest('a[href]');
      if (!enlace) { return; }
      glitchar();
      var ficha = enlace.getAttribute('data-ficha');
      if (!ficha) { return; }
      evento.preventDefault();
      var destino = document.getElementById(enlace.getAttribute('href').slice(1));
      if (destino) {
        var raiz = document.documentElement;
        var previo = raiz.style.scrollBehavior;
        raiz.style.scrollBehavior = 'auto';
        destino.scrollIntoView({ block: 'start' });
        raiz.style.scrollBehavior = previo;
      }
      var boton = document.querySelector('.pitem-head[data-abre="' + ficha + '"]');
      if (boton) { boton.click(); }
      senalar(null);
    });
  }

  /* ---- Calendario: acelera al desplazarte ----
     Los anillos giran con animaciones CSS; al hacer scroll se sube su
     playbackRate según la velocidad del desplazamiento y luego vuelve poco a
     poco a la velocidad normal. Cambiar el ritmo no reinicia la animación,
     así que el giro sigue continuo. */
  var anillosSol = [];
  if (solSvg && !sinMovimiento && typeof Element.prototype.getAnimations === 'function') {
    var solImpulso = 1;            /* multiplicador actual de la velocidad */
    var solYPrevia = scrollActual();
    var solTPrevio = 0;
    var solAnimando = false;
    var SOL_MAXIMO = 16;           /* tope: hasta 16 veces más rápido */

    var ritmoSol = function (ritmo) {
      if (!anillosSol.length) {
        Array.prototype.forEach.call(solSvg.querySelectorAll('.sol-gira'), function (g) {
          anillosSol = anillosSol.concat(g.getAnimations());
        });
      }
      for (var k = 0; k < anillosSol.length; k++) {
        if (anillosSol[k].updatePlaybackRate) { anillosSol[k].updatePlaybackRate(ritmo); }
        else { anillosSol[k].playbackRate = ritmo; }
      }
    };

    var frenarSol = function () {
      solImpulso = 1 + (solImpulso - 1) * 0.965;   /* ~2 s hasta el ritmo normal */
      if (solImpulso < 1.02) { solImpulso = 1; }
      ritmoSol(solImpulso);
      if (solImpulso > 1) {
        window.requestAnimationFrame(frenarSol);
      } else {
        solAnimando = false;
      }
    };

    window.addEventListener('scroll', function () {
      var ahora = window.performance ? performance.now() : Date.now();
      var y = scrollActual();
      var dt = Math.max(16, ahora - solTPrevio);
      var velocidad = Math.abs(y - solYPrevia) / dt;   /* px por ms */
      solYPrevia = y;
      solTPrevio = ahora;
      /* Sólo se acelera; nunca baja de golpe mientras sigues desplazándote */
      solImpulso = Math.max(solImpulso, Math.min(SOL_MAXIMO, 1 + velocidad * 9));
      ritmoSol(solImpulso);
      if (!solAnimando) {
        solAnimando = true;
        window.requestAnimationFrame(frenarSol);
      }
    }, { passive: true });
  }

  pintarEncabezado();
  window.addEventListener('scroll', alDesplazarPagina, { passive: true });
  window.addEventListener('resize', alDesplazarPagina);
  window.addEventListener('load', alDesplazarPagina);
}());
