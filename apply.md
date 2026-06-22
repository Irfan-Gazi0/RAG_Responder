 Cut n8n chatbot latency — validate, then apply

 Context

 Gemini reviewed the ~30s response time on the n8n First-Responder RAG chatbot and
 suggested two fixes: (1) a "split pipeline" using a nano model to extract a snippet
 before the main model, to lower input-token weight; (2) lowering the model's
 reasoning effort. The user asked for my take, then chose "validate, then apply."

 Direct inspection of the live workflow (S3uHJF57JAuA7bL0, GET via n8n API) + recent
 execution timing settles the diagnosis:

 The model node is already gpt-5-mini at reasoningEffort: "low". Gemini's main
 suggestion is already in place. And per-node execution timing proves where the seconds go:

 ┌──────┬──────────────┬────────────────────────────┬──────────────────┬────────────────┬──────────────┐
 │ exec │ Router Agent │ OpenAI Chat Model pass(es) │  retrieval tool  │ Pinecone embed │ Postgres mem │
 ├──────┼──────────────┼────────────────────────────┼──────────────────┼────────────────┼──────────────┤
 │ 695  │ 14.6s        │ 13.6s (1 pass)             │ —                │ —              │ 0.8s         │
 ├──────┼──────────────┼────────────────────────────┼──────────────────┼────────────────┼──────────────┤
 │ 694  │ 26.9s        │ 25.8s + 3.3s (2 passes)    │ ford_mach_e 0.9s │ 0.2s           │ 0.8s         │
 ├──────┼──────────────┼────────────────────────────┼──────────────────┼────────────────┼──────────────┤
 │ 693  │ 26.2s        │ 25.0s + 4.2s (2 passes)    │ tesla 1.0s       │ 0.15s          │ 0.9s         │
 └──────┴──────────────┴────────────────────────────┴──────────────────┴────────────────┴──────────────┘

 Conclusion: latency is ~100% gpt-5-mini decode/reasoning. Retrieval, embeddings,
 and Postgres memory are all sub-second. This means:
 - Gemini #1 (reduce input tokens via a split pipeline) would do essentially nothing —
 input/retrieval is already <1s; adding a serial LLM hop would make it slower.
 - Gemini #2 (lower reasoning effort) is already applied (low). The only step lower
 is minimal. A single low pass still costs 13–26s, so the real levers are:
 (a) minimal effort, (b) a faster model (gpt-5-nano), both of which must be
 checked against answer accuracy before committing.

 There is no eval runner in the repo. eval_questions.json holds 90 QA pairs
 (CLAUDE.md's "50" is stale), each with expected_answer + source metadata, spanning
 PDF-document QA (multiple vehicle namespaces) and transcript QA (Mach-E video).

 Goal

 A/B the current config against the two viable speed levers, measuring latency and
 accuracy on the existing ground truth, then apply the fastest config that holds
 accuracy. No re-ingestion, no portal change.

 Plan

 1. Build a reusable eval harness — new file eval_latency.py (repo root)

 - Load .env (load_dotenv("/abs/path/.env"); OPENAI_API_KEY present). Python 3.11
 (or repo venv); deps requests, openai, python-dotenv.
 - Question loading: read eval_questions.json. Default to a representative ~25-Q
 subset spanning ≥6 vehicle namespaces + several transcript questions (flag
 --all to run all 90). Latency is the primary metric; the subset is a sufficient
 accuracy regression check and keeps a run to ~10–15 min.
 - Per question: POST { "question", "session_id" } to the chat webhook
 https://irfangazi.app.n8n.cloud/webhook/a7782f7b-…; use a fresh UUID session_id
 per question so Postgres chat memory doesn't carry vehicle context between items.
 Record wall-clock latency and the output.
 - Scoring (accuracy): LLM-as-judge via OpenAI (cheap model, e.g. gpt-5-nano/
 gpt-4o-mini-class) → {pass|partial|fail, reason} comparing output vs
 expected_answer. Always dump full answers to eval_results_<config>.json/CSV for
 human spot-check (judge is a screen, not the final word).
 - Output: summary per config — p50/p95 latency, pass-rate, list of regressions.

 2. Config switching — helper in the same harness (--set-config)

 Switch the live model node between runs by editing the workflow via the n8n API:
 - GET /api/v1/workflows/{id}, patch the OpenAI Chat Model node
 parameters.model.value (+ cachedResultName) and parameters.options.reasoningEffort,
 then PUT back.
 - n8n public-API PUT caveat: body must be trimmed to {name, nodes, connections, settings} — extra read-only fields (id, active, createdAt, updatedAt, tags,
 pinData…) cause a 400. After PUT, verify the workflow is still active; re-activate
 via POST /workflows/{id}/activate if needed, and re-GET to confirm the node value
 actually changed. Manual UI edit is the fallback if the PUT proves finicky.

 3. Run the matrix

 ┌──────────────┬────────────┬─────────────────┬─────────────────────────────────┐
 │    Config    │   model    │ reasoningEffort │             purpose             │
 ├──────────────┼────────────┼─────────────────┼─────────────────────────────────┤
 │ A (baseline) │ gpt-5-mini │ low             │ current state, control          │
 ├──────────────┼────────────┼─────────────────┼─────────────────────────────────┤
 │ B            │ gpt-5-mini │ minimal         │ only remaining effort step-down │
 ├──────────────┼────────────┼─────────────────┼─────────────────────────────────┤
 │ C            │ gpt-5-nano │ minimal         │ fastest candidate               │
 └──────────────┴────────────┴─────────────────┴─────────────────────────────────┘

 For each: set config → wait for activation → run harness → save results. (Optional D:
 gpt-5-nano/low if C regresses accuracy but B is too slow.)

 4. Decide + apply

     │                                                                                                                                                             │
     │ For each: set config → wait for activation → run harness → save results. (Optional D:                                                                       │
     │ gpt-5-nano/low if C regresses accuracy but B is too slow.)                                                                                                  │
     │                                                                                                                                                             │
     │ 4. Decide + apply                                                                                                                                           │
     │                                                                                                                                                             │
     │ Pick the fastest config whose pass-rate is within tolerance of baseline (no                                                                                 │
     │ new failures on safety-critical items — those are reviewed manually, not just by judge).                                                                    │
     │ Apply it via step 2 and re-GET to confirm. Leave baseline-equivalent if nothing holds.                                                                      │
     │                                                                                                                                                             │
     │ Files                                                                                                                                                       │
     │                                                                                                                                                             │
     │ - New: eval_latency.py (harness + config switcher) and eval_results_*.json (gitignored output).                                                             │
     │ - No code changes to portal/ingestion. The only production change is the live n8n                                                                           │
     │ model-node config (model + reasoningEffort), applied via API in step 4.                                                                                     │
     │                                                                                                                                                             │
     │ Verification                                                                                                                                                │
     │                                                                                                                                                             │
     │ - Harness self-check: a single --smoke question returns an output and a latency number.                                                                     │
     │ - Confidence in the diagnosis: re-pull /executions?includeData=true after the chosen                                                                        │
     │ config is live and confirm OpenAI Chat Model per-pass time dropped vs the 13–26s baseline.                                                                  │
     │ - Accuracy gate: chosen config's pass-rate ≥ baseline on the subset, with manual review of                                                                  │
     │ any safety-critical (HV disconnect, no-cut zone, fire) answers.                                                                                             │
     │                                                                                                                                                             │
     │ Parked (not in scope — bigger lifts, noted for the user)                                                                                                    │
     │                                                                                                                                                             │
     │ - Two LLM passes per answer is structural to the agent (route turn + answer turn);                                                                          │
     │ the heavy pass is ~25s. Collapsing to one pass (deterministic retrieval feeding a single                                                                    │
     │ generation, or a cheap classifier for vehicle ID) is the largest possible win but a                                                                         │
     │ rewrite.                                                                                                                                                    │
     │ - Perceived latency / streaming: the portal does one blocking POST and waits for the                                                                        │
     │ full {output} ("Respond to Webhook"); no token streaming. True streaming through n8n                                                                        │
     │ is non-trivial. Out of scope here.                                                                                                                          │
     │ - Gemini's split-pipeline idea is repurposed, not adopted: if token cost (not                                                                               │
     │ latency) ever matters, trim at retrieval time (top_k/chunk size), no extra LLM hop.   