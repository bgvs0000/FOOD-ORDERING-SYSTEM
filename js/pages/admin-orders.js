/* ==========================================================
   ADMIN ORDERS — live kitchen board
   Board (kanban) + List (table) + Order details modal
   ========================================================== */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  const fmtTime = (d) => new Date(d).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  const fmtDate = (d) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

  const ago = (date) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(date)) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d`;
  };

  const LATE_MIN = 15;   // naka-PENDING nang 15+ min = "late"
  const COLUMNS = ["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"];

  const state = {
    view: "board",
    type: "all",
    search: "",
    showCancelled: false,
    openId: null,
  };

  const boardView = $("#boardView");
  const listView  = $("#listView");
  const emptyEl   = $("#noOrders");

  /* ==========================================================
     FILTERS
     ========================================================== */
  function filtered() {
    const q = state.search.trim().toLowerCase().replace(/^#/, "");
    return Orders.everything().filter((o) => {
      if (state.type !== "all" && o.orderType !== state.type) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }

  const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();

  /* ==========================================================
     BOARD
     ========================================================== */
  function cardHTML(o) {
    const late = o.status === "PENDING" && (Date.now() - new Date(o.createdAt)) / 60000 >= LATE_MIN;
    const next = Orders.nextAction(o);
    const items = o.items.slice(0, 3).map((i) => `<li><b>${i.qty}×</b> ${esc(i.name)}${i.size && i.size !== "Regular" ? ` (${esc(i.size)})` : ""}</li>`).join("");
    const more = o.items.length > 3 ? `<li>+${o.items.length - 3} more…</li>` : "";
    const since = o.status === "COMPLETED" || o.status === "CANCELLED"
      ? fmtTime(o.completedAt || o.cancelledAt || o.createdAt)
      : ago(o.createdAt);

    return `
      <article class="order-card ${late ? "is-late" : ""} ${newIds.has(o.id) ? "is-new" : ""}"
               style="--c:${COLOR[o.status]}" data-open="${o.id}" tabindex="0"
               aria-label="Order ${esc(o.id)}">
        <div class="order-card__top">
          <span class="order-card__id">#${esc(o.id)}</span>
          <span class="order-card__time">${late ? "⏰ " : ""}${since}</span>
        </div>
        <div class="order-card__who">
          <span>${o.orderType === "pickup" ? "🏪" : "🛵"}</span>
          <span>${esc(o.customer.name)}</span>
        </div>
        <ul class="order-card__items">${items}${more}</ul>
        ${o.status === "CANCELLED" ? `<p class="order-card__reason">✕ ${esc(o.cancelReason || "Cancelled")}</p>` : ""}
        <div class="order-card__foot">
          <span class="order-card__total">${peso(o.total)}</span>
          ${next ? `<button class="btn btn--sm ${o.status === "PENDING" ? "btn--primary" : "btn--yellow"}" type="button" data-next="${o.id}">${esc(next)} →</button>` : ""}
        </div>
      </article>`;
  }

  const COLOR = {
    PENDING: "var(--mustard)",
    CONFIRMED: "var(--blue)",
    PREPARING: "#FF8A1F",
    OUT_FOR_DELIVERY: "#A66BFF",
    COMPLETED: "var(--green)",
    CANCELLED: "#9A948C",
  };

  function renderBoard(list) {
    $(`.board-col[data-status="CANCELLED"]`).hidden = !state.showCancelled;

    COLUMNS.forEach((status) => {
      let col = list.filter((o) => o.status === status);
      // tapos na/cancelled: ngayong araw lang
      if (status === "COMPLETED" || status === "CANCELLED") col = col.filter((o) => isToday(o.completedAt || o.cancelledAt || o.createdAt));
      // active: pinakaluma sa taas (FIFO, parang kusina)
      else col = col.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      $(`[data-count="${status}"]`).textContent = col.length;
      $(`[data-list="${status}"]`).innerHTML = col.length
        ? col.map(cardHTML).join("")
        : `<p class="board-col__empty">No orders</p>`;
    });
  }

  /* ==========================================================
     LIST (table)
     ========================================================== */
  function renderList(list) {
    const rows = state.showCancelled ? list : list.filter((o) => o.status !== "CANCELLED");
    $("#noOrdersList").hidden = rows.length > 0;

    $("#ordersTableBody").innerHTML = rows.map((o) => {
      const count = o.items.reduce((s, i) => s + i.qty, 0);
      const next = Orders.nextAction(o);
      return `
        <tr>
          <td class="cell-strong">#${esc(o.id)}</td>
          <td><strong>${esc(o.customer.name)}</strong><br /><span class="cell-muted">${esc(o.customer.phone || "")}</span></td>
          <td>${count} item${count > 1 ? "s" : ""}</td>
          <td>${o.orderType === "pickup" ? "🏪 Pickup" : "🛵 Delivery"}</td>
          <td>${esc(o.payment.label)}</td>
          <td class="cell-strong">${peso(o.total)}</td>
          <td><span class="status-pill" data-status="${o.status}">${esc(Orders.statusInfo(o).label)}</span></td>
          <td class="cell-muted">${fmtDate(o.createdAt)}, ${fmtTime(o.createdAt)}</td>
          <td>
            <div class="row-actions">
              ${next ? `<button class="btn btn--sm btn--yellow" type="button" data-next="${o.id}">${esc(next)}</button>` : ""}
              <button class="icon-btn" type="button" data-open="${o.id}" aria-label="View order">👁</button>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  /* ==========================================================
     RENDER
     ========================================================== */
  function render() {
    const all = Orders.everything();
    const list = filtered();

    emptyEl.hidden = all.length > 0;
    boardView.hidden = all.length === 0 || state.view !== "board";
    listView.hidden = all.length === 0 || state.view !== "list";

    if (state.view === "board") renderBoard(list);
    else renderList(list);

    if (state.openId && Modal.isOpen("orderModal")) fillModal(state.openId);
  }

  /* ==========================================================
     ACTIONS (board + list share these)
     ========================================================== */
  function advance(id) {
    const before = Orders.byId(id);
    if (!before) return;
    const action = Orders.nextAction(before);
    const after = Orders.advance(id);
    if (after) Toast.success(`#${id}: ${action}`, Orders.statusInfo(after).title);
  }

  document.addEventListener("click", (e) => {
    const nextBtn = e.target.closest("[data-next]");
    if (nextBtn) {
      e.stopPropagation();
      advance(nextBtn.dataset.next);
      return;
    }
    const opener = e.target.closest("[data-open]");
    if (opener && !e.target.closest(".modal")) openModal(opener.dataset.open);
  });

  // Enter key on a focused card opens it
  boardView.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".order-card")) openModal(e.target.dataset.open);
  });

  /* ==========================================================
     ORDER DETAILS MODAL
     ========================================================== */
  function openModal(id) {
    if (!Orders.byId(id)) return;
    state.openId = id;
    fillModal(id);
    Modal.open("orderModal", { focus: "#omNextBtn" });
    history.replaceState(null, "", `?id=${id}`);
  }

  function fillModal(id) {
    const o = Orders.byId(id);
    if (!o) return;
    const info = Orders.statusInfo(o);
    const pickup = o.orderType === "pickup";

    $("#omTitle").textContent = "#" + o.id;
    $("#omPlaced").textContent = `Placed ${fmtDate(o.createdAt)}, ${fmtTime(o.createdAt)} · ${ago(o.createdAt)} ago`;
    const pill = $("#omStatus");
    pill.dataset.status = o.status;
    pill.textContent = info.label;

    $("#omName").textContent = o.customer.name;
    $("#omPhone").textContent = o.customer.phone || "—";
    $("#omEmail").textContent = o.customer.email || "";

    $("#omTypeTitle").textContent = pickup ? "🏪 Pickup" : "🛵 Delivery";
    $("#omAddress").textContent = pickup
      ? "Customer will pick up at the counter"
      : o.customer.address + (o.customer.landmark ? ` (${o.customer.landmark})` : "");
    $("#omTiming").textContent = o.timing === "schedule" && o.scheduleTime
      ? `Scheduled: ${fmtTime(o.scheduleTime)}`
      : `ASAP · ETA ${fmtTime(o.eta)}`;

    $("#omPayment").textContent = o.payment.label + (o.payment.last4 ? ` ••${o.payment.last4}` : "");
    $("#omPaid").textContent = o.payment.paid
      ? "✓ Paid"
      : `Collect ${peso(o.total)}${o.payment.changeFor ? ` · change for ${peso(o.payment.changeFor)}` : ""}`;

    const notes = [o.riderNote, ...o.items.filter((i) => i.notes).map((i) => `${i.name}: ${i.notes}`)].filter(Boolean);
    $("#omNoteBox").hidden = notes.length === 0;
    $("#omNote").textContent = notes.join(" · ");

    $("#omItems").innerHTML = o.items.map((i) => `
      <li class="mini-item">
        <img src="${assetPath(i.image)}" alt="" />
        <div>
          <strong>${esc(i.name)}</strong>
          ${i.description ? `<small>${esc(i.description)}</small>` : ""}
        </div>
        <span class="mini-item__qty">×${i.qty}</span>
        <b>${peso(i.lineTotal)}</b>
      </li>`).join("");

    $("#omSubtotal").textContent = peso(o.subtotal);
    $("#omDelivery").textContent = o.delivery === 0 ? "FREE" : peso(o.delivery);
    $("#omDiscountRow").hidden = !o.discount;
    $("#omDiscount").textContent = `−${peso(o.discount)}${o.promoCode ? ` (${o.promoCode})` : ""}`;
    $("#omTotal").textContent = peso(o.total);

    // timeline
    const steps = Orders.FLOW.map((s) => {
      const t = Orders.timeOf(o, s);
      const label = s === "OUT_FOR_DELIVERY" && pickup ? "Ready" : Orders.STATUS[s].label;
      return `<li class="${t ? "is-done" : ""}">${t ? "✓" : "○"} ${label}${t ? ` · ${fmtTime(t)}` : ""}</li>`;
    });
    if (o.status === "CANCELLED") {
      steps.push(`<li class="is-cancelled">✕ Cancelled · ${fmtTime(o.cancelledAt)}${o.cancelReason ? ` · ${esc(o.cancelReason)}` : ""}</li>`);
    }
    $("#omTimeline").innerHTML = steps.join("");

    // actions
    const next = Orders.nextAction(o);
    const nextBtn = $("#omNextBtn");
    nextBtn.hidden = !next;
    nextBtn.textContent = next ? `${next} →` : "";
    $("#omCancelBox").hidden = !Orders.isActive(o);
  }

  $("#omNextBtn").addEventListener("click", () => {
    if (state.openId) advance(state.openId);
  });

  $("#omCancelBtn").addEventListener("click", async () => {
    const id = state.openId;
    if (!id) return;
    const reason = $("#omCancelReason").value;
    const ok = await Modal.confirm({
      title: `Cancel #${id}?`,
      text: `Reason: ${reason}. The customer will see this on their tracking page.`,
      icon: "⚠️",
      okText: "Yes, cancel",
    });
    if (!ok) return;
    try {
      Orders.adminCancel(id, reason);
      Toast.info(`#${id} cancelled`, reason);
    } catch (err) {
      Toast.error("Can't cancel", err.message);
    }
  });

  $("#orderModal").addEventListener("modal:close", () => {
    state.openId = null;
    history.replaceState(null, "", window.location.pathname);
  });

  /* ---------- Kitchen ticket (print) ---------- */
  $("#omPrintBtn").addEventListener("click", () => {
    const o = Orders.byId(state.openId);
    if (!o) return;
    let ticket = $("#printTicket");
    if (!ticket) {
      ticket = document.createElement("div");
      ticket.id = "printTicket";
      ticket.className = "print-ticket";
      document.body.appendChild(ticket);
    }
    ticket.innerHTML = `
      <h2>#${esc(o.id)}</h2>
      <p>${o.orderType === "pickup" ? "PICKUP" : "DELIVERY"} · ${fmtTime(o.createdAt)}</p>
      <p>${esc(o.customer.name)}</p>
      <hr />
      ${o.items.map((i) => `<p><b>${i.qty} × ${esc(i.name)}</b>${i.description ? `<br />&nbsp;&nbsp;${esc(i.description)}` : ""}${i.notes ? `<br />&nbsp;&nbsp;"${esc(i.notes)}"` : ""}</p>`).join("")}
      <hr />
      ${o.riderNote ? `<p>Note: ${esc(o.riderNote)}</p>` : ""}
      <p>TOTAL: ${peso(o.total)} · ${esc(o.payment.label)}${o.payment.paid ? " (PAID)" : ""}</p>`;
    window.print();
  });

  /* ==========================================================
     TOOLBAR
     ========================================================== */
  $$(".view-toggle__btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      $$(".view-toggle__btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", String(on));
      });
      try { localStorage.setItem("bv_admin_view", state.view); } catch (e) { /* ignore */ }
      render();
    })
  );

  $$(".admin-toolbar .chip[data-type]").forEach((chip) =>
    chip.addEventListener("click", () => {
      state.type = chip.dataset.type;
      $$(".admin-toolbar .chip[data-type]").forEach((c) => {
        const on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-selected", String(on));
      });
      render();
    })
  );

  let t;
  $("#orderSearch").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.search = e.target.value;
      render();
    }, 200);
  });

  $("#showCancelled").addEventListener("change", (e) => {
    state.showCancelled = e.target.checked;
    render();
  });

  /* ==========================================================
     NEW ORDER ALERT + SOUND
     ========================================================== */
  let known = new Set(Orders.everything().map((o) => o.id));
  const newIds = new Set();
  const soundToggle = $("#soundToggle");
  const alertBox = $("#newOrderAlert");
  let lastNewId = null;

  try { soundToggle.checked = localStorage.getItem("bv_admin_sound") !== "0"; } catch (e) { /* ignore */ }
  soundToggle.addEventListener("change", () => {
    try { localStorage.setItem("bv_admin_sound", soundToggle.checked ? "1" : "0"); } catch (e) { /* ignore */ }
  });

  /** "Ding-dong" gamit ang Web Audio (walang audio file) */
  function ding() {
    if (!soundToggle.checked) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch (e) { /* walang audio sa browser na ito */ }
  }

  function checkNewOrders() {
    const all = Orders.everything();
    const fresh = all.filter((o) => !known.has(o.id) && o.status === "PENDING" && !o.sample);
    known = new Set(all.map((o) => o.id));
    if (!fresh.length) return;

    fresh.forEach((o) => newIds.add(o.id));
    setTimeout(() => fresh.forEach((o) => newIds.delete(o.id)), 4000);

    lastNewId = fresh[0].id;
    $("#newOrderText").textContent = fresh.length > 1 ? `${fresh.length} new orders!` : `New order #${fresh[0].id}!`;
    alertBox.hidden = false;
    ding();
    document.title = "🛎 New order — Bun Voyage Admin";
  }

  $("#newOrderView").addEventListener("click", () => {
    alertBox.hidden = true;
    document.title = "Orders — Bun Voyage Admin";
    if (lastNewId) openModal(lastNewId);
  });
  $("#newOrderClose").addEventListener("click", () => {
    alertBox.hidden = true;
    document.title = "Orders — Bun Voyage Admin";
  });

  /* ==========================================================
     LIVE UPDATES + INIT
     ========================================================== */
  Orders.onChange(() => {
    checkNewOrders();
    render();
  });
  Store.on("*", (_v, key) => { if (key === "*") render(); });
  setInterval(render, 30000);   // refresh "x min" + late flags

  try {
    const saved = localStorage.getItem("bv_admin_view");
    if (saved === "list") $('.view-toggle__btn[data-view="list"]').click();
  } catch (e) { /* ignore */ }

  render();

  // orders.html?id=BV-1001 → open that order
  const openParam = new URLSearchParams(window.location.search).get("id");
  if (openParam) openModal(openParam);
})();