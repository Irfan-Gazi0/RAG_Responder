/**
 * Headless render check for the splat-vr viewer.
 *
 *   node scripts/render_check.mjs [url]
 *   # default url: https://d1ni7nkjr0eveg.cloudfront.net/splat-vr/index.html
 *   # local:       node scripts/render_check.mjs https://localhost:8082/
 *
 * Why this exists
 * ---------------
 * The scans have no inherent scale, so "it loaded without errors" says nothing
 * about whether the car is the right size - and a vehicle that is 30% too small
 * is precisely the kind of thing that only becomes obvious once you are standing
 * next to it in a headset. This renders each scan at a known camera, segments the
 * white bodywork from the tan captured ground, converts the on-screen length back
 * to metres and compares against the real vehicle.
 *
 * It is what caught the original calibration being ~30% under on the Equinoxes
 * and ~10% over on the Blazers, which the analytic pass in analyze_splats.py had
 * reported as exact.
 *
 * Requirements: system Chrome, plus playwright-core (already a dev dep of
 * portal/). Renders via SwiftShader, so it is slow but needs no GPU.
 *
 * NOTE ON TIMING: software rendering takes seconds per frame at this splat count.
 * The settle wait below is deliberately generous - with a short wait a *switched*
 * model still shows the previous car, which looks exactly like a model-swap bug
 * and is not one.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  new URL("../portal/node_modules/playwright-core/index.js", import.meta.url).pathname,
);

const BASE = process.argv[2] ?? "https://d1ni7nkjr0eveg.cloudfront.net/splat-vr/index.html";
const W = 900, H = 620;
// Must match main.ts: PerspectiveCamera(60 vfov) at (0, 1.6, 6), car on the origin.
const VFOV = 60, DIST = 6.05;
const SETTLE_MS = 12000;

// Manufacturer overall length, metres.
const TARGET = {
  "equinox-hood-open": 4.79,
  "equinox-hood-closed": 4.79,
  "blazer-hood-open": 4.92,
  "blazer-hood-closed": 4.92,
};
// Hood-open scans read slightly long because the raised hood widens the
// silhouette; 6% covers that without hiding a real mis-scale.
const TOLERANCE = 0.06;

const outDir = mkdtempSync(join(tmpdir(), "splat-render-"));
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--ignore-gpu-blocklist", "--ignore-certificate-errors", "--no-sandbox"],
});

const shots = [];
let failures = 0;

for (const key of Object.keys(TARGET)) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, ignoreHTTPSErrors: true });
  const problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) problems.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${BASE}?model=${key}`, { waitUntil: "load", timeout: 90000 });

  let status = "";
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    status = await page.evaluate(() => document.getElementById("status")?.textContent ?? "");
    if (/ready|Error/i.test(status)) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(SETTLE_MS);

  const shot = join(outDir, `${key}.png`);
  await page.screenshot({ path: shot });
  shots.push({ key, shot, target: TARGET[key], status, problems });
  await page.close();
}
await browser.close();

// Measure in Python: PIL is available on python3.10 (same interpreter as the
// deploy scripts) and Node has no image decoder in stdlib.
const py = `
import json, math, sys
from PIL import Image
jobs = json.loads(sys.argv[1])
VFOV, DIST = ${VFOV}, ${DIST}
out = []
for j in jobs:
    im = Image.open(j["shot"]).convert("RGB"); W, H = im.size; px = im.load()
    ppm = H / (2 * DIST * math.tan(math.radians(VFOV / 2)))
    cols = [0] * W
    for y in range(H):
        for x in range(W):
            if x < 340 and y < 200: continue      # controls panel
            if x < 300 and y > H - 70: continue   # status pill
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mn > 135 and mx - mn < 42:         # white bodywork, not tan ground
                cols[x] += 1
    peak = max(cols); th = max(2, peak * 0.05)
    xs = [x for x, c in enumerate(cols) if c >= th]
    j["measured"] = round((xs[-1] - xs[0]) / ppm, 3) if len(xs) >= 2 else 0.0
    out.append(j)
print(json.dumps(out))
`;
const res = spawnSync("python3.10", ["-c", py, JSON.stringify(shots)], { encoding: "utf8" });
if (res.status !== 0) {
  console.error("measurement failed:\n" + (res.stderr || res.stdout));
  process.exit(2);
}

console.log(`render check against ${BASE}\n`);
for (const j of JSON.parse(res.stdout.trim())) {
  const err = j.measured ? (j.measured - j.target) / j.target : -1;
  const ok = j.measured > 0 && Math.abs(err) <= TOLERANCE && j.problems.length === 0;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${j.key.padEnd(21)} ` +
    `measured ${j.measured.toFixed(2)} m vs ${j.target} m (${(err * 100).toFixed(1)}%)`,
  );
  if (j.problems.length) console.log(`        problems: ${[...new Set(j.problems)].join("; ")}`);
}
console.log(`\nscreenshots: ${outDir}`);
process.exit(failures ? 1 : 0);
