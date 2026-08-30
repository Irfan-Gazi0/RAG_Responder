# EV First-Responder Q&A — n8n RAG Webhook vs. graphify Knowledge Graph

Each question below was sent to the live systems and the outputs placed side by side. The set is now **24 questions**: the original 22, **minus** the 3 out-of-scope refusals (replaced by 5 vehicle-specific ones at the end), **plus** a vehicle-named **retest** added to each of the 16 originally-deferred questions:

- **n8n RAG webhook** — the live chat workflow (`...a7782f7b...`, router fixed 2026-06-22). 
  Returns a synthesized natural-language answer from Pinecone retrieval over the per-vehicle ERG/Rescue-Sheet corpus. Each question used a fresh `session_id` (no conversational carry-over).
- **graphify graph** — local knowledge graph (`graphify-out/graph.json`) built from the same repo. 
  Returns a BFS traversal: which concept nodes and source PDFs it connects the question to. It does **not** synthesize prose — it shows *what the corpus knows and where it lives*.

> **How to read this:** the webhook column is the answer a responder would actually receive. The graphify column is a provenance/coverage check — it shows which source documents and concepts back (or fail to back) that answer.

_Generated 2026-06-22 · updated 2026-06-22 with vehicle-named retests · 24 questions · 0 errors._

---

## Scorecard

**The decisive variable was always whether the question named a vehicle.** The router (fixed 2026-06-22) is deliberately built to *not* give model-specific procedures without a confirmed make/model/year. The original 22-question run proved that policy dominates the result; the **retest** (below) then confirmed it directly by re-asking the 16 deferred questions with a vehicle named.

### Original run (no vehicle named)

| Webhook outcome | Count | Questions |
|---|---:|---|
| 🟢 **Grounded answer** (cited a specific source) | 3 | Q15, Q16, Q20 |
| 🟡 **Generic deferral** (gave a generic safety baseline, asked which vehicle) | 16 | Q1–Q3, Q5–Q10, Q12–Q14, Q17–Q19, Q21 |
| 🔴 **Out-of-scope refusal** (declined as outside the corpus) | 3 | Q4, Q11, Q22 |

All 3 originally-grounded answers routed to the same source — the Ford Mach-E 2026 First-Responder training video — the only vehicle-agnostic source the router would draw on, and it did so inconsistently.

### Retest run (same questions, vehicle named) — the headline result

Each of the 16 deferred questions was re-asked once with a supported vehicle named in the prompt (spread across **all 13 vehicles**). Every one flipped off the deferral path:

| Retest outcome | Count | Questions (vehicle) |
|---|---:|---|
| 🟢 **Grounded, source-cited** | 14 | Q1 (BMW iX3), Q2 (Lyriq), Q3 (Blazer EV), Q5 (Bolt EV), Q6 (Equinox EV), Q7 (F-150 Lightning), Q9 (Zevo 600), Q12 (Ariya), Q13 (R1T), Q14 (Model S), Q17 (ID.4), Q18 (Mach-E), Q19 (R1T), Q21 (Model S) |
| 🟡 **Grounded correction** (gave the documented HV-shutdown method + honest "no such feature in source") | 2 | Q8, Q10 (both Hyundai IONIQ 5) |

**Two takeaways from the retest:**
1. **Deferral was policy-bound, not knowledge-bound — proven, not just argued.** Naming the vehicle unlocked detailed, page-cited procedures (12V locations, cut-loop/service-disconnect steps, no-cut zones, water volumes, storage standoffs) across all 13 vehicles. Nothing changed but the wording.
2. **The "Emergency Plug" questions (Q8/Q10) exposed a real data gap.** The original run *assumed* the Emergency Plug belonged to the Hyundai IONIQ 5. The grounded retest shows the IONIQ 5 2025 ERG/Rescue Sheet contain **no "Emergency Plug" feature and no green/blue/red light legend** — the bot correctly refused to invent a color code and instead returned the documented **High-Voltage Cut-Off Switch** procedure. The Emergency-Plug terminology likely originates in the training video, not the IONIQ corpus.

### Out-of-scope refusals — removed and replaced

The 3 refusals (Q4 BEV-vs-PHEV, Q11 thermal-runaway chemistry, Q22 Level-3 charger arc-flash) were genuinely outside the vehicle corpus. They've been **removed** and replaced with **5 vehicle-specific questions** (topics mined from the graphify graph) in the new section at the end — all 5 returned grounded, source-cited answers (R1 IONIQ 5 HV disconnect, R2 R1T lifting points, R3 ID.4 cut/no-cut zones, R4 Blazer EV airbag/pretensioner locations, R5 Ariya HV shutdown).

### Per-question detail (original run)

| Q | Topic | Webhook (original) | Vehicle-named retest |
|---|---|---|---|
| 1 | Identify EV/hybrid at scene | 🟡 Generic | 🟢 Grounded (BMW iX3 2027) |
| 2 | On its side, no badges | 🟡 Generic | 🟢 Grounded (Cadillac Lyriq 2023) |
| 3 | Green "Ready" light | 🟡 Generic | 🟢 Grounded (Chevrolet Blazer EV 2024; no color callout in source) |
| 5 | Simplest immobilize/HV-disable | 🟡 Generic | 🟢 Grounded (Chevrolet Bolt EV 2022) |
| 6 | Why kill 12V; where is it | 🟡 Generic | 🟢 Grounded (Chevrolet Equinox EV 2024) |
| 7 | Cut loops / C-pillar | 🟡 Generic | 🟢 Grounded (Ford F-150 Lightning 2026) |
| 8 | Emergency Plug mechanism | 🟡 Generic | 🟡 Grounded correction (Hyundai IONIQ 5 — no such feature in source) |
| 9 | Cut orange HV cables? | 🟡 Generic | 🟢 Grounded (GM BrightDrop Zevo 600 2024) |
| 10 | Emergency Plug light colors | 🟡 Generic | 🟡 Grounded correction (Hyundai IONIQ 5 — no light legend in source) |
| 12 | Let-burn vs suppress | 🟡 Generic | 🟢 Grounded (Nissan Ariya 2026 — calls for *active* suppression) |
| 13 | Gallons of water | 🟡 Generic | 🟢 Grounded (Rivian R1T 2025 — 2,000–3,000 gal) |
| 14 | Water onto sealed cells | 🟡 Generic | 🟢 Grounded (Tesla Model S 2021) |
| 17 | Struts / pretensioners | 🟡 Generic | 🟢 Grounded (Volkswagen ID.4 2025) |
| 18 | Storage perimeters | 🟡 Generic | 🟢 Grounded (Ford Mustang Mach-E 2026 — 50 ft / 15 m) |
| 19 | Submerged HV shock risk | 🟡 Generic | 🟢 Grounded (Rivian R1T 2025 — no shock risk) |
| 21 | Cut DC fast-charge cable? | 🟡 Generic | 🟢 Grounded (Tesla Model S 2021) |
| 15 | Fire blankets ineffective | 🟢 **Grounded** (Mach-E video) | — already grounded |
| 16 | Laminate glass / carbon fiber | 🟢 **Grounded** (Mach-E video + ERG) | — already grounded |
| 20 | Charger fire risks | 🟢 **Grounded** (Mach-E video) | — already grounded |
| ~~4~~ | ~~BEV vs PHEV vs HEV~~ | 🔴 Out-of-scope → **removed** | replaced by R-series |
| ~~11~~ | ~~Why thermal runaway~~ | 🔴 Out-of-scope → **removed** | replaced by R-series |
| ~~22~~ | ~~Level-3 comms / arc flash~~ | 🔴 Out-of-scope → **removed** | replaced by R-series |

> **Practical takeaway for the demo:** prefix every question with a supported vehicle (e.g. "On a *Ford Mach-E 2026*, is it safe to cut the orange cables?"). The vehicle-agnostic phrasing exercises the router's *deferral* path — working as designed, but it makes the bot look evasive. The retest column shows what a responder actually gets the moment a make/model/year is on the table.

---

## Scene Arrival & Vehicle Identification

### Q1. How can I quickly identify if a vehicle is an EV or hybrid when arriving at a crash scene?

> **🔁 Vehicle-named retest:** *"I've just rolled up on a crash — how do I quickly confirm a BMW iX3 2027 is a full EV and not a gas model?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (BMW iX3 2027)**

**BMW iX3 2027**

⚠️ **Safety first:** Treat this vehicle as energized at all times. The absence of engine noise does NOT mean it's off — it can move quietly or restart until fully shut down. Wear appropriate PPE and keep clear of high-voltage components.

**How to quickly confirm it's a full EV (BEV):**

- **Model badging** — Look for the **"iX3"** model designation. The "i" badging denotes a fully electric BMW.
- **Charge port** — There is a **high-voltage charging socket on the right rear side panel**. A charging socket (and no fuel filler) confirms it is a full EV.
- **No exhaust / fuel filler** — A BEV will have no tailpipe and no gasoline fuel-fill door.
- **Display warnings** — The instrument/display cluster will show high-voltage status; airbag deployment indicates the HV system has been deactivated.

Source: Rescue Sheet p.1–2

Once you've confirmed it's the iX3 2027, let me know if you'd like the HV shutdown procedure, battery/cut locations, or extrication access — I can pull those next.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I don't yet know which specific vehicle you're dealing with, so here's generic interim guidance while we confirm.

**GENERIC — confirm vehicle before relying on this:**

How to quickly identify an EV or hybrid at a crash scene:
- **Badging/emblems:** Look for "EV," "Electric," "e-," "Plug-in," "Hybrid," "PHEV," or model-specific electric badges on the fenders, doors, tailgate, or grille.
- **Charge port:** Look for a charging door/port (often on a front fender, rear quarter panel, or front grille area) instead of — or in addition to — a fuel filler door.
- **No tailpipe / no exhaust:** Pure EVs have no exhaust pipe. No engine noise and no exhaust heat/odor is a strong indicator.
- **Orange cabling:** High-voltage cables and components are color-coded **orange** — visible under the hood, beneath the vehicle, or in exposed/damaged areas.
- **Underbody battery pack:** Many EVs have a large, flat, skateboard-style battery pack along the floor between the axles.
- **Dash/instrument cluster:** "READY" indicator, power/charge gauge instead of an RPM tachometer, or EV-specific displays.
- **Quiet operation:** The vehicle may be powered on and silent — assume it can move at any time.

Baseline EV-incident safety actions:
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Treat the vehicle as energized at all times.
- Locate and isolate the high-voltage disconnect and the 12V battery.
- Wear insulated PPE rated for HV work.
- Do NOT use a dry-chemical extinguisher on a lithium-ion battery fire; cool with copious water for an extended period.
- Watch for stranded energy and delayed re-ignition.

*This is generic guidance only and is not specific to any model.*

To give you exact, vehicle-specific identification and procedures, **please confirm the make, model, and year.** Here are the vehicles I currently support:
- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'Vehicle Identification / Recognition' · 11 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- Fire Suppression / Li-Ion Battery Fire Guidance
- High Voltage Disconnect / Service Disconnect
- 12V / Low Voltage Battery
- Tesla Model S 2021 Rescue Sheet
- First Responder Cut Loop / Cable Cut
- Immobilization / Stabilization / Lifting Points
- Nissan Ariya 2026 ERG
- Tesla Model S 2021 ERG
- Airbag / SRS Components (inflators, pretensioners, control unit)
- Vehicle Identification / Recognition

Source documents:
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`

---

### Q2. If a vehicle is on its side and I cannot see the exterior badges, what other visual clues or dash indicators can I look for?

> **🔁 Vehicle-named retest:** *"I've got a Cadillac Lyriq 2023 flipped on its side and can't see any badges — what dash indicators or other clues tell me it's electric?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Cadillac Lyriq 2023)**

**Cadillac Lyriq 2023**

⚠️ **Safety first:** Lack of engine noise does NOT mean the vehicle is off — it can still move under power until fully shut down. Treat it as energized, chock/block the wheels, and wear appropriate PPE. Do NOT cut any orange high-voltage cables.

Since the badges aren't visible on the flipped vehicle, here are the clues that confirm it's electric:

**Dash / interior indicators**
- **No tachometer / no engine RPM gauge** — the instrument cluster shows EV-style displays (battery state-of-charge, range, power/regen gauge) instead of an engine tach.
- **No engine start sounds or idle** — silent when "on."
- **Shift control:** the Lyriq uses a **shift lever with a button at the end** to select P (Park) — press it to shift to Park as part of immobilizing.
- **Power button (2023–2025 models):** located on top of the shift lever — pressing it powers the vehicle off.
- **OnStar-equipped** infotainment system.

**Labels and physical clues (if you can reach them)**
- **First Responder Information Label / Battery Warning Label** — located under the hood near the first-responder cut loop. This is the most definitive on-vehicle confirmation.
- **High-voltage battery pack mounted under the floor** — it is a structural part of the floor pan, visible as a large skid-plate/pack running the length of the underbody (the vehicle is on its side, so this may be visible to you).
- **Orange high-voltage cables** routed along the underbody.
- **Charge port** instead of a fuel filler door.
- **No exhaust pipe / no engine** in the front compartment (frunk-style underhood layout with the first-responder cut loop, not an internal-combustion engine).

**Procedural cue:** When you do gain access, the presence of a **first responder cut loop** (yellow-taped loop under the front compartment sight shield) and orange HV cabling confirms HV architecture.

Source: Rescue Sheet p.1–2; ERG p.3, p.5

**Important note for this vehicle:** Do NOT disable the 12V battery as your means of immobilizing — the Lyriq's 12V battery management system provides thermal-runaway alert and mitigation. To disable high voltage, cut the first responder cut loop (then wait at least 1 minute for HV energy to discharge).

Want me to walk you through the HV shutdown / first-responder cut-loop procedure, or stabilization for a vehicle on its side?

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I can't determine which specific vehicle you're dealing with from your question, so here's interim generic guidance while we narrow it down.

**GENERIC — confirm vehicle before relying on this:**
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Treat the vehicle as energized at all times.
- Locate and isolate the high-voltage disconnect/service disconnect and the 12V battery.
- Wear insulated PPE rated for HV work.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire; cool with copious water for an extended period.
- Watch for stranded energy and delayed re-ignition; monitor the pack after the fire is out.

**General visual clues for identifying a vehicle when badges aren't visible:**
- **VIN plate** — Look at the base of the windshield (driver's side) or the driver's door jamb. The VIN identifies make, model, and year and is the most reliable confirmation.
- **License plate** — Can be run through dispatch to return make/model/year.
- **Dash/cluster indicators** — Many EVs display a distinctive startup logo or an "EV/Ready" indicator; instrument layout and infotainment screen style can hint at the manufacturer.
- **Charge port** — Presence and location of a charge port (front fender, rear quarter, front fascia) indicates an EV and can help with make.
- **Badging in other spots** — Steering wheel center, wheel center caps, brake calipers, seats/headrests, and door sill plates often carry the manufacturer logo.
- **Body shape and lighting signature** — Headlight/taillight patterns and overall silhouette are often brand-distinctive.

This is generic guidance only and is **not** model-specific.

To give you accurate, source-based information (HV disconnect points, no-cut zones, lifting/stabilization for a vehicle on its side, etc.), please **confirm the make, model, and year**. I support:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022-2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022-2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'look-controls.ts', 'Vehicle Identification / Recognition', 'thermal runaway / let-it-burn fire strategy' · 32 nodes reached._

Concepts surfaced:
- voice.ts
- videosphere.ts
- chat.ts
- HudSystem
- High Voltage Battery Pack
- index.ts
- Fire Suppression / Li-Ion Battery Fire Guidance
- High Voltage Disconnect / Service Disconnect
- hud.ts
- 12V / Low Voltage Battery
- Immobilization / Stabilization / Lifting Points
- First Responder Cut Loop / Cable Cut
- Tesla Model S 2021 Rescue Sheet
- PushToTalkSystem
- push-to-talk.ts
- initVideosphere()
- Nissan Ariya 2026 ERG
- DesktopLookSystem
- index.ts World.create entry
- EV emergency response training session (part 3)
- Tesla Model S 2021 ERG
- initVoiceBindings()
- initChatBindings()
- Vehicle Identification / Recognition
- look-controls.ts
- Tesla Model S battery (stacked AA-size lithium cells)
- Airbag / SRS Components (inflators, pretensioners, control unit)
- manual disconnect device (prefer over cutting cables for storage)
- thermal runaway / let-it-burn fire strategy
- .init()
- home Level 2 charger installation discussion
- .update()

Source documents:
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `portal/src/chat.ts`
- `portal/src/hud.ts`
- `portal/src/index.ts`
- `portal/src/look-controls.ts`
- `portal/src/push-to-talk.ts`
- `portal/src/videosphere.ts`
- `portal/src/voice.ts`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`

---

### Q3. What does a green 'Ready' light or symbol on the dash indicate about the vehicle's operational status?

> **🔁 Vehicle-named retest:** *"On a Chevrolet Blazer EV 2024, what does the green 'Ready' light on the dash tell me about whether it can still move?"*
> **Outcome: 🟢 Grounded (notes ERG has no explicit *color* callout)** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Chevrolet Blazer EV 2024)**

**Chevrolet Blazer EV 2024**

⚠️ **Safety-critical:** Do not rely on the absence of engine noise — or on the dash light — to judge whether the vehicle is safe. **Lack of engine noise does NOT mean the vehicle is off, and vehicle movement capability exists until the vehicle is fully shut down.** Treat it as able to move silently at any time.

**What the "Ready" indication tells you:**
- A "Ready"/powered-on state means the high-voltage drive system is active and the vehicle **can still move** (silently). It is NOT shut down.
- This vehicle has **no power button**. It only turns off when it is shifted to **P (Park)**, the seat belt is unbuckled, and the driver's door is opened for exit — or by pressing the **"Vehicle Off"** symbol on the infotainment display.
- Even after the vehicle reaches the OFF state, **the high-voltage system can remain energized.**

**To make it safe / prevent movement:**
1. Block the wheels.
2. Apply the Electric Parking Brake (press the EPB switch momentarily — the red parking brake light flashes, then stays on once applied).
3. Shift to **P (Park)** (press the button at the end of the shift lever).
4. Power the vehicle off via the "Vehicle Off" symbol on the infotainment display (or the "Emergency Vehicle Off" symbol, which appears only when a collision is detected).

Bottom line: A green "Ready" light = the vehicle is powered and **can still move**. Do not approach or work around it as if it were inert until you have immobilized it and confirmed shutdown — and even then, treat the HV system as potentially energized.

Source: Rescue Sheet p.1–2; ERG p.5–6

Note: I did not find a callout describing the specific **color** of the "Ready" indicator in the Blazer EV 2024 ERG or Rescue Sheet — the guidance is framed around powered/movement state rather than a named green light. If you can confirm the exact symbol shown, I can refine this.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I need to know which vehicle you're asking about before I can give you accurate information.

**GENERIC — confirm vehicle before relying on this:**

In general, a green "Ready" light or symbol on an EV dash indicates the vehicle is powered on and capable of motion — pressing the accelerator can move the vehicle, even though there is no engine noise. For first responders, this is a critical hazard:

- The vehicle may move silently if powered and in gear.
- Treat the vehicle as energized and capable of movement at all times.
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; confirm the "Ready" indicator is off after shutdown.
- Treat the high-voltage system as live until properly isolated.

*This is generic guidance only and not model-specific.*

To give you the exact, authoritative answer, please confirm the **make, model, and year**. Supported vehicles are:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy', 'Vehicle Identification / Recognition' · 16 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- High Voltage Disconnect / Service Disconnect
- Fire Suppression / Li-Ion Battery Fire Guidance
- 12V / Low Voltage Battery
- Immobilization / Stabilization / Lifting Points
- Tesla Model S 2021 Rescue Sheet
- First Responder Cut Loop / Cable Cut
- Nissan Ariya 2026 ERG
- EV emergency response training session (part 3)
- Tesla Model S 2021 ERG
- manual disconnect device (prefer over cutting cables for storage)
- Tesla Model S battery (stacked AA-size lithium cells)
- thermal runaway / let-it-burn fire strategy
- Vehicle Identification / Recognition
- Airbag / SRS Components (inflators, pretensioners, control unit)
- home Level 2 charger installation discussion

Source documents:
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`

---

## Immobilization & De-energization

### Q5. Can you give me the simplest, step-by-step method to immobilize an EV and disable the high-voltage system for a newly arriving responder?

> **🔁 Vehicle-named retest:** *"Give me the simplest step-by-step way to immobilize a Chevrolet Bolt EV 2022 and shut down its high-voltage system."*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Chevrolet Bolt EV 2022)**

**Chevrolet Bolt EV 2022**

⚠️ **Safety first:**
- Treat the vehicle as energized at all times. **The HV system can remain energized even when the vehicle is OFF.** Lack of engine noise does NOT mean it's off — it can move silently until fully shut down.
- Wear insulated gloves and safety goggles before any HV work.
- **DO NOT cut any orange high-voltage cables** — risk of serious injury or death.

**Simplest step-by-step immobilization & HV shutdown:**

1. **Block the wheels** (chock them) to prevent silent movement.
2. **Apply the Electric Parking Brake** — pull the EPB switch momentarily (red parking-brake light stays on when set).
3. **Shut the vehicle off:** apply the brakes, press the **P (Park)** switch on the center console, then press the **POWER** button. (Alternatively, hold the brakes and press POWER — it shifts to Park then shuts off automatically.)
4. **Remove the keys** from the vehicle (keep the fob at least 5 m / 16 ft away).
5. If charging, **terminate charging** and disconnect the charge handle.
6. **Open the hood** — pull the hood release cable on the lower-left side of the instrument panel.
7. **Cut the low-voltage cable marked with yellow tape**, located above the battery on the left side of the front compartment. Cut through the harness on **each side of the tag** to remove a section so it cannot reconnect. *This single cut disables both the airbags and the high-voltage system.*
8. **Wait** at least **10 seconds** for un-deployed airbag reserve energy to dissipate, and at least **1 minute** for HV energy to discharge before working on the vehicle.

**Optional (more complete HV isolation):** Disconnect the **HV battery manual disconnect lever** — located under the rear seat cushion (release the 2 rear seat cushion clips and lift the cushion; lift the connector position assurance retainer, push the lever button, rotate the lever, and remove the assembly).

Source: ERG p.3–6

Note: Even after these steps, always assume HV cables and components remain energized.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I can give you the right steps, but they're vehicle-specific — and I shouldn't guess on something safety-critical like HV shutdown. Here's a generic interim protocol while we pin down the exact vehicle.

**GENERIC — confirm vehicle before relying on this:**
1. Power the vehicle off and move the key/fob at least 5 m (16 ft) away.
2. Chock the wheels — the vehicle may move silently even when it appears off.
3. Treat the vehicle as energized at all times.
4. Locate and isolate the high-voltage disconnect/service disconnect, and disconnect the 12V battery.
5. Wear insulated PPE rated for HV work.
6. Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire; cool with copious water for an extended period.
7. Watch for stranded energy and delayed re-ignition; continue to monitor the pack after any fire is out.

*This is generic guidance only and is not specific to any model.*

To give you the exact, simplest immobilization and HV-disable procedure, please confirm the **make, model, and year**. Supported vehicles are:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

Which one are you working with?

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy', 'High Voltage Battery Pack', 'High Voltage Disconnect / Service Disconnect' · 34 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- High Voltage Disconnect / Service Disconnect
- Fire Suppression / Li-Ion Battery Fire Guidance
- 12V / Low Voltage Battery
- First Responder Cut Loop / Cable Cut
- Immobilization / Stabilization / Lifting Points
- Tesla Model S 2021 Rescue Sheet
- Nissan Ariya 2026 ERG
- Ford F-150 Lightning 2026 ERG
- Ford Mustang Mach-E 2026 Rescue Sheet
- Hyundai IONIQ 5 2025 ERG
- GM BrightDrop Zevo 400/600 2022-2024 ERG
- Volkswagen ID.4 2025 ERG
- Ford F-150 Lightning 2026 Rescue Sheet
- Hyundai IONIQ 5 2025 Rescue Sheet
- Tesla Model S 2021 ERG
- Volkswagen ID.4 2025 Rescue Sheet
- BMW iX3 2027 Rescue Sheet
- Rivian R1T 2025 ERG
- EV emergency response training session (part 3)
- Ford Mustang Mach-E 2026 ERG
- Chevrolet Blazer EV 2024 ERG
- Rivian R1T 2025 Rescue Sheet
- Chevrolet Equinox EV 2024 ERG
- Chevrolet Bolt EV 2022-2023 ERG
- Cadillac Lyriq 2023 ERG
- GM BrightDrop Zevo 600 2023-2024 Rescue Sheet
- Emergency Shutdown / Power Down Procedure
- Vehicle Identification / Recognition
- thermal runaway / let-it-burn fire strategy
- manual disconnect device (prefer over cutting cables for storage)
- Tesla Model S battery (stacked AA-size lithium cells)
- Airbag / SRS Components (inflators, pretensioners, control unit)
- home Level 2 charger installation discussion

Source documents:
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Ford-Mach-E-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-GM-Brightdrop-Zevo_400_600-2022-2024.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/EmergencyResponseGuide-Volkswagen2025(ID.4).pdf`
- `vehicle_docs/EmergencyResponseGuide-r1t-en-us-20251219_BEV_1.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletBlazerEV_SUV_2024_5d_Electric_EN_ERG_3GN-23101.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletEquinoxEVSUV20245dElectricENERG3GN23105.pdf`
- `vehicle_docs/EmergencyResponseGuide_Cadillac_Lyriq_2023-.pdf`
- `vehicle_docs/EmergencyResponseGuide_Chevrolet_Bolt_EV_2022-2023.pdf`
- `vehicle_docs/EmergencyResponseGuide_Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-BMW-iX3-2027_BEV_1.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Ford-Mach-E-2026.pdf`
- `vehicle_docs/RescueSheet-GM-Brightdrop-Zevo_600-2023-2024.pdf`
- `vehicle_docs/RescueSheet-Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Volkswagen-ID4-2025.pdf`
- `vehicle_docs/RescueSheet-r1t-en-us-20251219_BEV_1.pdf`

---

### Q6. Why is it so important to disconnect the 12-volt battery to disable the high-voltage system, and where is it typically located?

> **🔁 Vehicle-named retest:** *"On a Chevrolet Equinox EV 2024, why does disconnecting the 12V battery disable the high-voltage system, and where is the 12V located?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Chevrolet Equinox EV 2024)**

**Chevrolet Equinox EV 2024**

⚠️ **Important safety caveat — read this first:** On the Equinox EV, the **correct way to disable high voltage is to cut the first responder loop**, NOT to disconnect the 12V battery. The manufacturer specifically warns:
- **DO NOT disable the 12V battery** if you want to keep thermal runaway alert and mitigation functioning. The 12V battery powers the HV battery management system's internal fault detection and thermal-runaway mitigation. Removing 12V power disables that protection.
- DO NOT disconnect the 12V battery merely to silence the horn/chime (e.g., during a "Battery Danger Detected, Safely Exit Vehicle" alert).
- The high-voltage system can remain energized even when the vehicle is in the OFF state. **Do not cut any orange high-voltage cables.**

**Why disconnecting the 12V affects the HV system / safety systems**
The high-voltage system is held closed by HV contactors that require 12V low-voltage power to stay energized. When 12V power is removed, those contactors can no longer be commanded closed, which de-energizes the HV pathway. However, because 12V power is *also* what runs the battery management system, removing the 12V negative cable simultaneously:
- Disables the airbags (SRS), and
- Disables the **thermal runaway alert and mitigation** system.

For that reason, GM directs responders to use the **first responder cut loop** to drop high voltage rather than pulling the 12V — the loop disables HV while leaving the safety/monitoring systems intact.

**Recommended HV-disable procedure (correct method):**
1. Power the vehicle off (it has no power button — shift to P, unbuckle, open driver door; or press "Vehicle Off"/"Emergency Vehicle Off" on the display).
2. Open the hood — pull the hood release handle (lower left of instrument panel) twice.
3. **Double cut the first responder loop** on both sides of the yellow tape; make clean cuts and remove the cut section so loose wires cannot touch. This disables high voltage.
4. After cutting the loop, **wait at least 1 minute** for HV energy to discharge.

If you must disable airbags, that is when the 12V negative cable is removed — but be aware this also disables thermal-runaway alert/mitigation, and consider repositioning power devices (seats, steering wheel, windows) first.

**12V battery location**
The 12V battery is the low-voltage **lead-acid battery** located in the **front compartment (under the hood)**. Access it by opening the hood (pull the release handle twice). The low-voltage first responder cut cables are also located under the hood, on both sides of the yellow tape.

Source: ERG p.6–7; Rescue Sheet p.2–3

**Bottom line:** Disconnecting the 12V will de-energize the HV system because the HV contactors need 12V to stay closed — but on this vehicle that is the *wrong* tool for the job. Use the first responder cut loop to disable HV, and only remove the 12V negative cable when you specifically intend to disable the airbags (accepting that it also disables thermal-runaway mitigation).

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

You haven't told me which vehicle you're asking about, so I can't pull the model-specific procedure or 12V battery location yet.

**GENERIC — confirm vehicle before relying on this:**
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Treat the vehicle as energized at all times.
- Locate and isolate the high-voltage disconnect/service disconnect and the 12V battery.
- Wear insulated PPE rated for HV work.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire; cool with copious water for an extended period.
- Watch for stranded energy and delayed re-ignition; monitor the pack after the fire is out.

On your specific question — in general terms (not model-specific): the high-voltage system is controlled by HV contactors that are held closed by the low-voltage (12V) system. Cutting/disconnecting the 12V power supply causes those contactors to open, which de-energizes the HV cables and components downstream of the battery pack. This is why disabling the 12V is a primary method of shutting down the HV system on most EVs.

**To give you the exact reason, the precise location, and the correct step-by-step disconnect procedure, please confirm the make, model, and year.** Which vehicle are you working on?

Supported vehicles:
- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy', '12V / Low Voltage Battery', '12-volt jumpstart / wake-up of dead EV' · 37 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- High Voltage Disconnect / Service Disconnect
- Fire Suppression / Li-Ion Battery Fire Guidance
- 12V / Low Voltage Battery
- Tesla Model S 2021 Rescue Sheet
- First Responder Cut Loop / Cable Cut
- Immobilization / Stabilization / Lifting Points
- Chevrolet Blazer EV 2024 (Rescue Sheet)
- Cadillac Lyriq 2023 (Rescue Sheet)
- Chevrolet Equinox EV 2024 (Rescue Sheet)
- Nissan Ariya 2026 ERG
- Ford F-150 Lightning 2026 ERG
- Ford Mustang Mach-E 2026 Rescue Sheet
- Hyundai IONIQ 5 2025 Rescue Sheet
- Cable cut location / no-cut HV cables
- Hyundai IONIQ 5 2025 ERG
- BMW iX3 2027 Rescue Sheet
- Volkswagen ID.4 2025 ERG
- EV emergency response training session (part 3)
- 400V Li-ion HV battery pack
- EV emergency response training session (part 1)
- Volkswagen ID.4 2025 Rescue Sheet
- Ford F-150 Lightning 2026 Rescue Sheet
- Ford Mustang Mach-E 2026 ERG
- Tesla Model S 2021 ERG
- Airbag / pretensioner / stored gas inflator
- High-strength / no-cut structural zone
- instructor Barry Smith (SE Community College)
- Airbag / SRS Components (inflators, pretensioners, control unit)
- Vehicle Identification / Recognition
- manual disconnect device (prefer over cutting cables for storage)
- ERG cut-battery-cables / relay-removal de-energizing procedure
- Tesla Model S battery (stacked AA-size lithium cells)
- thermal runaway / let-it-burn fire strategy
- 12-volt jumpstart / wake-up of dead EV
- home Level 2 charger installation discussion
- high-voltage orange cable safety ('if it is orange, do not mess with it')

Source documents:
- `Talk/VID_20250912_110210_00_007_009_segments.json`
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Ford-Mach-E-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/EmergencyResponseGuide-Volkswagen2025(ID.4).pdf`
- `vehicle_docs/EmergencyResponseGuide_Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-BMW-iX3-2027_BEV_1.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Ford-Mach-E-2026.pdf`
- `vehicle_docs/RescueSheet-Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Volkswagen-ID4-2025.pdf`
- `vehicle_docs/RescueSheetChevroletEquinoxEVSUV20245dElectricEN3GN23105.pdf`
- `vehicle_docs/RescueSheetChevrolet_BlazerEV_SUV_2024_5d_Electric_EN_3GN-23101.pdf`
- `vehicle_docs/RescueSheet_Cadillac_Lyriq_2023-.pdf`

---

### Q7. What are 'cut loops', where are they typically located (like the C-pillar), and how do I use them to disable the vehicle?

> **🔁 Vehicle-named retest:** *"Where are the cut loops on a Ford F-150 Lightning 2026, and how do I use them to disable the truck?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Ford F-150 Lightning 2026)**

**Ford F-150 Lightning 2026**

⚠️ **SAFETY FIRST:**
- **Always assume the high-voltage system is powered.** Wear appropriate HV PPE (gloves/boots), and remove all metallic jewelry, watches, and rings.
- **Depowering does NOT make the battery pack safe.** The HV battery and other HV components remain live and dangerous internally.
- **Do NOT cut any orange high-voltage cabling** (runs underbody from the HV battery on the left side up to the underhood compartments). Refer to the No-Cut Zones diagram on ERG p.25.
- When cutting the 12V negative cable, **do not cut/crush/impinge the Restraints Control Module (RCM)** while the 12V battery is still connected — this can cause accidental airbag/pretensioner deployment.

A note on terminology: On the F-150 Lightning, the "cut loop" hazard-disable feature is the **Low Voltage Service Disconnect** — a set of low-voltage wires you cut to shut down the HV system. It is located **under the hood, on the left-hand (driver's) side, behind the underhood trim panel.** There is also a secondary 12V battery cut step to disable the Safety Restraint System.

**HV Disable Procedure — Option 1 (URGENT situations only):**

1. Open the hood and locate the **Low Voltage Service Disconnect** (left-hand underhood area).
2. Release the retainers / turn the hand screws to unlock and remove the **left-hand underhood trim panel** (do this if using a larger cutting tool).
3. **Cut the wires adjacent to the Low Voltage Service Disconnect** and remove the disconnect. **Isolate the cut wires to prevent reconnection.**

This deactivates the high-voltage system.

**12-Volt Battery Disconnect — disables the Safety Restraint System (SRS):**

4. If equipped, remove the **cargo retention net**.
5. Remove the **battery service door**.
6. Locate the **negative battery cable to ground**. **Cut the cable at two locations 3 in (7.6 cm) apart**, and **isolate the cable to prevent reconnection.**

**For NON-urgent situations:** Use Option 2 (refer to the full ERG "Non-urgent situations" section) to deactivate the HV system through the standard procedure.

Source: Rescue Sheet p.2–3; ERG p.13–15, p.22, p.25

If you'd like, I can pull up the **No-Cut Zones diagram (ERG p.25)** or the **Option 2 non-urgent procedure** next.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I need to identify which vehicle you're asking about before I can give you accurate, model-specific information on cut loops.

"GENERIC — confirm vehicle before relying on this:"
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Treat the vehicle as energized at all times.
- Locate and isolate the high-voltage disconnect/service disconnect and the 12V battery.
- Wear insulated PPE rated for HV work.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire; cool with copious water for an extended period.
- Watch for stranded energy and delayed re-ignition; monitor the pack after the fire is out.

This is generic guidance only and is NOT model-specific.

To give you the exact location and procedure for cut loops (which are vehicle-specific), please confirm the **make, model, and year**. The vehicles I can provide authoritative information for are:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

Which one are you working with?

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy', 'Vehicle Identification / Recognition' · 16 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- High Voltage Disconnect / Service Disconnect
- Fire Suppression / Li-Ion Battery Fire Guidance
- 12V / Low Voltage Battery
- Tesla Model S 2021 Rescue Sheet
- First Responder Cut Loop / Cable Cut
- Immobilization / Stabilization / Lifting Points
- Nissan Ariya 2026 ERG
- Tesla Model S 2021 ERG
- EV emergency response training session (part 3)
- Airbag / SRS Components (inflators, pretensioners, control unit)
- manual disconnect device (prefer over cutting cables for storage)
- thermal runaway / let-it-burn fire strategy
- Tesla Model S battery (stacked AA-size lithium cells)
- Vehicle Identification / Recognition
- home Level 2 charger installation discussion

Source documents:
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`

---

### Q8. How does an 'Emergency Plug' work to trick the vehicle's charging communication and disable the high voltage?

> **🔁 Vehicle-named retest:** *"How does the Emergency Plug on a Hyundai IONIQ 5 2025 work to trick the charging communication and disable the high voltage?"*
> **Outcome: 🟡 Grounded correction — source has **no "Emergency Plug"**; gave the documented HV cut-off-switch method** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Hyundai IONIQ 5 2025)**

**Hyundai IONIQ 5 2025**

⚠️ **Safety first:** Even after the HV system is disabled, treat the vehicle as energized. After disabling, wait **at least 5 minutes** for the high-voltage capacitors to discharge before any work near HV components. Never cut or touch the orange HV cabling/connectors until the system is confirmed disabled. Keep the Smart Key at least 2 m (and ideally 5 m / 16.4 ft) away to prevent accidental restart.

**On the "Emergency Plug" question:**

I searched the IONIQ 5 2025 Emergency Response Guide and Rescue Sheet, and I want to be precise: the documents for this vehicle do **not** describe an "Emergency Plug" that spoofs/tricks the charging communication to shut down the high voltage. That concept (inserting a plug into the charge port to send a signal that disables HV) is **not** the method documented for the IONIQ 5 2025.

**What the IONIQ 5 2025 ERG actually specifies for disabling the high-voltage system:**

The documented shutdown sequence is **Power Off → Disconnect 12V battery → High-voltage shut-off**:

1. **Power off** the vehicle (press START/OFF button while depressing the brake pedal). Remove the Smart Key at least 2 m away.
2. If needed, lower windows, unlock doors, and open the tailgate first — once the 12V is disconnected, power controls won't operate.
3. **Disconnect the 12V auxiliary battery** — open the hood, locate the 12V battery in the motor compartment, and disconnect the **negative (–) terminal**. This de-powers the battery management system. *(Source: ERG p.8)*
4. **High-voltage cut-off:** Remove the fuse box cover in the motor compartment and disconnect the **High-Voltage Cut-Off Switch (A)** to isolate the battery's high voltage. *(Source: ERG p.9)*
5. **Wait more than 5 minutes** for the HV capacitors to discharge before proceeding. *(Source: ERG p.9)*

So on the IONIQ 5, HV is disabled via the **manual High-Voltage Cut-Off Switch and 12V disconnect**, not via a charge-port communication "trick."

**No matching information for an "Emergency Plug"** was found in the Hyundai IONIQ 5 2025 Emergency Response Guide or Rescue Sheet.

If you may have been thinking of a different vehicle (some manufacturers do document charge-port or low-voltage "rescue/cut loop" methods), let me know the make, model, and year and I'll pull the correct source.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I need to know which vehicle you're asking about, since "Emergency Plug" features and HV disable procedures are model-specific.

Could you confirm the **make, model, and year**? In the meantime, here is general guidance:

GENERIC — confirm vehicle before relying on this:
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Treat the vehicle as energized at all times.
- Locate and isolate the high-voltage disconnect/service disconnect and the 12V battery.
- Wear insulated PPE rated for HV work.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire; cool with copious water for an extended period.
- Watch for stranded energy and delayed re-ignition; monitor the pack after the fire is out.

This is generic guidance only and is not model-specific.

Which supported vehicle is this incident? Supported vehicles:
- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022-2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022-2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy', 'charging cable disconnect (never cut, DC fast charge >400V, locked plug)', 'Vehicle Identification / Recognition' · 21 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- Fire Suppression / Li-Ion Battery Fire Guidance
- High Voltage Disconnect / Service Disconnect
- 12V / Low Voltage Battery
- First Responder Cut Loop / Cable Cut
- Tesla Model S 2021 Rescue Sheet
- Immobilization / Stabilization / Lifting Points
- Nissan Ariya 2026 ERG
- EV emergency response training session (part 2)
- EV emergency response training session (part 3)
- Tesla Model S 2021 ERG
- Tesla Model S battery (stacked AA-size lithium cells)
- Vehicle Identification / Recognition
- thermal runaway / let-it-burn fire strategy
- Airbag / SRS Components (inflators, pretensioners, control unit)
- instructor Barry Smith (SE Community College)
- manual disconnect device (prefer over cutting cables for storage)
- Ford Mustang Mach-E walk-around
- home Level 2 charger installation discussion
- battery module conductor plate / coolant heat transfer
- charging cable disconnect (never cut, DC fast charge >400V, locked plug)

Source documents:
- `Talk/VID_20250912_110210_00_007_009_segments.json`
- `Talk/VID_20250912_122900_00_010_012_segments.json`
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`

---

### Q9. Is it safe to cut the orange high-voltage cables during an extrication?

> **🔁 Vehicle-named retest:** *"During an extrication on a GM BrightDrop Zevo 600 2024, is it safe to cut the orange high-voltage cables?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (GM BrightDrop Zevo 600 2024)**

**GM BrightDrop Zevo 600 2024**

⚠️ **NO — Do NOT cut any orange-colored high-voltage cables.** This is an explicit, repeated warning across the entire Emergency Response Guide and Rescue Sheet: **"DO NOT CUT ANY ORANGE COLORED HIGH VOLTAGE CABLES."** Cutting an orange HV cable risks electrocution and arc-flash. Orange = high voltage on this vehicle.

**What to do instead — use the First Responder Cut Loop (low-voltage) to disable HV:**

1. Press the **POWER** button to disable vehicle propulsion (press the button at the end of the shift lever to shift to P/Park on the 2024 model).
2. On the **left side** of the vehicle, remove the **outside rearview mirror cover** (the cover has a fire-helmet icon molded into it):
   - Start at the bottom of the cover and pry out.
   - Release the tabs at the front and top of the cover.
   - Slide the cover forward to remove.
3. **Double cut** the first responder loop on **both sides of the yellow tape** and remove the cut section of cable. Ensure cuts are clean and there is no risk of loose wires touching.
4. **Wait at least 1 minute** to allow the high-voltage energy to discharge.

This low-voltage cut loop is what safely disables the high-voltage system.

**Additional notes:**
- The HV battery is a Class B Li-ion pack mounted under the vehicle and is a **structural part of the floor pan** — treat it as a no-cut zone as well.
- **Do NOT** disable the 12V battery if you want to preserve thermal-runaway alert and mitigation. (Removing the 12V negative cable disables airbags but also disables the thermal-runaway alert/mitigation.)
- Always wear appropriate PPE; lack of engine noise does not mean the vehicle is off.

Sources: ERG p.10–11; Rescue Sheet p.1–4 (cut loop procedure, Rescue Sheet p.2).

If you tell me whether you're dealing with the 2024 specifically (vs. a 2022 unit on scene), note the cut-loop location differs: 2023–2024 it's behind the **left exterior mirror cover**; a 2022 (no fire-helmet icon on the cover) has the loop **under the instrument panel** instead.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I need to know which vehicle you're working with before I can give you accurate guidance.

**GENERIC — confirm vehicle before relying on this:**
- Treat the vehicle as energized at all times — assume all orange (high-voltage) cables and components are live.
- **Do NOT cut, crush, or sever orange HV cables** under any circumstances. Severe shock/arc-flash and fire risk.
- Power the vehicle off and keep the key/fob at least 5 m (16 ft) away.
- Chock the wheels; the vehicle may move silently if powered.
- Locate and isolate the high-voltage disconnect/service disconnect and the 12V battery before extrication.
- Wear insulated PPE rated for HV work.
- Avoid all manufacturer-designated no-cut zones (HV cable routing, battery pack, structural reinforcements).
- Watch for stranded energy even after shutdown.

*This is generic guidance only and is NOT model-specific.*

To give you the exact no-cut zones, HV cable routing, and disconnect procedure for your vehicle, please confirm the **make, model, and year**. Supported vehicles:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

Which one are you working with?

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy', "high-voltage orange cable safety ('if it is orange, do not mess with it')", 'High Voltage Battery Pack' · 39 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- High Voltage Disconnect / Service Disconnect
- Fire Suppression / Li-Ion Battery Fire Guidance
- 12V / Low Voltage Battery
- Immobilization / Stabilization / Lifting Points
- Tesla Model S 2021 Rescue Sheet
- First Responder Cut Loop / Cable Cut
- Nissan Ariya 2026 ERG
- Ford F-150 Lightning 2026 ERG
- Ford Mustang Mach-E 2026 Rescue Sheet
- EV emergency response training session (part 3)
- BMW iX3 2027 Rescue Sheet
- EV emergency response training session (part 1)
- Hyundai IONIQ 5 2025 ERG
- Ford F-150 Lightning 2026 Rescue Sheet
- Volkswagen ID.4 2025 Rescue Sheet
- Ford Mustang Mach-E 2026 ERG
- GM BrightDrop Zevo 400/600 2022-2024 ERG
- Rivian R1T 2025 ERG
- Hyundai IONIQ 5 2025 Rescue Sheet
- Tesla Model S 2021 ERG
- Volkswagen ID.4 2025 ERG
- Chevrolet Blazer EV 2024 ERG
- Chevrolet Bolt EV 2022-2023 ERG
- Chevrolet Equinox EV 2024 ERG
- Cadillac Lyriq 2023 ERG
- GM BrightDrop Zevo 600 2023-2024 Rescue Sheet
- Rivian R1T 2025 Rescue Sheet
- Vehicle Identification / Recognition
- ERG cut-battery-cables / relay-removal de-energizing procedure
- manual disconnect device (prefer over cutting cables for storage)
- Tesla Model S battery (stacked AA-size lithium cells)
- thermal runaway / let-it-burn fire strategy
- instructor Barry Smith (SE Community College)
- Emergency Shutdown / Power Down Procedure
- Airbag / SRS Components (inflators, pretensioners, control unit)
- home Level 2 charger installation discussion
- high-voltage orange cable safety ('if it is orange, do not mess with it')
- 12-volt jumpstart / wake-up of dead EV

Source documents:
- `Talk/VID_20250912_110210_00_007_009_segments.json`
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Ford-Mach-E-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-GM-Brightdrop-Zevo_400_600-2022-2024.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/EmergencyResponseGuide-Volkswagen2025(ID.4).pdf`
- `vehicle_docs/EmergencyResponseGuide-r1t-en-us-20251219_BEV_1.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletBlazerEV_SUV_2024_5d_Electric_EN_ERG_3GN-23101.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletEquinoxEVSUV20245dElectricENERG3GN23105.pdf`
- `vehicle_docs/EmergencyResponseGuide_Cadillac_Lyriq_2023-.pdf`
- `vehicle_docs/EmergencyResponseGuide_Chevrolet_Bolt_EV_2022-2023.pdf`
- `vehicle_docs/EmergencyResponseGuide_Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-BMW-iX3-2027_BEV_1.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Ford-Mach-E-2026.pdf`
- `vehicle_docs/RescueSheet-GM-Brightdrop-Zevo_600-2023-2024.pdf`
- `vehicle_docs/RescueSheet-Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Volkswagen-ID4-2025.pdf`
- `vehicle_docs/RescueSheet-r1t-en-us-20251219_BEV_1.pdf`

---

### Q10. If I am using an Emergency Plug and the light flashes green, what does that mean? What if it turns solid blue or red?

> **🔁 Vehicle-named retest:** *"I'm using the Emergency Plug on a Hyundai IONIQ 5 2025 and the light is flashing green — what does that mean, and what about solid blue or red?"*
> **Outcome: 🟡 Grounded correction — source has **no Emergency-Plug light legend**; gave HV cut-off-switch method + honest gap** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Hyundai IONIQ 5 2025)**

**Hyundai IONIQ 5 2025**

I want to be straight with you on this, because it's safety-critical: **the indexed IONIQ 5 2025 Emergency Response Guide and Rescue Sheet do not contain a description of an "Emergency Plug" indicator/LED light, nor a legend for flashing-green / solid-blue / solid-red color states.** I'm not able to confirm what those colors mean from the authoritative source, and I won't guess at a color code that could mislead you during HV disconnection.

No matching information found in the Hyundai IONIQ 5 2025 Emergency Response Guide or Rescue Sheet for an Emergency Plug indicator-light color legend.

**What the IONIQ 5 ERG does document for HV isolation:**

The ERG's method for isolating the high-voltage battery is the **High-Voltage Cut-off Switch**, not an "Emergency Plug" with a status light. The procedure is:
1. Power off the vehicle (Park, press POWER button).
2. Disconnect the 12V auxiliary battery negative (–) terminal (in the motor compartment), with the smart key removed at least 2 m away to prevent restart.
3. Remove the fuse box cover in the motor compartment and disconnect the **High-Voltage Cut-off Switch**.
4. **Wait more than 5 minutes** to allow the HV capacitors to discharge before working near HV components.

*Source: ERG p.6–9*

**Recommendation:** If the "Emergency Plug" you're describing is a charging-cable/EVSE device (e.g., a portable charger or wallbox unit) rather than a vehicle component, its indicator colors would be defined by that charger's own manual — not the vehicle ERG. Can you confirm:
- Is the flashing-green light on a **charging unit/cable** (EVSE) or on something inside the vehicle?
- Where exactly is the device located?

That'll help me point you to the right source. In the meantime, treat the vehicle as energized, keep the key 2 m+ away, and do not cut orange HV cabling until the system is disabled and the 5-minute discharge has elapsed.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I need to identify which vehicle this question concerns. The "Emergency Plug" terminology and the green/blue/red light indicators point to a specific vehicle, but you haven't told me which one yet.

GENERIC — confirm vehicle before relying on this:
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Treat the vehicle as energized at all times.
- Locate and isolate the high-voltage disconnect/service disconnect and the 12V battery.
- Wear insulated PPE rated for HV work.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire; cool with copious water for an extended period.
- Watch for stranded energy and delayed re-ignition; monitor the pack after the fire is out.

This is generic guidance only and is NOT specific to any model.

To give you the correct answer about the Emergency Plug and its light indicators, please confirm the **make, model, and year** of the vehicle. The "Emergency Plug" feature is associated with the Hyundai IONIQ 5 — if that's the vehicle you're working on, just confirm "Hyundai IONIQ 5 2025" and I'll pull the exact procedure.

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy', 'Emergency Shutdown / Power Down Procedure' · 13 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- Fire Suppression / Li-Ion Battery Fire Guidance
- High Voltage Disconnect / Service Disconnect
- Tesla Model S 2021 Rescue Sheet
- Ford F-150 Lightning 2026 ERG
- Tesla Model S 2021 ERG
- EV emergency response training session (part 3)
- Ford F-150 Lightning 2026 Rescue Sheet
- thermal runaway / let-it-burn fire strategy
- manual disconnect device (prefer over cutting cables for storage)
- Emergency Shutdown / Power Down Procedure
- Tesla Model S battery (stacked AA-size lithium cells)
- home Level 2 charger installation discussion

Source documents:
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`

---

## Fire Suppression & Hazard Management

### Q12. What is the recommended strategy for an EV battery fire: letting it burn out defensively or actively trying to suppress it?

> **🔁 Vehicle-named retest:** *"For a Nissan Ariya 2026 battery fire, should I let it burn out defensively or actively try to suppress it?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Nissan Ariya 2026)**

**Nissan Ariya 2026**

⚠️ **Safety-critical first:** Always use full PPE and SCBA. The HV battery can re-ignite, and a severely damaged pack carries a risk of delayed fire. Do NOT breach the high-voltage battery case during suppression or overhaul.

**Bottom line: The Ariya ERG calls for ACTIVE suppression with copious water — not a defensive "let it burn" approach.**

The Nissan Ariya 2026 Emergency Response Guide directs:

1. **Use copious amounts of water.** In the case of extinguishing a fire with water, large amounts of water — from a fire hydrant if possible — must be used. **Do NOT attempt to extinguish with a small amount of water.**
2. **Follow standard firefighting practices** with full PPE and self-contained breathing apparatus. Smoke from an Ariya fire is similar to that of a conventional vehicle fire.
3. **ABC extinguisher only for small, non-battery fires** — e.g., an electrical fire from wiring harnesses/components or an oil fire. It is not the tool for the HV battery itself.
4. **Anticipate re-ignition.** During overhaul, ensure the battery is fully cooled to prevent re-ignition. Confirm with a thermal imaging camera that the battery surface temperature (viewed from underneath) is no more than 15–20 °F above ambient. If no thermal camera is available, wait until no smoke is observed for 2 hours.
5. **Isolation precaution:** Do NOT access the service plug if smoke is coming from the battery or an odor of smoke is present.
6. **Post-fire staging:** Do not store the vehicle inside a structure. Keep it away from structures and other vehicles if the HV battery is severely damaged — there is a possibility of delayed fire.

Source: ERG p.45–46 (Section 6 — In Case of Fire); ERG p.46 (overhaul / re-ignition guidance).

The ERG also recommends referencing the NFPA *Alternative Fuel Vehicle Emergency Field Guide* for additional EV fire training and information.

If you'd like, I can pull the step-by-step HV system shutdown or service plug removal procedure for once the fire is controlled.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I need to know which vehicle you're dealing with before I can give you the authoritative fire-response strategy, since this varies by manufacturer.

**GENERIC — confirm vehicle before relying on this:**
- Treat the vehicle as energized at all times; keep the key/fob at least 5 m away.
- Chock the wheels — the vehicle can move silently if powered.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire.
- For a confirmed HV battery fire, the general approach is to apply copious water for an extended period to cool the pack and prevent/limit thermal runaway propagation. If water in sufficient volume is not available, a defensive strategy (protecting exposures and letting it burn in a controlled manner) may be used.
- Watch for stranded energy, re-ignition, and delayed thermal runaway; monitor the pack with a thermal imaging camera for an extended period after the fire appears out.

This is generic guidance only and is NOT model-specific.

To give you the correct, authoritative answer, please confirm the **make, model, and year**. Supported vehicles are:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'Fire Suppression / Li-Ion Battery Fire Guidance', 'thermal runaway / let-it-burn fire strategy', 'battery module conductor plate / coolant heat transfer' · 36 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- Fire Suppression / Li-Ion Battery Fire Guidance
- High Voltage Disconnect / Service Disconnect
- 12V / Low Voltage Battery
- Tesla Model S 2021 Rescue Sheet
- Nissan Ariya 2026 ERG
- Ford F-150 Lightning 2026 ERG
- Tesla Model S 2021 ERG
- Volkswagen ID.4 2025 ERG
- EV emergency response training session (part 2)
- Volkswagen ID.4 2025 Rescue Sheet
- GM BrightDrop Zevo 400/600 2022-2024 ERG
- Rivian R1T 2025 ERG
- Ford Mustang Mach-E 2026 Rescue Sheet
- Hyundai IONIQ 5 2025 ERG
- Ford F-150 Lightning 2026 Rescue Sheet
- Hyundai IONIQ 5 2025 Rescue Sheet
- EV emergency response training session (part 3)
- Ford Mustang Mach-E 2026 ERG
- GM BrightDrop Zevo 600 2023-2024 Rescue Sheet
- Rivian R1T 2025 Rescue Sheet
- Chevrolet Blazer EV 2024 ERG
- Chevrolet Equinox EV 2024 ERG
- Chevrolet Bolt EV 2022-2023 ERG
- Cadillac Lyriq 2023 ERG
- manual disconnect device (prefer over cutting cables for storage)
- instructor Barry Smith (SE Community College)
- Emergency Shutdown / Power Down Procedure
- Airbag / SRS Components (inflators, pretensioners, control unit)
- Vehicle Identification / Recognition
- Tesla Model S battery (stacked AA-size lithium cells)
- thermal runaway / let-it-burn fire strategy
- charging cable disconnect (never cut, DC fast charge >400V, locked plug)
- home Level 2 charger installation discussion
- Ford Mustang Mach-E walk-around
- battery module conductor plate / coolant heat transfer

Source documents:
- `Talk/VID_20250912_110210_00_007_009_segments.json`
- `Talk/VID_20250912_122900_00_010_012_segments.json`
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Ford-Mach-E-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-GM-Brightdrop-Zevo_400_600-2022-2024.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/EmergencyResponseGuide-Volkswagen2025(ID.4).pdf`
- `vehicle_docs/EmergencyResponseGuide-r1t-en-us-20251219_BEV_1.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletBlazerEV_SUV_2024_5d_Electric_EN_ERG_3GN-23101.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletEquinoxEVSUV20245dElectricENERG3GN23105.pdf`
- `vehicle_docs/EmergencyResponseGuide_Cadillac_Lyriq_2023-.pdf`
- `vehicle_docs/EmergencyResponseGuide_Chevrolet_Bolt_EV_2022-2023.pdf`
- `vehicle_docs/EmergencyResponseGuide_Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Ford-Mach-E-2026.pdf`
- `vehicle_docs/RescueSheet-GM-Brightdrop-Zevo_600-2023-2024.pdf`
- `vehicle_docs/RescueSheet-Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Volkswagen-ID4-2025.pdf`
- `vehicle_docs/RescueSheet-r1t-en-us-20251219_BEV_1.pdf`

---

### Q13. How many gallons of water are typically needed to cool and extinguish a burning EV battery?

> **🔁 Vehicle-named retest:** *"How many gallons of water should I expect to need to cool and extinguish a burning Rivian R1T 2025 battery?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Rivian R1T 2025)**

**Rivian R1T 2025**

⚠️ Safety first:
- Rivian recommends **defensive firefighting** — only attempt to extinguish if there is a specific need to do so.
- Wear full PPE with SCBA. Do **not** cut the battery or HV cables to try to cool it.
- Water applied to the battery pack can become **caustic** and burn skin — apply more water to dilute, and decontaminate tools/clothing.
- Lithium-ion batteries can **reignite or self-ignite days later** — monitor after the fire is out.

**Water needed: a minimum of 2,000–3,000 gallons (7,500–11,500 L).**

Plan to support this with an established water supply, a tender, or additional units to shuttle water to the pumping engine.

Key cooling/extinguishment points:
1. Use a **fog pattern** to approach and extinguish the interior.
2. If you see sustained fire on the underside, centerline, or near the axles, a traction-battery fire is likely — **do not use direct water application**; maintain fire control as the battery is consumed (≈30 minutes).
3. Use a **thermal imaging camera (TIC)/IR** to monitor pack temperature. Look for ambient temps **at or below 212°F (100°C)** to indicate cooling. Temperatures above that indicate potential for continued cell thermal events.
4. Continue evaluating the battery structure and apply water directly to exposed areas. Submerge any loose cells/modules in a **1–5% salt water solution for at least 24 hours**.
5. If water isn't readily available, use defensive tactics; CO₂/dry chemical can be used to suppress only as needed (e.g., to extricate occupants) until water is available — note foam/fire blankets may suppress but will **not** extinguish a battery fire.

Source: ERG p.10–11; Rescue Sheet p.3–4

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

You haven't told me which vehicle you're asking about, so I can't pull the model-specific figure yet. Here's interim guidance in the meantime:

**GENERIC — confirm vehicle before relying on this:**
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Treat the vehicle as energized at all times.
- Locate and isolate the high-voltage disconnect/service disconnect and the 12V battery.
- Wear insulated PPE rated for HV work.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire; cool with copious water for an extended period — lithium-ion battery fires commonly require very large, sustained water volumes (often thousands of gallons) applied directly to the pack.
- Watch for stranded energy and delayed re-ignition; monitor the pack after the fire is out.

This is generic guidance only and is NOT model-specific.

To give you the authoritative water-volume figure, please confirm the **make, model, and year** of the vehicle. Supported vehicles are:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'battery module conductor plate / coolant heat transfer' · 5 nodes reached._

Concepts surfaced:
- EV emergency response training session (part 2)
- instructor Barry Smith (SE Community College)
- battery module conductor plate / coolant heat transfer
- Ford Mustang Mach-E walk-around
- charging cable disconnect (never cut, DC fast charge >400V, locked plug)

Source documents:
- `Talk/VID_20250912_110210_00_007_009_segments.json`
- `Talk/VID_20250912_122900_00_010_012_segments.json`

---

### Q14. How do we effectively get water or an extinguishing agent directly onto the battery cells if they are protected by a strong metal container?

> **🔁 Vehicle-named retest:** *"On a Tesla Model S 2021, how do I get water or extinguishing agent onto the battery cells when they're sealed inside that metal pack?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Tesla Model S 2021)**

**Tesla Model S 2021**

⚠️ **SAFETY FIRST**
- **Do NOT open, breach, or cut into the high-voltage battery pack to apply water.** Tesla explicitly states: *do not open the battery for the purpose of cooling it.* Breaching a sealed lithium-ion pack can cause violent reaction, electric shock, and worsened fire.
- Consider the vehicle **energized at all times**. Wear full PPE including SCBA — burning batteries release toxic/super-heated gases (hydrogen fluoride, CO, etc.).
- Do **not** use foam, and do **not** submerge the vehicle.

**How to get water onto the cells (the correct method):**

The key point is that you do **not** need to open the pack. You direct water at the battery enclosure and let it reach the cells through existing pathways:

1. **Apply large amounts of water directly to the battery** from outside the pack. The water cools the metal enclosure, which transfers heat away from the cells inside. Expect to need approximately **3,000–8,000 gallons (11,356–30,283 L)** — establish or request additional water supply early.

2. **Use existing openings, if present.** Water may be applied onto the pack from a safe distance **only if a natural opening already exists** — such as a vent or an opening created by collision damage. Do **not** create an opening yourself.

3. **Lift or tilt the vehicle for more direct access**, if it is safe to do so. This gives you a more direct line to the underside/battery and helps water reach the pack and drain through. (Refer to ERG Chapter 2 for proper lift areas — never breach the floor pan when lifting.)

4. **If water is not immediately available**, use CO₂, dry chemicals, or another typical extinguishing agent to fight the fire only until water arrives. (No foam.)

5. **Keep applying water and monitor with a thermal imaging camera (TIC/IR).** Continue until the battery reaches ambient temperature or below. After stopping water, allow time for internal heat to transfer to the enclosure before declaring it cool.

**After the fire:**
- Battery fires can take **up to 24 hours to fully cool**; monitor for re-ignition.
- There must be no fire, smoke, popping/hissing, or heating for at least **45 minutes** before releasing to second responders.
- Tilt/reposition the vehicle to drain excess water, and store outside at least **50 ft (15 m)** from any exposure.

*Note on liquids:* The HV cells are sealed and contain only a small amount of electrolyte — not enough to pool. Clear liquid is likely water; blue liquid is glycol coolant.

Source: ERG p.23, p.26–27; Rescue Sheet p.3–4

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I need to know which vehicle you're asking about before I can give you accurate guidance.

**GENERIC — confirm vehicle before relying on this:**
- Lithium-ion battery packs are sealed in a structural metal enclosure, so it is difficult to get water directly onto the cells. Direct large, sustained volumes of water at the pack to cool it through the casing.
- Do NOT use ABC/dry-chemical extinguishers on a lithium-ion battery fire — cool with copious water for an extended period.
- Treat the vehicle as energized at all times; keep the key/fob at least 5 m away and chock the wheels.
- Expect prolonged cooling needs, possible re-ignition, and stranded energy; monitor the pack with a thermal imaging camera after flames are knocked down.
- Do not attempt to pry open or cut into the battery enclosure to reach cells.

This is generic guidance only and is **not** model-specific.

To give you the correct, authoritative procedure, please confirm the **make, model, and year**. Supported vehicles include:
- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy', 'get_node discovery tool', 'getActiveVideo()' · 47 nodes reached._

Concepts surfaced:
- videosphere.ts
- HudSystem
- hud-mirror.ts
- index.ts
- hud.ts
- initVideosphere()
- n8n MCP Tools Expert skill
- activatePanorama()
- n8n Node Configuration skill
- setPendingListener()
- setChatListener()
- setTranscriptListener()
- switchVideo()
- EV emergency response training session (part 3)
- index.ts World.create entry
- getActiveVideo()
- .update()
- .wireHud()
- getRenderedHistory()
- getCurrentVideoIdx()
- fmt()
- n8n_update_partial_workflow iterative editing
- updateVideoSummary()
- validate_node unified validation tool
- Tesla Model S battery (stacked AA-size lithium cells)
- bindVideoControls()
- thermal runaway / let-it-burn fire strategy
- createHiddenVideoEls()
- get_node discovery tool
- ensureHls()
- updatePlayButton()
- progressive disclosure (standard detail covers 95%)
- n8n_create_workflow
- manual disconnect device (prefer over cutting cables for storage)
- updateMuteButton()
- hlsReady
- home Level 2 charger installation discussion
- .playChime()
- hlsInstances
- videoTextures
- nodeType format split (short nodes-base.* vs full n8n-nodes-base.*)
- hlsSupported
- LectureConfig
- VIDEOS
- .playClick()
- .init()
- videoEls

Source documents:
- `.agents/skills/n8n-mcp-tools-expert/SKILL.md`
- `.agents/skills/n8n-mcp-tools-expert/VALIDATION_GUIDE.md`
- `.agents/skills/n8n-mcp-tools-expert/WORKFLOW_GUIDE.md`
- `.agents/skills/n8n-node-configuration/SKILL.md`
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `portal/src/hud-mirror.ts`
- `portal/src/hud.ts`
- `portal/src/index.ts`
- `portal/src/videosphere.ts`

---

### Q15. Why are fire blankets potentially problematic or less effective for lithium-ion battery fires?

**n8n RAG webhook**

**Ford Mustang Mach-E 2026** (from the First Responder Training video)

⚠️ A lithium-ion battery fire can reach **2,000–3,000°F**. Do not assume a fire blanket will safely smother it, and always wear full PPE near a burning battery.

The instructor explicitly states he does **not** think a fire blanket is the way to go for a lithium battery fire. The key problems:

- **Extreme temperatures:** A true lithium fire burns at roughly 2,000–3,000°F. The instructor noted that staged demonstration photos of blankets are "totally not representative" of what that real fire would be like — being that close to those temperatures is a serious hazard.

- **The fire is self-sustaining inside a sealed metal container:** The cells are packed extremely tightly inside a strong metal battery enclosure. A blanket sits on the outside and cannot get any suppression agent down to the cells where the thermal runaway is actually happening. (The instructor makes the same point about water — you can reach metal touching the battery, but you can't get the agent *inside* that cavity.)

- **It doesn't stop thermal runaway / re-ignition:** Because thermal runaway is driven by chemical energy inside the cells, simply covering the fire doesn't address the root cause. These events can smolder and re-ignite long after the initial crash or fire.

The instructor's bottom-line strategy (echoing European practice): once you have a fire in the battery area, the best option is often to **let it burn out** in a safe location — most of these vehicles only carry a couple of hours of flammable energy. Trying to extinguish it can turn into a 10–15 hour cycle of cooling, stopping, and re-ignition.

Source: Video 2 — Interior / Underside ~00:06:07–00:06:56 (blanket comment); ~00:00:00–00:02:21 (sealed container / let-it-burn strategy); ~00:13:16–00:13:47 (can't get agent into the cavity)

Want me to cross-check the Mach-E ERG for the official recommended fire-suppression procedure (water volumes, suppression duration, etc.)?

**graphify graph**

_Traversal start: 'Fire Suppression / Li-Ion Battery Fire Guidance', 'battery module conductor plate / coolant heat transfer', 'Ford Mustang Mach-E 2026 ERG' · 34 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- High Voltage Disconnect / Service Disconnect
- Fire Suppression / Li-Ion Battery Fire Guidance
- 12V / Low Voltage Battery
- Immobilization / Stabilization / Lifting Points
- First Responder Cut Loop / Cable Cut
- Tesla Model S 2021 Rescue Sheet
- Nissan Ariya 2026 ERG
- Ford F-150 Lightning 2026 ERG
- EV emergency response training session (part 2)
- Ford Mustang Mach-E 2026 ERG
- Hyundai IONIQ 5 2025 Rescue Sheet
- Hyundai IONIQ 5 2025 ERG
- Ford Mustang Mach-E 2026 Rescue Sheet
- Volkswagen ID.4 2025 Rescue Sheet
- BMW iX3 2027 Rescue Sheet
- Volkswagen ID.4 2025 ERG
- Ford F-150 Lightning 2026 Rescue Sheet
- Rivian R1T 2025 ERG
- GM BrightDrop Zevo 400/600 2022-2024 ERG
- Tesla Model S 2021 ERG
- Rivian R1T 2025 Rescue Sheet
- Cadillac Lyriq 2023 ERG
- Chevrolet Bolt EV 2022-2023 ERG
- Chevrolet Equinox EV 2024 ERG
- Chevrolet Blazer EV 2024 ERG
- GM BrightDrop Zevo 600 2023-2024 Rescue Sheet
- Emergency Shutdown / Power Down Procedure
- Vehicle Identification / Recognition
- Airbag / SRS Components (inflators, pretensioners, control unit)
- instructor Barry Smith (SE Community College)
- battery module conductor plate / coolant heat transfer
- Ford Mustang Mach-E walk-around
- charging cable disconnect (never cut, DC fast charge >400V, locked plug)

Source documents:
- `Talk/VID_20250912_110210_00_007_009_segments.json`
- `Talk/VID_20250912_122900_00_010_012_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Ford-Mach-E-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-GM-Brightdrop-Zevo_400_600-2022-2024.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/EmergencyResponseGuide-Volkswagen2025(ID.4).pdf`
- `vehicle_docs/EmergencyResponseGuide-r1t-en-us-20251219_BEV_1.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletBlazerEV_SUV_2024_5d_Electric_EN_ERG_3GN-23101.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletEquinoxEVSUV20245dElectricENERG3GN23105.pdf`
- `vehicle_docs/EmergencyResponseGuide_Cadillac_Lyriq_2023-.pdf`
- `vehicle_docs/EmergencyResponseGuide_Chevrolet_Bolt_EV_2022-2023.pdf`
- `vehicle_docs/EmergencyResponseGuide_Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-BMW-iX3-2027_BEV_1.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Ford-Mach-E-2026.pdf`
- `vehicle_docs/RescueSheet-GM-Brightdrop-Zevo_600-2023-2024.pdf`
- `vehicle_docs/RescueSheet-Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Volkswagen-ID4-2025.pdf`
- `vehicle_docs/RescueSheet-r1t-en-us-20251219_BEV_1.pdf`

---

## Extrication & Post-Crash Handling

### Q16. How does the increasing use of laminate glass and carbon fiber in modern EVs affect extrication and saw-cutting safety?

**n8n RAG webhook**

**Ford Mustang Mach-E 2026**

This question is addressed in the First Responder Training video and cross-checked against the Mach-E ERG/Rescue Sheet. Here's how the move toward laminated glass and carbon-fiber structures changes extrication and saw-cutting safety.

---

### ⚠️ Critical safety warnings first
- **Carbon-fiber dust is a serious inhalation hazard.** If you saw-cut into any carbon-fiber structure, you **cannot breathe that dust in** — it carries real health implications. **Respiratory protection (SCBA / appropriate respiration) is mandatory** any time you cut into carbon fiber. *(Source: Video 2 — Interior / Underside ~00:09:52–00:10:46)*
- **Never cut with a spark-producing tool near the HV battery or in a smoke-filled compartment.** Battery vent smoke can be combustible/explosive; an ignition source from cutting can set it off. *(Source: ERG p.31)*
- **Always assume the HV system is powered.** Do not cut any orange HV cabling, and do not cut low (where the battery is). *(Source: ERG p.18, p.21; Video 2 ~00:12:09–00:12:30)*

---

### 1. Laminated glass — the window is now a cutting job
- The industry is moving (in 2026) toward **laminated glass all the way around**, not just the windshield/rear glass. On the Mach-E, the windshield and rear glass are laminated; the side windows are currently tempered. *(Source: ERG p.22; Rescue Sheet p.3)*
- **Impact on extrication:** You can no longer simply "pop" or break-and-rake a laminated side window the way you would tempered glass. Laminated glass holds together and **must be saw-cut/glass-sawn**, which is slower and more labor-intensive. *(Source: Video 2 ~00:08:52–00:09:59)*
- **The trade-off:** Laminate is stronger and better protects occupants in a rollover — but it makes opening the vehicle to reach patients harder, not easier. Plan for more time and the right glass-management tools. *(Source: Video 2 ~00:08:52–00:09:59)*

### 2. Carbon fiber / high-strength structure — cut zones and PPE
- More vehicles are using **carbon fiber in the structure**. Beyond the slower cutting, the **dust is the key new hazard** — wear respiratory protection whenever cutting it. *(Source: Video 2 ~00:09:52–00:10:46)*
- On the Mach-E specifically, the body is various-strength aluminum with reinforced zones to be aware of when picking cut points:
  - **Door beams** — high-strength steel
  - **B-pillars, C-pillars, and roof bow** — stronger aluminum
  - **Floor tunnel** — high-grade aluminum
  *(Source: ERG p.19–20)*

### 3. General cutting rules that still apply
1. **Use the right tools and PPE** — a hydraulic cutter and appropriate protective equipment when cutting. *(Source: ERG p.21)*
2. **Disable the 12V battery before any cutting/extrication** — cut the negative cable to ground at two points ~3 in (7.6 cm) apart and isolate it to prevent reconnection. This reduces airbag/pyrotechnic firing risk. *(Source: Rescue Sheet p.3; Video 2 ~00:32:04, ~00:33:43)*
3. **Stay out of the no-cut zones** — no orange HV cabling, nothing low where the battery sits, and respect pyrotechnic/restraint areas. *(Source: ERG p.18, p.21; Video 2 ~00:12:09–00:12:30)*
4. **Do not cut through the floor** above the HV battery during a fire/thermal-runaway containment phase — it risks worsening the battery reaction. *(Source: ERG p.31)*

---

**Bottom line:** Laminated glass means more glass *sawing* and longer access times; carbon-fiber structure adds a **respiratory dust hazard requiring SCBA/respiration** and tougher, slower cuts. Combine that with the standard EV rules — 12V down before cutting, no orange-cable/low cuts, no sparks near battery smoke — and budget extra time and PPE for these newer vehicles.

Want me to pull the Mach-E no-cut-zone diagram callouts (ERG p.25) or the specific 12V disconnect location next?

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy' · 5 nodes reached._

Concepts surfaced:
- EV emergency response training session (part 3)
- manual disconnect device (prefer over cutting cables for storage)
- Tesla Model S battery (stacked AA-size lithium cells)
- thermal runaway / let-it-burn fire strategy
- home Level 2 charger installation discussion

Source documents:
- `Talk/VID_20250912_134205_00_013_014_segments.json`

---

### Q17. What are the hazards of cutting into gas-charged struts or seat pretensioners?

> **🔁 Vehicle-named retest:** *"On a Volkswagen ID.4 2025, what are the hazards of cutting into gas-charged struts or seatbelt pretensioners, and where are they?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Volkswagen ID.4 2025)**

**Volkswagen ID.4 2025**

⚠️ **SAFETY-CRITICAL — STORED/EXPANSIVE ENERGY**
For all stored or carried energy sources — pyrotechnic seat belt pretensioners, airbags, and **gas-pressure (gas-charged) struts** — there is a risk of **sudden, expansive discharge after an accident**. Do NOT cut into, strike, crush, or apply heat to these components. Cutting can cause violent rupture/projectile hazards, sharp edges, and release of pressurized gas or pyrotechnic byproducts that endanger both responders and occupants. Always wear PPE per local standards. *(Source: ERG p.48–50)*

---

### Hazards of cutting these components

**Gas-charged / gas-pressure struts (and other pressurized accumulators)**
- Risk of an **expansive (explosive) discharge** if damaged after a crash. *(Source: ERG p.49)*
- VW also notes some models carry **compressed-air accumulators** (e.g., air suspension, AC). **Do not damage these accumulators and never open them with force.** *(Source: ERG p.57)*

**Seat belt pretensioners (pyrotechnic / spring-loaded)**
- Reduce belt slack within ~10 ms; can roll up ~8 inches almost instantly.
- **Pretensioners should not be damaged with rescue equipment — avoid striking this area.**
- ⚠️ **Pretensioners with mechanical triggering that have NOT fired can still trigger even after the battery has been disconnected.**
- If the situation allows, **loosen or cut off the seat belt webbing itself as soon as possible** to neutralize the threat.
- Note: disconnecting the HV system does **not** de-power the restraint systems — airbags and pretensioners remain supplied by the 12V system/DC converter. *(Source: ERG p.75–76, p.25)*

---

### Where the seat belt pretensioners are located

The ID.4 may use different installation variants. Pretensioners (front and rear) are found in these areas:

- **B-pillar** — below or above the automatic belt retractor (compact or cylinder type)
- **Seat frame** — lap-belt section of a front double pretensioner (B-pillar shoulder section + seat-frame lap section together)
- **Side member (next to the seat)** — external pretensioner components
- **Behind the rear seat backrest / rear shelf** — rear compact pretensioners
- **Wheel housing / C-pillar area** — separate rear pretensioner
- **Side member / B-pillar** — separately mounted lap-belt tensioner

*(Source: ERG p.76–79)*

### Where gas-charged struts / accumulators are located
The ERG identifies gas-pressure struts and compressed-air accumulators as general stored-energy hazards but does not give a single fixed location — struts are typically associated with the hood/tailgate, and compressed-air accumulators with air-suspension/AC systems. **For the exact model-specific positions of struts, reinforcement zones, and no-cut areas, consult the ID.4 Rescue Sheet/rescue card diagram, which VW references for component placement.** *(Source: ERG p.49, p.57, p.42)*

---

**Bottom line for extrication:** Treat the B-pillars, seat frames, side members, rear shelf/C-pillar, and any strut/accumulator as **no-cut / no-strike zones**. Cut belt webbing rather than the pretensioner mechanism, and remember unfired pretensioners can deploy even after power is removed.

If you'd like, I can pull the ID.4 Rescue Sheet callouts for the precise strut and reinforcement positions.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I'd be glad to help with information on the hazards of cutting into gas-charged struts or seat-belt pretensioners — but first I need to know which vehicle you're working with, since pretensioner and gas-generator locations vary by model.

**GENERIC — confirm vehicle before relying on this:**

General hazards of cutting into pyrotechnic/gas-charged components on any EV:

- **Seat-belt pretensioners** contain pyrotechnic (explosive) charges. Cutting into or applying heat to them can cause unexpected deployment, firing metal components and hot gas that can cause serious injury to responders or trapped occupants.
- **Gas-charged struts/cylinders** (hood, hatch, tailgate lifts) are under high pressure. Cutting or applying heat can cause violent rupture, launching fragments or the strut shaft like a projectile.
- **Airbag inflators / gas generators** can deploy with great force if cut into or heated; maintain clearance from all inflation modules.
- General mitigation: identify and avoid all no-cut zones; disconnect the 12V battery and allow capacitor stored-energy time to drain before extrication cutting; keep clear of the deployment path; never apply a heat source (torch/saw friction) directly to these components.

This is generic guidance only and is **not** model-specific.

To give you the exact pretensioner, gas-generator, and no-cut zone locations and the correct procedure, please confirm the **make, model, and year** of the vehicle. Supported vehicles are:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy' · 5 nodes reached._

Concepts surfaced:
- EV emergency response training session (part 3)
- Tesla Model S battery (stacked AA-size lithium cells)
- thermal runaway / let-it-burn fire strategy
- manual disconnect device (prefer over cutting cables for storage)
- home Level 2 charger installation discussion

Source documents:
- `Talk/VID_20250912_134205_00_013_014_segments.json`

---

### Q18. What are the safety requirements and distance perimeters for storing a damaged EV after it has been towed from an accident scene?

> **🔁 Vehicle-named retest:** *"After towing a damaged Ford Mustang Mach-E 2026 from a scene, what are the storage distance perimeters and safety requirements?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Ford Mustang Mach-E 2026)**

**Ford Mustang Mach-E 2026**

⚠️ **SAFETY-CRITICAL WARNINGS**
- Lithium-ion batteries can ignite spontaneously or **re-ignite after a fire has been extinguished**. There is a potential for **delayed fire** with damaged lithium-ion batteries. Always assume the HV battery and components are energized and fully charged.
- Venting/off-gassing HV battery vapors are **potentially toxic and flammable**. Keep the passenger and cargo compartments ventilated.
- Wear appropriate PPE. Confirm the HV system has been deactivated (Section 3) before storage.

---

### Storage Distance Perimeter
- **Do NOT store a severely damaged vehicle inside a structure, any enclosed container, or within 15 m (50 ft) of any structure or vehicle.**

This 50 ft (15 m) standoff applies to any vehicle involved in an accident or with a damaged/unstable HV battery.

### Storage Safety Requirements
1. **Contact an authorized Ford or Lincoln Dealer as soon as possible** — additional steps may be necessary to secure, handle, and/or store the HV battery and vehicle.
2. **Maintain ventilation** of the passenger and cargo compartments.
3. **Continue inspecting** the vehicle prior to and while in storage/tow lot for:
   - Leaking fluids
   - Sparks, smoke, flames
   - Gurgling or bubbling sounds from the HV battery
   - **Call 911 if any of these are detected.**
4. **Maintain clear access** to stored vehicles for monitoring and emergency response.
5. **Do NOT place load on HV components.**
6. **DO NOT ATTEMPT TO DISCHARGE THE HV BATTERY.**
7. Securing straps must **not contact or apply force to HV components** — avoid winching or placing straps over or near HV components; use non-conductive materials as needed.

*Source: ERG p.36; Rescue Sheet p.3 (Section 8 — Towing/Transportation/Storage); ERG p.33*

---

### Related Transport/Handling Reminders
- **Do not tow with wheels on the ground** — this may cause the vehicle to generate electricity and cause damage. Use a flatbed/trolley.
- Before storage, if water was used during firefighting, allow the battery to drain (≤1 drop/second for 5 minutes, both level and inclined per the winching procedure).
- Keep keys/fob at least **5 m (16 ft)** away until loading.
- If the HV battery was involved in fire, firefighting personnel should remain on scene and be prepared to resume containment until the OIC has deemed the vehicle safe for transport — **resumption of thermal runaway after containment remains possible**.

*Source: ERG p.34–35*

If you'd like, I can walk through the full pre-transport water-drain procedure or the HV system deactivation steps (Section 3).

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

I need to know which vehicle you're asking about before I can give you the authoritative storage/quarantine guidance, since these requirements vary by manufacturer.

In the meantime, here is general interim guidance:

**GENERIC — confirm vehicle before relying on this:**
- Treat the damaged EV as energized at all times; stranded energy and delayed re-ignition/thermal runaway can occur hours or even days after the incident.
- Store the vehicle outdoors, on a non-combustible surface, away from buildings, other vehicles, vegetation, and anything flammable.
- Maintain a quarantine perimeter of at least **15 m (50 ft)** around the vehicle as a common baseline — but confirm the exact distance from the specific manufacturer's ERG, as it varies.
- Chock the wheels; the vehicle may move silently if it remains powered.
- Keep the key/fob at least 5 m away to prevent inadvertent power-up.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire — cool with copious water for an extended period.
- Monitor the HV battery pack for heat, smoke, off-gassing, or bubbling/hissing well after the fire appears out. Thermal imaging is useful for ongoing monitoring.
- Have a charged hose line or large volume of water readily available during storage in case of re-ignition.

This is generic guidance only and is **not** model-specific.

To give you the correct, authoritative storage requirements and distance perimeters, please confirm the **make, model, and year** of the vehicle. Supported vehicles are:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'thermal runaway / let-it-burn fire strategy', 'Ford Mustang Mach-E 2026 ERG', 'Ford F-150 Lightning 2026 ERG' · 28 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- Fire Suppression / Li-Ion Battery Fire Guidance
- High Voltage Disconnect / Service Disconnect
- 12V / Low Voltage Battery
- Tesla Model S 2021 Rescue Sheet
- First Responder Cut Loop / Cable Cut
- Immobilization / Stabilization / Lifting Points
- Nissan Ariya 2026 ERG
- Ford F-150 Lightning 2026 ERG
- Hyundai IONIQ 5 2025 ERG
- EV emergency response training session (part 3)
- Rivian R1T 2025 ERG
- Ford Mustang Mach-E 2026 Rescue Sheet
- Ford Mustang Mach-E 2026 ERG
- Ford F-150 Lightning 2026 Rescue Sheet
- GM BrightDrop Zevo 400/600 2022-2024 ERG
- BMW iX3 2027 Rescue Sheet
- Volkswagen ID.4 2025 ERG
- Tesla Model S 2021 ERG
- Chevrolet Equinox EV 2024 ERG
- Chevrolet Bolt EV 2022-2023 ERG
- Cadillac Lyriq 2023 ERG
- Chevrolet Blazer EV 2024 ERG
- Tesla Model S battery (stacked AA-size lithium cells)
- manual disconnect device (prefer over cutting cables for storage)
- thermal runaway / let-it-burn fire strategy
- Emergency Shutdown / Power Down Procedure
- home Level 2 charger installation discussion

Source documents:
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Ford-Mach-E-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-GM-Brightdrop-Zevo_400_600-2022-2024.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/EmergencyResponseGuide-Volkswagen2025(ID.4).pdf`
- `vehicle_docs/EmergencyResponseGuide-r1t-en-us-20251219_BEV_1.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletBlazerEV_SUV_2024_5d_Electric_EN_ERG_3GN-23101.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletEquinoxEVSUV20245dElectricENERG3GN23105.pdf`
- `vehicle_docs/EmergencyResponseGuide_Cadillac_Lyriq_2023-.pdf`
- `vehicle_docs/EmergencyResponseGuide_Chevrolet_Bolt_EV_2022-2023.pdf`
- `vehicle_docs/EmergencyResponseGuide_Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-BMW-iX3-2027_BEV_1.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Ford-Mach-E-2026.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`

---

### Q19. If an EV is completely submerged in water, does it pose a high-voltage shock hazard to rescue teams?

> **🔁 Vehicle-named retest:** *"If a Rivian R1T 2025 is completely submerged in water, does it pose a high-voltage shock hazard to my rescue team?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Rivian R1T 2025)**

**Rivian R1T 2025**

**Short answer: No.** Per Rivian's guidance, there is **no increased risk of electrocution from immersion in water** — a submerged R1T does not electrify the surrounding water.

Key points for your team:

- **No shock hazard from the water itself.** The Rescue Sheet states plainly: "There is no increased risk of electrocution from immersion in water." (Source: Rescue Sheet p.4)
- **Microbubbling is normal and not dangerous.** You may see small bubbles in the water near the vehicle. This is **not** a sign that the water is electrified or will cause a shock. (Source: ERG p.11)

Important cautions that still apply:

1. **Always remove the submerged vehicle from the water before** you attempt to deactivate, tow, or transport it. (Source: ERG p.11 / Rescue Sheet p.4)
2. **Wear appropriate PPE** when entering the water or removing/towing the vehicle — especially if the battery is damaged, since water may have entered the battery case. (Source: ERG p.11)
3. **Do not attempt the recovery alone — get help.** (Source: ERG p.11)
4. **Never attempt to charge** a high-voltage battery that has been submerged, is gassing, or shows external damage. (Source: ERG p.11)
5. **Treat the vehicle as energized.** A damaged HV battery can remain energized and the vehicle can move silently — approach from the side. Lithium-ion batteries can also self-ignite or reignite, even days later, so monitor the pack after recovery (use a thermal imaging camera; isolate at least 50 ft / 15 m from other vehicles and structures). (Source: ERG p.11, p.14)

Bottom line: the water around a submerged R1T is not a shock hazard to rescuers, but treat the battery/HV components as energized, use PPE, and remove the vehicle from the water before any deactivation or towing.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

GENERIC — confirm vehicle before relying on this:

For a fully submerged EV, here is baseline interim guidance only (not model-specific):

- **Shock risk in the water is generally considered low** for a properly designed, sealed HV system. EV high-voltage systems are electrically isolated from the vehicle chassis and from the surrounding water, and the pack is designed to shut down/isolate on detecting a fault or loss of isolation. Standard guidance is that responders are **not** likely to be electrocuted by touching the vehicle or the water around it.
- **Still treat the vehicle as energized at all times.** Do not assume the HV system is safe.
- Once the vehicle is recovered, **do not touch HV cabling, connectors, or damaged battery components** with bare hands — use insulated HV-rated PPE.
- After removal from water, a submerged HV battery can experience **delayed thermal runaway and re-ignition**, sometimes hours or days later. Move the vehicle well clear of structures and other vehicles, and monitor it.
- Chock the wheels and keep the key/fob at least 5 m away — the vehicle may move silently if it powers up.
- For a battery fire, do **not** use ABC/dry-chemical extinguishers; cool with copious water for an extended period.

This is generic guidance only and is **not** specific to any one vehicle.

**To give you the authoritative, vehicle-specific submersion/water-rescue procedure, please confirm the make, model, and year.** I support these vehicles:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'High Voltage Battery Pack', 'High Voltage Disconnect / Service Disconnect', "high-voltage orange cable safety ('if it is orange, do not mess with it')" · 34 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- High Voltage Disconnect / Service Disconnect
- Fire Suppression / Li-Ion Battery Fire Guidance
- 12V / Low Voltage Battery
- First Responder Cut Loop / Cable Cut
- Immobilization / Stabilization / Lifting Points
- Tesla Model S 2021 Rescue Sheet
- Nissan Ariya 2026 ERG
- Ford F-150 Lightning 2026 ERG
- Ford F-150 Lightning 2026 Rescue Sheet
- Hyundai IONIQ 5 2025 ERG
- Volkswagen ID.4 2025 Rescue Sheet
- Rivian R1T 2025 ERG
- EV emergency response training session (part 1)
- BMW iX3 2027 Rescue Sheet
- Tesla Model S 2021 ERG
- GM BrightDrop Zevo 400/600 2022-2024 ERG
- Hyundai IONIQ 5 2025 Rescue Sheet
- Ford Mustang Mach-E 2026 Rescue Sheet
- Volkswagen ID.4 2025 ERG
- Ford Mustang Mach-E 2026 ERG
- Chevrolet Bolt EV 2022-2023 ERG
- GM BrightDrop Zevo 600 2023-2024 Rescue Sheet
- Chevrolet Equinox EV 2024 ERG
- Rivian R1T 2025 Rescue Sheet
- Cadillac Lyriq 2023 ERG
- Chevrolet Blazer EV 2024 ERG
- Vehicle Identification / Recognition
- ERG cut-battery-cables / relay-removal de-energizing procedure
- instructor Barry Smith (SE Community College)
- Airbag / SRS Components (inflators, pretensioners, control unit)
- Emergency Shutdown / Power Down Procedure
- high-voltage orange cable safety ('if it is orange, do not mess with it')
- 12-volt jumpstart / wake-up of dead EV

Source documents:
- `Talk/VID_20250912_110210_00_007_009_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Ford-Mach-E-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-GM-Brightdrop-Zevo_400_600-2022-2024.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/EmergencyResponseGuide-Volkswagen2025(ID.4).pdf`
- `vehicle_docs/EmergencyResponseGuide-r1t-en-us-20251219_BEV_1.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletBlazerEV_SUV_2024_5d_Electric_EN_ERG_3GN-23101.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletEquinoxEVSUV20245dElectricENERG3GN23105.pdf`
- `vehicle_docs/EmergencyResponseGuide_Cadillac_Lyriq_2023-.pdf`
- `vehicle_docs/EmergencyResponseGuide_Chevrolet_Bolt_EV_2022-2023.pdf`
- `vehicle_docs/EmergencyResponseGuide_Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-BMW-iX3-2027_BEV_1.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Ford-Mach-E-2026.pdf`
- `vehicle_docs/RescueSheet-GM-Brightdrop-Zevo_600-2023-2024.pdf`
- `vehicle_docs/RescueSheet-Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Volkswagen-ID4-2025.pdf`
- `vehicle_docs/RescueSheet-r1t-en-us-20251219_BEV_1.pdf`

---

## Charging & Infrastructure Issues

### Q20. What are the common safety issues or fire risks associated with residential or commercial EV chargers?

**n8n RAG webhook**

**Ford Mustang Mach-E 2026 — First Responder Training (charger safety / fire risks)**

The training discussion of EV charging hazards is specific to the Mach-E First Responder training video. Here is what the instructor covered regarding residential and commercial charger safety issues and fire risks:

⚠️ **Critical safety warnings — charging cables**
- **Never cut through a charging cable.** This applies to both home (Level 1/AC) and commercial chargers.
- **DC fast charging (Level 3) is over 400 volts** — extremely serious. Your goal is to *disconnect*, never to cut. (*Source: Video 1 — Exterior Walk-Around ~00:26:32–00:27:15*)
- If a vehicle is damaged with any fire risk but is **still connected to a charger, get the charger off of it** — disconnect rather than cut. (*Source: Video 1 — Exterior Walk-Around ~00:26:32*)

**Common safety issues / fire risks associated with chargers and EV charging**

1. **Chargers can and have started fires.** The instructor acknowledged that nationwide there have been fires started in connection with EV chargers and charging. (*Source: Video 2 — Interior / Underside ~00:17:05–00:17:15*)

2. **High voltage / shock hazard at the connector.** DC fast chargers operate above 400 V, so the energized connection itself is a serious electrocution risk. Disconnecting high-energy Level 3 chargers can also be complicated because of the stored/high energy involved. (*Source: Video 1 — Exterior Walk-Around ~00:26:48–00:27:15*)

3. **Charger-connected vehicle damage** raises the chance of fire while charging energy is still flowing — hence the priority to remove/disconnect the charger from a damaged vehicle. (*Source: Video 1 — Exterior Walk-Around ~00:26:32*)

4. **Battery thermal-runaway risk** (which can be triggered or worsened around charging/damage scenarios): lithium cells are packed tightly inside a strong metal enclosure, so once one cell gasses and ignites, fire spreads rapidly and is very hard to reach with extinguishing agents. A lithium battery fire can reach **2,000–3,000°F**. (*Source: Video 2 — Interior / Underside ~00:00:00–00:01:22 and ~00:06:07–00:06:56*)

5. **Delayed / post-incident ignition.** Fires can start or re-ignite **long after** a crash because of physical damage to the battery that lets electrolyte escape — often not easy to assess at the scene. (*Source: Video 1 — Exterior Walk-Around ~00:06:27–00:07:24*)

**Recommended precautions from the training**
- Disconnect (do not cut) the charging cable from a damaged/at-risk vehicle.
- **Never bring a crash-damaged EV inside a building for storage** — store it outside.
- Maintain a **minimum 50-foot separation** from structures or objects you don't want to lose when storing a potentially damaged EV. (*Source: Video 1 — Exterior Walk-Around ~00:06:27–00:09:16*)
- Wear proper HV-rated PPE when working a vehicle you cannot confirm is de-energized.

Note: This guidance comes from the Mach-E 2026 training session. If you need charger or fire-response procedures for a **different vehicle**, tell me the make, model, and year and I'll pull that vehicle's source.

**graphify graph**

_Traversal start: 'Fire Suppression / Li-Ion Battery Fire Guidance', 'thermal runaway / let-it-burn fire strategy' · 31 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- High Voltage Disconnect / Service Disconnect
- Fire Suppression / Li-Ion Battery Fire Guidance
- 12V / Low Voltage Battery
- Tesla Model S 2021 Rescue Sheet
- Nissan Ariya 2026 ERG
- Ford F-150 Lightning 2026 ERG
- Ford Mustang Mach-E 2026 Rescue Sheet
- Hyundai IONIQ 5 2025 Rescue Sheet
- Rivian R1T 2025 ERG
- Tesla Model S 2021 ERG
- Volkswagen ID.4 2025 ERG
- Hyundai IONIQ 5 2025 ERG
- Ford Mustang Mach-E 2026 ERG
- GM BrightDrop Zevo 400/600 2022-2024 ERG
- Ford F-150 Lightning 2026 Rescue Sheet
- Volkswagen ID.4 2025 Rescue Sheet
- EV emergency response training session (part 3)
- Chevrolet Bolt EV 2022-2023 ERG
- GM BrightDrop Zevo 600 2023-2024 Rescue Sheet
- Rivian R1T 2025 Rescue Sheet
- Chevrolet Equinox EV 2024 ERG
- Cadillac Lyriq 2023 ERG
- Chevrolet Blazer EV 2024 ERG
- Airbag / SRS Components (inflators, pretensioners, control unit)
- Emergency Shutdown / Power Down Procedure
- Tesla Model S battery (stacked AA-size lithium cells)
- manual disconnect device (prefer over cutting cables for storage)
- Vehicle Identification / Recognition
- thermal runaway / let-it-burn fire strategy
- home Level 2 charger installation discussion

Source documents:
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Ford-Mach-E-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-GM-Brightdrop-Zevo_400_600-2022-2024.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/EmergencyResponseGuide-Volkswagen2025(ID.4).pdf`
- `vehicle_docs/EmergencyResponseGuide-r1t-en-us-20251219_BEV_1.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletBlazerEV_SUV_2024_5d_Electric_EN_ERG_3GN-23101.pdf`
- `vehicle_docs/EmergencyResponseGuideChevroletEquinoxEVSUV20245dElectricENERG3GN23105.pdf`
- `vehicle_docs/EmergencyResponseGuide_Cadillac_Lyriq_2023-.pdf`
- `vehicle_docs/EmergencyResponseGuide_Chevrolet_Bolt_EV_2022-2023.pdf`
- `vehicle_docs/EmergencyResponseGuide_Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Ford-Mach-E-2026.pdf`
- `vehicle_docs/RescueSheet-GM-Brightdrop-Zevo_600-2023-2024.pdf`
- `vehicle_docs/RescueSheet-Hyundai-IONIQ_5-2025.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Volkswagen-ID4-2025.pdf`
- `vehicle_docs/RescueSheet-r1t-en-us-20251219_BEV_1.pdf`

---

### Q21. If an EV is currently plugged into a DC fast charger at a station, is it safe to cut the charging cable during an emergency?

> **🔁 Vehicle-named retest:** *"A Tesla Model S 2021 is plugged into a DC fast charger — is it safe to cut the charging cable in an emergency?"*
> **Outcome: 🟢 Grounded** — was 🟡 Generic deferral. Sourced answer below; original vehicle-agnostic exchange kept beneath for comparison.

**n8n RAG webhook — retest (Tesla Model S 2021)**

**Tesla Model S 2021**

⚠️ **Do NOT cut the charging cable.** This is not an approved emergency procedure and is dangerous — a DC fast charger delivers high-voltage DC current through that cable, and cutting it creates a serious electrocution and arc-flash hazard.

**What to do instead:**

1. **Stop the charging session at the source.** Disconnect power at the charging station / EVSE — use the charger's emergency stop button or shut off power to the unit (or the building circuit feeding it) before touching anything.
2. **Unplug the connector** from the vehicle's charge port once charging has stopped — do not cut it.
3. **De-energize the vehicle using the approved method** — not the cable:
   - Open the hood and remove the access panel next to the windshield.
   - **Double cut the First Responder Loop** and remove the cut section. This removes low-voltage power to the HV contactors, isolating high voltage to the battery pack.
   - **Then disable the low-voltage (12V) battery** by double cutting the negative battery cable (avoid contacting both terminals).

**Critical safety warnings:**
- **Never cut an orange high-voltage cable** and never cut into or compromise the HV battery pack. Always assume orange cables and the pack are energized.
- After deactivation, the **HV circuit needs ~2 minutes to de-energize**. Always assume all HV components remain energized and wear full HV-rated PPE.
- The HV battery is **always energized** — these procedures only isolate HV to the pack; they do not discharge the cells.

*Source: ERG p.7, p.9–10 (First Responder Loop / 12V battery), and p.23, p.31 (no-cut zones / energized-component warnings).*

If the connector is involved in fire or arcing and cannot be safely removed, shut down power at the station and treat the entire vehicle as energized — full PPE including SCBA.

If you can tell me the specific situation (fire involved, occupant trapped, charger type), I can give more targeted guidance.

<sub>↓ Original vehicle-agnostic phrasing (deferred) — kept for comparison ↓</sub>

**n8n RAG webhook**

GENERIC — confirm vehicle before relying on this:

I don't yet know which specific vehicle you're dealing with, so here is baseline interim guidance only (not model-specific):

- **Do NOT cut the charging cable.** A DC fast charger carries very high voltage and current. Cutting the cable is extremely dangerous and is never a recommended emergency action.
- **Stop charging the correct way first:** press the charger's emergency stop button, then disconnect/unplug at the connector if it's safe to do so. Most stations and vehicles will de-energize the cable automatically when charging is stopped or the connector is released.
- **De-energize the station** at the main disconnect if available and trained to do so.
- Treat the vehicle and cable as energized until confirmed otherwise.
- Power the vehicle off; keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Wear insulated PPE rated for HV work.
- For any battery fire: do NOT use ABC/dry-chemical extinguishers — cool with copious water and watch for stranded energy and delayed re-ignition.

This is generic guidance only and is **not** model-specific.

To give you the authoritative, vehicle-specific procedure, please confirm the **make, model, and year** of the EV. Supported vehicles I can pull exact data for:

- BMW iX3 2027
- Cadillac Lyriq 2023
- Chevrolet Blazer EV 2024
- Chevrolet Bolt EV 2022–2023
- Chevrolet Equinox EV 2024
- Ford F-150 Lightning 2026
- Ford Mustang Mach-E 2026
- GM BrightDrop Zevo 400/600 2022–2024
- Hyundai IONIQ 5 2025
- Nissan Ariya 2026
- Rivian R1T 2025
- Tesla Model S 2021
- Volkswagen ID.4 2025

**graphify graph**

_Traversal start: 'charging cable disconnect (never cut, DC fast charge >400V, locked plug)', 'thermal runaway / let-it-burn fire strategy', 'Emergency Shutdown / Power Down Procedure' · 18 nodes reached._

Concepts surfaced:
- High Voltage Battery Pack
- High Voltage Disconnect / Service Disconnect
- Fire Suppression / Li-Ion Battery Fire Guidance
- Tesla Model S 2021 Rescue Sheet
- Ford F-150 Lightning 2026 ERG
- EV emergency response training session (part 3)
- EV emergency response training session (part 2)
- Tesla Model S 2021 ERG
- Ford F-150 Lightning 2026 Rescue Sheet
- Emergency Shutdown / Power Down Procedure
- Tesla Model S battery (stacked AA-size lithium cells)
- thermal runaway / let-it-burn fire strategy
- manual disconnect device (prefer over cutting cables for storage)
- instructor Barry Smith (SE Community College)
- Ford Mustang Mach-E walk-around
- battery module conductor plate / coolant heat transfer
- home Level 2 charger installation discussion
- charging cable disconnect (never cut, DC fast charge >400V, locked plug)

Source documents:
- `Talk/VID_20250912_110210_00_007_009_segments.json`
- `Talk/VID_20250912_122900_00_010_012_segments.json`
- `Talk/VID_20250912_134205_00_013_014_segments.json`
- `vehicle_docs/EmergencyResponseGuide-Ford-Lightning-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf`
- `vehicle_docs/EmergencyResponseGuide-Tesla-Model_S-2021.pdf`
- `vehicle_docs/RescueSheet-Ford-Lightning-2026.pdf`
- `vehicle_docs/RescueSheet-Tesla-Model_S-2021.pdf`

---

---

## Vehicle-Specific Replacement Questions

_The three out-of-scope refusals (old Q4 BEV-vs-PHEV, Q11 thermal-runaway chemistry, Q22 Level-3 charger arc-flash) were removed. Below are **5 vehicle-specific replacements** — question topics mined from the graphify graph (HV disconnect, lifting points, cut/no-cut zones, airbag & pretensioner locations, HV shutdown), each pointed at a different supported vehicle. All five returned grounded, source-cited answers._


### R1. On a Hyundai IONIQ 5 2025, where is the high-voltage disconnect and how do I isolate it?

**Topic source (graphify):** cross-vehicle concept node confirmed present for Hyundai IONIQ 5 2025.

**n8n RAG webhook — 🟢 Grounded (Hyundai IONIQ 5 2025)**

**Hyundai IONIQ 5 2025**

⚠️ **ELECTROCUTION RISK — read first:**
- After disabling the vehicle, **wait more than 5 minutes** for the high-voltage system capacitors to discharge before touching HV components.
- HV cabling is **orange** and runs under the floor. **Never cut or touch** orange cables, connectors, or HV components before the system is disabled.
- If HV components are exposed by damage, wear insulated HV-rated PPE.

**Where the high-voltage disconnect is**
- The **High-Voltage Cut-off Switch** is located inside the **fuse box in the motor compartment (under the hood)**.

**How to isolate it — full disabling sequence (Power Off → 12V → HV shut-off):**
1. **Power the vehicle off.** Keep the key/fob **5 m (16.4 ft) or more** away to prevent accidental restart.
2. **Disconnect the 12V battery negative (–) terminal** (depowers the SRS/airbag and battery management system).
3. **Wait at least 5 minutes** for the HV capacitors to discharge.
4. **Remove the fuse box cover** in the motor compartment.
5. **Disconnect the High-Voltage Cut-off Switch** to isolate the HV battery.

**Notes:**
- Stabilize/chock the vehicle before disabling — it can move silently if powered.
- For complete de-energizing (e.g., after a fire or for stranded-energy mitigation), the ERG also references discharging the HV battery (ERG p.21–22) and using a thermal imaging camera to confirm the pack is cooled before clearing the scene.
- Do **not** attempt to remove a safety plug while the vehicle is in water.

Source: ERG p.6, p.9 (Section 3.3); Rescue Sheet p.2

Want the 12V battery location, HV battery pack location, or thermal-runaway/fire procedure next?

---

### R2. For a Rivian R1T 2025 that's come to rest on its roof, where are the safe lifting and stabilization points?

**Topic source (graphify):** cross-vehicle concept node confirmed present for Rivian R1T 2025.

**n8n RAG webhook — 🟢 Grounded (Rivian R1T 2025)**

**Rivian R1T 2025**

⚠️ **Safety-critical cautions before you stabilize/lift:**
- **Never place jacks, lifting equipment, or rescue airbags under the HV battery pack.** The lithium-ion HV battery (up to 450 V) and HV cables run beneath the floor/along the axles. Lift ONLY at the designated frame-rail points.
- **Adjustable air suspension:** The vehicle can shift or sag even when stationary. Use additional cribbing/cribbing for any rollover or unstable scenario.
- Because this vehicle has come to rest **on its roof**, the normal under-vehicle jack points are now uppermost — your priority is to crib and stabilize the inverted vehicle (box-crib at the strongest body/pillar contact points and roof structure) before any lifting or extrication. Treat the vehicle as energized at all times.

**Designated safe lift points (frame rails):**
- **Front jack location** — front frame rail
- **Rear jack location** — rear frame rail

These are the only two approved lifting locations. Do not lift under the battery pack.

**Stabilization steps (adapt for the inverted position):**
1. Chock the wheels — at least one wheel on each side of the vehicle.
2. Build cribbing as needed; account for the air suspension shifting/sagging and the rollover orientation.
3. If accessible, open the curbside door (MY 2025 = right side) for access.
4. Confirm/place the vehicle in **P (Park)** — if the display reads "Ready," the HV system is on; press the brake and press P on the drive stalk.

**For extrication with a hydraulic ram:** Stay **above floor level** and do not use the floor inward of the door sill, to avoid contacting/damaging the HV battery pack below.

Source: Rescue Sheet p.2 and p.4; ERG p.3–5, p.9

If you'd like, I can pull the full HV shutdown/cut-loop disconnect procedure or the occupant-access steps next.

---

### R3. On a Volkswagen ID.4 2025, where are the designated cut points and which structural areas are no-cut zones?

**Topic source (graphify):** cross-vehicle concept node confirmed present for Volkswagen ID.4 2025.

**n8n RAG webhook — 🟢 Grounded (Volkswagen ID.4 2025)**

**Volkswagen ID.4 2025**

⚠️ **Safety first:**
- Before any cutting, de-energize the vehicle: confirm power display reads "OFF," disable the HV system via a manufacturer emergency cut-out connection, and disconnect the 12V battery. The HV battery retains stranded energy even after disconnection — **never cut, crush, open, or damage the HV battery pack.**
- Cutting high-strength/hot-formed steel produces **sharp edges** — wear appropriate PPE.
- Avoid cutting near airbags, pyrotechnic/gas generators, seat-belt pretensioners, and HV lines/components.

---

### Designated cut points (where cutting is easiest / appropriate)

- **B-pillar — cut ABOVE the safety-belt height adjuster.** This is the easiest and recommended spot to sever the pillar.
- **B-pillar lower area** — cutting is possible, but be aware the cross-section is very large there and the **seat-belt pretensioner is located in that lower zone**, so this is less preferred.
- **Door impact protection beams** — the high-strength steel pipes/profiles behind the outer door panels can be separated with powerful cutting equipment:
  - Steel pipe **above the door lock** (frontal-impact support).
  - Steel profiles **below the door lock** (side-impact protection).
  - A crash pipe may also be fitted in the front doors.

### No-cut / avoid zones (reinforced structure and hazard components)

- **B-pillar reinforcement at the belt-guide area** — additionally reinforced; specifically bypass this area.
- **B-pillar lower section** — large cross-section plus the seat-belt pretensioner.
- **Rocker/side members (sills)** — high-strength, multi-layered steel; on the EV these are extra-reinforced to **protect the HV battery underneath.**
- **Rigid passenger cell** — high-strength and hot-formed multi-layered steels (require powerful tools if cutting is unavoidable).
- **HV battery pack (underfloor), HV lines/components** — no-cut; do not damage.
- **Airbags, pyrotechnic gas generators, and seat-belt pretensioners** — avoid.

---

**Important:** The ERG repeatedly directs responders to the **model-specific Rescue Card** for the exact, labeled locations of the reinforcement zones, cut points, and component positions on this specific vehicle. Use the ID.4 rescue card alongside this guidance before making any cuts.

*Source: Emergency Response Guide pp. 42–45 (high-strength zones, B-pillar, side members, A-pillar); p. 25, 27–28 (HV disable/cut-out connections).*

If you'd like, I can pull the specific **lifting/stabilization points** or the **HV disconnect procedure** next.

---

### R4. For a Chevrolet Blazer EV 2024, where are the airbag inflators and seatbelt pretensioners I need to stay clear of during extrication?

**Topic source (graphify):** cross-vehicle concept node confirmed present for Chevrolet Blazer EV 2024.

**n8n RAG webhook — 🟢 Grounded (Chevrolet Blazer EV 2024)**

**Chevrolet Blazer EV 2024**

⚠️ **Safety first:**
- The vehicle stays energized and can move silently until fully shut down — block the wheels, apply the EPB, and shift to Park.
- **DO NOT CUT ANY ORANGE HIGH-VOLTAGE CABLES.** Avoid touching or cutting HV cables/components anywhere during extrication.
- Airbag inflators and pretensioners are pyrotechnic devices that can deploy. Stay clear of these zones and do not cut through them.

**Airbag inflators / stored-gas inflators (8 airbags total):**
- Driver airbag — in the steering wheel
- Front passenger airbag — in the instrument panel
- (2) Front knee bolster airbags — lower front instrument panel/under-dash area
- (2) Front seat outboard (side) airbags — outboard side of each front seat
- (2) Roof rail airbags — along both roof rails (A-to-C pillar roofline)

**Seat belt pretensioners:**
- **Front seats:** TWO pretensioners on each side —
  1. Seat belt retractor-mounted (B-pillar area)
  2. Seat belt anchor-mounted at the base of the seat
- **Rear outboard seats:** ONE pretensioner each, seat belt retractor-mounted

**Also keep clear of:**
- The SRS control unit (location shown on the Rescue Sheet diagram)
- Gas struts / preloaded springs (marked as a hazard category)

**High-strength-steel / "no-cut" structure** (extra caution when cutting):
- A, B, and C pillars
- Rocker panels
- Door reinforcement beams
- Floor structure (the HV battery is structural in the floor pan)

For the exact illustrated positions of each inflator, pretensioner, and the SRS control unit, refer to the labeled diagram on the Rescue Sheet.

Source: ERG p.9; Rescue Sheet p.1–2

Tip: To disable airbags before cutting, you can remove the 12V battery negative cable — but note this also disables the thermal-runaway alert and mitigation, so consider any needed power-device adjustments (seats, steering column, windows) first.

---

### R5. Walk me through the step-by-step high-voltage shutdown procedure for a Nissan Ariya 2026.

**Topic source (graphify):** cross-vehicle concept node confirmed present for Nissan Ariya 2026.

**n8n RAG webhook — 🟢 Grounded (Nissan Ariya 2026)**

# Nissan Ariya 2026 — High-Voltage System Shutdown

⚠️ **SAFETY-CRITICAL WARNINGS — READ FIRST**
- **Failure to properly shut down the HV system before any emergency response work will result in serious injury or death from electrical shock.** Always wear appropriate insulated PPE; NEVER touch HV harnesses or components without it.
- **NEVER assume the vehicle is off because it is quiet.** If the **READY indicator** OR any **charging status indicator** (LED on top of the instrument panel) is ON, the HV system is still active.
- **Always shut down the HV system BEFORE disconnecting the 12V battery.** The 12V system stays live (DC/DC converter keeps feeding it) as long as the HV system is active.
- After HV shutdown, **wait at least 10 minutes** for the HV capacitor to fully discharge (voltage drops below 60V after ~5 minutes, full discharge at 10 minutes). Do not operate any vehicle functions while waiting.
- After disconnecting the 12V battery, **wait at least 3 minutes** for the airbag (SRS) capacitor to discharge — risk of sudden airbag deployment.
- If the HV battery is deformed, broken, or cracked, **do NOT touch** the battery or HV components — use PPE and extreme caution.

---

## Primary Procedure (recommended)
**Turn OFF the power switch and disconnect the 12V battery.**

1. Place the selector lever into **Park (P)** and apply the **parking brake**; set **wheel chocks** to fully immobilize the vehicle.
2. If a **charge connector** is attached, remove it (this also deactivates HV components used during charging).
3. **Turn OFF the power switch.**
4. Keep the **Nissan Intelligent Key® at least 5 meters (16 ft)** away from the vehicle to prevent it accidentally turning the EV system back ON.
5. **Verify the READY indicator (and charging indicators) are OFF** — confirm the HV system is stopped.
6. Before disconnecting the 12V battery, if needed, lower the windows, unlock the doors, and open the rear hatch (power controls will stop working once the 12V is disconnected).
7. **Disconnect the 12V battery negative (–) cable**, then **insulate the negative terminal with insulated tape.**
8. **Wait at least 10 minutes** for complete discharge of the HV capacitor after the power switch was turned OFF.
9. Proceed with emergency response / extrication. (After HV shutdown, take absolute care not to cut or damage any HV wiring, battery, or components within 10 minutes; extrication of occupants can begin immediately.)

*Source: ERG p.23–24, 27–29*

---

## Alternate Procedures
If the power switch cannot be turned off, use one of these instead (both still require disconnecting the 12V battery as above):

- **Alternate Procedure 1 — Remove Fuses:** Remove the fuses for the high-voltage control system, then disconnect the 12V battery. *(ERG p.30)*
- **Alternate Procedure 2 — Remove Service Plug:** Remove the **service plug** (located in the center area of the HV battery — manually removing it cuts off HV output), then disconnect the 12V battery. *(ERG p.32)*

*Source: ERG p.16–17, 77*

---

**Built-in shutoff systems for reference:**
- **Service plug** — center of HV battery; manual removal cuts HV output.
- **System main relay** — inside HV battery, controlled by the power switch.
- **Emergency shut-off system** — automatically cuts HV in qualifying collisions (airbag deployment, certain rear impacts) or system faults.
- **Charge connector removal** — deactivates HV components active during charging.

Would you like the specific fuse locations or the service plug removal steps next?

---

## Opus 4.6 router re-test (2026-06-22)

_The live router model was switched from **Claude Opus 4.8** to **Claude Opus 4.6**, and all 24 grounded prompts above (the 16 vehicle-named retests + Q15/Q16/Q20 + R1–R5) were re-sent to the chat webhook with a fresh `session_id` each. The answers documented above are the Opus 4.8 baseline; this section records how Opus 4.6 differed. Latency 14–36 s/call (R5 slowest)._

### Headline: no regression

All 24 stayed 🟢 grounded and source-cited. Nothing fell through to the generic refusal, no vehicle was missed, and **every safety-critical number matched the 4.8 baseline** (water volumes 2,000–3,000 / 3,000–8,000 gal; 50 ft / 15 m storage standoff; 5-/10-min discharge waits; >400 V DC fast charge; F-150 two-cut 3 in spacing; etc.). The deferral→grounded policy behaves identically — naming the vehicle still unlocks the page-cited procedure.

Opus 4.6 trended **more verbose and structured**: more comparison tables (Q6, Q17, R5), verbatim instructor quotes (Q15, Q16), and useful extras (R2 "do NOT use a forklift," Q20 Level 1/2/3 charger breakdown, R5 all three shutdown methods with fuse labels).

### Parity summary

| Bucket | Count | Questions |
|---|---:|---|
| 🟢 Same core facts + citations, equivalent or richer | 21 | Q1, Q2, Q5, Q6, Q7, Q9, Q12, Q13, Q14, Q15, Q16, Q18, Q19, Q20, Q21, R1, R2, R3, R4, R5 (+Q8) |
| 🟡 Grounded but a hedging/scope nuance worth a look | 3 | Q3, Q8, Q10 |

### Watch-items (3)

- **Q3 (Blazer "Ready" light) — slightly less hedged.** 4.8 explicitly flagged *"the source has no color callout for the Ready light."* 4.6 dropped that caveat and asserted a **"Hands-Free Start"** system + a direct green-Ready meaning. Cleaner to read, but it states more than 4.8 would. **Verify "Hands-Free Start" is actually in the Blazer EV 2024 ERG.**
- **Q8 / Q10 (IONIQ 5 "Emergency Plug").** Both still correctly refuse to invent the feature / light-code and return the documented HV Cut-Off Switch method. 4.6 additionally **names real third-party tools** (Rosenbauer / Hi-Volt "Emergency Plug") — helpful framing, but that's outside-corpus knowledge, not the IONIQ 5 PDFs.

### Citation-drift spot-check

A few answers cite slightly different page ranges than 4.8 (same documents, overlapping ranges): Q7, Q17, Q21, R5. Most are harmless, but 4.6 added **granular specifics worth verifying against the actual PDFs** — that's where a confident-but-wrong detail would hide:

- **R5 (Ariya):** exact fuse labels/amps — *"VCM fuse (EV CONT, 10A)"*, *"HV BAT DRIVE RLY1, 40A"* — and a service-plug zipper under the rear center seat cushion.
- **Q17 (ID.4):** a "re-active hood" with gas-pressure struts + pyrotechnic fuels for pedestrian protection.
- **Q7 (F-150 Lightning):** its "Option 2 — non-urgent" basically **duplicates Option 1's steps** rather than describing the real standard procedure (4.8 was more honest: *"refer to the full ERG Non-urgent section"*). It also newly places the 12V in the **rear cargo area** (plausibly correct, but new vs. 4.8).

**Bottom line:** Opus 4.6 is on par with Opus 4.8 for this eval — same grounding policy, same numbers, generally better formatting. The only things to eyeball before relying on it are the R5 fuse specs, the Q17 re-active-hood detail, and the Q3 "Hands-Free Start" claim.

---

## Opus 4.6 Verification Appendix (2026-06-24)

The three watch-items flagged above were checked **directly against the source PDFs** in `vehicle_docs/` (text extracted with `pdftotext -layout`). Result: **2 of 3 fully confirmed; the third is a real term but supports 4.8's hedge, not 4.6's stronger claim.**

| Item | 4.6 claim | Source check | Verdict |
|---|---|---|---|
| **R5** (Nissan Ariya 2026) | Fuse labels `VCM fuse (EV CONT, 10A)` and `HV BAT DRIVE RLY1, 40A`; service-plug zipper under rear center seat cushion | ERG p.30 / p.32 | ✅ **Confirmed verbatim** |
| **Q17** (VW ID.4 2025) | "Re-active hood" lifted by gas-pressure struts + pyrotechnic fuels for pedestrian protection | ERG p.81 | ✅ **Confirmed verbatim** |
| **Q3** (Chevrolet Blazer EV 2024) | "Hands-Free Start" system + direct green-"Ready" meaning | ERG p.5 / Section 3 | ⚠️ **Term confirmed; green-"Ready" color claim NOT in source** |

### R5 — Nissan Ariya 2026 ERG · ✅ confirmed

From *Alternate Procedure 1 (Remove Fuses)*, ERG p.30:
- `• VCM fuse (EV CONT 10A)` — verbatim.
- `• 12V main relay fuse (HV BAT DRIVE RLY1 40A)` — verbatim.

From *Alternate Procedure 2 (Remove Service Plug)*, ERG p.32:
- *"Open the zipper (1) on the lower front-facing surface of the **rear center seat cushion**."* — verbatim.

All R5 specifics are grounded in the actual PDF.

### Q17 — Volkswagen ID.4 2025 ERG · ✅ confirmed

"Re-active hood" is a labeled section (TOC p.81). Verbatim text:
> *"In order to ensure optimal pedestrian protection, some Volkswagen vehicle models are equipped with an active hood. The re-active hood is lifted in the front and rear areas by pretensioned **gas-pressure struts and pyrotechnic fuels** in the event of a collision with a **pedestrian**."*

Gas-pressure struts + pyrotechnic fuels + pedestrian protection all check out.

### Q3 — Chevrolet Blazer EV 2024 ERG · ⚠️ term real, color claim unsupported

"Hands-Free Start" **is** a labeled feature in the ERG (appears twice — p.5 and Section 3), so 4.6 did not invent the term. **However**, the ERG's "Hands-Free Start" content is exclusively about **powering off** (the vehicle has no power button; it turns off when shifted to P + seat belt unbuckled + driver door opened, or via the "Vehicle Off" infotainment symbol). It says **nothing about a green "Ready" light or any indicator color.**

- 4.6 citing "Hands-Free Start" → legitimate, it's in the source.
- 4.6 asserting a green-"Ready" color meaning → still **not** in the ERG — exactly the gap 4.8 flagged with its *"the source has no color callout for the Ready light"* caveat.

**Net:** R5 and Q17 clear all watch-items. For Q3, 4.8's more hedged posture was the more accurate one; the "Hands-Free Start" label is genuine but does not back the green-light color claim.

---

## Final router model: Claude Sonnet 4.6 (2026-06-24)

_Audit-log closeout. The live router on workflow `S3uHJF57JAuA7bL0` was moved to **Claude Sonnet 4.6** (`claude-sonnet-4-6`) and **left in place as the production model.** Confirmed live via the n8n public API on 2026-06-24: node **"Anthropic Chat Model"** (`@n8n/n8n-nodes-langchain.lmChatAnthropic`), credential `UCQvHWq77alNk0u4` ("Anthropic account (Opus router)" — the credential name is historical; it now serves the Sonnet model). The earlier sections of this file are the **Opus 4.8 baseline** and the **Opus 4.6 retest**; this section records the final production choice._

### Why Sonnet 4.6 is recorded as acceptable without a fresh 24-prompt harness run

This is an **operator-confirmed** finalization, **not** a new 24-prompt webhook capture — stated plainly so the audit trail is not misread as a fresh test run. The basis:

- **The grounding/deferral behavior is model-independent.** The 2026-06-22 diagnosis established that the dominant defects were **retrieval depth (`topK` 4→10)** and a **self-contradicting system prompt**, not the model. Those fixes live in the workflow regardless of which chat model is wired in.
- **Parity was already demonstrated across two models.** Opus 4.8 (baseline) and Opus 4.6 (retest above) returned the same safety-critical numbers, the same source citations, and the same "name the vehicle -> grounded, page-cited answer" policy. No regression appeared when the model changed.
- **Sonnet 4.6 confirmed good in live operator use** ("works great") on the same webhook, same prompts, same deferral-then-ground behavior.

### Status

| Model | Role | Verification | Live now |
|---|---|---|---|
| Claude Opus 4.8 | Original post-fix router | Full 24-prompt webhook capture (above) | no |
| Claude Opus 4.6 | Re-test | Full 24-prompt retest + source-PDF verification appendix (above) | no |
| **Claude Sonnet 4.6** | **Production router** | Operator-confirmed in live use; inherits the topK/prompt fixes; parity precedent from the two Opus runs | **yes** |

**Caveat for completeness:** Sonnet 4.6 has not been put through the formal 24-prompt harness in this audit. If a future professor-facing demo needs a model-matched capture, re-send the 24 grounded prompts (the 16 vehicle-named retests + Q15/Q16/Q20 + R1-R5) with fresh `session_id`s and append a parity table here, exactly as was done for Opus 4.6.

---
