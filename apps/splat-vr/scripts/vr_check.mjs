/**
 * Headless behaviour check for the splat-vr VR interaction layer.
 *
 *   node scripts/vr_check.mjs [url]      # default: https://localhost:8082/
 *
 * Why this exists
 * ---------------
 * scripts/render_check.mjs guards the one thing a screenshot can prove: that the
 * car is the size it claims to be. Everything else in this viewer - the teleport
 * arc, the panel's ray-to-button mapping, the XR render scale - only runs inside
 * a session, so it has historically been verified by putting the headset on. That
 * is a slow loop, it is not repeatable, and it is exactly how a half-resolution
 * framebuffer sat in the build unnoticed.
 *
 * So main.ts exposes a `window.__vr` seam under ?dev=1 (same idea as __diag) and
 * this drives it: synthetic controller poses in, landing points and hit actions
 * out. It cannot tell you whether something FEELS right in a headset - nothing
 * headless can - but it will tell you the moment the maths stops being right.
 *
 * Requirements: system Chrome + playwright-core (a dev dep of portal/), same as
 * render_check.mjs. Renders via SwiftShader.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  new URL("../../portal/node_modules/playwright-core/index.js", import.meta.url).pathname,
);

const BASE = process.argv[2] ?? "https://localhost:8082/";
const url = `${BASE}${BASE.includes("?") ? "&" : "?"}dev=1`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
}
/** Metres of slop allowed when comparing world positions. */
const EPS = 0.02;

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--ignore-gpu-blocklist", "--ignore-certificate-errors", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 900, height: 620 }, ignoreHTTPSErrors: true });

const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  // Chrome logs a bare "Failed to load resource" with no URL; the response hook
  // below is the one that can tell a real failure from a missing favicon.
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) {
    consoleErrors.push(`console: ${m.text()}`);
  }
});
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) consoleErrors.push(`${r.status()} ${r.url()}`);
});

await page.goto(url, { waitUntil: "load", timeout: 90000 });
await page.waitForFunction(() => !!window.__vr, null, { timeout: 30000 });

// Wait for the scan itself, so the scene is in the state a user would meet.
await page.waitForFunction(
  () => /ready|Error/i.test(document.getElementById("status")?.textContent ?? ""),
  null,
  { timeout: 90000 },
);

// --- 1. XR render scale ----------------------------------------------------
// The regression this exists for: SparkXr silently defaults the WebXR
// framebuffer to HALF resolution, and three defaults foveation to maximum.
const xr = await page.evaluate(() => window.__vr.xrRender());
// Guards the DEFAULT. The bar is what separates "configured" from Spark's 0.5
// fallback, not the exact value - ?fbscale= is meant to go below this on device.
check("framebuffer scale is not Spark's half-res default", xr.framebufferScale >= 0.7,
  `got ${xr.framebufferScale} (Spark's unset default is 0.5)`);
// three's getFoveation() only reports once a session owns a layer, so headless
// it is undefined - assert the configured value, and the readback when there is one.
check("foveation is not three's max-blur default",
  typeof xr.foveation === "number" ? xr.foveation <= 0.8 : xr.configuredFoveation <= 0.8,
  `configured=${xr.configuredFoveation} readback=${xr.foveation}`);

// --- 2. Teleport arc -------------------------------------------------------
// Controller at hand height, pitched 30 degrees down, aimed along -Z.
const pitch = (deg) => {
  const h = (deg * Math.PI) / 360;
  return [Math.sin(h), 0, 0, Math.cos(h)];
};

const fwd = await page.evaluate(
  ([p, q]) => window.__vr.aimFrom(p, q, 0, 1),
  [[0, 1.2, 4], pitch(-30)],
);
check("arc aimed forward-and-down finds the floor", fwd.valid, JSON.stringify(fwd));
check("landing sits exactly on the floor plane", Math.abs(fwd.y) < 1e-6, `y=${fwd.y}`);
check("landing is ahead of the controller", fwd.z < 4 - 0.5, `z=${fwd.z.toFixed(2)}`);
check("landing is a plausible stride, not a leap", 1 < 4 - fwd.z && 4 - fwd.z < 12,
  `${(4 - fwd.z).toFixed(2)} m ahead`);

// A softer push must not throw as far - this is what makes the arc a range control.
const soft = await page.evaluate(
  ([p, q]) => window.__vr.aimFrom(p, q, 0, 0.1),
  [[0, 1.2, 4], pitch(-30)],
);
check("stick push scales throw distance", soft.valid && soft.z > fwd.z + 0.3,
  `soft z=${soft.z.toFixed(2)} vs full z=${fwd.z.toFixed(2)}`);

// Off the edge of the synthetic floor there is nothing to stand on.
const off = await page.evaluate(
  ([p, q]) => window.__vr.aimFrom(p, q, 0, 1),
  [[0, 1.2, 15], [0, 1, 0, 0]], // 180 deg yaw: aims outward, away from origin
);
check("landing beyond the floor disc is rejected", !off.valid,
  `valid=${off.valid} at r=${Math.hypot(off.x, off.z).toFixed(2)} m`);

// Ducked below the floor. Rise/duck reaches -1.4 m so you can get your eyes
// under a sill, and in hand mode teleport is the ONLY locomotion there is - so
// an arc that cannot be launched from down there strands you. The integrator
// only lands on a DESCENDING crossing, which an arc starting below its plane
// never produced: the reticle just went red with no explanation. The plane is
// now the player's own foot plane, so the SAME gesture must throw the SAME
// distance whether you are standing or crouched under a sill.
const ducked = await page.evaluate(([p, q]) => {
  window.__vr.recentre();
  const duck = window.__vr.setHeight(-1.2);
  // The hand goes down with the rig: 1.2 m of hand height above feet that are
  // now 1.2 m under the floor.
  const landing = window.__vr.aimFrom(p, q, 0, 1);
  window.__vr.setHeight(0);
  return { duck, landing };
}, [[0, 0, 4], pitch(-30)]);
check("an arc launched while ducked below the floor still lands",
  ducked.landing.valid, JSON.stringify(ducked));
check("the ducked landing sits on the player's own foot plane",
  Math.abs(ducked.landing.y - ducked.duck) < 1e-6,
  `landing y=${ducked.landing.y}, feet at ${ducked.duck}`);
check("ducking does not change how far the same gesture throws",
  Math.abs(ducked.landing.z - fwd.z) < EPS,
  `ducked z=${ducked.landing.z.toFixed(3)} vs standing z=${fwd.z.toFixed(3)}`);

// --- 3. Teleport commit moves the HEAD, not the rig origin -----------------
const move = await page.evaluate(([p, q]) => {
  window.__vr.recentre();
  const before = window.__vr.rig();
  const landing = window.__vr.aimFrom(p, q, 0, 1);
  const committed = window.__vr.commitTeleport();
  // Blink is 0.09 s out, then the move happens; step past it.
  window.__vr.stepTeleport(0.2);
  return { before, after: window.__vr.rig(), landing, committed };
}, [[0, 1.2, 4], pitch(-30)]);

check("commit reports success on valid ground", move.committed === true);
{
  // The camera sits at (0,1.6,6) relative to a rig recentred to (0,0,4.5), so its
  // ground position is z = 10.5; after the jump that must be the landing point.
  const dz = move.after[2] - move.before[2];
  const want = move.landing.z - 10.5;
  check("commit translates the rig by head-to-target", Math.abs(dz - want) < EPS,
    `moved ${dz.toFixed(3)} m, expected ${want.toFixed(3)} m`);
  check("commit does not change height", Math.abs(move.after[1] - move.before[1]) < 1e-6);
}

// A jump aimed at the FLOOR has to land on the floor. Rise/duck is for
// inspecting a spot, not a mode you travel in - arriving still hovering (or
// still under the deck, from looking at an undercarriage) contradicts the
// reticle you just aimed with.
const fromHeight = await page.evaluate(([p, q]) => {
  window.__vr.recentre();
  window.__vr.setHeight(1.2);
  const raised = window.__vr.height();
  window.__vr.aimFrom(p, q, 0, 1);
  window.__vr.commitTeleport();
  window.__vr.stepTeleport(0.2);
  return { raised, after: window.__vr.height() };
}, [[0, 2.4, 4], pitch(-40)]);
check("teleport lands you back on the floor", Math.abs(fromHeight.after) < 1e-6,
  `raised to ${fromHeight.raised}, landed at ${fromHeight.after}`);

// --- 4. Panel ray-to-button mapping ----------------------------------------
// The panel is a canvas on a quad: a press is a raycast, a UV, and a rectangle
// lookup. Get the V axis backwards and every button silently maps to the wrong
// action, which is invisible until someone in a headset toggles the wrong thing.
//
// The button centres are now READ BACK from the panel (window.__vr.panelRects)
// rather than recomputed here from its margins and pitches. That duplication
// rotted every time the layout changed - and it has just changed, from a 3x2
// comfort grid to 4x2. The ray-to-action path is still exercised for real; only
// the "where is button N" arithmetic is no longer owned in two places.
const panel = await page.evaluate(() => {
  window.__vr.recentre();
  window.__vr.showPanel();
  const rects = window.__vr.panelRects();
  const grid = {};
  for (const r of rects) grid[r.action] = window.__vr.panelHitUV(r.u, r.v);
  return {
    rects,
    grid,
    minimise: window.__vr.panelHitUV((1024 - 64) / 1024, 42 / 900),
    bindingRow: window.__vr.panelHitUV(0.5, 200 / 900),
    outside: window.__vr.panelHitUV(1.6, 0.5),
    // Which way the panel is actually turned. Measured after recentre() - the
    // rig pose onEnterXr always leaves behind - because that is precisely the
    // case the UV probes above cannot see: they step out along the panel's own
    // normal, so they land on its front face however it is rotated.
    facing: window.__vr.panelFacing(),
  };
});

const EXPECTED_ACTIONS = [
  "minimize", "toggleTurn", "toggleMove", "toggleVertical", "toggleHotspots",
  "toggleVignette", "toggleHints", "toggleHaptics", "recentre",
];
check("the panel exposes every expected button",
  EXPECTED_ACTIONS.every((a) => panel.rects.some((r) => r.action === a)) &&
    panel.rects.length === EXPECTED_ACTIONS.length,
  `got ${panel.rects.map((r) => r.action).join(", ")}`);
check("every painted button is reachable by a ray, and maps to itself",
  panel.rects.every((r) => panel.grid[r.action] === r.action),
  JSON.stringify(panel.grid));
check("top-right of the panel is the minimise button", panel.minimise === "minimize",
  `got ${panel.minimise}`);
check("the binding list is not clickable", panel.bindingRow === null,
  `got ${panel.bindingRow}`);
check("a ray past the panel resolves to nothing", panel.outside === null,
  `got ${panel.outside}`);
// The one thing every ray test above is blind to. Object3D.lookAt takes a
// WORLD-space target; place() was handing it a rig-local one, so the panel came
// up rotated 180 degrees away on every VR entry (onEnterXr recentres the rig to
// 0,0,4.5 first, and the error is exactly that translation). A front-sided
// surface seen from behind renders nothing, so this was invisible-panel, not
// merely mis-angled.
check("the panel faces the viewer after a recentre", panel.facing > 0.9,
  `panel normal . direction-to-head = ${panel.facing?.toFixed(3)} (negative = turned away)`);
{
  // Reading the layout back cannot catch a grid painted in the wrong order, so
  // assert the reading order explicitly: left to right, top to bottom.
  const g = panel.rects.filter((r) => r.action !== "minimize");
  const sorted = [...g].sort((a, b) => (a.v - b.v) || (a.u - b.u));
  check("the comfort grid reads left-to-right, top-to-bottom",
    sorted[0].action === "toggleTurn" &&
      sorted[3].action === "toggleHotspots" &&
      sorted[sorted.length - 1].action === "recentre",
    sorted.map((r) => r.action).join(" "));
}

// --- 5. Comfort settings round-trip through storage -------------------------
const store = await page.evaluate(async () => {
  window.__vr.apply({
    movementStyle: "teleport", haptics: false, dominantHand: "left",
    verticalMove: false, hotspots: false,
  });
  const live = window.__vr.comfort();
  // saveComfort debounces at 250 ms; wait past it and read what was persisted.
  await new Promise((r) => setTimeout(r, 500));
  const raw = localStorage.getItem("splatvr.comfort.v1");
  return { live, saved: raw ? JSON.parse(raw) : null, dom: {
    movement: document.getElementById("movementStyle").value,
    haptics: document.getElementById("haptics").checked,
    hand: document.getElementById("dominantHand").value,
  } };
});
check("settings reach the live comfort object",
  store.live.movementStyle === "teleport" && store.live.haptics === false);
check("settings are mirrored onto the DOM controls",
  store.dom.movement === "teleport" && store.dom.haptics === false && store.dom.hand === "left");
check("settings survive the debounced write",
  store.saved?.movementStyle === "teleport" && store.saved?.dominantHand === "left",
  JSON.stringify(store.saved));
check("the new comfort settings round-trip too",
  store.live.verticalMove === false && store.live.hotspots === false &&
    store.saved?.verticalMove === false && store.saved?.hotspots === false,
  JSON.stringify({ live: store.live.hotspots, saved: store.saved?.hotspots }));

// --- 6. Rig wiring, which the reported 6DoF loss is NOT caused by ----------
// The prescribed fix for "the headset does not move" is to put the camera in a
// rig and keep locomotion off the camera - which is what this viewer has always
// done. That makes it worth pinning down permanently: if the camera ever stops
// being a child of playerRig, Spark writes its movement into whatever
// `camera.parent` is instead and head tracking really would be fighting it.
const wiring = await page.evaluate(() => window.__vr.wiring());
check("the camera is a child of the player rig", wiring.cameraInRig === true);
check("the rig hangs directly off the scene", wiring.rigInScene === true);
check("nothing transforms the rig's parent", wiring.rigParentIsIdentity === true);

// The diagnostic that answers the question on device. Headless there is no
// session, so this only asserts the readout exists and reports the
// permissions-policy honestly - the head-travel number needs a headset.
const trk = await page.evaluate(() => window.__vr.tracking());
check("the tracking readout is available",
  typeof trk.maxTravel === "number" && Array.isArray(trk.enabledFeatures),
  JSON.stringify(trk).slice(0, 120));
check("a directly-loaded page is not reported as framed", trk.framed === false);

// --- 7. Rise / duck on the turn stick's spare axis -------------------------
const height = await page.evaluate(() => {
  window.__vr.recentre();
  const [lo, hi] = window.__vr.heightRange();
  return {
    lo, hi,
    start: window.__vr.height(),
    up: window.__vr.setHeight(0.8),
    overshootUp: window.__vr.setHeight(hi + 5),
    overshootDown: window.__vr.setHeight(lo - 5),
    // Ducked under the deck: the floor disc is DoubleSide and would otherwise
    // be an opaque concrete ceiling over the undercarriage.
    groundUnder: (() => { window.__vr.setHeight(-1.3); return null; })(),
  };
});
check("recentre puts you back on the floor", Math.abs(height.start) < 1e-6,
  `y=${height.start}`);
check("the height axis moves the rig", Math.abs(height.up - 0.8) < 1e-6,
  `y=${height.up}`);
check("height clamps at the top", Math.abs(height.overshootUp - height.hi) < 1e-6,
  `${height.overshootUp} vs ${height.hi}`);
check("height clamps at the bottom", Math.abs(height.overshootDown - height.lo) < 1e-6,
  `${height.overshootDown} vs ${height.lo}`);
check("the height range spans below the floor and above a raised hood",
  height.lo <= -1 && height.hi >= 1.2, `[${height.lo}, ${height.hi}]`);

// setSubfloorFade runs from the XR branch of the loop, so drive it the way the
// loop would rather than waiting for a session that will never start here.
const fade = await page.evaluate(() => {
  const read = (headY) => { window.__vr.fadeGround(headY); return window.__vr.groundOpacity(); };
  return { above: read(1.6), atFloor: read(0), below: read(-0.3), restored: read(1.6) };
});
check("the floor is solid at standing height", fade.above > 0.99, `${fade.above}`);
check("the floor fades out from under it", fade.below < 0.02, `${fade.below}`);
check("the floor comes back when you rise", fade.restored > 0.99, `${fade.restored}`);
check("the fade is partial, not a switch, at the floor plane",
  fade.atFloor > 0.02 && fade.atFloor < 0.99, `${fade.atFloor}`);

// --- 8. Hazard and cut-point hotspots --------------------------------------
const spots = await page.evaluate(() => {
  window.__vr.apply({ hotspots: true });
  return {
    list: window.__vr.hotspots(),
    diag: window.__diag,
  };
});
check("the loaded scan has a hazard set", spots.list.length >= 8,
  `${spots.list.length} markers`);
check("hotspot ids are unique",
  new Set(spots.list.map((h) => h.id)).size === spots.list.length);
check("the set covers all three severities",
  new Set(spots.list.map((h) => h.severity)).size === 3,
  [...new Set(spots.list.map((h) => h.severity))].join(","));
{
  // Positions are authored in metres from the vehicle centre, so every marker
  // must land on the vehicle - not out on the tarmac, and not underground.
  // Half the target length plus a small margin is the test that catches a sign
  // error or a forgotten yaw, which would otherwise put the first responder
  // loop at the back bumper and look plausible in a screenshot.
  const halfLen = spots.diag.targetLengthM / 2 + 0.25;
  const stray = spots.list.filter((h) => {
    const [x, y, z] = h.world;
    return Math.abs(x) > halfLen || Math.abs(z) > 1.4 || y < 0 || y > 2.2;
  });
  check("every marker lands on the vehicle", stray.length === 0,
    stray.map((h) => `${h.id}@${h.world.map((n) => n.toFixed(2))}`).join(" "));
}
check("seeded positions are flagged unverified",
  spots.list.every((h) => h.verified === false),
  "a marker claims to be confirmed - only an operator in a headset can set that");

// Both sides of the vehicle. Restraints, high-strength zones and lifting points
// exist on the left AND the right of a real car, but every one of them was
// authored at +Z - so a responder working the passenger side saw ghosted
// far-side markers and nothing at all on the side they were standing on.
// hotspots-data.ts mirrors the symmetric entries; assert the mirror survives.
{
  const byId = new Map(spots.list.map((h) => [h.id, h]));
  const twins = spots.list.filter((h) => h.id.endsWith("-passenger"));
  check("symmetric hazards are present on both sides", twins.length >= 3,
    `${twins.length} passenger-side twins`);
  // Authored `pos`, not `world`: the vehicle frame is mirrored across its own
  // centreline, and the per-scan yaw is what decides which way that faces.
  const broken = twins.filter((h) => {
    const base = byId.get(h.id.replace(/-passenger$/, ""));
    return !base || base.pos[2] === 0 || Math.abs(base.pos[2] + h.pos[2]) > 1e-6;
  });
  check("each twin reflects its driver-side entry across the centreline",
    broken.length === 0, broken.map((h) => h.id).join(" "));
}

// Ray -> marker -> card, the path a trigger pull or a pinch actually takes.
const card = await page.evaluate(() => {
  const list = window.__vr.hotspots();
  const target = list.find((h) => h.id === "hv-battery-pack") ?? list[0];
  const [x, y, z] = target.world;
  // Stand off 2 m along +X and look back at the marker.
  const from = [x + 2, y, z];
  const yaw = Math.atan2(from[0] - x, from[2] - z) / 2;
  const quat = [0, Math.sin(yaw), 0, Math.cos(yaw)];
  const hit = window.__vr.hotspotAt(from, quat);
  const miss = window.__vr.hotspotAt([x + 2, y + 4, z], quat);

  window.__vr.openCard(target.id);
  const opened = window.__vr.card();
  // Opening a second card must replace the first, not stack another quad in
  // the same place.
  const other = list.find((h) => h.id !== target.id);
  window.__vr.openCard(other.id);
  const swapped = window.__vr.card();
  const closeHit = window.__vr.cardHitUV((880 - 54) / 880, 48 / 620);
  const bodyHit = window.__vr.cardHitUV(0.5, 0.5);
  window.__vr.closeCard();
  return { target: target.id, hit, miss, opened, swapped, closeHit, bodyHit,
           afterClose: window.__vr.card() };
});
check("a ray at a marker resolves to that marker", card.hit === card.target,
  `got ${card.hit}, wanted ${card.target}`);
check("a ray past every marker resolves to nothing", card.miss === null,
  `got ${card.miss}`);
check("selecting a marker opens its card",
  card.opened.visible === true && card.opened.id === card.target,
  JSON.stringify(card.opened));
check("only one card is open at a time", card.swapped.id !== card.target,
  JSON.stringify(card.swapped));
check("the card's close button is where it is painted", card.closeHit === "close",
  `got ${card.closeHit}`);
check("the card body is not a button", card.bodyHit === null, `got ${card.bodyHit}`);
check("closing the card hides it", card.afterClose.visible === false);

// Markers must survive a model swap - they are keyed by vehicle, and both scans
// of one vehicle share a set.
const swap = await page.evaluate(async () => {
  const sel = document.getElementById("modelSelect");
  const before = window.__vr.hotspots().length;
  sel.value = "blazer-hood-closed";
  sel.dispatchEvent(new Event("change"));
  await new Promise((r) => setTimeout(r, 1500));
  const list = window.__vr.hotspots();
  return { before, after: list.length, sample: list[0]?.world ?? null };
});
check("a model swap keeps a full hazard set",
  swap.after >= 8 && swap.sample !== null,
  JSON.stringify(swap));

// --- 9. Input mode ---------------------------------------------------------
// Headless there are no input sources at all, which is its own answer: the
// panel must not claim controllers exist when nothing is connected.
const mode = await page.evaluate(() => ({
  mode: window.__vr.inputMode(),
  effective: window.__vr.effectiveMovementStyle(),
}));
check("input mode reports honestly with nothing connected", mode.mode === "none",
  `got ${mode.mode}`);

// --- 10. ?hazards=0 is a per-load override, never a stored preference -------
// render_check.mjs opens the viewer with ?hazards=0 so a marker near the nose is
// not segmented as bodywork. That override used to be folded into the comfort
// object, which applyComfort() persists - so anyone who opened that URL and then
// touched any comfort control had hazards off for good, with nothing in the UI
// saying why. Fresh CI profiles never saw it.
{
  // Seed a positive stored preference (section 5 left it false).
  await page.evaluate(async () => {
    window.__vr.apply({ hotspots: true });
    await new Promise((r) => setTimeout(r, 500));
  });

  const overridePage = await browser.newPage({
    viewport: { width: 900, height: 620 },
    ignoreHTTPSErrors: true,
  });
  overridePage.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  await overridePage.goto(`${url}&hazards=0`, { waitUntil: "load", timeout: 90000 });
  await overridePage.waitForFunction(() => !!window.__vr, null, { timeout: 30000 });

  const hz = await overridePage.evaluate(async () => {
    const onLoad = window.__vr.hazards();
    // Touch an unrelated control: this is the write that used to carry the
    // override into localStorage.
    window.__vr.apply({ haptics: true });
    await new Promise((r) => setTimeout(r, 500));
    return {
      onLoad,
      after: window.__vr.hazards(),
      saved: JSON.parse(localStorage.getItem("splatvr.comfort.v1") ?? "null"),
    };
  });
  await overridePage.close();

  check("?hazards=0 hides the markers", hz.onLoad.forcedOff === true && hz.onLoad.visible === false,
    JSON.stringify(hz.onLoad));
  check("?hazards=0 leaves the stored preference alone", hz.onLoad.stored === true,
    `stored=${hz.onLoad.stored}`);
  check("an unrelated comfort write does not persist the override",
    hz.after.stored === true && hz.saved?.hotspots === true,
    JSON.stringify({ live: hz.after.stored, saved: hz.saved?.hotspots }));
  check("the override still outranks the preference for this load",
    hz.after.visible === false, `visible=${hz.after.visible}`);
}

// --- 11. Nothing went wrong on the way -------------------------------------
check("no console or network errors", consoleErrors.length === 0,
  [...new Set(consoleErrors)].slice(0, 4).join(" | "));

await page.close();
await browser.close();

console.log(`vr check against ${url}\n`);
let failures = 0;
for (const r of results) {
  if (!r.ok) failures++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail && !r.ok ? `\n        ${r.detail}` : ""}`);
}
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
