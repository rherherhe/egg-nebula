// Shader backgrounds for the hero sky. Each variation is a small fragment shader that the
// graphics card runs for every pixel. Which one shows is chosen by main.js (from ?hero=…)
// and read here from <html data-hero>. "painted" means no shader: hero-painting.js draws the sky.
//
// The hill, grass and paper grain are still painted on the canvas above this one.
// Visitors who ask for reduced motion get a single still frame.
(() => {
  const root = document.documentElement;
  const hero = document.querySelector(".hero");
  const variant = root.dataset.hero;
  if (!hero || !variant || variant === "painted") return;

  // Shared by every variation: brand colours, soft noise and a scatter of stars.
  const COMMON = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;

    const vec3 NIGHT = vec3(0.098, 0.031, 0.173);
    const vec3 PURPLE = vec3(0.439, 0.176, 0.745);
    const vec3 PINK = vec3(0.639, 0.306, 0.545);
    const vec3 TEAL = vec3(0.275, 0.608, 0.529);
    const vec3 WHITE = vec3(0.898, 0.871, 0.933);

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
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

    // Several layers of noise added together, for cloud-like shapes.
    float fbm(vec2 p) {
      float value = 0.0;
      float amount = 0.5;
      for (int i = 0; i < 5; i++) {
        value += amount * noise(p);
        p = p * 2.02 + vec2(17.0, 9.0);
        amount *= 0.5;
      }
      return value;
    }

    float stars(vec2 p) {
      vec2 cell = floor(p);
      float pick = hash(cell);
      if (pick < 0.93) return 0.0;
      vec2 offset = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;
      float d = length(fract(p) - 0.5 - offset);
      float twinkle = 0.7 + 0.3 * sin(uTime * (0.5 + pick * 2.0) + pick * 60.0);
      return smoothstep(0.07, 0.0, d) * twinkle * (0.4 + 0.6 * hash(cell + 1.7));
    }
  `;

  const SCENES = {
    // Slow clouds of gas folding over themselves.
    nebula: `
      vec3 scene(vec2 uv, vec2 p) {
        float t = uTime * 0.025;
        vec2 fold = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, 1.3) - t));
        float cloud = fbm(p * 1.3 + 2.2 * fold);
        vec3 col = NIGHT * 0.75;
        col = mix(col, PURPLE * 0.62, smoothstep(0.3, 0.75, cloud));
        col = mix(col, PINK * 0.7, smoothstep(0.55, 0.9, cloud) * 0.6);
        col += TEAL * 0.16 * smoothstep(0.5, 0.9, fold.x) * cloud;
        col += WHITE * stars(p * 26.0) * 0.8;
        return col;
      }
    `,

    // Three curtains of light with a sharp lower edge, fading upward.
    aurora: `
      vec3 scene(vec2 uv, vec2 p) {
        float t = uTime * 0.05;
        vec3 col = mix(NIGHT * 0.6, NIGHT, uv.y);
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float base = 0.38 + 0.2 * fi + 0.32 * (fbm(vec2(p.x * 0.7 + fi * 4.0 + t, fi * 2.0 + t * 0.6)) - 0.5);
          float d = uv.y - base;
          float curtain = smoothstep(-0.02, 0.0, d) * exp(-d * 5.5);
          float rays = 0.55 + 0.45 * noise(vec2(p.x * 9.0 + fi * 13.0 + t * 2.0, fi));
          rays *= 0.6 + 0.4 * noise(vec2(p.x * 40.0 + fi * 5.0, t * 3.0));
          vec3 tint = i == 0 ? TEAL : (i == 1 ? mix(TEAL, PURPLE, 0.7) : PINK);
          col += tint * curtain * rays * (0.42 - 0.08 * fi);
        }
        col += WHITE * stars(p * 26.0) * 0.7;
        return col;
      }
    `,

    // A turning spiral, after the painted version.
    swirl: `
      vec3 scene(vec2 uv, vec2 p) {
        float t = uTime * 0.06;
        float aspect = uRes.x / uRes.y;
        vec2 centre = aspect > 1.0 ? vec2(aspect * 0.42, 0.3) : vec2(aspect * 0.4, 0.0);
        vec2 v = p - centre;
        float r = length(v);
        float a = atan(v.y, v.x);

        float arms = sin(r * 11.0 - a * 2.0 - t * 1.2 + fbm(p * 2.0 + t * 0.3) * 1.2);
        float near = exp(-r * r * 0.9);
        float twist = r * 3.5 - t;
        vec2 turned = mat2(cos(twist), -sin(twist), sin(twist), cos(twist)) * v;
        float brush = fbm(turned * 9.0);

        vec3 col = NIGHT * 0.8;
        float glow = (arms * 0.5 + 0.5) * near;
        col = mix(col, PURPLE * 0.8, glow * (0.5 + 0.5 * brush));
        col += PINK * 0.4 * pow(glow, 2.0) * smoothstep(0.5, 0.75, brush);

        float bands = fbm(vec2(p.x * 1.5 - t, p.y * 5.0 + fbm(p * 1.5) * 2.0));
        col = mix(col, PURPLE * 0.4, smoothstep(0.45, 0.75, bands) * (1.0 - near) * 0.7);
        col += WHITE * stars(p * 26.0) * 0.75;
        return col;
      }
    `,
  };

  const MAIN = `
    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * 2.0;
      gl_FragColor = vec4(scene(uv, p), 1.0);
    }
  `;

  // If anything about WebGL fails, hand the sky back to the painted version.
  const fallBack = (why) => {
    console.warn(`Hero shader unavailable (${why}); using the painted sky.`);
    root.dataset.hero = "painted";
  };

  if (!SCENES[variant]) return fallBack("unknown variation");

  const canvas = document.createElement("canvas");
  canvas.className = "hero-shader";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { antialias: false });
  if (!gl) return fallBack("no WebGL");

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };

  let uRes, uTime;
  try {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }"));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, COMMON + SCENES[variant] + MAIN));
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
  } catch (error) {
    return fallBack(error.message);
  }

  hero.prepend(canvas);

  const START = 40; // seconds; starts the patterns already unfolded
  const FRAME_MS = 1000 / 30;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frameId = 0;
  let firstFrame = 0;
  let lastFrame = 0;
  let seconds = START;
  let onScreen = true;

  const draw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(hero.clientWidth * scale);
    canvas.height = Math.round(hero.clientHeight * scale);
    draw();
  };

  const tick = (now) => {
    frameId = requestAnimationFrame(tick);
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;
    if (!firstFrame) firstFrame = now - (seconds - START) * 1000;
    seconds = START + (now - firstFrame) / 1000;
    draw();
  };

  // Animate only when it's wanted and visible; otherwise leave the last frame showing.
  const update = () => {
    cancelAnimationFrame(frameId);
    frameId = 0;
    firstFrame = 0;
    if (!reduceMotion.matches && onScreen) frameId = requestAnimationFrame(tick);
  };

  resize();
  update();
  reduceMotion.addEventListener("change", update);
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    update();
  }).observe(hero);
})();
