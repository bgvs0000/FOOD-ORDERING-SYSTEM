/* ==========================================================
   SCROLL REVEAL — animates [data-reveal] into view
   HTML:
     <div data-reveal="up">...</div>          up | left | right | zoom
     <div data-reveal="up" style="--delay:.2s">   (optional delay)
   CSS (animations.css) handles the motion; JS only adds .is-visible
   ========================================================== */
const ScrollReveal = (() => {

  // Walang IntersectionObserver (napakalumang browser) → ipakita agad lahat
  if (!("IntersectionObserver" in window)) {
    const showAll = () =>
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-visible"));
    document.addEventListener("DOMContentLoaded", showAll);
    return { observe: () => {}, refresh: showAll };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");

          // once lang — hindi na itatago ulit kapag nag-scroll pataas
          if (!entry.target.hasAttribute("data-reveal-repeat")) {
            observer.unobserve(entry.target);
          }
        } else if (entry.target.hasAttribute("data-reveal-repeat")) {
          entry.target.classList.remove("is-visible");
        }
      });
    },
    {
      threshold: 0.15,                     // 15% visible bago lumabas
      rootMargin: "0px 0px -60px 0px",     // medyo late para kita ang galaw
    }
  );

  /** Watch all [data-reveal] inside root that aren't visible yet */
  function observe(root = document) {
    root.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => observer.observe(el));
  }

  /** Ilagay ulit sa observer (e.g. after JS renders new content) */
  function refresh() {
    observe(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => observe());
  } else {
    observe();
  }

  return { observe, refresh };
})();