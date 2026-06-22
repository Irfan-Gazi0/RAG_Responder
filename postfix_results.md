# Post-Fix Webhook Capture Results

Captured against the live n8n First-Responder chat webhook AFTER the upgrade
(topK 4→10, router model → Claude Opus 4.8, de-contradicted system prompt).

- **Webhook:** `https://irfangazi.app.n8n.cloud/webhook/a7782f7b-3403-48c3-9e6d-c14772a002a1`
- **Date captured:** 2026-06-22
- **Errors:** None. All 7 calls returned a valid `output` on the first attempt. No model/credential/Anthropic errors observed.

Each section notes: cites Source/page? hedges? defers? mentions VW ~20s post-airbag de-energization? lists specific cut-out/disconnect locations?

---

## Q1 — vw_shutdown
- **session_id:** `92a9c8d6-2e8b-47f9-bafe-72e93bb8edd4`
- **Cites Source/page:** YES — ERG pp.21, 25–31 (per-step page cites for fuse panel p.29, front end p.30, rear p.31)
- **Hedges:** Minimal — uses "approx./about 20 seconds" only for the documented de-energization time, not as evasion
- **Defers ("refer to ERG"/"no info"):** NO generic deferral — gives the full procedure
- **VW ~20s post-airbag de-energization:** YES (stated for both automatic and manual paths)
- **Specific cut-out/disconnect locations:** YES — fuse panel (main), front-end coupling point (front-left footwell release; pull red tab, hold + pull black connector), rear coupling point

```
**Volkswagen ID.4 2025**

⚠️ **Safety-critical warnings — read first:**
- Even after the HV system is disabled, **stranded energy remains inside the high-voltage battery.** Never damage, open, or cut into the HV battery.
- Disabling the HV system only removes high voltage. **Airbags and seat-belt pretensioners remain powered by the 12V system** — treat undeployed restraints as live.
- Do not touch damaged HV components; cover them if necessary. HV cables are **orange**. Wear HV-rated PPE per local standards.
- Rapid or heavy smoke may indicate a **thermal reaction (thermal runaway)** of the HV battery.

---

### Shutdown depends on the scenario:

**A. Accident WITH airbag deployment (automatic shutdown):**
1. The HV system (and 48V system) is **automatically disabled** the moment airbag deployment is detected.
2. The system is fully **de-energized about 20 seconds after deactivation.** No further waiting time or manual action is required for shutdown — it can only be reactivated by a qualified workshop.

**B. Accident WITHOUT airbag deployment, or a minor accident:**
The HV system is **NOT** automatically disabled. You must manually disable it via an emergency cut-out connection:
1. Warn the surrounding area — switch on hazard flashers, set out warning triangle.
2. Immobilize/stabilize the vehicle.
3. Disable the HV system at an emergency cut-out connection. After the connection is opened, the HV system de-energizes after **approx. 20 seconds.**

**C. Parked / stationary vehicle (restraints not triggered):**
1. Disable the HV system by **pulling the fuse on the fuse panel.**

**D. Vehicle at a charging station:**
1. Remove the charging cable normally (per Owner's Manual), or
2. Use the **emergency release** to disconnect from the charging station.

---

### Emergency cut-out connections (yellow-flag marked — carry 12V only, safe for responders):

These yellow-flagged cut-outs disable the HV system. The ID.4 has **multiple** locations — use them in priority order:

1. **Main method — HV coupling point on the fuse panel** (preferred). *Source: ERG p.29*
2. **Alternative — HV coupling point in the vehicle front end** (front trunk area; access by pulling the release cable in the front-left footwell). Procedure at this point:
   - Pull out the red tab.
   - Press and hold the red tab while pulling out the black connector until it locks in position.
   *Source: ERG p.30*
3. **Alternative — HV coupling point in the rear of the vehicle.** *Source: ERG p.31*

Use an alternative cut-out if the prioritized fuse-panel connection is not accessible due to accident damage.

---

**Verify shutdown:** The instrument cluster power display shows **"OFF"** (drive off) or **"READY"** (drive ready). The drive motor is silent — never rely on sound. Note: on ID. family vehicles, drive-ready mode can be re-established by an occupied driver's seat + brake pedal, so keep occupants/key clear.

*Sources: ERG pp.21, 25–31*

Would you like the exact diagram locations of these cut-out points, or the 12V battery disconnection procedure next?
```

---

## Q2a — vw_shutdown_dup
- **session_id:** `54fd4d6a-cd4a-454c-86f1-7ff4a2c101ee`
- **Cites Source/page:** YES — ERG p.25, p.26, p.27, p.28, p.29, p.30, p.31
- **Hedges:** Minimal (documented "~20 seconds")
- **Defers:** NO — full procedure given
- **VW ~20s post-airbag de-energization:** YES
- **Specific cut-out/disconnect locations:** YES — fuse panel (p.29), front-end maintenance connector / green housing / front-left footwell (p.30), rear cable cut (p.31); plus note that full isolation requires 12V disconnect (p.28)

```
**Volkswagen ID.4 2025**

⚠️ **SAFETY WARNINGS — READ FIRST:**
- The HV system runs at **over 300 V**. Orange cables = high voltage. Do **not** touch or cut damaged HV components — cover them if needed. Wear HV-rated PPE per local standards.
- **Stranded energy:** Even after the HV system is disabled, electrical energy remains inside the HV battery. **Never damage or open the HV battery.** If it is damaged, avoid contact with the battery or any leaking liquids/vapors.
- Disconnecting an emergency cut-out **only disables the HV system** — airbags and seat-belt pretensioners remain powered by the 12V system. The 12V system may also still be fed from the HV battery via the DC converter.
- After deactivation, the HV system is **de-energized after about 20 seconds.**
- The electric motor is **silent** — confirm drivetrain status on the instrument cluster ("OFF" = off, "READY" = ready to drive). Note: ID. family vehicles can become drive-ready simply by an occupied driver seat + brake pedal pressed.

---

### Automatic shutdown (airbag deployment)
If airbags have deployed, the HV system is **automatically disconnected** from the HV battery and de-energized ~20 seconds later. No additional waiting period for responders. (*Source: ERG p.25, p.28*)

### Manual shutdown — emergency cut-out connections
Use these when airbags did **not** deploy, or when manual disabling is still required. The ID.4 has a minimum of two coupling points (fuse panel + front end), and some ID. family vehicles have a third in the rear. Follow this priority sequence:

**1. Main method — High-voltage coupling point on the fuse panel** (preferred)
- The fuse panel is in the instrument-panel area (or vehicle rear, depending on model), marked with a **yellow flag**.
- Pull the identified fuse from its holder. This opens the HV contactors in the battery; the system de-energizes after 20 seconds.
*(Source: ERG p.29)*

**2. Alternative method — Coupling point in the vehicle front end** (maintenance connector)
- Access the front compartment: pull the release cable in the **front-left footwell** to release the front lid.
- Locate the low-voltage maintenance connector (**green connector housing**, yellow label on the cable, red tab for unlocking).
- Procedure:
  1. Pull out the **red tab**.
  2. Press and hold the red tab while pulling out the black connector until it locks in position.
*(Source: ERG p.30)*

**3. Alternative method — Coupling point in the rear of the vehicle**
- Cut through the **identified cable** (per the rescue card labeling) in the luggage compartment / rear of the vehicle.
*(Source: ERG p.27, p.31)*

---

### Special situations
- **Parked/stationary vehicle (no airbag deployment):** HV system is NOT automatically disabled → disable it by pulling the fuse on the fuse panel. *(Source: ERG p.26)*
- **Vehicle at a charging station:** Remove the charging cable normally, or use the charging station's emergency release, then proceed with HV disconnection. *(Source: ERG p.26)*

### Important note on full isolation
The greatest possible certainty that the HV system is disabled is achieved **only when a manufacturer emergency cut-out connection is separated AND the 12V on-board battery is disconnected.** *(Source: ERG p.28)*

The exact mounting locations and labeling are specified on the Volkswagen rescue cards. Would you like the 12V battery location/disconnect procedure or the exact cut-out connection diagram callouts next?
```

---

## Q2b — vw_shutdown_dup2
- **session_id:** `87e88e80-e623-4b8b-9c0d-973fb5cf8e8b`
- **Cites Source/page:** YES — ERG p.25–33 (range cite)
- **Hedges:** Minimal (documented "~20 seconds")
- **Defers:** NO — full procedure given
- **VW ~20s post-airbag de-energization:** YES
- **Specific cut-out/disconnect locations:** YES — fuse panel (passenger compartment), front-end maintenance connector (green housing, front-left footwell release), rear cable cut; plus full 12V disconnect procedure (negative first, insulate, multiple batteries)

```
**Volkswagen ID.4 2025**

⚠️ **Safety first:**
- Even after the HV system is disabled, **electric power remains inside the HV battery**. During rescue work the HV battery must **never be damaged or opened**.
- Do **not** touch damaged HV components — cover them if necessary. HV cables are **orange**; HV components carry warning labels.
- If the HV battery is damaged, avoid contact with the battery or any leaking liquids/vapors (possible thermal reaction).
- The drive motor is **silent** — check the instrument cluster: "READY" = drivetrain live, "OFF" = off. Note: in ID. family vehicles, drive-ready mode can be re-established just by an occupied driver's seat + brake pedal.

---

### When airbags HAVE deployed (severe accident)
The HV system is **automatically disconnected** when airbag deployment is detected. It de-energizes about **20 seconds** after deactivation. No additional waiting time is required from responders. Reactivation is only possible by a qualified workshop.
- Depending on the situation, you may still need to **manually disable** the HV system at an emergency cut-out connection.

### When airbags have NOT deployed (parked, charging, or non-deployment crash)
The HV system is **not** automatically disabled — you must do it manually using an emergency cut-out connection. After opening it, the system de-energizes after **~20 seconds**.
- **Charging vehicle:** First remove the charging cable normally; alternatively use the charging-station emergency release.

---

### Manual shutdown — use the emergency cut-out connections in this order
There are at least two coupling points (some ID. vehicles have a third). All are marked with **yellow flags/labels** and only carry 12V — they are safe for responders to disconnect.

1. **Main method — HV coupling point on the fuse panel** (passenger compartment): pull the marked fuse on the fuse panel.
2. **Alternative — HV coupling point in the vehicle front end** (maintenance connector):
   - Access the front compartment by pulling the release cable in the **front left footwell**.
   - The connector has a **green housing** with a yellow label and an unlocking tab.
   - **Pull out the red tab.**
   - **Press and hold the red tab while pulling out the black connector until it locks in position.**
3. **Alternative — HV coupling point in the rear of the vehicle** (luggage compartment/rear): cut through the **identified marked cable**.

---

### Also disconnect the 12V battery for full de-energization
The greatest certainty that the HV system is disabled is achieved only when a manufacturer emergency cut-out connection is separated **AND the 12V battery is disconnected.**

- Disconnecting the 12V supply reduces the risk of fire (short circuits) and of **retrospective airbag/pretensioner/rollover-bar activation**.
- **Always disconnect the negative terminal first, then the positive**, and insulate the terminals to avoid arcing.
- If the battery is inaccessible, disconnect the **accessible ground (earth) cable** VW provides from the battery to the body, then insulate it.
- If multiple 12V batteries are fitted, **disconnect all of them**.
- ⚠️ Note: Disconnecting the emergency cut-out only disables the **HV system** — airbags and pretensioners remain powered by the 12V system until that is also disconnected. In a fire, un-deployed airbags may still deploy due to heat.

*Source: ERG p.25–33*

Would you like the specific component/diagram locations for the cut-out connections, or guidance on a fire/thermal-runaway scenario?
```

---

## Q2c — vw_shutdown_dup3
- **session_id:** `af027e10-1ae4-4c94-977e-3bf20359410d`
- **Cites Source/page:** YES — ERG p.21, 25–30, 33
- **Hedges:** Minimal (documented "~20 seconds")
- **Defers:** Mostly NO — gives the full procedure; one soft "refer to the Volkswagen rescue card for exact cut-out connection locations" line, but only AFTER listing the three specific locations
- **VW ~20s post-airbag de-energization:** YES
- **Specific cut-out/disconnect locations:** YES — fuse panel (passenger compartment), front end maintenance connector (front-left footwell, red tab/black connector), rear cable cut; full 12V disconnect steps

```
**Volkswagen ID.4 2025**

⚠️ **Safety first:**
- High-voltage system operates at **above 300 V**. HV cables are **orange**. Do **not** touch, cut, open, or damage HV components or the HV battery.
- The electric drive is **silent** — check the instrument cluster: **"READY"** = drive active, **"OFF"** = drivetrain off. In ID. family vehicles, drive-ready mode can engage simply with the driver seat occupied and the brake pressed.
- **Stranded energy:** Even after the HV system is disabled, power remains inside the HV battery. Wear HV-rated PPE per local standards. If the battery is damaged, avoid contact with it or any leaking liquids/vapors.

---

### Step 1 — Determine if the HV system is already shut down
- **If airbags/restraints have deployed:** The HV system was **automatically disabled**. It de-energizes about **20 seconds** after deactivation — no further waiting required. You may still need to manually disable it depending on the scenario.
- **If airbags did NOT deploy** (parked, charging, or minor impact): The HV system is **not** automatically shut off — you must disable it manually using an emergency cut-out connection. After activating it, allow **~20 seconds** to de-energize.

### Step 2 — Manually disable the HV system (use in this priority order)
The ID.4 has at least two coupling points (sometimes three). The yellow-flagged emergency cut-out connections carry only 12V and are safe for responders to disconnect.

1. **Main method — fuse panel (passenger compartment):** Pull the identified fuse on the fuse panel. *(Use this first.)*
2. **Alternative — front end (maintenance connector):** Pull the front-left footwell release cable to open the front lid. Locate the green connector with a yellow label: **pull out the red tab, then press and hold the red tab while pulling out the black connector until it locks.**
3. **Alternative — rear of vehicle:** Cut through the identified cable (some ID. family vehicles have this third coupling point).

> Refer to the Volkswagen rescue card for exact cut-out connection locations on the specific vehicle.

### Step 3 — Disconnect the 12V battery
There is only the **greatest possible certainty** the HV system is disabled when a manufacturer emergency cut-out connection is separated **AND** the 12V battery is disconnected.

1. Disconnect the **negative** terminal first, then the **positive**.
2. **Insulate** both terminals to prevent arcing.
3. If multiple 12V batteries are fitted, disconnect **all** of them. If the battery isn't accessible, disconnect the accessible earth (ground) cable from battery to body, then insulate it.

⚠️ **After disconnecting 12V power, airbags are deactivated — but in a fire, un-deployed airbags/pretensioners may still deploy due to heat.** Also note: emergency flashers, electric seat adjustment, and electric trailer hitch will no longer function.

*Source: ERG p.21, 25–30, 33*

Would you like the specific component locations (fuse panel, front, rear cut-out connections) or the HV battery fire/thermal-runaway procedure?
```

---

## Q3 — nissan_hv
- **session_id:** `c06794e1-466c-4db0-aebe-42da759a44a8`
- **Cites Source/page:** YES — ERG p.12, p.16–17, p.27, p.28, p.30, p.32, p.39, p.77; ERG sections 3-1.5/3-1.6/3-1.7
- **Hedges:** Minimal (documented discharge times)
- **Defers:** NO — answers 12V location and full HV disable procedure
- **VW ~20s note:** N/A (Nissan); instead correctly gives Nissan-specific 10-min HV capacitor discharge + 3-min SRS wait
- **Specific 12V location:** YES — under the hood (motor room), item #2 on cut sheet
- **Specific disconnect locations:** YES — power switch + 12V negative; remove HV fuses; remove service plug (center of HV battery, under rear seat)

```
**Nissan Ariya 2026**

⚠️ **SAFETY FIRST:**
- Treat the vehicle as energized until confirmed shut down. **NEVER assume it is off just because it is quiet** — if the READY indicator or any charging indicator (LED on top of the instrument panel) is ON, the high-voltage system is active.
- After HV shutdown, **wait at least 10 minutes** for the HV capacitors to fully discharge before touching or cutting HV components. (Voltage drops below 60V after ~5 min; full discharge needs 10 min.)
- After disconnecting the 12V battery negative terminal, **wait at least 3 minutes** before working near airbags — the SRS can still deploy.
- Always wear appropriate HV-rated PPE. Never touch orange HV cables/components or open the HV battery. Use insulated tools rated 1,000V/300A.
- The HV battery retains charge even after the system is shut down.

---

### 12V Battery Location
- The 12-volt battery (lead-acid) is located **under the hood** (motor room). It is also labeled as item **#2** on the vehicle cut sheet.

*Source: ERG p.12; ERG p.39*

---

### How to Disable the High-Voltage System

Before disconnecting the 12V battery, if needed, lower the windows, unlock the doors, and open the rear hatch — power controls will not operate once the 12V is disconnected.

The HV system can be shut down by **any one** of the following three methods:

**Primary Procedure:**
1. Turn OFF the power switch.
2. Disconnect the 12-volt battery (negative terminal).
*(ERG section 3-1.5, p.28)*

**Alternate Procedure 1 (Remove Fuses):**
1. Remove the fuses for the high-voltage control system.
2. Disconnect the 12-volt battery.
*(ERG section 3-1.6, p.30)*

**Alternate Procedure 2 (Remove Service Plug):**
1. Remove the service plug — located in the **center area of the high-voltage battery, under the rear seat**.
2. Disconnect the 12-volt battery.
*(ERG section 3-1.7, p.32)*

**After any method:** Verify the READY indicator is OFF, then **wait a minimum of 10 minutes** for full HV capacitor discharge before beginning extrication work near HV components.

**Note:** If airbags deploy in a qualifying collision (certain front, side, or rear impacts), the HV system is designed to **automatically shut off** at the time of deployment via the emergency shut-off system.

*Source: ERG p.16–17, p.27, p.77*

---

If the HV system shows signs of damage (arcing/sparking, cut or damaged orange harnesses, damaged HV component casings), approach with extreme caution — shutdown procedures may not work and HV exposure risk remains.

Let me know if you'd like the detailed step-by-step for a specific shutdown method or the service plug removal.
```

---

## Q4 — vw_nocut
- **session_id:** `fdadd363-ec6b-4f16-8f59-95df639df719`
- **Cites Source/page:** YES — ERG p.42–45; p.16–17, 25, 30–31
- **Hedges:** Minimal
- **Defers:** NO — lists the actual no-cut zones; only a closing "confirm against the model-specific rescue card" reminder AFTER giving the zones
- **VW ~20s note:** N/A for this question
- **Specific no-cut zones:** YES — B-pillar (cut above belt height adjuster, pretensioner in lower B-pillar), A-pillar, side members/rocker sills (protect HV battery), door impact protection bars; plus components: HV battery, HV cables, airbags/gas generators, pretensioners

```
**Volkswagen ID.4 2025**

⚠️ **Safety first:** Never cut into or damage the high-voltage battery or HV components. Avoid airbags, gas generators, HV lines, and seat-belt pretensioners. Cutting high-strength/hot-formed steel produces sharp edges — wear appropriate PPE.

The ID.4's rigid passenger cell uses high-strength and hot-formed steels in multi-layered construction. The following are the reinforced "no-cut / avoid" zones where standard tools will struggle and where critical components are located:

**Structural high-strength zones to avoid / bypass:**
- **B-pillar** — heavily reinforced with hot-formed, multi-layered, large cross-section steel. It is **additionally reinforced in the belt-guide area** — specifically bypass this. If you must cut, do it **above the safety-belt height adjuster** (easiest point). The lower B-pillar has a very large cross-section and **the seat-belt pretensioner is normally located there**.
- **A-pillar** — reinforced; on Cabriolet variants it contains pipe reinforcements. Only cuttable with powerful rescue equipment.
- **Side members (rocker/sills)** — high-strength, multi-layered steel, **reinforced specifically to protect the high-voltage battery** during a side crash.
- **Door impact protection** — horizontal/diagonal steel pipes or profiles behind the outer door panels (a crash pipe may be fitted in the front doors). The steel pipe sits above the door lock (frontal-impact support); steel profiles below the door lock are for side impacts.

**Components to never cut / damage:**
- **High-voltage battery** (underfloor) — must be neither damaged nor opened; stranded energy remains even after HV shutdown.
- **HV cables/lines and HV components.**
- **Airbags and gas generators.**
- **Seat-belt pretensioners** (notably in the lower B-pillar).

**Key reminder:** The ERG repeatedly stresses that the exact location of reinforcements and no-cut zones is shown on the **model-specific rescue card** — always confirm against it before cutting.

Source: ERG p.42–45; component/coupling locations also ERG p.16–17, 25, 30–31.

For the precise diagrammed reinforcement outlines, I can pull the Rescue Sheet callouts if you'd like.
```

---

## Q5 — unidentified
- **session_id:** `4ad189b9-2a83-47f7-8521-d99b0d7d8e0f`
- **Cites Source/page:** NO (intentional — generic, no vehicle identified)
- **Hedges:** Explicitly flagged as GENERIC / not vehicle-specific (appropriate behavior)
- **Defers:** Correctly asks for make/model/year and lists all 13 supported vehicles
- **VW ~20s note:** N/A
- **Specific locations:** Generic only (5m key distance, chock wheels, HV disconnect + 12V, water on Li-ion fire, stranded energy) — appropriate for an unidentified vehicle

```
GENERIC — confirm vehicle before relying on this:

- **Treat the vehicle as energized at all times** — assume high-voltage (HV) systems are live.
- Power the vehicle off and keep the key/fob at least **5 m (16 ft) away** to prevent it powering up.
- **Chock the wheels** — the vehicle may move silently even when it appears off.
- Locate and isolate the **high-voltage disconnect/service disconnect** and the **12V battery**.
- Wear **insulated PPE rated for HV work**.
- Do **NOT** use an ABC/dry-chemical extinguisher on a lithium-ion battery fire — cool with **copious water** for an extended period.
- Watch for **stranded energy** and **delayed re-ignition** — monitor the battery pack even after any fire is out.
- Be alert for damaged HV cabling, leaking fluids, and venting/off-gassing from the battery.

⚠️ This is **generic guidance only** and is **not specific** to the vehicle at your scene.

To give you accurate, model-specific procedures (battery location, cut zones, disconnect points, shutdown steps), please confirm the **make, model, and year**.

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

Which one are you dealing with?
```
