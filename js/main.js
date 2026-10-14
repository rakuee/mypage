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
     botón ✕, con Escape (nativo) o pulsando el fondo. */
  var abridores = document.querySelectorAll('[data-abre]');
  Array.prototype.forEach.call(abridores, function (boton) {
    boton.addEventListener('click', function () {
      var modal = document.getElementById(boton.getAttribute('data-abre'));
      if (!modal) { return; }
      modal.focoPrevio = boton;
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        /* Navegadores sin <dialog> modal: se muestra como bloque y se cierra
           con el botón, que sigue funcionando. */
        modal.setAttribute('open', '');
      }
      var cerrar = modal.querySelector('.modal-cerrar');
      if (cerrar) { cerrar.focus(); }
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('dialog.modal'), function (modal) {
    function cerrar() {
      if (typeof modal.close === 'function') {
        modal.close();   /* el navegador devuelve el foco al botón de origen */
      } else {
        modal.removeAttribute('open');
        if (modal.focoPrevio && modal.focoPrevio.focus) { modal.focoPrevio.focus(); }
      }
    }

    modal.addEventListener('click', function (evento) {
      /* Clic en el fondo (fuera de la ficha) o en el botón de cerrar */
      if (evento.target === modal || evento.target.closest('[data-cierra]')) { cerrar(); }
    });
  });

  /* ---- El nombre de la portada viaja a la esquina al bajar ----
     Mientras te desplazas, el h1 se encoge y se pega a la esquina superior
     izquierda, donde vive el nombre del encabezado (que se oculta para no
     duplicarlo). Al volver arriba regresa exactamente a su sitio, porque sólo
     se usa un transform y el recorrido va ligado al scroll. */
  var titulo = document.getElementById('hero-title');
  var marca = document.querySelector('.brand-name');
  var sinMovimiento = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (titulo && marca && !sinMovimiento) {
    var medidas = null;
    var pedido = false;

    function medir() {
      var previo = titulo.style.transform;
      titulo.style.transform = 'none';
      var caja = titulo.getBoundingClientRect();
      titulo.style.transform = previo;

      var cajaMarca = marca.getBoundingClientRect();
      var fuenteTitulo = parseFloat(window.getComputedStyle(titulo).fontSize) || 0;
      var fuenteMarca = parseFloat(window.getComputedStyle(marca).fontSize) || 0;

      medidas = {
        docTop: caja.top + (window.pageYOffset || document.documentElement.scrollTop || 0),
        left: caja.left,
        alto: caja.height,
        escala: fuenteTitulo ? Math.min(1, fuenteMarca / fuenteTitulo) : 0.2,
        destinoLeft: cajaMarca.left,
        destinoCentro: cajaMarca.top + cajaMarca.height / 2
      };
    }

    function pintar() {
      pedido = false;
      if (!medidas || !medidas.escala) { return; }

      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      /* El viaje dura justo lo que tarda el título en llegar arriba por sí solo */
      var viaje = Math.max(1, medidas.docTop - (medidas.destinoCentro - (medidas.alto * medidas.escala) / 2));
      var p = Math.min(1, Math.max(0, y / viaje));
      var e = p * p * (3 - 2 * p);   /* arranca y aterriza suave */

      var escala = 1 + (medidas.escala - 1) * e;
      var dx = (medidas.destinoLeft - medidas.left) * e;
      var vista = medidas.docTop - y;
      var destino = medidas.destinoCentro - (medidas.alto * escala) / 2;
      var dy = (destino - vista) * e;

      titulo.style.transform = 'translate(' + dx.toFixed(2) + 'px, ' + dy.toFixed(2)
        + 'px) scale(' + escala.toFixed(4) + ')';
      document.body.classList.toggle('marca-acoplada', e > 0.75);
    }

    function alDesplazar() {
      if (!pedido) {
        pedido = true;
        window.requestAnimationFrame(pintar);
      }
    }

    medir();
    pintar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', function () { medir(); pintar(); });
    window.addEventListener('load', function () { medir(); pintar(); });
  }
}());
