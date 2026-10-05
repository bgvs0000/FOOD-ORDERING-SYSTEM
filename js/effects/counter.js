/* ==========================================================
   COUNTER — animates numbers when they scroll into view
   HTML:
     <strong data-count="12500" data-suffix="+">0</strong>
     <strong data-count="4.9" data-decimals="1" data-suffix="★">0</strong>
     <strong data-count="249" data-prefix="₱">0</strong>
   Options:
     data-count     target number (required)
     data-decimals  ilang decimal places (default 0)
     data-prefix    text bago ang number
     data-suffix    text pagkatapos
     data-duration  ms (default 1800)
   ========================================================== */
const Counter = (() => {

  /** Mabilis sa simula, bumabagal sa dulo */
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  function format(value, decimals) {
    return Number(value).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function animate(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";

    const target = parseFloat(el.dataset.count) || 0;
    const decimals = parseInt(el.dataset.decimals, 10) || 0;
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const duration = parseInt(el.dataset.duration, 10) || 1800;

    const reduce =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.body.classList.contains("reduce-motion");

    // Reduce motion → ipakita agad ang final number
    if (reduce) {
      el.textContent = prefix + format(target, decimals) + suffix;
      return;
    }

    const start = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const current = target * easeOutExpo(progress);
      el.textContent = prefix + format(current, decimals) + suffix;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = prefix + format(target, decimals) + suffix;
        el.classList.add("anim-bounce");   // maliit na "pop" sa dulo
      }
    }

    requestAnimationFrame(tick);
  }

  function init(root = document) {
    const els = root.querySelectorAll("[data-count]");
    if (!els.length) return;

    if (!("IntersectionObserver" in window)) {
      els.forEach(animate);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );

    els.forEach((el) => io.observe(el));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  return { init, animate };
})();