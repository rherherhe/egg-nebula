// The grass above the footer, drawn blade by blade on a canvas so it can sway.
// A slow breeze travels across it: each blade's tip leans with a wave that depends on where
// the blade stands, and taller blades bend further. Without JavaScript the plain zigzag
// grass from the stylesheet shows instead. With reduced motion on, the blades are drawn
// once and stand still.
(() => {
  const strip = document.querySelector(".grass");
  if (!strip) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  strip.append(canvas);
  strip.classList.add("is-painted");

  const FOOTER = "#469b87"; // the blades grow out of the footer's own colour
  const SHADES = ["#469b87", "#469b87", "#3b8a77", "#57ad98", "#2f7767", "#6dbfab", "#3b8a77"];
  const SWAY = 8; // px, how far the tallest tips move
  const FRAME_MS = 1000 / 30;

  // Seeded random, so the grass looks the same on every visit and resize.
  const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let W = 0;
  let H = 0;
  let dpr = 1;
  let blades = [];

  const build = () => {
    W = strip.clientWidth;
    H = strip.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const rand = seeded(11);
    blades = [];
    for (let x = -4; x < W + 4; x += 1.6 + rand() * 2.2) {
      const tall = rand();
      blades.push({
        x,
        // Mostly short, with the odd tall one standing out.
        height: 14 + tall * tall * (H - 22) + rand() * 8,
        lean: (rand() - 0.5) * 12,
        width: 1.8 + rand() * 2,
        color: SHADES[Math.floor(rand() * SHADES.length)],
        phase: rand() * 6.28,
      });
    }
    // Tall ones first, so the short ones in front overlap their bases.
    blades.sort((a, b) => b.height - a.height);
  };

  const draw = (t) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";

    for (const b of blades) {
      const wind = Math.sin(t * 1.1 - b.x * 0.011) + 0.45 * Math.sin(t * 2.3 + b.x * 0.045 + b.phase);
      const tip = b.lean + wind * SWAY * (b.height / H);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      ctx.moveTo(b.x, H);
      // The lower part of the blade stays put; the bend is all toward the tip.
      ctx.quadraticCurveTo(b.x + tip * 0.15, H - b.height * 0.55, b.x + tip, H - b.height);
      ctx.stroke();
    }

    // A solid band along the bottom so the blades join the footer without a seam.
    ctx.fillStyle = FOOTER;
    ctx.fillRect(0, H - 8, W, 8);
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frameId = 0;
  let first = 0;
  let last = 0;
  let onScreen = false;

  const tick = (now) => {
    frameId = requestAnimationFrame(tick);
    if (now - last < FRAME_MS) return;
    last = now;
    if (!first) first = now;
    draw((now - first) / 1000);
  };

  // Sway only when it's wanted and visible.
  const update = () => {
    cancelAnimationFrame(frameId);
    frameId = 0;
    if (!reduceMotion.matches && onScreen) frameId = requestAnimationFrame(tick);
    else draw(0);
  };

  build();
  draw(0);
  reduceMotion.addEventListener("change", update);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    update();
  }).observe(strip);

  let lastW = W;
  new ResizeObserver(() => {
    if (strip.clientWidth === lastW) return;
    lastW = strip.clientWidth;
    build();
    draw(0);
  }).observe(strip);
})();
