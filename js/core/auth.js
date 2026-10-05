/* ==========================================================
   AUTH — customer + admin
   - Customer session: "session"        (store side)
   - Admin session:    "admin_session"  (admin side)
   Magkahiwalay para puwedeng sabay naka-login ang customer
   at admin sa iisang browser (two-tab demo).
   ⚠️ MOCKUP ONLY: walang totoong security dito.
   ========================================================== */
const Auth = (() => {

  const DEMO_USER  = { name: "Demo Burger Lover", email: "demo@bunvoyage.com",  password: "burger123", role: "customer" };
  const DEMO_ADMIN = { name: "Kitchen Admin",     email: "admin@bunvoyage.com", password: "admin123",  role: "admin" };

  const AVATAR_COLORS = ["#FFC233", "#FF4B3E", "#3BB273", "#3B8EEA", "#A66BFF", "#FF8A1F"];

  class AuthError extends Error {
    constructor(message, field = null) {
      super(message);
      this.name = "AuthError";
      this.field = field;
    }
  }

  /* ---------- Fake hash (DEMO ONLY — hindi secure!) ---------- */
  function fakeHash(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
    return "h$" + (h >>> 0).toString(16);
  }

  /* ---------- Validators ---------- */
  const validate = {
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()),
    name: (v) => String(v).trim().length >= 2,
    password: (v) => String(v).length >= 6,
    phone: (v) => /^(09|\+639)\d{9}$/.test(String(v).replace(/[\s-]/g, "")),
    strength(value) {
      const pw = String(value);
      if (!pw) return 0;
      let score = 0;
      if (pw.length >= 6) score++;
      if (pw.length >= 10) score++;
      if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
      if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
      return Math.max(1, score);
    },
  };

  /* ---------- Users table ---------- */
  const getUsers = () => Store.get("users", []);
  const saveUsers = (users) => Store.set("users", users);
  const roleOf = (u) => (u && u.role) || "customer";   // lumang users = customer

  function findByEmail(email) {
    const e = String(email).trim().toLowerCase();
    return getUsers().find((u) => u.email === e) || null;
  }

  function createUser({ name, email, password = null, provider = "email", role = "customer", createdAt = null }) {
    const user = {
      id: Store.uid("u"),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: password ? fakeHash(password) : null,
      provider,
      role,
      phone: "",
      birthday: "",
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      createdAt: createdAt || new Date().toISOString(),
    };
    saveUsers([...getUsers(), user]);
    return user;
  }

  function seedAccounts() {
    if (!findByEmail(DEMO_USER.email)) createUser({ ...DEMO_USER });
    if (!findByEmail(DEMO_ADMIN.email)) createUser({ ...DEMO_ADMIN });
  }

  /* ---------- Sessions ---------- */
  function startSession(key, user, remember = true) {
    Store.set(key, {
      userId: user.id,
      loggedInAt: new Date().toISOString(),
      remember,
      device: navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Desktop browser",
    });
    try { sessionStorage.setItem("bv_tab", "1"); } catch (e) { /* ignore */ }
  }

  function getSession(key = "session") {
    const session = Store.get(key);
    if (!session) return null;
    if (!session.remember) {
      let alive = false;
      try { alive = sessionStorage.getItem("bv_tab") === "1"; } catch (e) { alive = true; }
      if (!alive) {
        Store.remove(key);
        return null;
      }
    }
    return session;
  }

  function userFromSession(key) {
    const s = getSession(key);
    return s ? getUsers().find((u) => u.id === s.userId) || null : null;
  }

  /* ---------- Paths: root vs /app/ vs /admin/ ---------- */
  const path = () => window.location.pathname;
  const nested = () => path().includes("/app/") || path().includes("/admin/");
  const landingUrl = () => (nested() ? "../index.html" : "index.html");
  const appUrl = (page = "home.html") =>
    path().includes("/app/") ? page : nested() ? "../app/" + page : "app/" + page;
  const adminUrl = (page = "dashboard.html") =>
    path().includes("/admin/") ? page : nested() ? "../admin/" + page : "admin/" + page;

  seedAccounts();

  /* ==========================================================
     PUBLIC API
     ========================================================== */
  return {
    AuthError,
    validate,
    roleOf,

    /* ===== CUSTOMER ===== */

    async register({ name, email, password, confirm, terms }) {
      await Store.delay(700);
      if (!validate.name(name))         throw new AuthError("Please enter your full name.", "name");
      if (!validate.email(email))       throw new AuthError("Please enter a valid email.", "email");
      if (findByEmail(email))           throw new AuthError("This email is already registered. Try logging in.", "email");
      if (!validate.password(password)) throw new AuthError("Password must be at least 6 characters.", "password");
      if (password !== confirm)         throw new AuthError("Passwords do not match.", "confirm");
      if (!terms)                       throw new AuthError("Please accept the Terms to continue.");

      const user = createUser({ name, email, password });
      startSession("session", user, true);
      return user;
    },

    async login({ email, password, remember = true }) {
      await Store.delay(600);
      if (!validate.email(email)) throw new AuthError("Please enter a valid email.", "email");
      if (!password)              throw new AuthError("Please enter your password.", "password");

      const user = findByEmail(email);
      if (!user) throw new AuthError("No account found with this email.", "email");
      if (user.provider === "google" && !user.passwordHash) {
        throw new AuthError("This account uses Google. Click “Continue with Google”.");
      }
      if (user.passwordHash !== fakeHash(password)) {
        throw new AuthError("Incorrect password. Please try again.", "password");
      }

      startSession("session", user, remember);
      return user;
    },

    async loginWithGoogle() {
      await Store.delay(1100);
      let user = findByEmail("google.user@gmail.com");
      if (!user) user = createUser({ name: "Google User", email: "google.user@gmail.com", provider: "google" });
      startSession("session", user, true);
      return user;
    },

    logout(redirect = true) {
      Store.remove("session");
      if (redirect) window.location.href = landingUrl();
    },

    current() {
      return userFromSession("session");
    },

    session() {
      return getSession("session");
    },

    isLoggedIn() {
      return !!this.current();
    },

    updateProfile(patch) {
      const me = this.current();
      if (!me) throw new AuthError("Not logged in.");
      const allowed = ["name", "phone", "birthday", "avatarColor"];
      const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
      saveUsers(getUsers().map((u) => (u.id === me.id ? { ...u, ...clean } : u)));
      return { ...me, ...clean };
    },

    async changePassword({ current, next, confirm }) {
      await Store.delay(500);
      const me = this.current();
      if (!me) throw new AuthError("Not logged in.");
      if (me.provider === "google") throw new AuthError("Google accounts can't change password here.");
      if (me.passwordHash !== fakeHash(current)) throw new AuthError("Current password is incorrect.", "current");
      if (!validate.password(next))              throw new AuthError("New password must be at least 6 characters.", "next");
      if (next === current)                      throw new AuthError("New password must be different.", "next");
      if (next !== confirm)                      throw new AuthError("Passwords do not match.", "confirm");
      saveUsers(getUsers().map((u) => (u.id === me.id ? { ...u, passwordHash: fakeHash(next) } : u)));
      return true;
    },

    /** Ilagay sa /app/*.html — customer lang */
    guard() {
      if (!this.isLoggedIn()) {
        const back = encodeURIComponent(path().split("/").pop() + window.location.search);
        window.location.replace(landingUrl() + "?login=1&next=" + back);
      }
    },

    redirectAfterLogin() {
      const next = new URLSearchParams(window.location.search).get("next");
      const safe = next && /^[a-z]+\.html(\?[\w=&-]*)?$/i.test(next) ? next : "home.html";
      window.location.href = appUrl(safe);
    },

    /* ===== ADMIN ===== */

    async loginAdmin({ email, password }) {
      await Store.delay(600);
      if (!validate.email(email)) throw new AuthError("Please enter a valid email.", "email");
      if (!password)              throw new AuthError("Please enter your password.", "password");

      const user = findByEmail(email);
      if (!user || user.passwordHash !== fakeHash(password)) {
        throw new AuthError("Wrong email or password.", "password");
      }
      if (roleOf(user) !== "admin") {
        throw new AuthError("This account doesn't have admin access.", "email");
      }

      startSession("admin_session", user, true);
      return user;
    },

    adminCurrent() {
      const u = userFromSession("admin_session");
      return u && roleOf(u) === "admin" ? u : null;
    },

    adminSession() {
      return getSession("admin_session");
    },

    isAdmin() {
      return !!this.adminCurrent();
    },

    logoutAdmin(redirect = true) {
      Store.remove("admin_session");
      if (redirect) window.location.href = adminUrl("login.html");
    },

    /** Ilagay sa /admin/*.html (maliban sa login) */
    guardAdmin() {
      if (!this.isAdmin()) window.location.replace(adminUrl("login.html"));
    },

    /** Para sa admin pages: lahat ng users */
    allUsers() {
      return getUsers();
    },

    /** Para sa sample data ng admin dashboard */
    createDemoCustomer(name, email, createdAt) {
      return findByEmail(email) || createUser({ name, email, password: "burger123", createdAt });
    },

    /* ===== HELPERS ===== */
    initials(name = "") {
      return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
    },

    firstName(name = "") {
      return name.trim().split(/\s+/)[0] || "friend";
    },

    DEMO: { email: DEMO_USER.email, password: DEMO_USER.password },
    DEMO_ADMIN: { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password },
  };
})();