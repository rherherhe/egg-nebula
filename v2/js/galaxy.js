// A quiet starfield for the "Our Perspective" card, drawn by a fragment shader.
//
// It is meant to sit in the background and match the rest of the site: the same night
// colour, small crisp stars, and a few four-point sparkles. Three layers at different
// depths drift at different speeds (a slight parallax) and twinkle softly. Stars near the
// cursor ease away from it a little.
//
// If WebGL isn't available the card is simply dark. With reduced motion on, the stars are
// drawn once and nothing moves.
(() => {
  const card = document.querySelector("[data-galaxy]");
  if (!card) return;

  const canvas = document.createElement("canvas");
  canvas.className = "galaxy";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return;

  const FRAGMENT = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;   // in the same units as uv: heights, from the middle of the card
    uniform float uPush;   // 0 when the pointer is away, 1 when it is over the card

    // The site's own colours: its night sky (a touch deeper, so the card reads as a card),
    // its off-white, and its two accents.
    const vec3 NIGHT = vec3(0.075, 0.024, 0.133);
    const vec3 PURPLE = vec3(0.439, 0.176, 0.745);
    const vec3 PINK = vec3(0.863, 0.612, 0.776);
    const vec3 WHITE = vec3(0.898, 0.871, 0.933);

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    vec2 hash2(vec2 p) {
      return vec2(hash(p), hash(p + 19.7));
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    // One depth of stars. A grid of cells, each maybe holding one star; the neighbouring
    // cells are checked too so a star isn't cut off at its cell's edge. Most stars are
    // small crisp dots, like the ones scattered through the rest of the site. A share of
    // them (the "sparkles" share) are four-point sparkles instead, the site's star motif.
    vec3 layer(vec2 uv, float scale, float seed, float drift, float density, float size, float push, float sparkles) {
      // Stars near the cursor slide away from it, a little.
      vec2 away = uv - uMouse;
      float near = exp(-dot(away, away) * 9.0);
      uv -= normalize(away + 1e-4) * near * push * uPush;

      float turn = uTime * 0.004 * (0.6 + seed * 0.1);
      uv = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * uv;

      vec2 p = uv * scale + vec2(uTime * drift, -uTime * drift * 0.55) + seed * 37.0;
      vec2 id = floor(p);
      vec2 f = fract(p) - 0.5;

      vec3 total = vec3(0.0);
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 cell = id + g;
          if (hash(cell + seed) > density) continue;

          vec2 d = f - (g + (hash2(cell + seed * 3.1) - 0.5) * 0.7);
          float s = size * (0.55 + 0.9 * hash(cell * 1.7 + seed));
          float rate = 0.4 + 1.4 * hash(cell + 3.3);
          float twinkle = 0.75 + 0.25 * sin(uTime * rate + hash(cell) * 40.0);

          float shape;
          if (hash(cell + 5.5) < sparkles) {
            // A four-point sparkle: pinched in along the diagonals.
            float reach = pow(s * 3.4, 0.55);
            shape = smoothstep(reach, reach * 0.72, pow(abs(d.x), 0.55) + pow(abs(d.y), 0.55));
          } else {
            // A dot with a hair of softness at its edge.
            shape = smoothstep(s, s * 0.45, length(d));
          }

          vec3 tint = hash(cell + 8.8) < 0.14 ? PINK : WHITE;
          total += tint * shape * twinkle;
        }
      }
      return total;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

      // A wide, soft drift of purple across the card, barely there.
      float haze = noise(uv * 1.3 + vec2(uTime * 0.005, 3.0)) * 0.6 + noise(uv * 2.7 + 9.0) * 0.4;
      vec3 col = NIGHT + PURPLE * 0.05 * smoothstep(0.35, 0.85, haze);

      col += layer(uv, 6.0, 1.0, 0.003, 0.30, 0.022, 0.040, 0.3) * 0.85;
      col += layer(uv, 11.0, 2.0, 0.005, 0.26, 0.026, 0.025, 0.0) * 0.65;
      col += layer(uv, 18.0, 3.0, 0.008, 0.20, 0.030, 0.012, 0.0) * 0.45;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };

  let uRes, uTime, uMouse, uPush;
  try {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }"));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    // One big triangle that covers the whole canvas.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    uRes = gl.getUniformLocation(program, "uRes");
    uTime = gl.getUniformLocation(program, "uTime");
    uMouse = gl.getUniformLocation(program, "uMouse");
    uPush = gl.getUniformLocation(program, "uPush");
  } catch (error) {
    console.warn("Galaxy shader unavailable.", error);
    return;
  }

  card.prepend(canvas);

  const START = 45; // seconds; starts the stars already spread out
  const FRAME_MS = 1000 / 30;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let seconds = START;
  let firstFrame = 0;
  let lastFrame = 0;
  let frameId = 0;
  let onScreen = false;
  const mouse = { x: 0, y: 0, push: 0, target: 0 };

  const draw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, seconds);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uPush, reduceMotion.matches ? 0 : mouse.push);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(card.clientWidth * scale);
    canvas.height = Math.round(card.clientHeight * scale);
    draw();
  };

  const tick = (now) => {
    frameId = requestAnimationFrame(tick);
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;
    if (!firstFrame) firstFrame = now - (seconds - START) * 1000;
    seconds = START + (now - firstFrame) / 1000;
    mouse.push += (mouse.target - mouse.push) * 0.12;
    draw();
  };

  // Animate only when it's wanted and visible; otherwise leave the last frame showing.
  const update = () => {
    cancelAnimationFrame(frameId);
    frameId = 0;
    firstFrame = 0;
    if (!reduceMotion.matches && onScreen) frameId = requestAnimationFrame(tick);
  };

  window.addEventListener("pointermove", (event) => {
    const box = card.getBoundingClientRect();
    mouse.x = (event.clientX - box.left - box.width / 2) / box.height;
    mouse.y = -(event.clientY - box.top - box.height / 2) / box.height;
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    mouse.target = inside ? 1 : 0;
  });
  document.addEventListener("pointerleave", () => (mouse.target = 0));

  resize();
  update();
  reduceMotion.addEventListener("change", update);
  new ResizeObserver(resize).observe(card);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    update();
  }).observe(card);
})();
