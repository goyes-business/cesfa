/**
 * cart.js — Carrito de compras Cesfa
 * - Almacenado en localStorage (cesfa_cart)
 * - Botón flotante blanco/negro con burbuja roja
 * - Bandeja lateral con lista, control cantidad [-] 1 [+] , total y COMPRAR (WhatsApp)
 * - Botón +carrito en tarjeta (manejado desde catalog.js / favorites.js via Cesfa.addToCart)
 */
(function () {
  const CART_KEY = "cesfa_cart";
  const WA_NUMBER = "18099218324"; // mismo que header whatsapp

  // Iconos oficiales — sources/icons/cart.svg (flotante) y add.svg (botón producto)
  const CART_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true" width="24" height="24" fill="currentColor"><path d="m0.0025492 3.0018c0-0.93133 0.762-1.6933 1.696-1.6933h3.1803c1.9076 0 3.6036 1.3547 3.9 3.2623l0.0847 0.127h28.324c1.7806 0 3.0956 1.6536 2.757 3.392l-1.823 9.7049c-0.59531 2.9263-3.2226 5.0456-6.1912 5.0456h-19.844l0.42334 1.9923c0.16933 0.84667 0.89164 1.397 1.6536 1.397h18.148c0.89165 0 1.696 0.80698 1.696 1.696 0 0.93398-0.80433 1.696-1.696 1.696h-18.148c-2.5003 0-4.535-1.7383-5.0456-4.154l-3.6883-20.262c0-0.29633-0.254-0.508-0.55034-0.508h-3.1803c-0.93398 0-1.696-0.762-1.696-1.696zm11.533 16.447h20.394c1.3573 0 2.5453-1.016 2.8416-2.2886l1.696-9.0699h-26.969zm3.1803 12.462c1.9076 0 3.392 1.4843 3.392 3.392 0 1.905-1.4843 3.3893-3.392 3.3893-1.9103 0-3.392-1.4843-3.392-3.3893 0-1.9076 1.4817-3.392 3.392-3.392zm15.899 0c1.9076 0 3.392 1.4843 3.392 3.392 0 1.905-1.4843 3.3893-3.392 3.3893-1.95 0-3.4343-1.4843-3.4343-3.3893 0-1.9076 1.4843-3.392 3.4343-3.392z"/></svg>';
  const CART_ADD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true" width="16" height="16" fill="currentColor"><path d="m19.952 0c1.9762 0 3.6781 1.6123 3.6781 3.5886v12.775h12.781c1.881 0 3.5886 1.6123 3.5886 3.5828 0 1.9762-1.7075 3.5886-3.5886 3.5886h-12.781v12.865c0 1.881-1.7019 3.5828-3.6781 3.5828-1.881 0-3.5886-1.7019-3.5886-3.5828v-12.865h-12.775c-1.9706 0-3.5886-1.6123-3.5886-3.5886 0-1.9706 1.6179-3.5828 3.5886-3.5828h12.775v-12.775c0-1.9762 1.7075-3.5886 3.5886-3.5886z"/></svg>';

  function getCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      // Normalizar: {sku, qty}
      return arr
        .map((it) => ({
          sku: String(it.sku || it.id || "").trim(),
          qty: Math.max(1, parseInt(it.qty || it.quantity || 1, 10) || 1),
        }))
        .filter((it) => it.sku);
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error("[Cesfa Cart] No se pudo guardar", e);
    }
    window.dispatchEvent(new CustomEvent("cesfa:cart-changed", { detail: cart.slice() }));
    refreshFloatingBadge();
    refreshDrawer();
    syncCartButtons();
  }

  function getCartCount() {
    return getCart().reduce((acc, it) => acc + (it.qty || 0), 0);
  }

  function addToCart(sku, qtyAdd) {
    qtyAdd = qtyAdd == null ? 1 : Math.max(1, parseInt(qtyAdd, 10) || 1);
    const s = String(sku).trim();
    if (!s) return;
    const cart = getCart();
    const found = cart.find((it) => it.sku === s);
    if (found) {
      found.qty += qtyAdd;
    } else {
      cart.push({ sku: s, qty: qtyAdd });
    }
    saveCart(cart);
    // feedback opcional: abrir drawer sutil o animar badge
    pulseFloatingBtn();
  }

  function setQuantity(sku, qty) {
    const s = String(sku).trim();
    let cart = getCart();
    qty = parseInt(qty, 10);
    if (isNaN(qty) || qty <= 0) {
      cart = cart.filter((it) => it.sku !== s);
    } else {
      const f = cart.find((it) => it.sku === s);
      if (f) f.qty = qty;
      else cart.push({ sku: s, qty: qty });
    }
    saveCart(cart);
  }

  function removeFromCart(sku) {
    const s = String(sku).trim();
    const cart = getCart().filter((it) => it.sku !== s);
    saveCart(cart);
  }

  function clearCart() {
    saveCart([]);
  }

  function getProductPrice(product) {
    if (!product) return null;
    const newNum = product.newPriceNum != null ? product.newPriceNum : (window.Cesfa && window.Cesfa.parsePriceValue ? window.Cesfa.parsePriceValue(product.newPrice) : null);
    const oldNum = product.oldPriceNum != null ? product.oldPriceNum : (window.Cesfa && window.Cesfa.parsePriceValue ? window.Cesfa.parsePriceValue(product.oldPrice) : null);
    if (newNum != null) return newNum;
    if (oldNum != null) return oldNum;
    return null;
  }

  function hasValue(v) {
    return v != null && String(v).trim() !== "";
  }

  function isInCart(sku) {
    const s = String(sku).trim();
    return getCart().some((it) => it.sku === s);
  }

  function syncCartButtons() {
    const cart = getCart();
    const set = new Set(cart.map((it) => String(it.sku)));
    document.querySelectorAll(".add-cart-btn[data-sku]").forEach(function (btn) {
      const sku = btn.dataset.sku;
      const inCart = set.has(String(sku));
      btn.classList.toggle("is-added", inCart);
      // Mantener rojo cuando está en carrito (is-added = background #f02004)
      // accesibilidad
      btn.setAttribute("aria-pressed", inCart ? "true" : "false");
    });
  }

  // ---------- UI: floating button + drawer ----------
  let els = null;
  let cartHistoryPushed = false;
  const CART_HASH = "#cart";

  // Listener global temprano para capturar el botón atrás incluso antes de que init termine
  (function setupHistoryHandler() {
    function handleBackClose() {
      if (els && els.drawer && els.drawer.classList.contains("is-open")) {
        closeDrawer({ fromPopState: true });
      } else if (cartHistoryPushed) {
        cartHistoryPushed = false;
        // si quedó hash #cart sin bandeja abierta (ej. navegación manual), limpiarlo
        if (location.hash === CART_HASH) {
          try { history.replaceState(null, "", location.pathname + location.search); } catch {}
        }
      }
    }
    window.addEventListener("popstate", handleBackClose);
    window.addEventListener("hashchange", function () {
      // fallback para navegadores que disparan hashchange en lugar de popstate al retroceder
      if (location.hash !== CART_HASH && els && els.drawer && els.drawer.classList.contains("is-open")) {
        closeDrawer({ fromPopState: true });
      }
    });
  })();

  function createCartUI() {
    if (document.getElementById("cart-float-btn")) return; // ya existe

    // botón flotante
    const floatBtn = document.createElement("button");
    floatBtn.id = "cart-float-btn";
    floatBtn.className = "cart-float-btn";
    floatBtn.type = "button";
    floatBtn.setAttribute("aria-label", "Abrir carrito de compras");
    floatBtn.innerHTML = CART_SVG + '<span class="cart-badge" style="display:none">0</span>';
    document.body.appendChild(floatBtn);

    // drawer
    const drawer = document.createElement("div");
    drawer.id = "cart-drawer";
    drawer.className = "cart-drawer";
    drawer.setAttribute("aria-hidden", "true");
    const _inSources = window.location.pathname.includes("/sources/");
    const _iconClose = _inSources ? "icons/close.svg" : "sources/icons/close.svg";
    const _iconDelete = _inSources ? "icons/delete.svg" : "sources/icons/delete.svg";
    drawer.innerHTML = `
      <div class="cart-overlay" data-close="1"></div>
      <aside class="cart-sidebar" role="dialog" aria-modal="true" aria-label="Carrito de compras">
        <header class="cart-header">
          <h2>Carrito</h2>
          <div class="cart-header-actions">
            <button type="button" class="cart-clear" aria-label="Vaciar carrito"><img src="${_iconDelete}" alt="" aria-hidden="true" width="20" height="20"></button>
            <button type="button" class="cart-close" aria-label="Cerrar carrito"><img src="${_iconClose}" alt="" aria-hidden="true" width="20" height="20"></button>
          </div>
        </header>
        <div class="cart-body">
          <ul class="cart-items"></ul>
          <p class="cart-empty">Tu carrito está vacío.</p>
        </div>
        <footer class="cart-footer">
          <div class="cart-total"><span>Total</span><strong class="cart-total-value">$RD 0.00</strong></div>
          <a class="cart-checkout-btn" href="#" rel="noopener" target="_blank">COMPRAR</a>
        </footer>
      </aside>
    `;
    document.body.appendChild(drawer);

    els = {
      floatBtn,
      badge: floatBtn.querySelector(".cart-badge"),
      drawer,
      overlay: drawer.querySelector(".cart-overlay"),
      closeBtn: drawer.querySelector(".cart-close"),
      clearBtn: drawer.querySelector(".cart-clear"),
      itemsEl: drawer.querySelector(".cart-items"),
      emptyEl: drawer.querySelector(".cart-empty"),
      totalEl: drawer.querySelector(".cart-total-value"),
      checkoutBtn: drawer.querySelector(".cart-checkout-btn"),
      sidebar: drawer.querySelector(".cart-sidebar"),
    };

    // eventos abrir / cerrar
    floatBtn.addEventListener("click", openDrawer);
    els.overlay.addEventListener("click", closeDrawer);
    els.closeBtn.addEventListener("click", closeDrawer);
    if (els.clearBtn) {
      els.clearBtn.addEventListener("click", function () {
        if (getCart().length === 0) return;
        clearCart();
      });
    }
    drawer.addEventListener("click", function (e) {
      if (e.target.dataset.close === "1") closeDrawer();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && els.drawer.classList.contains("is-open")) closeDrawer();
    });

    // delegación cantidad dentro del drawer
    els.itemsEl.addEventListener("click", function (e) {
      const btn = e.target.closest(".qty-btn");
      if (!btn) return;
      const item = e.target.closest(".cart-item");
      if (!item) return;
      const sku = item.dataset.sku;
      const isMinus = btn.classList.contains("qty-minus");
      const isPlus = btn.classList.contains("qty-plus");
      const current = getCart().find((it) => it.sku === String(sku));
      const qty = current ? current.qty : 0;
      if (isMinus) setQuantity(sku, qty - 1);
      if (isPlus) setQuantity(sku, qty + 1);
    });

    // checkout click: si usa href ya preparado, dejar navegar; si vacío prevenir
    els.checkoutBtn.addEventListener("click", function (e) {
      if (els.drawer.classList.contains("is-empty")) {
        e.preventDefault();
        return;
      }
      // href ya está actualizado en refreshDrawer; permitir navegación a WhatsApp
      // opcional: cerrar drawer y limpiar? No limpiar automáticamente, dejar al usuario
    });

    refreshFloatingBadge();
    refreshDrawer();
  }

  function pulseFloatingBtn() {
    if (!els || !els.floatBtn) return;
    els.floatBtn.style.transform = "scale(1.12)";
    setTimeout(() => {
      if (els.floatBtn) els.floatBtn.style.transform = "";
    }, 180);
  }

  function openDrawer() {
    if (!els) return;
    if (els.drawer.classList.contains("is-open")) return;
    els.drawer.classList.add("is-open");
    els.drawer.setAttribute("aria-hidden", "false");
    // lock scroll
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    // asegurar lista fresca
    refreshDrawer();
    // foco en cerrar
    setTimeout(() => els.closeBtn && els.closeBtn.focus(), 50);
    // Empujar entrada al historial para que el botón atrás cierre la bandeja
    // Usamos hash #cart para garantizar que se cree una entrada distinta (algunos navegadores ignoran pushState con misma URL)
    try {
      if (!cartHistoryPushed && location.hash !== CART_HASH) {
        const base = location.pathname + location.search;
        // pushState con hash no hace scroll; preferible a location.hash = ...
        history.pushState({ cesfaCartOpen: true }, "", base + CART_HASH);
        cartHistoryPushed = true;
      } else if (!cartHistoryPushed) {
        history.pushState({ cesfaCartOpen: true }, "", location.href);
        cartHistoryPushed = true;
      }
    } catch (e) {
      try { history.pushState({ cesfaCartOpen: true }, "", location.href); cartHistoryPushed = true; } catch {}
    }
  }

  function closeDrawer(opts) {
    const fromPopState = opts && typeof opts === "object" && opts.fromPopState === true;
    // opts puede ser el evento del click, ignorarlo
    if (!els) return;
    if (!els.drawer.classList.contains("is-open")) {
      if (fromPopState) {
        cartHistoryPushed = false;
        // si el retroceso dejó el hash, limpiarlo silenciosamente
        if (location.hash === CART_HASH) {
          try { history.replaceState(null, "", location.pathname + location.search); } catch {}
        }
      }
      return;
    }
    els.drawer.classList.remove("is-open");
    els.drawer.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    if (els.floatBtn) els.floatBtn.focus();
    if (!fromPopState && cartHistoryPushed) {
      cartHistoryPushed = false;
      try {
        // si abrimos con hash, retroceder quita el hash y cierra sin salir de la página
        if (location.hash === CART_HASH) {
          history.back();
        } else if (history.state && history.state.cesfaCartOpen === true) {
          history.back();
        }
      } catch {}
    } else if (fromPopState) {
      cartHistoryPushed = false;
      // asegurar que el hash se limpie después del popstate (algunos navegadores mantienen #cart tras back)
      if (location.hash === CART_HASH) {
        try { history.replaceState(null, "", location.pathname + location.search); } catch {}
      }
    }
  }

  function refreshFloatingBadge() {
    if (!els || !els.badge) {
      const b = document.querySelector("#cart-float-btn .cart-badge");
      if (!b) return;
      els = els || {};
      els.badge = b;
    }
    const count = getCartCount();
    if (count > 0) {
      els.badge.textContent = String(count);
      els.badge.style.display = "inline-flex";
      // también actualizar título del botón
      const btn = document.getElementById("cart-float-btn");
      if (btn) btn.setAttribute("aria-label", `Carrito con ${count} producto${count!==1?'s':''}`);
    } else {
      els.badge.style.display = "none";
    }
  }

  let _productsCache = null;

  async function refreshDrawer() {
    if (!els || !els.itemsEl) return;

    const cart = getCart();
    const isEmpty = cart.length === 0;
    els.drawer.classList.toggle("is-empty", isEmpty);
    if (els.clearBtn) {
      els.clearBtn.disabled = isEmpty;
      els.clearBtn.setAttribute("aria-disabled", isEmpty ? "true" : "false");
    }

    // intentar obtener productos para nombre/precio/imagen
    let products = _productsCache;
    if (!products && window.Cesfa && window.Cesfa.fetchProducts) {
      try {
        products = await window.Cesfa.fetchProducts();
        _productsCache = products;
      } catch {
        products = [];
      }
    }
    const map = new Map();
    if (products) {
      for (const p of products) map.set(String(p.sku), p);
    }

    // render lista con información completa como en catálogo
    els.itemsEl.innerHTML = "";
    let total = 0;

    for (const entry of cart) {
      const p = map.get(String(entry.sku));
      const qty = entry.qty;
      const price = p ? getProductPrice(p) : null;
      if (price != null) total += price * qty;

      const li = document.createElement("li");
      li.className = "cart-item";
      li.dataset.sku = String(entry.sku);

      const img = document.createElement("img");
      if (p) {
        img.src = window.Cesfa.getImageSrc ? window.Cesfa.getImageSrc(entry.sku) : `products/${entry.sku}.png`;
        img.alt = p.name || entry.sku;
      } else {
        img.src = window.Cesfa && window.Cesfa.getImageSrc ? window.Cesfa.getImageSrc(entry.sku) : `products/${entry.sku}.png`;
        img.alt = entry.sku;
      }
      img.loading = "lazy";
      img.onerror = function () {
        img.style.display = "none";
      };

      const info = document.createElement("div");
      info.className = "cart-item-info";

      if (p) {
        // Título: NAME - COLOR
        const title = document.createElement("div");
        title.className = "cart-item-title";
        const nameSpan = document.createElement("span");
        nameSpan.className = "name";
        nameSpan.textContent = p.name || entry.sku;
        title.appendChild(nameSpan);
        if (hasValue(p.color)) {
          const sep = document.createElement("span");
          sep.textContent = " - ";
          sep.className = "sep";
          const colorSpan = document.createElement("span");
          colorSpan.className = "color";
          colorSpan.textContent = p.color;
          title.appendChild(sep);
          title.appendChild(colorSpan);
        }
        info.appendChild(title);

        // Meta: SKU + SIZE + WEIGHT (como h4 en catálogo)
        const meta = document.createElement("div");
        meta.className = "cart-item-meta";
        const skuSpan = document.createElement("span");
        skuSpan.className = "sku";
        skuSpan.textContent = p.sku;
        meta.appendChild(skuSpan);
        if (hasValue(p.size)) {
          const sizeSpan = document.createElement("span");
          sizeSpan.className = "tag size";
          sizeSpan.textContent = p.size;
          meta.appendChild(sizeSpan);
        }
        if (hasValue(p.weight)) {
          const weightSpan = document.createElement("span");
          weightSpan.className = "tag weigth";
          weightSpan.textContent = p.weight;
          meta.appendChild(weightSpan);
        }
        // PACKAGE comprimido Paq. X unid. solo si >2
        let pkgShort = null;
        if (window.Cesfa && typeof window.Cesfa.formatPackageShort === "function") {
          pkgShort = window.Cesfa.formatPackageShort(p);
        } else {
          let n = null;
          if (p.packageNum != null) n = p.packageNum;
          else if (p.package) {
            let cleaned = String(p.package).replace(/[^\d.,-]/g, "");
            if (cleaned.includes(",") && cleaned.includes(".")) cleaned = cleaned.replace(/,/g, "");
            else if (cleaned.includes(",")) cleaned = cleaned.replace(",", ".");
            const f = parseFloat(cleaned);
            if (!isNaN(f)) n = Math.trunc(f);
          }
          if (n != null && !isNaN(n) && n > 2) pkgShort = `Paq. ${n} unid.`;
        }
        if (pkgShort) {
          const pkgSpan = document.createElement("span");
          pkgSpan.className = "tag package";
          pkgSpan.textContent = pkgShort;
          meta.appendChild(pkgSpan);
        }
        info.appendChild(meta);

        // Precios: OLD PRICE, NEW PRICE, descuento (igual que catálogo)
        if (window.Cesfa && typeof window.Cesfa.createPriceElement === "function") {
          const priceEl = window.Cesfa.createPriceElement(p);
          if (priceEl) {
            priceEl.classList.add("cart-price");
            info.appendChild(priceEl);
          }
        } else if (price != null && window.Cesfa && window.Cesfa.formatPrice) {
          const fallback = document.createElement("div");
          fallback.className = "price cart-price";
          const span = document.createElement("span");
          span.className = "price-new";
          span.textContent = window.Cesfa.formatPrice(price);
          fallback.appendChild(span);
          info.appendChild(fallback);
        }
      } else {
        const title = document.createElement("div");
        title.className = "cart-item-title";
        title.textContent = `Producto ${entry.sku}`;
        info.appendChild(title);
        const meta = document.createElement("div");
        meta.className = "cart-item-meta";
        const skuSpan = document.createElement("span");
        skuSpan.className = "sku";
        skuSpan.textContent = entry.sku;
        meta.appendChild(skuSpan);
        info.appendChild(meta);
      }

      const qtyBox = document.createElement("div");
      qtyBox.className = "cart-item-qty";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "qty-btn qty-minus";
      minus.setAttribute("aria-label", "Disminuir cantidad");
      minus.textContent = "−";
      const val = document.createElement("span");
      val.className = "qty-value";
      val.textContent = String(qty);
      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "qty-btn qty-plus";
      plus.setAttribute("aria-label", "Aumentar cantidad");
      plus.textContent = "+";
      qtyBox.appendChild(minus);
      qtyBox.appendChild(val);
      qtyBox.appendChild(plus);

      li.appendChild(img);
      li.appendChild(info);
      li.appendChild(qtyBox);
      els.itemsEl.appendChild(li);
    }

    // total - suma de (precio unitario * cantidad)
    const totalValue = total;
    if (window.Cesfa && window.Cesfa.formatPrice) {
      els.totalEl.textContent = window.Cesfa.formatPrice(totalValue);
    } else {
      els.totalEl.textContent = `$RD ${totalValue.toFixed(2)}`;
    }

    // actualizar enlace COMPRAR -> WhatsApp
    const checkout = els.checkoutBtn;
    if (isEmpty) {
      checkout.setAttribute("href", "#");
      checkout.setAttribute("aria-disabled", "true");
    } else {
      checkout.removeAttribute("aria-disabled");
      let msg = "*Me gustaría comprar los siguientes productos:*\n";
      for (const entry of cart) {
        const p = map.get(String(entry.sku));
        const name = p ? p.name : `Producto ${entry.sku}`;
        const price = p ? getProductPrice(p) : null;
        const priceStr = price != null && window.Cesfa && window.Cesfa.formatPrice ? window.Cesfa.formatPrice(price) : (price != null ? `$RD ${price.toFixed(2)}` : "");
        let extra = "";
        if (p && hasValue(p.color)) extra += ` - ${String(p.color).trim()}`;
        if (p && hasValue(p.size)) extra += ` - ${String(p.size).trim()}`;
        let pkgShortMsg = null;
        if (p && window.Cesfa && typeof window.Cesfa.formatPackageShort === "function") {
          pkgShortMsg = window.Cesfa.formatPackageShort(p);
        } else if (p) {
          let n = null;
          if (p.packageNum != null) n = p.packageNum;
          else if (p.package) {
            let cleaned = String(p.package).replace(/[^\d.,-]/g, "");
            if (cleaned.includes(",") && cleaned.includes(".")) cleaned = cleaned.replace(/,/g, "");
            else if (cleaned.includes(",")) cleaned = cleaned.replace(",", ".");
            const f = parseFloat(cleaned);
            if (!isNaN(f)) n = Math.trunc(f);
          }
          if (n != null && !isNaN(n) && n > 2) pkgShortMsg = `Paq. ${n} unid.`;
        }
        if (pkgShortMsg) extra += ` - ${pkgShortMsg}`;
        msg += `• ${entry.qty} x ${name}${extra} (${entry.sku})` + (priceStr ? ` - ${priceStr} c/u` : "") + "\n";
      }
      const totalStr = window.Cesfa && window.Cesfa.formatPrice ? window.Cesfa.formatPrice(totalValue) : `$RD ${totalValue.toFixed(2)}`;
      msg += `\n*TOTAL: ${totalStr}*`;
      const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
      checkout.setAttribute("href", url);
    }
  }

  // Exponer API global
  window.Cesfa = window.Cesfa || {};
  // placeholder hasta que products.js cargue; se mezclará después
  const cartAPI = {
    getCart,
    saveCart,
    addToCart,
    setQuantity,
    removeFromCart,
    clearCart,
    getCartCount,
    isInCart,
    syncCartButtons,
    hasCartValue: hasValue,
    openCart: function(){ if(els) openDrawer(); else createCartUI(), openDrawer(); },
    closeCart: closeDrawer,
    refreshCartUI: function(){ refreshFloatingBadge(); refreshDrawer(); syncCartButtons(); },
    ICON_CART_SVG: CART_SVG,
    ICON_CART_ADD_SVG: CART_ADD_SVG,
    ICON_ADD_SVG: CART_ADD_SVG,
  };
  Object.assign(window.Cesfa, cartAPI);

  // Init UI cuando DOM listo
  function initCartUI() {
    createCartUI();
    syncCartButtons();
    // Limpiar estado de historial obsoleto (ej. recarga con bandeja abierta o hash #cart heredado)
    try {
      if (location.hash === CART_HASH) {
        history.replaceState(null, "", location.pathname + location.search);
      }
      if (history.state && history.state.cesfaCartOpen) {
        history.replaceState(null, "", location.pathname + location.search);
      }
      cartHistoryPushed = false;
    } catch {}
    // Observar nuevos botones +carrito que se inserten (catálogo / favoritos renderizados después)
    const obs = new MutationObserver(function () {
      syncCartButtons();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // escuchar cambios externos (otra pestaña)
    window.addEventListener("storage", function (e) {
      if (e.key === CART_KEY) {
        refreshFloatingBadge();
        refreshDrawer();
        syncCartButtons();
      }
    });
    window.addEventListener("cesfa:cart-changed", function () {
      refreshFloatingBadge();
      refreshDrawer();
      syncCartButtons();
    });
    // si products se carga después, refrescar cache
    if (window.Cesfa.fetchProducts) {
      // precache sin bloquear
      window.Cesfa.fetchProducts().then(function (prods) {
        _productsCache = prods;
        refreshDrawer();
      }).catch(()=>{});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCartUI);
  } else {
    initCartUI();
  }
})();
