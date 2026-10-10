// Paints the hero background onto a canvas, in the manner of an oil-pastel drawing:
// a night sky built from short brush dashes that follow a swirl, and a hill of grass blades.
// Everything is drawn in code; there are no image files behind it.
//
// The sky strokes and the hill are painted onto two offscreen layers, then combined with
// the stars, bright dashes and grass fringe into one still picture.
(() => {
  const hero = document.querySelector(".hero");
  const canvas = document.querySelector(".hero-canvas");
  const hillEl = document.querySelector(".hero .hill");
  if (!hero || !canvas || !hillEl) return;
  const ctx = canvas.getContext("2d");

  const NIGHT = "#19082c";
  const SKY = ["#1b0930", "#1e0b35", "#220d3b", "#261042"];
  const SWIRL = ["#200d44", "#281153", "#301564", "#3b1a78"];
  const ACCENT = ["#9a6489", "#9c93aa", "#6a3059"];
  const GRASS_BASE = "#1d4d42";
  const GRASS = ["#1a463c", "#215548", "#286556", "#307363", "#3a8472"];


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
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // Fine light and dark specks, like paper grain catching the pastel. Laid over the finished picture.
  const grain = (() => {
    const rand = seeded(3);
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
    return ctx.createPattern(tile, "repeat");
  })();

  const dash = (c, x, y, angle, length, width, color, alpha) => {
    const dx = (Math.cos(angle) * length) / 2;
    const dy = (Math.sin(angle) * length) / 2;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x - dx, y - dy);
    c.lineTo(x + dx, y + dy);
    c.stroke();
    // A thin lighter edge, like the ridge a pastel leaves along one side of a stroke.
    const ox = -Math.sin(angle) * width * 0.28;
    const oy = Math.cos(angle) * width * 0.28;
    c.globalAlpha = alpha * 0.08;
    c.strokeStyle = "#e5deee";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - dx + ox, y - dy + oy);
    c.lineTo(x + dx + ox, y + dy + oy);
    c.stroke();
  };

  const blade = (c, x, y, length, lean, width, color, alpha) => {
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + lean * 0.3, y - length * 0.6, x + lean, y - length);
    c.stroke();
  };

  let scene;

  function build() {
    const W = hero.clientWidth;
    const H = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const layer = () => {
      const el = document.createElement("canvas");
      el.width = canvas.width;
      el.height = canvas.height;
      const c = el.getContext("2d");
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.lineCap = "round";
      return [el, c];
    };

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

    // Bright marks fade out as they pass behind the headline, so it stays easy to read.
    const heroBox = hero.getBoundingClientRect();
    const copyBox = hero.querySelector(".hero-copy").getBoundingClientRect();
    const text = {
      left: copyBox.left - heroBox.left - 24,
      right: copyBox.right - heroBox.left + 24,
      top: copyBox.top - heroBox.top - 24,
      bottom: copyBox.bottom - heroBox.top + 24,
    };
    const clearOfText = (x, y) => {
      const dx = Math.max(text.left - x, 0, x - text.right);
      const dy = Math.max(text.top - y, 0, y - text.bottom);
      return clamp01(Math.hypot(dx, dy) / 30);
    };

    const narrow = W < 760;
    const cx = W * (narrow ? 0.72 : 0.7);
    const cy = H * (narrow ? 0.5 : 0.3);
    const R = Math.min(W, H) * (narrow ? 0.34 : 0.4);
    const ribbonEnd = cx - R * 0.5;
    const ribbonY = (x) => H * 0.09 + 26 * Math.sin(x * 0.006);

    // ----- Sky layer -----
    const [skyEl, sky] = layer();
    sky.fillStyle = NIGHT;
    sky.fillRect(0, 0, W, H);

    const accents = [];
    const step = 12;
    for (let gy = 0; gy < H; gy += step) {
      for (let gx = 0; gx < W; gx += step) {
        const x = gx + between(-6, 6);
        const y = gy + between(-6, 6);
        const ground = hillY(x);
        if (y > ground + 8) continue;

        const d = Math.hypot(x - cx, y - cy);
        const theta = Math.atan2(y - cy, x - cx);
        const pull = Math.exp(-Math.pow(d / R, 2) * 1.1);

        // Strokes drift sideways in gentle waves, and wind around the swirl near its centre.
        const drift = -0.1 + 0.4 * Math.sin(x * 0.005 + y * 0.004);
        const around = theta + Math.PI / 2 + 0.22;
        const angle = Math.atan2(
          Math.sin(drift) * (1 - pull) + Math.sin(around) * pull,
          Math.cos(drift) * (1 - pull) + Math.cos(around) * pull
        );

        const arm = Math.sin(d * 0.052 - theta * 2) * Math.exp(-Math.pow(d / (R * 1.15), 4));
        const inRibbon = !narrow && x < ribbonEnd && Math.abs(y - ribbonY(x)) < 30;
        const glow = Math.max(0, 1 - (ground - y) / 160);

        let color;
        if (arm > 0.12 || inRibbon) {
          const strength = inRibbon ? 0.35 : arm;
          color = SWIRL[Math.min(3, Math.floor(strength * 3 + rand() * 1.4))];
          if (rand() < 0.07) {
            // A bright dash, drawn last so it sits on top of the darker strokes.
            const accent = {
              color: pick(ACCENT),
              length: between(12, 18),
              width: between(3, 4.5),
            };
            if (inRibbon) accents.push({ ...accent, ribbon: true, x, offset: y - ribbonY(x) });
            else accents.push({ ...accent, d: Math.max(d, 20), theta });
          }
        } else {
          color = SKY[Math.min(3, Math.floor(rand() * 2.2 + glow * 1.8))];
        }
        dash(sky, x, y, angle, between(11, 20), between(4, 7), color, between(0.7, 0.95));
      }
    }

    // Stars and sparkles go on top of the sky layer.
    const stars = [];
    for (let i = 0; i < (W * H) / 7000; i++) {
      const x = rand() * W;
      const y = rand() * H;
      if (y > hillY(x) - 12) continue;
      stars.push({ x, y, r: between(0.6, 1.9), alpha: between(0.35, 0.85) });
    }

    const sparkles = [];
    for (let tries = 0; tries < 200 && sparkles.length < (narrow ? 6 : 10); tries++) {
      const x = between(20, W - 20);
      const y = between(20, H - 20);
      if (y > hillY(x) - 60 || clearOfText(x, y) < 1) continue;
      sparkles.push({
        x,
        y,
        size: between(7, 15),
        color: sparkles.length % 4 === 3 ? "#9a6489" : "#b4abc2",
        // Three slightly offset passes give the chalky, hand-filled edge.
        jitter: [0, 1, 2].map(() => [between(-0.8, 0.8), between(-0.8, 0.8)]),
      });
    }

    // ----- Hill layer -----
    const [hillLayerEl, ground] = layer();
    ground.fillStyle = GRASS_BASE;
    ground.beginPath();
    ground.moveTo(0, H);
    for (const [x, y] of hill) ground.lineTo(x, y);
    ground.lineTo(W, H);
    ground.closePath();
    ground.fill();

    // Broad underpainting strokes that follow the slope of the ground.
    for (let i = 0; i < (W * hillH) / 150; i++) {
      const x = rand() * W;
      const top = hillY(x);
      const slope = Math.atan2(hillY(x + 6) - top, 6);
      dash(ground, x, between(top + 5, H), slope + between(-0.25, 0.25), between(14, 30), between(5, 9), pick(GRASS), between(0.5, 0.85));
    }

    // Blades across the hill, then a fringe of them along the top edge.
    const blades = [];
    for (let i = 0; i < (W * hillH) / 40; i++) {
      const x = rand() * W;
      const b = {
        x,
        y: between(hillY(x) + 6, H + 6),
        length: between(7, 16),
        lean: between(-5, 5),
        width: between(1.6, 3),
        color: pick(GRASS),
        alpha: between(0.6, 0.95),
      };
      blade(ground, b.x, b.y, b.length, b.lean, b.width, b.color, b.alpha);
    }
    for (let x = -2; x < W + 2; x += between(2, 4.5)) {
      blades.push({ x, y: hillY(x) + 3, length: between(6, 15), lean: between(-5, 5), width: between(1.8, 3.2), color: pick(GRASS), alpha: 0.95 });
    }

    // Tiny flowers.
    for (let i = 0; i < W / 36; i++) {
      const x = rand() * W;
      ground.globalAlpha = 0.9;
      ground.fillStyle = rand() < 0.2 ? "#9a6489" : "#b4abc2";
      ground.beginPath();
      ground.arc(x, between(hillY(x) + 8, H - 4), between(1.1, 2.1), 0, Math.PI * 2);
      ground.fill();
    }

    scene = { W, H, dpr, skyEl, hillLayerEl, accents, stars, sparkles, blades, cx, cy, ribbonEnd, ribbonY, clearOfText };
  }

  function draw() {
    const s = scene;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.globalAlpha = 1;
    ctx.drawImage(s.skyEl, 0, 0, s.W, s.H);

    for (const a of s.accents) {
      let x, y, angle, fade = 1;
      if (a.ribbon) {
        x = a.x;
        y = s.ribbonY(x) + a.offset;
        angle = Math.atan2(s.ribbonY(x + 4) - s.ribbonY(x), 4);
        fade = clamp01(Math.min(x, s.ribbonEnd - x) / 40);
      } else {
        x = s.cx + Math.cos(a.theta) * a.d;
        y = s.cy + Math.sin(a.theta) * a.d;
        angle = a.theta + Math.PI / 2 + 0.22;
      }
      fade *= s.clearOfText(x, y);
      if (fade > 0.02) dash(ctx, x, y, angle, a.length, a.width, a.color, 0.95 * fade);
    }

    ctx.fillStyle = "#b4abc2";
    for (const st of s.stars) {
      ctx.globalAlpha = st.alpha;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const sp of s.sparkles) {
      const size = sp.size;
      const k = size * 0.14;
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = 0.5;
      for (const [jx, jy] of sp.jitter) {
        const x = sp.x + jx;
        const y = sp.y + jy;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.quadraticCurveTo(x + k, y - k, x + size, y);
        ctx.quadraticCurveTo(x + k, y + k, x, y + size);
        ctx.quadraticCurveTo(x - k, y + k, x - size, y);
        ctx.quadraticCurveTo(x - k, y - k, x, y - size);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.drawImage(s.hillLayerEl, 0, 0, s.W, s.H);

    for (const b of s.blades) blade(ctx, b.x, b.y, b.length, b.lean, b.width, b.color, b.alpha);

    ctx.globalAlpha = 1;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, s.W, s.H);
  }

  build();
  draw();

  let lastW = hero.clientWidth;
  let lastH = hero.clientHeight;
  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (hero.clientWidth === lastW && hero.clientHeight === lastH) return;
      lastW = hero.clientWidth;
      lastH = hero.clientHeight;
      build();
      draw();
    }, 120);
  }).observe(hero);
})();
