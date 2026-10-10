// Nilly and Sunny as small 3D models, built from basic shapes with three.js.
// Their eyes slide across their faces to follow the cursor. Nothing else moves, and the
// scene is only redrawn while the eyes are catching up, so it costs nothing when idle.
// If WebGL isn't available, the flat PNG mascots in the page stay visible instead.
import * as THREE from "three";

const WHITE = 0xe5deee;
const PINK = 0xa34e8b;
const DARK = 0x19082c;

const holder = document.querySelector(".hero-scene");
if (holder) {
  try {
    init(holder);
  } catch (error) {
    console.warn("3D mascots unavailable, showing the flat ones instead.", error);
  }
}

function init(holder) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = "mascots-3d";
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
  camera.position.set(0, 3.5, 9.6);
  camera.lookAt(-0.15, 1.05, 0);

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

  // A soft dark patch on the ground under each mascot.
  const shadowTexture = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const fade = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    fade.addColorStop(0, "rgba(12, 4, 22, 0.55)");
    fade.addColorStop(1, "rgba(12, 4, 22, 0)");
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

  // ----- Nilly: an egg standing upright, with a pink belly -----
  const nilly = new THREE.Group();
  {
    const half = 1.3;
    const profile = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI;
      const up = -Math.cos(t); // -1 at the base, +1 at the tip
      profile.push(new THREE.Vector2(Math.sin(t) * (1 - 0.18 * up), half + up * half));
    }
    nilly.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 64), white));

    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), pink);
    belly.scale.set(0.8, 0.82, 0.7);
    belly.position.set(0, 0.86, 0.37);
    nilly.add(belly);

    nilly.add(smile(0.085, 1.84, 0.87, -0.3));

    const eyes = new THREE.Group();
    eyes.position.set(0, half, 0);
    eyes.add(eye(0.075, -0.3, 0.66, 0.75, -0.3), eye(0.075, 0.3, 0.66, 0.75, -0.3));
    nilly.add(eyes);
    nilly.userData.eyes = eyes;

    nilly.add(shadow(3.2, 1.6));
    nilly.position.set(0.9, 0, 0);
  }

  // ----- Sunny: a fried egg lying on the grass, face on the yolk -----
  const sunny = new THREE.Group();
  {
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
    sunny.add(new THREE.Mesh(puddle, white));

    const centre = new THREE.Vector3(-0.05, 0.3, 0);
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), pink);
    yolk.scale.set(0.74, 0.56, 0.68);
    yolk.position.copy(centre);
    sunny.add(yolk);

    const face = new THREE.Group();
    face.position.copy(centre);
    face.add(smile(0.06, 0.3, 0.6, -0.6));
    sunny.add(face);

    const eyes = new THREE.Group();
    eyes.position.copy(centre);
    eyes.add(eye(0.058, -0.23, 0.38, 0.5, -0.7), eye(0.058, 0.23, 0.38, 0.5, -0.7));
    sunny.add(eyes);
    sunny.userData.eyes = eyes;

    sunny.add(shadow(4.4, 3));
    sunny.scale.setScalar(0.86);
    sunny.rotation.y = 0.2;
    sunny.position.set(-1.1, 0, 0.9);
  }

  scene.add(nilly, sunny);
  const mascots = [nilly, sunny].map((group) => ({
    eyes: group.userData.eyes,
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
  }));

  // ----- Drawing, only when something changed -----
  let frame = 0;
  const render = () => renderer.render(scene, camera);

  const settle = () => {
    let moving = false;
    for (const m of mascots) {
      m.yaw += (m.targetYaw - m.yaw) * 0.18;
      m.pitch += (m.targetPitch - m.pitch) * 0.18;
      m.eyes.rotation.set(m.pitch, m.yaw, 0);
      if (Math.abs(m.targetYaw - m.yaw) + Math.abs(m.targetPitch - m.pitch) > 0.001) moving = true;
    }
    render();
    frame = moving ? requestAnimationFrame(settle) : 0;
  };

  // Eyes turn toward wherever the pointer is on the page, not just over the mascots.
  const where = new THREE.Vector3();
  window.addEventListener("pointermove", (event) => {
    const box = renderer.domElement.getBoundingClientRect();
    if (!box.width) return;
    const px = ((event.clientX - box.left) / box.width) * 2 - 1;
    const py = -(((event.clientY - box.top) / box.height) * 2 - 1);
    for (const m of mascots) {
      m.eyes.getWorldPosition(where).project(camera);
      m.targetYaw = THREE.MathUtils.clamp((px - where.x) * 0.3, -0.34, 0.34);
      m.targetPitch = THREE.MathUtils.clamp(-(py - where.y) * 0.24, -0.26, 0.2);
    }
    if (!frame) frame = requestAnimationFrame(settle);
  });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = renderer.domElement;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };

  holder.append(renderer.domElement);
  holder.classList.add("has-3d");
  new ResizeObserver(resize).observe(holder);
  resize();
}
