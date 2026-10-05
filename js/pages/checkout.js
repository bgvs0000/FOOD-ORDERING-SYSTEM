/* ==========================================================
   CHECKOUT
   ========================================================== */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  /* ---------- Walang laman ang cart → balik sa cart ---------- */
  if (Cart.isEmpty()) {
    window.location.replace("cart.html");
    return;
  }

  const form     = $("#checkoutForm");
  const placeBtn = $("#placeOrderBtn");
  const errorEl  = $("#checkoutError");
  const user     = Auth.current();
  let placing = false;          // true habang/pagkatapos mag-place (iwas redirect + double submit)

  /* ==========================================================
     PREFILL from account
     ========================================================== */
  function prefill() {
    form.elements.name.value = user.name || "";
    form.elements.phone.value = user.phone || "";

    const addresses = Store.getUser("addresses", []);
    const def = addresses.find((a) => a.isDefault) || addresses[0];
    if (def) {
      form.elements.address.value = def.address;
      form.elements.landmark.value = def.landmark || "";
    }

    const prefs = Store.getUser("prefs", {});
    if (prefs.defaultPayment) {
      const radio = form.querySelector(`input[name="payment"][value="${prefs.defaultPayment}"]`);
      if (radio) radio.checked = true;
    }

    if (user.phone) form.elements.gcashNumber.value = user.phone;
    form.elements.cardName.value = (user.name || "").toUpperCase();
  }

  /* ==========================================================
     ORDER TYPE: delivery / pickup
     ========================================================== */
  function orderType() {
    return form.elements.orderType.value;
  }

  function updateOrderType() {
    const pickup = orderType() === "pickup";
    $("#addressFields").hidden = pickup;
    $("#pickupInfo").hidden = !pickup;
    form.elements.address.required = !pickup;
    renderSummary();
  }

  /* ==========================================================
     TIMING: asap / schedule  (30-min slots until 10:30 PM)
     ========================================================== */
  function buildTimeSlots() {
    const select = $("#coTime");
    const slots = [];
    const start = new Date(Date.now() + 45 * 60000);     // at least 45 min from now
    start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);

    const closing = new Date();
    closing.setHours(22, 30, 0, 0);
    // kapag gabi na, bukas na ang slots
    if (start > closing) {
      start.setDate(start.getDate() + 1);
      start.setHours(10, 30, 0, 0);
      closing.setDate(closing.getDate() + 1);
    }

    for (let t = new Date(start); t <= closing; t = new Date(t.getTime() + 30 * 60000)) {
      slots.push(t);
    }

    const today = new Date().toDateString();
    select.innerHTML = slots.map((t) => {
      const day = t.toDateString() === today ? "Today" : "Tomorrow";
      const time = t.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
      return `<option value="${t.toISOString()}">${day}, ${time}</option>`;
    }).join("");
  }

  function updateTiming() {
    $("#scheduleField").hidden = form.elements.timing.value !== "schedule";
  }

  /* ==========================================================
     PAYMENT METHOD
     ========================================================== */
  function updatePayment() {
    const method = form.elements.payment.value;
    $$(".pay-fields").forEach((el) => (el.hidden = el.dataset.pay !== method));
  }

  /* ---------- Card: auto-format + live preview ---------- */
  const cardNum  = $("#cardNum");
  const cardExp  = $("#cardExp");
  const cardCvv  = $("#cardCvv");
  const cardName = $("#cardName");
  const mockCard = $(".mock-card");

  cardNum.addEventListener("input", () => {
    const digits = cardNum.value.replace(/\D/g, "").slice(0, 16);
    cardNum.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    $("#cardPreviewNum").textContent = (digits.padEnd(16, "•").match(/.{1,4}/g) || []).join(" ");

    // brand detection
    const brand = /^4/.test(digits) ? "visa" : /^5[1-5]/.test(digits) ? "mastercard" : "";
    if (brand) mockCard.dataset.brand = brand;
    else delete mockCard.dataset.brand;
  });

  cardExp.addEventListener("input", (e) => {
    let v = cardExp.value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    // auto-slash pero hayaang mag-backspace
    if (v.length === 2 && e.inputType !== "deleteContentBackward") v += "/";
    cardExp.value = v;
    $("#cardPreviewExp").textContent = v || "MM/YY";
  });

  cardCvv.addEventListener("input", () => {
    cardCvv.value = cardCvv.value.replace(/\D/g, "").slice(0, 3);
  });

  cardName.addEventListener("input", () => {
    $("#cardPreviewName").textContent = cardName.value.trim().toUpperCase() || "YOUR NAME";
  });

  /** Luhn algorithm — totoong check ng card number (try 4242 4242 4242 4242) */
  function luhn(num) {
    const digits = num.replace(/\D/g, "");
    if (digits.length < 13) return false;
    let sum = 0;
    let dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits[i], 10);
      if (dbl) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  function expValid(value) {
    const m = /^(\d{2})\/(\d{2})$/.exec(value);
    if (!m) return false;
    const month = parseInt(m[1], 10);
    const year = 2000 + parseInt(m[2], 10);
    if (month < 1 || month > 12) return false;
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    return endOfMonth >= new Date();
  }

  /* ==========================================================
     SUMMARY
     ========================================================== */
  function renderSummary() {
    const t = Cart.totals({ orderType: orderType() });

    $("#miniList").innerHTML = t.items.map((i) => `
      <li class="mini-item">
        <img src="${assetPath(i.product.image)}" alt="" />
        <div>
          <strong>${esc(i.product.name)}</strong>
          ${i.description ? `<small>${esc(i.description)}</small>` : ""}
        </div>
        <span class="mini-item__qty">×${i.qty}</span>
        <b>${peso(i.lineTotal)}</b>
      </li>`).join("");

    $("#sumSubtotal").textContent = peso(t.subtotal);
    $("#sumDelivery").textContent =
      orderType() === "pickup" ? "Pickup" : t.delivery === 0 ? "FREE" : peso(t.delivery);
    $("#sumTotal").textContent = peso(t.total);
    $("#btnTotal").textContent = peso(t.total);

    $("#discountRow").hidden = !t.promo;
    if (t.promo) {
      $("#discountCode").textContent = t.promo.code;
      $("#sumDiscount").textContent = t.promo.type === "freeship" ? "Free delivery" : "−" + peso(t.discount);
    }
  }

  /* ==========================================================
     VALIDATION
     ========================================================== */
  function setFieldError(input, message) {
    const field = input.closest(".field");
    if (!field) return;
    field.classList.add("has-error");
    const small = $(".field__error", field);
    if (small) small.textContent = message;
  }

  function clearErrors() {
    $$(".field.has-error", form).forEach((f) => {
      f.classList.remove("has-error");
      const small = $(".field__error", f);
      if (small) small.textContent = "";
    });
    errorEl.textContent = "";
  }

  function validate() {
    clearErrors();
    const el = form.elements;
    const errors = [];
    const add = (input, msg) => {
      setFieldError(input, msg);
      errors.push(input);
    };

    if (!Auth.validate.name(el.name.value)) add(el.name, "Please enter your full name.");
    if (!Auth.validate.phone(el.phone.value)) add(el.phone, "Enter a valid PH mobile number (09XX XXX XXXX).");

    if (orderType() === "delivery" && el.address.value.trim().length < 8) {
      add(el.address, "Please enter your complete address.");
    }

    const method = el.payment.value;
    if (method === "gcash" && !Auth.validate.phone(el.gcashNumber.value)) {
      add(el.gcashNumber, "Enter a valid GCash number.");
    }
    if (method === "card") {
      if (!luhn(el.cardNumber.value)) add(el.cardNumber, "Invalid card number. Try 4242 4242 4242 4242.");
      if (el.cardName.value.trim().length < 2) add(el.cardName, "Required.");
      if (!expValid(el.cardExp.value)) add(el.cardExp, "Invalid or expired.");
      if (!/^\d{3}$/.test(el.cardCvv.value)) add(el.cardCvv, "3 digits.");
    }

    if (errors.length) {
      errorEl.textContent = `Please fix ${errors.length} field${errors.length > 1 ? "s" : ""} above.`;
      errors[0].scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => errors[0].focus({ preventScroll: true }), 350);
      return false;
    }
    return true;
  }

  // alisin ang error habang nagta-type
  form.addEventListener("input", (e) => {
    const field = e.target.closest(".field.has-error");
    if (field) {
      field.classList.remove("has-error");
      const small = $(".field__error", field);
      if (small) small.textContent = "";
    }
  });

  /* ==========================================================
     SAVE DETAILS TO ACCOUNT (kapag naka-check)
     ========================================================== */
  function saveDetails(data) {
    Auth.updateProfile({ name: data.name.trim(), phone: data.phone.trim() });

    if (data.orderType === "delivery") {
      Store.updateUser("addresses", [], (list) => {
        const exists = list.some((a) => a.address.toLowerCase() === data.address.trim().toLowerCase());
        if (!exists) {
          list.push({
            id: Store.uid("addr"),
            label: "🏠 Home",
            address: data.address.trim(),
            landmark: (data.landmark || "").trim(),
            isDefault: list.length === 0,
          });
        }
        return list;
      });
    }
  }

  /* ==========================================================
     PLACE ORDER
     ========================================================== */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (placing) return;
    if (!validate()) return;

    const data = Object.fromEntries(new FormData(form));
    placing = true;
    placeBtn.classList.add("is-loading");
    placeBtn.disabled = true;

    try {
      const order = await Orders.place(data);
      if (data.saveAddress) saveDetails(data);
      showSuccess(order);
    } catch (err) {
      placing = false;
      placeBtn.classList.remove("is-loading");
      placeBtn.disabled = false;
      errorEl.textContent = err.message;
      Toast.error("Couldn't place order", err.message);
    }
  });

  /* ---------- Success modal + confetti ---------- */
  function showSuccess(order) {
    const modal = $("#successModal");
    modal.setAttribute("data-static", "");      // hindi maisasara ng ESC / overlay

    $("#successOrderId").textContent = "#" + order.id;
    $("#successEta").textContent = new Date(order.eta).toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
    });
    $("#trackBtn").href = `orders.html?id=${order.id}`;

    // update stepper → step 3
    $$(".stepper__item").forEach((s, i) => {
      s.classList.toggle("is-done", i < 2);
      s.classList.toggle("is-active", i === 2);
      if (i < 2) s.querySelector("span").textContent = "✓";
    });

    Modal.open(modal, { focus: "#trackBtn" });
    setTimeout(() => Confetti.burst({ y: 0.3 }), 250);
  }

  /* ==========================================================
     LISTENERS + INIT
     ========================================================== */
  $$('input[name="orderType"]').forEach((r) => r.addEventListener("change", updateOrderType));
  $$('input[name="timing"]').forEach((r) => r.addEventListener("change", updateTiming));
  $$('input[name="payment"]').forEach((r) => r.addEventListener("change", updatePayment));

  // nagbago ang cart sa ibang tab → i-update o ibalik sa cart
  Store.on("*", (_v, key) => {
    if (placing) return;
    if (key === "*" || key.startsWith("cart_") || key.startsWith("promo_")) {
      if (Cart.isEmpty()) window.location.replace("cart.html");
      else renderSummary();
    }
  });

  prefill();
  buildTimeSlots();
  updateOrderType();
  updateTiming();
  updatePayment();
})();