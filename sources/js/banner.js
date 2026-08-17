/**
 * banner.js — Fondo rotativo para #banner
 * - Utiliza las imágenes de la carpeta sources/head/ (banner 01.jpeg … banner 10.jpeg)
 * - Elige una imagen al azar en cada carga y la cambia suavemente cada 30 s (cross-fade)
 * - Si la imagen desborda el banner (cover overflow), se desplaza con el scroll vertical (parallax por background-position):
 *   · más alta que el banner → parallax vertical (top→bottom)
 *   · más ancha que el banner → parallax horizontal (left→right) — mismo progreso que el vertical
 *   · desborda en ambos ejes → parallax diagonal (left/top → right/bottom)
 * - Respeta prefers-reduced-motion para la transición
 * - Funciona en index.html y catalog.html (y en cualquier página que tenga #banner)
 */
(function () {
  // Ruta adaptativa: desde index.html es sources/head/, desde sources/*.html es head/
  const headBase = window.location.pathname.includes("/sources/") ? "head/" : "sources/head/";
  const IMAGES = [
    headBase + "banner 01.jpeg",
    headBase + "banner 02.jpeg",
    headBase + "banner 03.jpeg",
    headBase + "banner 04.jpeg",
    headBase + "banner 05.jpeg",
    headBase + "banner 06.jpeg",
    headBase + "banner 07.jpeg",
    headBase + "banner 08.jpeg",
    headBase + "banner 09.jpeg",
    headBase + "banner 10.jpeg",
  ];

  const INTERVAL_MS = 30000;
  const FADE_MS = 1400;

  let banner = null;
  let layers = [];
  let active = 0;
  let currentIdx = -1;
  let timer = null;
  let ticking = false;
  const metas = Object.create(null); // src -> { w, h }

  function getBanner() {
    if (!banner) banner = document.getElementById("banner");
    return banner;
  }

  function ensureLayers() {
    const b = getBanner();
    if (!b) return null;

    // marcar el contenedor de contenido para z-index correcto
    // el div de contenido es el último hijo div directo que no es .banner-bg
    const allDivs = Array.from(b.children).filter(function (el) {
      return el.tagName === "DIV" && !el.classList.contains("banner-bg");
    });
    if (allDivs.length) {
      const content = allDivs[allDivs.length - 1];
      if (!content.classList.contains("banner-content")) {
        content.classList.add("banner-content");
      }
    }

    layers = Array.from(b.querySelectorAll(".banner-bg"));
    if (layers.length < 2) {
      for (let i = layers.length; i < 2; i++) {
        const el = document.createElement("div");
        el.className = "banner-bg" + (i === 0 ? " is-visible" : "");
        el.setAttribute("aria-hidden", "true");
        // Insertar al inicio, antes del contenido, para que quede detrás del overlay
        b.insertBefore(el, b.firstChild);
      }
      layers = Array.from(b.querySelectorAll(".banner-bg"));
    }
    return b;
  }

  function getRandomIdx(exclude) {
    if (IMAGES.length <= 1) return 0;
    let idx;
    let guard = 0;
    do {
      idx = Math.floor(Math.random() * IMAGES.length);
      guard++;
    } while (idx === exclude && guard < 10);
    return idx;
  }

  function preload(src) {
    if (metas[src] && metas[src].w) return Promise.resolve(metas[src]);
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        metas[src] = { w: img.naturalWidth, h: img.naturalHeight };
        resolve(metas[src]);
      };
      img.onerror = function () {
        // aun sin dimensiones, resolver con fallback para no bloquear rotación
        if (!metas[src]) metas[src] = { w: 0, h: 0 };
        resolve(metas[src]);
      };
      img.src = encodeURI(src);
    });
  }

  function setLayerImage(layer, src) {
    if (!layer) return;
    layer.dataset.src = src;
    layer.style.backgroundImage = 'url("' + encodeURI(src) + '")';
    layer.style.backgroundSize = "cover";
    layer.style.backgroundRepeat = "no-repeat";
    // backgroundPosition se gestiona en updateParallax(); por defecto centro
    if (!layer.style.backgroundPosition) layer.style.backgroundPosition = "center center";
  }

  function updateParallax() {
    const b = getBanner();
    if (!b || !layers.length) {
      ticking = false;
      return;
    }
    const bh = b.clientHeight;
    const bw = b.clientWidth;
    if (!bh || !bw) {
      ticking = false;
      return;
    }

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const rect = b.getBoundingClientRect();
    let progress;

    // Banner completamente fuera por arriba / por debajo
    if (rect.bottom <= 0) {
      progress = 1;
    } else if (rect.top >= window.innerHeight) {
      progress = 0;
    } else {
      // Progreso 0 -> imagen en left/top (0%), 1 -> imagen en right/bottom (100%)
      // Se mapea al desplazamiento del scroll mientras el banner estuvo visible.
      // scrollY=0 => 0, scrollY≈bh => 1. Mismo progreso para eje X e Y.
      // Clamp para no exceder.
      if (bh > 0) progress = Math.min(1, Math.max(0, scrollY / bh));
      else progress = 0.5;
      // Si el banner no está al inicio del documento (body margin-top 15rem), el scroll inicial aún es 0 y el efecto arranca en 0 (top).
      // Para que el estado inicial sea centrado cuando no hay scroll, se corrige: si progress es 0 y rect.top > 0, mantenemos 0% (top). Visualmente el usuario ve el top al iniciar y revela el resto al bajar.
      // Alternativa centrada inicial: progress = 0.5 + (scrollY / bh - 0.5)*... No se usa para mantener el requisito literal "desplazar con el scroll".
    }

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const src = layer.dataset.src;
      if (!src) continue;
      const meta = metas[src];
      if (!meta || !meta.w || !meta.h) {
        layer.style.backgroundPosition = "center center";
        continue;
      }
      const scale = Math.max(bw / meta.w, bh / meta.h);
      const renderedW = meta.w * scale;
      const renderedH = meta.h * scale;
      const overflowW = renderedW - bw;
      const overflowH = renderedH - bh;
      const hasOverflowW = overflowW > 2;
      const hasOverflowH = overflowH > 2;

      if (!hasOverflowW && !hasOverflowH) {
        layer.style.backgroundPosition = "center center";
        continue;
      }

      // Mismo progreso para ambos ejes: 0% (left/top) con scroll 0 → 100% (right/bottom) al hacer scroll ≈ alto del banner
      const pct = (progress * 100).toFixed(2) + "%";
      const xPos = hasOverflowW ? pct : "center";
      const yPos = hasOverflowH ? pct : "center";
      layer.style.backgroundPosition = xPos + " " + yPos;
    }
    ticking = false;
  }

  function requestParallax() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateParallax);
  }

  function crossfadeTo(nextIdx) {
    const b = getBanner();
    if (!b || !layers.length) return;
    if (nextIdx === currentIdx) return;
    const src = IMAGES[nextIdx];
    const inactive = layers[1 - active];

    // Precargar y luego hacer fade
    preload(src).then(function () {
      setLayerImage(inactive, src);
      // Forzar reflow para que la transición se aplique correctamente al cambiar opacidad
      void inactive.offsetWidth;
      // Aplicar parallax inicial para la nueva capa antes de mostrarla
      requestParallax();

      inactive.classList.add("is-visible");
      layers[active].classList.remove("is-visible");

      // Tras el fade, actualizar índices y asegurar parallax
      window.setTimeout(function () {
        active = 1 - active;
        currentIdx = nextIdx;
        requestParallax();
      }, FADE_MS + 50);
    });
  }

  function schedule() {
    clearInterval(timer);
    if (IMAGES.length <= 1) return;
    timer = window.setInterval(function () {
      if (document.hidden) return;
      const next = getRandomIdx(currentIdx);
      crossfadeTo(next);
    }, INTERVAL_MS);
  }

  function init() {
    const b = ensureLayers();
    if (!b) return;
    if (!IMAGES.length) return;

    // Limpiar background inline previo si existía (versión anterior usaba banner.style.backgroundImage)
    b.style.backgroundImage = "";
    b.style.backgroundSize = "";
    b.style.backgroundPosition = "";
    b.style.backgroundRepeat = "";

    // Elegir imagen inicial
    currentIdx = getRandomIdx(-1);
    const firstSrc = IMAGES[currentIdx];

    // Inicializar ambas capas: activa con imagen, inactiva vacía
    // Asegurar que solo la activa tenga is-visible
    layers.forEach(function (l, i) {
      if (i === active) l.classList.add("is-visible");
      else l.classList.remove("is-visible");
    });

    preload(firstSrc).then(function () {
      setLayerImage(layers[active], firstSrc);
      // iniciar parallax
      requestParallax();
      // precargar resto en segundo plano para transiciones instantáneas
      IMAGES.forEach(function (s) {
        if (s !== firstSrc) preload(s);
      });
    });

    // Fallback inmediato por si la imagen tarda (mostrar igual)
    if (!layers[active].dataset.src) {
      setLayerImage(layers[active], firstSrc);
    }

    // Listeners para parallax
    window.addEventListener("scroll", requestParallax, { passive: true });
    window.addEventListener("resize", requestParallax, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) requestParallax();
    });

    // Primera actualización
    requestAnimationFrame(updateParallax);
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
