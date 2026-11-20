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


// Industries page: Find your job. Pick an industry tab, then a job; the side panel shows that job on the platform.
// Without JS every industry list shows in full (CSS), so nothing is hidden from readers or search.
(() => {
  const root = document.getElementById('indFind');
  if (!root) return;
  root.classList.add('is-live');
  const tabs = [...root.querySelectorAll('.ind-tab')], panels = [...root.querySelectorAll('.ind-panel')], jobs = [...root.querySelectorAll('.ind-job')];
  const d = (s) => root.querySelector(s);
  const mail = d('.ind-d-ask').getAttribute('href').split('?')[0];
  const show = (btn) => {
    jobs.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    d('.ind-d-ind').textContent = btn.dataset.indName;
    d('.ind-d-job').textContent = btn.dataset.job;
    d('.ind-d-what').textContent = btn.dataset.what;
    d('.ind-d-att').textContent = `${btn.dataset.job}, on the common mount`;
    d('.ind-d-ask').setAttribute('href', `${mail}?subject=${encodeURIComponent('Industries: ' + btn.dataset.job)}`);
  };
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    panels.forEach((p) => { p.hidden = p.dataset.ind !== t.dataset.ind; });
    const first = root.querySelector(`.ind-panel[data-ind="${t.dataset.ind}"] .ind-job`);
    if (first) show(first);
  }));
  jobs.forEach((b) => b.addEventListener('click', () => show(b)));
})();
