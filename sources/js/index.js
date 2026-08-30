/**
 * index.js — Carga todas las categorías del CSV y muestra 7 imágenes random por categoría
 * con botón para abrir la categoría hacia catalog.html?category=...
 * + Buscador debajo del banner: filtra productos por SKU + CATEGORY + NAME + COLOR + SIZE + WEIGHT
 *   sin distinguir acentos/mayúsculas y con AND entre palabras ("len gamer" => len && gamer)
 */
(function () {
  function qsEncode(s) {
    return encodeURIComponent(s);
  }

  function hasValue(v) {
    return v != null && String(v).trim() !== "";
  }

  // ---- Estado del buscador / datos ----
  let allProducts = [];
  let catOrder = [];
  let groups = new Map();
  let mainEl = null;
  let searchInput = null;
  let searchClear = null;
  let searchCount = null;
  let searchResultsWrap = null;
  let searchGrid = null;
  let searchEmpty = null;

  function createProductPreview(product) {
    const li = document.createElement("li");
    li.className = "product";
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

    if (hasValue(product.status)) {
      const statusBadge = document.createElement("span");
      statusBadge.className = "product-status";
      statusBadge.textContent = String(product.status).trim();
      figure.appendChild(statusBadge);
    }

    const favBtn = window.Cesfa.createFavButton(product.sku);
    figure.appendChild(favBtn);

    li.appendChild(figure);
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

  // Tarjeta completa para resultados de búsqueda (reusa estilo catálogo: imagen + nombre + SKU/tags + precio + carrito)
  function createSearchCard(product) {
    const li = document.createElement("li");
    li.className = "product";

    const article = document.createElement("article");

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

    if (hasValue(product.status)) {
      const statusBadge = document.createElement("span");
      statusBadge.className = "product-status";
      statusBadge.textContent = String(product.status).trim();
      figure.appendChild(statusBadge);
    }

    const favBtn = window.Cesfa.createFavButton(product.sku);
    figure.appendChild(favBtn);

    article.appendChild(figure);

    const content = document.createElement("div");
    content.className = "content";

    const h3 = document.createElement("h3");
    h3.className = "title";
    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = product.name;
    h3.appendChild(nameSpan);
    if (hasValue(product.color)) {
      const sep = document.createElement("span");
      sep.textContent = " - ";
      const colorSpan = document.createElement("span");
      colorSpan.className = "color";
      colorSpan.textContent = product.color;
      h3.appendChild(sep);
      h3.appendChild(colorSpan);
    }
    // Categoría sutil bajo el título en resultados de búsqueda
    const catSmall = document.createElement("div");
    catSmall.style.cssText = "font-size:.82rem;color:#9a9a9a;margin-top:.15rem;letter-spacing:.02em;";
    catSmall.textContent = product.category || "";

    const h4 = document.createElement("h4");
    const skuSpan = document.createElement("span");
    skuSpan.className = "sku";
    skuSpan.textContent = product.sku;
    h4.appendChild(skuSpan);
    if (hasValue(product.size)) {
      const sizeSpan = document.createElement("span");
      sizeSpan.className = "tag size";
      sizeSpan.textContent = product.size;
      h4.appendChild(sizeSpan);
    }
    if (hasValue(product.weight)) {
      const weightSpan = document.createElement("span");
      weightSpan.className = "tag weigth";
      weightSpan.textContent = product.weight;
      h4.appendChild(weightSpan);
    }
    let pkgText = null;
    if (window.Cesfa && typeof window.Cesfa.formatPackageLong === "function") {
      pkgText = window.Cesfa.formatPackageLong(product);
    } else {
      let n = null;
      if (product.packageNum != null) n = product.packageNum;
      else if (product.package) {
        let cleaned = String(product.package).replace(/[^\d.,-]/g, "");
        if (cleaned.includes(",") && cleaned.includes(".")) cleaned = cleaned.replace(/,/g, "");
        else if (cleaned.includes(",")) cleaned = cleaned.replace(",", ".");
        const f = parseFloat(cleaned);
        if (!isNaN(f)) n = Math.trunc(f);
      }
      if (n != null && !isNaN(n) && n > 2) pkgText = `Paq. ${n} unidades`;
    }
    if (pkgText) {
      const pkgSpan = document.createElement("span");
      pkgSpan.className = "tag package";
      pkgSpan.textContent = pkgText;
      h4.appendChild(pkgSpan);
    }

    content.appendChild(h3);
    if (product.category) content.appendChild(catSmall);

    const metaRow = document.createElement("div");
    metaRow.className = "product-meta-row";
    const metaLeft = document.createElement("div");
    metaLeft.className = "product-meta-left";
    metaLeft.appendChild(h4);
    let priceEl = null;
    if (window.Cesfa && typeof window.Cesfa.createPriceElement === "function") {
      priceEl = window.Cesfa.createPriceElement(product);
      if (priceEl) metaLeft.appendChild(priceEl);
    }
    metaRow.appendChild(metaLeft);

    const cartBtn = document.createElement("button");
    cartBtn.type = "button";
    cartBtn.className = "add-cart-btn";
    cartBtn.dataset.sku = String(product.sku);
    cartBtn.setAttribute("aria-label", "Agregar al carrito: " + (product.name || product.sku));
    if (window.Cesfa && window.Cesfa.ICON_CART_ADD_SVG) {
      cartBtn.innerHTML = window.Cesfa.ICON_CART_ADD_SVG;
    } else {
      const pfx = window.location.pathname.includes("/sources/") ? "icons/add.svg" : "sources/icons/add.svg";
      cartBtn.innerHTML = '<img src="' + pfx + '" alt="" width="16" height="16" aria-hidden="true">';
    }
    if (window.Cesfa && typeof window.Cesfa.isInCart === "function" && window.Cesfa.isInCart(product.sku)) {
      cartBtn.classList.add("is-added");
      cartBtn.setAttribute("aria-pressed", "true");
    }
    cartBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.Cesfa && typeof window.Cesfa.addToCart === "function") {
        window.Cesfa.addToCart(product.sku, 1);
      }
    });
    metaRow.appendChild(cartBtn);

    content.appendChild(metaRow);
    article.appendChild(content);

    li.appendChild(article);
    return li;
  }

  function renderCategories() {
    if (!mainEl) return;
    mainEl.innerHTML = "";
    for (const category of catOrder) {
      const items = groups.get(category) || [];
      const shuffled = window.Cesfa.shuffle(items);
      const preview = shuffled.slice(0, 7);

      const section = document.createElement("section");
      section.className = "category-section";
      section.dataset.category = category;

      const headerRow = document.createElement("div");
      headerRow.className = "category-header";
      const h2 = document.createElement("h2");
      h2.className = "category";
      h2.textContent = category;
      headerRow.appendChild(h2);

      const btn = document.createElement("a");
      btn.className = "btn-category";
      btn.href = `sources/catalog.html?category=${qsEncode(category)}`;
      btn.textContent = "VER CATEGORÍA";
      btn.setAttribute("aria-label", `Ver todos los productos de ${category}`);
      headerRow.appendChild(btn);

      section.appendChild(headerRow);

      const ul = document.createElement("ul");
      ul.className = "category-preview";
      for (const prod of preview) {
        ul.appendChild(createProductPreview(prod));
      }
      ul.appendChild(createVerMasTile(category));
      section.appendChild(ul);

      mainEl.appendChild(section);
    }

    if (catOrder.length === 0) {
      mainEl.innerHTML = '<p class="cesfa-status">No hay categorías disponibles.</p>';
    }
  }

  // ---- Buscador ----

  function ensureSearchResultsDOM() {
    // Ya existe un contenedor dedicado fuera del main? Lo creamos dentro del main al final.
    // Mejor: crear un wrapper hermano del main para no mezclar con secciones de categorías.
    // Pero por simplicidad, creamos un div dedicado que vive como hijo de main y se muestra/oculta.
    if (searchResultsWrap && document.body.contains(searchResultsWrap)) return;
    searchResultsWrap = document.createElement("div");
    searchResultsWrap.id = "cesfa-search-results";
    searchResultsWrap.hidden = true;

    searchGrid = document.createElement("ul");
    searchGrid.className = "cesfa-search__grid";
    searchGrid.setAttribute("role", "list");

    searchEmpty = document.createElement("p");
    searchEmpty.className = "cesfa-status";
    searchEmpty.style.display = "none";

    searchResultsWrap.appendChild(searchGrid);
    searchResultsWrap.appendChild(searchEmpty);

    if (mainEl && mainEl.parentNode) {
      // Insertar justo después de main para que no interfiera con los sections de categorías dentro de main
      // Sin embargo para que el contador de search quede cerca, lo dejamos después de main.
      mainEl.insertAdjacentElement("afterend", searchResultsWrap);
    }
  }

  function filterWithSearch(query) {
    if (!window.Cesfa || typeof window.Cesfa.searchFilter !== "function") {
      // Fallback simple: normalizar manual si search.js no cargó
      const norm = function (s) { return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); };
      const terms = norm(query).trim().split(/\s+/).filter(Boolean);
      if (!terms.length) return allProducts.slice();
      return allProducts.filter(function (p) {
        const hay = norm([p.sku,p.category,p.name,p.color,p.size,p.weight].join(" "));
        return terms.every(function(t){ return hay.indexOf(t)!==-1; });
      });
    }
    return window.Cesfa.searchFilter(allProducts, query).filtered;
  }

  function updateSearchUI(query) {
    const q = String(query || "").trim();
    const hasQuery = q.length > 0;

    if (searchClear) searchClear.hidden = !hasQuery;

    if (!hasQuery) {
      // Mostrar categorías, ocultar resultados
      if (searchCount) { searchCount.hidden = true; searchCount.textContent = ""; }
      if (searchResultsWrap) { searchResultsWrap.hidden = true; searchResultsWrap.style.display = "none"; }
      if (mainEl) { mainEl.hidden = false; mainEl.style.display = ""; }
      // Quitar padding extra de estado vacío
      const searchSection = document.querySelector(".cesfa-search");
      if (searchSection) searchSection.classList.remove("is-empty");
      // Si estábamos en estado vacío previo, re-renderizar categorías
      if (mainEl && mainEl.children.length === 0 && catOrder.length) renderCategories();
      return;
    }

    const filtered = filterWithSearch(q);
    const n = filtered.length;

    // Mostrar contador superior (debajo del buscador)
    if (searchCount) {
      searchCount.hidden = false;
      if (n === 0) {
        searchCount.innerHTML = `Sin resultados para <strong>“${escapeHtml(q)}”</strong> · prueba con otras palabras`;
      } else if (n === 1) {
        searchCount.innerHTML = `1 producto encontrado para <strong>“${escapeHtml(q)}”</strong>`;
      } else {
        searchCount.innerHTML = `${n} productos encontrados para <strong>“${escapeHtml(q)}”</strong>`;
      }
    }

    // Ocultar categorías
    if (mainEl) { mainEl.hidden = true; mainEl.style.display = "none"; }
    ensureSearchResultsDOM();

    // Si no hay coincidencias no mostrar nada debajo del contador
    if (n === 0) {
      searchResultsWrap.hidden = true;
      searchResultsWrap.style.display = "none";
      searchGrid.innerHTML = "";
      searchGrid.style.display = "none";
      searchEmpty.style.display = "none";
      searchEmpty.innerHTML = "";
      // Solo en este estado mantener 10rem debajo del contador
      const searchSection = document.querySelector(".cesfa-search");
      if (searchSection) searchSection.classList.add("is-empty");
      return;
    }

    // Hay resultados: mostrar grid
    searchResultsWrap.hidden = false;
    searchResultsWrap.style.display = "";
    searchGrid.innerHTML = "";
    searchEmpty.style.display = "none";
    searchEmpty.innerHTML = "";
    searchGrid.style.display = "";
    // Quitar padding extra
    const searchSection2 = document.querySelector(".cesfa-search");
    if (searchSection2) searchSection2.classList.remove("is-empty");
    for (let i = 0; i < filtered.length; i++) {
      searchGrid.appendChild(createSearchCard(filtered[i]));
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function initSearch() {
    searchInput = document.getElementById("cesfa-search");
    searchClear = document.getElementById("cesfa-search-clear");
    searchCount = document.getElementById("cesfa-search-count");

    // Fallback: si el HTML no trajo el buscador (por caché), crearlo
    if (!searchInput && window.Cesfa && typeof window.Cesfa.ensureSearchDOM === "function") {
      const dom = window.Cesfa.ensureSearchDOM({ placeholder: "Buscar por nombre, categoría, código, color..." });
      if (dom) {
        searchInput = dom.input;
        searchClear = dom.clearBtn;
        searchCount = dom.countEl;
      }
    }

    if (!searchInput) return;
    ensureSearchResultsDOM();

    // Leer ?q= inicial si existe (deep link)
    try {
      const params = new URLSearchParams(window.location.search);
      const initial = params.get("q") || params.get("search") || params.get("buscar") || "";
      if (initial) {
        searchInput.value = initial;
      }
    } catch (_e) {}

    // Si hay valor inicial, aplicar filtro una vez cargados los datos (se llamará desde init())
    const onInput = function () {
      const q = searchInput.value;
      // Actualizar URL sin recargar (para compartir)
      try {
        const url = new URL(window.location.href);
        if (q.trim()) url.searchParams.set("q", q);
        else url.searchParams.delete("q");
        history.replaceState(null, "", url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash);
      } catch (_e) {}
      updateSearchUI(q);
    };

    searchInput.addEventListener("input", onInput);
    searchInput.addEventListener("search", onInput); // para X nativo si lo hubiera

    if (searchClear) {
      searchClear.addEventListener("click", function () {
        searchInput.value = "";
        searchInput.focus();
        onInput();
      });
    }

    // Atajo: "/" enfoca el buscador si no se está escribiendo en otro input
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement && document.activeElement.isContentEditable)) return;
        e.preventDefault();
        searchInput.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInput && searchInput.value) {
        searchInput.value = "";
        onInput();
      }
    });

    // Si ya hay valor al inicializar (por ?q= o autocompletado), aplicarlo en cuanto haya datos
    // Se hará también al terminar de cargar productos; aquí por si productos ya están
    if (searchInput.value && searchInput.value.trim() && allProducts.length) {
      updateSearchUI(searchInput.value);
    }
  }

  async function init() {
    mainEl = document.querySelector("main");
    if (!mainEl) return;

    initSearch();

    mainEl.innerHTML = '<p class="cesfa-status">Cargando categorías…</p>';

    let products;
    try {
      products = await window.Cesfa.fetchProducts();
    } catch (e) {
      console.error("[Cesfa] Error cargando productos:", e);
      mainEl.hidden = false;
      if (searchResultsWrap) searchResultsWrap.hidden = true;
      mainEl.innerHTML =
        '<p class="cesfa-status cesfa-status--error">No se pudieron cargar los productos.<br><span style="font-size:.9em;">Verifica que tengas conexión a internet.</span><br><span style="font-size:.85em;">' + (e && e.message ? e.message : "") + '</span></p>';
      return;
    }

    allProducts = products;

    // Agrupar por categoría preservando orden de aparición
    catOrder = [];
    groups = new Map();
    for (const p of products) {
      if (!groups.has(p.category)) {
        groups.set(p.category, []);
        catOrder.push(p.category);
      }
      groups.get(p.category).push(p);
    }

    // Pre-calcular haystack de búsqueda para todos (cache)
    if (window.Cesfa && typeof window.Cesfa.searchHaystack === "function") {
      for (let i = 0; i < allProducts.length; i++) window.Cesfa.searchHaystack(allProducts[i]);
    }

    renderCategories();

    // Si había una búsqueda pendiente (input con valor), aplicarla ahora
    if (searchInput && searchInput.value && searchInput.value.trim()) {
      updateSearchUI(searchInput.value);
    }

    // Escuchar cambios de carrito para sincronizar botones en resultados de búsqueda también
    // (cart.js ya maneja delegación, pero por si se re-renderiza)
    window.addEventListener("cesfa:cart-changed", function () {
      // Actualizar estado de botones is-added en resultados visibles
      if (!searchResultsWrap || searchResultsWrap.hidden) return;
      const favs = null;
      document.querySelectorAll("#cesfa-search-results .add-cart-btn").forEach(function (btn) {
        const sku = btn.dataset.sku;
        if (window.Cesfa && typeof window.Cesfa.isInCart === "function") {
          const inCart = window.Cesfa.isInCart(sku);
          btn.classList.toggle("is-added", inCart);
          btn.setAttribute("aria-pressed", inCart ? "true" : "false");
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

