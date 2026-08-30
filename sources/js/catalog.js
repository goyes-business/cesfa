/**
 * catalog.js — Muestra todos los productos de una categoría (query ?category=)
 * Carga dinámicamente desde data/products.csv, usa products/{sku}.png
 * Añade botón de favorito en cada producto (arriba derecha)
 * + Buscador debajo del banner: filtra por SKU + CATEGORY + NAME + COLOR + SIZE + WEIGHT
 *   sin distinguir acentos/mayúsculas y con AND entre palabras ("len gamer" => len && gamer)
 */
(function () {
  function getCategoryFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("category") || params.get("categoria") || params.get("cat") || "";
  }

  function getSearchFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("q") || params.get("search") || params.get("buscar") || "";
    } catch (_e) { return ""; }
  }

  function hasValue(v) {
    return v != null && String(v).trim() !== "";
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function createProductCard(product) {
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

  // ---- Estado compartido entre categoría y buscador ----
  let allProducts = [];
  let baseFiltered = []; // filtrado solo por categoría (antes de búsqueda)
  let displayCategory = "";
  let mainEl = null;
  let listEl = null;
  let countEl = null;
  let endEl = null;
  let searchInput = null;
  let searchClear = null;
  let searchCount = null;

  function filterBySearch(products, query) {
    if (!query || !String(query).trim()) return products;
    if (window.Cesfa && typeof window.Cesfa.searchFilter === "function") {
      return window.Cesfa.searchFilter(products, query).filtered;
    }
    // Fallback manual
    const norm = function (s) { return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); };
    const terms = norm(query).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return products.slice();
    return products.filter(function (p) {
      const hay = norm([p.sku,p.category,p.name,p.color,p.size,p.weight].join(" "));
      return terms.every(function(t){ return hay.indexOf(t)!==-1; });
    });
  }

  function renderList(productsToShow, opts) {
    opts = opts || {};
    const query = opts.query || "";
    const hasSearch = String(query).trim().length > 0;

    if (!listEl || !countEl) return;

    listEl.innerHTML = "";

    if (productsToShow.length === 0) {
      if (hasSearch) {
        // Sin coincidencias: no mostrar nada debajo de cesfa-search-count
        if (mainEl) { mainEl.hidden = true; mainEl.style.display = "none"; }
        if (countEl) { countEl.textContent = ""; countEl.hidden = true; countEl.style.display = "none"; }
        if (listEl) { listEl.innerHTML = ""; listEl.hidden = true; listEl.style.display = "none"; }
        if (endEl) { endEl.textContent = ""; endEl.hidden = true; endEl.style.display = "none"; }
        if (searchCount) {
          searchCount.hidden = false;
          const catLabel = displayCategory ? ` en <strong>${escapeHtml(displayCategory)}</strong>` : "";
          searchCount.innerHTML = `Sin resultados para <strong>“${escapeHtml(query.trim())}”</strong>${catLabel}`;
        }
        const searchSection = document.querySelector(".cesfa-search");
        if (searchSection) searchSection.classList.add("is-empty");
        return;
      } else {
        // Mensaje original de categoría vacía
        if (searchCount) { searchCount.hidden = true; searchCount.textContent = ""; }
        const searchSection = document.querySelector(".cesfa-search");
        if (searchSection) searchSection.classList.remove("is-empty");
        countEl.textContent = displayCategory ? `0 productos` : `0 productos`;
        const empty = document.createElement("li");
        empty.className = "cesfa-status";
        empty.style.cssText = "grid-column:1/-1;";
        if (displayCategory) {
          const toIndex = window.location.pathname.includes("/sources/") ? "../index.html" : "index.html";
          empty.innerHTML = `No hay productos en la categoría <strong>${escapeHtml(displayCategory)}</strong>. <a href="${toIndex}" style="color:#f02004;text-decoration:underline;">Volver al catálogo</a>`;
        } else {
          empty.textContent = "No hay productos disponibles.";
        }
        listEl.appendChild(empty);
      }
      if (endEl) endEl.style.display = "none";
      return;
    }

    // Hay resultados - restaurar visibilidad por si venía de estado sin resultados
    if (mainEl) { mainEl.hidden = false; mainEl.style.display = ""; }
    if (countEl) { countEl.hidden = false; countEl.style.display = ""; }
    if (listEl) { listEl.hidden = false; listEl.style.display = ""; }
    if (endEl) { endEl.hidden = false; }
    const searchSection = document.querySelector(".cesfa-search");
    if (searchSection) searchSection.classList.remove("is-empty");

    if (hasSearch) {
      countEl.textContent = `${productsToShow.length} producto${productsToShow.length !== 1 ? "s" : ""} para “${query.trim()}”${displayCategory ? " en " + displayCategory : ""}`;
      if (searchCount) {
        searchCount.hidden = false;
        const catLabel = displayCategory ? ` en <strong>${escapeHtml(displayCategory)}</strong>` : "";
        searchCount.innerHTML = `${productsToShow.length} producto${productsToShow.length !== 1 ? "s" : ""} encontrado${productsToShow.length !== 1 ? "s" : ""} para <strong>“${escapeHtml(query.trim())}”</strong>${catLabel}`;
      }
    } else {
      countEl.textContent = `${productsToShow.length} producto${productsToShow.length !== 1 ? "s" : ""}`;
      if (searchCount) { searchCount.hidden = true; searchCount.textContent = ""; }
    }

    for (const p of productsToShow) {
      listEl.appendChild(createProductCard(p));
    }

    if (endEl) {
      endEl.style.display = "";
      endEl.textContent = hasSearch
        ? `Fin de los resultados para “${query.trim()}”.`
        : "No hay más productos en esta colección.";
    }
  }

  function applySearch() {
    const q = searchInput ? searchInput.value : "";
    const hasQ = String(q).trim().length > 0;
    if (searchClear) searchClear.hidden = !hasQ;
    // Actualizar URL con q (preservando category)
    try {
      const url = new URL(window.location.href);
      if (hasQ) url.searchParams.set("q", q);
      else url.searchParams.delete("q");
      history.replaceState(null, "", url.pathname + (url.search ? "?" + url.searchParams.toString() : "") + url.hash);
    } catch (_e) {}

    const filtered = filterBySearch(baseFiltered, q);
    renderList(filtered, { query: q });
  }

  function initSearch() {
    searchInput = document.getElementById("cesfa-search");
    searchClear = document.getElementById("cesfa-search-clear");
    searchCount = document.getElementById("cesfa-search-count");

    if (!searchInput && window.Cesfa && typeof window.Cesfa.ensureSearchDOM === "function") {
      const dom = window.Cesfa.ensureSearchDOM({ placeholder: "Buscar por nombre, categoría, código, color..." });
      if (dom) {
        searchInput = dom.input;
        searchClear = dom.clearBtn;
        searchCount = dom.countEl;
      }
    }
    if (!searchInput) return;

    const initial = getSearchFromURL();
    if (initial) searchInput.value = initial;

    searchInput.addEventListener("input", applySearch);
    searchInput.addEventListener("search", applySearch);

    if (searchClear) {
      searchClear.addEventListener("click", function () {
        searchInput.value = "";
        searchInput.focus();
        applySearch();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement && document.activeElement.isContentEditable)) return;
        e.preventDefault();
        searchInput.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInput && searchInput.value) {
        searchInput.value = "";
        applySearch();
      }
    });
  }

  async function init() {
    const categoryParam = getCategoryFromURL();
    const bannerTitle = document.querySelector("#banner h1");
    const bannerDesc = document.querySelector("#banner p");
    mainEl = document.querySelector("main");
    countEl = document.getElementById("count");
    listEl = document.querySelector("main > ul");
    endEl = document.getElementById("end");

    if (!listEl || !countEl) return;

    initSearch();

    listEl.innerHTML = "";
    countEl.textContent = "Cargando productos…";
    if (endEl) endEl.style.display = "none";
    if (searchCount) { searchCount.hidden = true; searchCount.textContent = ""; }

    let products;
    try {
      products = await window.Cesfa.fetchProducts();
    } catch (e) {
      console.error("[Cesfa] Error cargando productos:", e);
      countEl.textContent = "Error al cargar productos";
      listEl.innerHTML =
        '<li class="cesfa-status cesfa-status--error" style="grid-column:1/-1;">No se pudieron cargar los productos.<br><span style="font-size:.9em;">Verifica que tengas conexión a internet.</span><br><span style="font-size:.85em;">' + (e && e.message ? e.message : "") + '</span></li>';
      return;
    }

    allProducts = products;

    // Pre-cache haystack para búsqueda
    if (window.Cesfa && typeof window.Cesfa.searchHaystack === "function") {
      for (let i = 0; i < allProducts.length; i++) window.Cesfa.searchHaystack(allProducts[i]);
    }

    let filtered = products;
    displayCategory = categoryParam;

    if (categoryParam) {
      const decoded = decodeURIComponent(categoryParam);
      displayCategory = decoded;
      filtered = products.filter((p) => p.category === decoded);
      if (filtered.length === 0) {
        const lower = decoded.toLowerCase().trim();
        filtered = products.filter((p) => p.category.toLowerCase().trim() === lower);
        if (filtered.length) displayCategory = filtered[0].category;
      }
    } else {
      displayCategory = "";
    }

    baseFiltered = filtered;

    const STATIC_BANNER_DESC =
      "Somos una empresa dominicana especializada en la fabricación, comercialización y distribución de productos para repostería y panadería. Nos destacamos por nuestras delicadas flores de azúcar y artículos de decoración para pasteles, ofreciendo una amplia variedad de diseños, colores y tamaños para ayudar a reposteros, panaderos, decoradores y emprendedores a dar un toque especial y profesional a sus creaciones.";
    if (bannerTitle) {
      if (displayCategory) {
        bannerTitle.textContent = displayCategory;
      } else {
        bannerTitle.textContent = "Catálogo completo";
      }
    }
    if (bannerDesc) {
      bannerDesc.textContent = STATIC_BANNER_DESC;
    }

    // Si hay búsqueda inicial en la URL o en el input, aplicarla; si no, render directo
    const initialQ = (searchInput && searchInput.value) ? searchInput.value : getSearchFromURL();
    if (initialQ && String(initialQ).trim()) {
      if (searchInput) searchInput.value = initialQ;
      const finalFiltered = filterBySearch(baseFiltered, initialQ);
      // Mostrar clear
      if (searchClear) searchClear.hidden = false;
      renderList(finalFiltered, { query: initialQ });
    } else {
      renderList(baseFiltered, { query: "" });
    }

    window.addEventListener("storage", function (e) {
      if (e.key === window.Cesfa.STORAGE_KEY) {
        const favs = window.Cesfa.getFavorites();
        document.querySelectorAll(".fav-btn").forEach((btn) => {
          const sku = btn.dataset.sku;
          const isFav = favs.includes(String(sku));
          btn.classList.toggle("is-fav", isFav);
          btn.setAttribute("aria-pressed", isFav ? "true" : "false");
          btn.innerHTML = isFav ? window.Cesfa.ICON_FILLED_SVG : window.Cesfa.ICON_OUTLINE_SVG;
          if (!isFav && document.activeElement === btn) btn.blur();
        });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

