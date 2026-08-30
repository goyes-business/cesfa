/**
 * search.js — Helpers compartidos para el buscador de productos
 * - Normaliza acentos/mayusculas (NFD)
 * - Separa la busqueda en palabras y exige que TODAS esten presentes (AND)
 * - Considera columnas: SKU + CATEGORY + NAME + COLOR + SIZE + WEIGHT
 */
(function () {
  function normalize(str) {
    return String(str == null ? "" : str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  function tokenize(query) {
    var n = normalize(query).trim();
    if (!n) return [];
    return n.split(/\s+/).filter(Boolean);
  }
  function haystack(p) {
    if (!p) return "";
    if (typeof p._searchHaystack === "string") return p._searchHaystack;
    var raw = [
      p.sku,
      p.category,
      p.name,
      p.color,
      p.size,
      p.weight
    ].map(function (v) { return v == null ? "" : String(v); }).join(" ");
    var n = normalize(raw);
    try {
      Object.defineProperty(p, "_searchHaystack", { value: n, writable: true, enumerable: false, configurable: true });
    } catch (_e) { p._searchHaystack = n; }
    return n;
  }
  function matches(p, terms) {
    if (!terms || terms.length === 0) return true;
    var h = haystack(p);
    for (var i = 0; i < terms.length; i++) { if (h.indexOf(terms[i]) === -1) return false; }
    return true;
  }
  function filterProducts(products, query) {
    var terms = tokenize(query);
    if (terms.length === 0) return { terms: terms, filtered: products.slice() };
    var out = [];
    for (var i = 0; i < products.length; i++) { if (matches(products[i], terms)) out.push(products[i]); }
    return { terms: terms, filtered: out };
  }
  function ensureSearchDOM(opts) {
    opts = opts || {};
    var existing = document.getElementById(opts.id || "cesfa-search");
    if (existing) {
      return { section: existing.closest(".cesfa-search"), input: existing, clearBtn: document.getElementById("cesfa-search-clear"), countEl: document.getElementById("cesfa-search-count") };
    }
    var banner = document.getElementById("banner");
    if (!banner) return null;
    var section = document.createElement("section");
    section.className = "cesfa-search";
    section.setAttribute("role", "search");
    section.setAttribute("aria-label", "Buscar productos");
    var wrap = document.createElement("div");
    wrap.className = "cesfa-search__wrap";
    var field = document.createElement("div");
    field.className = "cesfa-search__field";
    var iconWrap = document.createElement("span");
    iconWrap.className = "cesfa-search__icon";
    iconWrap.setAttribute("aria-hidden", "true");
    iconWrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    var label = document.createElement("label");
    label.className = "sr-only";
    label.setAttribute("for", "cesfa-search");
    label.textContent = "Buscar productos";
    var input = document.createElement("input");
    input.id = "cesfa-search";
    input.className = "cesfa-search__input";
    input.type = "search";
    input.placeholder = opts.placeholder || "Buscar por nombre, categoría, código, color...";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Buscar productos");
    var clearBtn = document.createElement("button");
    clearBtn.id = "cesfa-search-clear";
    clearBtn.className = "cesfa-search__clear";
    clearBtn.type = "button";
    clearBtn.setAttribute("aria-label", "Limpiar busqueda");
    clearBtn.hidden = true;
    clearBtn.textContent = "×";
    field.appendChild(iconWrap);
    field.appendChild(input);
    field.appendChild(clearBtn);
    wrap.appendChild(label);
    wrap.appendChild(field);
    var countEl = document.createElement("p");
    countEl.id = "cesfa-search-count";
    countEl.className = "cesfa-search__count";
    countEl.setAttribute("aria-live", "polite");
    countEl.hidden = true;
    section.appendChild(wrap);
    section.appendChild(countEl);
    banner.insertAdjacentElement("afterend", section);
    return { section: section, input: input, clearBtn: clearBtn, countEl: countEl };
  }
  window.Cesfa = window.Cesfa || {};
  window.Cesfa.searchNormalize = normalize;
  window.Cesfa.searchTokenize = tokenize;
  window.Cesfa.searchHaystack = haystack;
  window.Cesfa.searchMatches = matches;
  window.Cesfa.searchFilter = filterProducts;
  window.Cesfa.ensureSearchDOM = ensureSearchDOM;
})();
