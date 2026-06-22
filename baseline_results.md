# Baseline ("before-fix") n8n First-Responder Chatbot Responses

Captured: 2026-06-22
Webhook: `https://irfangazi.app.n8n.cloud/webhook/a7782f7b-3403-48c3-9e6d-c14772a002a1`
Each query used a fresh, distinct UUID session_id (no chat-memory contamination).

---

## Q1 — vw_shutdown

**Question:** How do I shut down the high-voltage system on a Volkswagen ID.4?
**session_id:** `c2606d4b-dbd4-482b-9924-75295c77d746`

```
GENERIC — confirm vehicle before relying on this:
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Treat the vehicle as energized at all times.
- Locate and isolate the high-voltage disconnect/service disconnect and the 12V battery.
- Wear insulated PPE rated for HV work.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium‑ion battery fire; cool with copious water for an extended period.
- Watch for stranded energy and delayed re-ignition; monitor the pack after the fire is out.

Please confirm the exact vehicle (make, model, year) so I can pull the vehicle-specific Emergency Response Guide. I support: BMW iX3 2027; Cadillac Lyriq 2023; Chevrolet Blazer EV 2024; Chevrolet Bolt EV 2022–2023; Chevrolet Equinox EV 2024; Ford F-150 Lightning 2026; Ford Mustang Mach‑E 2026; GM BrightDrop Zevo 400/600 2022–2024; Hyundai IONIQ 5 2025; Nissan Ariya 2026; Rivian R1T 2025; Tesla Model S 2021; Volkswagen ID.4 2025.

Do you mean the Volkswagen ID.4 2025?
```

- **Cites Source/page?** No.
- **Hedges?** No "typically/may", but entirely generic.
- **Defers?** Yes — refuses to answer; asks user to confirm the vehicle even though "Volkswagen ID.4" was explicitly named.
- **5-min capacitor / ~20s cut-out?** Neither mentioned.
- **Failure:** Treats an explicitly-named, supported vehicle ("Volkswagen ID.4") as unidentified and returns the generic fallback + clarifying question instead of the ID.4 procedure.

---

## Q2a — vw_shutdown_dup

**Question:** How do I shut down the high-voltage system on a Volkswagen ID.4?
**session_id:** `35056c5e-60e9-4f77-9343-be7ffa2b8c67`

```
Volkswagen ID.4 2025

SAFETY FIRST
- Treat the vehicle as energized until you have completed the manufacturer’s disable procedure and confirmed zero HV voltage. (Source: ERG p.25)
- Do NOT touch, cut, or open damaged high-voltage components, harnesses, or the battery pack. Cover exposed HV parts if necessary and wear insulated PPE rated for HV work. (Source: ERG p.25–26)
- The high‑voltage battery retains stranded energy even after disconnect; watch for delayed re‑ignition and thermal events. Do not open or damage the battery. (Source: ERG p.25–28)

Quick summary of shutdown behavior
- If airbags deploy, the HV system is automatically separated and the vehicle is de‑energized approx. 20 seconds after detection. After that the vehicle can only be reactivated by a suitable workshop. (Source: Rescue Sheet p.2; ERG p.25)
- For non‑airbag or manual shutdown, use the vehicle manufacturer emergency cut‑out connections (main and alternatives). (Source: ERG p.27–28)

Step‑by‑step — Manual / non‑urgent HV shutdown (priority order)
1. Secure the scene: chock wheels, turn ignition OFF (power meter “OFF”), remove key/fob ≥5 m, isolate hazards, wear HV PPE. (Source: Rescue Sheet p.2; ERG p.25)
2. Use the Main method first — fuse panel emergency cut‑out:
   - Locate the labelled emergency cut‑out on the interior fuse panel (marked with a yellow flag / pull‑out fuse instruction).
   - Pull the emergency cut‑out/fuse per the label instructions to disable the HV coupling at the fuse panel. This is the preferred first action. (Source: ERG p.25–26; Rescue Sheet p.2)
3. If the fuse‑panel cut‑out is not accessible, use Alternative 1 — front end maintenance connector:
   - Open the front-end access and separate the maintenance connector identified for the high‑voltage system (labelled and described on the rescue card). (Source: ERG p.27–28)
4. If neither of the above is accessible, use Alternative 2 — rear coupling point:
   - In some ID. Family vehicles there is a rear coupling point/cable identified for emergency cutout; cut only the identified cable per rescue‑card instructions. (Source: ERG p.27–28)
5. After separating a manufacturer‑provided emergency cut‑out, disconnect the 12 V on‑board battery to prevent inadvertent re‑energization of safety systems. Only after both steps is there the greatest certainty the HV system is disabled. (Source: ERG p.27–28)
6. Confirm vehicle power state: instrument cluster power meter should read “OFF.” Wait and monitor for any indications or warnings. (Source: Rescue Sheet p.2; ERG p.25)

Location callouts (what to look for)
- Fuse panel (passenger compartment) — emergency cut‑out with yellow flag / pull‑out fuse marking. (Source: ERG p.25–26; Rescue Sheet p.2)
- Front end — maintenance connector for HV system (labelled). (Source: ERG p.27–28)
- Rear / luggage compartment — identified HV coupling/cable in some ID family vehicles. (Source: ERG p.27–28)

Additional precautions
- Even after cutting manufacturer emergency cut‑outs, the high‑voltage battery contains stored energy; do not puncture or open the battery. (Source: ERG p.25–28)
- If airbags deployed, HV isolation is automatic but still verify instrument indications and protect the scene; vehicle may still supply 12V from DC‑DC converter if HV remains connected. (Source: ERG p.25–26)
- Follow the vehicle’s Rescue Sheet diagrams for exact locations and no‑cut zones before cutting or lifting. (Source: Rescue Sheet p.2; ERG p.27–28)

If you want, I can:
- Give the exact fuse‑panel location and diagram callout from the Volkswagen ID.4 Rescue Sheet (pull‑out fuse location) — tell me if you need interior, front‑end, or rear diagram detail.
```

- **Cites Source/page?** Yes — extensive ERG p.25–28 and Rescue Sheet p.2 citations.
- **Hedges?** Minor ("in some ID. Family vehicles").
- **Defers?** No — gives full step-by-step procedure.
- **5-min capacitor / ~20s cut-out?** Mentions the **~20 second** post-airbag de-energization. No 5-minute capacitor.
- **Failure:** None major — this is a good answer. Highlights the non-determinism vs Q1 (same question, opposite outcome).

---

## Q2b — vw_shutdown_dup2

**Question:** How do I shut down the high-voltage system on a Volkswagen ID.4?
**session_id:** `08799747-347f-4c89-926d-95588b6c0a89`

```
Volkswagen ID.4 2025

Safety first (do these before anything else)
1. Treat the vehicle as energized until you have completed the manufacturer’s emergency cut‑out procedure and disconnected the 12 V system. (Source: Emergency Response Guide p.25–28)
2. Do not touch, cut, or open damaged HV components, cables, or the HV battery; wear insulated/PPE per local HV protocols. (Source: ERG p.25)
3. If airbags deployed, the high‑voltage system is automatically deactivated and will be de‑energized approximately 20 seconds after deactivation — but still follow cut‑out and 12 V isolation for full safety. (Source: ERG p.25)

Step‑by‑step HV shutdown (ordered methods)
Note: Use the first method you can safely access. If one method is not accessible due to damage, go to the next.

1) Prepare the vehicle
 - Immobilize and stabilize the vehicle; chock wheels and apply parking brake. (Source: Rescue Sheet p.2)
 - Turn the vehicle electrical system to OFF: turn off the ignition / power meter to “OFF”. You can press the START‑STOP button without depressing the brake to turn ignition off. Confirm instrument cluster shows “OFF” (not “READY”). (Source: Rescue Sheet p.2; ERG p.25)

2) Main method — fuse‑panel emergency cut‑out (preferred)
 - Locate the emergency cut‑out on the fuse panel (marked and flagged). Pull the marked fuse / emergency cut‑out per the yellow flag instructions. Disconnecting this coupling point disables the high‑voltage system. (Source: ERG p.25–28; Rescue Sheet p.2)
 - The yellow‑flagged emergency cut‑out components carry the 12 V supply and are intended to be operated by rescue personnel following the little flag instructions. (Source: ERG p.25–26)

3) Alternative method — front end maintenance connector
 - If the fuse panel cut‑out is not accessible, open the vehicle front end and remove the high‑voltage maintenance connector (labeled on rescue card). This isolates the HV system. (Source: ERG p.27–28)

4) Second alternative — rear coupling point
 - If neither the fuse panel nor front connector are accessible, use the emergency coupling/cut‑out located at the rear or luggage compartment (manufacturer‑identified cable/coupling). Follow the rescue card marking and cut/disconnect only at the identified point. (Source: ERG p.27–28)

5) Disconnect 12 V for greatest certainty
 - After separating a manufacturer emergency cut‑out, also disconnect the 12 V on‑board battery. Only when a manufacturer cut‑out has been separated AND the 12 V battery is disconnected is there the greatest certainty that the HV system cannot be reactivated. (Source: ERG p.27–28)

Additional important notes
- A manufacturer emergency cut‑out is the only reliable method to prevent unintentional reactivation; do not attempt to cut random orange HV cables — use the marked cut‑out points only. (Source: ERG p.25–28)
- Even after HV isolation, there is still stored energy inside the HV battery; do not open or damage the HV battery pack and monitor for stranded energy or delayed hazards. (Source: ERG p.25–28)
- Follow procedures on the Volkswagen rescue card for exact locations and any vehicle‑specific access steps. (Source: Rescue Sheet p.2–3; ERG p.28)

If you want, I can:
- Give the exact fuse‑panel location and a labelled diagram callout from the Rescue Sheet (Rescue Sheet p.2–3), or
- Walk you through the front maintenance connector access step by step. Which do you need?
```

- **Cites Source/page?** Yes — ERG p.25–28, Rescue Sheet p.2–3.
- **Hedges?** Minimal.
- **Defers?** No — full procedure.
- **5-min capacitor / ~20s cut-out?** Mentions the **~20 second** post-airbag de-energization. No 5-minute capacitor.
- **Failure:** None major. Good answer, very similar in substance to Q2a (slightly different wording/structure).

**Q2a vs Q2b:** Both substantive, both cite ERG p.25–28 + Rescue Sheet, both give the same ordered methods (fuse-panel cut-out → front maintenance connector → rear coupling → disconnect 12V) and both cite the ~20s airbag de-energization. Differences are cosmetic (formatting, phrasing). BUT both differ sharply from Q1 (same question) which returned a generic "confirm vehicle" refusal — that is the real non-determinism.

---

## Q3 — nissan_hv

**Question:** Where is the 12V battery and how do I disable the high-voltage system on a Nissan Ariya?
**session_id:** `56d1b066-6088-4f89-bfac-e77d1c8a9539`

```
Nissan Ariya 2026

Safety-first warnings (read first)
- Treat the vehicle as energized until the high-voltage (HV) system is positively confirmed shut down. (Source: ERG p.72)
- Do NOT attempt HV shutdown if the HV battery is damaged (deformed/cracked). Wear appropriate HV-rated PPE for any contact with HV components. (Source: ERG p.78)
- Remove the service plug to render the HV system safe for storage/maintenance. For severely damaged packs: keep the vehicle away from structures/other vehicles and expect possible delayed thermal events. (Source: ERG p.65–66, p.78)

Where the 12V battery is located
- No matching information for the 12V battery location was found in the returned Nissan Ariya 2026 ERG excerpts. If you need the exact position and diagram, request that page or I can pull the Rescue Sheet/ERG page that shows the 12V battery and labeled diagrams. (If you want, I will fetch that now.)

How to disable the high-voltage system
1. Preliminary checks (always do these first)
   - Verify the READY indicator and charging indicator on the instrument cluster are OFF. If either is ON, the HV system is still active. (Source: ERG p.72)
   - Place the selector into Park (P), apply the parking brake, and chock the wheels. (Source: ERG p.72)

2. Non‑urgent / controlled shutdown (recommended for storage, repair, dismantling)
   - Remove the service plug (service disconnect) to shut down the HV system for storage, repair, or transport. The ERG calls this out as the required action before dismantling or storage. See the detailed Removal of the Service Plug procedure (ERG–69). (Source: ERG p.65–66; see ERG–69 for step-by-step)

3. Urgent/incident response (when immediate isolation may be needed)
   - If the vehicle is intact and it is safe to approach: power the vehicle OFF (confirm READY OFF), Park, parking brake on, chock wheels, then remove the service plug per the ERG procedure. (Source: ERG p.72, p.78)
   - If the HV battery is suspected or obviously damaged, do NOT attempt to remove/interfere with the pack or service plug without HV PPE and appropriate training — treat as live and establish exclusion zones. Expect possibility of delayed thermal runaway and keep vehicle away from structures. (Source: ERG p.65–66, p.78)

4. Other important precautions
   - Always wear HV-rated PPE before touching HV harnesses or components. (Source: ERG p.78)
   - If you must leave the vehicle, place a prominent “DANGER” sign on it to warn others the vehicle contains a high-voltage battery until the service plug has been removed and system is verified safe. (Source: ERG p.65–66)
   - For recovery/recycling or complex removal of the HV battery, contact a Nissan-certified ARIYA dealer or Nissan EV support (numbers listed in the ERG). (Source: ERG p.98–100)

If you need more detail
- I can pull the ERG page with the exact service-plug removal steps (ERG–69) and the Rescue Sheet/diagram that shows the 12V battery location and labeled HV components. Which would you like me to fetch now?
```

- **Cites Source/page?** Yes — ERG p.65–66, p.72, p.78, p.98–100.
- **Hedges?** Minor ("possible delayed thermal events").
- **Defers?** Partially — explicitly says "No matching information for the 12V battery location was found" (half the question unanswered) and offers to fetch the page.
- **5-min capacitor / ~20s cut-out?** Neither mentioned.
- **Failure:** Fails the first half of the two-part question — cannot locate the 12V battery. HV-disable half is well-answered with the service-plug procedure.

---

## Q4 — vw_nocut

**Question:** What are the no-cut zones on a Volkswagen ID.4?
**session_id:** `9568e22a-3d1c-40ec-87d7-b3171e7ed9bc`

```
Volkswagen ID.4 2025

SAFETY (critical)
- Treat the vehicle as energized and avoid cutting where high‑voltage components, wiring, or high‑strength structural reinforcements are located. Disconnect the manufacturer emergency cut‑out and the 12 V battery before cutting if the situation allows. Source: Emergency Response Guide (ERG) p25‑28.

What the ERG shows / immediate guidance
1. The Volkswagen ERG confirms emergency cut‑out connection locations (passenger‑compartment fuse panel, front maintenance connector, and in some ID. models a rear/luggage‑compartment coupling point). Disable the HV system using the manufacturer’s emergency cut‑out first, then remove 12 V power. Source: ERG p27‑28.
2. The ERG/Rescue Card includes labeled diagrams that identify high‑strength/no‑cut zones and high‑voltage cable routing for the ID.4; those diagrams are the authoritative reference for exact no‑cut areas. Source: ERG p6‑8 (Rescue Card illustration) and ERG p27‑28.

Limitations / next step
- The text returned from the ID.4 ERG I accessed does not list a line‑by‑line textual list labeled “no‑cut zones.” The specific no‑cut zones are shown as diagram callouts on the Volkswagen ID.4 Rescue Sheet (illustrations and labeled components). Source: ERG p6‑8; p27‑28.
- If you want, I can extract and list the Rescue Sheet diagram callouts (exact no‑cut zones and their locations) from the ID.4 Rescue Sheet now. Would you like the diagram callouts and their page references?
```

- **Cites Source/page?** Yes — ERG p6–8, p27–28.
- **Hedges?** Some ("in some ID. models").
- **Defers?** Partially — admits "does not list a line-by-line textual list labeled 'no-cut zones'", points to diagrams, offers to extract them. Does not actually enumerate the no-cut zones asked for.
- **5-min capacitor / ~20s cut-out?** Neither mentioned.
- **Failure:** Does not directly answer — gives general "avoid HV components and structural reinforcements" plus a pointer to diagrams, rather than the specific no-cut zones requested. Retrieval did not surface the labeled no-cut callouts.

---

## Q5 — unidentified

**Question:** There's a crashed EV at the scene, what do I do?
**session_id:** `63e0267d-75fa-4372-8071-a4e9ba97c5bf`

```
GENERIC — confirm vehicle before relying on this:
- Power the vehicle off and keep the key/fob at least 5 m away.
- Chock the wheels; the vehicle may move silently if powered.
- Treat the vehicle as energized at all times.
- Locate and isolate the high-voltage disconnect/service disconnect and the 12V battery.
- Wear insulated PPE rated for HV work.
- Do NOT use an ABC/dry-chemical extinguisher on a lithium-ion battery fire; cool with copious water for an extended period.
- Watch for stranded energy and delayed re-ignition; monitor the pack after the fire is out.

Please confirm the vehicle make, model, and year so I can pull the manufacturer Emergency Response Guide / Rescue Sheet and give vehicle-specific steps. Supported vehicles I can provide exact guidance for:
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

If you only know part of the vehicle (e.g., "a Volkswagen" or "a Chevy SUV"), tell me that and I’ll narrow the options and ask one quick clarifying question.
```

- **Cites Source/page?** No.
- **Hedges?** No "typically/may", but generic by design.
- **Defers?** Yes — asks user to confirm make/model/year. This is the *appropriate* behavior for a genuinely unidentified vehicle.
- **5-min capacitor / ~20s cut-out?** Neither mentioned.
- **Failure:** None in principle — for a truly unidentified vehicle, the generic safety checklist + clarifying question is correct behavior. (Note: this is the SAME generic block returned wrongly for Q1, where the vehicle WAS named.)
