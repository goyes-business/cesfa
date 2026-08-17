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

    content.appendChild(h3);
    content.appendChild(h4);
    // Precio: NEW PRICE, OLD PRICE tachado gris y % descuento #f02004 con $RD
    if (window.Cesfa && typeof window.Cesfa.createPriceElement === "function") {
      const priceEl = window.Cesfa.createPriceElement(product);
      if (priceEl) content.appendChild(priceEl);
    }
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
        '<li style="grid-column:1/-1;padding:2rem;text-align:center;color:#f02004;">No se pudieron cargar los productos.<br><span style="color:#808080;font-size:.9em;">Verifica que el Google Sheet esté compartido como "Cualquier persona con el enlace — Lector".</span><br><span style="color:#808080;font-size:.85em;">' + (e && e.message ? e.message : "") + '</span></li>';
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
      empty.style.cssText = "grid-column:1/-1;padding:3rem 1rem;text-align:center;color:#808080;";
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
