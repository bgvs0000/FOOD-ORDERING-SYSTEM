/* ==========================================================
   ADMIN PRODUCTS — menu manager
   Table · inline stock · visibility · add/edit modal · delete
   ========================================================== */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  const state = { search: "", category: "all", stock: "all" };

  const tbody = $("#productsTableBody");
  const form  = $("#productForm");

  /* ---------- Sold count (completed orders) ---------- */
  function soldMap() {
    const map = {};
    Orders.everything()
      .filter((o) => o.status === "COMPLETED")
      .forEach((o) => o.items.forEach((i) => { map[i.productId] = (map[i.productId] || 0) + i.qty; }));
    return map;
  }

  /* ==========================================================
     STATS + CHIPS
     ========================================================== */
  function renderStats() {
    const all = Menu.raw();
    const stocks = all.map((p) => Menu.rawStock(p.id));
    $("#statTotal").textContent = all.length;
    $("#statAvailable").textContent = all.filter((p, i) => p.available !== false && stocks[i] > 0).length;
    $("#statLow").textContent = stocks.filter((s) => s > 0 && s <= CONFIG.lowStockAt).length;
    $("#statOut").textContent = stocks.filter((s) => s === 0).length;
    $("#productCountText").textContent = `${all.length} products`;
  }

  function renderChips() {
    $("#productCats").innerHTML = CATEGORIES.map((c) => {
      const n = c.id === "all" ? Menu.raw().length : Menu.raw().filter((p) => p.category === c.id).length;
      return `<button class="chip ${c.id === state.category ? "is-active" : ""}" type="button" data-cat="${c.id}">
                ${c.emoji} ${esc(c.name)} <span class="chip__count">${n}</span>
              </button>`;
    }).join("");
  }

  $("#productCats").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cat]");
    if (!chip) return;
    state.category = chip.dataset.cat;
    renderChips();
    renderTable();
  });

  /* ==========================================================
     TABLE
     ========================================================== */
  function filtered() {
    const q = state.search.trim().toLowerCase();
    return Menu.raw().filter((p) => {
      const stock = Menu.rawStock(p.id);
      if (state.category !== "all" && p.category !== state.category) return false;
      if (state.stock === "low" && !(stock > 0 && stock <= CONFIG.lowStockAt)) return false;
      if (state.stock === "out" && stock !== 0) return false;
      if (state.stock === "hidden" && p.available !== false) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.tag || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function renderTable() {
    const sold = soldMap();
    const list = filtered();
    $("#noProducts").hidden = list.length > 0;

    tbody.innerHTML = list.map((p) => {
      const stock = Menu.rawStock(p.id);
      const cat = Menu.category(p.category);
      const hidden = p.available === false;
      const stockClass = stock === 0 ? "is-out" : stock <= CONFIG.lowStockAt ? "is-low" : "";

      return `
        <tr class="${hidden ? "is-hidden-row" : ""}" data-id="${p.id}">
          <td>
            <div class="cell-product" style="--c:${p.accent}">
              <img src="${assetPath(p.image)}" alt="" />
              <div>
                <strong>${esc(p.name)}</strong>
                <small>${p.tag ? esc(p.tag) + " · " : ""}${p.featured ? "⭐ Featured" : "#" + p.id}</small>
              </div>
            </div>
          </td>
          <td>${cat ? cat.emoji + " " + esc(cat.name) : esc(p.category)}</td>
          <td class="cell-strong">${peso(p.price)}</td>
          <td>
            <div class="stock-stepper" role="group" aria-label="Stock for ${esc(p.name)}">
              <button type="button" data-stock="-1" aria-label="Decrease stock">−</button>
              <input type="number" min="0" value="${stock}" data-stock-input aria-label="Stock" />
              <button type="button" data-stock="1" aria-label="Increase stock">+</button>
            </div>
            ${stockClass ? `<span class="stock-pill ${stockClass}">${stock === 0 ? "Out" : "Low"}</span>` : ""}
          </td>
          <td>${sold[p.id] || 0}</td>
          <td>
            <label class="switch" title="${hidden ? "Hidden from menu" : "Visible in menu"}">
              <input type="checkbox" data-visible ${hidden ? "" : "checked"} aria-label="Visible in menu" />
              <span></span>
            </label>
          </td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" type="button" data-action="edit" aria-label="Edit ${esc(p.name)}">✏️</button>
              <button class="icon-btn" type="button" data-action="delete" aria-label="Delete ${esc(p.name)}">🗑</button>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  function renderAll() {
    renderStats();
    renderChips();
    renderTable();
  }

  /* ---------- Row actions ---------- */
  tbody.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const id = Number(row.dataset.id);
    const product = Menu.get(id);

    // stock − / +
    const step = e.target.closest("[data-stock]");
    if (step) {
      Menu.setStock(id, Menu.rawStock(id) + Number(step.dataset.stock));
      return;
    }

    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "edit") openEditor(product);

    if (action === "delete") {
      const ok = await Modal.confirm({
        title: `Delete ${product.name}?`,
        text: "It will disappear from the menu. Past orders keep their saved prices.",
        icon: "🗑",
        okText: "Delete",
      });
      if (!ok) return;
      Menu.remove(id);
      Toast.info("Product deleted", product.name);
    }
  });

  // type a stock number directly
  tbody.addEventListener("change", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const id = Number(row.dataset.id);

    if (e.target.matches("[data-stock-input]")) {
      Menu.setStock(id, e.target.value);
      Toast.success("Stock updated", `${Menu.get(id).name}: ${Menu.rawStock(id)}`);
    }
    if (e.target.matches("[data-visible]")) {
      Menu.setAvailable(id, e.target.checked);
      Toast.info(e.target.checked ? "Now visible in menu" : "Hidden from menu", Menu.get(id).name);
    }
  });

  /* ==========================================================
     ADD / EDIT MODAL
     ========================================================== */
  // category options (walang "all")
  form.elements.category.innerHTML = CATEGORIES.filter((c) => c.id !== "all")
    .map((c) => `<option value="${c.id}">${c.emoji} ${esc(c.name)}</option>`).join("");

  function openEditor(product = null) {
    form.reset();
    clearErrors();
    const el = form.elements;
    $("#pmTitle").textContent = product ? `Edit ${product.name}` : "Add product";

    el.id.value       = product ? product.id : "";
    el.name.value     = product ? product.name : "";
    el.category.value = product ? product.category : "burgers";
    el.tag.value      = product && product.tag ? product.tag : "";
    el.price.value    = product ? product.price : "";
    el.stock.value    = product ? Menu.rawStock(product.id) : 20;
    el.prepTime.value = product ? product.prepTime : 10;
    el.image.value    = product ? product.image : "burger-classic.svg";
    el.accent.value   = product ? product.accent : "#FFC233";
    el.desc.value     = product ? product.desc : "";
    el.calories.value = product ? product.calories : "";
    el.featured.checked  = product ? !!product.featured : false;
    el.available.checked = product ? product.available !== false : true;

    updatePreview();
    Modal.open("productModal", { focus: "#pfName" });
  }

  $("#addProductBtn").addEventListener("click", () => openEditor());

  /* ---------- Live preview (same card as customer menu) ---------- */
  function updatePreview() {
    const el = form.elements;
    const cat = Menu.category(el.category.value);
    const name = el.name.value.trim() || "New product";
    const tag = el.tag.value;
    $("#pfDescCount").textContent = el.desc.value.length;

    $$(".swatch").forEach((s) => s.classList.toggle("is-active", s.dataset.color.toLowerCase() === el.accent.value.toLowerCase()));

    $("#pfPreview").innerHTML = `
      <article class="product-card" style="--accent:${el.accent.value}">
        <div class="product-card__media"><img src="${assetPath(el.image.value)}" alt="" /></div>
        ${tag ? `<span class="product-card__tag" data-tag="${esc(tag)}">${esc(tag)}</span>` : ""}
        <div class="product-card__body">
          <span class="product-card__cat">${cat ? cat.emoji + " " + esc(cat.name) : ""}</span>
          <h3 class="product-card__name">${esc(name)}</h3>
          <p class="product-card__desc">${esc(el.desc.value || "Your description will appear here.")}</p>
          <div class="product-card__foot">
            <span class="price">${peso(el.price.value || 0)}</span>
            <span class="add-btn" aria-hidden="true">+</span>
          </div>
        </div>
      </article>`;
  }

  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);

  $("#pfSwatches").addEventListener("click", (e) => {
    const s = e.target.closest(".swatch");
    if (!s) return;
    form.elements.accent.value = s.dataset.color;
    updatePreview();
  });

  /* ---------- Validation + save ---------- */
  function setFieldError(name, message) {
    const field = form.elements[name].closest(".field");
    field.classList.add("has-error");
    $(".field__error", field).textContent = message;
  }

  function clearErrors() {
    $$(".field", form).forEach((f) => {
      f.classList.remove("has-error");
      const s = $(".field__error", f);
      if (s) s.textContent = "";
    });
    $(".form-error", form).textContent = "";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors();
    const el = form.elements;
    let bad = null;

    if (el.name.value.trim().length < 2) { setFieldError("name", "Name is required."); bad = bad || el.name; }
    if (!(Number(el.price.value) > 0))   { setFieldError("price", "Enter a price."); bad = bad || el.price; }
    if (el.stock.value === "" || Number(el.stock.value) < 0) { setFieldError("stock", "0 or more."); bad = bad || el.stock; }
    if (bad) { bad.focus(); return; }

    const existing = el.id.value ? Menu.get(el.id.value) : null;
    const saved = Menu.save({
      ...(existing || {}),
      id: el.id.value ? Number(el.id.value) : null,
      name: el.name.value.trim(),
      category: el.category.value,
      tag: el.tag.value || null,
      price: Number(el.price.value),
      stock: Number(el.stock.value),
      prepTime: Number(el.prepTime.value) || 10,
      image: el.image.value,
      accent: el.accent.value,
      desc: el.desc.value.trim() || "Freshly made at Bun Voyage.",
      calories: Number(el.calories.value) || 0,
      featured: el.featured.checked,
      available: el.available.checked,
    });

    Modal.close("productModal");
    Toast.success(existing ? "Product updated" : "Product added", saved.name);
  });

  /* ==========================================================
     TOOLBAR + RESET
     ========================================================== */
  let t;
  $("#productSearch").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.search = e.target.value;
      renderTable();
    }, 200);
  });

  $("#stockFilter").addEventListener("change", (e) => {
    state.stock = e.target.value;
    renderTable();
  });

  $("#resetMenuBtn").addEventListener("click", async () => {
    const ok = await Modal.confirm({
      title: "Reset the menu?",
      text: "All products, prices, and stock go back to the original 18 items.",
      icon: "↺",
      okText: "Reset menu",
    });
    if (!ok) return;
    Menu.reset();
    Toast.success("Menu reset", "Back to the default 18 products.");
  });

  /* ---------- Live updates ---------- */
  Store.on("*", (_v, key) => {
    if (key === "*" || key === "products" || key === "stock" || key === "orders") renderAll();
  });

  renderAll();
})();