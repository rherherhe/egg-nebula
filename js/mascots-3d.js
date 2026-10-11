// Nilly and Sunny as small 3D models, built from basic shapes with three.js.
//
// They are drawn on one see-through canvas fixed over the whole window, so they are free to
// leave the hero. At the top of the page they sit on the grass. As you scroll down they fly
// to the About section and peek in from its edges: Sunny on the left, Nilly on the right.
// They also watch the cursor: eyes and mouth slide across the face and the body leans.
//
// The scene is only redrawn when something changes (a scroll, a resize, the eyes catching
// up), so it costs nothing when idle. If WebGL isn't available, the flat PNG mascots in the
// page stay visible instead. With reduced motion on, they stay on the grass and don't fly.
import * as THREE from "three";

const WHITE = 0xe5deee;
const PINK = 0xa34e8b;
const DARK = 0x19082c;

const scene2d = document.querySelector(".hero-scene");
if (scene2d) {
  try {
    init(scene2d);
  } catch (error) {
    console.warn("3D mascots unavailable, showing the flat ones instead.", error);
  }
}

function init(heroSpot) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.className = "mascots-3d";
  canvas.setAttribute("aria-hidden", "true");

  // A flat (orthographic) camera where one unit is one screen pixel and the origin is the
  // middle of the window. That makes "put this mascot at this spot on the page" simple.
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -3000, 3000);
  camera.position.z = 1000;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a3a66, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-3, 5, 6);
  scene.add(sun);

  const matte = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const white = matte(WHITE);
  const pink = matte(PINK);
  const dark = new THREE.MeshBasicMaterial({ color: DARK });

  const eye = (radius, x, y, z, tilt) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), dark);
    mesh.scale.set(1, 1.25, 0.5);
    mesh.position.set(x, y, z);
    mesh.rotation.order = "YXZ";
    mesh.rotation.set(tilt, Math.atan2(x, z), 0);
    return mesh;
  };

  const smile = (radius, y, z, tilt) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.26, 8, 20, Math.PI), dark);
    mesh.position.set(0, y, z);
    mesh.rotation.set(tilt, 0, Math.PI);
    return mesh;
  };

  // A soft dark patch under each mascot, so they sit on the grass rather than float.
  const shadowTexture = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const fade = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    fade.addColorStop(0, "rgba(8, 3, 16, 0.75)");
    fade.addColorStop(0.55, "rgba(8, 3, 16, 0.4)");
    fade.addColorStop(1, "rgba(8, 3, 16, 0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = (width, depth) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    return mesh;
  };

  // Each mascot is wrapped in a `rig` whose origin is the middle of its body, so it can be
  // placed, sized and spun as a whole. `look` slides the face; `lean` tips the body.
  const rigFor = (model, middle) => {
    const rig = new THREE.Group();
    rig.rotation.order = "ZXY"; // roll on screen, then tip toward the viewer, then spin
    model.position.y = -middle;
    rig.add(model);
    scene.add(rig);
    return rig;
  };

  // ----- Nilly: an egg standing upright, with a pink belly -----
  const nilly = (() => {
    const model = new THREE.Group();
    const body = new THREE.Group();
    const half = 1.3;

    const profile = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI;
      const up = -Math.cos(t); // -1 at the base, +1 at the tip
      profile.push(new THREE.Vector2(Math.sin(t) * (1 - 0.18 * up), half + up * half));
    }
    body.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 64), white));

    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), pink);
    belly.scale.set(0.8, 0.82, 0.7);
    belly.position.set(0, 0.86, 0.37);
    body.add(belly);

    // An egg is not a ball, so turning the face about its middle would sink the features
    // into the shell. Instead each one is re-seated on the egg’s surface wherever it looks.
    const seat = (mesh, around, up, proud) => {
      const s = Math.sqrt(1 - up * up);
      const r = s * (1 - 0.18 * up);
      const slope = (-up / s) * (1 - 0.18 * up) - 0.18 * s; // how the radius changes with height
      const len = Math.hypot(half, slope);
      const out = half / len;
      const rise = -slope / len;
      const radius = r + out * proud;
      mesh.position.set(radius * Math.sin(around), up * half + rise * proud, radius * Math.cos(around));
      mesh.rotation.order = "YXZ";
      mesh.rotation.set(-Math.atan2(rise, out), around, mesh.rotation.z);
    };

    const face = new THREE.Group();
    face.position.set(0, half, 0);
    const leftEye = eye(0.075, -0.3, 0.66, 0.75, -0.3);
    const rightEye = eye(0.075, 0.3, 0.66, 0.75, -0.3);
    const grin = smile(0.085, 0.54, 0.87, -0.3);
    face.add(leftEye, rightEye, grin);
    body.add(face);

    const ground = shadow(3.4, 1.9);
    model.add(body, ground);

    return {
      rig: rigFor(model, half),
      eyes: face,
      ground,
      tall: 2.6, // model units, used to size it in pixels
      look(yaw, pitch) {
        const up = 0.5 - pitch * 0.9;
        seat(leftEye, -0.38 + yaw, up, 0.02);
        seat(rightEye, 0.38 + yaw, up, 0.02);
        seat(grin, yaw * 0.6, 0.41 - pitch * 0.55, 0.03);
      },
      lean: (yaw, pitch) => body.rotation.set(pitch * 0.3, yaw * 0.25, -yaw * 0.22),
    };
  })();

  // ----- Sunny: a fried egg lying flat, face on the yolk -----
  const sunny = (() => {
    const model = new THREE.Group();

    const outline = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = 1 + 0.16 * Math.sin(2 * a + 0.6) + 0.1 * Math.sin(3 * a + 1.3);
      outline.push(new THREE.Vector2(1.3 * r * Math.cos(a), 0.95 * r * Math.sin(a)));
    }
    const shape = new THREE.Shape();
    shape.splineThru(outline.concat(outline[0]));
    shape.closePath();
    const puddle = new THREE.ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.09,
      bevelSegments: 6,
      curveSegments: 48,
    });
    puddle.rotateX(-Math.PI / 2);
    puddle.translate(0, 0.07, 0);
    model.add(new THREE.Mesh(puddle, white));

    // The yolk is the part that leans; the white stays flat.
    const body = new THREE.Group();
    body.position.set(-0.05, 0.07, 0);
    const middle = 0.23;

    const yolk = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), pink);
    yolk.scale.set(0.74, 0.56, 0.68);
    yolk.position.y = middle;

    const eyes = new THREE.Group();
    eyes.position.y = middle;
    eyes.add(eye(0.058, -0.23, 0.38, 0.5, -0.7), eye(0.058, 0.23, 0.38, 0.5, -0.7));

    const mouth = new THREE.Group();
    mouth.position.y = middle;
    mouth.add(smile(0.06, 0.3, 0.6, -0.6));

    body.add(yolk, eyes, mouth);
    const ground = shadow(4.6, 3.2);
    model.add(body, ground);

    return {
      rig: rigFor(model, 0.25),
      eyes,
      ground,
      wide: 3.0,
      // The yolk is close enough to a ball that turning the face about its middle works.
      look(yaw, pitch) {
        eyes.rotation.set(pitch, yaw, 0);
        mouth.rotation.set(pitch * 0.6, yaw * 0.6, 0);
      },
      lean: (yaw, pitch) => body.rotation.set(pitch * 0.25, yaw * 0.5, -yaw * 0.2),
    };
  })();

  const mascots = [nilly, sunny];
  for (const m of mascots) {
    Object.assign(m, { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 });
    m.look(0, 0);
  }

  // ----- Where they are on the page -----
  const hillEl = document.querySelector(".hero .hill");
  const peekLeft = document.querySelector(".peek--left");
  const peekRight = document.querySelector(".peek--right");
  const lab = document.querySelector("#lab");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canFly = () => Boolean(peekLeft && peekRight) && !reduceMotion.matches;

  let W = 0;
  let H = 0;
  let arrive = reduceMotion.matches ? 1 : 0; // 0 → 1 as they first pop up out of the grass

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const glide = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t); // eases in and out, softly
  const springy = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2); // overshoots, then settles

  // A pose is: middle of the mascot on screen (px), pixels per model unit, and how it is
  // turned (roll on screen, tip toward the viewer).
  const place = (m, pose, yaw, shade) => {
    m.rig.position.set(pose.x - W / 2, H / 2 - pose.y, m === sunny ? 300 : 0);
    m.rig.scale.setScalar(Math.max(pose.size * springy(arrive), 0.0001));
    m.rig.rotation.set(pose.tip, yaw, pose.roll);
    m.ground.material.opacity = shade;
  };

  // The way from the grass to the peeking spot: across at an even pace, with a lift added
  // on top. The lift peaks early (about a third of the way), so they rise first and then
  // come down gently onto the spot, which keeps them clear of the text arriving below.
  const swoop = (a, b, p, lift) => ({
    x: mix(a.x, b.x, p),
    y: mix(a.y, b.y, p) - lift * Math.sin(Math.PI * Math.pow(p, 0.7)),
    size: mix(a.size, b.size, p),
    // They lean into the turn and level out, rather than tumbling.
    roll: mix(a.roll, b.roll, p),
    tip: mix(a.tip, b.tip, p),
  });

  function update() {
    const spot = heroSpot.getBoundingClientRect();
    const hill = hillEl ? hillEl.getBoundingClientRect().height : 100;

    // On the grass: Nilly standing on the right, Sunny lying in front of her on the left.
    const nillyTall = Math.min(380, Math.max(150, spot.width * 0.74));
    const sunnyWide = Math.min(360, Math.max(150, spot.width * 0.68));
    const onGrass = {
      nilly: { x: spot.left + spot.width * 0.7, y: spot.bottom - hill * 0.3 - nillyTall / 2, size: nillyTall / nilly.tall, roll: 0, tip: 0.24 },
      sunny: { x: spot.left + spot.width * 0.24, y: spot.bottom - hill * 0.12 - (sunnyWide / sunny.wide) * 0.2, size: sunnyWide / sunny.wide, roll: 0, tip: 0.26 },
    };

    let raw = 0; // how far along the journey the page has scrolled, 0 to 1
    let peeking = onGrass;
    if (canFly()) {
      // Peeking in at the edges of About, where the hand-drawn mascots would otherwise be.
      // Their boxes are read from the page layout (not from where animations have moved
      // them), and nudged outward so each mascot is partly off the edge.
      const box = peekLeft.parentElement.getBoundingClientRect();
      const spotOf = (el) => ({
        x: box.left + el.offsetLeft + el.offsetWidth / 2,
        y: box.top + el.offsetTop + el.offsetHeight / 2,
        w: el.offsetWidth,
        h: el.offsetHeight,
      });
      const left = spotOf(peekLeft);
      const right = spotOf(peekRight);
      const low = window.matchMedia("(max-width: 900px)").matches; // they sit in the bottom corners
      peeking = {
        sunny: { x: left.x - left.w * (low ? 0.2 : 0.4), y: left.y - left.h * (low ? -0.1 : 0.3), size: (left.w * 1.05) / sunny.wide, roll: -0.5, tip: 1.05 },
        nilly: { x: right.x + right.w * (low ? 0.22 : 0.3), y: right.y - right.h * (low ? -0.2 : 0.5), size: (right.h * 0.86) / nilly.tall, roll: 0.42, tip: 0.14 },
      };

      // (While About is held in place by motion.js, its wrapper still marks its real spot.)
      const about = peekLeft.closest(".pin-spacer") || peekLeft.parentElement;
      const aboutTop = about.getBoundingClientRect().top + window.scrollY;
      // When About is held in place for its story, the journey carries on into that hold and
      // ends while the "Wherever your curiosity begins" line is arriving. Otherwise they land
      // as About comes into view.
      const hold = parseFloat(document.documentElement.style.getPropertyValue("--about-hold")) || 0;
      const end = Math.max(200, hold ? aboutTop + hold * 0.72 : aboutTop - window.innerHeight * 0.45);
      raw = clamp01((window.scrollY - 30) / (end - 30));
    }

    // Nilly sets off first and Sunny follows a beat behind, so they feel like two creatures
    // rather than one object. Sunny's lift is higher, so that where it crosses the page it
    // passes above the text rather than over it.
    // Once they set off, they leave from the spot they were in, rather than being dragged
    // up and out of the window by the hero scrolling away underneath them.
    const risen = canFly() ? Math.max(0, window.scrollY - 30) : 0;
    const takeoff = {
      nilly: { ...onGrass.nilly, y: onGrass.nilly.y + risen },
      sunny: { ...onGrass.sunny, y: onGrass.sunny.y + risen },
    };

    const pn = glide(raw);
    const ps = glide(clamp01((raw - 0.1) / 0.9));
    place(nilly, swoop(takeoff.nilly, peeking.nilly, pn, H * 0.2), -Math.sin(pn * Math.PI) * 0.25, 1 - clamp01(pn * 4));
    place(sunny, swoop(takeoff.sunny, peeking.sunny, ps, H * 0.5), Math.sin(ps * Math.PI) * 0.3, mix(1, 0.55, ps));

    // Once the Lab has slid over About there is nothing left to see.
    const covered = lab && lab.getBoundingClientRect().top <= 0;
    canvas.style.visibility = covered ? "hidden" : "visible";
    if (!covered) renderer.render(scene, camera);
  }

  // ----- Redrawing, only when needed -----
  let frame = 0;
  let started = 0;
  const tick = (now) => {
    frame = 0;
    let moving = false;

    if (arrive < 1) {
      if (!started) started = now;
      arrive = clamp01((now - started) / 900);
      moving = arrive < 1;
    }
    for (const m of mascots) {
      m.yaw += (m.targetYaw - m.yaw) * 0.16;
      m.pitch += (m.targetPitch - m.pitch) * 0.16;
      // Eyes lead and the mouth trails a little, which reads as the whole face turning.
      m.look(m.yaw, m.pitch);
      m.lean(m.yaw, m.pitch);
      if (Math.abs(m.targetYaw - m.yaw) + Math.abs(m.targetPitch - m.pitch) > 0.001) moving = true;
    }
    update();
    if (moving) request();
  };
  const request = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  // They look toward wherever the pointer is on the page.
  const where = new THREE.Vector3();
  window.addEventListener("pointermove", (event) => {
    const px = (event.clientX / W) * 2 - 1;
    const py = -((event.clientY / H) * 2 - 1);
    for (const m of mascots) {
      m.eyes.getWorldPosition(where).project(camera);
      m.targetYaw = THREE.MathUtils.clamp((px - where.x) * 0.5, -0.34, 0.34);
      m.targetPitch = THREE.MathUtils.clamp(-(py - where.y) * 0.4, -0.26, 0.2);
    }
    request();
  });

  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.left = -W / 2;
    camera.right = W / 2;
    camera.top = H / 2;
    camera.bottom = -H / 2;
    camera.updateProjectionMatrix();
    request();
  };

  document.body.append(canvas);
  heroSpot.classList.add("has-3d");
  document.documentElement.classList.toggle("has-flying-mascots", canFly());

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", resize);
  new ResizeObserver(request).observe(document.body); // the page reflowing moves their spots
  reduceMotion.addEventListener("change", () => {
    document.documentElement.classList.toggle("has-flying-mascots", canFly());
    request();
  });
  resize();
}
