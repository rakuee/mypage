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

  /* ---- Proyectos: un panel abierto a la vez ----
     Los navegadores actuales ya lo resuelven con <details name="proyectos">;
     esto cubre los que todavía no soportan ese atributo. */
  var listaProyectos = document.querySelector('.projects');
  if (listaProyectos && !('name' in document.createElement('details'))) {
    var paneles = listaProyectos.querySelectorAll('details');
    Array.prototype.forEach.call(paneles, function (panel) {
      panel.addEventListener('toggle', function () {
        if (!panel.open) { return; }
        Array.prototype.forEach.call(paneles, function (otro) {
          if (otro !== panel) { otro.open = false; }
        });
      });
    });
  }

  /* ---- Regla graduada lateral ----
     Decorativa (aria-hidden): las marcas las dibuja el CSS y aquí van los
     números proporcionales y la aguja que marca en qué parte de la página
     estás. Se agranda al desplazarte y se contrae al detenerte, sin ocultarse. */
  var regla = document.getElementById('ruler');
  var numeros = document.getElementById('rulerLabels');
  var aguja = document.getElementById('rulerNeedle');

  if (regla && numeros && aguja) {
    var altoRegla = 0;
    var agujaPendiente = false;
    var temporizador = null;

    /* Página que queda por recorrer. 0 = no hay nada que desplazar. */
    function recorrido() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    /* Proporción recorrida, entre 0 y 1. */
    function avance() {
      var total = recorrido();
      if (total <= 0) { return 0; }
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      return Math.min(1, Math.max(0, y / total));
    }

    /* Números cada 10 % del alto de la ventana; si la pantalla es baja,
       cada 20 % para que no se encimen. */
    function dibujarNumeros() {
      var alto = regla.clientHeight || window.innerHeight;
      if (alto === altoRegla) { return; }
      altoRegla = alto;
      var paso = alto < 520 ? 20 : 10;
      var html = '';
      for (var p = 0; p <= 100; p += paso) {
        /* En los extremos el número se ancla hacia adentro para no cortarse. */
        var ajuste = p === 0 ? '0' : (p === 100 ? '-100%' : '-50%');
        html += '<span style="top:' + p + '%;--ty:' + ajuste + '">' + p + '</span>';
      }
      numeros.innerHTML = html;
    }

    function dibujarAguja() {
      agujaPendiente = false;
      aguja.style.top = (avance() * 100).toFixed(2) + '%';
      aguja.hidden = recorrido() <= 0;
    }

    function alDesplazar() {
      regla.classList.add('is-moving');
      if (!agujaPendiente) {
        agujaPendiente = true;
        window.requestAnimationFrame(dibujarAguja);
      }
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(function () {
        regla.classList.remove('is-moving');
      }, 200);
    }

    dibujarNumeros();
    dibujarAguja();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', function () { dibujarNumeros(); dibujarAguja(); });
    window.addEventListener('load', dibujarAguja);
  }
}());
