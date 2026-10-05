/* ==========================================================
   MODAL — reusable open/close for any .modal
   Usage:
     Modal.open("authModal");
     Modal.close("authModal");
     const ok = await Modal.confirm({ title: "Log out?", okText: "Yes" });

   Closing:
     - any element with [data-close-modal] inside the modal
     - ESC key
   ========================================================== */
const Modal = (() => {
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const stack = [];          // open modals (para sa nested)
  let lastFocused = null;    // ibabalik ang focus dito pagsara

  function getEl(target) {
    return typeof target === "string" ? document.getElementById(target) : target;
  }

  function visibleFocusables(modal) {
    return [...modal.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }

  /* ---------- Open ---------- */
  function open(target, { focus = null } = {}) {
    const modal = getEl(target);
    if (!modal || modal.classList.contains("is-open")) return;

    if (stack.length === 0) lastFocused = document.activeElement;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    stack.push(modal);

    // focus ang unang input/button pagkatapos ng animation
    setTimeout(() => {
      const el = focus ? modal.querySelector(focus) : visibleFocusables(modal).find((f) => !f.matches("[data-close-modal]")) ;
      (el || modal.querySelector(".modal__dialog"))?.focus({ preventScroll: true });
    }, 80);

    modal.dispatchEvent(new CustomEvent("modal:open", { bubbles: true }));
  }

  /* ---------- Close ---------- */
  function close(target) {
    const modal = target ? getEl(target) : stack[stack.length - 1];
    if (!modal || !modal.classList.contains("is-open")) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    const i = stack.indexOf(modal);
    if (i > -1) stack.splice(i, 1);

    if (stack.length === 0) {
      document.body.classList.remove("modal-open");
      lastFocused?.focus?.({ preventScroll: true });
    }

    modal.dispatchEvent(new CustomEvent("modal:close", { bubbles: true }));
  }

  function closeAll() {
    [...stack].reverse().forEach((m) => close(m));
  }

  function isOpen(target) {
    const modal = getEl(target);
    return !!modal && modal.classList.contains("is-open");
  }

  /* ---------- Global listeners ---------- */

  // [data-close-modal] buttons + overlay
  document.addEventListener("click", (e) => {
    const closer = e.target.closest("[data-close-modal]");
    if (closer) {
      const modal = closer.closest(".modal");
      if (modal && !modal.hasAttribute("data-static")) close(modal);
    }
  });

  document.addEventListener("keydown", (e) => {
    const top = stack[stack.length - 1];
    if (!top) return;

    // ESC = close (unless data-static)
    if (e.key === "Escape" && !top.hasAttribute("data-static")) {
      e.preventDefault();
      close(top);
      return;
    }

    // Focus trap: hindi lalabas ang Tab sa modal
    if (e.key === "Tab") {
      const items = visibleFocusables(top);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ==========================================================
     CONFIRM DIALOG (returns Promise<boolean>)
     Uses #confirmModal kung meron sa page (account.html);
     kung wala, gagawa ng isa.
     ========================================================== */
  function ensureConfirmModal() {
    let modal = document.getElementById("confirmModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "confirmModal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="modal__overlay" data-close-modal></div>
      <div class="modal__dialog modal__dialog--small" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" tabindex="-1">
        <div class="confirm">
          <div class="confirm__icon" id="confirmIcon">❓</div>
          <h2 id="confirmTitle">Are you sure?</h2>
          <p id="confirmText"></p>
          <div class="confirm__actions">
            <button class="btn" data-close-modal type="button">Cancel</button>
            <button class="btn btn--primary" id="confirmOkBtn" type="button">Confirm</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function confirm({ title = "Are you sure?", text = "", icon = "❓", okText = "Confirm" } = {}) {
    const modal = ensureConfirmModal();
    modal.querySelector("#confirmTitle").textContent = title;
    modal.querySelector("#confirmText").textContent = text;
    modal.querySelector("#confirmIcon").textContent = icon;

    // palitan ang OK button para matanggal ang lumang listeners
    const oldOk = modal.querySelector("#confirmOkBtn");
    const okBtn = oldOk.cloneNode(true);
    okBtn.textContent = okText;
    oldOk.replaceWith(okBtn);

    return new Promise((resolve) => {
      let answered = false;

      okBtn.addEventListener("click", () => {
        answered = true;
        close(modal);
        resolve(true);
      }, { once: true });

      modal.addEventListener("modal:close", () => {
        if (!answered) resolve(false);
      }, { once: true });

      open(modal, { focus: "#confirmOkBtn" });
    });
  }

  return { open, close, closeAll, isOpen, confirm };
})();