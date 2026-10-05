/* ==========================================================
   PARALLAX — layered movement on scroll + mouse
   HTML:
     <div data-parallax="0.2">   positive = mas mabagal sa scroll (lumalayo)
     <div data-parallax="-0.15"> negative = kabaligtaran ng direksyon

   ⚠️ Gumagamit ng CSS "translate" property (hindi "transform"),
   kaya hindi nito nasisira ang float/spin animations sa parehong element.
   ========================================================== */
const Parallax = (() => {
  const items = [...document.querySelectorAll("[data-parallax]")];
  if (!items.length) return { refresh: () => {} };

  const MOUSE_STRENGTH = 30;     // px na galaw sa mouse
  let scrollY = window.scrollY;
  let mouseX = 0;                // -0.5 … 0.5
  let mouseY = 0;
  let ticking = false;
  let visible = new Set(items);  // only animate what's on screen

  function motionAllowed() {
    return (
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !document.body.classList.contains("reduce-motion")
    );
  }

  /* ---------- Render ---------- */
  function render() {
    ticking = false;

    if (!motionAllowed()) {
      items.forEach((el) => (el.style.translate = "0 0"));
      return;
    }

    const isMobile = window.innerWidth < 760;

    visible.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0;

      // scroll: gumagalaw nang pataas/pababa ayon sa speed
      const sy = scrollY * speed * (isMobile ? 0.5 : 1);

      // mouse: konting galaw, mas malakas sa mas mabilis na layer
      const mx = isMobile ? 0 : mouseX * MOUSE_STRENGTH * speed * 4;
      const my = isMobile ? 0 : mouseY * MOUSE_STRENGTH * speed * 4;

      el.style.translate = `${mx.toFixed(1)}px ${(sy + my).toFixed(1)}px`;
    });
  }

  function requestRender() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(render);
    }
  }

  /* ---------- Listeners ---------- */
  window.addEventListener(
    "scroll",
    () => {
      scrollY = window.scrollY;
      requestRender();
    },
    { passive: true }
  );

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      mouseX = e.clientX / window.innerWidth - 0.5;
      mouseY = e.clientY / window.innerHeight - 0.5;
      requestRender();
    },
    { passive: true }
  );

  window.addEventListener("resize", requestRender);

  /* ---------- Pause off-screen layers (performance) ---------- */
  if ("IntersectionObserver" in window) {
    visible = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        requestRender();
      },
      { rootMargin: "200px 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  requestRender();

  return { refresh: requestRender };
})();