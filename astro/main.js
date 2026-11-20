// KAL-M website - base interactions v1
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Nav: solid background after scrolling, mobile menu toggle
  var nav = document.getElementById("nav");
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  function onNavScroll() { nav.classList.toggle("scrolled", window.scrollY > 40); }
  window.addEventListener("scroll", onNavScroll, { passive: true });
  onNavScroll();
  toggle.addEventListener("click", function () {
    var open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links.addEventListener("click", function (e) {
    if (e.target.tagName === "A") { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
  });

  // Stats: count up when visible
  function fmt(n, comma) { return comma ? n.toLocaleString("en-IN") : String(n); }
  var counters = document.querySelectorAll("[data-count]");
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target, end = +el.dataset.count, comma = el.dataset.fmt === "1";
      countIO.unobserve(el);
      if (reduce) { el.textContent = fmt(end, comma); return; }
      var t0 = performance.now(), dur = 1400;
      (function step(t) {
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(end * e), comma);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }, { threshold: 0.4 });
  counters.forEach(function (c) { countIO.observe(c); });

  // Reveal on scroll
  var revealEls = document.querySelectorAll(".section .h2, .lead-xl, .card, .vcard, .timeline li, .app, .why > div, .founder, .config-stage, .map");
  var revIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); revIO.unobserve(en.target); } });
  }, { threshold: 0.12 });
  revealEls.forEach(function (el) { el.classList.add("reveal"); revIO.observe(el); });

  // Configurator: arm lowers the chosen module onto the base
  var svg = document.getElementById("configSvg");
  var claw = document.getElementById("armClaw");
  var cable = document.getElementById("armCable");
  var role = document.getElementById("specRole");
  var btns = document.querySelectorAll(".mod-btn");
  var MODS = {
    base:  { top: null, role: "Common base" },
    surv:  { top: 183, role: "Surveillance / ISR" },
    at:    { top: 186, role: "Anti-tank" },
    cargo: { top: 190, role: "Cargo / logistics" }
  };
  var CLAW_BOTTOM = 40, CABLE_LEN = 6;
  function setArm(dy) {
    claw.style.transform = "translateY(" + dy + "px)";
    cable.style.transform = "scaleY(" + (CABLE_LEN + dy) / CABLE_LEN + ")";
  }
  function selectMod(key, btn) {
    btns.forEach(function (b) { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", b === btn); });
    role.textContent = MODS[key].role;
    svg.classList.remove("moving");
    svg.querySelectorAll(".module").forEach(function (m) { m.classList.remove("on"); m.style.transform = ""; });
    setArm(0);
    if (key === "base") return;
    var mod = document.getElementById("mod-" + key);
    var dy = MODS[key].top - CLAW_BOTTOM;
    if (reduce) { mod.classList.add("on"); return; }
    btns.forEach(function (b) { b.disabled = true; });
    mod.style.transform = "translateY(" + -dy + "px)";
    mod.classList.add("on");
    void mod.getBoundingClientRect(); // commit start position before animating
    svg.classList.add("moving");
    mod.style.transform = "translateY(0)";
    setArm(dy);
    setTimeout(function () { setArm(0); }, 1000);
    setTimeout(function () { btns.forEach(function (b) { b.disabled = false; }); }, 1900);
  }
  btns.forEach(function (b) { b.addEventListener("click", function () { selectMod(b.dataset.mod, b); }); });

  // Terrain journey: horizontal ground scroll pinned to vertical scroll
  var terrain = document.getElementById("terrain");
  var track = document.getElementById("terrainTrack");
  var tName = document.getElementById("terrainName");
  var tNote = document.getElementById("terrainNote");
  var steps = document.querySelectorAll("#terrainSteps span");
  var STAGES = [
    ["Desert sand", "Thar desert, Rajasthan. Soft sand that stops wheels."],
    ["Gravel & pebbles", "Loose rock that shakes, slips and breaks lesser platforms."],
    ["Grassland", "Uneven ground hiding ruts and holes under the grass."],
    ["Riverbeds", "Wet stones, mud and shallow water crossings."],
    ["Snow", "Packed snow and ice where traction disappears."],
    ["12,000 ft", "6°C at altitude. 150 kg carried up a 30° climb."]
  ];
  var N = STAGES.length;
  var cur = -1;
  function onTerrain() {
    if (!terrain) return; // section only on the Defence page
    var r = terrain.getBoundingClientRect();
    var total = terrain.offsetHeight - window.innerHeight;
    var p = Math.min(1, Math.max(0, -r.top / total));
    track.style.transform = "translateX(" + (-p * (N - 1) * window.innerWidth) + "px)";
    var i = Math.min(N - 1, Math.floor(p * N));
    if (i !== cur) {
      cur = i;
      tName.textContent = STAGES[i][0];
      tNote.textContent = STAGES[i][1];
      steps.forEach(function (s, k) { s.classList.toggle("on", k === i); });
    }
  }
  window.addEventListener("scroll", onTerrain, { passive: true });
  window.addEventListener("resize", onTerrain);
  onTerrain();

  // Closer look: real Bravo 3D model (model.js) rotates with scroll; parts light up per feature
  var closer = document.getElementById("closer");
  var feats = document.querySelectorAll("#feats li");
  var featCur = -1;
  window.kalmCloser = { p: 0, part: null };
  function onCloser() {
    if (!closer) return; // section only on the Defence page
    var r = closer.getBoundingClientRect();
    var total = closer.offsetHeight - window.innerHeight;
    var p = Math.min(1, Math.max(0, -r.top / total));
    var i = Math.min(feats.length - 1, Math.floor(p * feats.length));
    window.kalmCloser.p = p;
    if (i !== featCur) {
      featCur = i;
      feats.forEach(function (f, k) { f.classList.toggle("on", k === i); });
      window.kalmCloser.part = feats[i].dataset.part;
    }
  }
  window.addEventListener("scroll", onCloser, { passive: true });
  onCloser();

  // Live status panel (illustrative)
  var clock = document.getElementById("stClock");
  var batt = document.getElementById("stBatt");
  var t0 = Date.now();
  if (clock) setInterval(function () {
    var s = Math.floor((Date.now() - t0) / 1000);
    var hh = String(Math.floor(s / 3600)).padStart(2, "0");
    var mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
    var ss = String(s % 60).padStart(2, "0");
    clock.textContent = hh + ":" + mm + ":" + ss;
    batt.textContent = Math.max(20, 96 - Math.floor(s / 45)) + "%";
  }, 1000);
  // ===== v2 =====
  // Mission builder: variant + module + terrain -> summary + pre-filled email
  var vChips = document.querySelectorAll("#variantChips .chip");
  var tChips = document.querySelectorAll("#terrainChips .chip");
  function activeIn(list) { var a = null; list.forEach(function (c) { if (c.classList.contains("active")) a = c; }); return a; }
  function pick(list, el) { list.forEach(function (c) { c.classList.toggle("active", c === el); }); updateBuild(); }
  function updateBuild() {
    var v = activeIn(vChips), t = activeIn(tChips);
    if (!v || !t) return; // configurator only on the Defence page
    var modBtn = document.querySelector(".mod-btn.active");
    var mod = modBtn ? modBtn.textContent : "Base platform";
    document.getElementById("specBuild").textContent = v.dataset.v + " · " + mod;
    document.getElementById("specPayload").textContent = v.dataset.p;
    document.getElementById("specTerrain").textContent = t.textContent;

  }
  vChips.forEach(function (c) { c.addEventListener("click", function () { pick(vChips, c); }); });
  tChips.forEach(function (c) { c.addEventListener("click", function () { pick(tChips, c); }); });
  btns.forEach(function (b) { b.addEventListener("click", function () { setTimeout(updateBuild, 0); }); });
  updateBuild();

  // India map: link region list and pins
  var regionEls = document.querySelectorAll("#india [data-r]");
  function hi(r) { regionEls.forEach(function (el) { el.classList.toggle("on", el.dataset.r === r); }); }
  regionEls.forEach(function (el) {
    el.addEventListener("mouseenter", function () { hi(el.dataset.r); });
    el.addEventListener("mouseleave", function () { hi(null); });
  });

  // Investor Briefing overlay
  var brief = document.getElementById("brief");
  var briefClose = document.getElementById("briefClose");
  var lastFocus = null;
  function openBrief() {
    lastFocus = document.activeElement;
    brief.hidden = false;
    document.body.classList.add("brief-open");
    links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false");
    briefClose.focus();
  }
  function closeBrief() {
    brief.hidden = true;
    document.body.classList.remove("brief-open");
    if (location.hash === "#briefing") history.replaceState(null, "", location.pathname);
    if (lastFocus) lastFocus.focus();
  }
  document.querySelectorAll(".js-brief").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); openBrief(); history.replaceState(null, "", "#briefing"); });
  });
  briefClose.addEventListener("click", closeBrief);
  brief.addEventListener("click", function (e) { if (e.target === brief) closeBrief(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !brief.hidden) closeBrief(); });
  if (location.hash === "#briefing") openBrief();

  // Fleet: Bravo finish swatches
  var bravoImg = document.getElementById("bravoImg");
  var swName = document.getElementById("swName");
  var sws = document.querySelectorAll(".sw");
  sws.forEach(function (sw) {
    sw.addEventListener("click", function () {
      sws.forEach(function (o) { o.classList.toggle("active", o === sw); });
      bravoImg.src = sw.dataset.img;
      swName.textContent = sw.getAttribute("aria-label").toUpperCase();
    });
  });

  // Field footage: thumbnails switch the big screen; play only while visible
  var footVid = document.getElementById("footVid");
  var footTag = document.getElementById("footTag");
  var thumbs = document.querySelectorAll(".thumb");
  var footVisible = false;
  function playFoot() { if (footVisible && !reduce) { var p = footVid.play(); if (p && p.catch) p.catch(function () {}); } }
  function swapFoot(t) {
    footVid.poster = t.dataset.poster; footVid.src = t.dataset.src;
    footTag.textContent = "LIVE TRIAL · " + t.dataset.name.toUpperCase();
    playFoot();
  }
  thumbs.forEach(function (t) {
    t.addEventListener("click", function () {
      if (t.classList.contains("on") || window.kalmArmBusy) return;
      thumbs.forEach(function (o) { o.classList.toggle("on", o === t); o.setAttribute("aria-selected", o === t); });
      // with the 3D arm loaded, the arm carries the clip to the screen and swaps it on arrival
      if (window.kalmArmPick) window.kalmArmPick(t, function () { swapFoot(t); });
      else swapFoot(t);
    });
  });
  if (footVid) new IntersectionObserver(function (e) {
    footVisible = e[0].isIntersecting;
    if (footVisible) playFoot(); else footVid.pause();
  }, { threshold: 0.3 }).observe(footVid);
})();

// BoxingBots ad clip: phone or desktop file, loads and plays only while visible, pause button.
// Reduced-motion visitors start on the still frame and can press Play.
(function () {
  "use strict";
  var vid = document.getElementById("eduVid");
  var btn = document.getElementById("eduVidBtn");
  if (!vid || !btn) return;
  var phone = window.matchMedia("(max-width: 760px)").matches;
  var paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var visible = false;
  var sync = function () {
    if (visible && !paused) {
      if (!vid.getAttribute("src")) vid.src = phone ? vid.dataset.srcPhone : vid.dataset.src;
      var p = vid.play(); if (p && p.catch) p.catch(function () {});
    }
    else vid.pause();
    btn.textContent = paused ? "Play video" : "Pause video";
  };
  btn.hidden = false;
  btn.addEventListener("click", function () { paused = !paused; sync(); });
  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(vid);
})();

// Education pages: silent clips (.vbox) load and play only while on screen, each with a Pause/Play button.
// Reduced-motion visitors start on the still frame and can press Play.
(function () {
  "use strict";
  var boxes = document.querySelectorAll(".vbox");
  if (!boxes.length || !("IntersectionObserver" in window)) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  boxes.forEach(function (box) {
    var v = box.querySelector("video");
    var btn = box.querySelector(".vid-toggle");
    if (!v) return;
    var paused = reduce, visible = false;
    var sync = function () {
      if (visible && !paused) {
        if (!v.getAttribute("src")) v.src = v.dataset.src;
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else v.pause();
      if (btn) btn.textContent = paused ? "Play video" : "Pause video";
    };
    if (btn) { btn.hidden = false; btn.addEventListener("click", function () { paused = !paused; sync(); }); }
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(v);
  });
})();

// BoxingBots page, Inside the kit: pointing at a drawing highlights its list line, and the other way round.
document.querySelectorAll('.kitparts').forEach((root) => {
  const all = root.querySelectorAll('[data-p]');
  const set = (p) => all.forEach((el) => el.classList.toggle('on', el.dataset.p === p));
  all.forEach((el) => { el.addEventListener('pointerenter', () => set(el.dataset.p)); el.addEventListener('pointerleave', () => set('')); });
});

// BoxingBots page, Inside the kit: each outline draws itself, line by line, when its tile comes into view.
// While drawing, the stroke works in the drawing's own units (dash = path length, width = 1 screen px);
// afterwards the inline styles are removed and the normal 1 px non-scaling line stays. Reduced motion: no animation.
(() => {
  const tiles = [...document.querySelectorAll('.kitparts .kp-tile')];
  if (!tiles.length || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const DUR = 1.4;
  const hide = (t) => {
    const svg = t.querySelector('svg'), m = svg && svg.getScreenCTM(), k = m ? Math.hypot(m.a, m.b) : 0;
    if (!k) return false;
    t.querySelectorAll('path').forEach((p) => {
      const len = p.getTotalLength(); p.dataset.len = len;
      Object.assign(p.style, { vectorEffect: 'none', strokeWidth: String(1.1 / k), strokeDasharray: `${len} ${len}`, strokeDashoffset: String(len), transition: 'none' });
    });
    return true;
  };
  const draw = (t, wait) => {
    const paths = [...t.querySelectorAll('path')].sort((x, y) => y.dataset.len - x.dataset.len);   // outer edge first, then the holes
    paths.forEach((p, j) => {
      p.getBoundingClientRect();                        // apply the hidden state before the transition starts
      p.style.transition = `stroke-dashoffset ${DUR}s cubic-bezier(.45,0,.2,1) ${wait + Math.min(j * 0.02, 0.6)}s`;
      p.style.strokeDashoffset = '0';
    });
    setTimeout(() => paths.forEach((p) => p.removeAttribute('style')), (wait + 0.6 + DUR) * 1000 + 100);
  };
  const ready = tiles.filter(hide);
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); draw(e.target, n++ * 0.09); } });
  }, { threshold: 0.35 });
  ready.forEach((t) => io.observe(t));
})();

// Industries page: the Robo guide (KAL-M UGV, scanning LiDAR) drives an irregular route over a drawn map as you scroll.
// The map (contour hills, river, roads, building blocks, a farm patch) is drawn from a fixed seed, so it is the same every visit.
// Stops light up as the guide reaches them; cards sit beside their stop on the side with more room.
(() => {
  const map = document.getElementById('jrMap');
  if (!map) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = map.querySelector('.jr-route'), terrain = map.querySelector('.jr-terrain');
  const ahead = map.querySelector('.jr-ahead'), done = map.querySelector('.jr-done');
  const guide = map.querySelector('.jr-guide'), stops = [...map.querySelectorAll('.jr-stop')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) guide.querySelector('svg').pauseAnimations();
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const f1 = (v) => v.toFixed(1);
  const smooth = (pts, closed) => {                     // Catmull-Rom through the points, as cubic Bezier
    const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
    let d = `M ${f1(P[1][0])} ${f1(P[1][1])}`;
    for (let i = 1; i < P.length - 2; i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1], e = P[i + 2];
      d += ` C ${f1(b[0] + (c[0] - a[0]) / 6)} ${f1(b[1] + (c[1] - a[1]) / 6)}, ${f1(c[0] - (e[0] - b[0]) / 6)} ${f1(c[1] - (e[1] - b[1]) / 6)}, ${f1(c[0])} ${f1(c[1])}`;
    }
    return closed ? d + ' Z' : d;
  };
  const el = (tag, attrs, parent = terrain) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e); return e;
  };
  function drawTerrain(W, H) {
    terrain.replaceChildren();
    const r = rng(7);
    for (let h = 0, n = Math.round(H / 320) + 4; h < n; h++) {          // contour hills
      const cx = W * (0.04 + r() * 0.92), cy = H * r(), R = 90 + r() * 170, p1 = r() * 6, p2 = r() * 6, rings = 3 + Math.floor(r() * 4);
      for (let k = 1; k <= rings; k++) {
        const pts = [];
        for (let i = 0; i < 26; i++) {
          const t = (i / 26) * Math.PI * 2, rr = R * (k / rings) * (1 + 0.2 * Math.sin(3 * t + p1) + 0.12 * Math.sin(5 * t + p2));
          pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * 0.8]);
        }
        el('path', { class: 'ct', d: smooth(pts, true) });
      }
    }
    const wander = (x0, y0, x1, y1, n, amp) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, mid = i && i < n;
        pts.push([x0 + (x1 - x0) * t + (mid ? (r() - 0.5) * amp : 0), y0 + (y1 - y0) * t + (mid ? (r() - 0.5) * amp * 0.5 : 0)]);
      }
      return pts;
    };
    const river = smooth(wander(W * 1.05, H * 0.08, -W * 0.05, H * 0.62, 7, W * 0.35));
    el('path', { class: 'river', d: river, 'stroke-width': Math.max(14, W * 0.022) });
    el('path', { class: 'river2', d: river });
    for (const y of [0.3, 0.83]) {                                        // roads
      const road = smooth(wander(-W * 0.05, H * y, W * 1.05, H * (y + (r() - 0.5) * 0.1), 6, H * 0.08));
      el('path', { class: 'road', d: road, 'stroke-width': Math.max(10, W * 0.014) });
      el('path', { class: 'road2', d: road });
    }
    for (const [bx, by] of [[0.82, 0.22], [0.16, 0.7]]) {                  // building blocks
      for (let i = 0; i < 9; i++) {
        el('rect', { class: 'bld', x: W * bx + (r() - 0.5) * W * 0.16, y: H * by + (r() - 0.5) * H * 0.07, width: 18 + r() * 42, height: 14 + r() * 34, rx: 2 });
      }
    }
    const fx = W * 0.78, fy = H * 0.52, fw = Math.min(260, W * 0.3), fh = 150;   // farm patch: crop rows
    const farm = el('g', { transform: `rotate(-12 ${fx} ${fy})` });
    for (let y = -fh / 2; y <= fh / 2; y += 11) el('line', { class: 'farm', x1: fx - fw / 2, x2: fx + fw / 2, y1: fy + y, y2: fy + y }, farm);
  }
  let L = 0, fr = [], cur = -1, ang = null, raf = 0, size = 1;
  function layout() {
    const W = map.clientWidth, phone = W < 700, row = phone ? 380 : 470, n = stops.length, H = row * (n + 0.5);
    map.style.height = H + 'px'; map.classList.add('is-live');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    drawTerrain(W, H);
    size = phone ? 0.62 : 1;                             // smaller rover on phones (scaled in place)
    const xs = phone ? [0.15, 0.2, 0.11, 0.19, 0.13] : [0.37, 0.6, 0.43, 0.64, 0.47];   // irregular, not a zig-zag pattern
    const ys = [0.72, 1.72, 2.82, 3.68, 4.62];
    const pts = stops.map((_, i) => [W * xs[i % xs.length], row * ys[i % ys.length]]);
    const r = rng(11), via = [[W * (phone ? 0.16 : 0.52), -10]];
    pts.forEach((p, i) => {                                               // a bend between stops, never the same twice
      const q = i ? pts[i - 1] : via[0];
      via.push([(q[0] + p[0]) / 2 + (r() - 0.5) * W * (phone ? 0.08 : 0.22), (q[1] + p[1]) / 2 + (r() - 0.5) * row * 0.2], p);
    });
    via.push([W * (phone ? 0.15 : 0.5), H + 10]);
    const d = smooth(via);
    ahead.setAttribute('d', d); done.setAttribute('d', d);
    L = done.getTotalLength(); done.style.strokeDasharray = `${L} ${L}`;
    fr = pts.map(([x, y]) => {
      let best = 0, bd = Infinity;
      for (let k = 0; k <= 800; k++) {
        const q = done.getPointAtLength(L * k / 800), dd = (q.x - x) ** 2 + (q.y - y) ** 2;
        if (dd < bd) { bd = dd; best = k / 800; }
      }
      return best;
    });
    stops.forEach((li, i) => {
      const [x, y] = pts[i], card = li.querySelector('.jr-card');
      li.style.top = y + 'px'; li.querySelector('.jr-dot').style.left = x + 'px';
      const right = phone || x < W / 2;
      card.style.left = right ? `${phone ? W * 0.33 : x + 44}px` : `${x - 44 - card.offsetWidth}px`;
    });
    cur = -1; ang = null; tick();
  }
  const target = () => { const b = map.getBoundingClientRect(); return Math.min(1, Math.max(0, (innerHeight * 0.55 - b.top) / b.height)); };
  function place(p) {
    const l = L * p, a = done.getPointAtLength(Math.max(0, l - 6)), b = done.getPointAtLength(Math.min(L, l + 6)), q = done.getPointAtLength(l);
    const t = Math.atan2(b.y - a.y, b.x - a.x);
    if (ang === null || reduce) ang = t;
    else { const dt = Math.atan2(Math.sin(t - ang), Math.cos(t - ang)); ang += dt * 0.25; }   // turn smoothly, no wiggle
    guide.style.transform = `translate(${q.x}px, ${q.y}px) rotate(${ang}rad) scale(${size})`;
    done.style.strokeDashoffset = String(L - l);
    stops.forEach((li, i) => li.classList.toggle('on', p >= fr[i] - 0.002));
    return t;
  }
  function tick() {
    raf = 0; const tg = target();
    cur = cur < 0 || reduce ? tg : cur + (tg - cur) * 0.1;
    if (Math.abs(tg - cur) < 0.0004) cur = tg;
    const t = place(cur);
    const turning = Math.abs(Math.atan2(Math.sin(t - ang), Math.cos(t - ang))) > 0.01;
    if (cur !== tg || turning) raf = requestAnimationFrame(tick);
  }
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
  layout();
})();
