"""
Automated eval runner for the First Responder RAG chatbot.

Fires each ground-truth question in eval_questions.json at the live n8n chat
webhook, heuristically scores the model output against the expected answer via
keyword overlap, and writes a dated triage markdown table under eval_results/.

This replaces the old hand-filled `baseline_results.md` / `postfix_results.md`
workflow: instead of manually pasting Q/A pairs and eyeballing them, we batch
the whole set, auto-classify PASS/FAIL/REVIEW, and surface the FAIL/REVIEW rows
first so a human only hand-checks the ambiguous ones. The keyword scoring is a
best-effort triage aid, NOT a grader — REVIEW means "look at this yourself".

Each question gets a fresh uuid4 session_id so conversation history never bleeds
between questions. Errors are recorded per-question, never aborting the run.

Usage:
  python3 run_eval.py                      # run all 90 questions
  python3 run_eval.py --sample 10          # random 10-question subset
  python3 run_eval.py --ids 61-90          # explicit id range (live-class Qs)
  python3 run_eval.py --ids 1,5,9          # explicit id list
  python3 run_eval.py --ids 1-10,61        # mixed range + list
  python3 run_eval.py --cache              # skip ids already run for this config
  python3 run_eval.py --out /tmp/eval.md   # override output markdown path

The default output path is eval_results/<date>.md. A run that covers FEWER
questions than a report already sitting at that path is auto-suffixed
(eval_results/<date>.sampleN.md) rather than overwriting it: a 3-question triage
silently destroying the day's 90-question baseline is not recoverable, and the
only evidence it happened is a "Questions run: 3" line nobody reads until later.
An explicit --out always wins.

The router-config hash (sha256 of n8n_router_config.md) tags every cache file so
results from a different live prompt/config never get reused.
"""

import argparse
import hashlib
import json
import random
import re
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(str(Path(__file__).parent / ".env"))

ROOT = Path(__file__).parent
WEBHOOK_URL = "https://irfangazi.app.n8n.cloud/webhook/a7782f7b-3403-48c3-9e6d-c14772a002a1"
EVAL_FILE = ROOT / "eval_questions.json"
ROUTER_CONFIG_FILE = ROOT / "n8n_router_config.md"
RESULTS_DIR = ROOT / "eval_results"
CACHE_DIR = RESULTS_DIR / ".cache"
REQUEST_TIMEOUT = 120  # seconds

PASS_THRESHOLD = 0.6
FAIL_THRESHOLD = 0.3
TIMESTAMP_TOLERANCE = 60  # seconds

# Common English + domain filler words dropped before keyword matching.
STOPWORDS = {
    "the", "and", "for", "are", "but", "not", "you", "your", "with", "that",
    "this", "from", "any", "all", "can", "has", "have", "had", "was", "were",
    "will", "would", "should", "must", "may", "into", "onto", "out", "off",
    "its", "it's", "they", "them", "their", "then", "than", "when", "where",
    "which", "who", "whom", "whose", "what", "why", "how", "his", "her", "she",
    "him", "our", "ours", "yours", "some", "such", "each", "other", "these",
    "those", "there", "here", "been", "being", "does", "did", "done", "get",
    "got", "gets", "also", "about", "after", "before", "over", "under", "more",
    "most", "very", "just", "only", "both", "either", "neither", "per", "via",
    "one", "two", "within", "around", "approximately", "approx", "typically",
    "consistently", "actually", "removes", "allow", "allows", "placed", "top",
    "type", "type==",
}

TOKEN_RE = re.compile(r"[a-z0-9]+")
TS_RE = re.compile(r"\b(\d{1,2}):([0-5]?\d):([0-5]?\d)\b")
# Fallback MM:SS form for timestamps found in model output.
TS_MMSS_RE = re.compile(r"\b(\d{1,2}):([0-5]\d)\b")


def config_hash() -> str:
    """sha256 of the live router config file — tags each cache to a prompt version."""
    if not ROUTER_CONFIG_FILE.is_file():
        return "no-config"
    data = ROUTER_CONFIG_FILE.read_bytes()
    return hashlib.sha256(data).hexdigest()


def load_questions() -> list:
    with open(EVAL_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)["questions"]


def parse_ids(spec: str) -> set:
    """Parse '61-90', '1,5,9', or mixed '1-10,61' into a set of ints."""
    ids = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            lo, hi = int(lo.strip()), int(hi.strip())
            if lo > hi:
                lo, hi = hi, lo
            ids.update(range(lo, hi + 1))
        else:
            ids.add(int(part))
    return ids


def salient_tokens(text: str) -> list:
    """Lowercase, split on non-alphanumerics, drop stopwords + <3-char tokens.

    Numbers are always kept regardless of length (e.g. '50', '12') since units
    and magnitudes are the load-bearing facts in these answers.
    """
    tokens = TOKEN_RE.findall(text.lower())
    out = []
    for tok in tokens:
        if tok.isdigit():
            out.append(tok)
        elif len(tok) >= 3 and tok not in STOPWORDS:
            out.append(tok)
    return out


def keyword_match(expected: str, got: str):
    """Fraction of salient expected-answer tokens present in the model output."""
    expected_tokens = salient_tokens(expected)
    if not expected_tokens:
        return 0.0, 0, 0
    got_set = set(salient_tokens(got))
    unique_expected = list(dict.fromkeys(expected_tokens))
    hits = sum(1 for tok in unique_expected if tok in got_set)
    return hits / len(unique_expected), hits, len(unique_expected)


def verdict_for(fraction: float) -> str:
    if fraction >= PASS_THRESHOLD:
        return "PASS"
    if fraction < FAIL_THRESHOLD:
        return "FAIL"
    return "REVIEW"


def parse_timestamp(hms: str):
    """Parse HH:MM:SS to total seconds; None if not parseable."""
    m = TS_RE.search(hms)
    if not m:
        return None
    h, mnt, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return h * 3600 + mnt * 60 + s


def timestamp_ok(source: dict, got: str):
    """Secondary informational check: does output cite a ts within tolerance?

    Returns 'yes' / 'no' / '' (blank when no expected ts, or output has no ts).
    Never drives pass/fail.
    """
    expected = source.get("approximate_timestamp")
    if not expected:
        return ""
    expected_secs = parse_timestamp(expected)
    if expected_secs is None:
        return ""
    # Look for any HH:MM:SS or MM:SS timestamp in the model output.
    candidates = []
    for m in TS_RE.finditer(got):
        candidates.append(int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3)))
    if not candidates:
        for m in TS_MMSS_RE.finditer(got):
            candidates.append(int(m.group(1)) * 60 + int(m.group(2)))
    if not candidates:
        return ""  # output cites no timestamp — leave blank, don't penalize
    best = min(abs(c - expected_secs) for c in candidates)
    return "yes" if best <= TIMESTAMP_TOLERANCE else "no"


def extract_answer(payload) -> str:
    """Robustly pull the answer string from webhook JSON (dict or list forms)."""
    if isinstance(payload, list):
        payload = payload[0] if payload else {}
    if isinstance(payload, dict):
        for key in ("output", "answer", "text", "response"):
            if key in payload and payload[key] is not None:
                return str(payload[key])
        return json.dumps(payload)
    return str(payload)


def ask_webhook(question: str):
    """POST a question to the n8n chat webhook. Returns (answer, error)."""
    body = json.dumps({"question": question, "session_id": str(uuid.uuid4())}).encode("utf-8")
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
        try:
            return extract_answer(json.loads(raw)), None
        except json.JSONDecodeError:
            return raw.strip(), None
    except urllib.error.HTTPError as e:
        return "", f"HTTP {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        return "", f"URLError: {e.reason}"
    except Exception as e:  # noqa: BLE001 - never abort the whole run per-question
        return "", f"{type(e).__name__}: {e}"


def truncate(text: str, limit: int) -> str:
    """Single-line, pipe-safe, length-capped cell for the markdown table."""
    if text is None:
        text = ""
    text = " ".join(str(text).split()).replace("|", "\\|")
    if len(text) > limit:
        return text[: limit - 1].rstrip() + "…"
    return text


def load_cache(chash: str) -> dict:
    path = CACHE_DIR / f"{chash}.json"
    if path.is_file():
        try:
            with open(path, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_cache(chash: str, cache: dict) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{chash}.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, indent=2)


def select_questions(questions, args) -> list:
    if args.ids:
        wanted = parse_ids(args.ids)
        selected = [q for q in questions if q["id"] in wanted]
        missing = wanted - {q["id"] for q in selected}
        if missing:
            print(f"⚠ ids not found in eval set (ignored): {sorted(missing)}")
        return selected
    if args.sample:
        n = min(args.sample, len(questions))
        return random.sample(questions, n)
    return list(questions)


def build_report(results, chash, run_ts):
    counts = {"PASS": 0, "FAIL": 0, "REVIEW": 0, "ERROR": 0}
    for r in results:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1

    lines = []
    lines.append("<!-- Auto-generated by run_eval.py. Successor to the old hand-filled")
    lines.append("     baseline_results.md / postfix_results.md workflow. -->")
    lines.append("")
    lines.append(f"# RAG Eval — {run_ts:%Y-%m-%d}")
    lines.append("")
    lines.append(f"- **Config hash (short):** `{chash[:12]}`")
    lines.append(f"- **Run at:** {run_ts:%Y-%m-%d %H:%M:%S}")
    lines.append(f"- **Webhook:** {WEBHOOK_URL}")
    lines.append(f"- **Questions run:** {len(results)}")
    lines.append(
        f"- **Verdicts:** PASS {counts.get('PASS', 0)} · "
        f"FAIL {counts.get('FAIL', 0)} · REVIEW {counts.get('REVIEW', 0)} · "
        f"ERROR {counts.get('ERROR', 0)}"
    )
    lines.append("")
    lines.append(
        "Scoring is heuristic keyword-overlap triage (PASS ≥ 0.6, FAIL < 0.3, "
        "else REVIEW) — a hand-review aid, not a grader. FAIL/REVIEW/ERROR rows "
        "are sorted first."
    )
    lines.append("")
    lines.append("| id | topic | verdict | kw_match | ts_ok | question | expected | got |")
    lines.append("|---|---|---|---|---|---|---|---|")

    order = {"ERROR": 0, "FAIL": 1, "REVIEW": 2, "PASS": 3}
    for r in sorted(results, key=lambda x: (order.get(x["verdict"], 9), x["id"])):
        lines.append(
            "| {id} | {topic} | {verdict} | {kw} | {ts} | {q} | {exp} | {got} |".format(
                id=r["id"],
                topic=truncate(r["topic"], 24),
                verdict=r["verdict"],
                kw=r["kw_display"],
                ts=r["ts_ok"] or "",
                q=truncate(r["question"], 70),
                exp=truncate(r["expected"], 80),
                got=truncate(r["got"] or r.get("error", ""), 90),
            )
        )
    lines.append("")
    return "\n".join(lines)


QUESTIONS_RUN_RE = re.compile(r"^- \*\*Questions run:\*\*\s*(\d+)", re.MULTILINE)


def existing_question_count(path: Path):
    """How many questions the report already at `path` covered, or None."""
    if not path.is_file():
        return None
    m = QUESTIONS_RUN_RE.search(path.read_text(encoding="utf-8", errors="replace"))
    return int(m.group(1)) if m else None


def default_out_path(results: list, run_ts) -> Path:
    """eval_results/<date>.md, unless that would shrink an existing report.

    A narrower run (a --sample or an --ids band) gets its own suffixed file
    instead of overwriting a broader one. A run at least as wide as what is
    there may overwrite: re-running the full set is how a baseline is refreshed.
    """
    base = RESULTS_DIR / f"{run_ts:%Y-%m-%d}.md"
    previous = existing_question_count(base)
    if previous is None or len(results) >= previous:
        return base
    for suffix in (f".sample{len(results)}", *(f".sample{len(results)}.{i}" for i in range(2, 100))):
        candidate = RESULTS_DIR / f"{run_ts:%Y-%m-%d}{suffix}.md"
        if not candidate.exists():
            print(
                f"ℹ️  {base.name} already holds a {previous}-question run; "
                f"writing this {len(results)}-question run to {candidate.name} instead."
            )
            return candidate
    return base


def main():
    parser = argparse.ArgumentParser(
        description="Automated eval runner for the First Responder RAG chatbot."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--sample", type=int, metavar="N", help="Run a random N-question subset.")
    group.add_argument(
        "--ids", type=str, metavar="SPEC",
        help="Explicit id selection, e.g. '61-90', '1,5,9', or '1-10,61'.",
    )
    parser.add_argument(
        "--cache", action="store_true",
        help="Skip ids already answered for the current router-config hash; reuse prior results.",
    )
    parser.add_argument("--out", type=str, metavar="PATH", help="Override output markdown path.")
    args = parser.parse_args()

    if args.sample is not None and args.sample <= 0:
        parser.error("--sample must be a positive integer")

    chash = config_hash()
    questions = load_questions()
    selected = select_questions(questions, args)
    if not selected:
        print("No questions selected — nothing to do.")
        return

    cache = load_cache(chash) if args.cache else {}
    run_ts = datetime.now()

    print(f"▶ Running {len(selected)} question(s). config={chash[:12]} cache={'on' if args.cache else 'off'}")

    results = []
    for i, q in enumerate(selected, 1):
        qid = q["id"]
        expected = q.get("expected_answer", "")
        source = q.get("source", {}) or {}

        cached = cache.get(str(qid))
        if args.cache and cached:
            answer = cached.get("answer", "")
            error = cached.get("error")
            print(f"  [{i}/{len(selected)}] id {qid}: cached ({cached.get('verdict', '?')})")
        else:
            answer, error = ask_webhook(q["question"])
            status = "ERROR" if error else "ok"
            print(f"  [{i}/{len(selected)}] id {qid}: {status}")

        if error and not answer:
            verdict = "ERROR"
            fraction, hits, total = 0.0, 0, 0
            ts_ok = ""
        else:
            fraction, hits, total = keyword_match(expected, answer)
            verdict = verdict_for(fraction)
            ts_ok = timestamp_ok(source, answer)

        kw_display = f"{fraction:.2f} ({hits}/{total})" if total else "n/a"

        result = {
            "id": qid,
            "topic": q.get("topic", ""),
            "question": q["question"],
            "expected": expected,
            "got": answer,
            "error": error,
            "verdict": verdict,
            "kw_display": kw_display,
            "kw_fraction": round(fraction, 3),
            "ts_ok": ts_ok,
        }
        results.append(result)

        # Always write fresh results into the cache (idempotent re-runs update it).
        cache[str(qid)] = {
            "answer": answer,
            "error": error,
            "verdict": verdict,
            "kw_fraction": round(fraction, 3),
            "timestamp": run_ts.isoformat(timespec="seconds"),
        }

    save_cache(chash, cache)

    report = build_report(results, chash, run_ts)
    out_path = Path(args.out) if args.out else default_out_path(results, run_ts)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(report, encoding="utf-8")

    counts = {"PASS": 0, "FAIL": 0, "REVIEW": 0, "ERROR": 0}
    for r in results:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    print(
        f"\n✅ Wrote {out_path}  "
        f"(PASS {counts['PASS']} · FAIL {counts['FAIL']} · "
        f"REVIEW {counts['REVIEW']} · ERROR {counts['ERROR']})"
    )


if __name__ == "__main__":
    main()
