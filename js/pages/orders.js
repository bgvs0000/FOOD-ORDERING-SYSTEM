/* ==========================================================
   ORDERS — live tracking
   URL: orders.html            → latest active order
        orders.html?id=BV-1001 → specific order
   ========================================================== */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

  const AUTO_MS = 8000;           // demo: next status every 8 seconds
  const RIDE_MS = AUTO_MS;        // gaano katagal ang biyahe ng rider sa mapa

  const tracker     = $("#tracker");
  const tabsEl      = $("#orderTabs");
  const emptyEl     = $("#noOrders");
  const cancelBtn   = $("#cancelBtn");
  const simulateBtn = $("#simulateBtn");
  const autoBox     = $("#autoAdvance");
  const rider       = $("#mapRider");
  const routePath   = $("#routePath");

  let selectedId = new URLSearchParams(window.location.search).get("id");
  let lastStatus = null;
  let autoTimer = null;
  let rafId = null;

  /* ==========================================================
     WHICH ORDER TO SHOW
     ========================================================== */
  function selectedOrder() {
    let order = selectedId ? Orders.get(selectedId) : null;
    if (!order) order = Orders.active()[0] || null;
    if (order) selectedId = order.id;
    return order;
  }

  /* ==========================================================
     TABS (active orders)
     ========================================================== */
  function renderTabs(current) {
    const active = Orders.active();
    // isama ang selected kahit tapos na (para makita ang "Delivered")
    const list = current && !active.some((o) => o.id === current.id) ? [current, ...active] : active;

    $("#activeCountText").textContent = `${active.length} active order${active.length === 1 ? "" : "s"}`;

    tabsEl.innerHTML = list.length > 1 || (current && !Orders.isActive(current))
      ? list.map((o) => `
          <button class="order-tab ${o.id === selectedId ? "is-active" : ""}" type="button" data-id="${o.id}">
            #${esc(o.id)}
            <span class="status-pill" data-status="${o.status}">${esc(Orders.statusInfo(o).label)}</span>
          </button>`).join("")
      : "";
  }

  tabsEl.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-id]");
    if (!tab) return;
    selectedId = tab.dataset.id;
    lastStatus = null;
    history.replaceState(null, "", `?id=${selectedId}`);
    render();
  });

  /* ==========================================================
     STATUS HERO + TIMELINE
     ========================================================== */
  function renderStatus(order) {
    const info = Orders.statusInfo(order);
    const hero = $("#statusHero");
    hero.dataset.status = order.status;

    const icon = $("#statusIcon");
    icon.textContent = info.icon;
    if (lastStatus && lastStatus !== order.status) {
      icon.classList.remove("changed");
      void icon.offsetWidth;
      icon.classList.add("changed");
    }

    $("#trkOrderId").textContent = "#" + order.id;
    $("#statusTitle").textContent = info.title;
    $("#statusDesc").textContent =
      order.status === "CANCELLED" && order.cancelReason
        ? `Cancelled: ${order.cancelReason}`
        : info.desc;

    // pickup labels
    const pickup = order.orderType === "pickup";
    $("#stepOutLabel").textContent = pickup ? "Ready for pickup" : "Out for delivery";
    $("#stepDoneLabel").textContent = pickup ? "Picked up" : "Delivered";
    $('[data-step="OUT_FOR_DELIVERY"] .timeline__dot').textContent = pickup ? "🛍" : "🛵";

    // timeline states
    const idx = Orders.stepIndex(order);
    $$(".timeline__step").forEach((step, i) => {
      step.classList.toggle("is-done", idx > i || order.status === "COMPLETED");
      step.classList.toggle("is-current", idx === i && order.status !== "COMPLETED");
      const t = Orders.timeOf(order, step.dataset.step);
      step.querySelector("[data-time]").textContent = t ? fmtTime(t) : "";
    });

    tracker.classList.toggle("is-cancelled", order.status === "CANCELLED");
  }

  /* ==========================================================
     ETA COUNTDOWN
     ========================================================== */
  function renderEta(order) {
    const countdown = $("#etaCountdown");
    const clock = $("#etaClock");

    if (order.status === "COMPLETED") {
      countdown.textContent = "✓";
      clock.textContent = "at " + fmtTime(order.completedAt);
      return;
    }
    if (order.status === "CANCELLED") {
      countdown.textContent = "—";
      clock.textContent = "cancelled";
      return;
    }

    const diff = new Date(order.eta) - Date.now();
    clock.textContent = "by " + fmtTime(order.eta);

    if (diff <= 0) {
      countdown.textContent = "Soon!";
      return;
    }
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    countdown.textContent =
      mins >= 60
        ? `${Math.floor(mins / 60)}h ${mins % 60}m`
        : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  /* ==========================================================
     MAP — move rider along the SVG route
     ========================================================== */
  const VIEW_W = 600;
  const VIEW_H = 220;

  function placeRider(progress) {
    const len = routePath.getTotalLength();
    const pt = routePath.getPointAtLength(len * Math.min(1, Math.max(0, progress)));
    rider.style.left = (pt.x / VIEW_W) * 100 + "%";
    rider.style.top = (pt.y / VIEW_H) * 100 + "%";
  }

  function animateRider(order) {
    cancelAnimationFrame(rafId);
    rider.classList.remove("is-moving");

    if (order.status === "COMPLETED") return placeRider(1);
    if (order.status !== "OUT_FOR_DELIVERY") return placeRider(0);

    rider.classList.add("is-moving");
    const startedAt = Orders.timeOf(order, "OUT_FOR_DELIVERY").getTime();

    (function step() {
      // 5% → 95% habang nasa biyahe; 100% kapag delivered na
      const p = 0.05 + Math.min(0.9, ((Date.now() - startedAt) / RIDE_MS) * 0.9);
      placeRider(p);
      if (p < 0.95) rafId = requestAnimationFrame(step);
    })();
  }

  /* ==========================================================
     DETAILS SIDEBAR
     ========================================================== */
  function renderDetails(order) {
    $("#trkPlaced").textContent = fmtTime(order.createdAt);
    $("#trkType").textContent = order.orderType === "pickup" ? "Pickup" : "Delivery";
    $("#trkPayment").textContent =
      order.payment.label + (order.payment.last4 ? ` ••${order.payment.last4}` : "");

    $("#trkAddressBox small").textContent = order.orderType === "pickup" ? "Pick up at" : "Deliver to";
    $("#trkAddress").textContent =
      order.customer.address + (order.customer.landmark ? ` (${order.customer.landmark})` : "");

    $("#trkItems").innerHTML = order.items.map((i) => `
      <li class="mini-item">
        <img src="${assetPath(i.image)}" alt="" />
        <div>
          <strong>${esc(i.name)}</strong>
          ${i.description ? `<small>${esc(i.description)}</small>` : ""}
        </div>
        <span class="mini-item__qty">×${i.qty}</span>
        <b>${peso(i.lineTotal)}</b>
      </li>`).join("");

    $("#trkSubtotal").textContent = peso(order.subtotal);
    $("#trkDelivery").textContent = order.delivery === 0 ? "FREE" : peso(order.delivery);
    $("#trkDiscountRow").hidden = !order.discount;
    $("#trkDiscount").textContent = "−" + peso(order.discount);
    $("#trkTotal").textContent = peso(order.total);
  }

  /* ==========================================================
     RENDER
     ========================================================== */
  function render() {
    const order = selectedOrder();

    renderTabs(order);
    tracker.hidden = !order;
    emptyEl.hidden = !!order;
    if (!order) return stopAuto();

    renderStatus(order);
    renderEta(order);
    renderDetails(order);

    const pickup = order.orderType === "pickup";
    $("#mapCard").hidden = pickup || order.status === "CANCELLED";
    $("#riderCard").hidden = pickup || !["OUT_FOR_DELIVERY", "COMPLETED"].includes(order.status);
    if (!pickup) animateRider(order);

    // actions
    cancelBtn.hidden = !Orders.canCancel(order);
    const active = Orders.isActive(order);
    simulateBtn.hidden = !active;
    autoBox.closest(".checkbox").hidden = !active;

    // status changed → feedback
    if (lastStatus && lastStatus !== order.status) onStatusChange(order);
    lastStatus = order.status;

    active && autoBox.checked ? startAuto() : stopAuto();
  }

  /* ---------- Feedback kapag nagbago ang status ---------- */
  function onStatusChange(order) {
    const prefs = Store.getUser("prefs", {});
    const info = Orders.statusInfo(order);

    if (order.status === "COMPLETED") {
      Confetti.cannons();
      Toast.success(info.title, "Tap History to rate your order ⭐", {
        action: { label: "Rate", href: "history.html" },
        duration: 6000,
      });
    } else if (prefs.notifyOrders !== false && order.status !== "CANCELLED") {
      Toast.info(info.title, `Order #${order.id}`);
    }
  }

  /* ==========================================================
     DEMO: SIMULATE / AUTO-ADVANCE
     ========================================================== */
  function startAuto() {
    if (autoTimer) return;
    autoTimer = setInterval(() => {
      const order = selectedOrder();
      if (order && Orders.isActive(order)) Orders.advance(order.id);
      else stopAuto();
    }, AUTO_MS);
  }

  function stopAuto() {
    clearInterval(autoTimer);
    autoTimer = null;
  }

  // tandaan ang setting
  autoBox.checked = Store.get("demo_auto", true);
  autoBox.addEventListener("change", () => {
    Store.set("demo_auto", autoBox.checked);
    autoBox.checked ? startAuto() : stopAuto();
  });

  simulateBtn.addEventListener("click", () => {
    const order = selectedOrder();
    if (!order) return;
    stopAuto();                      // reset timer para hindi doble
    Orders.advance(order.id);
  });

  /* ==========================================================
     CANCEL
     ========================================================== */
  cancelBtn.addEventListener("click", () => Modal.open("cancelModal"));

  $("#confirmCancelBtn").addEventListener("click", () => {
    const order = selectedOrder();
    try {
      Orders.cancel(order.id, $("#cancelReason").value);
      Modal.close("cancelModal");
      Toast.info("Order cancelled", `#${order.id} has been cancelled.`);
    } catch (err) {
      Modal.close("cancelModal");
      Toast.error("Can't cancel", err.message);
    }
  });

  /* ---------- Mock buttons ---------- */
  $$("[data-mock]").forEach((b) =>
    b.addEventListener("click", () => Toast.demo(b.dataset.mock === "call" ? "Calling the rider" : "Rider chat"))
  );
  $("#helpBtn").addEventListener("click", () => Toast.demo("Customer support chat"));

  /* ==========================================================
     LIVE UPDATES
     ========================================================== */
  Orders.onChange(render);
  setInterval(() => {
    const order = selectedOrder();
    if (order) renderEta(order);
  }, 1000);

  // huminto kapag nakatago ang tab (tipid sa battery)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAuto();
    else render();
  });

  render();
})();