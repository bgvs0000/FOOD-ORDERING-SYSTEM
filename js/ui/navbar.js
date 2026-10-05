/* ==========================================================
   NAVBAR — renders the app header + mobile bottom nav
   Needs on each app page:
     <body data-page="home">
     <header class="app-nav" id="appNav"></header>
     <nav class="bottom-nav" id="bottomNav"></nav>
   ========================================================== */
const Navbar = (() => {
  const LINKS = [
    { page: "home",    href: "home.html",    label: "Menu",    icon: "🍔" },
    { page: "orders",  href: "orders.html",  label: "Track",   icon: "🛵" },
    { page: "cart",    href: "cart.html",    label: "Cart",    icon: "🛒", mobileOnly: true },
    { page: "history", href: "history.html", label: "History", icon: "📜" },
    { page: "account", href: "account.html", label: "Account", icon: "👤", mobileOnly: true },
  ];

  const current = document.body.dataset.page || "";

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  /* ---------- Top navbar ---------- */
  function renderTop(user) {
    const el = document.getElementById("appNav");
    if (!el) return;

    const links = LINKS.filter((l) => !l.mobileOnly)
      .map(
        (l) => `<a href="${l.href}" class="${l.page === current ? "is-active" : ""}"
                  ${l.page === current ? 'aria-current="page"' : ""}>${l.label}
                  ${l.page === "orders" ? '<span class="nav-dot" data-active-orders hidden></span>' : ""}
                </a>`
      )
      .join("");

    el.innerHTML = `
      <div class="container app-nav__inner">
        <a href="home.html" class="nav__logo" aria-label="Bun Voyage home">
          <img src="../assets/images/products/burger-classic.svg" alt="" width="38" height="38" />
          <span>Bun<span class="hl-red">Voyage</span></span>
        </a>

        <nav class="app-nav__links" aria-label="Main">${links}</nav>

        <div class="app-nav__right">
          <a href="cart.html" class="icon-btn" aria-label="Cart">
            🛒<span class="icon-btn__badge" data-cart-count data-count="0"></span>
          </a>

          <div class="user-menu" id="userMenu">
            <button class="user-menu__btn" type="button" aria-haspopup="true" aria-expanded="false">
              <span class="avatar" style="--c:${esc(user.avatarColor)}">${esc(Auth.initials(user.name))}</span>
              <span class="user-menu__name">${esc(Auth.firstName(user.name))}</span>
              <span class="user-menu__caret" aria-hidden="true">▼</span>
            </button>

            <div class="user-menu__dropdown" role="menu">
              <div class="user-menu__head">
                <strong>${esc(user.name)}</strong>
                <small>${esc(user.email)}</small>
              </div>
              <a href="account.html" role="menuitem">👤 My account</a>
              <a href="orders.html" role="menuitem">🛵 Track orders</a>
              <a href="history.html" role="menuitem">📜 Order history</a>
              <a href="../index.html" role="menuitem">🏠 Back to landing</a>
              <button type="button" data-logout role="menuitem">🚪 Log out</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ---------- Bottom nav (mobile) ---------- */
  function renderBottom() {
    const el = document.getElementById("bottomNav");
    if (!el) return;

    el.innerHTML = LINKS.map(
      (l) => `
      <a href="${l.href}" class="bottom-nav__link ${l.page === current ? "is-active" : ""}"
         ${l.page === current ? 'aria-current="page"' : ""}>
        <span class="bottom-nav__icon" aria-hidden="true">${l.icon}</span>
        <span>${l.label}</span>
        ${l.page === "cart" ? '<span class="bottom-nav__badge" data-cart-count data-count="0"></span>' : ""}
      </a>`
    ).join("");
  }

  /* ---------- User dropdown ---------- */
  function bindUserMenu() {
    const menu = document.getElementById("userMenu");
    if (!menu) return;
    const btn = menu.querySelector(".user-menu__btn");

    const setOpen = (open) => {
      menu.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(!menu.classList.contains("is-open"));
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  /* ---------- Logout (any [data-logout] on the page) ---------- */
  function bindLogout() {
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-logout]");
      if (!btn) return;
      e.preventDefault();

      // gamitin ang confirm modal kung naka-load ang modal.js
      const ok = typeof Modal !== "undefined"
        ? await Modal.confirm({
            title: "Log out?",
            text: "You'll need to log in again to order.",
            icon: "🚪",
            okText: "Yes, log out",
          })
        : true;

      if (ok) Auth.logout();
    });
  }

  /* ---------- Live counts ---------- */
  let lastCount = null;

  function updateCartCount() {
    const count = Cart.count();

    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = count > 99 ? "99+" : count;
      el.dataset.count = count;

      // bounce kapag nadagdagan
      if (lastCount !== null && count > lastCount) {
        el.classList.remove("bump");
        void el.offsetWidth;              // restart animation
        el.classList.add("bump");
      }
    });
    lastCount = count;

    // Floating cart button sa home (mobile)
    const fab = document.getElementById("fabCart");
    if (fab) {
      fab.classList.toggle("has-items", count > 0);
      const total = document.getElementById("fabTotal");
      if (total) total.textContent = peso(Cart.totals().subtotal);
    }
  }

  function updateActiveOrders() {
    if (typeof Orders === "undefined") return;
    const active = Orders.active().length;
    document.querySelectorAll("[data-active-orders]").forEach((el) => {
      el.hidden = active === 0;
    });
  }

  /* ---------- Preferences: reduce motion ---------- */
  function applyPrefs() {
    const prefs = Store.getUser("prefs", {});
    document.body.classList.toggle("reduce-motion", !!prefs.reduceMotion);
  }

  /* ---------- Init ---------- */
  function init() {
    const user = Auth.current();
    if (!user) return;            // guard() na ang bahala mag-redirect

    applyPrefs();
    renderTop(user);
    renderBottom();
    bindUserMenu();
    bindLogout();
    updateCartCount();
    updateActiveOrders();

    // auto-update kapag nagbago ang cart / orders / prefs (kahit sa ibang tab)
    Store.on("*", (_value, key) => {
      if (key === "*" || key.startsWith("cart_") || key.startsWith("promo_") || key === "stock") updateCartCount();
      if (key === "*" || key === "orders") updateActiveOrders();
      if (key === "*" || key.startsWith("prefs_")) applyPrefs();
      if (key === "*" || key === "users") {
        const u = Auth.current();
        if (u) { renderTop(u); bindUserMenu(); updateCartCount(); updateActiveOrders(); }
      }
      if (key === "session" && !Auth.current()) Auth.guard();   // logged out sa ibang tab
    });
  }

  init();

  return { updateCartCount, updateActiveOrders, applyPrefs };
})();   