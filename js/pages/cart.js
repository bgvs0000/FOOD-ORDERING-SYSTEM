/* ==========================================================
   CART PAGE
   ========================================================== */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  const listEl      = $("#cartList");
  const layoutEl    = $("#cartLayout");
  const emptyEl     = $("#emptyCart");
  const clearBtn    = $("#clearCartBtn");
  const countText   = $("#cartCountText");
  const promoForm   = $("#promoForm");
  const promoInput  = $("#promoInput");
  const promoMsg    = $("#promoMsg");
  const checkoutBtn = $("#checkoutBtn");
  const mobileBar   = $("#mobileCheckout");

  let firstRender = true;

  /* ==========================================================
     CART ITEMS
     ========================================================== */
  function itemHTML(item, i) {
    const max = Math.min(CONFIG.maxQtyPerItem, item.qty + Cart.available(item.productId));
    return `
      <li class="cart-item" data-key="${esc(item.key)}"
          style="--accent:${item.product.accent}; --i:${i}; ${firstRender ? "" : "animation:none"}">
        <a href="product.html?id=${item.productId}" class="cart-item__img" aria-label="View ${esc(item.product.name)}">
          <img src="${assetPath(item.product.image)}" alt="" />
        </a>

        <div class="cart-item__info">
          <a href="product.html?id=${item.productId}" class="cart-item__name">${esc(item.product.name)}</a>
          ${item.description ? `<p class="cart-item__opts">${esc(item.description)}</p>` : ""}
          ${item.notes ? `<p class="cart-item__note">“${esc(item.notes)}”</p>` : ""}
          <span class="cart-item__unit">${peso(item.unitPrice)} each</span>
        </div>

        <div class="qty qty--sm" role="group" aria-label="Quantity for ${esc(item.product.name)}">
          <button type="button" class="qty__btn" data-action="dec" aria-label="Decrease">${item.qty === 1 ? "🗑" : "−"}</button>
          <span class="qty__value" aria-live="polite">${item.qty}</span>
          <button type="button" class="qty__btn" data-action="inc" aria-label="Increase" ${item.qty >= max ? "disabled" : ""}>+</button>
        </div>

        <strong class="cart-item__total">${peso(item.lineTotal)}</strong>

        <button type="button" class="cart-item__remove icon-btn icon-btn--sm" data-action="remove"
                aria-label="Remove ${esc(item.product.name)}">✕</button>
      </li>`;
  }

  /* ==========================================================
     UPSELL — sides & drinks na wala pa sa cart
     ========================================================== */
  function renderUpsell(items) {
    const inCart = new Set(items.map((i) => i.productId));
    const picks = Menu.all()
      .filter((p) => ["sides", "drinks"].includes(p.category))
      .filter((p) => !inCart.has(p.id) && Cart.available(p.id) > 0)
      .sort((a, b) => b.popular - a.popular)
      .slice(0, 3);

    $("#upsell").hidden = picks.length === 0 || items.length === 0;

    $("#upsellGrid").innerHTML = picks.map((p) => `
      <div class="upsell-card">
        <img src="${assetPath(p.image)}" alt="" />
        <div>
          <strong>${esc(p.name)}</strong>
          <small>${peso(p.price)}</small>
        </div>
        <button type="button" class="add-btn" data-upsell="${p.id}" aria-label="Add ${esc(p.name)}"><span>+</span></button>
      </div>`).join("");
  }

  /* ==========================================================
     SUMMARY
     ========================================================== */
  function renderSummary(t) {
    $("#sumSubtotal").textContent = peso(t.subtotal);
    $("#sumDelivery").textContent = t.delivery === 0 && t.subtotal > 0 ? "FREE" : peso(t.delivery);
    $("#sumTotal").textContent = peso(t.total);
    $("#mobileTotal").textContent = peso(t.total);

    // discount row
    const row = $("#discountRow");
    row.hidden = !t.promo;
    if (t.promo) {
      $("#discountCode").textContent = t.promo.code;
      $("#sumDiscount").textContent =
        t.promo.type === "freeship" ? "Free delivery" : "−" + peso(t.discount);
    }

    // promo message
    if (t.promo) {
      showPromoMsg(`✓ ${t.promo.code} applied: ${t.promo.label}`, "success", true);
    } else if (t.promoInvalid) {
      showPromoMsg(`${t.promoInvalid.code} needs a minimum of ${peso(t.promoInvalid.minSpend)}.`, "error");
    }

    // free delivery progress
    const fd = $("#freeDelivery");
    const unlocked = t.freeDeliveryLeft === 0;
    fd.classList.toggle("is-unlocked", unlocked);
    $("#freeDeliveryBar").style.width = t.freeDeliveryProgress + "%";
    $("#freeDeliveryText").innerHTML = unlocked
      ? `🎉 You unlocked <strong>FREE delivery</strong>!`
      : `Add <strong>${peso(t.freeDeliveryLeft)}</strong> more for <strong>FREE delivery</strong> 🛵`;
  }

  function showPromoMsg(text, type, withRemove = false) {
    promoMsg.className = `promo__msg is-${type}`;
    promoMsg.innerHTML = esc(text) + (withRemove ? ` <button type="button" class="link" id="removePromo">Remove</button>` : "");
  }

  /* ==========================================================
     RENDER ALL
     ========================================================== */
  function render() {
    const t = Cart.totals();
    const empty = t.items.length === 0;

    layoutEl.hidden = empty;
    emptyEl.hidden = !empty;
    clearBtn.hidden = empty;
    mobileBar.hidden = empty;
    checkoutBtn.classList.toggle("is-disabled", empty);

    countText.textContent = `${t.count} item${t.count === 1 ? "" : "s"}`;

    if (!empty) {
      listEl.innerHTML = t.items.map(itemHTML).join("");
      renderSummary(t);
      renderUpsell(t.items);
    }

    firstRender = false;
  }

  /* ==========================================================
     ITEM ACTIONS (qty − / + / remove)
     ========================================================== */
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const li = btn.closest(".cart-item");
    const key = li.dataset.key;
    const action = btn.dataset.action;
    const qty = parseInt($(".qty__value", li).textContent, 10);

    // remove (o − kapag 1 na lang) → slide out muna bago burahin
    if (action === "remove" || (action === "dec" && qty === 1)) {
      const name = $(".cart-item__name", li).textContent;
      li.classList.add("is-removing");
      li.addEventListener("animationend", () => {
        Cart.remove(key);
        Toast.info("Removed from cart", name);
      }, { once: true });
      // fallback (reduce motion)
      setTimeout(() => { if (li.isConnected) Cart.remove(key); }, 450);
      return;
    }

    try {
      Cart.increment(key, action === "inc" ? 1 : -1);
    } catch (err) {
      Toast.warning("Stock limit", err.message);
    }
  });

  /* ---------- Upsell add ---------- */
  $("#upsellGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-upsell]");
    if (!btn) return;
    try {
      const { product } = Cart.add(btn.dataset.upsell, { qty: 1 });
      btn.closest(".upsell-card").classList.add("is-added");
      Toast.cart(product, 1);
    } catch (err) {
      Toast.error("Can't add item", err.message);
    }
  });

  /* ==========================================================
     PROMO CODE
     ========================================================== */
  promoForm.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const promo = Cart.applyPromo(promoInput.value);
      promoInput.value = "";
      Toast.success("Promo applied!", promo.label);
    } catch (err) {
      showPromoMsg(err.message, "error");
      promoInput.closest(".promo").classList.remove("anim-shake");
      void promoInput.offsetWidth;
      promoInput.closest(".promo").classList.add("anim-shake");
    }
  });

  promoMsg.addEventListener("click", (e) => {
    if (e.target.id === "removePromo") {
      Cart.removePromo();
      promoMsg.className = "promo__msg";
      promoMsg.textContent = "";
      Toast.info("Promo removed");
    }
  });

  /* ==========================================================
     CLEAR CART — "tap twice" confirm (walang modal sa page na ito)
     ========================================================== */
  let clearArmed = false;
  let clearTimer;
  clearBtn.addEventListener("click", () => {
    if (!clearArmed) {
      clearArmed = true;
      clearBtn.textContent = "⚠️ Tap again to clear";
      clearBtn.classList.add("btn--primary");
      clearTimer = setTimeout(resetClear, 2500);
      return;
    }
    clearTimeout(clearTimer);
    resetClear();
    Cart.clear();
    Toast.info("Cart cleared");
  });

  function resetClear() {
    clearArmed = false;
    clearBtn.textContent = "🗑 Clear cart";
    clearBtn.classList.remove("btn--primary");
  }

  /* ---------- Block checkout when empty ---------- */
  [checkoutBtn, $("a", mobileBar)].forEach((a) =>
    a?.addEventListener("click", (e) => {
      if (Cart.isEmpty()) {
        e.preventDefault();
        Toast.warning("Your cart is empty", "Add something tasty first!");
      }
    })
  );

  /* ---------- Live updates (cart, promo, stock — kahit sa ibang tab) ---------- */
  Store.on("*", (_v, key) => {
    if (key === "*" || key.startsWith("cart_") || key.startsWith("promo_") || key === "stock") render();
  });

  /* ---------- Init ---------- */
  render();
})();