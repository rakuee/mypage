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

  /* ---- Encabezado: se compacta al bajar y marca la sección en la que estás ----
     Un único escucha de scroll, agrupado con requestAnimationFrame. */
  var enlacesNav = document.querySelectorAll('.nav a[href^="#"]');
  var destinos = [];

  Array.prototype.forEach.call(enlacesNav, function (enlace) {
    var destino = document.getElementById(enlace.getAttribute('href').slice(1));
    if (destino) { destinos.push({ enlace: enlace, destino: destino }); }
  });

  var pendienteEncabezado = false;

  function pintarEncabezado() {
    pendienteEncabezado = false;

    var y = scrollActual();
    document.body.classList.toggle('desplazado', y > 8);

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
