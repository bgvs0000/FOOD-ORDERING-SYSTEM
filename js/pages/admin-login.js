/* ==========================================================
   ADMIN LOGIN
   ========================================================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  const form = $("#adminLoginForm");
  if (!form) return;
  const btn = $('button[type="submit"]', form);
  const formError = $(".form-error", form);

  /* ---------- Una: wag hayaang mag-refresh kahit may error ---------- */
  form.addEventListener("submit", (e) => e.preventDefault());

  function showError(msg) {
    if (formError) formError.textContent = msg;
    console.error("[Admin login]", msg);
  }

  /* ---------- Check kung kumpleto ang files ---------- */
  const missing = [];
  if (typeof Store === "undefined") missing.push("js/core/storage.js");
  if (typeof Auth === "undefined") missing.push("js/core/auth.js");
  else if (typeof Auth.loginAdmin !== "function" || typeof Auth.isAdmin !== "function")
    missing.push("js/core/auth.js (luma pa — palitan ng bagong version)");
  if (typeof Toast === "undefined") missing.push("js/ui/toast.js");

  if (missing.length) {
    showError("⚠️ Hindi ma-load: " + missing.join(", "));
    btn.disabled = true;
    return;
  }

  // naka-login na → diretso sa dashboard
  if (Auth.isAdmin()) {
    window.location.replace("dashboard.html");
    return;
  }

  /* ---------- Helpers ---------- */
  function setFieldError(name, message) {
    const input = form.elements[name];
    const field = input && input.closest(".field");
    if (!field) return false;
    field.classList.remove("has-error");
    void field.offsetWidth;
    field.classList.add("has-error");
    $(".field__error", field).textContent = message;
    input.focus();
    return true;
  }

  function clearErrors() {
    form.querySelectorAll(".field").forEach((f) => {
      f.classList.remove("has-error");
      const s = $(".field__error", f);
      if (s) s.textContent = "";
    });
    if (formError) formError.textContent = "";
  }

  form.addEventListener("input", (e) => {
    const field = e.target.closest(".field.has-error");
    if (field) {
      field.classList.remove("has-error");
      $(".field__error", field).textContent = "";
    }
  });

  /* ---------- Submit ---------- */
  form.addEventListener("submit", async () => {
    clearErrors();
    const data = Object.fromEntries(new FormData(form));

    btn.classList.add("is-loading");
    btn.disabled = true;
    try {
      const admin = await Auth.loginAdmin(data);

      // siguraduhing na-save talaga ang session bago lumipat
      if (!Auth.isAdmin()) {
        throw new Error("Na-login pero walang admin session na na-save. Check js/core/auth.js at storage.js.");
      }

      Toast.success("Welcome back!", `Signed in as ${admin.name}`);
      setTimeout(() => window.location.replace("dashboard.html"), 700);
    } catch (err) {
      if (!err.field || !setFieldError(err.field, err.message)) {
        showError(err.message || "Something went wrong.");
      }
      btn.classList.remove("is-loading");
      btn.disabled = false;
    }
  });

  /* ---------- Show / hide password ---------- */
  const pwToggle = form.querySelector(".pw-toggle");
  if (pwToggle) {
    pwToggle.addEventListener("click", (e) => {
      const input = e.currentTarget.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      e.currentTarget.textContent = show ? "🙈" : "👁";
    });
  }

  /* ---------- Demo autofill ---------- */
  const hint = $("#adminDemoHint");
  if (hint) {
    hint.addEventListener("click", () => {
      form.elements.email.value = (Auth.DEMO_ADMIN && Auth.DEMO_ADMIN.email) || "admin@bunvoyage.com";
      form.elements.password.value = (Auth.DEMO_ADMIN && Auth.DEMO_ADMIN.password) || "admin123";
      Toast.info("Demo admin filled", "Click Open Dashboard to continue.");
    });
  }
})();