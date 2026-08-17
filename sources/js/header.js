/**
 * header.js — Header fijo con solo menú al hacer scroll
 * - Al CATÁLOGO muestra logo + menú.
 * - Al desplazar la página y ocultar el logo, el header del menú
 *   queda fijo (position: fixed) y solo se muestra el menú.
 */
(function () {
  const header = document.querySelector('#menu');
  if (!header) return;

  const logo = header.querySelector('img, .logo, [alt="Logo"]');
  const menu = header.querySelector('menu, nav, ul');

  // Altura inicial del logo para calcular el umbral sin depender del estado compacto
  let logoThreshold = 0;

  function computeThreshold() {
    if (logo) {
      // offsetHeight del logo + gap + padding superior
      // Se recalcula solo cuando el header NO está compacto para no medir 0
      if (!header.classList.contains('is-compact')) {
        logoThreshold = logo.offsetHeight;
      }
      // pequeño margen extra (gap + paddings)
      return logoThreshold + 24;
    }
    return 80;
  }

  // Inicializa threshold en la primera medición
  if (logo) {
    // Esperar a que la imagen cargue para medir bien
    if (logo.complete) {
      logoThreshold = logo.offsetHeight;
    } else {
      logo.addEventListener('load', () => {
        logoThreshold = logo.offsetHeight;
        onScroll();
      });
    }
  }

  let ticking = false;

  function applyFixed(shouldFix) {
    const isFixed = header.classList.contains('is-compact');
    if (shouldFix === isFixed) {
      // aún así actualizar la variable de altura si ya está fijo (por resize)
      if (shouldFix) {
        const h = header.offsetHeight;
        document.body.style.setProperty('--header-fixed-height', h + 'px');
      }
      return;
    }

    if (shouldFix) {
      header.classList.add('is-compact');
      document.body.classList.add('has-header-fixed');
      // Medir altura del header ya compacto (solo menú) en el próximo frame
      requestAnimationFrame(() => {
        const h = header.offsetHeight;
        document.body.style.setProperty('--header-fixed-height', h + 'px');
      });
    } else {
      header.classList.remove('is-compact');
      document.body.classList.remove('has-header-fixed');
      document.body.style.removeProperty('--header-fixed-height');
    }
  }

  function onScroll() {
    const threshold = computeThreshold();
    const shouldFix = window.scrollY > threshold;
    applyFixed(shouldFix);
  }

  function onScrollThrottled() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onScroll();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScrollThrottled, { passive: true });
  window.addEventListener('resize', onScrollThrottled);

  // Estado inicial (por si la página carga con scroll)
  // Usar rAF para asegurar layout listo
  requestAnimationFrame(onScroll);
  window.addEventListener('load', onScroll);
})();
