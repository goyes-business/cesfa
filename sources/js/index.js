/**
 * index.js — Carga todas las categorías del CSV y muestra 7 imágenes random por categoría
 * con botón para abrir la categoría hacia catalog.html?category=...
 */
(function () {
  function qsEncode(s) {
    return encodeURIComponent(s);
  }

  function hasValue(v) {
    return v != null && String(v).trim() !== "";
  }

  function createProductPreview(product) {
    const li = document.createElement("li");
    li.className = "product";
    // estructura similar a original index: figure.image con img, más botón fav y link silencioso
    const figure = document.createElement("figure");
    figure.className = "image";

    const img = document.createElement("img");
    img.src = window.Cesfa.getImageSrc(product.sku);
    img.alt = product.name + (hasValue(product.color) ? " " + product.color : "");
    img.loading = "lazy";
    img.onerror = function () {
      window.Cesfa.handleImageError(img, product.sku);
    };

    figure.appendChild(img);

    // etiqueta STATUS — superior izquierda sobre la foto, solo si existe
    if (hasValue(product.status)) {
      const statusBadge = document.createElement("span");
      statusBadge.className = "product-status";
      statusBadge.textContent = String(product.status).trim();
      figure.appendChild(statusBadge);
    }

    // botón favorito arriba derecha dentro de figure (figure es relative)
    const favBtn = window.Cesfa.createFavButton(product.sku);
    figure.appendChild(favBtn);

    li.appendChild(figure);

    // contenido opcional mínimo (nombre) debajo de la imagen para contexto — opcional, lo dejamos solo imagen para mantener diseño original
    // pero añadimos title para tooltip
    li.title = `${product.name}${hasValue(product.color) ? " - " + product.color : ""} (${product.sku})`;

    return li;
  }

  function createVerMasTile(category) {
    const li = document.createElement("li");
    li.className = "product ver-mas";
    const a = document.createElement("a");
    a.href = `sources/catalog.html?category=${qsEncode(category)}`;
    a.setAttribute("aria-label", `Ver más de ${category}`);
    const figure = document.createElement("figure");
    figure.className = "image ver-mas-box";
    const text = document.createElement("span");
    text.className = "ver-mas-text";
    const arrowSvg = window.Cesfa && window.Cesfa.ICON_ARROW_SVG
      ? window.Cesfa.ICON_ARROW_SVG
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    text.innerHTML = `VER MÁS ${arrowSvg}`;
    figure.appendChild(text);
    a.appendChild(figure);
    li.appendChild(a);
    return li;
  }

  async function init() {
    const main = document.querySelector("main");
    if (!main) return;

    // Limpiar contenido estático existente
    main.innerHTML = '<p style="padding:2rem;text-align:center;color:#808080;">Cargando categorías…</p>';

    let products;
    try {
      products = await window.Cesfa.fetchProducts();
    } catch (e) {
      console.error("[Cesfa] Error cargando productos:", e);
      main.innerHTML =
        '<p style="padding:2rem;text-align:center;color:#f02004;">No se pudieron cargar los productos.<br><span style="color:#808080;font-size:.9em;">Verifica que el Google Sheet esté compartido como "Cualquier persona con el enlace — Lector".</span><br><span style="color:#808080;font-size:.85em;">' + (e && e.message ? e.message : "") + '</span></p>';
      return;
    }

    // Agrupar por categoría preservando orden de aparición
    const catOrder = [];
    const groups = new Map();
    for (const p of products) {
      if (!groups.has(p.category)) {
        groups.set(p.category, []);
        catOrder.push(p.category);
      }
      groups.get(p.category).push(p);
    }

    main.innerHTML = "";

    for (const category of catOrder) {
      const items = groups.get(category) || [];
      const shuffled = window.Cesfa.shuffle(items);
      const preview = shuffled.slice(0, 7);

      const section = document.createElement("section");
      section.className = "category-section";
      section.dataset.category = category;

      const headerRow = document.createElement("div");
      headerRow.className = "category-header";
      // h2
      const h2 = document.createElement("h2");
      h2.className = "category";
      h2.textContent = category;
      headerRow.appendChild(h2);

      const btn = document.createElement("a");
      btn.className = "btn-category";
      btn.href = `sources/catalog.html?category=${qsEncode(category)}`;
      btn.textContent = "VER CATEGORÍA";
      // accesible
      btn.setAttribute("aria-label", `Ver todos los productos de ${category}`);
      headerRow.appendChild(btn);

      section.appendChild(headerRow);

      const ul = document.createElement("ul");
      ul.className = "category-preview";
      for (const prod of preview) {
        ul.appendChild(createProductPreview(prod));
      }
      // Último cuadro "Ver más" que lleva a la categoría
      ul.appendChild(createVerMasTile(category));
      section.appendChild(ul);

      // si categoría tiene pocos productos, indicar cantidad
      if (items.length > 7) {
        // opcional: añadir contador pequeño al lado del título ya está el botón, no hace falta
      }

      main.appendChild(section);
    }

    // Si no hay categorías (CSV vacío)
    if (catOrder.length === 0) {
      main.innerHTML = '<p style="padding:2rem;text-align:center;color:#808080;">No hay categorías disponibles.</p>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
