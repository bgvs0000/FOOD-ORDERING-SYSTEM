/* ==========================================================
   HISTORY — completed + cancelled orders
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
  const fmtDate = (d) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  const listEl   = $("#historyList");
  const emptyEl  = $("#emptyHistory");
  const searchEl = $("#historySearch");
  const sortEl   = $("#historySort");

  const state = { filter: "all", search: "", sort: "newest" };
  let receiptOrderId = null;
  let rateOrderId = null;

  /* ==========================================================
     STATS
     ========================================================== */
  function renderStats() {
    const past = Orders.past();
    const s = Orders.stats();

    $("#statOrders").textContent = past.length;
    $("#statSpent").textContent = peso(s.spent);
    $("#statFav").textContent = s.favorite || "—";
    $("#statFav").title = s.favorite || "";

    $("#countAll").textContent = past.length;
    $("#countCompleted").textContent = s.completed;
    $("#countCancelled").textContent = s.cancelled;
  }

  /* ==========================================================
     FILTER / SEARCH / SORT
     ========================================================== */
  function getOrders() {
    const q = state.search.trim().toLowerCase().replace(/^#/, "");

    let list = Orders.past().filter((o) => {
      if (state.filter !== "all" && o.status !== state.filter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });

    const sorters = {
      newest:  (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      oldest:  (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      highest: (a, b) => b.total - a.total,
    };
    return list.sort(sorters[state.sort]);
  }

  /** "Today" / "Yesterday" / "Oct 3, 2026" */
  function dayLabel(date) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return fmtDate(d);
  }

  /* ==========================================================
     CARD
     ========================================================== */
  function stars(n) {
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function cardHTML(o, i) {
    const info = Orders.statusInfo(o);
    const thumbs = o.items.slice(0, 3);
    const extra = o.items.length - thumbs.length;
    const itemText = o.items.map((it) => `${it.name} ×${it.qty}`).join(", ");
    const canRate = o.status === "COMPLETED" && !o.rating;

    return `
      <article class="history-card" data-status="${o.status}" style="--i:${i}">
        <div class="history-card__imgs" aria-hidden="true">
          ${thumbs.map((it) => `<img src="${assetPath(it.image)}" alt="" style="background:${it.accent}" />`).join("")}
          ${extra > 0 ? `<span>+${extra}</span>` : ""}
        </div>

        <div class="history-card__info">
          <div class="history-card__top">
            <strong>#${esc(o.id)}</strong>
            <span class="status-pill" data-status="${o.status}">${esc(info.label)}</span>
          </div>
          <p class="history-card__items" title="${esc(itemText)}">${esc(itemText)}</p>
          <small class="history-card__meta">
            ${fmtTime(o.createdAt)} · ${o.orderType === "pickup" ? "Pickup" : "Delivery"} · ${esc(o.payment.label)}
            ${o.status === "CANCELLED" && o.cancelReason ? ` · ${esc(o.cancelReason)}` : ""}
          </small>
          ${o.rating ? `<div class="history-card__rating" title="${o.rating.stars} stars">${stars(o.rating.stars)}</div>` : ""}
        </div>

        <div class="history-card__right">
          <strong class="history-card__total">${peso(o.total)}</strong>
          <div class="history-card__actions">
            <button class="btn btn--sm" type="button" data-receipt="${o.id}">🧾 Receipt</button>
            ${canRate ? `<button class="btn btn--sm btn--yellow" type="button" data-rate="${o.id}">⭐ Rate</button>` : ""}
            <button class="btn btn--sm btn--primary" type="button" data-reorder="${o.id}">🔁 Reorder</button>
          </div>
        </div>
      </article>`;
  }

  /* ==========================================================
     RENDER LIST (grouped by day)
     ========================================================== */
  function render() {
    renderStats();
    const orders = getOrders();
    const hasAny = Orders.past().length > 0;

    emptyEl.hidden = orders.length > 0;
    listEl.hidden = orders.length === 0;

    if (!orders.length) {
      $("#emptyTitle").textContent = hasAny ? "No matching orders" : "No orders yet";
      $("#emptyText").textContent = hasAny
        ? "Try another filter or search term."
        : "Your completed and cancelled orders will show up here.";
      $("#emptyHistory .btn").hidden = hasAny;
      return;
    }

    // group by day (pero kapag "highest" ang sort, walang grouping)
    if (state.sort === "highest") {
      listEl.innerHTML = `<div class="history-group">${orders.map(cardHTML).join("")}</div>`;
      return;
    }

    const groups = [];
    orders.forEach((o) => {
      const label = dayLabel(o.createdAt);
      let g = groups.find((x) => x.label === label);
      if (!g) groups.push((g = { label, orders: [] }));
      g.orders.push(o);
    });

    let i = 0;
    listEl.innerHTML = groups.map((g) => `
      <div class="history-group">
        <h3 class="history-group__date">${esc(g.label)}</h3>
        ${g.orders.map((o) => cardHTML(o, i++)).join("")}
      </div>`).join("");
  }

  /* ==========================================================
     FILTER CHIPS / SEARCH / SORT listeners
     ========================================================== */
  $$(".history-toolbar .chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      state.filter = chip.dataset.filter;
      $$(".history-toolbar .chip").forEach((c) => {
        const on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-selected", String(on));
      });
      render();
    })
  );

  let t;
  searchEl.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.search = searchEl.value;
      render();
    }, 200);
  });

  sortEl.addEventListener("change", () => {
    state.sort = sortEl.value;
    render();
  });

  /* ==========================================================
     CARD ACTIONS
     ========================================================== */
  listEl.addEventListener("click", (e) => {
    const r = e.target.closest("[data-receipt]");
    const ro = e.target.closest("[data-reorder]");
    const ra = e.target.closest("[data-rate]");
    if (r) openReceipt(r.dataset.receipt);
    if (ro) reorder(ro.dataset.reorder);
    if (ra) openRate(ra.dataset.rate);
  });

  /* ---------- Reorder ---------- */
  function reorder(id) {
    try {
      const { added, skipped } = Orders.reorder(id);

      if (added.length) {
        Toast.success("Added to cart!", `${added.length} item${added.length > 1 ? "s" : ""} from #${id}`, {
          action: { label: "View", href: "cart.html" },
        });
      }
      if (skipped.length) {
        Toast.warning(
          `${skipped.length} item${skipped.length > 1 ? "s" : ""} unavailable`,
          skipped.map((s) => `${s.name}: ${s.reason}`).join(" · "),
          { duration: 6000 }
        );
      }
      if (!added.length && !skipped.length) Toast.info("Nothing to reorder");
    } catch (err) {
      Toast.error("Reorder failed", err.message);
    }
  }

  /* ==========================================================
     RECEIPT
     ========================================================== */
  function openReceipt(id) {
    const o = Orders.get(id);
    if (!o) return;
    receiptOrderId = id;

    $("#rcptId").textContent = "#" + o.id;
    $("#rcptDate").textContent = `${fmtDate(o.createdAt)} ${fmtTime(o.createdAt)}`;
    $("#rcptType").textContent = o.orderType === "pickup" ? "Pickup" : "Delivery";
    $("#rcptPayment").textContent = o.payment.label + (o.payment.last4 ? ` ••${o.payment.last4}` : "");
    $("#rcptStatus").textContent = Orders.statusInfo(o).label.toUpperCase();

    $("#rcptItems").innerHTML = o.items.map((i) => `
      <li>
        <span>${i.qty}× ${esc(i.name)}${i.description ? `<small>${esc(i.description)}</small>` : ""}</span>
        <b>${peso(i.lineTotal)}</b>
      </li>`).join("");

    $("#rcptSubtotal").textContent = peso(o.subtotal);
    $("#rcptDelivery").textContent = o.delivery === 0 ? "FREE" : peso(o.delivery);
    $("#rcptDiscountRow").hidden = !o.discount;
    $("#rcptDiscount").textContent = `−${peso(o.discount)}${o.promoCode ? ` (${o.promoCode})` : ""}`;
    $("#rcptTotal").textContent = peso(o.total);

    Modal.open("receiptModal");
  }

  $("#printReceipt").addEventListener("click", () => window.print());

  $("#rcptReorder").addEventListener("click", () => {
    Modal.close("receiptModal");
    if (receiptOrderId) reorder(receiptOrderId);
  });

  /* ==========================================================
     RATE
     ========================================================== */
  const rateForm = $("#rateForm");

  function openRate(id) {
    rateOrderId = id;
    rateForm.reset();
    $("#rateOrderId").textContent = "#" + id;
    Modal.open("rateModal", { focus: "#s5" });
  }

  rateForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(rateForm);
    try {
      Orders.rate(rateOrderId, {
        stars: fd.get("stars"),
        tags: fd.getAll("tags"),
        comment: fd.get("comment") || "",
      });
      Modal.close("rateModal");
      const n = Number(fd.get("stars"));
      Toast.success(n >= 4 ? "Thanks for the love! 🍔" : "Thanks for your feedback!", stars(n));
    } catch (err) {
      Toast.error("Can't submit", err.message);
      $(".stars", rateForm).classList.remove("anim-shake");
      void rateForm.offsetWidth;
      $(".stars", rateForm).classList.add("anim-shake");
    }
  });

  /* ---------- Open rate modal from ?rate=BV-1001 ---------- */
  const rateParam = new URLSearchParams(window.location.search).get("rate");

  /* ---------- Live updates ---------- */
  Orders.onChange(render);

  render();
  if (rateParam) {
    const o = Orders.get(rateParam);
    if (o && o.status === "COMPLETED" && !o.rating) openRate(rateParam);
  }
})();