"""
Drift-checker for the live n8n Router workflow (S3uHJF57JAuA7bL0).

Compares the live n8n workflow's Router Agent config against the canonical
documented production state in n8n_router_config.md + the constants below, so
config drift on the live workflow is caught before it reaches a professor.

Invariants checked (all READ-ONLY under --check):
  1. topK == 10 on every vectorStorePinecone node (expected: 14 such nodes)
  2. Router model == claude-sonnet-4-6 (Anthropic Chat Model node)
  3. maxIterations == 10 on the Router Agent node
  4. Live systemMessage matches section 1 of n8n_router_config.md (sha256 of
     whitespace-normalized text; unified diff printed on mismatch)
  5. Live tool descriptions match section 2 of n8n_router_config.md

Invariant 5 was added 2026-08-29 after finding that --push had never actually
applied a tool description. These are `mode: retrieve-as-tool` nodes, whose
description lives at `parameters.toolDescription`; the push wrote
`parameters.description`, which n8n ignores for this node type. It reported
"description: updated for X" on all 14 nodes every run, and changed nothing.
The tool description IS the routing prompt, so that was the one field where
silent drift was guaranteed to go unnoticed.

n8n public API: GET/PUT {base}/workflows/{id} with X-N8N-API-KEY header.
Reads N8N_API_KEY from the repo-root .env (resolved via __file__, any cwd) (same .env-loading pattern as
deploy_portal_v2.py). Stdlib-only HTTP (urllib) — no requests / jq / aws CLI.

NOTE: n8n_router_config.md's *header text* is stale (it says "Opus 4.8"), but
CLAUDE.md states production is claude-sonnet-4-6 as of 2026-06-24 — this script
trusts claude-sonnet-4-6 (see EXPECTED_ROUTER_MODEL).

Usage:
  python3 n8n_sync.py                 # same as --check (read-only drift report)
  python3 n8n_sync.py --check         # explicit read-only drift check (CI-friendly, non-zero exit on FAIL)
  python3 n8n_sync.py --push          # DRY RUN: print what --push WOULD change, then exit
  python3 n8n_sync.py --push --yes    # actually apply doc section 1+2 to the live workflow via PUT
"""

import argparse
import difflib
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(str(REPO_ROOT / ".env"))

# --- Configuration / constants ------------------------------------------------

API_BASE = "https://irfangazi.app.n8n.cloud/api/v1"
WORKFLOW_ID = "S3uHJF57JAuA7bL0"
CONFIG_MD = Path(__file__).parent / "n8n_router_config.md"

# Production router model as of 2026-06-24 (CLAUDE.md). The n8n_router_config.md
# header still says "Opus 4.8" but that text is stale — trust this constant.
EXPECTED_ROUTER_MODEL = "claude-sonnet-4-6"
EXPECTED_TOPK = 10
EXPECTED_MAX_ITERATIONS = 10
EXPECTED_PINECONE_TOOL_COUNT = 14

PINECONE_NODE_TYPE = "@n8n/n8n-nodes-langchain.vectorStorePinecone"
ANTHROPIC_NODE_NAME = "Anthropic Chat Model"

# ANSI-free status prefixes that still read green/red in most terminals.
GREEN = "\033[32m"
RED = "\033[31m"
RESET = "\033[0m"


def pass_tag() -> str:
    return f"{GREEN}[PASS]{RESET}"


def fail_tag() -> str:
    return f"{RED}[FAIL]{RESET}"


# --- .env / API key -----------------------------------------------------------

def get_api_key() -> str:
    key = os.getenv("N8N_API_KEY")
    if not key:
        print(
            "❌ N8N_API_KEY is not set. Add it to the repo-root .env, e.g.\n"
            "   N8N_API_KEY=<your n8n public API key>\n"
            "   (get it from n8n → Settings → n8n API)."
        )
        sys.exit(2)
    return key


# --- HTTP helpers (stdlib only) -----------------------------------------------

def _request(method: str, url: str, api_key: str, body: dict | None = None) -> dict:
    data = None
    headers = {"X-N8N-API-KEY": api_key, "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8")
        except Exception:
            pass
        print(f"❌ HTTP {e.code} on {method} {url}\n{detail}")
        sys.exit(3)
    except urllib.error.URLError as e:
        print(f"❌ Network error on {method} {url}: {e.reason}")
        sys.exit(3)
    return json.loads(raw) if raw else {}


def get_workflow(api_key: str) -> dict:
    return _request("GET", f"{API_BASE}/workflows/{WORKFLOW_ID}", api_key)


def put_workflow(api_key: str, body: dict) -> dict:
    return _request("PUT", f"{API_BASE}/workflows/{WORKFLOW_ID}", api_key, body)


# --- n8n_router_config.md parsing --------------------------------------------

def _read_config_md() -> str:
    if not CONFIG_MD.is_file():
        print(f"❌ {CONFIG_MD} not found — cannot compare against canonical config.")
        sys.exit(2)
    return CONFIG_MD.read_text(encoding="utf-8")


def extract_doc_system_message(md: str) -> str:
    """Return the fenced code block under '## 1. Router Agent — System Message'."""
    # Grab everything from the section-1 header up to the next '## ' header.
    sec = re.search(
        r"##\s*1\.\s*Router Agent[^\n]*\n(.*?)(?:\n##\s|\Z)",
        md,
        re.DOTALL,
    )
    if not sec:
        print("❌ Could not find section '## 1. Router Agent — System Message'.")
        sys.exit(2)
    block = re.search(r"```[^\n]*\n(.*?)```", sec.group(1), re.DOTALL)
    if not block:
        print("❌ Could not find fenced code block under section 1.")
        sys.exit(2)
    return block.group(1)


def extract_doc_tool_descriptions(md: str) -> dict:
    """Map namespace -> description from '## 2.' per-namespace fenced blocks.

    Each block is preceded by a '### <namespace>' header. The video block header
    is '### video_transcript (video_transcript_v2 namespace) — ...' so we take
    the first whitespace-delimited token after '###' as the namespace key.
    """
    sec = re.search(r"##\s*2\.[^\n]*\n(.*)\Z", md, re.DOTALL)
    if not sec:
        print("❌ Could not find section '## 2.' (tool descriptions).")
        sys.exit(2)
    body = sec.group(1)
    descriptions: dict = {}
    for m in re.finditer(
        r"###\s+([A-Za-z0-9_]+)[^\n]*\n```[^\n]*\n(.*?)```",
        body,
        re.DOTALL,
    ):
        namespace = m.group(1).strip()
        descriptions[namespace] = m.group(2).strip("\n")
    return descriptions


# --- Normalization / hashing --------------------------------------------------

def normalize_text(text: str) -> str:
    """Normalize line endings, strip trailing spaces per line, drop leading/
    trailing blank lines. Used before hashing/diffing so cosmetic whitespace
    drift does not register as a real change."""
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    lines = [ln.rstrip() for ln in lines]
    while lines and lines[0] == "":
        lines.pop(0)
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# --- Node accessors -----------------------------------------------------------

def find_pinecone_nodes(nodes: list) -> list:
    return [n for n in nodes if n.get("type") == PINECONE_NODE_TYPE]


def find_agent_node(nodes: list) -> dict | None:
    for n in nodes:
        if "langchain.agent" in n.get("type", ""):
            return n
    return None


def find_anthropic_node(nodes: list) -> dict | None:
    # Prefer exact node name; fall back to type match.
    for n in nodes:
        if n.get("name") == ANTHROPIC_NODE_NAME:
            return n
    for n in nodes:
        if "lmChatAnthropic" in n.get("type", ""):
            return n
    return None


def get_router_model(anthropic_node: dict) -> str | None:
    params = anthropic_node.get("parameters", {})
    model = params.get("model")
    if isinstance(model, dict):
        return model.get("value")
    if isinstance(model, str):
        return model
    return None


def get_system_message(agent_node: dict) -> str | None:
    return agent_node.get("parameters", {}).get("options", {}).get("systemMessage")


def get_max_iterations(agent_node: dict):
    return agent_node.get("parameters", {}).get("options", {}).get("maxIterations")


# --- Invariant checks (READ-ONLY) --------------------------------------------

def check_invariants(workflow: dict, doc_system_message: str, doc_tool_desc: dict) -> bool:
    nodes = workflow.get("nodes", [])
    all_pass = True

    print("=" * 72)
    print(f"n8n drift check — workflow {WORKFLOW_ID} ({workflow.get('name', '?')})")
    print("=" * 72)

    # --- Invariant 1: topK == 10 on all Pinecone nodes ---
    print("\nInvariant 1 — topK == 10 on every vectorStorePinecone node")
    pine = find_pinecone_nodes(nodes)
    inv1_ok = True
    for n in pine:
        topk = n.get("parameters", {}).get("topK")
        ok = topk == EXPECTED_TOPK
        inv1_ok = inv1_ok and ok
        tag = pass_tag() if ok else fail_tag()
        print(f"  {tag} {n.get('name', '?'):<32} topK={topk}")
    count_ok = len(pine) == EXPECTED_PINECONE_TOOL_COUNT
    inv1_ok = inv1_ok and count_ok
    tag = pass_tag() if count_ok else fail_tag()
    print(f"  {tag} node count = {len(pine)} (expected {EXPECTED_PINECONE_TOOL_COUNT})")
    print(f"  => Invariant 1: {pass_tag() if inv1_ok else fail_tag()}")
    all_pass = all_pass and inv1_ok

    # --- Invariant 2: router model ---
    print(f"\nInvariant 2 — router model == {EXPECTED_ROUTER_MODEL}")
    anth = find_anthropic_node(nodes)
    if anth is None:
        print(f"  {fail_tag()} No Anthropic chat model node found.")
        inv2_ok = False
    else:
        model = get_router_model(anth)
        inv2_ok = model == EXPECTED_ROUTER_MODEL
        tag = pass_tag() if inv2_ok else fail_tag()
        print(f"  {tag} {anth.get('name', '?')} model={model}")
    print(f"  => Invariant 2: {pass_tag() if inv2_ok else fail_tag()}")
    all_pass = all_pass and inv2_ok

    # --- Invariant 3: maxIterations == 10 on Router Agent ---
    print(f"\nInvariant 3 — maxIterations == {EXPECTED_MAX_ITERATIONS} on Router Agent")
    agent = find_agent_node(nodes)
    if agent is None:
        print(f"  {fail_tag()} No langchain.agent node found.")
        inv3_ok = False
    else:
        mi = get_max_iterations(agent)
        inv3_ok = mi == EXPECTED_MAX_ITERATIONS
        tag = pass_tag() if inv3_ok else fail_tag()
        print(f"  {tag} {agent.get('name', '?')} maxIterations={mi}")
    print(f"  => Invariant 3: {pass_tag() if inv3_ok else fail_tag()}")
    all_pass = all_pass and inv3_ok

    # --- Invariant 4: system prompt hash match ---
    print("\nInvariant 4 — live systemMessage matches n8n_router_config.md section 1")
    if agent is None:
        print(f"  {fail_tag()} No Router Agent node — cannot read systemMessage.")
        inv4_ok = False
    else:
        live_msg = get_system_message(agent)
        if live_msg is None:
            print(f"  {fail_tag()} Router Agent has no options.systemMessage.")
            inv4_ok = False
        else:
            live_norm = normalize_text(live_msg)
            doc_norm = normalize_text(doc_system_message)
            live_hash = sha256(live_norm)
            doc_hash = sha256(doc_norm)
            inv4_ok = live_hash == doc_hash
            print(f"  doc  sha256={doc_hash}  ({len(doc_norm)} chars, {len(live_msg)} raw live)")
            print(f"  live sha256={live_hash}")
            if inv4_ok:
                print(f"  {pass_tag()} system message matches")
            else:
                print(f"  {fail_tag()} system message DRIFTED — unified diff (doc vs live):")
                diff = difflib.unified_diff(
                    doc_norm.splitlines(),
                    live_norm.splitlines(),
                    fromfile="n8n_router_config.md (doc)",
                    tofile="live workflow systemMessage",
                    lineterm="",
                )
                for line in diff:
                    print(f"    {line}")
    print(f"  => Invariant 4: {pass_tag() if inv4_ok else fail_tag()}")
    all_pass = all_pass and inv4_ok

    # --- Invariant 5: tool descriptions match section 2 ---
    # The tool description IS the routing prompt: the agent picks a tool by
    # reading it. A corpus mis-described there mis-routes every question that
    # depends on it, and nothing else in this file would notice.
    print("\nInvariant 5 — live tool descriptions match n8n_router_config.md section 2")
    inv5_ok = True
    for n in pine:
        key = doc_key_for(n, doc_tool_desc)
        if key is None:
            print(f"  {fail_tag()} {n.get('name', '?'):<32} no section-2 block for this node")
            inv5_ok = False
            continue
        live = get_tool_description(n)
        ok = normalize_text(live or "") == normalize_text(doc_tool_desc[key])
        inv5_ok = inv5_ok and ok
        print(f"  {pass_tag() if ok else fail_tag()} {n.get('name', '?'):<32} "
              f"[{_description_field(n)}] {'matches' if ok else 'DRIFTED'}")
    print(f"  => Invariant 5: {pass_tag() if inv5_ok else fail_tag()}")
    all_pass = all_pass and inv5_ok

    print("\n" + "=" * 72)
    print(f"OVERALL: {pass_tag() if all_pass else fail_tag()}")
    print("=" * 72)
    return all_pass


# --- Push (write) -------------------------------------------------------------

# Public-API-allowed subset of settings. PUT /workflows/{id} rejects extra
# settings props (e.g. callerPolicy, timezone saved on the live workflow), so we
# send only executionOrder and let n8n re-apply its internal defaults.
ALLOWED_SETTINGS_KEYS = {"executionOrder"}


def trim_settings(settings: dict) -> dict:
    out = {k: v for k, v in (settings or {}).items() if k in ALLOWED_SETTINGS_KEYS}
    out.setdefault("executionOrder", "v1")
    return out


def _tool_node_keys(node: dict) -> list:
    """Doc-key candidates for a Pinecone tool node, best first.

    The live nodes carry the namespace at `parameters.options.pineconeNamespace`
    (not `parameters.pineconeNamespace`), and the transcript node's namespace is
    `video_transcript_v2` while the doc block is headed `video_transcript` — so
    try the namespace, then the node name. Every other node has the two equal.
    """
    params = node.get("parameters", {})
    keys = []
    for ns in (params.get("options", {}) or {}).get("pineconeNamespace"), params.get("pineconeNamespace"):
        if isinstance(ns, dict):
            ns = ns.get("value")
        if isinstance(ns, str) and ns.strip():
            keys.append(ns.strip())
    name = node.get("name", "").strip().lower().replace(" ", "_")
    if name:
        keys.append(name)
    return keys


def doc_key_for(node: dict, doc_tool_desc: dict) -> str | None:
    """The section-2 block that governs this node, or None if it has no block."""
    for k in _tool_node_keys(node):
        if k in doc_tool_desc:
            return k
    return None


def _description_field(node: dict) -> str:
    """Where THIS node type keeps its tool description.

    `retrieve-as-tool` mode puts it at parameters.toolDescription. Writing
    parameters.description on such a node is accepted by the API and ignored by
    n8n - which is exactly how 14 tool descriptions went unpushed.
    """
    mode = node.get("parameters", {}).get("mode")
    return "toolDescription" if mode == "retrieve-as-tool" else "description"


def get_tool_description(node: dict) -> str | None:
    return node.get("parameters", {}).get(_description_field(node))


def plan_push(workflow: dict, doc_system_message: str, doc_tool_desc: dict) -> tuple[dict, list]:
    """Return (patched_workflow_body, list_of_change_strings) WITHOUT sending it."""
    nodes = workflow.get("nodes", [])
    changes: list = []

    # Router model
    anth = find_anthropic_node(nodes)
    if anth is not None:
        cur = get_router_model(anth)
        if cur != EXPECTED_ROUTER_MODEL:
            model = anth.setdefault("parameters", {}).get("model")
            if isinstance(model, dict):
                model["value"] = EXPECTED_ROUTER_MODEL
            else:
                anth["parameters"]["model"] = EXPECTED_ROUTER_MODEL
            changes.append(f"model: {cur} -> {EXPECTED_ROUTER_MODEL} ({anth.get('name')})")

    # Agent: systemMessage + maxIterations
    agent = find_agent_node(nodes)
    if agent is not None:
        opts = agent.setdefault("parameters", {}).setdefault("options", {})
        cur_msg = opts.get("systemMessage")
        if normalize_text(cur_msg or "") != normalize_text(doc_system_message):
            opts["systemMessage"] = doc_system_message
            changes.append("systemMessage: updated to n8n_router_config.md section 1")
        if opts.get("maxIterations") != EXPECTED_MAX_ITERATIONS:
            changes.append(
                f"maxIterations: {opts.get('maxIterations')} -> {EXPECTED_MAX_ITERATIONS}"
            )
            opts["maxIterations"] = EXPECTED_MAX_ITERATIONS

    # Pinecone nodes: topK + descriptions
    for n in find_pinecone_nodes(nodes):
        params = n.setdefault("parameters", {})
        if params.get("topK") != EXPECTED_TOPK:
            changes.append(f"topK: {params.get('topK')} -> {EXPECTED_TOPK} ({n.get('name')})")
            params["topK"] = EXPECTED_TOPK
        key = doc_key_for(n, doc_tool_desc)
        if key:
            field = _description_field(n)
            cur_desc = params.get(field)
            if normalize_text(cur_desc or "") != normalize_text(doc_tool_desc[key]):
                params[field] = doc_tool_desc[key]
                changes.append(f"{field}: updated for {key} ({n.get('name')})")
            # Clean up the dead field earlier versions of this script wrote.
            if field != "description" and "description" in params:
                params.pop("description")
                changes.append(f"description: removed dead field on {n.get('name')}")

    body = {
        "name": workflow.get("name"),
        "nodes": nodes,
        "connections": workflow.get("connections", {}),
        "settings": trim_settings(workflow.get("settings", {})),
    }
    return body, changes


def do_push(api_key: str, confirmed: bool) -> int:
    workflow = get_workflow(api_key)
    md = _read_config_md()
    doc_msg = extract_doc_system_message(md)
    doc_tool_desc = extract_doc_tool_descriptions(md)

    body, changes = plan_push(workflow, doc_msg, doc_tool_desc)

    if not changes:
        print("✅ Live workflow already matches the doc + constants — nothing to push.")
        return 0

    print("The following changes would be applied to the live workflow:")
    for c in changes:
        print(f"  • {c}")

    if not confirmed:
        print(
            "\n(DRY RUN — no changes sent. Re-run with `--push --yes` to apply.)"
        )
        return 0

    print(f"\n🚀 Pushing {len(changes)} change(s) via PUT /workflows/{WORKFLOW_ID} …")
    put_workflow(api_key, body)
    print("✅ PUT succeeded. Re-run `python3 n8n_sync.py --check` to verify.")
    return 0


# --- main ---------------------------------------------------------------------

def do_check(api_key: str) -> int:
    workflow = get_workflow(api_key)
    md = _read_config_md()
    doc_msg = extract_doc_system_message(md)
    doc_tool_desc = extract_doc_tool_descriptions(md)
    ok = check_invariants(workflow, doc_msg, doc_tool_desc)
    return 0 if ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Drift-checker / config-pusher for the live n8n Router workflow.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python3 n8n_sync.py                 # read-only drift check (default)\n"
            "  python3 n8n_sync.py --check         # explicit read-only check (CI: non-zero on FAIL)\n"
            "  python3 n8n_sync.py --push          # dry run: print what --push would change\n"
            "  python3 n8n_sync.py --push --yes    # apply doc section 1+2 to the live workflow\n"
        ),
    )
    parser.add_argument("--check", action="store_true", help="Read-only drift check (default).")
    parser.add_argument("--push", action="store_true", help="Apply doc config to live workflow (dry run without --yes).")
    parser.add_argument("--yes", action="store_true", help="Confirm an actual --push write (otherwise --push is a dry run).")
    args = parser.parse_args()

    api_key = get_api_key()

    if args.push:
        sys.exit(do_push(api_key, confirmed=args.yes))
    else:
        # Default and --check both do the read-only check.
        sys.exit(do_check(api_key))


if __name__ == "__main__":
    main()
