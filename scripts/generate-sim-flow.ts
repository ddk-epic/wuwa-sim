// Generates docs/sim-flow.html — an interactive subway map of the simulation flow:
// how an authored Timeline Entry is processed through the engine, station by
// station, with state stores and click-to-focus read/write arrows. Zero dependencies.
// Run: pnpm gen:sim-flow
// The content below is hand-authored and changes at ADR cadence — update it when
// an ADR reshapes the pipeline. Sources: simulation.ts (processAuthoredEntry /
// processEntry / processHit), docs/engine-overview.md, docs/buff-engine.md,
// ADR-0028, ADR-0038.
import { writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")

// ---------- authored content ----------

const PHASES = [
  "resource",
  "stat",
  "emitHit",
  "coordHit",
  "consume",
  "removeBuffs",
]

const STORES = [
  {
    id: "schedule",
    name: "Schedule pool",
    holds:
      "pending Work keyed by landing frame: trailing bundles, synthetics, footing commits. Arrival classes: residue (owned, droppable/paddable), ignore (always lands), reset. Tombstones realize drops.",
  },
  {
    id: "instances",
    name: "Instance Store",
    holds:
      "active buff instances (stacks, endTime), pendingNextOnField queue, per-buff cooldowns",
  },
  {
    id: "resources",
    name: "Resource Ledger",
    holds: "energy / concerto / forte / resonance per character",
  },
  {
    id: "footing",
    name: "Footing + On-Field",
    holds:
      "ground/air footing per character; current on-field character (swap inference)",
  },
  {
    id: "clock",
    name: "Engine clock",
    holds:
      "monotonic frame; tickToFrame sweeps expiries — never moves backward, never past pending work",
  },
  {
    id: "log",
    name: "Simulation Log",
    holds:
      "the output: Action / Hit / Sustain / Buff-lifecycle rows, in resolution order",
  },
]

type Rw = { store: string; what: string }
type Station = {
  id: string
  title: string
  module: string
  desc: string
  reads: Rw[]
  writes: Rw[]
  branches: string[]
  phases?: boolean
}

const STATIONS: Station[] = [
  {
    id: "entry",
    title: "Timeline Entry",
    module: "authored input",
    desc: "The authored unit: characterId + stageId lineage + variantKind (none / cancel / instantCancel / swap). The whole journey below happens once per entry, in authoring order.",
    reads: [],
    writes: [],
    branches: [],
  },
  {
    id: "resolve",
    title: "Resolve Stage",
    module: "stage.ts",
    desc: "findStageByEntry + resolveStageExecution turn the entry into a ResolvedStage: skill name/type/category, element, the DamageEntry hit list, and stageDuration. The Stage Variant applies here — cancel/instantCancel truncate at actionFrame (independent hits survive, ADR-0008), swap swaps out early, react/floor delays accrue.",
    reads: [],
    writes: [],
    branches: [
      "cancel/instantCancel: hits after the truncation point are dropped unless marked independent",
    ],
  },
  {
    id: "arrival",
    title: "Arrival collision & pads",
    module:
      "schedule.resolveArrival + computePriorGatePad / computeFall / computeSwapBack",
    desc: "The entry collides with its own character's in-flight residue (trailing hits, parked footing). A cancel-capable re-entry tombstones (drops) that residue; otherwise the entry pads to land after it. Then the wait stack: swap-back, prior-stage gate (requiresPriorStageId + minDelay), and fall frames if entering a ground stage while airborne.",
    reads: [
      { store: "schedule", what: "same-character residue members" },
      { store: "footing", what: "carried footing → fall frames" },
    ],
    writes: [
      { store: "schedule", what: "tombstones dropped residue (cancelResidue)" },
    ],
    branches: [
      "drop (cancel-capable re-entry)",
      "pad (non-cancellable: wait out the residue)",
      "reset (footing window-end)",
    ],
  },
  {
    id: "predrain",
    title: "Pre-drain ≤ effectiveStart",
    module: "advanceTo → schedule.drainUpTo",
    desc: "Before the engine clock may advance to the entry's effectiveStart, every pending member landing at or before it resolves first, in frame order — so background hits, synthetics, and footing commits interleave ahead of this entry. Then the clock ticks forward and expiries fall out.",
    reads: [{ store: "schedule", what: "drains members ≤ effectiveStart" }],
    writes: [
      { store: "clock", what: "advances monotonically" },
      { store: "instances", what: "expires instances with endTime ≤ frame" },
      { store: "log", what: "buffExpired + Negative-Status tick rows" },
    ],
    branches: [
      "each drained member re-enters at its own station: trailing/synthetic → Hit resolution, footing → Footing commit",
    ],
  },
  {
    id: "skillcast",
    title: "skillCast dispatch",
    module: "engine.onEvent · buff-engine.ts",
    desc: "The cast event runs the full dispatch: implicit resource accrual first (energy from hits, Liberation drain), then candidate selection (trigger match, cooldown stamp, early condition eval for emitHit-only / nextOnField buffs), then the six-phase pipeline over all candidates. Offset-0 synthetics flush in place; later ones enqueue.",
    reads: [
      { store: "instances", what: "triggerable defs, cooldowns, conditions" },
      { store: "resources", what: "condition + Value Expr inputs" },
      { store: "footing", what: "on-field conditions" },
    ],
    writes: [
      { store: "resources", what: "resource effects + implicit accrual" },
      {
        store: "instances",
        what: "applyBuff / stacks / consume / pendingNextOnField",
      },
      { store: "schedule", what: "DeferredEmits enqueue (ignore class)" },
      { store: "log", what: "buffApplied / buffConsumed rows" },
    ],
    branches: ["resourceCrossed events recurse through this same dispatch"],
    phases: true,
  },
  {
    id: "action",
    title: "Action event + footing",
    module: "buildActionEvent · engine.footing",
    desc: "The action row is logged with the post-cast energy/concerto snapshot and the full delayBreakdown (react / floor / pad / fall / swapBack / priorGate). Then the stage's footing applies: an Intro establishes its own footing; any other stage merges onto the carried one.",
    reads: [{ store: "resources", what: "energy/concerto snapshot" }],
    writes: [
      { store: "log", what: "Action row" },
      { store: "footing", what: "enterIntro / applyStageFooting" },
    ],
    branches: [],
  },
  {
    id: "partition",
    title: "Partition hits",
    module: "partitionStage · trailing-window.ts",
    desc: "Every stage splits its hits by actionFrame ≤ stageDuration: immediate ones resolve inline now; trailing ones are background damage that must interleave with later entries, so they enqueue onto the Schedule (ADR-0038). Swap stages also plan footing commits/resets.",
    reads: [],
    writes: [
      {
        store: "schedule",
        what: "trailing hits — swap: residue (owned), non-swap: ignore (uncollidable); footing commit: residue, reset: reset",
      },
    ],
    branches: [
      "immediate → Hit resolution now",
      "trailing → Schedule pool, resolved by a later drain",
    ],
  },
  {
    id: "hit",
    title: "Hit resolution",
    module:
      "resolveTrailingBundle → engine.resolveHit → compute-damage / compute-healing",
    desc: "Every hit converges here — immediate, trailing, or synthetic. At its hitFrame: drain the stream ≤ hitFrame, tick the clock, then snapshot the Stat Table (lazy condition eval per active instance, HitContext-scoped so stage/skill/label-scoped buffs fold in or drop out). The pure formula computes damage or healing from the snapshot. Then the hitLanded/healLanded event runs the same six-phase dispatch, accruing energy/concerto/forte and chaining triggers.",
    reads: [
      { store: "schedule", what: "pre-drains members ≤ hitFrame" },
      { store: "instances", what: "active instances → Stat Table snapshot" },
      { store: "resources", what: "conditions / Value Exprs" },
    ],
    writes: [
      { store: "clock", what: "advances to hitFrame" },
      { store: "resources", what: "energy / concerto / forte accrual" },
      { store: "instances", what: "dispatch: apply / consume / remove" },
      { store: "schedule", what: "new DeferredEmits enqueue" },
      {
        store: "log",
        what: "Hit/Sustain row with stats + activeBuffs snapshot",
      },
    ],
    branches: [
      "Heal → computeHealing + Sustain row",
      "Damage → computeDamage + Hit row",
      "emitHit/coordHit phases → synthetic hits loop back through this station",
    ],
    phases: true,
  },
  {
    id: "cursor",
    title: "Cursor advances",
    module: "simulation.ts",
    desc: "nextFrame = effectiveStart + stageDuration — the cursor (authoring time) moves on and the next entry begins. The engine clock is the second, monotonic clock: it only moves via advanceTo, and never past pending work. Keeping these two honest with each other is what the Schedule exists for.",
    reads: [],
    writes: [],
    branches: [
      "next Timeline Entry → back to the top",
      "last entry → End of timeline",
    ],
  },
  {
    id: "tail",
    title: "End of timeline",
    module: "runSimulation",
    desc: "drainSchedule(∞) resolves the stream's tail — trailing hits and synthetics that never collided (parked footing commits with no re-entry are dropped). A final tick advances to the latest live buff/status end so every expiry lands in the log. The Simulation Log is the output the UI renders.",
    reads: [{ store: "schedule", what: "drains everything left" }],
    writes: [
      { store: "clock", what: "final advance" },
      { store: "instances", what: "remaining expiries" },
      { store: "log", what: "trailing expiry + tick rows" },
    ],
    branches: [],
  },
]

const FLOWS = [
  { s: "entry", t: "resolve", kind: "spine" },
  { s: "resolve", t: "arrival", kind: "spine" },
  { s: "arrival", t: "predrain", kind: "spine" },
  { s: "predrain", t: "skillcast", kind: "spine" },
  { s: "skillcast", t: "action", kind: "spine" },
  { s: "action", t: "partition", kind: "spine" },
  { s: "partition", t: "hit", kind: "spine", label: "immediate" },
  { s: "hit", t: "cursor", kind: "spine" },
  { s: "cursor", t: "tail", kind: "spine", label: "last entry" },
  { s: "cursor", t: "entry", kind: "loop", label: "next entry" },
  {
    s: "partition",
    t: "schedule",
    kind: "enqueue",
    label: "trailing + footing",
  },
  // unlabeled: color already says enqueue/drain, details live in the station panels
  { s: "skillcast", t: "schedule", kind: "enqueue" },
  { s: "hit", t: "schedule", kind: "enqueue" },
  { s: "schedule", t: "hit", kind: "drain" },
]

const DATA = {
  stations: STATIONS,
  stores: STORES,
  flows: FLOWS,
  phases: PHASES,
}

// ---------- HTML ----------

const CLIENT_JS = String.raw`
"use strict";
var STATIONS = window.JOURNEY.stations, STORES = window.JOURNEY.stores,
    FLOWS = window.JOURNEY.flows, PHASES = window.JOURNEY.phases;
var state = { focus: null };

var stationById = {};
STATIONS.forEach(function (s) { stationById[s.id] = s; });
var storeById = {};
STORES.forEach(function (s) { storeById[s.id] = s; });

var svg = document.getElementById("graph");
var vb = { x: 0, y: 0, w: 1700, h: 1040 };

function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

// ---- layout: horizontal spine, schedule hub below, stores band at bottom ----
var BOX_W = 150, BOX_H = 46, STORE_W = 180, STORE_H = 46, HUB_W = 240, HUB_H = 64;
function layout() {
  var pos = {};
  var n = STATIONS.length, w = 1700, x0 = 110, dx = (w - 220) / (n - 1);
  STATIONS.forEach(function (s, i) { pos[s.id] = { x: x0 + i * dx, y: 220, kind: "station" }; });
  pos["schedule"] = { x: 850, y: 540, kind: "store", wide: true };
  var others = STORES.filter(function (s) { return s.id !== "schedule"; });
  var sdx = (w - 260) / (others.length - 1);
  others.forEach(function (s, i) { pos[s.id] = { x: 130 + i * sdx, y: 860, kind: "store" }; });
  return pos;
}
var POS = layout();

function boxDims(id) {
  var p = POS[id];
  if (p.kind === "station") {
    var st = stationById[id];
    return { w: BOX_W, h: BOX_H + (st.phases ? 16 : 0) };
  }
  return p.wide ? { w: HUB_W, h: HUB_H } : { w: STORE_W, h: STORE_H };
}

// Every box has exactly two docking points: one receives, one emits.
// Stations (on the spine): in = left edge center, out = right edge center.
// Hub + stores (below the spine): in = top edge left quarter, out = top edge right quarter.
function port(id, role) {
  var p = POS[id], d = boxDims(id);
  if (p.kind === "station") {
    return role === "in"
      ? { x: p.x - d.w / 2, y: p.y, nx: -1, ny: 0 }
      : { x: p.x + d.w / 2, y: p.y, nx: 1, ny: 0 };
  }
  return role === "in"
    ? { x: p.x - d.w / 4, y: p.y - d.h / 2, nx: 0, ny: -1 }
    : { x: p.x + d.w / 4, y: p.y - d.h / 2, nx: 0, ny: -1 };
}

function curve(s, t) {
  var a = port(s, "out"), b = port(t, "in");
  var dist = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
  var k = Math.max(40, Math.min(140, dist * 0.35));
  var c1 = { x: a.x + a.nx * k, y: a.y + a.ny * k };
  var c2 = { x: b.x + b.nx * k, y: b.y + b.ny * k };
  return { d: "M" + a.x + "," + a.y + " C" + c1.x + "," + c1.y + " " + c2.x + "," + c2.y + " " + b.x + "," + b.y,
           pts: [a, c1, c2, b] };
}

function bezierAt(pts, t) {
  var u = 1 - t;
  return {
    x: u * u * u * pts[0].x + 3 * u * u * t * pts[1].x + 3 * u * t * t * pts[2].x + t * t * t * pts[3].x,
    y: u * u * u * pts[0].y + 3 * u * u * t * pts[1].y + 3 * u * t * t * pts[2].y + t * t * t * pts[3].y,
  };
}

// Labeled edges sharing a port get staggered positions along their curves so
// their labels never share the same airspace.
var LABELED = FLOWS.filter(function (f) { return f.label; });
function labelT(f) {
  var siblings = LABELED.filter(function (g) { return g.s === f.s || g.t === f.t; });
  if (siblings.length === 1) return 0.5;
  var idx = siblings.indexOf(f);
  var spread = [0.32, 0.55, 0.72];
  return spread[Math.min(idx, spread.length - 1)];
}

// orthogonal polyline with rounded corners through the given waypoints
function roundedPath(pts, r) {
  var d = "M" + pts[0].x + "," + pts[0].y;
  for (var i = 1; i < pts.length - 1; i++) {
    var p = pts[i], prev = pts[i - 1], next = pts[i + 1];
    var v1x = p.x - prev.x, v1y = p.y - prev.y;
    var v2x = next.x - p.x, v2y = next.y - p.y;
    var l1 = Math.sqrt(v1x * v1x + v1y * v1y), l2 = Math.sqrt(v2x * v2x + v2y * v2y);
    var rr = Math.min(r, l1 / 2, l2 / 2);
    d += " L" + (p.x - (v1x / l1) * rr) + "," + (p.y - (v1y / l1) * rr);
    d += " Q" + p.x + "," + p.y + " " + (p.x + (v2x / l2) * rr) + "," + (p.y + (v2y / l2) * rr);
  }
  d += " L" + pts[pts.length - 1].x + "," + pts[pts.length - 1].y;
  return d;
}

// the "next entry" return edge: out of the last station's emit port, straight back
// along the spine axis above the boxes, into the first station's receive port
function loopPath(s, t) {
  var a = port(s, "out"), b = port(t, "in");
  var laneY = 120;
  var pts = [
    { x: a.x, y: a.y },
    { x: a.x + 26, y: a.y },
    { x: a.x + 26, y: laneY },
    { x: b.x - 26, y: laneY },
    { x: b.x - 26, y: b.y },
    { x: b.x, y: b.y },
  ];
  return { d: roundedPath(pts, 14), lx: (a.x + b.x) / 2, ly: laneY - 7 };
}

function focusedStores() {
  if (!state.focus || !stationById[state.focus]) return null;
  var st = stationById[state.focus], set = {};
  st.reads.forEach(function (r) { set[r.store] = (set[r.store] || "") + "r"; });
  st.writes.forEach(function (w) { set[w.store] = (set[w.store] || "") + "w"; });
  return set;
}

function render() {
  var parts = [];
  var labelParts = [];
  var focusStores = focusedStores();

  FLOWS.forEach(function (f) {
    var e = f.kind === "loop" ? loopPath(f.s, f.t) : curve(f.s, f.t);
    var cls = "flow " + f.kind;
    if (state.focus) cls += (f.s === state.focus || f.t === state.focus) ? " hi" : " dim";
    parts.push('<path d="' + e.d + '" class="' + cls + '"/>');
    if (f.label && (!state.focus || f.s === state.focus || f.t === state.focus)) {
      var lp = f.kind === "loop" ? { x: e.lx, y: e.ly } : bezierAt(e.pts, labelT(f));
      var pw = f.label.length * 6.2 + 14;
      labelParts.push('<rect class="flow-pill" x="' + (lp.x - pw / 2) + '" y="' + (lp.y - 9) + '" width="' + pw + '" height="17" rx="8.5"/>');
      labelParts.push('<text x="' + lp.x + '" y="' + (lp.y + 4) + '" class="flow-label ' + f.kind + '">' + esc(f.label) + "</text>");
    }
  });

  // read/write arrows for the focused station: reads arrive at its in port,
  // writes leave its out port
  if (state.focus && stationById[state.focus]) {
    var st = stationById[state.focus];
    st.reads.forEach(function (r) {
      if (!POS[r.store]) return;
      var e = curve(r.store, state.focus);
      parts.push('<path d="' + e.d + '" class="rw read"/>');
    });
    st.writes.forEach(function (w) {
      if (!POS[w.store]) return;
      var e = curve(state.focus, w.store);
      parts.push('<path d="' + e.d + '" class="rw write"/>');
    });
  }

  STATIONS.forEach(function (s, i) {
    var p = POS[s.id], d = boxDims(s.id);
    var cls = "station";
    if (state.focus) cls += s.id === state.focus ? " focused" : " dim";
    parts.push('<g class="' + cls + '" data-id="' + s.id + '" transform="translate(' + (p.x - d.w / 2) + "," + (p.y - d.h / 2) + ')">');
    parts.push('<rect width="' + d.w + '" height="' + d.h + '" rx="8"/>');
    parts.push('<text class="num" x="10" y="18">' + (i + 1) + "</text>");
    var words = s.title.split(" ");
    var line1 = words.slice(0, Math.ceil(words.length / (s.title.length > 16 ? 2 : 1))).join(" ");
    var line2 = words.slice(line1.split(" ").length).join(" ");
    if (line2) {
      parts.push('<text class="title" x="' + (d.w / 2 + 8) + '" y="20">' + esc(line1) + "</text>");
      parts.push('<text class="title" x="' + (d.w / 2 + 8) + '" y="35">' + esc(line2) + "</text>");
    } else {
      parts.push('<text class="title" x="' + (d.w / 2 + 8) + '" y="28">' + esc(s.title) + "</text>");
    }
    if (s.phases) {
      var pw = (d.w - 12) / PHASES.length;
      PHASES.forEach(function (ph, pi) {
        parts.push('<rect class="phase" x="' + (6 + pi * pw) + '" y="' + (d.h - 13) + '" width="' + (pw - 2) + '" height="9" rx="2"><title>' + ph + "</title></rect>");
      });
    }
    parts.push("</g>");
  });

  STORES.forEach(function (s) {
    var p = POS[s.id], d = boxDims(s.id);
    var cls = "store" + (p.wide ? " hub" : "");
    if (focusStores) {
      var m = focusStores[s.id];
      cls += m ? (m.indexOf("w") >= 0 ? " written" : " readonly") : " dim";
    } else if (state.focus === s.id) cls += " focused";
    else if (state.focus) cls += " dim";
    parts.push('<g class="' + cls + '" data-id="' + s.id + '" transform="translate(' + (p.x - d.w / 2) + "," + (p.y - d.h / 2) + ')">');
    parts.push('<rect width="' + d.w + '" height="' + d.h + '" rx="' + (p.wide ? 12 : 22) + '"/>');
    parts.push('<text class="title" x="' + d.w / 2 + '" y="' + (d.h / 2 + 4) + '">' + esc(s.name) + "</text>");
    parts.push("</g>");
  });

  // labels paint last — on top of lines and boxes alike
  parts.push.apply(parts, labelParts);
  svg.innerHTML = svg.querySelector("defs").outerHTML + parts.join("");
  svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
  renderInfo();
}

function detailHtml(id) {
  var html = "";
  if (stationById[id]) {
    var s = stationById[id];
    html += "<b>" + esc(s.title) + "</b><div class='mod'>" + esc(s.module) + "</div><p>" + esc(s.desc) + "</p>";
    if (s.phases) html += "<div class='phases'>" + PHASES.map(function (p) { return "<span>" + p + "</span>"; }).join(" → ") + "</div>";
    if (s.reads.length) html += "<div class='rw-list read'>reads " + s.reads.map(function (r) { return "<b>" + esc(storeById[r.store].name) + "</b> — " + esc(r.what); }).join(" · ") + "</div>";
    if (s.writes.length) html += "<div class='rw-list write'>writes " + s.writes.map(function (w) { return "<b>" + esc(storeById[w.store].name) + "</b> — " + esc(w.what); }).join(" · ") + "</div>";
    if (s.branches.length) html += "<div class='branches'>branches: " + s.branches.map(esc).join(" | ") + "</div>";
  } else if (storeById[id]) {
    var st = storeById[id];
    html += "<b>" + esc(st.name) + "</b><p>" + esc(st.holds) + "</p>";
  }
  return html;
}

function stationIndex(id) {
  for (var i = 0; i < STATIONS.length; i++) if (STATIONS[i].id === id) return i;
  return -1;
}

function stepFocus(dir) {
  var i = stationIndex(state.focus);
  if (i < 0) return;
  var j = i + dir;
  if (j < 0 || j >= STATIONS.length) return;
  state.focus = STATIONS[j].id;
  render();
}

function renderInfo() {
  var el = document.getElementById("info");
  if (!state.focus) { el.style.display = "none"; return; }
  el.style.display = "block";
  var i = stationIndex(state.focus);
  if (i < 0) {
    // a store: plain detail, no journey nav
    el.innerHTML = detailHtml(state.focus);
    return;
  }
  el.innerHTML =
    detailHtml(state.focus) +
    "<div class='nav'><button id='info-prev'" + (i === 0 ? " disabled" : "") + ">◀ prev</button>" +
    "<span>" + (i + 1) + " / " + STATIONS.length + "</span>" +
    "<button id='info-next'" + (i === STATIONS.length - 1 ? " disabled" : "") + ">next ▶</button></div>";
  document.getElementById("info-prev").addEventListener("click", function () { stepFocus(-1); });
  document.getElementById("info-next").addEventListener("click", function () { stepFocus(1); });
}

document.addEventListener("keydown", function (ev) {
  var t = ev.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (ev.key === "ArrowLeft") stepFocus(-1);
  if (ev.key === "ArrowRight") stepFocus(1);
});

svg.addEventListener("click", function (ev) {
  var g = ev.target.closest("g.station, g.store");
  if (g) state.focus = state.focus === g.dataset.id ? null : g.dataset.id;
  else state.focus = null;
  render();
});

// pan / zoom
var panning = null;
svg.addEventListener("mousedown", function (ev) {
  if (ev.target.closest("g.station, g.store")) return;
  panning = { mx: ev.clientX, my: ev.clientY, vx: vb.x, vy: vb.y };
});
window.addEventListener("mousemove", function (ev) {
  if (!panning) return;
  var scale = vb.w / svg.clientWidth;
  vb.x = panning.vx - (ev.clientX - panning.mx) * scale;
  vb.y = panning.vy - (ev.clientY - panning.my) * scale;
  svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
});
window.addEventListener("mouseup", function () { panning = null; });
svg.addEventListener("wheel", function (ev) {
  ev.preventDefault();
  var f = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
  var r = svg.getBoundingClientRect();
  var px = vb.x + ((ev.clientX - r.left) / r.width) * vb.w;
  var py = vb.y + ((ev.clientY - r.top) / r.height) * vb.h;
  vb.x = px - (px - vb.x) * f; vb.y = py - (py - vb.y) * f;
  vb.w *= f; vb.h *= f;
  svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
}, { passive: false });

render();
`

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>wuwa-sim — simulation flow</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #15171c; color: #d7dae0; font: 13px/1.45 ui-sans-serif, system-ui, sans-serif; overflow: hidden; }
  #graph { width: 100vw; height: 100vh; display: block; cursor: grab; }
  #graph:active { cursor: grabbing; }
  .flow { fill: none; stroke-width: 1.8; }
  .flow.spine { stroke: #8b93a5; marker-end: url(#arr-spine); stroke-width: 2.2; }
  .flow.loop { stroke: #5b6270; stroke-dasharray: 4 5; marker-end: url(#arr-loop); }
  .flow.enqueue { stroke: #e8a657; stroke-dasharray: 7 4; marker-end: url(#arr-enq); }
  .flow.drain { stroke: #c678dd; stroke-dasharray: 7 4; marker-end: url(#arr-drain); }
  .flow.dim, .station.dim, .store.dim { opacity: 0.13; }
  .flow.hi { stroke-width: 2.6; }
  .flow-label { font-size: 11px; text-anchor: middle; fill: #9aa1ae; }
  .flow-label.enqueue { fill: #e8a657; }
  .flow-label.drain { fill: #c678dd; }
  .flow-pill { fill: #15171c; fill-opacity: 0.92; stroke: #2a2e38; stroke-width: 1; }
  .rw { fill: none; stroke-width: 2; }
  .rw.read { stroke: #61afef; marker-end: url(#arr-read); }
  .rw.write { stroke: #98c379; marker-end: url(#arr-write); }
  .station { cursor: pointer; }
  .station rect { fill: #232733; stroke: #3c4356; stroke-width: 1.4; }
  .station.focused rect { stroke: #fff; stroke-width: 2; fill: #2a3040; }
  .station .num { fill: #5b6270; font-size: 11px; font-weight: 700; }
  .station .title { fill: #e2e6ee; font-size: 12.5px; font-weight: 650; text-anchor: middle; pointer-events: none; }
  .station .phase { fill: #e06c75; opacity: 0.75; }
  .store { cursor: pointer; }
  .store rect { fill: #1b2520; stroke: #3a5145; stroke-width: 1.4; }
  .store .title { fill: #aee8c0; font-size: 12px; font-weight: 600; text-anchor: middle; pointer-events: none; }
  .store.hub rect { fill: #2a2117; stroke: #8a6a3a; }
  .store.hub .title { fill: #e8c690; font-size: 13px; }
  .store.written rect { stroke: #98c379; stroke-width: 2.2; }
  .store.readonly rect { stroke: #61afef; stroke-width: 2.2; }
  .store.focused rect { stroke: #fff; stroke-width: 2; }
  #info { position: fixed; left: 14px; bottom: 16px; max-width: 560px; background: #1d2026f0; border: 1px solid #2a2e38;
          border-radius: 10px; padding: 12px 16px; display: none; }
  #info .nav { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
  #info .nav span { color: #7e8694; font-size: 12px; }
  #info .nav button { all: unset; cursor: pointer; background: #2a3040; border-radius: 8px; padding: 5px 12px; font-weight: 600; }
  #info .nav button:hover { background: #353c50; }
  #info .nav button[disabled] { opacity: 0.3; cursor: default; background: #2a3040; }
  #info .mod { color: #7e8694; font-size: 12px; margin: 2px 0 6px; }
  #info p { margin: 4px 0 8px; }
  #info .phases span { background: #3a2a2e; color: #e8a0a8; border-radius: 4px; padding: 1px 6px; font-size: 11px; }
  #info .rw-list { margin-top: 6px; font-size: 12px; }
  #info .rw-list.read { color: #61afef; }
  #info .rw-list.write { color: #98c379; }
  #info .rw-list b { color: inherit; }
  #info .branches { margin-top: 6px; color: #c8a85f; font-size: 12px; }
  #legend { position: fixed; top: 12px; right: 14px; background: #1d2026e6; border: 1px solid #2a2e38; border-radius: 8px; padding: 10px 14px; }
  #legend .row { display: flex; align-items: center; gap: 8px; margin: 3px 0; font-size: 12px; }
  #legend .line { width: 24px; height: 0; border-top: 2.5px solid #8b93a5; }
  #legend .line.e { border-top-style: dashed; border-color: #e8a657; }
  #legend .line.d { border-top-style: dashed; border-color: #c678dd; }
  #legend .line.r { border-color: #61afef; }
  #legend .line.w { border-color: #98c379; }
</style>
</head>
<body>
<svg id="graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1700 1040">
  <defs>
    <marker id="arr-spine" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#8b93a5"/></marker>
    <marker id="arr-loop" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#5b6270"/></marker>
    <marker id="arr-enq" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#e8a657"/></marker>
    <marker id="arr-drain" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#c678dd"/></marker>
    <marker id="arr-read" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#61afef"/></marker>
    <marker id="arr-write" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#98c379"/></marker>
  </defs>
</svg>
<div id="legend">
  <div class="row"><span class="line"></span>journey spine</div>
  <div class="row"><span class="line e"></span>enqueue onto Schedule</div>
  <div class="row"><span class="line d"></span>drained at landing frame</div>
  <div class="row"><span class="line r"></span>reads (on click)</div>
  <div class="row"><span class="line w"></span>writes (on click)</div>
</div>
<div id="info"></div>
<script>window.JOURNEY = ${JSON.stringify(DATA)};</script>
<script>${CLIENT_JS}</script>
</body>
</html>
`

const outPath = join(ROOT, "docs", "sim-flow.html")
writeFileSync(outPath, html)
console.log("wrote " + outPath)
