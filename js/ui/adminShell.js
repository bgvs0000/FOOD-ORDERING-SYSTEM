/* ==========================================================
   ADMIN SHELL — sidebar + topbar for every /admin page
   Needs on each page:
     <body class="admin" data-admin-page="dashboard">
     <aside class="admin-sidebar" id="adminSidebar"></aside>
     <header class="admin-topbar" id="adminTopbar"></header>
   ========================================================== */
const AdminShell = (() => {
  const LINKS = [
    { page: "dashboard", href: "dashboard.html", label: "Dashboard", icon: "📊" },
    { page: "orders",    href: "orders.html",    label: "Orders",    icon: "🧾", badge: true },
    { page: "products",  href: "products.html",  label: "Products",  icon: "🍔" },
    { page: "customers", href: "customers.html", label: "Customers", icon: "👥" },
  ];

  const current = document.body.dataset.adminPage || "";
  const currentLink = LINKS.find((l) => l.page === current);

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  /* ---------- Sidebar ---------- */
  function renderSidebar(admin) {
    const el = document.getElementById("adminSidebar");
    if (!el) return;

    el.innerHTML = `
      <a href="dashboard.html" class="admin-brand admin-brand--light">
        <img src="../assets/images/products/burger-classic.svg" alt="" width="38" height="38" />
        <span>Bun<span class="hl-red">Voyage</span></span>
        <span class="admin-brand__tag">Admin</span>
      </a>

      <nav class="admin-nav" aria-label="Admin">
        <p class="admin-nav__label">Manage</p>
        ${LINKS.map((l) => `
          <a href="${l.href}" class="admin-nav__link ${l.page === current ? "is-active" : ""}"
             ${l.page === current ? 'aria-current="page"' : ""}>
            <span class="admin-nav__icon" aria-hidden="true">${l.icon}</span>
            <span>${l.label}</span>
            ${l.badge ? '<span class="admin-nav__badge" data-pending-count data-count="0">0</span>' : ""}
          </a>`).join("")}

        <p class="admin-nav__label">Store</p>
        <a href="../index.html" target="_blank" rel="noopener" class="admin-nav__link">
          <span class="admin-nav__icon" aria-hidden="true">🏪</span><span>View store ↗</span>
        </a>
      </nav>

      <div class="admin-sidebar__foot">
        <div class="admin-profile">
          <span class="avatar" style="--c:${esc(admin.avatarColor)}">${esc(Auth.initials(admin.name))}</span>
          <div>
            <strong>${esc(admin.name)}</strong>
            <small>${esc(admin.email)}</small>
          </div>
        </div>
        <button class="admin-logout" type="button" id="adminLogout">🚪 Log out</button>
      </div>`;

    // backdrop (mobile drawer)
    if (!document.querySelector(".admin-backdrop")) {
      const bd = document.createElement("div");
      bd.className = "admin-backdrop";
      bd.addEventListener("click", () => setSidebar(false));
      document.body.appendChild(bd);
    }
  }

  /* ---------- Topbar ---------- */
  function renderTopbar() {
    const el = document.getElementById("adminTopbar");
    if (!el) return;

    el.innerHTML = `
      <button class="icon-btn admin-topbar__menu" type="button" id="adminMenuBtn" aria-label="Open menu">☰</button>
      <p class="admin-topbar__crumb">Admin <span aria-hidden="true">/</span> <strong>${currentLink ? currentLink.label : ""}</strong></p>
      <div class="admin-topbar__right">
        <span class="admin-clock" id="adminClock">--:--</span>
        <a href="orders.html" class="icon-btn" aria-label="New orders">
          🔔<span class="icon-btn__badge" data-pending-count data-count="0"></span>
        </a>
      </div>`;

    document.getElementById("adminMenuBtn").addEventListener("click", () => {
      setSidebar(!document.body.classList.contains("is-sidebar-open"));
    });
  }

  function setSidebar(open) {
    document.body.classList.toggle("is-sidebar-open", open);
  }

  /* ---------- Live bits ---------- */
  function updateClock() {
    const el = document.getElementById("adminClock");
    if (el) {
      el.textContent = new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
    }
  }

  function updatePending() {
    if (typeof Orders === "undefined") return;
    const count = Orders.everything().filter((o) => o.status === "PENDING").length;
    document.querySelectorAll("[data-pending-count]").forEach((el) => {
      el.textContent = count > 99 ? "99+" : count;
      el.dataset.count = count;
    });
  }

  /* ---------- Logout ---------- */
  function bindLogout() {
    document.getElementById("adminLogout")?.addEventListener("click", async () => {
      const ok = typeof Modal !== "undefined"
        ? await Modal.confirm({ title: "Log out?", text: "You'll need to sign in again to manage orders.", icon: "🚪", okText: "Log out" })
        : true;
      if (ok) Auth.logoutAdmin();
    });
  }

  /* ---------- Init ---------- */
  function init() {
    const admin = Auth.adminCurrent();
    if (!admin) return;            // guardAdmin() na ang bahala

    renderSidebar(admin);
    renderTopbar();
    bindLogout();
    updateClock();
    updatePending();
    setInterval(updateClock, 15000);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setSidebar(false);
    });

    Store.on("*", (_v, key) => {
      if (key === "*" || key === "orders") updatePending();
      if (key === "admin_session" && !Auth.adminCurrent()) Auth.guardAdmin();
    });
  }

  init();

  return { updatePending, setSidebar };
})();