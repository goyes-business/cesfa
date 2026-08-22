/**
 * confirm.js — Modal de confirmación reutilizable Cesfa
 * Expone: window.Cesfa.showConfirm(options) => Promise<boolean>
 * y window.Cesfa.confirmCartClear / confirmFavoriteRemove helpers
 */
(function () {
  // Evitar doble inicialización
  if (window.Cesfa && window.Cesfa.showConfirm) return;

  let els = null;
  let activeResolve = null;
  let lastFocus = null;
  let confirmHistoryPushed = false;
  const DELETE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" width="22" height="22"><path d="m213.33 0q-44 0-75.333-31.333-31.333-31.333-31.333-75.333v-693.33q-22.667 0-38-15.333-15.333-15.333-15.333-38 0-22.667 15.333-38 15.333-15.333 38-15.333h213.33q0-22.667 15.333-38 15.333-15.333 38-15.333h213.33q22.667 0 38 15.333 15.333 15.333 15.333 38h213.33q22.667 0 38 15.333 15.333 15.333 15.333 38 0 22.667-15.333 38-15.333 15.333-38 15.333v693.33q0 44-31.333 75.333-31.333 31.333-75.333 31.333zm533.33-800h-533.33v693.33h533.33zm-335.33 571.33q15.333-15.333 15.333-38v-373.33q0-22.667-15.333-38-15.333-15.333-38-15.333-22.667 0-38 15.333-15.333 15.333-15.333 38v373.33q0 22.667 15.333 38 15.333 15.333 38 15.333 22.667 0 38-15.333zm213.33 0q15.333-15.333 15.333-38v-373.33q0-22.667-15.333-38-15.333-15.333-38-15.333-22.667 0-38 15.333-15.333 15.333-15.333 38v373.33q0 22.667 15.333 38 15.333 15.333 38 15.333 22.667 0 38-15.333zm-411.33-571.33v693.33z"/></svg>';

  function createConfirmUI() {
    if (document.getElementById("cesfa-confirm-overlay")) {
      els = {
        overlay: document.getElementById("cesfa-confirm-overlay"),
        dialog: document.querySelector("#cesfa-confirm-overlay .confirm-dialog"),
        iconEl: document.querySelector("#cesfa-confirm-overlay .confirm-icon"),
        titleEl: document.querySelector("#cesfa-confirm-overlay .confirm-title"),
        messageEl: document.querySelector("#cesfa-confirm-overlay .confirm-message"),
        cancelBtn: document.querySelector("#cesfa-confirm-overlay .confirm-btn-cancel"),
        confirmBtn: document.querySelector("#cesfa-confirm-overlay .confirm-btn-confirm"),
      };
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "cesfa-confirm-overlay";
    overlay.className = "confirm-overlay";
    overlay.setAttribute("aria-hidden", "true");
    const trashIcon = DELETE_SVG;
    overlay.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="cesfa-confirm-title" aria-describedby="cesfa-confirm-message">
        <div class="confirm-icon" aria-hidden="true">${trashIcon}</div>
        <h2 class="confirm-title" id="cesfa-confirm-title">¿Estás seguro?</h2>
        <p class="confirm-message" id="cesfa-confirm-message">Esta acción no se puede deshacer.</p>
        <div class="confirm-actions">
          <button type="button" class="confirm-btn confirm-btn-cancel">Cancelar</button>
          <button type="button" class="confirm-btn confirm-btn-confirm is-danger">Eliminar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    els = {
      overlay,
      dialog: overlay.querySelector(".confirm-dialog"),
      iconEl: overlay.querySelector(".confirm-icon"),
      titleEl: overlay.querySelector(".confirm-title"),
      messageEl: overlay.querySelector(".confirm-message"),
      cancelBtn: overlay.querySelector(".confirm-btn-cancel"),
      confirmBtn: overlay.querySelector(".confirm-btn-confirm"),
    };

    // Cerrar al hacer click en overlay
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeConfirm(false);
    });
    els.cancelBtn.addEventListener("click", function () { closeConfirm(false); });
    els.confirmBtn.addEventListener("click", function () { closeConfirm(true); });

    document.addEventListener("keydown", function (e) {
      if (!els.overlay.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeConfirm(false);
      } else if (e.key === "Enter" && document.activeElement !== els.cancelBtn) {
        // Enter confirma si el foco no está en cancelar
      }
    });

    // Botón atrás cierra el modal sin navegar. Debe ejecutarse antes que el handler del carrito,
    // por eso se registra aquí (confirm.js se carga antes que cart.js, así este listener va primero)
    window.addEventListener("popstate", function (e) {
      if (els && els.overlay && els.overlay.classList.contains("is-open")) {
        // Evitar que otros handlers (carrito) también reaccionen a este mismo popstate
        if (e && typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        closeConfirm(false, true);
      } else if (confirmHistoryPushed) {
        confirmHistoryPushed = false;
        if (location.hash === "#confirm") {
          try { history.replaceState(null, "", location.pathname + location.search); } catch {}
        }
      }
    });
    window.addEventListener("hashchange", function () {
      if (els && els.overlay && els.overlay.classList.contains("is-open") && location.hash !== "#confirm") {
        closeConfirm(false, true);
      }
    });
  }

  function openConfirm(opts) {
    opts = opts || {};
    if (!els) createConfirmUI();

    // Configurar contenido
    const title = opts.title || "¿Estás seguro?";
    const message = opts.message || "Esta acción no se puede deshacer.";
    const confirmText = opts.confirmText || "Eliminar";
    const cancelText = opts.cancelText || "Cancelar";
    const icon = opts.icon; // 'trash' | 'heart' | custom svg string
    const variant = opts.variant || "danger"; // danger | default

    els.titleEl.textContent = title;
    els.messageEl.textContent = message;
    els.cancelBtn.textContent = cancelText;
    els.confirmBtn.textContent = confirmText;

    // Icono
    if (icon === "heart") {
      els.iconEl.classList.remove("is-delete");
      els.iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" width="26" height="26"><path d="m480-173.85-30.31-27.38q-97.92-89.46-162-153.15-64.07-63.7-101.15-112.35-37.08-48.65-51.81-88.04Q120-594.15 120-634q0-76.31 51.85-128.15Q223.69-814 300-814q52.77 0 99 27t81 78.54Q514.77-760 561-787q46.23-27 99-27 76.31 0 128.15 51.85Q840-710.31 840-634q0 39.85-14.73 79.23-14.73 39.39-51.81 88.04-37.08 48.65-100.77 112.35Q609-290.69 510.31-201.23L480-173.85Z"/></svg>';
    } else if (icon === "delete" || icon === "trash" || !icon) {
      els.iconEl.classList.add("is-delete");
      els.iconEl.innerHTML = DELETE_SVG;
    } else if (typeof icon === "string" && icon.trim().startsWith("<svg")) {
      els.iconEl.classList.remove("is-delete");
      els.iconEl.innerHTML = icon;
    }

    if (variant === "danger") {
      els.confirmBtn.classList.add("is-danger");
      els.iconEl.style.background = "#fef2f2";
      els.iconEl.style.color = "#f02004";
    } else {
      els.confirmBtn.classList.remove("is-danger");
      els.iconEl.style.background = "#f5f5f5";
      els.iconEl.style.color = "#111";
    }

    lastFocus = document.activeElement;
    els.overlay.classList.add("is-open");
    // Empujar historial para que atrás cierre el modal sin salir de la página
    try {
      if (!confirmHistoryPushed) {
        const base = location.pathname + location.search;
        // Usar #confirm para garantizar entrada distinta (evita deduplicación de pushState con misma URL)
        history.pushState({ cesfaConfirm: true }, "", base + "#confirm");
        confirmHistoryPushed = true;
      }
    } catch {}

    els.overlay.setAttribute("aria-hidden", "false");
    // lock scroll similar a cart
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    // foco en cancelar por seguridad (evita confirmar accidental con Enter)
    setTimeout(function () { if (els.cancelBtn) els.cancelBtn.focus(); }, 50);
  }

  function closeConfirm(result, fromPopState) {
    // fromPopState true cuando viene de popstate/hashchange (botón atrás)
    if (!els || !els.overlay.classList.contains("is-open")) {
      if (fromPopState) {
        confirmHistoryPushed = false;
        if (location.hash === "#confirm") {
          try { history.replaceState(null, "", location.pathname + location.search); } catch {}
        }
      }
      if (activeResolve) {
        const cb = activeResolve;
        activeResolve = null;
        cb(!!result);
      }
      return;
    }
    els.overlay.classList.remove("is-open");
    els.overlay.setAttribute("aria-hidden", "true");
    // desbloquear scroll con delay para respetar animación (0.25s)
    setTimeout(function () {
      // solo desbloquear si no hay otro overlay abierto (cart)
      const cartOpen = document.getElementById("cart-drawer") && document.getElementById("cart-drawer").classList.contains("is-open");
      if (!cartOpen) {
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }
      if (lastFocus && typeof lastFocus.focus === "function") {
        try { lastFocus.focus(); } catch {}
      }
      lastFocus = null;
    }, 260);

    // Manejo de historial: si se cerró manualmente, retroceder para quitar #confirm sin salir de la página
    if (!fromPopState && confirmHistoryPushed) {
      try {
        if (location.hash === "#confirm") {
          confirmHistoryPushed = false;
          history.back();
        } else {
          confirmHistoryPushed = false;
        }
      } catch { confirmHistoryPushed = false; }
    } else if (fromPopState) {
      confirmHistoryPushed = false;
      if (location.hash === "#confirm") {
        try { history.replaceState(null, "", location.pathname + location.search); } catch {}
      }
    }

    if (activeResolve) {
      const cb = activeResolve;
      activeResolve = null;
      // pequeño delay para que animación no se corte por lógica posterior
      setTimeout(function () { cb(!!result); }, 30);
    }
  }

  function showConfirm(opts) {
    createConfirmUI();
    // si ya hay un confirm abierto, cerrar el anterior como cancelado
    if (els.overlay.classList.contains("is-open") && activeResolve) {
      const prev = activeResolve;
      activeResolve = null;
      prev(false);
    }
    return new Promise(function (resolve) {
      activeResolve = resolve;
      openConfirm(opts);
    });
  }

  // Helpers específicos de Cesfa
  function confirmCartClear() {
    const count = (window.Cesfa && typeof window.Cesfa.getCartCount === "function") ? window.Cesfa.getCartCount() : 0;
    const cart = (window.Cesfa && typeof window.Cesfa.getCart === "function") ? window.Cesfa.getCart() : [];
    const n = count || cart.length;
    const msg = n > 1
      ? `¿Deseas vaciar el carrito? Se eliminarán ${n} productos. Esta acción no se puede deshacer.`
      : n === 1
        ? "¿Deseas vaciar el carrito? Se eliminará 1 producto. Esta acción no se puede deshacer."
        : "¿Deseas vaciar el carrito? Esta acción no se puede deshacer.";
    return showConfirm({
      title: "¿Vaciar carrito?",
      message: msg,
      confirmText: "Vaciar",
      cancelText: "Cancelar",
      icon: "delete",
      variant: "danger"
    });
  }

  function confirmFavoriteRemove(productName) {
    const name = productName ? `“${productName}”` : "este producto";
    return showConfirm({
      title: "¿Quitar de favoritos?",
      message: `¿Deseas eliminar ${name} de tus favoritos?`,
      confirmText: "Quitar",
      cancelText: "Cancelar",
      icon: "heart",
      variant: "danger"
    });
  }

  function confirmCartRemove(productName) {
    const name = productName ? `“${productName}”` : "este producto";
    return showConfirm({
      title: "¿Eliminar producto?",
      message: `¿Deseas eliminar ${name} del carrito?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      icon: "delete",
      variant: "danger"
    });
  }

  function init() {
    createConfirmUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.Cesfa = window.Cesfa || {};
  Object.assign(window.Cesfa, {
    showConfirm: showConfirm,
    confirmCartClear: confirmCartClear,
    confirmCartRemove: confirmCartRemove,
    confirmFavoriteRemove: confirmFavoriteRemove,
    _closeConfirm: closeConfirm
  });
})();
