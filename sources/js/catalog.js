/**
 * catalog.js — Muestra todos los productos de una categoría (query ?category=)
 * Carga dinámicamente desde data/products.csv, usa products/{sku}.png
 * Añade botón de favorito en cada producto (arriba derecha)
 */
(function () {
  function getCategoryFromURL() {
    const params = new URLSearchParams(window.location.search);
    // aceptar tanto ?category= como ?categoria= / ?cat=
    return params.get("category") || params.get("categoria") || params.get("cat") || "";
  }

  function hasValue(v) {
    return v != null && String(v).trim() !== "";
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

    // etiqueta STATUS — superior izquierda sobre la foto, solo si existe
    if (hasValue(product.status)) {
      const statusBadge = document.createElement("span");
      statusBadge.className = "product-status";
      statusBadge.textContent = String(product.status).trim();
      figure.appendChild(statusBadge);
    }

    // botón favorito
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
    // Solo mostrar color si existe en el CSV
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
    // Solo mostrar size y weight si existen en el CSV
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
    // PACKAGE: Paq. X unidades solo si >2
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
    // Fila meta: código/etiquetas/precio a la izquierda, botón +carrito a la derecha
    const metaRow = document.createElement("div");
    metaRow.className = "product-meta-row";
    const metaLeft = document.createElement("div");
    metaLeft.className = "product-meta-left";
    metaLeft.appendChild(h4);
    // Precio: NEW PRICE, OLD PRICE tachado gris y % descuento #f02004 con $RD
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
    // Icono oficial sources/icons/add.svg (blanco/negro via currentColor)
    if (window.Cesfa && window.Cesfa.ICON_CART_ADD_SVG) {
      cartBtn.innerHTML = window.Cesfa.ICON_CART_ADD_SVG;
    } else {
      const pfx = window.location.pathname.includes("/sources/") ? "icons/add.svg" : "sources/icons/add.svg";
      cartBtn.innerHTML = '<img src="' + pfx + '" alt="" width="16" height="16" aria-hidden="true">';
    }
    // Estado inicial rojo si ya está en carrito
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

  async function init() {
    const categoryParam = getCategoryFromURL();
    const bannerTitle = document.querySelector("#banner h1");
    const bannerDesc = document.querySelector("#banner p");
    const countEl = document.getElementById("count");
    const listEl = document.querySelector("main > ul");
    const endEl = document.getElementById("end");

    // Si no hay elementos esperados, abortar silenciosamente
    if (!listEl || !countEl) return;

    // Mensaje de carga
    listEl.innerHTML = "";
    countEl.textContent = "Cargando productos…";
    if (endEl) endEl.style.display = "none";

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

    let filtered = products;
    let displayCategory = categoryParam;

    if (categoryParam) {
      const decoded = decodeURIComponent(categoryParam);
      displayCategory = decoded;
      filtered = products.filter((p) => p.category === decoded);
      // Si no coincide exacto, probar case-insensitive / trim
      if (filtered.length === 0) {
        const lower = decoded.toLowerCase().trim();
        filtered = products.filter((p) => p.category.toLowerCase().trim() === lower);
        if (filtered.length) displayCategory = filtered[0].category;
      }
    } else {
      // sin filtro: mostrar primera categoría o todos — aquí mostramos todos pero banner genérico
      // Para mantener UX del catálogo, si no hay parámetro, mostrar todos los productos
      displayCategory = "";
    }

    // Actualizar banner — el título muestra la categoría, la descripción es estática (igual que index.html)
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

    // Actualizar contador
    countEl.textContent = `${filtered.length} producto${filtered.length !== 1 ? "s" : ""}`;

    // Renderizar lista
    listEl.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "cesfa-status";
      empty.style.cssText = "grid-column:1/-1;";
      if (displayCategory) {
        const toIndex = window.location.pathname.includes("/sources/") ? "../index.html" : "index.html";
        empty.innerHTML = `No hay productos en la categoría <strong>${displayCategory}</strong>. <a href="${toIndex}" style="color:#f02004;text-decoration:underline;">Volver al catálogo</a>`;
      } else {
        empty.textContent = "No hay productos disponibles.";
      }
      listEl.appendChild(empty);
      if (endEl) endEl.style.display = "none";
      return;
    }

    for (const p of filtered) {
      listEl.appendChild(createProductCard(p));
    }

    if (endEl) {
      endEl.style.display = "";
      endEl.textContent = "No hay más productos en esta colección.";
    }

    // Escuchar cambios de favoritos para mantener estado visual sincronizado (por si se usa desde otra pestaña)
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
