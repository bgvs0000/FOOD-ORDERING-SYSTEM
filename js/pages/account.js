/* ==========================================================
   ACCOUNT
   Tabs: Profile · Addresses · Security · Preferences
   Deep link: account.html#addresses
   ========================================================== */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  const AVATAR_COLORS = ["#FFC233", "#FF4B3E", "#3BB273", "#3B8EEA", "#A66BFF", "#FF8A1F"];
  let user = Auth.current();

  /* ---------- Shared form helpers ---------- */
  function setFieldError(form, name, message) {
    const input = form.elements[name];
    const field = input?.closest(".field");
    if (!field) return false;
    field.classList.remove("has-error");
    void field.offsetWidth;
    field.classList.add("has-error");
    $(".field__error", field).textContent = message;
    input.focus();
    return true;
  }

  function clearErrors(form) {
    $$(".field", form).forEach((f) => {
      f.classList.remove("has-error");
      const s = $(".field__error", f);
      if (s) s.textContent = "";
    });
  }

  function setLoading(btn, on) {
    btn.classList.toggle("is-loading", on);
    btn.disabled = on;
  }

  // alisin ang error habang nagta-type
  document.addEventListener("input", (e) => {
    const field = e.target.closest(".field.has-error");
    if (field) {
      field.classList.remove("has-error");
      const s = $(".field__error", field);
      if (s) s.textContent = "";
    }
  });

  /* ==========================================================
     PROFILE HEADER + BUN POINTS
     ========================================================== */
  function renderHeader() {
    user = Auth.current();
    const avatar = $("#profileAvatar");
    avatar.textContent = Auth.initials(user.name);
    avatar.style.setProperty("--c", user.avatarColor);

    $("#profileName").textContent = user.name;
    $("#profileEmail").textContent = user.email;
    $("#providerBadge").textContent = user.provider === "google" ? "🔐 Google account" : "✉️ Email account";
    $("#memberSince").textContent =
      "Member since " + new Date(user.createdAt).toLocaleDateString("en-PH", { month: "short", year: "numeric" });

    const s = Orders.stats();
    const inCycle = s.points % CONFIG.pointsForFreeBurger;
    $("#pointsValue").textContent = s.points;
    $("#pointsBar").style.width = (inCycle / CONFIG.pointsForFreeBurger) * 100 + "%";
    $("#pointsText").textContent =
      s.points === 0
        ? "Earn 1 point per ₱10 spent. 100 pts = free burger!"
        : `${s.pointsToNext} pts to your next free burger 🍔`;
  }

  // 🎨 cycle avatar color
  $("#changeAvatarBtn").addEventListener("click", () => {
    const i = AVATAR_COLORS.indexOf(user.avatarColor);
    const next = AVATAR_COLORS[(i + 1) % AVATAR_COLORS.length];
    Auth.updateProfile({ avatarColor: next });
    renderHeader();
  });

  /* ==========================================================
     TABS
     ========================================================== */
  const PANELS = ["profile", "addresses", "security", "preferences"];

  function showPanel(name) {
    if (!PANELS.includes(name)) name = "profile";
    $$(".account-tab[data-panel]").forEach((t) => {
      const on = t.dataset.panel === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    $$(".account-panel").forEach((p) => {
      const on = p.id === `panel-${name}`;
      p.hidden = !on;
      p.classList.toggle("is-active", on);
    });
    history.replaceState(null, "", "#" + name);
  }

  $$(".account-tab[data-panel]").forEach((tab) =>
    tab.addEventListener("click", () => showPanel(tab.dataset.panel))
  );

  /* ==========================================================
     1) PROFILE FORM
     ========================================================== */
  const profileForm = $("#profileForm");

  function fillProfile() {
    profileForm.elements.name.value = user.name;
    profileForm.elements.phone.value = user.phone || "";
    profileForm.elements.birthday.value = user.birthday || "";
    $("#pfEmail").value = user.email;
  }

  profileForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors(profileForm);
    const el = profileForm.elements;

    if (!Auth.validate.name(el.name.value)) return setFieldError(profileForm, "name", "Please enter your name.");
    if (el.phone.value.trim() && !Auth.validate.phone(el.phone.value)) {
      return setFieldError(profileForm, "phone", "Enter a valid PH mobile number.");
    }

    Auth.updateProfile({
      name: el.name.value.trim(),
      phone: el.phone.value.trim(),
      birthday: el.birthday.value,
    });
    renderHeader();
    Toast.success("Profile saved!");
  });

  // "Reset" = ibalik ang naka-save na values (hindi blanko)
  profileForm.addEventListener("reset", (e) => {
    e.preventDefault();
    clearErrors(profileForm);
    fillProfile();
  });

  /* ==========================================================
     2) ADDRESSES
     ========================================================== */
  const addressList = $("#addressList");
  const addressForm = $("#addressForm");

  const getAddresses = () => Store.getUser("addresses", []);
  const saveAddresses = (list) => Store.setUser("addresses", list);

  function renderAddresses() {
    const list = getAddresses();
    $("#noAddress").hidden = list.length > 0;

    addressList.innerHTML = list.map((a, i) => {
      const [icon, ...rest] = a.label.split(" ");
      return `
        <li class="address-card ${a.isDefault ? "is-default" : ""}" style="--i:${i}">
          <span class="address-card__icon">${esc(icon)}</span>
          <div class="address-card__body">
            <strong>${esc(rest.join(" ") || a.label)} ${a.isDefault ? '<span class="badge badge--green">Default</span>' : ""}</strong>
            <p>${esc(a.address)}</p>
            ${a.landmark ? `<small>📍 ${esc(a.landmark)}</small>` : ""}
          </div>
          <div class="address-card__actions">
            ${a.isDefault ? "" : `<button class="icon-btn" type="button" data-action="default" data-id="${a.id}" aria-label="Set as default" title="Set as default">⭐</button>`}
            <button class="icon-btn" type="button" data-action="edit" data-id="${a.id}" aria-label="Edit address">✏️</button>
            <button class="icon-btn" type="button" data-action="delete" data-id="${a.id}" aria-label="Delete address">🗑</button>
          </div>
        </li>`;
    }).join("");
  }

  function openAddressForm(addr = null) {
    clearErrors(addressForm);
    addressForm.reset();
    addressForm.elements.id.value = addr ? addr.id : "";
    if (addr) {
      addressForm.elements.label.value = addr.label;
      addressForm.elements.address.value = addr.address;
      addressForm.elements.landmark.value = addr.landmark || "";
      addressForm.elements.isDefault.checked = !!addr.isDefault;
    } else {
      addressForm.elements.isDefault.checked = getAddresses().length === 0;
    }
    addressForm.hidden = false;
    $("#addAddressBtn").hidden = true;
    addressForm.elements.address.focus();
  }

  function closeAddressForm() {
    addressForm.hidden = true;
    $("#addAddressBtn").hidden = false;
  }

  $("#addAddressBtn").addEventListener("click", () => openAddressForm());
  $("#cancelAddressBtn").addEventListener("click", closeAddressForm);

  addressForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors(addressForm);
    const el = addressForm.elements;

    if (el.address.value.trim().length < 8) {
      return setFieldError(addressForm, "address", "Please enter a complete address.");
    }

    const id = el.id.value || Store.uid("addr");
    const entry = {
      id,
      label: el.label.value,
      address: el.address.value.trim(),
      landmark: el.landmark.value.trim(),
      isDefault: el.isDefault.checked,
    };

    let list = getAddresses();
    const exists = list.some((a) => a.id === id);
    list = exists ? list.map((a) => (a.id === id ? entry : a)) : [...list, entry];

    // isa lang ang default
    if (entry.isDefault) list = list.map((a) => ({ ...a, isDefault: a.id === id }));
    if (!list.some((a) => a.isDefault)) list[0].isDefault = true;

    saveAddresses(list);
    closeAddressForm();
    Toast.success(exists ? "Address updated" : "Address added");
  });

  addressList.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    let list = getAddresses();
    const addr = list.find((a) => a.id === id);

    if (action === "edit") return openAddressForm(addr);

    if (action === "default") {
      saveAddresses(list.map((a) => ({ ...a, isDefault: a.id === id })));
      return Toast.success("Default address updated");
    }

    if (action === "delete") {
      const ok = await Modal.confirm({
        title: "Delete address?",
        text: addr.address,
        icon: "🗑",
        okText: "Delete",
      });
      if (!ok) return;
      list = list.filter((a) => a.id !== id);
      if (addr.isDefault && list.length) list[0].isDefault = true;
      saveAddresses(list);
      Toast.info("Address deleted");
    }
  });

  /* ==========================================================
     3) SECURITY
     ========================================================== */
  const pwForm = $("#passwordForm");

  function renderSecurity() {
    const google = user.provider === "google";
    $("#googleNotice").hidden = !google;
    pwForm.hidden = google;

    const session = Auth.session();
    if (session) {
      $("#sessionDevice").textContent = session.device || "This browser";
      $("#sessionTime").textContent =
        "Logged in " + new Date(session.loggedInAt).toLocaleString("en-PH", {
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        });
    }
  }

  const newPw = $("#pwNew");
  const meter = $(".pw-meter", pwForm);
  newPw.addEventListener("input", () => {
    meter.dataset.strength = Auth.validate.strength(newPw.value);
  });

  pwForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(pwForm);
    const btn = $('button[type="submit"]', pwForm);
    const data = Object.fromEntries(new FormData(pwForm));

    setLoading(btn, true);
    try {
      await Auth.changePassword(data);
      pwForm.reset();
      delete meter.dataset.strength;
      Toast.success("Password updated!", "Use your new password next time you log in.");
    } catch (err) {
      if (!err.field || !setFieldError(pwForm, err.field, err.message)) {
        Toast.error("Can't update password", err.message);
      }
    } finally {
      setLoading(btn, false);
    }
  });

  /* ==========================================================
     4) PREFERENCES
     ========================================================== */
  const prefsForm = $("#prefsForm");

  function fillPrefs() {
    const p = Store.getUser("prefs", {});
    prefsForm.elements.notifyOrders.checked = p.notifyOrders !== false;
    prefsForm.elements.notifyPromos.checked = p.notifyPromos !== false;
    prefsForm.elements.reduceMotion.checked = !!p.reduceMotion;
    prefsForm.elements.defaultPayment.value = p.defaultPayment || "gcash";
  }

  prefsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const el = prefsForm.elements;
    Store.setUser("prefs", {
      notifyOrders: el.notifyOrders.checked,
      notifyPromos: el.notifyPromos.checked,
      reduceMotion: el.reduceMotion.checked,
      defaultPayment: el.defaultPayment.value,
    });
    Navbar.applyPrefs();
    Toast.success("Preferences saved!");
  });

  // Reduce motion: preview agad kahit hindi pa naka-save
  prefsForm.elements.reduceMotion.addEventListener("change", (e) => {
    document.body.classList.toggle("reduce-motion", e.target.checked);
  });

  /* ==========================================================
     LOGOUT + RESET DEMO DATA
     ========================================================== */
  $("#logoutBtn").addEventListener("click", async () => {
    const ok = await Modal.confirm({
      title: "Log out?",
      text: "You'll need to log in again to order.",
      icon: "🚪",
      okText: "Yes, log out",
    });
    if (ok) Auth.logout();
  });

  $("#resetDataBtn").addEventListener("click", async () => {
    const ok = await Modal.confirm({
      title: "Reset demo data?",
      text: "This deletes all accounts, carts, and orders saved in this browser.",
      icon: "♻️",
      okText: "Reset everything",
    });
    if (!ok) return;
    Store.clearAll();
    try { sessionStorage.clear(); } catch (err) { /* ignore */ }
    window.location.href = "../index.html";
  });

  /* ==========================================================
     LIVE UPDATES + INIT
     ========================================================== */
  Store.on("*", (_v, key) => {
    if (!Auth.current()) return;
    if (key === "*" || key === "users" || key === "orders") renderHeader();
    if (key === "*" || key.startsWith("addresses_")) renderAddresses();
  });

  renderHeader();
  fillProfile();
  renderAddresses();
  renderSecurity();
  fillPrefs();
  showPanel(window.location.hash.slice(1));
})();   