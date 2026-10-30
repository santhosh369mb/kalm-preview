// KAL-M website - real Bravo 3D model in the "Closer look" section.
// Loads three.js + the model only when the section is near the viewport.
const scene3d = document.getElementById("scene3d");
const loadMsg = document.getElementById("sceneLoad");

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (e) { return false; }
}

const io = new IntersectionObserver((entries) => {
  if (!entries.some((e) => e.isIntersecting)) return;
  io.disconnect();
  if (webglOK()) start().catch(fail); else fail();
}, { rootMargin: "800px 0px" });
io.observe(scene3d);

function fail(err) {
  if (err) console.warn("3D model unavailable:", err);
  scene3d.classList.add("no3d");
  loadMsg.remove();
}

async function start() {
  const THREE = await import("./assets/vendor/three/three.module.min.js");
  const { GLTFLoader } = await import("./assets/vendor/three/GLTFLoader.js");
  const { DRACOLoader } = await import("./assets/vendor/three/DRACOLoader.js");
  const { RoomEnvironment } = await import("./assets/vendor/three/RoomEnvironment.js");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  scene3d.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8a74d6, 1.2); rim.position.set(-4, 2, -3); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);

  const draco = new DRACOLoader();
  draco.setDecoderPath("./assets/vendor/three/");
  draco.setDecoderConfig({ type: "wasm" });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync("./assets/models/bravo-v3.glb");
  const model = gltf.scene;

  // centre and size the model
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(centre);
  const pivot = new THREE.Group();
  pivot.add(model);
  const s = 1 / Math.max(size.x, size.y, size.z);
  pivot.scale.setScalar(s);
  scene.add(pivot);
  camera.position.set(0, 0.55, 2.15);
  camera.lookAt(0, -0.03, 0);

  // soft ground shadow
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"); const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, "rgba(0,0,0,.55)"); grd.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.95), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -(size.y * s) / 2 - 0.002; scene.add(shadow);

  // group meshes by feature for highlighting
  const groups = { tracks: [], suspension: [], drive: [], mount: [], body: [] };
  const highlight = new THREE.Color(0x8a74d6);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    const name = (o.name + " " + (o.parent ? o.parent.name : "")).toLowerCase();
    const mat = (o.material.name || "").toLowerCase();
    let part = null;
    if (/suspension/.test(name)) part = "suspension";
    else if (/motor|sprocket/.test(name)) part = "drive";
    else if (mat.includes("rubber") || mat.includes("dark")) part = "tracks";
    else if (mat.includes("carbon")) part = "mount";
    else if (mat.includes("olive")) part = "body";
    if (part) groups[part].push(o);
  });

  let active = null;
  function setPart(part) {
    if (part === active) return;
    active = part;
    for (const [k, list] of Object.entries(groups)) {
      for (const m of list) {
        m.material.emissive = k === part ? highlight : new THREE.Color(0x000000);
        m.material.emissiveIntensity = k === part ? 0.55 : 0;
      }
    }
  }

  function resize() {
    const w = scene3d.clientWidth, h = scene3d.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 600 ? 40 : 30;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(scene3d);
  resize();

  // render only while the section is on screen
  let visible = true;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(scene3d);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // redraw only when something changed (rotation still easing, part changed, or resized)
  let rot = -0.7, dirty = true;
  new ResizeObserver(() => { dirty = true; }).observe(scene3d);
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const st = window.kalmCloser || { p: 0, part: null };
    const target = -0.7 + st.p * Math.PI * 1.7;
    const diff = target - rot;
    if (Math.abs(diff) > 0.0005) { rot += reduce ? diff : diff * 0.08; dirty = true; }
    if (st.part !== active) { setPart(st.part); dirty = true; }
    if (!dirty) return;
    pivot.rotation.y = rot;
    renderer.render(scene, camera);
    dirty = false;
  });

  scene3d.classList.add("has3d");
  loadMsg.remove();
}
