/* ==========================================================
   ADMIN CUSTOMERS
   Stats · table · details modal · export CSV
   ========================================================== */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—");
  const WEEK = 7 * 86400000;

  const state = { search: "", role: "customer", sort: "spent" };

  /* ---------- Build rows: user + order stats ---------- */
  function rows() {
    const orders = Orders.everything();
    return Auth.allUsers().map((u) => {
      const mine = orders.filter((o) => o.userId === u.id);
      const s = Orders.statsFor(mine);
      return {
        user: u,
        role: Auth.roleOf(u),
        orders: mine.filter((o) => o.status !== "CANCELLED").length,
        spent: s.spent,
        points: s.points,
        favorite: s.favorite,
        avg: s.completed ? s.spent / s.completed : 0,
        lastOrder: mine[0] ? mine[0].createdAt : null,
        list: mine,
      };
    });
  }

  /* ==========================================================
     STATS
     ========================================================== */
  function renderStats(all) {
    const customers = all.filter((r) => r.role === "customer");
    const buyers = customers.filter((r) => r.spent > 0);

    $("#statCustomers").textContent = customers.length;
    $("#statNew").textContent = customers.filter((r) => Date.now() - new Date(r.user.createdAt) < WEEK).length;
    $("#statRepeat").textContent = customers.filter((r) => r.orders >= 2).length;
    $("#statAvgSpend").textContent = peso(buyers.length ? Math.round(buyers.reduce((s, r) => s + r.spent, 0) / buyers.length) : 0);
    $("#customerCountText").textContent = `${customers.length} customers`;
  }

  /* ==========================================================
     TABLE
     ========================================================== */
  function filtered(all) {
    const q = state.search.trim().toLowerCase();
    const sorters = {
      spent:  (a, b) => b.spent - a.spent,
      orders: (a, b) => b.orders - a.orders,
      recent: (a, b) => new Date(b.lastOrder || 0) - new Date(a.lastOrder || 0),
      newest: (a, b) => new Date(b.user.createdAt) - new Date(a.user.createdAt),
      name:   (a, b) => a.user.name.localeCompare(b.user.name),
    };
    return all
      .filter((r) => state.role === "all" || r.role === state.role)
      .filter((r) => !q || r.user.name.toLowerCase().includes(q) || r.user.email.includes(q))
      .sort(sorters[state.sort]);
  }

  function render() {
    const all = rows();
    renderStats(all);
    const list = filtered(all);
    $("#noCustomers").hidden = list.length > 0;

    $("#customersTableBody").innerHTML = list.map((r) => `
      <tr>
        <td>
          <div class="cell-user">
            <span class="avatar" style="--c:${esc(r.user.avatarColor)}">${esc(Auth.initials(r.user.name))}</span>
            <div>
              <strong>${esc(r.user.name)} ${r.role === "admin" ? '<span class="badge badge--yellow">Staff</span>' : ""}</strong>
              <small>${esc(r.user.email)}</small>
            </div>
          </div>
        </td>
        <td>${r.user.provider === "google" ? "🔐 Google" : "✉️ Email"}</td>
        <td class="cell-strong">${r.orders}</td>
        <td class="cell-strong">${peso(r.spent)}</td>
        <td>${r.points}</td>
        <td class="cell-muted">${r.lastOrder ? fmtDate(r.lastOrder) : "—"}</td>
        <td class="cell-muted">${fmtDate(r.user.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" type="button" data-view="${esc(r.user.id)}" aria-label="View ${esc(r.user.name)}">👁</button>
          </div>
        </td>
      </tr>`).join("");
  }

  /* ==========================================================
     DETAILS MODAL
     ========================================================== */
  function openCustomer(userId) {
    const r = rows().find((x) => x.user.id === userId);
    if (!r) return;
    const u = r.user;

    const avatar = $("#cmAvatar");
    avatar.textContent = Auth.initials(u.name);
    avatar.style.setProperty("--c", u.avatarColor);

    $("#cmName").textContent = u.name;
    $("#cmEmail").textContent = u.email;
    $("#cmProvider").textContent = u.provider === "google" ? "🔐 Google" : "✉️ Email";
    $("#cmJoined").textContent = "Joined " + fmtDate(u.createdAt);
    $("#cmRole").textContent = r.role === "admin" ? "Staff" : "Customer";

    $("#cmOrders").textContent = r.orders;
    $("#cmSpent").textContent = peso(r.spent);
    $("#cmAvg").textContent = peso(Math.round(r.avg));
    $("#cmPoints").textContent = r.points;

    // contact: profile phone, or latest order phone/address
    const latest = r.list[0];
    const addresses = Store.get("addresses_" + u.id, []);
    const def = addresses.find((a) => a.isDefault) || addresses[0];
    $("#cmPhone").textContent = u.phone || (latest && latest.customer.phone) || "No phone yet";
    $("#cmAddress").textContent = def
      ? def.address
      : latest && latest.orderType === "delivery" ? latest.customer.address : "No saved address";

    $("#cmFavBox").hidden = !r.favorite;
    $("#cmFav").textContent = r.favorite || "";

    $("#cmNoOrders").hidden = r.list.length > 0;
    $("#cmOrderList").innerHTML = r.list.slice(0, 20).map((o) => `
      <li>
        <a href="orders.html?id=${o.id}">
          <strong>#${esc(o.id)}</strong>
          <small>${fmtDate(o.createdAt)} · ${o.items.map((i) => i.name).join(", ")}</small>
          <b>${peso(o.total)}</b>
          <span class="status-pill" data-status="${o.status}">${esc(Orders.statusInfo(o).label)}</span>
        </a>
      </li>`).join("");

    Modal.open("customerModal");
  }

  $("#customersTableBody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (btn) openCustomer(btn.dataset.view);
  });

  /* ==========================================================
     EXPORT CSV
     ========================================================== */
  $("#exportBtn").addEventListener("click", () => {
    const list = filtered(rows());
    const quote = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Name", "Email", "Role", "Sign-in", "Orders", "Total spent", "Points", "Last order", "Joined"];
    const lines = list.map((r) => [
      r.user.name, r.user.email, r.role, r.user.provider, r.orders, r.spent, r.points,
      r.lastOrder ? new Date(r.lastOrder).toISOString().slice(0, 10) : "",
      new Date(r.user.createdAt).toISOString().slice(0, 10),
    ].map(quote).join(","));

    const csv = [header.map(quote).join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bunvoyage-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    Toast.success("CSV exported", `${list.length} rows`);
  });

  /* ==========================================================
     TOOLBAR
     ========================================================== */
  let t;
  $("#customerSearch").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.search = e.target.value;
      render();
    }, 200);
  });

  $$(".admin-toolbar .chip[data-role]").forEach((chip) =>
    chip.addEventListener("click", () => {
      state.role = chip.dataset.role;
      $$(".admin-toolbar .chip[data-role]").forEach((c) => {
        const on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-selected", String(on));
      });
      render();
    })
  );

  $("#customerSort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });

  Store.on("*", (_v, key) => {
    if (key === "*" || key === "users" || key === "orders") render();
  });

  render();
})();