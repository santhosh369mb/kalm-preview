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
  setInterval(function () {
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
  new IntersectionObserver(function (e) {
    footVisible = e[0].isIntersecting;
    if (footVisible) playFoot(); else footVid.pause();
  }, { threshold: 0.3 }).observe(footVid);
})();
