// KAL-M website - BoxingBots page top: the BoxingBots arena and two BoxingBots, both from KAL-M's own CAD files.
// Scrolling turns the arena from the front view to an angled top view, then the two bots fight. Scrolling back rewinds.
// The moves are the special moves students code in the course: attack, block, jam combo, finisher.
// The bots wear their real sticker sets (Samurai, Cyber Boy), fitted part by part from the print file (tbb-stickers.json).
// No WebGL, or reduced motion: the still picture stays and the section is one screen tall.
const sec = document.getElementById("fight");
if (sec) init();

function init() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let gl = false;
  try { const c = document.createElement("canvas"); gl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { gl = false; }
  if (reduce || !gl) { flatten(); return; }
  start().catch((e) => { console.warn("BoxingBots 3D unavailable:", e); flatten(); });
}

// The section is tall from the first paint (CSS). If the 3D can't run, shrink it to one screen,
// keeping the reader's place if they are already below it.
function flatten() {
  const before = sec.offsetHeight, below = window.scrollY > sec.offsetTop + before - 10;
  sec.classList.add("flat");
  if (below) window.scrollBy(0, sec.offsetHeight - before);
}

const STICKERS = true;                                // sticker sets (fitted part by part; more parts added as they are done)
const D = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);

// ---- the fight: poses over fight time f (0..1). adv = mm driven toward the centre; angles in degrees.
// hip + : left-side arm forward; sL/sR : shoulder swing forward; eL/eR : forearm raised forward; tilt : tipped backward.
const P = (o) => Object.assign({ adv: 0, hip: 0, sL: 0, eL: 0, sR: 0, eR: 0, tilt: 0 }, o);
const G = { eL: 55, eR: 55, sL: 8, sR: 8 };            // guard
const GA = 310;                                       // advance at fighting distance (hip axes 280 mm apart)
const KEYS = [
  [0.00, P({}), P({})],
  [0.10, P({ adv: GA, ...G }), P({ adv: GA, ...G })],
  // Attack: A jabs, B takes it
  [0.15, P({ adv: GA + 25, ...G, hip: 14, sL: 28, eL: 100 }), P({ adv: GA, ...G })],
  [0.18, P({ adv: GA, ...G }), P({ adv: GA - 15, ...G, tilt: 4 })],
  // Block: B attacks, A blocks
  [0.24, P({ adv: GA, ...G, hip: 6, sL: 30, eL: 95 }), P({ adv: GA + 25, ...G, hip: -14, sR: 28, eR: 100 })],
  [0.28, P({ adv: GA, ...G }), P({ adv: GA, ...G })],
  // Jam combo: A left-right-left, B driven back
  [0.33, P({ adv: GA + 25, ...G, hip: 15, sL: 28, eL: 100 }), P({ adv: GA - 10, ...G, tilt: 4 })],
  [0.37, P({ adv: GA + 40, ...G, hip: -15, sR: 28, eR: 100 }), P({ adv: GA - 30, ...G, hip: 10, tilt: 7 })],
  [0.41, P({ adv: GA + 55, ...G, hip: 15, sL: 28, eL: 100 }), P({ adv: GA - 50, ...G, hip: -10, tilt: 8 })],
  [0.46, P({ adv: GA + 30, ...G }), P({ adv: GA - 30, ...G })],
  // Finisher: wind up, big right uppercut, knock-out
  [0.53, P({ adv: GA + 20, ...G, hip: 28, eR: 30, sR: 0 }), P({ adv: GA - 20, ...G })],
  [0.60, P({ adv: GA + 60, ...G, hip: -26, sR: 35, eR: 150 }), P({ adv: GA - 30, ...G, tilt: 10 })],
  [0.70, P({ adv: GA + 50, ...G, hip: -10, sR: 20, eR: 120 }), P({ adv: GA - 160, hip: 30, eL: 15, eR: 5, tilt: 24 })],
  // A wins
  [0.82, P({ adv: GA + 40, eL: 165, eR: 165 }), P({ adv: GA - 170, hip: 30, eL: 10, eR: 5, tilt: 24 })],
  [1.00, P({ adv: GA + 40, eL: 165, eR: 165, hip: 8 }), P({ adv: GA - 170, hip: 30, eL: 10, eR: 5, tilt: 24 })],
];
const MOVES = [[0.11, 0.20, "Attack"], [0.20, 0.29, "Block"], [0.29, 0.47, "Jam combo"], [0.48, 0.74, "Finisher"]];
const START = 450;                                    // mm from the ring centre to each bot at the start
const TURN = 0.22;                                    // scroll share spent turning the arena before the fight
// The arena turns 45 degrees under the bots (as in the sketch); the bots stay side by side on screen.
// Camera over the whole scroll: [p, azimuth deg, elevation deg, distance mm, look-at height mm]
const CAM = [[0, 0, 9, 4608, -300], [TURN, 0, 50, 2300, 120], [0.6, 8, 38, 1850, 150], [1, 10, 26, 1900, 190]];

function lerpKeys(keys, p) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], u = clamp((p - a[0]) / (b[0] - a[0]));
  // "in" = speeds up into the key (a punch lands at full speed); "out" = starts fast and settles (the hit bot recoils)
  return { a, b, t: b[3] === "in" ? u * u : b[3] === "out" ? 1 - (1 - u) * (1 - u) : ease(u) };
}
const mixPose = (x, y, t) => { const o = {}; for (const k in x) o[k] = x[k] + (y[k] - x[k]) * t; return o; };

async function start() {
  const THREE = await import("./assets/vendor/three/three.module.min.js");
  const { GLTFLoader } = await import("./assets/vendor/three/GLTFLoader.js");
  const { RoomEnvironment } = await import("./assets/vendor/three/RoomEnvironment.js");
  const { toCreasedNormals, mergeGeometries } = await import("./assets/vendor/three/BufferGeometryUtils.js");

  const stage = sec.querySelector(".fight-stage");
  const still = sec.querySelector(".fight-still");
  const moveBox = sec.querySelector(".fight-move");
  const moveEl = document.getElementById("fightMove");
  const phone = window.matchMedia("(max-width: 760px)").matches;

  const loader = new GLTFLoader();
  const url = (f) => new URL("./assets/models/" + f, import.meta.url).href;
  const [arenaG, botG, stk, stkTex, logoTex, wrapCyan, wrapRed, floorTex] = await Promise.all([loader.loadAsync(url("tbb-arena.glb")), loader.loadAsync(url("tbb-bot.glb")),
    STICKERS ? fetch(url("tbb-stickers.json?v=8")).then((r) => r.json()).catch(() => null) : null,
    STICKERS ? new THREE.TextureLoader().loadAsync(url("tbb-stickers.webp?v=8")).catch(() => null) : null,
    new THREE.TextureLoader().loadAsync(url("tbb-logo-black.png?v=1")).catch(() => null),
    new THREE.TextureLoader().loadAsync(url("tbb-wrap-cyan.webp?v=3")).catch(() => null),
    new THREE.TextureLoader().loadAsync(url("tbb-wrap-red.webp?v=3")).catch(() => null),
    new THREE.TextureLoader().loadAsync(url("tbb-floor.webp?v=4")).catch(() => null)]);

  const renderer = new THREE.WebGLRenderer({ antialias: !phone, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(phone ? 1.5 : 2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !phone;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "fight-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  still.after(renderer.domElement);

  const BG = 0x0a0a0a;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 5200, 11000);           // scaled with the camera zoom in size()
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;

  scene.add(new THREE.HemisphereLight(0x9aa0aa, 0x050505, 0.5));
  const spot = new THREE.SpotLight(0xfff3e2, 3.4, 0, 0.45, 0.6, 0);
  spot.position.set(300, 3200, 800);
  scene.add(spot, spot.target);
  if (!phone) {
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 1800; spot.shadow.camera.far = 4200;
    spot.shadow.bias = -0.0004;
  }
  const rim = new THREE.DirectionalLight(0x8a74d6, 1.4); rim.position.set(-1600, 900, -1800); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(1500, 700, 2200); scene.add(fill);

  const mat = (color, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const key = (o) => o.name.replace(/_/g, " ");

  // ---- arena (CAD is Z-up): floor centre at the origin, floor top at y = 0
  const AM = { box: mat(0x141519, 0.85), plate: mat(0x1c1d21, 0.7), floor: mat(0xb2b6bc, 0.8), skirt: mat(0xaab0b8, 0.5),
    frame: mat(0x2b2d32, 0.5, 0.6), post: mat(0xcfd3d8, 0.3, 0.8), rope: mat(0xdadde1, 0.45) };
  const ROLE = { COMPOUND001: "floor", COMPOUND004: "frame", COMPOUND009: "plate", COMPOUND010: "box", COMPOUND011: "box" };
  const arena = arenaG.scene;
  arena.rotation.x = -Math.PI / 2;
  let floorMesh = null; const posts = [], skirts = []; let boxMesh = null;
  arena.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry = toCreasedNormals(o.geometry, 0.6);
    const n = key(o);
    const role = ROLE[n] || (/COMPOUND00[5-8]/.test(n) ? "post" : /COMPOUND01[2-5]/.test(n) ? "skirt" : "box");
    o.material = AM[role];
    o.receiveShadow = role === "floor";
    if (role === "floor") floorMesh = o;
    if (role === "post") posts.push(o);
    if (role === "skirt") skirts.push(o);
    if (n === "COMPOUND010") boxMesh = o;
  });
  arena.updateMatrixWorld(true);
  const fb = new THREE.Box3().setFromObject(floorMesh), fc = fb.getCenter(new THREE.Vector3());
  arena.position.set(-fc.x, -fb.max.y, -fc.z);
  const ring = new THREE.Group();                     // arena + ropes; turns as you scroll
  ring.add(arena); scene.add(ring);
  arena.updateMatrixWorld(true);

  // THE BOXING BOTS logo on the outer face of the 4 angled skirt panels, as on the real arena.
  // The panel's outer face gets texture coordinates from a flat projection (logo centred, upright, read from outside).
  function addLogo(mesh, lMat, aspect) {
    const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array, tris = P.length / 9, M = mesh.matrixWorld;
    const W = [];
    for (let i = 0; i < P.length; i += 3) W.push(new THREE.Vector3(P[i], P[i + 1], P[i + 2]).applyMatrix4(M));
    const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const out = new THREE.Vector3(c.x, 0, c.z).normalize(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const fn = [];
    for (let t = 0; t < tris; t++) fn.push(e1.subVectors(W[t * 3 + 1], W[t * 3]).cross(e2.subVectors(W[t * 3 + 2], W[t * 3])).clone());
    const n = new THREE.Vector3();
    fn.forEach((f) => { if (f.lengthSq() && f.clone().normalize().dot(out) > 0.5) n.add(f); });
    if (!n.lengthSq()) return;
    n.normalize();
    const face = fn.map((f) => f.lengthSq() > 0 && f.clone().normalize().dot(n) > 0.97);
    const u = new THREE.Vector3(0, 1, 0).cross(n).normalize(), v = n.clone().cross(u);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    face.forEach((on, t) => { if (on) for (let k = 0; k < 3; k++) { const U = W[t * 3 + k].dot(u), V = W[t * 3 + k].dot(v);
      u0 = Math.min(u0, U); u1 = Math.max(u1, U); v0 = Math.min(v0, V); v1 = Math.max(v1, V); } });
    let h = 0.62 * (v1 - v0), w = h * aspect;
    if (w > 0.8 * (u1 - u0)) { w = 0.8 * (u1 - u0); h = w / aspect; }
    const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
    const plain = [], decal = [];
    face.forEach((on, t) => (on ? decal : plain).push(t));
    const np = new Float32Array(P.length), nn = new Float32Array(N.length), uv = new Float32Array(tris * 6);
    plain.concat(decal).forEach((t, i) => {
      np.set(P.subarray(t * 9, t * 9 + 9), i * 9); nn.set(N.subarray(t * 9, t * 9 + 9), i * 9);
      if (i < plain.length) return;
      for (let k = 0; k < 3; k++) {
        uv[i * 6 + k * 2] = (W[t * 3 + k].dot(u) - uc) / w + 0.5;
        uv[i * 6 + k * 2 + 1] = (W[t * 3 + k].dot(v) - vc) / h + 0.5;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(np, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nn, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.addGroup(0, plain.length * 3, 0); g.addGroup(plain.length * 3, decal.length * 3, 1);
    mesh.geometry = g; mesh.material = [mesh.material, lMat];
  }
  if (logoTex) {
    logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const lMat = new THREE.MeshStandardMaterial({ map: logoTex, color: AM.skirt.color, roughness: 0.5, metalness: 0.5 });
    lMat.onBeforeCompile = (sh) => {                  // logo printed over the panel colour (transparent around it)
      sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", [
        "#ifdef USE_MAP",
        "  vec4 lg = texture2D( map, vMapUv );",
        "  diffuseColor.rgb = mix( diffuseColor.rgb, lg.rgb, lg.a );",
        "#endif"].join("\n"));
    };
    for (const o of skirts) addLogo(o, lMat, logoTex.image.width / logoTex.image.height);
  }

  // Base box wrap, as on the event stall: black print with the logo; front/back cyan, left/right red.
  // Each outer side face gets the whole print, upright, read from outside.
  function wrapBox(mesh, mats) {
    const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array, tris = P.length / 9, M = mesh.matrixWorld;
    const W = [];
    for (let i = 0; i < P.length; i += 3) W.push(new THREE.Vector3(P[i], P[i + 1], P[i + 2]).applyMatrix4(M));
    const DIRS = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)];
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const side = [];                                   // per triangle: index into DIRS, or -1
    for (let t = 0; t < tris; t++) {
      const f = e1.subVectors(W[t * 3 + 1], W[t * 3]).cross(e2.subVectors(W[t * 3 + 2], W[t * 3]));
      if (!f.lengthSq()) { side.push(-1); continue; }
      f.normalize(); side.push(DIRS.findIndex((d) => f.dot(d) > 0.97));
    }
    // keep only the outermost face in each direction (skip inner walls)
    const far = DIRS.map((d, k) => Math.max(-1e9, ...side.map((s, t) => (s === k ? W[t * 3].dot(d) : -1e9))));
    side.forEach((s, t) => { if (s >= 0 && W[t * 3].dot(DIRS[s]) < far[s] - 5) side[t] = -1; });
    const box = DIRS.map((d) => {
      const u = new THREE.Vector3(0, 1, 0).cross(d).normalize(), v = d.clone().cross(u);
      return { u, v, u0: 1e9, u1: -1e9, v0: 1e9, v1: -1e9 };
    });
    side.forEach((s, t) => { if (s < 0) return; const b = box[s];
      for (let k = 0; k < 3; k++) { const U = W[t * 3 + k].dot(b.u), V = W[t * 3 + k].dot(b.v);
        b.u0 = Math.min(b.u0, U); b.u1 = Math.max(b.u1, U); b.v0 = Math.min(b.v0, V); b.v1 = Math.max(b.v1, V); } });
    const order = [-1, 0, 1, 2, 3], np = new Float32Array(P.length), nn = new Float32Array(N.length), uv = new Float32Array(tris * 6);
    const g = new THREE.BufferGeometry();
    let i = 0;
    order.forEach((s, gi) => {
      const start = i;
      side.forEach((ss, t) => {
        if (ss !== s) return;
        np.set(P.subarray(t * 9, t * 9 + 9), i * 9); nn.set(N.subarray(t * 9, t * 9 + 9), i * 9);
        if (s >= 0) { const b = box[s];
          for (let k = 0; k < 3; k++) {
            uv[i * 6 + k * 2] = (W[t * 3 + k].dot(b.u) - b.u0) / (b.u1 - b.u0);
            uv[i * 6 + k * 2 + 1] = (W[t * 3 + k].dot(b.v) - b.v0) / (b.v1 - b.v0);
          } }
        i++;
      });
      if (i > start) g.addGroup(start * 3, (i - start) * 3, gi);
    });
    g.setAttribute("position", new THREE.BufferAttribute(np, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nn, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    mesh.geometry = g; mesh.material = [mesh.material, mats[0], mats[0], mats[1], mats[1]];
  }
  // Floor print, as on the real arena: black outline robot-head logo in the centre, red "THE BOXING BOTS" along each edge
  // (letter tops toward the edge). Top face only; the print (transparent around it) mixes over the floor colour.
  if (floorMesh && floorTex) {
    const P = floorMesh.geometry.attributes.position.array, N = floorMesh.geometry.attributes.normal.array, tris = P.length / 9, M = floorMesh.matrixWorld;
    const W = [];
    for (let i = 0; i < P.length; i += 3) W.push(new THREE.Vector3(P[i], P[i + 1], P[i + 2]).applyMatrix4(M));
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const up = [];
    for (let t = 0; t < tris; t++) {
      const f = e1.subVectors(W[t * 3 + 1], W[t * 3]).cross(e2.subVectors(W[t * 3 + 2], W[t * 3]));
      up.push(f.lengthSq() > 0 && f.normalize().y > 0.97);
    }
    const topY = Math.max(...up.map((u, t) => (u ? W[t * 3].y : -1e9)));
    up.forEach((u, t) => { if (u && W[t * 3].y < topY - 2) up[t] = false; });
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    up.forEach((u, t) => { if (u) for (let k = 0; k < 3; k++) { const q = W[t * 3 + k];
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); } });
    const plain = [], top = [];
    up.forEach((u, t) => (u ? top : plain).push(t));
    const np = new Float32Array(P.length), nn = new Float32Array(N.length), uv = new Float32Array(tris * 6);
    plain.concat(top).forEach((t, i) => {
      np.set(P.subarray(t * 9, t * 9 + 9), i * 9); nn.set(N.subarray(t * 9, t * 9 + 9), i * 9);
      if (i >= plain.length) for (let k = 0; k < 3; k++) {
        uv[i * 6 + k * 2] = (W[t * 3 + k].x - x0) / (x1 - x0);           // image left = -x
        uv[i * 6 + k * 2 + 1] = 1 - (W[t * 3 + k].z - z0) / (z1 - z0);   // image top = far side (-z)
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(np, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nn, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.addGroup(0, plain.length * 3, 0); g.addGroup(plain.length * 3, top.length * 3, 1);
    floorTex.colorSpace = THREE.SRGBColorSpace; floorTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const fMat = new THREE.MeshStandardMaterial({ map: floorTex, color: AM.floor.color, roughness: 0.8, metalness: 0 });
    fMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", [
        "#ifdef USE_MAP",
        "  vec4 pr = texture2D( map, vMapUv );",
        "  diffuseColor.rgb = mix( diffuseColor.rgb, pr.rgb, pr.a );",
        "#endif"].join("\n"));
    };
    floorMesh.geometry = g; floorMesh.material = [floorMesh.material, fMat];
  }
  if (boxMesh && wrapCyan && wrapRed) {
    const wm = (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0 });
    };
    wrapBox(boxMesh, [wm(wrapCyan), wm(wrapRed)]);
  }

  // corner posts keep the original light steel (AM.post); red/blue and black were tried 2026-11-20 and rejected

  // ropes between the corner posts, as on the real arena
  const pc = posts.map((o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()))
    .sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  // Ropes as in human boxing: steel cable core, foam padding, vinyl cover (padded part); fittings as on the real arena.
  // 2 ropes per side. Each rope end is an eye looped through a red D-shackle
  // whose pin passes through a lug welded to the post; the eye's loose tail is held by 2 wire-rope clips.
  // Built per end in a local frame (x = from the post toward the rope, y = up), then merged into 4 meshes.
  const pb = new THREE.Box3().setFromObject(posts[0]), postR = (pb.max.x - pb.min.x) / 2;
  const steelG = [], redG = [], wireG = [], padG = [];
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  const place = (list, g, m) => { list.push(g.applyMatrix4(m)); };
  const local = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const wire = (from, to, r) => {                     // straight cylinder between two points
    const len = from.distanceTo(to), g = new THREE.CylinderGeometry(r, r, len, 10, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, to.clone().sub(from).normalize()));
    g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    return g;
  };
  const LUG = postR + 8, PIN = postR + 14, EYE = PIN + 20, CL1 = PIN + 36, CL2 = PIN + 50;   // mm from the post centre
  const PAD_GAP = 40;                                // bare cable between the eye and the padded part (clips sit here)
  function ropeEnd(post, dir, h) {                    // returns the world point where the rope leaves the eye
    const m = new THREE.Matrix4().compose(new THREE.Vector3(post.x, h, post.z), new THREE.Quaternion().setFromUnitVectors(X, dir), ONE);
    const at = (x, y = 0, z = 0) => new THREE.Vector3(x, y, z).applyMatrix4(m);
    place(steelG, new THREE.BoxGeometry(18, 16, 4).applyMatrix4(local(LUG, 0, 0)), m);                       // lug
    place(steelG, new THREE.CylinderGeometry(2.6, 2.6, 24, 10).rotateX(Math.PI / 2).applyMatrix4(local(PIN, 0, 0)), m);   // pin
    const bow = new THREE.TorusGeometry(9, 2.6, 8, 20, Math.PI).rotateZ(-Math.PI / 2).rotateX(Math.PI / 2);
    place(redG, bow.applyMatrix4(local(PIN + 8, 0, 0)), m);                                                    // shackle bow
    for (const z of [-9, 9]) place(redG, new THREE.CylinderGeometry(2.6, 2.6, 8, 8).rotateZ(Math.PI / 2).applyMatrix4(local(PIN + 4, 0, z)), m);
    place(steelG, new THREE.TorusGeometry(6, 2.4, 8, 20).applyMatrix4(local(EYE, 0, 0)), m);                 // rope eye
    for (const x of [CL1, CL2]) place(steelG, new THREE.BoxGeometry(9, 12, 13).applyMatrix4(local(x, 1, 2.5)), m);   // clips
    wireG.push(wire(at(EYE + 4, -4, 5), at(CL2 + 10, -1, 5), 3));                                                  // loose tail
    return at(EYE + 6, 0, 0);
  }
  const top = pb.max.y;
  for (const h of [Math.round(top * 0.36), Math.round(top * 0.7)]) {
    pc.forEach((a, i) => {
      const b = pc[(i + 1) % pc.length], d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
      const S = ropeEnd(a, d, h), E = ropeEnd(b, d.clone().negate(), h);
      wireG.push(wire(S, E, 3));                      // steel cable core, bare only at the ends
      const s0 = S.clone().addScaledVector(d, PAD_GAP), s1 = E.clone().addScaledVector(d, -PAD_GAP), len = s0.distanceTo(s1);
      // padded part: a straight tube (texture runs evenly along it) with a round cap at each end
      const q = new THREE.Quaternion().setFromUnitVectors(Y, d), mid = new THREE.Vector3((s0.x + s1.x) / 2, h, (s0.z + s1.z) / 2);
      padG.push(new THREE.CylinderGeometry(6.5, 6.5, len, 20, 1, true).applyQuaternion(q).translate(mid.x, mid.y, mid.z));
      for (const e of [s0, s1]) padG.push(new THREE.SphereGeometry(6.5, 16, 10).translate(e.x, h, e.z));
    });
  }
  const wireTex = (() => {                            // twisted strands
    const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d");
    g.fillStyle = "#8a9099"; g.fillRect(0, 0, 32, 32); g.strokeStyle = "#4a4f57"; g.lineWidth = 6;
    for (let y = -32; y <= 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(32, y + 32); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 90); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  ring.add(new THREE.Mesh(mergeGeometries(wireG), new THREE.MeshStandardMaterial({ map: wireTex, roughness: 0.45, metalness: 0.6 })));
  // Padded rope cover: white vinyl over foam - soft matte body with a light vinyl sheen (no pattern).
  const ropeMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.55, metalness: 0,
    clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.5, sheenRoughness: 0.6, sheenColor: 0xffffff });
  ring.add(new THREE.Mesh(mergeGeometries(padG), ropeMat));                          // padded cushion rope
  ring.add(new THREE.Mesh(mergeGeometries(steelG.map((g) => g.toNonIndexed())), mat(0xb9bec6, 0.35, 0.85)));
  ring.add(new THREE.Mesh(mergeGeometries(redG.map((g) => g.toNonIndexed())), mat(0xb9bec6, 0.35, 0.85)));   // shackles: plain steel (red removed)
  const groundY = boxMesh ? new THREE.Box3().setFromObject(boxMesh).min.y : -860;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), mat(0x0d0d0f, 0.95));
  ground.rotation.x = -Math.PI / 2; ground.position.y = groundY; scene.add(ground);

  // ---- bots: real joints from the CAD (hip twist, shoulder swing, elbow punch, wheels)
  botG.scene.traverse((o) => { if (o.isMesh) o.geometry = toCreasedNormals(o.geometry, 0.6); });
  const BM = { acrylic: mat(0x16171a, 0.35, 0.05), servo: mat(0x1d2028, 0.5), horn: mat(0xe6e6e6, 0.5), metal: mat(0x9aa0a8, 0.35, 0.8),
    rubber: mat(0x0f0f10, 0.9), bo: mat(0xd9a520, 0.55) };
  const partMat = (n, accent) =>
    /^Real Wheel/.test(n) ? BM.rubber : /Gear Box/.test(n) ? BM.bo : /^Head|^arm(2|002|003|004)$/.test(n) ? accent :
    /servo hub/.test(n) ? BM.horn : /SERVO|^MG995/.test(n) ? BM.servo : /Bearing/.test(n) ? BM.metal : accent;   // plates = bot colour

  if (stkTex) {
    stkTex.colorSpace = THREE.SRGBColorSpace; stkTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    renderer.initTexture(stkTex);                      // upload now, so the first frame already shows the stickers
  }
  const useStickers = !!(stk && stkTex);

  // Sticker faces: the part's triangles facing the sticker's direction get texture coordinates from the fitted mapping
  // and a second material; the rest of the part stays plain acrylic.
  function applyStickers(mesh, entries, sMat) {
    const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array, tris = P.length / 9;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const plain = [], stuck = [];
    for (let t = 0; t < tris; t++) {
      a.fromArray(P, t * 9); b.fromArray(P, t * 9 + 3); c.fromArray(P, t * 9 + 6);
      const fn = e1.subVectors(b, a).cross(e2.subVectors(c, a)).normalize();
      let hit = null;
      for (const e of entries) {
        if (fn.x * e.n[0] + fn.y * e.n[1] + fn.z * e.n[2] < 0.9) continue;
        if (e.off !== null && Math.abs(((a.x + b.x + c.x) * e.n[0] + (a.y + b.y + c.y) * e.n[1] + (a.z + b.z + c.z) * e.n[2]) / 3 - e.off) > 1) continue;
        hit = e; break;
      }
      (hit ? stuck : plain).push([t, hit]);
    }
    if (!stuck.length) return;
    const np = new Float32Array(P.length), nn = new Float32Array(N.length), uv = new Float32Array(tris * 6);
    plain.concat(stuck).forEach(([t, e], i) => {
      np.set(P.subarray(t * 9, t * 9 + 9), i * 9); nn.set(N.subarray(t * 9, t * 9 + 9), i * 9);
      if (!e) return;
      for (let k = 0; k < 3; k++) {
        const x = P[t * 9 + k * 3], y = P[t * 9 + k * 3 + 1], z = P[t * 9 + k * 3 + 2];
        const U = x * e.u[0] + y * e.u[1] + z * e.u[2], V = x * e.v[0] + y * e.v[1] + z * e.v[2];
        uv[i * 6 + k * 2] = e.A[0] * U + e.A[1] * V + e.A[2];
        uv[i * 6 + k * 2 + 1] = e.A[3] * U + e.A[4] * V + e.A[5];
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(np, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nn, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.addGroup(0, plain.length * 3, 0); g.addGroup(plain.length * 3, stuck.length * 3, 1);
    mesh.geometry = g; mesh.material = [mesh.material, sMat];
  }

  function makeBot(livery, accentColor) {
    const accent = mat(accentColor, 0.4, 0.05);              // parts without a sticker keep the bot's colour
    // Sticker material: where the sticker has cut-outs or ends, the plate colour shows (texture alpha mixes over it).
    const sMat = useStickers ? new THREE.MeshStandardMaterial({ map: stkTex, color: accentColor, roughness: 0.4, metalness: 0.05 }) : null;
    if (sMat) sMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", [
        "#ifdef USE_MAP",
        "  vec4 stk = texture2D( map, vMapUv );",
        "  diffuseColor.rgb = mix( diffuseColor.rgb, stk.rgb, stk.a );",
        "#endif"].join("\n"));
    };
    const byPart = {};
    if (useStickers) for (const e of stk[livery] || []) (byPart[e.part] = byPart[e.part] || []).push(e);
    const m = botG.scene.clone(true);
    const meshes = [];
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.material = partMat(key(o), accent); o.castShadow = !phone; meshes.push(o);
      if (byPart[key(o)]) applyStickers(o, byPart[key(o)], sMat);
    });
    m.updateMatrixWorld(true);
    const bx = (n) => new THREE.Box3().setFromObject(meshes.find((o) => key(o) === n));
    const at = (n) => bx(n).getCenter(new THREE.Vector3());
    const all = new THREE.Box3().setFromObject(m);
    const pivot = (parent, p) => { const g = new THREE.Group(); g.position.copy(p); m.add(g); m.updateMatrixWorld(true); parent.attach(g); return g; };
    const hc = at("Bearing mount");
    const hip = pivot(m, new THREE.Vector3(hc.x, 0, hc.z));
    const shL = pivot(hip, at("servo hub001")), shR = pivot(hip, at("servo hub002"));
    const elL = pivot(shL, at("servo hub")), elR = pivot(shR, at("servo hub003"));
    const wheels = [];
    let r = 32;
    for (const o of meshes) {
      const n = key(o), par = o.userData.parent || "";
      if (/^(arm2|arm003|servo hub)$/.test(n)) elL.attach(o);
      else if (/^(arm002|arm004|servo hub003)$/.test(n)) elR.attach(o);
      else if (/^(arm1|servo hub001)$/.test(n) || par === "TOWER PRO MG-995, ANALOG SERVO.STEP.STEP") shL.attach(o);
      else if (/^(arm001|servo hub002)$/.test(n) || par === "TOWER PRO MG-995, ANALOG SERVO.STEP.STEP002") shR.attach(o);
      else if (/^Real Wheel/.test(n)) {
        const b = bx(n); r = (b.max.y - b.min.y) / 2;
        const w = pivot(m, b.getCenter(new THREE.Vector3())); w.attach(o); wheels.push(w);
      } else if (new THREE.Box3().setFromObject(o).min.y > all.min.y + 245) hip.attach(o);
    }
    const rear = hc.z - all.min.z;                    // hip axis to the back of the rear wheels
    m.position.set(-hc.x, -all.min.y, -hc.z + rear);
    const tilt = new THREE.Group(); tilt.position.z = -rear; tilt.add(m);
    const root = new THREE.Group(); root.add(tilt); scene.add(root);
    return { root, tilt, hip, shL, shR, elL, elR, wheels, r };
  }
  const A = makeBot("samurai", 0x16171a), B = makeBot("cyberboy", 0x23549e);   // plate colours: Samurai black, Cyber Boy blue (from its stickers)
  A.root.rotation.y = Math.PI / 2;                    // A on the left, facing right
  B.root.rotation.y = -Math.PI / 2;

  function pose(bot, s, side) {
    bot.root.position.x = side * (START - s.adv);
    bot.hip.rotation.y = s.hip * D;
    bot.shL.rotation.y = s.sL * D;
    bot.shR.rotation.y = -s.sR * D;
    bot.elL.rotation.x = -s.eL * D;
    bot.elR.rotation.x = -s.eR * D;
    bot.tilt.rotation.x = -s.tilt * D;
    for (const w of bot.wheels) w.rotation.x = s.adv / bot.r;
  }

  // ---- camera and framing: words on the left (desktop) or on top (phone), arena beside or below them
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 20000);
  const look = new THREE.Vector3();
  let wide = true, zoom = 1;
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    wide = camera.aspect > 1.05;
    zoom = wide ? 1 : Math.min(2.5, 1.25 / camera.aspect);
    scene.fog.near = 5200 * zoom; scene.fog.far = 11000 * zoom;
    if (wide) camera.setViewOffset(w, h, -0.17 * w, 0, w, h);
    else camera.setViewOffset(w, h, 0, -0.17 * h, w, h);
    camera.updateProjectionMatrix();
  }

  let lastMove = "";
  function draw(p) {
    const { a, b, t } = lerpKeys(CAM, p);
    const az = (a[1] + (b[1] - a[1]) * t) * D, el = (a[2] + (b[2] - a[2]) * t) * D;
    const dist = (a[3] + (b[3] - a[3]) * t) * zoom, ty = a[4] + (b[4] - a[4]) * t;
    look.set(0, ty, 0);
    camera.position.set(dist * Math.cos(el) * Math.sin(az), ty + dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(look);
    ring.rotation.y = -45 * D * ease(clamp(p / TURN));

    const f = clamp((p - TURN) / (0.96 - TURN));
    const k = lerpKeys(KEYS, f);
    pose(A, mixPose(k.a[1], k.b[1], k.t), -1);
    pose(B, mixPose(k.a[2], k.b[2], k.t), 1);

    const mv = p > TURN ? (MOVES.find((x) => f >= x[0] && f < x[1]) || [0, 0, ""])[2] : "";
    if (mv !== lastMove) { lastMove = mv; if (mv) moveEl.textContent = mv; moveBox.classList.toggle("on", !!mv); }
    sec.classList.toggle("past", p > 0.015);
    renderer.render(scene, camera);
  }

  // ---- scroll drives the scene; render only while visible and while catching up
  const progress = () => {
    const r = sec.getBoundingClientRect(), span = r.height - window.innerHeight;
    return span > 0 ? clamp(-r.top / span) : 0;
  };
  let cur = -1, visible = true, queued = false;
  function frame() {
    queued = false;
    const target = progress();
    cur = cur < 0 ? target : cur + (target - cur) * 0.14;
    if (Math.abs(target - cur) < 0.0005) cur = target;
    draw(cur);
    if (cur !== target) kick();
  }
  function kick() { if (!queued && visible) { queued = true; requestAnimationFrame(frame); } }

  // Models ready: fade the still picture into the live scene at the current scroll point (the section is already tall).
  sec.classList.add("is3d");
  size();
  draw(progress());
  document.documentElement.dataset.fight = "ready";

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", () => { size(); cur = -1; kick(); });
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; kick(); }).observe(sec);
}
