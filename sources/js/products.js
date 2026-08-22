/**
 * products.js — Utilidades compartidas
 * - Carga dinámica de productos desde Google Sheet (gviz CSV)
 * - Gestión de favoritos en localStorage
 * - Helpers de imagen y parseo CSV
 * - Iconos desde sources/icons/favorite/ (filled/outline) + burbuja menú + click en producto + hover
 */
(function () {
  const STORAGE_KEY = "cesfa_favorites";
  const CSV_URL = "https://docs.google.com/spreadsheets/d/1jU5lVD5Vo9ltjgt9qRH8UiEJ4jrafX3ZhGnFpt03FEg/export?format=csv&gid=1284971619";
  let _cache = null;
  let _cachePromise = null;

  // Iconos tomados de sources/icons/favorite/filled.svg y outline.svg (fill -> currentColor para heredar color del botón)
  const ICON_FILLED_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true" width="20" height="20" fill="currentColor"><path d="m480-173.85-30.31-27.38q-97.92-89.46-162-153.15-64.07-63.7-101.15-112.35-37.08-48.65-51.81-88.04Q120-594.15 120-634q0-76.31 51.85-128.15Q223.69-814 300-814q52.77 0 99 27t81 78.54Q514.77-760 561-787q46.23-27 99-27 76.31 0 128.15 51.85Q840-710.31 840-634q0 39.85-14.73 79.23-14.73 39.39-51.81 88.04-37.08 48.65-100.77 112.35Q609-290.69 510.31-201.23L480-173.85Z"/></svg>';
  const ICON_OUTLINE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true" width="20" height="20" fill="currentColor"><path d="m480-173.85-30.31-27.38q-97.92-89.46-162-153.15-64.07-63.7-101.15-112.35-37.08-48.65-51.81-88.04Q120-594.15 120-634q0-76.31 51.85-128.15Q223.69-814 300-814q52.77 0 99 27t81 78.54Q514.77-760 561-787q46.23-27 99-27 76.31 0 128.15 51.85Q840-710.31 840-634q0 39.85-14.73 79.23-14.73 39.39-51.81 88.04-37.08 48.65-100.77 112.35Q609-290.69 510.31-201.23L480-173.85Zm0-54.15q96-86.77 158-148.65 62-61.89 98-107.39t50-80.61q14-35.12 14-69.35 0-60-40-100t-100-40q-47.77 0-88.15 27.27-40.39 27.27-72.31 82.11h-39.08q-32.69-55.61-72.69-82.5Q347.77-774 300-774q-59.23 0-99.62 40Q160-694 160-634q0 34.23 14 69.35 14 35.11 50 80.61t98 107q62 61.5 158 149.04Zm0-273Z"/></svg>';
  const ICON_ARROW_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

  function getFavIconSvg(isFav) {
    return isFav ? ICON_FILLED_SVG : ICON_OUTLINE_SVG;
  }

  function parseLine(line) {
    const fields = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        fields.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    fields.push(cur);
    return fields.map((s) => s.trim());
  }

  function parsePriceValue(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    let cleaned = s.replace(/[^\d.,-]/g, "");
    if (!cleaned) return null;
    // Si contiene tanto coma como punto, la coma es separador de miles -> eliminar
    if (cleaned.includes(",") && cleaned.includes(".")) {
      cleaned = cleaned.replace(/,/g, "");
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  function formatPrice(num) {
    return `$RD ${Number(num).toFixed(2)}`;
  }

  function getDiscountPercent(oldNum, newNum) {
    if (oldNum == null || newNum == null) return null;
    if (oldNum <= 0 || newNum <= 0 || newNum >= oldNum) return null;
    return Math.round(((oldNum - newNum) / oldNum) * 100);
  }

  function parsePackageValue(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    let cleaned = s.replace(/[^\d.,-]/g, "");
    if (!cleaned) return null;
    // Manejar coma/punto como en precios: "24.00" -> 24, "24,00" -> 24, "1,200.00" -> 1200
    if (cleaned.includes(",") && cleaned.includes(".")) {
      cleaned = cleaned.replace(/,/g, "");
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    }
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    return Math.trunc(num);
  }

  // Helpers para PACKAGE: "Paq. X unidades" / "Paq. X unid." solo si >2
  function getPackageNum(product) {
    if (!product) return null;
    if (product.packageNum != null) return product.packageNum;
    return parsePackageValue(product.package);
  }

  function formatPackageLong(productOrNum) {
    const num = typeof productOrNum === "object" && productOrNum != null ? getPackageNum(productOrNum) : parsePackageValue(productOrNum);
    if (num == null || num <= 2) return null;
    return `Paq. ${num} unidades`;
  }

  function formatPackageShort(productOrNum) {
    const num = typeof productOrNum === "object" && productOrNum != null ? getPackageNum(productOrNum) : parsePackageValue(productOrNum);
    if (num == null || num <= 2) return null;
    return `Paq. ${num} unid.`;
  }

  function createPriceElement(product) {
    const oldNum = parsePriceValue(product.oldPrice);
    const newNum = parsePriceValue(product.newPrice);
    if (oldNum == null && newNum == null) return null;
    const wrap = document.createElement("div");
    wrap.className = "price";
    if (newNum != null) {
      const newSpan = document.createElement("span");
      newSpan.className = "price-new";
      newSpan.textContent = formatPrice(newNum);
      wrap.appendChild(newSpan);
      if (oldNum != null && oldNum > newNum) {
        const oldSpan = document.createElement("span");
        oldSpan.className = "price-old";
        oldSpan.textContent = formatPrice(oldNum);
        wrap.appendChild(oldSpan);
        const disc = getDiscountPercent(oldNum, newNum);
        if (disc != null && disc > 0) {
          const discSpan = document.createElement("span");
          discSpan.className = "price-discount";
          discSpan.textContent = `-${disc}%`;
          wrap.appendChild(discSpan);
        }
      }
    } else if (oldNum != null) {
      const oldSpan = document.createElement("span");
      oldSpan.className = "price-new";
      oldSpan.textContent = formatPrice(oldNum);
      wrap.appendChild(oldSpan);
    }
    return wrap.childNodes.length ? wrap : null;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (!lines.length) return [];
    const header = parseLine(lines[0]).map((h) => h.trim().toUpperCase());
    const idx = {
      sku: header.indexOf("SKU"),
      category: header.indexOf("CATEGORY"),
      name: header.indexOf("NAME"),
      color: header.indexOf("COLOR"),
      package: header.indexOf("PACKAGE"),
      size: header.indexOf("SIZE"),
      weight: header.indexOf("WEIGHT"),
      oldPrice: header.indexOf("OLD PRICE"),
      newPrice: header.indexOf("NEW PRICE"),
      status: header.indexOf("STATUS"),
    };
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (!cols.length || cols.every((c) => !c)) continue;
      while (cols.length < header.length) cols.push("");
      const sku = (cols[idx.sku] || "").trim();
      if (!sku) continue;
      const oldPriceRaw = idx.oldPrice >= 0 ? (cols[idx.oldPrice] || "").trim() : "";
      const newPriceRaw = idx.newPrice >= 0 ? (cols[idx.newPrice] || "").trim() : "";
      const statusRaw = idx.status >= 0 ? (cols[idx.status] || "").trim() : "";
      const packageRaw = idx.package >= 0 ? (cols[idx.package] || "").trim() : "";
      const packageNum = parsePackageValue(packageRaw);
      rows.push({
        sku: sku,
        category: (cols[idx.category] || "").trim(),
        name: (cols[idx.name] || "").trim(),
        color: (cols[idx.color] || "").trim(),
        package: packageRaw,
        packageNum: packageNum,
        size: (cols[idx.size] || "").trim(),
        weight: (cols[idx.weight] || "").trim(),
        oldPrice: oldPriceRaw,
        newPrice: newPriceRaw,
        oldPriceNum: parsePriceValue(oldPriceRaw),
        newPriceNum: parsePriceValue(newPriceRaw),
        status: statusRaw,
        image: getImageSrc(sku),
        imagePadded: getImageSrcPadded(sku),
      });
    }
    return rows;
  }

  async function fetchProducts() {
    if (_cache) return _cache;
    if (_cachePromise) return _cachePromise;
    _cachePromise = fetch(CSV_URL, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar " + CSV_URL + " (" + res.status + ")");
        return res.text();
      })
      .then((text) => {
        _cache = parseCSV(text);
        return _cache;
      })
      .catch((err) => {
        console.error("[Cesfa] Error cargando CSV:", err);
        const msg = document.createElement("p");
        msg.className = "cesfa-status cesfa-status--error";
        msg.style.cssText = "padding:2rem;text-align:center;";
        msg.textContent = "No se pudieron cargar los productos. Verifica que tengas conexión a internet.";
        throw err;
      });
    return _cachePromise;
  }

  function getFavorites() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.map(String)));
    } catch (e) {
      console.error("[Cesfa] No se pudo guardar favoritos", e);
    }
    window.dispatchEvent(new CustomEvent("cesfa:favorites-changed", { detail: arr.slice() }));
    // actualizar burbuja inmediatamente
    refreshFavBadges();
  }

  function isFavorite(sku) {
    const s = String(sku);
    return getFavorites().includes(s);
  }

  function toggleFavorite(sku) {
    const s = String(sku);
    const favs = getFavorites();
    const idx = favs.indexOf(s);
    let added;
    if (idx >= 0) {
      favs.splice(idx, 1);
      added = false;
    } else {
      favs.push(s);
      added = true;
    }
    saveFavorites(favs);
    return added;
  }

  function getImageSrc(sku) {
    const inSources = window.location.pathname.includes("/sources/");
    const prefix = inSources ? "../products/" : "products/";
    return `${prefix}${String(sku)}.png`;
  }

  function getImageSrcPadded(sku) {
    const inSources = window.location.pathname.includes("/sources/");
    const prefix = inSources ? "../products/" : "products/";
    return `${prefix}${String(sku).padStart(5, "0")}.png`;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function handleImageError(img, sku) {
    const triedPadded = img.dataset.triedPadded === "1";
    if (!triedPadded) {
      const padded = getImageSrcPadded(sku);
      if (img.src.indexOf(padded) === -1 && padded !== img.src) {
        img.dataset.triedPadded = "1";
        img.src = padded;
        return;
      }
    }
    if (img.dataset.fallback !== "1") {
      img.dataset.fallback = "1";
      // Placeholder HTML/CSS: mantiene el tamaño del contenedor fijo (aspect-ratio 1)
      // aunque cambie el tamaño del texto interno, el contenedor no se redimensiona
      img.style.display = "none";
      img.onerror = null;
      img.removeAttribute("onerror");
      const figure = img.parentElement;
      if (figure && !figure.querySelector(".img-placeholder")) {
        const ph = document.createElement("div");
        ph.className = "img-placeholder";
        ph.setAttribute("role", "img");
        ph.setAttribute("aria-label", "Sin imagen " + String(sku));
        const label = document.createElement("span");
        label.className = "ph-label";
        label.textContent = "Sin imagen";
        const skuEl = document.createElement("span");
        skuEl.className = "ph-sku";
        skuEl.textContent = String(sku);
        ph.appendChild(label);
        ph.appendChild(skuEl);
        figure.appendChild(ph);
      }
    }
  }

  function syncFavButtons(sku, isFav) {
    const sel = `.fav-btn[data-sku="${CSS.escape(String(sku))}"]`;
    document.querySelectorAll(sel).forEach(function (b) {
      b.classList.toggle("is-fav", isFav);
      b.setAttribute("aria-pressed", isFav ? "true" : "false");
      b.setAttribute("aria-label", isFav ? "Quitar de favoritos" : "Agregar a favoritos");
      // actualizar icono
      b.innerHTML = getFavIconSvg(isFav);
      // Fix: cuando se desmarca, quitar foco para que no se quede visible por :focus-within/:focus-visible
      if (!isFav && document.activeElement === b) {
        b.blur();
        // también quitar foco del producto contenedor si quedó enfocado
        const prod = b.closest && b.closest(".product");
        if (prod && document.activeElement === prod) prod.blur();
      }
    });
  }

  // --- Animación al añadir a favoritos: flash blanco + corazón palpitante 1s, una sola palpitación, sin sombras ---
  // Efecto solo sobre la imagen (.image), centrado en la imagen
  function triggerFavAddAnimation(productEl) {
    if (!productEl) return;
    const imageEl = productEl.querySelector(".image") || productEl;
    if (!imageEl) return;
    // limpiar animación previa si se pulsa rápido (sobre la imagen)
    imageEl.classList.remove("fav-animating");
    const prev = imageEl.querySelector(".fav-heart-burst");
    if (prev) prev.remove();
    if (imageEl._favAnimTimer) {
      clearTimeout(imageEl._favAnimTimer);
      imageEl._favAnimTimer = null;
    }
    // forzar reflow para reiniciar animación CSS
    void imageEl.offsetWidth;
    imageEl.classList.add("fav-animating");
    const burst = document.createElement("div");
    burst.className = "fav-heart-burst";
    burst.setAttribute("aria-hidden", "true");
    burst.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true" width="96" height="96"><path fill="hsla(5, 90%, 92%, 0.75)" stroke="#f02004" stroke-width="40" stroke-linejoin="round" paint-order="fill" d="m480-173.85-30.31-27.38q-97.92-89.46-162-153.15-64.07-63.7-101.15-112.35-37.08-48.65-51.81-88.04Q120-594.15 120-634q0-76.31 51.85-128.15Q223.69-814 300-814q52.77 0 99 27t81 78.54Q514.77-760 561-787q46.23-27 99-27 76.31 0 128.15 51.85Q840-710.31 840-634q0 39.85-14.73 79.23-14.73 39.39-51.81 88.04-37.08 48.65-100.77 112.35Q609-290.69 510.31-201.23L480-173.85Z"/></svg>';
    imageEl.appendChild(burst);
    imageEl._favAnimTimer = setTimeout(function () {
      imageEl.classList.remove("fav-animating");
      if (burst.parentNode) burst.remove();
      imageEl._favAnimTimer = null;
    }, 1000);
  }

  function createFavButton(sku, opts) {
    opts = opts || {};
    const fav = isFavorite(sku);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fav-btn" + (fav ? " is-fav" : "");
    btn.dataset.sku = String(sku);
    btn.setAttribute("aria-label", fav ? "Quitar de favoritos" : "Agregar a favoritos");
    btn.setAttribute("aria-pressed", fav ? "true" : "false");
    btn.innerHTML = getFavIconSvg(fav);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const currentlyFav = isFavorite(sku);
      if (currentlyFav) {
        // Confirmar antes de quitar de favoritos
        function doRemove() {
          const added = toggleFavorite(sku);
          syncFavButtons(sku, added);
          if (!added) {
            requestAnimationFrame(function(){ if (document.activeElement === btn) btn.blur(); });
          }
          if (typeof opts.onToggle === "function") opts.onToggle(added, sku);
        }
        let productName = "";
        try {
          const prodEl = btn.closest(".product");
          if (prodEl) {
            const nameEl = prodEl.querySelector(".name");
            if (nameEl) productName = nameEl.textContent.trim();
            else if (prodEl.querySelector("h3")) productName = prodEl.querySelector("h3").textContent.trim().split(" - ")[0].trim();
          }
        } catch {}
        if (window.Cesfa && typeof window.Cesfa.confirmFavoriteRemove === "function") {
          window.Cesfa.confirmFavoriteRemove(productName).then(function(ok){ if (ok) doRemove(); });
        } else if (window.Cesfa && typeof window.Cesfa.showConfirm === "function") {
          window.Cesfa.showConfirm({ title: "¿Quitar de favoritos?", message: productName ? `¿Deseas eliminar “${productName}” de tus favoritos?` : "¿Deseas eliminar este producto de tus favoritos?", confirmText: "Quitar", cancelText: "Cancelar", icon: "heart", variant: "danger" }).then(function(ok){ if (ok) doRemove(); });
        } else {
          if (confirm(productName ? `¿Quitar “${productName}” de favoritos?` : "¿Quitar de favoritos?")) doRemove();
        }
        return;
      }
      const added = toggleFavorite(sku);
      syncFavButtons(sku, added);
      if (added) {
        const productEl = btn.closest(".product");
        if (productEl) triggerFavAddAnimation(productEl);
      }
      if (typeof opts.onToggle === "function") opts.onToggle(added, sku);
    });
    return btn;
  }

  // --- Burbuja en el menú FAVORITOS ---
  function refreshFavBadges() {
    const count = getFavorites().length;
    // buscar cualquier link a favorites.html
    const links = document.querySelectorAll('a[href="sources/favorites.html"], a[href="favorites.html"], a[href="./favorites.html"], a[href="/favorites.html"]');
    links.forEach(function (a) {
      let badge = a.querySelector(".fav-badge");
      // Burbuja: mostrar cuando hay al menos 1 favorito. Spec dice "mas de un" (>1) pero UX espera ver burbuja desde 1.
      // Se muestra para count>0; con 2+ también se muestra, cumpliendo spec en todos los casos.
      const shouldShow = count > 0;
      if (!shouldShow) {
        if (badge) badge.remove();
        a.classList.remove("has-badge");
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "fav-badge";
        badge.setAttribute("aria-hidden", "true");
        a.appendChild(badge);
        a.classList.add("has-badge");
        // asegurar que el link sea posicionado para la burbuja absoluta si se desea
        a.style.position = "relative";
      }
      badge.textContent = String(count);
      badge.setAttribute("aria-label", count + " favoritos");
    });
  }

  function initFavBadges() {
    refreshFavBadges();
    window.addEventListener("cesfa:favorites-changed", refreshFavBadges);
    window.addEventListener("storage", function (e) {
      if (e.key === STORAGE_KEY) refreshFavBadges();
    });
  }

  // --- Click en producto completo para toggle favorito ---
  function initProductClickDelegation() {
    document.addEventListener("click", function (e) {
      // ignorar si click fue en botón fav (ya manejado) o en links/botones de acción
      if (e.target.closest(".fav-btn")) return;
      if (e.target.closest(".add-cart-btn")) return;
      if (e.target.closest(".cart-float-btn")) return;
      if (e.target.closest(".cart-drawer")) return;
      if (e.target.closest(".qty-btn")) return;
      if (e.target.closest(".btn-category")) return;
      if (e.target.closest("a")) {
        // si es un link dentro del producto (no hay), ignorar
        const link = e.target.closest("a");
        // si el link es el producto entero (no existe), no ignorar; si es Ver categoría, ya retornado
        if (link && !link.closest(".product")) return;
        if (link && link.classList.contains("btn-category")) return;
      }
      const product = e.target.closest(".product");
      if (!product) return;
      const btn = product.querySelector(".fav-btn[data-sku]");
      if (!btn) return;
      const sku = btn.dataset.sku;
      if (!sku) return;
      // toggle con confirmación si es para quitar
      const currentlyFav = isFavorite(sku);
      if (currentlyFav) {
        let productName = "";
        try {
          const nameEl = product.querySelector(".name");
          if (nameEl) productName = nameEl.textContent.trim();
          else if (product.querySelector("h3")) productName = product.querySelector("h3").textContent.trim().split(" - ")[0].trim();
        } catch {}
        function doToggleOff() {
          const added = toggleFavorite(sku);
          syncFavButtons(sku, added);
          if (added) triggerFavAddAnimation(product);
          if (!added) {
            const active = document.activeElement;
            if (active && (active.classList.contains("fav-btn") || active.classList.contains("product"))) {
              active.blur();
            }
            const favBtn = product.querySelector(".fav-btn");
            if (favBtn && document.activeElement === favBtn) favBtn.blur();
            if (document.activeElement === product) product.blur();
          }
          const detail = { sku: String(sku), added: added };
          product.dispatchEvent(new CustomEvent("cesfa:product-toggle", { bubbles: true, detail: detail }));
        }
        if (window.Cesfa && typeof window.Cesfa.confirmFavoriteRemove === "function") {
          window.Cesfa.confirmFavoriteRemove(productName).then(function(ok){ if (ok) doToggleOff(); });
        } else if (window.Cesfa && typeof window.Cesfa.showConfirm === "function") {
          window.Cesfa.showConfirm({ title: "¿Quitar de favoritos?", message: productName ? `¿Deseas eliminar “${productName}” de tus favoritos?` : "¿Deseas eliminar este producto de tus favoritos?", confirmText: "Quitar", cancelText: "Cancelar", icon: "heart", variant: "danger" }).then(function(ok){ if(ok) doToggleOff(); });
        } else {
          if (confirm(productName ? `¿Quitar “${productName}” de favoritos?` : "¿Quitar de favoritos?")) doToggleOff();
        }
        return;
      }
      const added = toggleFavorite(sku);
      syncFavButtons(sku, added);
      if (added) triggerFavAddAnimation(product);
      // si el producto tiene onToggle personalizado (favorites.js usa data), el syncFavButtons ya actualizó,
      // pero favorites.js escucha cesfa:favorites-changed y re-renderiza; para animación, necesitamos trigger onToggle manualmente
      // Disparar evento personalizado para que favorites.js pueda reaccionar si necesita animación
      // Buscamos si hay un listener específico: emitimos un evento en el product
      const detail = { sku: String(sku), added: added };
      product.dispatchEvent(new CustomEvent("cesfa:product-toggle", { bubbles: true, detail: detail }));
      // También disparar en el botón para compatibilidad con onToggle pasado a createFavButton (que en favorites.js espera animación)
      // El onToggle de createFavButton no se disparará via delegation, así que aquí notificamos
      // Si estamos en favorites.html, el handler de favorites.js escuchará el cambio global y hará render, pero para animación necesitamos delay
      // favorites.js ya maneja cesfa:favorites-changed -> render, así que no necesitamos más
    });
    // Hacer productos con cursor pointer accesible
    // Aplicar role y tabindex para accesibilidad
    const observer = new MutationObserver(function () {
      document.querySelectorAll(".product").forEach(function (p) {
        if (p.dataset.favClickBound) return;
        p.dataset.favClickBound = "1";
        p.style.cursor = "pointer";
        if (!p.hasAttribute("role")) p.setAttribute("role", "button");
        if (!p.hasAttribute("tabindex")) p.setAttribute("tabindex", "0");
        // teclado: Enter / Space toggle
        p.addEventListener("keydown", function (ke) {
          if (ke.key === "Enter" || ke.key === " ") {
            ke.preventDefault();
            const btn = p.querySelector(".fav-btn[data-sku]");
            if (!btn) return;
            const sku = btn.dataset.sku;
            const currentlyFav = isFavorite(sku);
            if (currentlyFav) {
              let productName = "";
              try {
                const nameEl = p.querySelector(".name");
                if (nameEl) productName = nameEl.textContent.trim();
              } catch {}
              function doOff() {
                const added = toggleFavorite(sku);
                syncFavButtons(sku, added);
                if (added) triggerFavAddAnimation(p);
              }
              if (window.Cesfa && typeof window.Cesfa.confirmFavoriteRemove === "function") {
                window.Cesfa.confirmFavoriteRemove(productName).then(function(ok){ if(ok) doOff(); });
              } else if (window.Cesfa && typeof window.Cesfa.showConfirm === "function") {
                window.Cesfa.showConfirm({ title: "¿Quitar de favoritos?", message: productName ? `¿Deseas eliminar “${productName}” de tus favoritos?` : "¿Deseas eliminar este producto de tus favoritos?", confirmText: "Quitar", cancelText: "Cancelar", icon: "heart", variant: "danger" }).then(function(ok){ if(ok) doOff(); });
              } else {
                if (confirm(productName ? `¿Quitar “${productName}” de favoritos?` : "¿Quitar de favoritos?")) doOff();
              }
              return;
            }
            const added = toggleFavorite(sku);
            syncFavButtons(sku, added);
            if (added) triggerFavAddAnimation(p);
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // inicial inmediato
    document.querySelectorAll(".product").forEach(function (p) {
      p.style.cursor = "pointer";
    });
  }

  // --- Footer: lista de categorías con mismo estilo de enlace que CONTACTOS, sin iconos ---
  function renderFooterCategories(products) {
    var container = document.getElementById("footerCategories");
    if (!container) return;
    // Extraer categorías únicas preservando orden de aparición
    var seen = Object.create(null);
    var categories = [];
    for (var i = 0; i < products.length; i++) {
      var cat = (products[i].category || "").trim();
      if (!cat || seen[cat]) continue;
      seen[cat] = true;
      categories.push(cat);
    }
    // Orden alfabético en español para footer
    categories.sort(function (a, b) {
      return a.localeCompare(b, "es", { sensitivity: "base" });
    });
    container.innerHTML = "";
    for (var j = 0; j < categories.length; j++) {
      var category = categories[j];
      var li = document.createElement("li");
      var a = document.createElement("a");
      var inSources = window.location.pathname.includes("/sources/");
      a.href = (inSources ? "catalog.html?category=" : "sources/catalog.html?category=") + encodeURIComponent(category);
      a.setAttribute("aria-label", "Ver productos de " + category);
      // Solo el nombre, sin iconos — mismo estilo de enlace que CONTACTOS por herencia de .footer-col a
      a.textContent = category;
      li.appendChild(a);
      container.appendChild(li);
    }
  }

  function initFooterCategories() {
    var container = document.getElementById("footerCategories");
    if (!container) return;
    fetchProducts()
      .then(function (products) {
        renderFooterCategories(products);
      })
      .catch(function (err) {
        console.error("[Cesfa] Error cargando categorías del footer:", err);
      });
  }

  // Inicializar burbuja, delegación y categorías del footer al cargar DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initFavBadges();
      initProductClickDelegation();
      initFooterCategories();
    });
  } else {
    initFavBadges();
    initProductClickDelegation();
    initFooterCategories();
  }

  window.Cesfa = Object.assign(window.Cesfa || {}, {
    fetchProducts,
    parseCSV,
    getFavorites,
    saveFavorites,
    isFavorite,
    toggleFavorite,
    getImageSrc,
    shuffle,
    handleImageError,
    createFavButton,
    syncFavButtons,
    refreshFavBadges,
    parsePriceValue,
    formatPrice,
    getDiscountPercent,
    createPriceElement,
    parsePackageValue,
    getPackageNum,
    formatPackageLong,
    formatPackageShort,
    STORAGE_KEY,
    ICON_FILLED_SVG,
    ICON_OUTLINE_SVG,
    ICON_ARROW_SVG,
  });
})();
