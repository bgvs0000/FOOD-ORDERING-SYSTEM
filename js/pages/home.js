/* ==========================================================
   HOME — menu page
   - greeting
   - category chips
   - search (with highlight) + sort
   - product grid + quick add
   Kapag may error, ipinapakita ito sa page (hindi lang skeleton).
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  const grid     = $("#productGrid");
  const chipsEl  = $("#categoryChips");
  const searchEl = $("#searchInput");
  const sortEl   = $("#sortSelect");
  const titleEl  = $("#gridTitle");
  const countEl  = $("#gridCount");
  const emptyEl  = $("#emptyState");

  /* ---------- Error box: ipinapakita kung bakit hindi lumalabas ang menu ---------- */
  function showError(message) {
    console.error("[home.js]", message);
    if (!grid) return;
    grid.hidden = false;
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; border-color: var(--red, red);">
        <h3 style="color: var(--red, red);">Menu failed to load</h3>
        <p><strong>Error:</strong> ${String(message).replace(/</g, "&lt;")}</p>
        <p>Pindutin ang F12 → Console para sa detalye.</p>
      </div>`;
  }

  /* ---------- Check: naka-load ba lahat ng kailangang files? ---------- */
  const missing = [];
  if (typeof PRODUCTS === "undefined" || typeof Menu === "undefined") missing.push("js/data/products.js");
  if (typeof Store === "undefined") missing.push("js/core/storage.js");
  if (typeof Auth === "undefined")  missing.push("js/core/auth.js");
  if (typeof Cart === "undefined")  missing.push("js/core/cart.js");
  if (typeof Toast === "undefined") missing.push("js/ui/toast.js");

  if (!grid || !chipsEl || !searchEl || !sortEl) {
    showError("Kulang ang HTML elements (#productGrid, #categoryChips, #searchInput o #sortSelect). Gamitin ang buong app/home.html.");
    return;
  }
  if (missing.length) {
    showError("Hindi na-load o may error ang: " + missing.join(", ") + ". I-check ang file name, folder, at <script> tag.");
    return;
  }

  /* ---------- State ---------- */
  const params = new URLSearchParams(window.location.search);
  const state = {
    category: CATEGORIES.some((c) => c.id === params.get("cat")) ? params.get("cat") : "all",
    search: params.get("q") || "",
    sort: "popular",
  };

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  /** Escape muna, saka lagyan ng <mark> ang match (safe highlight) */
  function highlight(text, query) {
    const safe = esc(text);
    if (!query) return safe;
    const q = esc(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return safe.replace(new RegExp(`(${q})`, "gi"), "<mark>$1</mark>");
  }

  /* ==========================================================
     GREETING
     ========================================================== */
  const user = Auth.current();
  const nameEl = $("#userFirstName");
  if (user && nameEl) nameEl.textContent = Auth.firstName(user.name);

  /* ==========================================================
     CATEGORY CHIPS
     ========================================================== */
  function renderChips() {
    chipsEl.innerHTML = CATEGORIES.map((c) => {
      const count = Menu.byCategory(c.id).length;
      const active = c.id === state.category;
      return `
        <button class="chip ${active ? "is-active" : ""}" type="button" data-cat="${c.id}" aria-pressed="${active}">
          ${c.emoji} ${esc(c.name)} <span class="chip__count">${count}</span>
        </button>`;
    }).join("");
  }

  chipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cat]");
    if (!chip) return;
    state.category = chip.dataset.cat;
    renderChips();
    renderGrid();
    syncUrl();
    const active = chipsEl.querySelector(".chip.is-active");
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  });

  /* ==========================================================
     FILTER + SORT
     ========================================================== */
  function getProducts() {
    const q = state.search.trim().toLowerCase();

    let list = Menu.byCategory(state.category).filter((p) => {
      if (!q) return true;
      const cat = Menu.category(p.category);
      return (
        p.name.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        (cat && cat.name.toLowerCase().includes(q)) ||
        (p.tag && p.tag.toLowerCase().includes(q))
      );
    });

    const sorters = {
      popular:      (a, b) => b.popular - a.popular,
      "price-asc":  (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      rating:       (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    };
    list = [...list].sort(sorters[state.sort] || sorters.popular);

    // sold-out items sa dulo
    return list.sort((a, b) => (Menu.stock(a.id) === 0) - (Menu.stock(b.id) === 0));
  }

  /* ==========================================================
     PRODUCT CARD
     ========================================================== */
  function card(p, i) {
    const stock = Menu.stock(p.id);
    const left = Cart.available(p.id);
    const soldOut = stock === 0;
    const cat = Menu.category(p.category);
    const q = state.search.trim();

    const stockNote = !soldOut && stock <= 5
      ? `<span class="product-card__stock">Only ${stock} left!</span>`
      : "";

    return `
      <article class="product-card ${soldOut ? "is-soldout" : ""}" style="--accent:${p.accent}; --i:${i}">
        <a href="product.html?id=${p.id}" class="product-card__media tilt" data-tilt data-tilt-max="14"
           aria-label="View ${esc(p.name)}">
          <img class="tilt__img" src="${assetPath(p.image)}" alt="" loading="lazy" />
          <span class="tilt__glare"></span>
        </a>
        ${p.tag ? `<span class="product-card__tag" data-tag="${esc(p.tag)}">${esc(p.tag)}</span>` : ""}

        <div class="product-card__body">
          <span class="product-card__cat">${cat ? cat.emoji + " " + esc(cat.name) : ""}</span>
          <h3 class="product-card__name">
            <a href="product.html?id=${p.id}">${highlight(p.name, q)}</a>
          </h3>
          <p class="product-card__desc">${highlight(p.desc, q)}</p>
          <div class="product-card__meta">
            <span><span class="star">★</span> ${p.rating} (${Number(p.reviews || 0).toLocaleString()})</span>
            <span>⏱ ${p.prepTime}m</span>
          </div>
          ${stockNote}
          <div class="product-card__foot">
            <span class="price">${peso(p.price)}</span>
            <button class="add-btn" type="button" data-add="${p.id}"
                    aria-label="Add ${esc(p.name)} to cart"
                    ${soldOut || left === 0 ? "disabled" : ""}>+</button>
          </div>
        </div>
      </article>`;
  }

  /* ==========================================================
     RENDER GRID
     ========================================================== */
  function renderGrid() {
    try {
      const list = getProducts();
      const cat = Menu.category(state.category);

      titleEl.textContent = state.search
        ? `Results for “${state.search}”`
        : state.category === "all" ? "All Items" : cat.name;
      countEl.textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;

      if (emptyEl) emptyEl.hidden = list.length > 0;
      grid.hidden = list.length === 0;
      grid.innerHTML = list.map(card).join("");
    } catch (err) {
      showError(err.message);
    }
  }

  /* ==========================================================
     QUICK ADD (+)
     ========================================================== */
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add]");
    if (!btn) return;

    try {
      const { product } = Cart.add(btn.dataset.add, { qty: 1 });
      if (typeof Toast.cart === "function") Toast.cart(product, 1);
      else Toast.success("Added to cart!", product.name);

      btn.classList.remove("anim-bounce");
      void btn.offsetWidth;
      btn.classList.add("anim-bounce");

      if (Cart.available(product.id) === 0) btn.disabled = true;
    } catch (err) {
      Toast.error("Can't add item", err.message);
    }
  });

  /* ==========================================================
     SEARCH (debounced) + SORT
     ========================================================== */
  let searchTimer;
  searchEl.value = state.search;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = searchEl.value;
      renderGrid();
      syncUrl();
    }, 200);
  });

  searchEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && searchEl.value) {
      searchEl.value = "";
      state.search = "";
      renderGrid();
      syncUrl();
    }
  });

  // "/" = focus search
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement.tagName;
    if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      searchEl.focus();
    }
  });

  sortEl.addEventListener("change", () => {
    state.sort = sortEl.value;
    renderGrid();
  });

  /* ---------- Clear filters (empty state button) ---------- */
  $("#clearFilters")?.addEventListener("click", () => {
    state.category = "all";
    state.search = "";
    searchEl.value = "";
    renderChips();
    renderGrid();
    syncUrl();
  });

  /* ---------- Keep filters in the URL ---------- */
  function syncUrl() {
    const p = new URLSearchParams();
    if (state.category !== "all") p.set("cat", state.category);
    if (state.search.trim()) p.set("q", state.search.trim());
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  /* ---------- Re-render when stock changes ---------- */
  Store.on("stock", renderGrid);

  /* ---------- Init ---------- */
  try {
    renderChips();
  } catch (err) {
    showError(err.message);
    return;
  }
  setTimeout(renderGrid, 300);   // sandaling skeleton para mukhang galing sa API
})();