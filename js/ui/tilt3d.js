/* ==========================================================
   TILT 3D — makes [data-tilt] elements follow the mouse
   HTML:
     <div class="tilt" data-tilt data-tilt-max="18">
       <img class="tilt__img" src="...">
       <span class="tilt__glare"></span>
     </div>
   Options (data attributes):
     data-tilt-max="15"     max rotation in degrees
     data-tilt-reverse      tilt away from the pointer
   CSS (animations.css) does the 3D; JS only sets --rx, --ry, --gx, --gy.
   ========================================================== */
const Tilt = (() => {

  function motionAllowed() {
    const osReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const userReduce = document.body.classList.contains("reduce-motion");
    return !osReduce && !userReduce;
  }

  function bind(el) {
    if (el.dataset.tiltBound) return;     // iwas double-binding
    el.dataset.tiltBound = "1";

    const max = parseFloat(el.dataset.tiltMax) || 15;
    const dir = el.hasAttribute("data-tilt-reverse") ? -1 : 1;
    let frame = null;
    let rect = null;

    function apply(x, y) {
      // x, y = 0..1 (position of pointer inside element)
      const ry = (x - 0.5) * 2 * max * dir;      // left/right
      const rx = (0.5 - y) * 2 * max * dir;      // up/down

      el.style.setProperty("--rx", rx.toFixed(2) + "deg");
      el.style.setProperty("--ry", ry.toFixed(2) + "deg");
      el.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
      el.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    }

    function onEnter() {
      if (!motionAllowed()) return;
      rect = el.getBoundingClientRect();
      el.classList.add("is-tilting");
    }

    function onMove(e) {
      if (!motionAllowed()) return;
      if (!rect) rect = el.getBoundingClientRect();

      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

      // requestAnimationFrame = smooth, max 60fps, hindi bumibigat
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => apply(x, y));
    }

    function onLeave() {
      if (frame) cancelAnimationFrame(frame);
      rect = null;
      el.classList.remove("is-tilting");
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    }

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointercancel", onLeave);

    // nagbabago ang rect kapag nag-scroll/resize
    window.addEventListener("scroll", () => { rect = null; }, { passive: true });
    window.addEventListener("resize", () => { rect = null; });
  }

  /** Bind all [data-tilt] inside root (default: whole page) */
  function init(root = document) {
    root.querySelectorAll("[data-tilt]").forEach(bind);
  }

  /* ---------- Auto-bind ang mga cards na idinagdag ng JS ----------
     (product cards sa home ay ginagawa ng JS pagkatapos mag-load)
  ------------------------------------------------------------------ */
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches?.("[data-tilt]")) bind(node);
        node.querySelectorAll?.("[data-tilt]").forEach(bind);
      });
    }
  });

  function start() {
    init();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  /* ==========================================================
     BONUS: phone tilt (gyroscope) for the hero burger
     Sa mobile walang mouse, kaya ang pag-ikot ng phone ang gagamitin.
     Gumagana lang sa elements na may data-tilt-gyro.
     ========================================================== */
  function enableGyro() {
    const targets = document.querySelectorAll("[data-tilt-gyro]");
    if (!targets.length || !("DeviceOrientationEvent" in window)) return;

    window.addEventListener("deviceorientation", (e) => {
      if (!motionAllowed() || e.beta === null) return;
      targets.forEach((el) => {
        const max = parseFloat(el.dataset.tiltMax) || 15;
        const rx = Math.max(-max, Math.min(max, (e.beta - 45) / 2));   // forward/back
        const ry = Math.max(-max, Math.min(max, e.gamma / 2));         // left/right
        el.style.setProperty("--rx", (-rx).toFixed(2) + "deg");
        el.style.setProperty("--ry", ry.toFixed(2) + "deg");
      });
    }, { passive: true });
  }

  // iOS needs permission from a user tap; Android works right away
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission !== "function") {
    enableGyro();
  }

  return { init, bind, enableGyro };
})();