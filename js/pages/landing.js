/* ==========================================================
   LANDING PAGE
   - navbar scroll + mobile menu
   - featured menu cards
   - "Order Now" → auth modal (or straight to app if logged in)
   - login / register / Google forms
   - promo video
   ========================================================== */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(text = "") {
    const d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  /* ==========================================================
     1) NAVBAR
     ========================================================== */
  const nav = $("#nav");
  const navToggle = $("#navToggle");

  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function setMenu(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  navToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenu(!nav.classList.contains("is-open"));
  });
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("click", (e) => {
    if (nav && !nav.contains(e.target)) setMenu(false);
  });

  /* ==========================================================
     2) FEATURED MENU
     ========================================================== */
  function productCard(p, i) {
    const soldOut = Menu.stock(p.id) === 0;
    const cat = Menu.category(p.category);

    return `
      <article class="product-card ${soldOut ? "is-soldout" : ""}"
               style="--accent:${p.accent}; --delay:${(i * 0.08).toFixed(2)}s"
               data-reveal="up">
        <a href="#" class="product-card__media tilt" data-tilt data-tilt-max="16"
           data-product="${p.id}" aria-label="Order ${esc(p.name)}">
          <img class="tilt__img" src="${assetPath(p.image)}" alt="${esc(p.name)}" loading="lazy" />
          <span class="tilt__glare"></span>
        </a>
        ${p.tag ? `<span class="product-card__tag" data-tag="${esc(p.tag)}">${esc(p.tag)}</span>` : ""}
        <div class="product-card__body">
          <span class="product-card__cat">${cat ? cat.emoji + " " + esc(cat.name) : ""}</span>
          <h3 class="product-card__name">${esc(p.name)}</h3>
          <p class="product-card__desc">${esc(p.desc)}</p>
          <div class="product-card__meta">
            <span><span class="star">★</span> ${p.rating}</span>
            <span>🔥 ${p.calories} kcal</span>
          </div>
          <div class="product-card__foot">
            <span class="price">${peso(p.price)}</span>
            <button class="add-btn" type="button" data-product="${p.id}"
                    aria-label="Order ${esc(p.name)}" ${soldOut ? "disabled" : ""}>+</button>
          </div>
        </div>
      </article>`;
  }

  function renderFeatured() {
    const grid = $("#featuredGrid");
    if (!grid) return;
    grid.innerHTML = Menu.featured().map(productCard).join("");
    if (typeof ScrollReveal !== "undefined") ScrollReveal.observe(grid);
  }

  // Card o "+" → product page (kung naka-login) o login muna
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-product]");
    if (!el) return;
    e.preventDefault();
    const target = `product.html?id=${el.dataset.product}`;
    if (Auth.isLoggedIn()) {
      window.location.href = "app/" + target;
    } else {
      openAuth("login", target);
    }
  });

  /* ==========================================================
     3) ORDER NOW BUTTONS
     ========================================================== */
  $$("[data-order-now]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (Auth.isLoggedIn()) {
        window.location.href = "app/home.html";
      } else {
        openAuth("login");
      }
    })
  );

  /* ==========================================================
     4) AUTH MODAL
     ========================================================== */
  const modal        = $("#authModal");
  const tabs         = modal ? $(".tabs", modal) : null;
  const title        = $("#authTitle");
  const sub          = $("#authSub");
  const loginForm    = $("#loginForm");
  const registerForm = $("#registerForm");
  const googleBtn    = $("#googleBtn");

  const COPY = {
    login:    { title: "Welcome back!",  sub: "Log in to start ordering." },
    register: { title: "Join the crew!", sub: "Create an account in seconds." },
  };

  let pendingNext = null;   // saan pupunta pagka-login (e.g. product page)

  function openAuth(tab = "login", next = null) {
    if (!modal) return;
    pendingNext = next;
    switchTab(tab);
    Modal.open(modal);
  }

  function switchTab(tab) {
    if (!tabs) return;
    tabs.dataset.active = tab;
    $$(".tabs__btn", tabs).forEach((b) => {
      const active = b.dataset.tab === tab;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    $$(".auth-form", modal).forEach((f) => f.classList.toggle("is-active", f.dataset.form === tab));
    title.textContent = COPY[tab].title;
    sub.textContent = COPY[tab].sub;
    clearErrors(loginForm);
    clearErrors(registerForm);
    setTimeout(() => $(`[data-form="${tab}"] input`, modal)?.focus(), 80);
  }

  if (tabs) {
    $$(".tabs__btn", tabs).forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  }

  /* ---------- Form helpers ---------- */
  function setFieldError(form, name, message) {
    const input = form.elements[name];
    const field = input?.closest(".field");
    if (!field) return false;
    field.classList.remove("has-error");
    void field.offsetWidth;                 // restart shake animation
    field.classList.add("has-error");
    const small = $(".field__error", field);
    if (small) small.textContent = message;
    input.focus();
    return true;
  }

  function setFormError(form, message) {
    const el = $(".form-error", form);
    if (el) el.textContent = message;
  }

  function clearErrors(form) {
    if (!form) return;
    $$(".field", form).forEach((f) => {
      f.classList.remove("has-error");
      const small = $(".field__error", f);
      if (small) small.textContent = "";
    });
    setFormError(form, "");
  }

  function showError(form, err) {
    const placed = err.field && setFieldError(form, err.field, err.message);
    if (!placed) setFormError(form, err.message);
  }

  function setLoading(btn, loading) {
    btn.classList.toggle("is-loading", loading);
    btn.disabled = loading;
  }

  // alisin ang error habang nagta-type
  if (modal) {
    modal.addEventListener("input", (e) => {
      const field = e.target.closest(".field.has-error");
      if (field) {
        field.classList.remove("has-error");
        const small = $(".field__error", field);
        if (small) small.textContent = "";
      }
    });
  }

  /* ---------- After successful auth ---------- */
  function onAuthSuccess(user, message) {
    Toast.success(message, `Hi ${Auth.firstName(user.name)}! Taking you to the menu…`);
    setTimeout(() => {
      if (pendingNext) {
        window.location.href = "app/" + pendingNext;
      } else {
        Auth.redirectAfterLogin();   // respects ?next= from guard()
      }
    }, 900);
  }

  /* ---------- LOGIN ---------- */
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(loginForm);
    const btn = $('button[type="submit"]', loginForm);
    const data = Object.fromEntries(new FormData(loginForm));

    setLoading(btn, true);
    try {
      const user = await Auth.login({
        email: data.email,
        password: data.password,
        remember: !!data.remember,
      });
      onAuthSuccess(user, "Logged in!");
    } catch (err) {
      showError(loginForm, err);
      setLoading(btn, false);
    }
  });

  /* ---------- REGISTER ---------- */
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(registerForm);
    const btn = $('button[type="submit"]', registerForm);
    const data = Object.fromEntries(new FormData(registerForm));

    setLoading(btn, true);
    try {
      const user = await Auth.register({ ...data, terms: !!data.terms });
      onAuthSuccess(user, "Account created!");
    } catch (err) {
      showError(registerForm, err);
      setLoading(btn, false);
    }
  });

  /* ---------- GOOGLE (mock) ---------- */
  googleBtn?.addEventListener("click", async () => {
    setLoading(googleBtn, true);
    try {
      const user = await Auth.loginWithGoogle();
      onAuthSuccess(user, "Signed in with Google!");
    } catch (err) {
      Toast.error("Google sign-in failed", err.message);
      setLoading(googleBtn, false);
    }
  });

  /* ---------- Show / hide password ---------- */
  $$(".pw-toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("is-shown", show);
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      btn.textContent = show ? "🙈" : "👁";
    })
  );

  /* ---------- Password strength meter ---------- */
  const regPw = $("#regPassword");
  const meter = registerForm ? $(".pw-meter", registerForm) : null;
  if (regPw && meter) {
    regPw.addEventListener("input", () => {
      meter.dataset.strength = Auth.validate.strength(regPw.value);
    });
  }

  /* ---------- Demo hint: click to autofill ---------- */
  const demoHint = loginForm ? $(".demo-hint", loginForm) : null;
  demoHint?.addEventListener("click", () => {
    loginForm.elements.email.value = Auth.DEMO.email;
    loginForm.elements.password.value = Auth.DEMO.password;
    Toast.info("Demo account filled", "Click Log In to continue.");
  });

  $("#forgotLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    Toast.demo("Password reset");
  });

  /* ---------- Opened via guard() redirect: index.html?login=1 ---------- */
  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "1" && !Auth.isLoggedIn()) {
    setTimeout(() => {
      openAuth("login");
      Toast.info("Please log in first", "You need an account to order.");
    }, 400);
  }

  /* ==========================================================
     5) PROMO VIDEO
     ========================================================== */
  const video = $("#promoVideo");
  const playBtn = $("#videoPlay");
  const frame = video ? video.closest(".video-frame") : null;

  const PLAY_ICON  = `<svg viewBox="0 0 24 24" width="34" height="34"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`;
  const PAUSE_ICON = `<svg viewBox="0 0 24 24" width="30" height="30"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>`;

  if (video && playBtn && frame) {
    playBtn.addEventListener("click", async () => {
      if (video.paused) {
        try {
          await video.play();
          frame.classList.add("is-playing");
          playBtn.setAttribute("aria-label", "Pause video");
          playBtn.innerHTML = PAUSE_ICON;
        } catch (err) {
          Toast.info("No video yet", "Add your clip at assets/videos/promo.mp4");
        }
      } else {
        video.pause();
        frame.classList.remove("is-playing");
        playBtn.setAttribute("aria-label", "Play video");
        playBtn.innerHTML = PLAY_ICON;
      }
    });

    // auto-pause kapag naka-scroll na palayo
    new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && !video.paused) playBtn.click();
    }, { threshold: 0.2 }).observe(video);
  }

  /* ---------- Init ---------- */
  renderFeatured();
})();