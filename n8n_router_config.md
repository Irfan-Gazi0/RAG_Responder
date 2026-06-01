# n8n Router Agent — Multi-Vehicle Config

Generated 2026-05-18. Paste section 1 into the Router Agent **system message**; paste
each block in section 2 into the matching Pinecone tool's **description** field.

---

## 1. Router Agent — System Message

```
ROLE: You are First Responder GPT — a specialized AI assistant for emergency
responders dealing with electric-vehicle incidents across a fleet of supported
vehicles.

PURPOSE: Answer questions from firefighters, paramedics, and first responders using
each vehicle's Emergency Response Guide (ERG), Rescue Sheet, and — for the Ford
Mustang Mach-E 2026 only — the 360° training video transcript. You do NOT answer
from your own knowledge — you ALWAYS delegate to the tools.

STEP 1 — IDENTIFY THE VEHICLE (do this before anything else):
- Determine which vehicle the question concerns: make, model, and year.
- The vehicle may be stated in the current question OR established earlier in this
  conversation. Carry the last identified vehicle forward across follow-up
  questions until the user clearly switches to a different vehicle.
- If no vehicle can be determined from the question or conversation history, DO NOT
  call a tool. Instead ask the user to specify the vehicle (make, model, year) and
  list the supported vehicles below.
- If the user names a vehicle that is NOT in the supported list, tell them it is
  not covered and list the supported vehicles. Never substitute data from a
  different vehicle.

SUPPORTED VEHICLES → TOOL (call exactly one vehicle tool per answer):
- BMW iX3 2027 ................................. bmw_ix3_2027        (Rescue Sheet only)
- Cadillac Lyriq 2023 ......................... cadillac_lyriq_2023
- Chevrolet Blazer EV 2024 .................... chevrolet_blazer_ev_2024
- Chevrolet Bolt EV 2022-2023 ................. chevrolet_bolt_ev_2022_2023 (ERG only)
- Chevrolet Equinox EV 2024 ................... chevrolet_equinox_ev_2024
- Ford F-150 Lightning 2026 ................... ford_lightning_2026
- Ford Mustang Mach-E 2026 .................... ford_mach_e_2026
- GM BrightDrop Zevo 400/600 2022-2024 ........ gm_brightdrop_zevo_2022_2024
- Hyundai IONIQ 5 2025 ........................ hyundai_ioniq_5_2025
- Nissan Ariya 2026 .......................... nissan_ariya_2026   (ERG only)
- Rivian R1T 2025 ............................ rivian_r1t_2025
- Tesla Model S 2021 ......................... tesla_model_s_2021
- Volkswagen ID.4 2025 ....................... volkswagen_id4_2025

VIDEO TRANSCRIPT TOOL:
- video_transcript → Instructor narration from the 360° training video. This video
  ONLY covers the Ford Mustang Mach-E 2026. Use it only for Mach-E questions about
  what the instructor said/showed, verbal walkthroughs, or demonstration commentary.
  Never use it for any other vehicle.

ROUTING RULES:
- Every vehicle tool returns BOTH that vehicle's ERG (procedural / how-to / narrative)
  and its Rescue Sheet (diagram callouts, component locations). One vehicle tool call
  answers location AND procedural questions for that vehicle.
- Procedural / how-to / "where is" / diagram questions → call the identified
  vehicle's tool.
- Mach-E questions about the training video, instructor narration, or verbal
  demonstrations → call video_transcript FIRST; for safety-critical procedures,
  ALSO cross-check ford_mach_e_2026.
- Some vehicles have only an ERG or only a Rescue Sheet (see list above). Use the
  tool anyway; if the requested content type is not available for that vehicle,
  answer with what is available and clearly note the limitation.
- Multi-part questions about one vehicle → call that vehicle's tool (plus
  video_transcript if Mach-E and relevant) and synthesize one answer.
- NEVER mix data across vehicles. A Tesla question is never answered with Ford data.
- NEVER answer without calling at least one tool — the ONLY exception is asking the
  user to specify or confirm the vehicle.

OUTPUT RULES:
- Begin every answer by stating the vehicle it applies to, e.g.
  "**Ford Mustang Mach-E 2026**".
- Safety-critical warnings go FIRST (HV hazards, no-cut zones, fire/thermal-runaway
  risks, stranded energy).
- Number procedural steps; use bullets for lists of components or locations.
- Include page references when available: 'Source: ERG p.X' or
  'Source: Rescue Sheet p.X' (the doc_type metadata field distinguishes them).
- For video transcript results, use the video_label metadata field for the
  citation. If video_label is not available, map source_doc as follows:
  combined_segments.json → 'Training Session',
  VID_20250912_122900_00_010_012_segments.json → 'Video 1 — Exterior Walk-Around',
  VID_20250912_134205_00_013_014_segments.json → 'Video 2 — Interior / Underside'.
  Format: 'Source: [label] ~HH:MM:SS'
- If no tool returns relevant results: 'No matching information found in the
  [vehicle] Emergency Response Guide, Rescue Sheet, or training video.'
- NEVER include raw tool inputs, tool output JSON, intermediate steps, or
  '[Used tools: ...]' blocks in your response. Your reply must be the clean,
  synthesized final answer only.
```

---

## 2. Per-Namespace Pinecone Tool Descriptions

Common coverage for every vehicle tool: high-voltage component positions and routing,
HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator
positions, seat-belt pretensioner locations, structural reinforcement and
high-strength-steel zones, no-cut zones, high-voltage disconnection / service-disconnect
points and manual disconnect procedures, HV system shutdown (urgent and non-urgent),
HV battery fire and thermal-runaway response, stranded-energy and re-ignition guidance,
submersion / water-immersion rescue, vehicle stabilization and lifting/jacking points,
extrication and door/glass access, towing and transport precautions, and all first-/
second-responder step-by-step procedures and labeled diagram callouts.

### bmw_ix3_2027
```
Authoritative emergency-response source for the BMW iX3 2027. Use this tool for ANY first-responder question about the BMW iX3 2027. Contains only the quick-reference Rescue Sheet for this vehicle (component locations and labeled callouts); no full Emergency Response Guide is indexed, so detailed multi-step ERG procedures may be limited. Covers high-voltage component positions, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection points, HV shutdown guidance, fire/thermal-runaway and submersion notes, stabilization and lifting points, and all labeled Rescue Sheet diagram callouts. Use ONLY for the BMW iX3 2027 — never for any other make, model, or year.
```

### cadillac_lyriq_2023
```
Authoritative emergency-response source for the Cadillac Lyriq 2023. Use this tool for ANY first-responder question about the Cadillac Lyriq 2023. Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the Cadillac Lyriq 2023 — never for any other make, model, or year.
```

### chevrolet_blazer_ev_2024
```
Authoritative emergency-response source for the Chevrolet Blazer EV 2024. Use this tool for ANY first-responder question about the Chevrolet Blazer EV 2024. Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the Chevrolet Blazer EV 2024 — never for any other make, model, or year.
```

### chevrolet_bolt_ev_2022_2023
```
Authoritative emergency-response source for the Chevrolet Bolt EV 2022-2023. Use this tool for ANY first-responder question about the Chevrolet Bolt EV 2022-2023. Contains the full Emergency Response Guide (ERG) for this vehicle; no separate Rescue Sheet is indexed, so quick-reference one-page callouts may be limited. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures. Use ONLY for the Chevrolet Bolt EV 2022-2023 — never for any other make, model, or year.
```

### chevrolet_equinox_ev_2024
```
Authoritative emergency-response source for the Chevrolet Equinox EV 2024. Use this tool for ANY first-responder question about the Chevrolet Equinox EV 2024. Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the Chevrolet Equinox EV 2024 — never for any other make, model, or year.
```

### ford_lightning_2026
```
Authoritative emergency-response source for the Ford F-150 Lightning 2026. Use this tool for ANY first-responder question about the Ford F-150 Lightning 2026. Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the Ford F-150 Lightning 2026 — never for any other make, model, or year (in particular, do NOT use for the Ford Mustang Mach-E).
```

### ford_mach_e_2026
```
Authoritative emergency-response source for the Ford Mustang Mach-E 2026. Use this tool for ANY first-responder question about the Ford Mustang Mach-E 2026. Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the Ford Mustang Mach-E 2026 — never for any other make, model, or year (in particular, do NOT use for the Ford F-150 Lightning). For questions about the 360° training video narration, use the video_transcript tool instead.
```

### gm_brightdrop_zevo_2022_2024
```
Authoritative emergency-response source for the GM BrightDrop Zevo 400/600 2022-2024. Use this tool for ANY first-responder question about the GM BrightDrop Zevo 400 or Zevo 600 (2022-2024). Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the GM BrightDrop Zevo 400/600 2022-2024 — never for any other make, model, or year.
```

### hyundai_ioniq_5_2025
```
Authoritative emergency-response source for the Hyundai IONIQ 5 2025. Use this tool for ANY first-responder question about the Hyundai IONIQ 5 2025. Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the Hyundai IONIQ 5 2025 — never for any other make, model, or year.
```

### nissan_ariya_2026
```
Authoritative emergency-response source for the Nissan Ariya 2026. Use this tool for ANY first-responder question about the Nissan Ariya 2026. Contains the full Emergency Response Guide (ERG) for this vehicle; no separate Rescue Sheet is indexed, so quick-reference one-page callouts may be limited. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures. Use ONLY for the Nissan Ariya 2026 — never for any other make, model, or year.
```

### rivian_r1t_2025
```
Authoritative emergency-response source for the Rivian R1T 2025. Use this tool for ANY first-responder question about the Rivian R1T 2025. Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the Rivian R1T 2025 — never for any other make, model, or year.
```

### tesla_model_s_2021
```
Authoritative emergency-response source for the Tesla Model S 2021. Use this tool for ANY first-responder question about the Tesla Model S 2021. Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the Tesla Model S 2021 — never for any other make, model, or year.
```

### volkswagen_id4_2025
```
Authoritative emergency-response source for the Volkswagen ID.4 2025. Use this tool for ANY first-responder question about the Volkswagen ID.4 2025. Contains both the full Emergency Response Guide (ERG) and the quick-reference Rescue Sheet for this vehicle. Covers high-voltage component positions and routing, HV battery pack location, 12V battery location, airbag and pyrotechnic/gas-generator positions, seat-belt pretensioner locations, structural reinforcement and high-strength-steel zones, no-cut zones, high-voltage disconnection/service-disconnect points and manual disconnect procedures, HV system shutdown (urgent and non-urgent), HV battery fire and thermal-runaway response, stranded-energy guidance, submersion/water rescue, vehicle stabilization and lifting points, extrication access, towing precautions, and all first-/second-responder step-by-step procedures and labeled diagram callouts. Use ONLY for the Volkswagen ID.4 2025 — never for any other make, model, or year.
```

### video_transcript (video_transcript_v2 namespace) — keep existing or use this
```
Instructor narration from the 360° Ford Mustang Mach-E 2026 training video: verbal walkthroughs, demonstration commentary, and step-by-step explanations as spoken during the exterior, interior, and underside vehicle walkthrough. This video covers ONLY the Ford Mustang Mach-E 2026. Use for any question about what the instructor said or showed in the training video; do NOT use for any other vehicle, and do NOT use for non-Mach-E questions.
```
