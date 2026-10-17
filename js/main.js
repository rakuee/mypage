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

  /* ---- Pantalla de carga ----
     Progreso decorativo y salida al terminar de cargar, con un mínimo visible
     para que no parpadee y un tope por si el evento load tarda. */
  var carga = document.getElementById('carga');
  var cargaBarra = document.getElementById('cargaBarra');
  var cargaPct = document.getElementById('cargaPct');
  var cargaTexto = document.getElementById('cargaTexto');

  if (carga) {
    if (sinMovimiento) {
      /* Sin animaciones: fuera de inmediato */
      carga.classList.add('carga-fuera');
      window.setTimeout(function () {
        if (carga.parentNode) { carga.parentNode.removeChild(carga); }
      }, 600);
    } else {
      var cargaInicio = Date.now();
      var cargaCerrada = false;
      var cargaAncho = 0;
      /* La pantalla se queda como mínimo este tiempo (3 s). La barra tarda lo
         mismo en llegar al 96 %, y el tope duro da 2,5 s de margen extra por si
         el evento load tardara más de la cuenta. */
      var cargaMinimo = 3000;
      var cargaTope = cargaMinimo + 2500;
      var cargaPasos = ['iniciando sistema', 'cargando interfaz', 'cargando imágenes', 'listo'];

      function cargaAvanzar() {
        if (cargaCerrada) { return; }
        var t = Math.min(1, (Date.now() - cargaInicio) / cargaMinimo);
        var objetivo = Math.round((1 - Math.pow(1 - t, 3)) * 96);
        if (objetivo > cargaAncho) {
          cargaAncho = objetivo;
          if (cargaBarra) { cargaBarra.style.width = cargaAncho + '%'; }
          if (cargaPct) { cargaPct.textContent = (cargaAncho < 10 ? '0' : '') + cargaAncho; }
          if (cargaTexto) {
            /* El estado avanza con el tiempo, no con el ancho, para que vaya
               repartido a lo largo de toda la espera */
            cargaTexto.textContent = cargaPasos[Math.min(cargaPasos.length - 1, Math.floor(t * cargaPasos.length))];
          }
        }
        if (t < 1) { window.requestAnimationFrame(cargaAvanzar); }
      }

      function cargaCerrar() {
        if (cargaCerrada) { return; }
        cargaCerrada = true;
        if (cargaBarra) { cargaBarra.style.width = '100%'; }
        if (cargaPct) { cargaPct.textContent = '100'; }
        if (cargaTexto) { cargaTexto.textContent = 'listo'; }

        window.setTimeout(function () {
          carga.classList.add('carga-fuera');
          /* Sin animaciones pendientes: ni la red de seguridad ni ninguna otra
             pueden volver a mostrarla. */
          carga.style.animation = 'none';
          /* Y fuera del DOM cuando acabe el desvanecido */
          window.setTimeout(function () {
            if (carga.parentNode) { carga.parentNode.removeChild(carga); }
          }, 900);
        }, 170);
      }

      function cargaIntentar() {
        var transcurrido = Date.now() - cargaInicio;
        if (transcurrido < cargaMinimo) {
          window.setTimeout(cargaIntentar, cargaMinimo - transcurrido);
          return;
        }
        cargaCerrar();
      }

      window.requestAnimationFrame(cargaAvanzar);
      if (document.readyState === 'complete') {
        cargaIntentar();
      } else {
        window.addEventListener('load', cargaIntentar);
      }
      window.setTimeout(cargaCerrar, cargaTope);   /* tope duro */
    }
  }

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

  pintarEncabezado();
  window.addEventListener('scroll', alDesplazarPagina, { passive: true });
  window.addEventListener('resize', alDesplazarPagina);
  window.addEventListener('load', alDesplazarPagina);
}());
