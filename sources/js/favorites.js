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

    content.appendChild(h3);
    content.appendChild(h4);
    if (window.Cesfa && typeof window.Cesfa.createPriceElement === "function") {
      const priceEl = window.Cesfa.createPriceElement(product);
      if (priceEl) content.appendChild(priceEl);
    }
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
        '<li style="grid-column:1/-1;padding:2rem;text-align:center;color:#f02004;">No se pudieron cargar los productos.<br><span style="color:#808080;font-size:.9em;">Verifica que el Google Sheet esté compartido como "Cualquier persona con el enlace — Lector".</span><br><span style="color:#808080;font-size:.85em;">' + (e && e.message ? e.message : "") + '</span></li>';
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
        empty.innerHTML = `
          <p style="font-size:1.1rem;color:#808080;margin-bottom:1.5rem;">No tienes favoritos aún.</p>
          <a href="${toIndex}" class="btn">EXPLORAR CATEGORÍAS 🡢</a>
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
