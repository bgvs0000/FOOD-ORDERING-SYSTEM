/* ==========================================================
   CONFETTI — flat-style celebration burst (canvas, no library)
   Usage:
     Confetti.burst();                         // from center-top
     Confetti.burst({ x: 0.5, y: 0.6, count: 160 });
     Confetti.rain(2000);                      // falls from top for 2s
   ========================================================== */
const Confetti = (() => {
  const COLORS = ["#FF4B3E", "#FFC233", "#3BB273", "#3B8EEA", "#A66BFF", "#FFF4E0"];
  const SHAPES = ["rect", "circle", "triangle", "strip"];
  const GRAVITY = 0.32;
  const DRAG = 0.985;

  let canvas = null;
  let ctx = null;
  let particles = [];
  let running = false;
  let dpr = 1;

  function motionAllowed() {
    return (
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !document.body.classList.contains("reduce-motion")
    );
  }

  /* ---------- Canvas setup ---------- */
  function setup() {
    if (canvas) return;
    canvas = document.getElementById("confetti");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "confetti";
      canvas.className = "confetti";
      canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);   // sharp on retina, pero hindi sobra
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- Particle ---------- */
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function makeParticle(x, y, { spread = Math.PI * 0.9, power = 1, angle = -Math.PI / 2 } = {}) {
    const a = angle + rand(-spread / 2, spread / 2);
    const speed = rand(9, 17) * power;
    return {
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: rand(8, 15),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      rotation: rand(0, Math.PI * 2),
      spin: rand(-0.25, 0.25),
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: rand(0.05, 0.12),
      life: 1,
      decay: rand(0.004, 0.008),
    };
  }

  /* ---------- Draw one piece (flat + dark outline) ---------- */
  function draw(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    // "flip" effect: scale Y with wobble so it looks like paper turning
    ctx.scale(1, Math.cos(p.wobble));
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));

    ctx.fillStyle = p.color;
    ctx.strokeStyle = "#1E1E1E";
    ctx.lineWidth = 2;

    const s = p.size;
    ctx.beginPath();
    switch (p.shape) {
      case "circle":
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
        break;
      case "triangle":
        ctx.moveTo(0, -s / 2);
        ctx.lineTo(s / 2, s / 2);
        ctx.lineTo(-s / 2, s / 2);
        ctx.closePath();
        break;
      case "strip":
        ctx.rect(-s / 5, -s, s / 2.5, s * 2);
        break;
      default: // rect
        ctx.rect(-s / 2, -s / 3, s, s / 1.5);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- Animation loop ---------- */
  function loop() {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const h = window.innerHeight;

    particles = particles.filter((p) => {
      p.vx *= DRAG;
      p.vy = p.vy * DRAG + GRAVITY;
      p.x += p.vx + Math.sin(p.wobble) * 0.8;   // side-to-side drift
      p.y += p.vy;
      p.rotation += p.spin;
      p.wobble += p.wobbleSpeed;
      p.life -= p.decay;

      draw(p);
      return p.life > 0 && p.y < h + 40;
    });

    if (particles.length) {
      requestAnimationFrame(loop);
    } else {
      running = false;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
  }

  function start() {
    if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
  }

  /* ==========================================================
     PUBLIC
     ========================================================== */

  /** Pumutok mula sa isang point. x, y = 0..1 (percent ng screen) */
  function burst({ x = 0.5, y = 0.35, count = 140, power = 1 } = {}) {
    if (!motionAllowed()) return;
    setup();
    const px = window.innerWidth * x;
    const py = window.innerHeight * y;
    for (let i = 0; i < count; i++) {
      particles.push(makeParticle(px, py, { power, spread: Math.PI * 2 }));
    }
    start();
  }

  /** Dalawang "cannon" mula sa ibabang sulok — pang-celebrate */
  function cannons({ count = 90 } = {}) {
    if (!motionAllowed()) return;
    setup();
    const h = window.innerHeight;
    const w = window.innerWidth;
    for (let i = 0; i < count; i++) {
      particles.push(makeParticle(0, h, { angle: -Math.PI / 3, spread: 0.6, power: 1.5 }));
      particles.push(makeParticle(w, h, { angle: (-2 * Math.PI) / 3, spread: 0.6, power: 1.5 }));
    }
    start();
  }

  /** Umuulan mula sa taas for `duration` ms */
  function rain(duration = 2000) {
    if (!motionAllowed()) return;
    setup();
    const end = Date.now() + duration;
    (function drop() {
      for (let i = 0; i < 4; i++) {
        const p = makeParticle(rand(0, window.innerWidth), -20, { angle: Math.PI / 2, spread: 0.4, power: 0.3 });
        particles.push(p);
      }
      start();
      if (Date.now() < end) requestAnimationFrame(drop);
    })();
  }

  return { burst, cannons, rain };
})();