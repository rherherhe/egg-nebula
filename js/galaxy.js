// A drifting starfield for the "Our Perspective" card, drawn by a fragment shader.
//
// Four layers of stars at different depths drift at different speeds (a parallax), twinkle,
// and slowly turn about the middle of the card, against black space. Stars near the
// cursor are pushed gently away from it, the nearer layers more than the farther ones.
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

    const vec3 SPACE = vec3(0.012, 0.008, 0.02); // very nearly black
    const vec3 PURPLE = vec3(0.439, 0.176, 0.745);
    const vec3 PINK = vec3(0.639, 0.306, 0.545);
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

    float fbm(vec2 p) {
      float value = 0.0;
      float amount = 0.5;
      for (int i = 0; i < 4; i++) {
        value += amount * noise(p);
        p = p * 2.03 + vec2(11.0, 7.0);
        amount *= 0.5;
      }
      return value;
    }

    // One depth of stars. A grid of cells, each maybe holding one star; the neighbouring
    // cells are checked too so a star's glow isn't cut off at its cell's edge.
    vec3 layer(vec2 uv, float scale, float seed, float drift, float density, float size, float push) {
      // Stars near the cursor slide away from it.
      vec2 away = uv - uMouse;
      float near = exp(-dot(away, away) * 9.0);
      uv -= normalize(away + 1e-4) * near * push * uPush;

      float turn = uTime * 0.006 * (0.6 + seed * 0.1);
      uv = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * uv;

      vec2 p = uv * scale + vec2(uTime * drift, -uTime * drift * 0.55) + seed * 37.0;
      vec2 id = floor(p);
      vec2 f = fract(p) - 0.5;

      vec3 total = vec3(0.0);
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 cell = id + g;
          float chance = hash(cell + seed);
          if (chance > density) continue;

          vec2 where = g + (hash2(cell + seed * 3.1) - 0.5) * 0.7;
          float r = length(f - where);
          float s = size * (0.5 + hash(cell * 1.7 + seed));
          float rate = 0.5 + 2.2 * hash(cell + 3.3);
          float twinkle = 0.62 + 0.38 * sin(uTime * rate + hash(cell) * 40.0);

          float core = smoothstep(s, 0.0, r);
          float glow = exp(-r / (s * 4.5)) * 0.32;
          float shade = hash(cell + 8.8);
          vec3 tint = shade < 0.1 ? mix(PINK, WHITE, 0.45)
                    : shade < 0.22 ? mix(PURPLE, WHITE, 0.62)
                    : WHITE;
          total += tint * (core + glow) * twinkle;
        }
      }
      return total;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

      // Black space, with only a whisper of haze so it isn't perfectly flat.
      float haze = fbm(uv * 1.7 + vec2(uTime * 0.006, 0.0));
      vec3 col = SPACE;
      col += mix(PURPLE, PINK, fbm(uv * 1.1 + 4.0)) * 0.025 * smoothstep(0.4, 0.9, haze);

      col += layer(uv, 4.5, 1.0, 0.003, 0.34, 0.034, 0.07) * 1.0;
      col += layer(uv, 8.0, 2.0, 0.006, 0.30, 0.030, 0.045) * 0.9;
      col += layer(uv, 13.0, 3.0, 0.010, 0.24, 0.028, 0.028) * 0.8;
      col += layer(uv, 21.0, 4.0, 0.016, 0.18, 0.026, 0.014) * 0.7;

      // Darker toward the corners, so the edges of the card feel deep.
      col *= 1.0 - 0.55 * smoothstep(0.35, 1.25, length(uv * vec2(0.8, 1.0)));
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
