/**
 * favorites.js — Página de favoritos con mismo diseño/concepto que catalog.html
 * Muestra solo productos marcados como favoritos (localStorage)
 * Reutiliza grid y tarjeta de catalog.css
 */
(function () {
  function hasValue(v) {
    return v != null && String(v).trim() !== "";
  }

  function createProductCard(product, onRemove) {
    const li = document.createElement("li");
    li.className = "product";
    li.dataset.sku = String(product.sku);

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

    const favBtn = window.Cesfa.createFavButton(product.sku, {
      onToggle: function (added) {
        if (!added && typeof onRemove === "function") {
          // animación de salida y luego re-render parcial
          li.style.transition = "opacity .25s, transform .25s";
          li.style.opacity = "0";
          li.style.transform = "scale(.96)";
          setTimeout(function () {
            onRemove(product.sku);
          }, 260);
        }
      },
    });
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
    let pkgTextFav = null;
    if (window.Cesfa && typeof window.Cesfa.formatPackageLong === "function") {
      pkgTextFav = window.Cesfa.formatPackageLong(product);
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
      if (n != null && !isNaN(n) && n > 2) pkgTextFav = `Paq. ${n} unidades`;
    }
    if (pkgTextFav) {
      const pkgSpan = document.createElement("span");
      pkgSpan.className = "tag package";
      pkgSpan.textContent = pkgTextFav;
      h4.appendChild(pkgSpan);
    }

    content.appendChild(h3);
    // Fila meta: código/etiquetas/precio a la izquierda, botón +carrito a la derecha
    const metaRow = document.createElement("div");
    metaRow.className = "product-meta-row";
    const metaLeft = document.createElement("div");
    metaLeft.className = "product-meta-left";
    metaLeft.appendChild(h4);
    let favPriceEl = null;
    if (window.Cesfa && typeof window.Cesfa.createPriceElement === "function") {
      favPriceEl = window.Cesfa.createPriceElement(product);
      if (favPriceEl) metaLeft.appendChild(favPriceEl);
    }
    metaRow.appendChild(metaLeft);

    const favCartBtn = document.createElement("button");
    favCartBtn.type = "button";
    favCartBtn.className = "add-cart-btn";
    favCartBtn.dataset.sku = String(product.sku);
    favCartBtn.setAttribute("aria-label", "Agregar al carrito: " + (product.name || product.sku));
    // Icono oficial sources/icons/add.svg
    if (window.Cesfa && window.Cesfa.ICON_CART_ADD_SVG) {
      favCartBtn.innerHTML = window.Cesfa.ICON_CART_ADD_SVG;
    } else {
      const pfx2 = window.location.pathname.includes("/sources/") ? "icons/add.svg" : "sources/icons/add.svg";
      favCartBtn.innerHTML = '<img src="' + pfx2 + '" alt="" width="16" height="16" aria-hidden="true">';
    }
    if (window.Cesfa && typeof window.Cesfa.isInCart === "function" && window.Cesfa.isInCart(product.sku)) {
      favCartBtn.classList.add("is-added");
      favCartBtn.setAttribute("aria-pressed", "true");
    }
    favCartBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.Cesfa && typeof window.Cesfa.addToCart === "function") {
        window.Cesfa.addToCart(product.sku, 1);
      }
    });
    metaRow.appendChild(favCartBtn);

    content.appendChild(metaRow);
    article.appendChild(content);
    li.appendChild(article);
    return li;
  }

  async function init() {
    const bannerTitle = document.querySelector("#banner h1");
    const countEl = document.getElementById("count");
    const listEl = document.querySelector("main > ul");
    const endEl = document.getElementById("end");
    const main = document.querySelector("main");

    if (!listEl || !countEl || !main) return;

    countEl.textContent = "Cargando favoritos…";
    if (endEl) endEl.style.display = "none";
    listEl.innerHTML = "";

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

    function render() {
      const favSkus = window.Cesfa.getFavorites();
      const favSet = new Set(favSkus.map(String));
      const filtered = products.filter((p) => favSet.has(String(p.sku)));

      if (bannerTitle) bannerTitle.textContent = "Favoritos";
      let s = filtered.length !== 1 ? "s" : "";

      countEl.textContent =
        filtered.length === 0
          ? "0 productos favoritos"
          : `${filtered.length} producto${s} favorito${s}`;

      listEl.innerHTML = "";

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.id = "favorites-empty";
        const toIndex = window.location.pathname.includes("/sources/") ? "../index.html" : "index.html";
        const arrowSvg = window.Cesfa && window.Cesfa.ICON_ARROW_SVG
          ? window.Cesfa.ICON_ARROW_SVG
          : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
        empty.innerHTML = `
          <p class="cesfa-status" style="margin-bottom:1.5rem; margin-top:0;">No tienes favoritos aún.</p>
          <a href="${toIndex}" class="btn">EXPLORAR CATEGORÍAS ${arrowSvg}</a>
        `;
        // insertar fuera del ul para que no rompa grid, pero dentro de main
        // creamos un li que ocupe todo el ancho
        const li = document.createElement("li");
        li.style.cssText = "grid-column:1/-1;list-style:none;";
        li.appendChild(empty);
        // estilo centrado
        empty.style.cssText = "text-align:center;padding:3rem 1rem;";
        listEl.appendChild(li);
        if (endEl) endEl.style.display = "none";
        return;
      }

      for (const p of filtered) {
        listEl.appendChild(
          createProductCard(p, function () {
            render();
          })
        );
      }
      if (endEl) {
        endEl.style.display = "";
        endEl.textContent = "No hay más productos en favoritos.";
      }
    }

    render();

    // re-render cuando cambian favoritos desde otra tarjeta o pestaña
    window.addEventListener("cesfa:favorites-changed", render);
    window.addEventListener("storage", function (e) {
      if (e.key === window.Cesfa.STORAGE_KEY) render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
