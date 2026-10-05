/* ==========================================================
   TOAST — small notifications
   Usage:
     Toast.success("Logged in!", "Welcome back, Juan");
     Toast.error("Oops", "Something went wrong");
     Toast.cart(product, 2);      // "Added to cart" with image + View cart
   ========================================================== */
const Toast = (() => {
  const MAX = 4;
  const ICONS = { success: "✓", error: "!", info: "i", warning: "⚠", cart: "🛒" };

  /** Iwas XSS: gawing plain text ang galing sa user/data */
  function esc(text = "") {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  function container() {
    let el = document.getElementById("toasts");
    if (!el) {
      el = document.createElement("div");
      el.id = "toasts";
      el.className = "toasts";
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }

  function dismiss(toast) {
    if (!toast || toast.classList.contains("is-leaving")) return;
    clearTimeout(toast._timer);
    toast.classList.add("is-leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    // fallback kapag naka-reduce motion (walang animationend)
    setTimeout(() => toast.remove(), 400);
  }

  /**
   * @param {Object} opts
   * type:     "success" | "error" | "info" | "warning" | "cart"
   * title:    bold text
   * message:  small text
   * duration: ms (default 3000, 0 = stay until closed)
   * image:    image url (replaces icon)
   * action:   { label: "View cart", href: "cart.html" }
   */
  function show({ type = "info", title = "", message = "", duration = 3000, image = null, action = null } = {}) {
    const box = container();

    // limit sa dami — tanggalin ang pinakaluma
    const existing = box.querySelectorAll(".toast:not(.is-leaving)");
    if (existing.length >= MAX) dismiss(existing[0]);

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.style.setProperty("--duration", duration + "ms");

    toast.innerHTML = `
      ${image
        ? `<img class="toast__img" src="${esc(image)}" alt="">`
        : `<span class="toast__icon" aria-hidden="true">${ICONS[type] || "i"}</span>`}
      <div class="toast__body">
        <strong class="toast__title">${esc(title)}</strong>
        ${message ? `<p class="toast__msg">${esc(message)}</p>` : ""}
      </div>
      ${action ? `<a class="toast__action" href="${esc(action.href)}">${esc(action.label)}</a>` : ""}
      <button class="toast__close" type="button" aria-label="Dismiss">✕</button>
      ${duration > 0 ? `<span class="toast__bar"></span>` : ""}
    `;

    toast.querySelector(".toast__close").addEventListener("click", () => dismiss(toast));
    box.appendChild(toast);

    /* ---------- Auto-dismiss with pause on hover ---------- */
    if (duration > 0) {
      let remaining = duration;
      let startedAt = Date.now();

      const start = () => {
        startedAt = Date.now();
        toast._timer = setTimeout(() => dismiss(toast), remaining);
      };
      const pause = () => {
        clearTimeout(toast._timer);
        remaining -= Date.now() - startedAt;
      };

      toast.addEventListener("mouseenter", pause);
      toast.addEventListener("mouseleave", start);
      start();
    }

    return toast;
  }

  /* ---------- Shortcuts ---------- */
  return {
    show,
    dismiss,

    success(title, message = "", opts = {}) {
      return show({ type: "success", title, message, ...opts });
    },

    error(title, message = "", opts = {}) {
      return show({ type: "error", title, message, duration: 4500, ...opts });
    },

    info(title, message = "", opts = {}) {
      return show({ type: "info", title, message, ...opts });
    },

    warning(title, message = "", opts = {}) {
      return show({ type: "warning", title, message, duration: 4000, ...opts });
    },

    /** Special: product image + "View cart" button */
    cart(product, qty = 1) {
      const onCartPage = window.location.pathname.endsWith("cart.html");
      return show({
        type: "cart",
        title: "Added to cart!",
        message: `${product.name} × ${qty}`,
        image: assetPath(product.image),
        action: onCartPage ? null : { label: "View", href: "cart.html" },
        duration: 3200,
      });
    },

    /** Mock lang na feature (call rider, forgot password, etc.) */
    demo(feature = "This feature") {
      return show({
        type: "info",
        title: "Demo only",
        message: `${feature} isn't available in this mockup.`,
      });
    },
  };
})();