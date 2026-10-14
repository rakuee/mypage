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
}());
