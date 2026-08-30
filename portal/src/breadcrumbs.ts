// Crash breadcrumbs that survive the tab dying — and are readable ON the device.
//
// The Quest in-VR failure kills the whole renderer process: the tab closes, and
// with it the console. Two constraints follow, and both are load-bearing:
//
//  1. The trail must be persisted as it happens, not flushed at the end.
//     localStorage writes are synchronous and land before the process dies.
//
//  2. The dev server is not a reader. The IWSDK dev runtime only activates on
//     localhost (`activation: localhost`), so a Quest browsing the LAN dev
//     server never pipes its console anywhere — the dev-server log shows only
//     the plugin's own headless browser. Read the trail with `frCrumbs()` over
//     `adb` + chrome://inspect instead (portal/CLAUDE.md).
//
// Runs are ARCHIVED rather than overwritten. The earlier version kept a single
// "previous run" slot, so two reloads after a crash silently destroyed the
// evidence — exactly when a person is most likely to be reloading.

const KEY = "fr_breadcrumbs";
const ARCHIVE_KEY = "fr_breadcrumbs_runs";
const LEGACY_PREV_KEY = "fr_breadcrumbs_prev";
const MAX_ENTRIES = 60;
const MAX_RUNS = 5;
const MAX_CHARS = 400;

export interface ArchivedRun {
  endedAt: string;
  lines: string[];
}

let buffer: string[] = [];
let startedAt = Date.now();
let writing = false;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persist() {
  if (writing) return;
  writing = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(buffer));
  } catch {
    // Quota / private mode: diagnostics are never load-bearing. Shed half and
    // keep going in memory.
    buffer = buffer.slice(-Math.floor(MAX_ENTRIES / 2));
  } finally {
    writing = false;
  }
}

/**
 * Record one breadcrumb. Mirrors to the console (for a live devtools session)
 * and to localStorage (so a dead tab still yields the trail).
 */
export function crumb(tag: string, ...parts: unknown[]) {
  let detail: string;
  try {
    detail = parts
      .map((p) => {
        if (typeof p === "string") return p;
        if (p instanceof Error) return `${p.name}: ${p.message}`;
        try {
          return JSON.stringify(p);
        } catch {
          return String(p);
        }
      })
      .join(" ");
  } catch {
    detail = "<unserializable>";
  }
  if (detail.length > MAX_CHARS) detail = detail.slice(0, MAX_CHARS) + "...";

  const line = `+${((Date.now() - startedAt) / 1000).toFixed(1)}s ${tag} ${detail}`;
  buffer.push(line);
  while (buffer.length > MAX_ENTRIES) buffer.shift();
  persist();

  console.log(`[${tag}]`, detail);
}

/** Every archived run, newest first. */
export function getArchive(): ArchivedRun[] {
  return readJson<ArchivedRun[]>(ARCHIVE_KEY, []);
}

export function clearArchive() {
  try {
    localStorage.removeItem(ARCHIVE_KEY);
    localStorage.removeItem(LEGACY_PREV_KEY);
  } catch {
    /* nothing we can do */
  }
}

/**
 * Fold the last run into the archive and start a fresh buffer. Called once at
 * startup, before anything else logs, so run boundaries stay clean.
 */
export function archivePreviousRun(): ArchivedRun[] {
  const archive = getArchive();

  // Migrate anything the single-slot version left behind, so a trail captured
  // before this change isn't thrown away.
  const legacy = readJson<string[]>(LEGACY_PREV_KEY, []);
  if (legacy.length > 0) {
    archive.unshift({ endedAt: "(earlier run)", lines: legacy });
    try {
      localStorage.removeItem(LEGACY_PREV_KEY);
    } catch {
      /* ignore */
    }
  }

  const prev = readJson<string[]>(KEY, []);
  if (prev.length > 0) {
    archive.unshift({ endedAt: new Date().toISOString(), lines: prev });
  }

  while (archive.length > MAX_RUNS) archive.pop();
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }

  buffer = [];
  startedAt = Date.now();

  if (prev.length > 0) {
    console.log(
      `%c[breadcrumbs] previous run ended with ${prev.length} entries`,
      "color:#f59e0b;font-weight:bold",
    );
    for (const line of prev) console.log("  " + line);
  }
  return archive;
}

/**
 * Console helper: `frCrumbs()` dumps this run plus the archive, `frCrumbs.clear()`
 * wipes it. On a Quest the console is reachable over `adb` + chrome://inspect —
 * see portal/CLAUDE.md. The on-page amber panel this module used to render was
 * removed once the crash was identified; the buffer itself stays because it is
 * free and it is the only trail that survives the tab dying.
 */
export function installCrumbsInspector() {
  const inspect = () => ({ current: [...buffer], archive: getArchive() });
  inspect.clear = clearArchive;
  (window as unknown as Record<string, unknown>).frCrumbs = inspect;
}
