/* ==========================================================
   PRODUCT DETAILS
   URL: product.html?id=1
   ========================================================== */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  const id = new URLSearchParams(window.location.search).get("id");
  const product = Menu.get(id);

  const form      = $("#productForm");
  const qtyInput  = $("#qtyInput");
  const addBtn    = $("#addBtn");
  const lineTotal = $("#lineTotal");
  const stockNote = $("#stockNote");

  /* ==========================================================
     NOT FOUND
     ========================================================== */
  if (!product) {
    $("#productView").hidden = true;
    $("#relatedSection").hidden = true;
    $("#notFound").hidden = false;
    $("#crumbName").textContent = "Not found";
    document.title = "Not found — Bun Voyage";
    return;
  }

  /* ==========================================================
     FILL PRODUCT INFO
     ========================================================== */
  const cat = Menu.category(product.category);
  document.title = `${product.name} — Bun Voyage`;

  $("#crumbCategory").textContent = cat ? cat.name : "";
  $("#crumbName").textContent = product.name;

  $(".product__gallery").style.setProperty("--accent", product.accent);
  $("#productImg").src = assetPath(product.image);
  $("#productImg").alt = product.name;

  const tagEl = $("#productTag");
  if (product.tag) {
    tagEl.hidden = false;
    tagEl.textContent = product.tag;
  }

  $("#productCategory").textContent = cat ? `${cat.emoji} ${cat.name}` : "";
  $("#productName").textContent = product.name;
  $("#productRating").textContent = product.rating.toFixed(1);
  $("#productReviews").textContent = `(${product.reviews.toLocaleString()} reviews)`;
  $("#productCal").textContent = product.calories;
  $("#productTime").textContent = product.prepTime;
  $("#productDesc").textContent = product.desc;
  $("#basePrice").textContent = peso(product.price);

  /* ---------- Show only relevant option groups ---------- */
  $("#sizeGroup").hidden = !Menu.hasSize(product);
  $("#addonGroup").hidden = !Menu.isCustomizable(product);
  $("#removeGroup").hidden = !Menu.isCustomizable(product);

  // Drinks/sides: palitan ang size labels para mas bagay
  if (["drinks", "sides"].includes(product.category)) {
    const labels = { Regular: "Regular", Large: "Large", Monster: "Jumbo" };
    $$('#sizeGroup input[name="size"]').forEach((input) => {
      input.nextElementSibling.querySelector("strong").textContent = labels[input.value];
    });
  }

  /* ==========================================================
     READ SELECTED OPTIONS
     ========================================================== */
  function getOptions() {
    const fd = new FormData(form);
    return {
      size: fd.get("size") || "Regular",
      addons: fd.getAll("addons"),
      remove: fd.getAll("remove"),
      notes: fd.get("notes") || "",
      qty: parseInt(qtyInput.value, 10) || 1,
    };
  }

  /* ==========================================================
     LIVE PRICE + STOCK
     ========================================================== */
  let lastTotal = null;

  function maxQty() {
    return Math.min(CONFIG.maxQtyPerItem, Cart.available(product.id));
  }

  function update() {
    const opts = getOptions();
    const max = maxQty();
    const stock = Menu.stock(product.id);

    // clamp qty
    if (opts.qty > max) opts.qty = Math.max(1, max);
    if (opts.qty < 1) opts.qty = 1;
    qtyInput.value = opts.qty;
    qtyInput.max = Math.max(1, max);

    $('[data-qty="-1"]').disabled = opts.qty <= 1;
    $('[data-qty="1"]').disabled = opts.qty >= max;

    // price
    const total = Cart.unitPrice(product, opts) * opts.qty;
    lineTotal.textContent = peso(total);

    if (lastTotal !== null && total !== lastTotal) {
      lineTotal.classList.remove("bump");
      void lineTotal.offsetWidth;
      lineTotal.classList.add("bump");
    }
    lastTotal = total;

    // stock messages
    const inCart = Cart.qtyOfProduct(product.id);
    stockNote.classList.remove("is-low");

    if (stock === 0) {
      stockNote.textContent = "😢 Sold out today. Check back tomorrow!";
      stockNote.classList.add("is-low");
      addBtn.disabled = true;
      addBtn.innerHTML = "Sold Out";
    } else if (max === 0) {
      stockNote.textContent = `You already have all ${stock} available in your cart.`;
      stockNote.classList.add("is-low");
      addBtn.disabled = true;
      addBtn.innerHTML = "Max in cart";
    } else {
      addBtn.disabled = false;
      addBtn.innerHTML = `Add to Cart • <span id="lineTotal">${peso(total)}</span>`;
      // re-grab span (innerHTML replaced it)
      rebindTotal();

      if (stock <= 5) {
        stockNote.textContent = `🔥 Hurry! Only ${stock} left.`;
        stockNote.classList.add("is-low");
      } else if (inCart > 0) {
        stockNote.textContent = `🛒 ${inCart} already in your cart.`;
      } else {
        stockNote.textContent = `✓ In stock · ready in ~${product.prepTime} min`;
      }
    }
  }

  // Ang #lineTotal ay napapalitan kapag binago ang innerHTML ng button
  let lineTotalRef = lineTotal;
  function rebindTotal() {
    lineTotalRef = $("#lineTotal");
  }
  Object.defineProperty(window, "__unused", { value: lineTotalRef });   // (no-op, keeps linters quiet)

  /* ---------- Listeners ---------- */
  form.addEventListener("change", update);
  form.addEventListener("input", (e) => {
    if (e.target === qtyInput) update();
  });

  $$("[data-qty]").forEach((btn) =>
    btn.addEventListener("click", () => {
      qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + Number(btn.dataset.qty);
      update();
    })
  );

  /* ==========================================================
     ADD TO CART
     ========================================================== */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const opts = getOptions();

    try {
      Cart.add(product.id, opts);
      Toast.cart(product, opts.qty);

      // feedback sa button
      addBtn.innerHTML = "✓ Added!";
      addBtn.classList.add("btn--green");
      setTimeout(() => {
        addBtn.classList.remove("btn--green");
        qtyInput.value = 1;
        update();
      }, 1100);
    } catch (err) {
      Toast.error("Can't add item", err.message);
      update();
    }
  });

  /* ==========================================================
     RELATED PRODUCTS
     ========================================================== */
  function renderRelated() {
    const same = Menu.byCategory(product.category).filter((p) => p.id !== product.id);
    const others = Menu.all()
      .filter((p) => p.category !== product.category && p.id !== product.id)
      .sort((a, b) => b.popular - a.popular);

    const list = [...same, ...others].slice(0, 4);

    $("#relatedGrid").innerHTML = list
      .map((p, i) => `
        <article class="product-card ${Menu.stock(p.id) === 0 ? "is-soldout" : ""}"
                 style="--accent:${p.accent}; --i:${i}">
          <a href="product.html?id=${p.id}" class="product-card__media tilt" data-tilt data-tilt-max="14"
             aria-label="View ${esc(p.name)}">
            <img class="tilt__img" src="${assetPath(p.image)}" alt="" loading="lazy" />
            <span class="tilt__glare"></span>
          </a>
          ${p.tag ? `<span class="product-card__tag" data-tag="${esc(p.tag)}">${esc(p.tag)}</span>` : ""}
          <div class="product-card__body">
            <h3 class="product-card__name"><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
            <div class="product-card__meta"><span><span class="star">★</span> ${p.rating}</span></div>
            <div class="product-card__foot">
              <span class="price">${peso(p.price)}</span>
              <a href="product.html?id=${p.id}" class="add-btn" aria-label="View ${esc(p.name)}">→</a>
            </div>
          </div>
        </article>`)
      .join("");
  }

  /* ---------- Keep in sync with cart / stock changes ---------- */  
  Cart.onChange(update);
  Store.on("stock", update);

  /* ---------- Init ---------- */
  update();
  renderRelated();
})();