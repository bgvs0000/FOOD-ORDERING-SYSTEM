/* ==========================================================
   STORE — localStorage wrapper
   Lahat ng data ay naka-save sa browser na may prefix "bv_".
   Sa totoong system: ito ang papalitan ng fetch() sa API.
   ========================================================== */
const Store = (() => {
  const PREFIX = "bv_";

  // Fallback kapag naka-block ang localStorage (private mode, etc.)
  const memory = {};
  let canUseLocal = true;
  try {
    const test = PREFIX + "__test";
    localStorage.setItem(test, "1");
    localStorage.removeItem(test);
  } catch (e) {
    canUseLocal = false;
    console.warn("[Store] localStorage unavailable — using memory only.");
  }

  /* ---------- Low-level read/write ---------- */
  function rawGet(key) {
    try {
      return canUseLocal ? localStorage.getItem(PREFIX + key) : memory[key] ?? null;
    } catch (e) {
      return memory[key] ?? null;
    }
  }

  function rawSet(key, value) {
    try {
      if (canUseLocal) localStorage.setItem(PREFIX + key, value);
      else memory[key] = value;
    } catch (e) {
      memory[key] = value;
    }
  }

  function rawRemove(key) {
    try {
      if (canUseLocal) localStorage.removeItem(PREFIX + key);
    } catch (e) { /* ignore */ }
    delete memory[key];
  }

  /* ---------- Change events ----------
     Kapag may nag-save, nagpapadala ito ng "store:change" event
     para mag-update ang navbar badge, totals, atbp.
  ------------------------------------------------------------ */
  function emit(key, value) {
    window.dispatchEvent(
      new CustomEvent("store:change", { detail: { key, value } })
    );
  }

  /* ---------- Public API ---------- */
  return {
    /** Kunin ang value (auto JSON.parse). May fallback kapag wala. */
    get(key, fallback = null) {
      const raw = rawGet(key);
      if (raw === null || raw === undefined) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },

    /** I-save ang value (auto JSON.stringify) */
    set(key, value) {
      rawSet(key, JSON.stringify(value));
      emit(key, value);
      return value;
    },

    /** Kunin → baguhin → i-save, in one step */
    update(key, fallback, updater) {
      const next = updater(this.get(key, fallback));
      return this.set(key, next);
    },

    remove(key) {
      rawRemove(key);
      emit(key, null);
    },

    /** Burahin LAHAT ng bv_ data (Reset demo data) */
    clearAll() {
      try {
        if (canUseLocal) {
          Object.keys(localStorage)
            .filter((k) => k.startsWith(PREFIX))
            .forEach((k) => localStorage.removeItem(k));
        }
      } catch (e) { /* ignore */ }
      Object.keys(memory).forEach((k) => delete memory[k]);
      emit("*", null);
    },

    /** Listen sa changes ng isang key (o "*" para sa lahat) */
    on(key, callback) {
      const handler = (e) => {
        if (key === "*" || e.detail.key === key || e.detail.key === "*") {
          callback(e.detail.value, e.detail.key);
        }
      };
      window.addEventListener("store:change", handler);
      return () => window.removeEventListener("store:change", handler);
    },

    /* ---------- Per-user keys ----------
       Bawat user ay may sariling cart, addresses, prefs.
       e.g. "cart" → "cart_u_1696512345"
    -------------------------------------------------- */
    currentUserId() {
      const session = this.get("session");
      return session ? session.userId : "guest";
    },

    userKey(base) {
      return base + "_" + this.currentUserId();
    },

    getUser(base, fallback = null) {
      return this.get(this.userKey(base), fallback);
    },

    setUser(base, value) {
      return this.set(this.userKey(base), value);
    },

    updateUser(base, fallback, updater) {
      return this.update(this.userKey(base), fallback, updater);
    },

    /* ---------- Helpers ---------- */

    /** Unique ID: Store.uid("u") → "u_lx2k9a3f" */
    uid(prefix = "id") {
      return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    },

    /** Fake network delay para mukhang totoong API (loading states) */
    delay(ms = 600) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  };
})();

/* ---------- Sync across browser tabs ----------
   Kapag nag-add sa cart sa isang tab, mag-a-update din ang ibang tab.
------------------------------------------------- */
window.addEventListener("storage", (e) => {
  if (e.key && e.key.startsWith("bv_")) {
    let value = null;
    try { value = JSON.parse(e.newValue); } catch (err) { /* ignore */ }
    window.dispatchEvent(
      new CustomEvent("store:change", { detail: { key: e.key.slice(3), value } })
    );
  }
});