// Paints the hero background onto a canvas, in the manner of an oil-pastel drawing:
// a night sky built from short brush dashes that follow a swirl, and a hill of grass blades.
// Everything is drawn in code; there are no image files behind it.
(() => {
  const hero = document.querySelector(".hero");
  const canvas = document.querySelector(".hero-canvas");
  const hillEl = document.querySelector(".hero .hill");
  if (!hero || !canvas || !hillEl) return;
  const ctx = canvas.getContext("2d");

  const NIGHT = "#19082c";
  const SKY = ["#1d0a33", "#220d3c", "#281146", "#2f1652"];
  const SWIRL = ["#34186a", "#43208a", "#5626a2", "#702dbe"];
  const ACCENT = ["#dc9cc6", "#e5deee", "#a34e8b"];
  const GRASS_BASE = "#35806f";
  const GRASS = ["#2f7767", "#3b8a77", "#469b87", "#57ad98", "#6dbfab"];

  // Seeded random, so the painting looks the same on every visit and resize.
  const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const cubic = (a, b, c, d, t) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };

  function paint() {
    const W = hero.clientWidth;
    const H = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";

    const rand = seeded(7);
    const between = (a, b) => a + rand() * (b - a);
    const pick = (list) => list[Math.floor(rand() * list.length)];

    // The hill follows the same curve as the fallback SVG, so the mascots stand on it.
    const hillH = hillEl.getBoundingClientRect().height;
    const hillTop = H - hillH;
    const hill = [];
    const segments = [
      [[0, 62], [240, 14], [520, 0], [760, 20]],
      [[760, 20], [1040, 44], [1240, 90], [1440, 70]],
    ];
    for (const [a, b, c, d] of segments) {
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        hill.push([
          (cubic(a[0], b[0], c[0], d[0], t) / 1440) * W,
          hillTop + (cubic(a[1], b[1], c[1], d[1], t) / 140) * hillH,
        ]);
      }
    }
    const hillY = (x) => {
      for (let i = 1; i < hill.length; i++) {
        if (x <= hill[i][0]) {
          const [x0, y0] = hill[i - 1];
          const [x1, y1] = hill[i];
          return x1 === x0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
        }
      }
      return hill[hill.length - 1][1];
    };

    // Keep bright marks out from behind the headline so it stays easy to read.
    const heroBox = hero.getBoundingClientRect();
    const copyBox = hero.querySelector(".hero-copy").getBoundingClientRect();
    const behindText = (x, y) =>
      x > copyBox.left - heroBox.left - 24 &&
      x < copyBox.right - heroBox.left + 24 &&
      y > copyBox.top - heroBox.top - 24 &&
      y < copyBox.bottom - heroBox.top + 24;

    const dash = (x, y, angle, length, width, color, alpha) => {
      const dx = (Math.cos(angle) * length) / 2;
      const dy = (Math.sin(angle) * length) / 2;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x - dx, y - dy);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
      // A thin lighter edge, like the ridge a pastel leaves along one side of a stroke.
      const ox = -Math.sin(angle) * width * 0.28;
      const oy = Math.cos(angle) * width * 0.28;
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = "#e5deee";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - dx + ox, y - dy + oy);
      ctx.lineTo(x + dx + ox, y + dy + oy);
      ctx.stroke();
    };

    // ----- Sky -----
    ctx.globalAlpha = 1;
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, W, H);

    const narrow = W < 760;
    const cx = W * (narrow ? 0.72 : 0.7);
    const cy = H * (narrow ? 0.5 : 0.3);
    const R = Math.min(W, H) * (narrow ? 0.34 : 0.4);
    const ribbonY = (x) => H * 0.09 + 26 * Math.sin(x * 0.006);

    const step = 12;
    for (let gy = 0; gy < H; gy += step) {
      for (let gx = 0; gx < W; gx += step) {
        const x = gx + between(-6, 6);
        const y = gy + between(-6, 6);
        const ground = hillY(x);
        if (y > ground + 8) continue;

        const vx = x - cx;
        const vy = y - cy;
        const d = Math.hypot(vx, vy);
        const theta = Math.atan2(vy, vx);
        const pull = Math.exp(-Math.pow(d / R, 2) * 1.1);

        // Strokes drift sideways in gentle waves, and wind around the swirl near its centre.
        const drift = -0.1 + 0.4 * Math.sin(x * 0.005 + y * 0.004);
        const around = theta + Math.PI / 2 + 0.22;
        const angle = Math.atan2(
          Math.sin(drift) * (1 - pull) + Math.sin(around) * pull,
          Math.cos(drift) * (1 - pull) + Math.cos(around) * pull
        );

        const arm = Math.sin(d * 0.052 - theta * 2) * Math.exp(-Math.pow(d / (R * 1.15), 4));
        const inRibbon = !narrow && x < cx - R * 0.5 && Math.abs(y - ribbonY(x)) < 30;
        const glow = Math.max(0, 1 - (ground - y) / 160);

        let color;
        let length = between(11, 20);
        let width = between(4, 7);
        let alpha = between(0.7, 0.95);

        if (arm > 0.12 || inRibbon) {
          const strength = inRibbon ? 0.35 : arm;
          color = SWIRL[Math.min(3, Math.floor(strength * 3 + rand() * 1.4))];
          if (rand() < 0.07 && !behindText(x, y)) {
            color = pick(ACCENT);
            length = between(12, 18);
            width = between(3, 4.5);
            alpha = 0.95;
          }
        } else {
          color = SKY[Math.min(3, Math.floor(rand() * 2.2 + glow * 1.8))];
        }
        dash(x, y, angle, length, width, color, alpha);
      }
    }

    // Stars: flecks of pastel, then a few four-point sparkles.
    ctx.fillStyle = "#e5deee";
    for (let i = 0; i < (W * H) / 7000; i++) {
      const x = rand() * W;
      const y = rand() * H;
      if (y > hillY(x) - 12) continue;
      ctx.globalAlpha = between(0.5, 1);
      ctx.beginPath();
      ctx.arc(x, y, between(0.6, 1.9), 0, Math.PI * 2);
      ctx.fill();
    }

    const sparkle = (x, y, s, color) => {
      ctx.fillStyle = color;
      for (let pass = 0; pass < 3; pass++) {
        const jx = between(-0.8, 0.8);
        const jy = between(-0.8, 0.8);
        const k = s * 0.14;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(x + jx, y - s + jy);
        ctx.quadraticCurveTo(x + k + jx, y - k + jy, x + s + jx, y + jy);
        ctx.quadraticCurveTo(x + k + jx, y + k + jy, x + jx, y + s + jy);
        ctx.quadraticCurveTo(x - k + jx, y + k + jy, x - s + jx, y + jy);
        ctx.quadraticCurveTo(x - k + jx, y - k + jy, x + jx, y - s + jy);
        ctx.fill();
      }
    };
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < (narrow ? 6 : 10); tries++) {
      const x = between(20, W - 20);
      const y = between(20, H - 20);
      if (y > hillY(x) - 60 || behindText(x, y)) continue;
      sparkle(x, y, between(7, 15), placed % 4 === 3 ? "#dc9cc6" : "#e5deee");
      placed++;
    }

    // ----- Hill -----
    ctx.globalAlpha = 1;
    ctx.fillStyle = GRASS_BASE;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (const [x, y] of hill) ctx.lineTo(x, y);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Broad underpainting strokes that follow the slope of the ground.
    for (let i = 0; i < (W * hillH) / 150; i++) {
      const x = rand() * W;
      const top = hillY(x);
      const y = between(top + 5, H);
      const slope = Math.atan2(hillY(x + 6) - top, 6);
      dash(x, y, slope + between(-0.25, 0.25), between(14, 30), between(5, 9), pick(GRASS), between(0.5, 0.85));
    }

    const blade = (x, y, length, lean, width, color, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.3, y - length * 0.6, x + lean, y - length);
      ctx.stroke();
    };

    // Blades across the hill, then a fringe of them along the top edge.
    for (let i = 0; i < (W * hillH) / 40; i++) {
      const x = rand() * W;
      const y = between(hillY(x) + 6, H + 6);
      blade(x, y, between(7, 16), between(-5, 5), between(1.6, 3), pick(GRASS), between(0.6, 0.95));
    }
    for (let x = -2; x < W + 2; x += between(2, 4.5)) {
      blade(x, hillY(x) + 3, between(6, 15), between(-5, 5), between(1.8, 3.2), pick(GRASS), 0.95);
    }

    // Tiny flowers.
    for (let i = 0; i < W / 36; i++) {
      const x = rand() * W;
      const y = between(hillY(x) + 8, H - 4);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = rand() < 0.2 ? "#dc9cc6" : "#e5deee";
      ctx.beginPath();
      ctx.arc(x, y, between(1.1, 2.1), 0, Math.PI * 2);
      ctx.fill();
    }

    // ----- Tooth -----
    // Fine light and dark specks over the whole picture, like paper grain catching the pastel.
    const size = 128;
    const tile = document.createElement("canvas");
    tile.width = tile.height = size;
    const tctx = tile.getContext("2d");
    const pixels = tctx.createImageData(size, size);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = rand();
      if (r < 0.1) {
        pixels.data.set([229, 222, 238, 20 + rand() * 70], i);
      } else if (r < 0.24) {
        pixels.data.set([25, 8, 44, 30 + rand() * 90], i);
      }
    }
    tctx.putImageData(pixels, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ctx.createPattern(tile, "repeat");
    ctx.fillRect(0, 0, W, H);
  }

  let lastW = 0;
  let lastH = 0;
  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (hero.clientWidth === lastW && hero.clientHeight === lastH) return;
      lastW = hero.clientWidth;
      lastH = hero.clientHeight;
      paint();
    }, 120);
  };

  lastW = hero.clientWidth;
  lastH = hero.clientHeight;
  paint();
  new ResizeObserver(schedule).observe(hero);
})();
