// KAL-M website - 3D robotic arm that picks a trial clip from the thumbnails and places it on the big screen.
// The 3D canvas spans the whole section (clicks pass through), but the camera keeps the arm framed in its column.
const present = document.getElementById("present");
const stage = document.getElementById("armStage");
const carry = document.getElementById("carry");
const carryImg = carry.querySelector("img");
const screenEl = document.querySelector(".screen");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (e) { return false; }
}
const near = new IntersectionObserver((entries) => {
  if (!entries.some((e) => e.isIntersecting)) return;
  near.disconnect();
  if (webglOK() && !reduce && window.matchMedia("(min-width: 1001px)").matches)
    start().catch((e) => { console.warn("Arm 3D unavailable:", e); stage.classList.add("no3d"); });
  else stage.classList.add("no3d");
}, { rootMargin: "600px 0px" });
near.observe(stage);

// Planar motion: the base turn J1 is fixed so the arm works parallel to the screen (no swinging toward the viewer).
// Pose = [J2 shoulder, J3 elbow, tool pitch]; tool pitch 90 = gripper pointing straight down, 0 = pointing forward.
const PLANE = 31;
const REST = [PLANE, -10, -18, 15];      // [J1 base turn, J2, J3, tool pitch]

async function start() {
  const THREE = await import("./assets/vendor/three/three.module.min.js");
  const { GLTFLoader } = await import("./assets/vendor/three/GLTFLoader.js");
  const { DRACOLoader } = await import("./assets/vendor/three/DRACOLoader.js");
  const { RoomEnvironment } = await import("./assets/vendor/three/RoomEnvironment.js");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.className = "arm-canvas";
  present.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9d86ff, 1.6); rim.position.set(-3, 2.5, -2.5); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const LOOK = new THREE.Vector3(0.36, 0.62, 0);
  camera.position.set(1.8, 1.12, 2.35);
  camera.lookAt(LOOK);

  const draco = new DRACOLoader();
  draco.setDecoderPath("./assets/vendor/three/");
  draco.setDecoderConfig({ type: "wasm" });
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const arm = (await loader.loadAsync("./assets/models/arm.glb")).scene;
  scene.add(arm);
  const J = {};
  ["J1", "J2", "J3", "J4", "J5", "J6"].forEach((n) => { J[n] = arm.getObjectByName(n); });
  const tip = new THREE.Object3D(); tip.position.set(0.21, 0, 0); J.J6.add(tip);   // between the gripper fingers

  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"); const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grd.addColorStop(0, "rgba(0,0,0,.6)"); grd.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.001; scene.add(shadow);

  const rad = THREE.MathUtils.degToRad;
  function apply(p) {   // p = [J1, J2, J3, toolPitch]; Blender Z-rot -> Y here, Blender Y-rot -> -Z here
    J.J1.rotation.y = rad(p[0]); J.J2.rotation.z = -rad(p[1]); J.J3.rotation.z = -rad(p[2]);
    J.J5.rotation.z = -rad(p[3] - p[1] - p[2]);           // wrist keeps the gripper at the wanted pitch
  }
  const fingers = { l: arm.getObjectByName("finger_l"), r: arm.getObjectByName("finger_r"), pl: arm.getObjectByName("pad_l"), pr: arm.getObjectByName("pad_r") };
  const fz = {}; for (const k in fingers) fz[k] = fingers[k] ? fingers[k].position.z : 0;
  function grip(open) {   // 0 = closed on the card, 1 = open
    const d = 0.016 * open;
    if (fingers.l) fingers.l.position.z = fz.l + d; if (fingers.pl) fingers.pl.position.z = fz.pl + d;
    if (fingers.r) fingers.r.position.z = fz.r - d; if (fingers.pr) fingers.pr.position.z = fz.pr - d;
  }

  // Keep the arm framed inside its column while drawing over the whole section.
  // Virtual frame: the arm is framed in a fixed-height frame whose bottom sits on the row's bottom line,
  // so the base stands on the same line as the screen and thumbnails regardless of the row height.
  const VH = 560, BASELINE = 26;
  function resize() {
    const cr = renderer.domElement.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    renderer.setSize(cr.width, cr.height, false);
    camera.aspect = sr.width / VH;
    const dx = sr.width * 0.3, top = sr.bottom + BASELINE + 60 - VH;   // centred base, standing on the row's bottom line
    camera.setViewOffset(sr.width, VH, cr.left - sr.left - dx, cr.top - top, cr.width, cr.height);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(present); resize();

  const v = new THREE.Vector3();
  function tipXY() {   // gripper tip in section pixels
    arm.updateMatrixWorld(true); tip.getWorldPosition(v); v.project(camera);
    const cr = renderer.domElement.getBoundingClientRect(), pr = present.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * cr.width + (cr.left - pr.left), y: (1 - v.y) / 2 * cr.height + (cr.top - pr.top) };
  }
  function rel(el) {
    const r = el.getBoundingClientRect(), pr = present.getBoundingClientRect();
    return { x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height };
  }
  function solve(tx, ty, pitch, j1) {   // base turned to j1; find [J2, J3] that put the gripper tip on (tx, ty)
    let best = null;
    const test = (j2, j3) => { apply([j1, j2, j3, pitch]); const t = tipXY(); const d = (t.x - tx) ** 2 + (t.y - ty) ** 2; if (!best || d < best.d) best = { p: [j1, j2, j3, pitch], d }; };
    for (let b = -40; b <= 80; b += 3) for (let c = -95; c <= 150; c += 3) test(b, c);
    for (let step = 1.5; step >= 0.2; step /= 2) for (let k = 0; k < 40; k++) {
      const b0 = best.p[1], c0 = best.p[2], before = best.d;
      for (const [db, dc] of [[step, 0], [-step, 0], [0, step], [0, -step]]) { const nb = b0 + db, nc = c0 + dc; if (nb < -40 || nb > 80 || nc < -95 || nc > 150) continue; test(nb, nc); }
      if (best.d >= before) break;
    }
    return best;
  }
  const ease = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => a.map((x, i) => lerp(x, b[i], t));

  // ---- pick-and-place timeline ----
  let job = null;
  const T = { hover: 650, down: 260, close: 160, carry: 950, place: 650, back: 700 };
  window.kalmArmPick = (thumb, onPlace) => {
    window.kalmArmBusy = true;
    carryImg.src = thumb.querySelector("img").src;
    const f = rel(thumb), sc = rel(screenEl);
    const grabAt = { x: f.x + f.w * 0.5, y: f.y + 5 };              // fingers close on the card's top edge, centred
    const pick = PLANE + 180;                                         // base turns to face the clips on the left
    const hover = solve(grabAt.x, grabAt.y - 70, 90, pick).p;         // above the card, gripper pointing down
    const down = solve(grabAt.x, grabAt.y, 90, pick).p;
    const drop = solve(sc.x + sc.w * 0.25, sc.y + 6, 90, PLANE).p;    // turn back and release at the screen's top edge
    job = { t0: performance.now(), thumb, onPlace, placed: false, from: f, grabAt, hover, down, drop };
  };
  function setCard(x, y, w, h, op) {
    carry.style.width = w + "px"; carry.style.height = h + "px";
    carry.style.transform = `translate(${x}px, ${y}px)`; carry.style.opacity = op;
  }

  let visible = true;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(present);
  const t0 = performance.now();
  renderer.setAnimationLoop((now) => {
    if (!visible) return;
    const s = (now - t0) / 1000;
    const sway = [0, Math.sin(s * .45) * 0.8, Math.sin(s * .6) * 0.8, 0];
    if (!job) { apply(REST.map((x, i) => x + sway[i])); grip(0.6); }
    else {
      const t = now - job.t0, k = [T.hover, T.down, T.close, T.carry, T.place, T.back];
      const e1 = k[0], e2 = e1 + k[1], e3 = e2 + k[2], e4 = e3 + k[3], e5 = e4 + k[4], e6 = e5 + k[5];
      const f = job.from;
      if (t < e1)      { apply(mix(REST, job.hover, ease(t / e1))); grip(1); setCard(f.x, f.y, f.w, f.h, 0); }
      else if (t < e2) { apply(mix(job.hover, job.down, ease((t - e1) / k[1]))); grip(1); setCard(f.x, f.y, f.w, f.h, 0); }
      else if (t < e3) { apply(job.down); grip(1 - (t - e2) / k[2]); setCard(f.x, f.y, f.w, f.h, 1); job.thumb.classList.add("taken"); }
      else if (t < e4) {                                     // carried: card hangs from the closed fingers
        apply(mix(job.down, job.drop, ease((t - e3) / k[3]))); grip(0);
        const tp = tipXY(); setCard(tp.x - f.w / 2, tp.y - 5, f.w, f.h, 1);
      } else if (t < e5) {                                   // fingers open, card grows into the big screen
        apply(job.drop); const e = ease((t - e4) / k[4]); grip(Math.min(1, e * 3));
        const tp = tipXY(), sc = rel(screenEl);
        setCard(lerp(tp.x - f.w / 2, sc.x, e), lerp(tp.y - 5, sc.y, e), lerp(f.w, sc.w, e), lerp(f.h, sc.h, e), 1);
        if (e > .85 && !job.placed) { job.placed = true; job.onPlace(); }
      } else if (t < e6) {
        apply(mix(job.drop, REST, ease((t - e5) / k[5]))); grip(0.6);
        carry.style.opacity = 0; job.thumb.classList.remove("taken");
        if (!job.placed) { job.placed = true; job.onPlace(); }
      } else { job = null; window.kalmArmBusy = false; }
    }
    renderer.render(scene, camera);
  });
  stage.classList.add("has3d");
  requestAnimationFrame(() => renderer.domElement.classList.add("ready"));
}
