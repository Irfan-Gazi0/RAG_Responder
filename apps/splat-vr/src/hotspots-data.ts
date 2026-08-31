/**
 * Hazard and cut-point hotspots for the scanned vehicles.
 *
 * COORDINATE FRAME
 * ----------------
 * Positions are metres in a canonical vehicle frame, NOT normalized bounding-box
 * fractions:
 *
 *     +X  toward the nose        origin: vehicle centre, on the ground plane
 *     +Y  up
 *     +Z  toward the DRIVER side (left-hand drive)
 *
 * Bounding-box fractions were the obvious choice and are wrong here. Each scan
 * captured a different amount of surrounding tarmac, so the fitted bbox is
 * nothing like the vehicle: equinox-hood-open measures 7.50 x 7.49 m for a
 * 4.79 m car. The fit does guarantee the *vehicle* ends up `lengthMeters` long,
 * standing on y = 0, so real metres from the vehicle centre are meaningful and
 * survive any future retune of rotation / scaleMultiplier / yOffset.
 *
 * models.ts carries the per-scan `vehicleYaw` (which way that scan's nose points
 * after calibration) and `centerOffset` (bbox centre -> vehicle centre) that map
 * this frame onto the fitted scan. One hotspot set therefore serves both the
 * hood-open and hood-closed scan of the same vehicle.
 *
 * PROVENANCE - read this before trusting a marker
 * -----------------------------------------------
 * Card TEXT is quoted from the GM Emergency Response Guides and Rescue Sheets in
 * vehicle_docs/, cited per card. It is authoritative.
 *
 * Card POSITIONS are not. The ERGs give component locations as diagrams, which
 * no amount of text extraction reaches; the side/plan drawings on Rescue Sheet
 * page 1 establish which side of the vehicle each component is on (the first
 * responder loop and the 12V battery are on opposite sides of the front
 * compartment, and the driver-side steering wheel airbag in the same drawing is
 * what fixes which is which), but the exact placement below is an estimate
 * against the scans. Every entry therefore ships `verified: false`, and the
 * renderer marks those markers as unconfirmed. Confirm them in the headset with
 * the ?dev=1 hotspot pane, then flip the flag - a tool that tells a responder
 * where to cut must not present a guess as a fact.
 *
 * SIDES
 * -----
 * The entries below are written once, on the DRIVER side, and the symmetric
 * ones are mirrored to the passenger side at module load (see SYMMETRIC and
 * mirrorToPassengerSide). Restraints, high-strength zones and lifting points
 * exist on BOTH sides of a real vehicle, and hand-writing them out twice would
 * just be more places for the two sides to drift apart.
 *
 * A responder standing on the passenger side used to see ghosted far-side
 * markers and nothing at all on the side they were actually working.
 */

export type Severity = "danger" | "caution" | "info";

export type Hotspot = {
  id: string;
  title: string;
  severity: Severity;
  /** Canonical vehicle frame, metres. See the header. */
  pos: [number, number, number];
  /**
   * Outward direction of the surface the component sits behind. Markers facing
   * away from you fade out, so the far side of the car does not show through as
   * a field of floating dots.
   */
  normal: [number, number, number];
  /** Card body. One string per line; kept short enough to read at arm's length. */
  body: string[];
  /** Document and page the wording came from. Rendered in the card footer. */
  source: string;
  /** Has an operator confirmed this marker sits on the right part, in-headset? */
  verified: boolean;
  /**
   * Set on generated passenger-side twins: the id of the driver-side entry this
   * was mirrored from. There is no literal for it in this file, so the ?dev=1
   * placement pane flags it rather than emitting a row nobody can paste back.
   */
  mirroredFrom?: string;
};

/** Which hazard set a scan shows. */
export type VehicleId = "equinox-ev-2024" | "blazer-ev-2024";

const DO_NOT_CUT_ORANGE = "DO NOT CUT ANY ORANGE COLORED HIGH VOLTAGE CABLES.";

/**
 * Both vehicles are the same GM Ultium platform and ship near-identical guides,
 * so the two sets differ only where the documents do: the Blazer has a loop
 * access cover and an underhood manual release for the charge handle, and its
 * dimensions are slightly larger.
 */
const DRIVER_SIDE: Record<VehicleId, Hotspot[]> = {
  "equinox-ev-2024": [
    {
      id: "first-responder-loop",
      title: "First Responder Loop - CUT HERE",
      severity: "danger",
      pos: [1.5, 0.88, -0.52],
      normal: [0, 1, 0],
      body: [
        "Double cut the loop on both sides of the yellow tape and",
        "remove the cut section of cable from the vehicle.",
        "Ensure the cuts are clean and no loose wires can touch.",
        "This cut will disable high voltage.",
        "Then WAIT AT LEAST 1 MINUTE for high voltage to discharge.",
        DO_NOT_CUT_ORANGE,
      ],
      source: "Equinox EV ERG p.7",
      verified: false,
    },
    {
      id: "low-voltage-battery",
      title: "12V Battery - do not disable casually",
      severity: "caution",
      pos: [1.5, 0.85, 0.52],
      normal: [0, 1, 0],
      body: [
        "Removing the 12V negative cable disables the airbags.",
        "It ALSO disables thermal runaway alert and mitigation, which",
        "needs 12V power to detect internal HV battery faults.",
        "DO NOT disable the 12V battery just to silence the horn -",
        "pull the horn fuse from the underhood electrical centre.",
        "Do power seats, windows and steering column FIRST.",
      ],
      source: "Equinox EV ERG p.6-7, p.12",
      verified: false,
    },
    {
      id: "hv-battery-pack",
      title: "400V Li-ion Pack - structural floor",
      severity: "danger",
      pos: [-0.1, 0.26, 0.0],
      normal: [0, -1, 0],
      body: [
        "High Voltage (Class B) Li-ion pack mounted under the vehicle,",
        "a structural part of the floor pan.",
        "Do NOT lift the vehicle from any point on the HV battery.",
        "Leaking fluid inside the pack can become unstable and is a",
        "fire risk - check pack temperature with a thermal imager.",
        "Fire: copious water. An ABC dry chemical extinguisher will",
        "NOT put out a battery fire. Expect possible re-ignition.",
      ],
      source: "Equinox EV ERG p.4, p.5, p.10-11",
      verified: false,
    },
    {
      id: "hv-cabling-front",
      title: "HV Cabling / Front Drive Unit",
      severity: "danger",
      pos: [1.95, 0.55, 0.0],
      normal: [0, 1, 0],
      body: [
        DO_NOT_CUT_ORANGE,
        "HV cables and components may be energized. Avoid touching or",
        "cutting them during any rescue operation.",
        "The high voltage system can remain energized even when the",
        "vehicle is in the OFF state.",
        "Lack of engine noise does not mean the vehicle is off.",
      ],
      source: "Equinox EV ERG p.6-7, p.10",
      verified: false,
    },
    {
      id: "srs-control-unit",
      title: "SRS Control Unit",
      severity: "caution",
      pos: [0.2, 0.6, 0.0],
      normal: [0, 1, 0],
      body: [
        "Airbag control module, in the centre console area between",
        "the front seats.",
        "Airbags are disabled by removing the 12V negative cable -",
        "which also disables thermal runaway mitigation.",
        "Treat undeployed airbags as stored energy until then.",
      ],
      source: "Equinox EV Rescue Sheet p.1 diagram; ERG p.9",
      verified: false,
    },
    {
      id: "restraints-pillar",
      title: "Airbags & Pretensioners - do not cut",
      severity: "caution",
      pos: [0.1, 1.1, 0.92],
      normal: [0, 0, 1],
      body: [
        "Eight airbags: driver, front passenger, 2 knee bolster,",
        "2 front seat outboard, 2 roof rail.",
        "Front belts have TWO pretensioners per side - one at the",
        "retractor, one at the anchor at the base of the seat.",
        "Rear outboard seats have one retractor pretensioner each.",
        "Undeployed units are stored energy. Do not cut these areas.",
      ],
      source: "Equinox EV ERG p.9",
      verified: false,
    },
    {
      id: "high-strength-zone",
      title: "High Strength Steel Zone",
      severity: "info",
      pos: [-0.35, 0.38, 0.94],
      normal: [0, 0, 1],
      body: [
        "The passenger compartment is protected with high strength",
        "steel in the pillars, rocker panels, door reinforcement",
        "beams and floor structure.",
        "Expect these to resist conventional cutting. Plan relief",
        "cuts around them and exercise caution.",
      ],
      source: "Equinox EV ERG p.10",
      verified: false,
    },
    {
      id: "charge-port",
      title: "Charge Port",
      severity: "info",
      pos: [1.32, 0.88, 0.94],
      normal: [0, 0, 1],
      body: [
        "VEHICLE AT A CHARGE STATION: if able, terminate charging by",
        "removing the charge handle from the vehicle. It may also be",
        "appropriate to terminate charging at the station itself.",
        "If enabled, the anti-theft alarm may activate.",
      ],
      source: "Equinox EV ERG p.7",
      verified: false,
    },
    {
      id: "lifting-points",
      title: "Lifting Point",
      severity: "info",
      pos: [1.05, 0.3, 0.92],
      normal: [0, 0, 1],
      body: [
        "There are features on the body for use as primary lifting",
        "points.",
        "Do NOT lift the vehicle from any location on the high",
        "voltage battery.",
        "Immobilize first: block the wheels, apply the EPB, and shift",
        "to P using the button on the end of the shift lever.",
      ],
      source: "Equinox EV ERG p.5",
      verified: false,
    },
  ],

  "blazer-ev-2024": [
    {
      id: "first-responder-loop",
      title: "First Responder Loop - CUT HERE",
      severity: "danger",
      pos: [1.55, 0.9, -0.55],
      normal: [0, 1, 0],
      body: [
        "Remove the loop access cover if equipped: press the outboard",
        "tab, rotate the cover up, pull it outboard.",
        "Double cut the loop on both sides of the yellow tape and",
        "remove the cut section from the vehicle.",
        "This cut will disable high voltage.",
        "Then WAIT AT LEAST 1 MINUTE for high voltage to discharge.",
        DO_NOT_CUT_ORANGE,
      ],
      source: "Blazer EV ERG p.7",
      verified: false,
    },
    {
      id: "low-voltage-battery",
      title: "12V Battery - do not disable casually",
      severity: "caution",
      pos: [1.55, 0.87, 0.55],
      normal: [0, 1, 0],
      body: [
        "Removing the 12V negative cable disables the airbags.",
        "It ALSO disables thermal runaway alert and mitigation, which",
        "needs 12V power to detect internal HV battery faults.",
        "DO NOT disable the 12V battery just to silence the horn -",
        "pull the horn fuse from the underhood electrical centre.",
        "Do power seats, windows and steering column FIRST.",
      ],
      source: "Blazer EV ERG p.6-7, p.12",
      verified: false,
    },
    {
      id: "hv-battery-pack",
      title: "400V Li-ion Pack - structural floor",
      severity: "danger",
      pos: [-0.1, 0.27, 0.0],
      normal: [0, -1, 0],
      body: [
        "High Voltage (Class B) Li-ion pack mounted under the vehicle,",
        "a structural part of the floor pan.",
        "Do NOT lift the vehicle from any point on the HV battery.",
        "Leaking fluid inside the pack can become unstable and is a",
        "fire risk - check pack temperature with a thermal imager.",
        "Fire: copious water. An ABC dry chemical extinguisher will",
        "NOT put out a battery fire. Expect possible re-ignition.",
      ],
      source: "Blazer EV ERG p.4, p.5, p.10-11",
      verified: false,
    },
    {
      id: "hv-cabling-front",
      title: "HV Cabling / Front Drive Unit",
      severity: "danger",
      pos: [2.0, 0.57, 0.0],
      normal: [0, 1, 0],
      body: [
        DO_NOT_CUT_ORANGE,
        "HV cables and components may be energized. Avoid touching or",
        "cutting them during any rescue operation.",
        "The high voltage system can remain energized even when the",
        "vehicle is in the OFF state.",
        "AWD versions carry a second drive unit at the rear axle.",
      ],
      source: "Blazer EV ERG p.6-7, p.10",
      verified: false,
    },
    {
      id: "srs-control-unit",
      title: "SRS Control Unit",
      severity: "caution",
      pos: [0.2, 0.62, 0.0],
      normal: [0, 1, 0],
      body: [
        "Airbag control module, in the centre console area between",
        "the front seats.",
        "Airbags are disabled by removing the 12V negative cable -",
        "which also disables thermal runaway mitigation.",
        "Treat undeployed airbags as stored energy until then.",
      ],
      source: "Blazer EV Rescue Sheet p.1 diagram; ERG p.9",
      verified: false,
    },
    {
      id: "restraints-pillar",
      title: "Airbags & Pretensioners - do not cut",
      severity: "caution",
      pos: [0.1, 1.12, 0.95],
      normal: [0, 0, 1],
      body: [
        "Eight airbags: driver, front passenger, 2 knee bolster,",
        "2 front seat outboard, 2 roof rail.",
        "Front belts have TWO pretensioners per side - one at the",
        "retractor, one at the anchor at the base of the seat.",
        "Rear outboard seats have one retractor pretensioner each.",
        "Undeployed units are stored energy. Do not cut these areas.",
      ],
      source: "Blazer EV ERG p.9",
      verified: false,
    },
    {
      id: "high-strength-zone",
      title: "High Strength Steel Zone",
      severity: "info",
      pos: [-0.35, 0.4, 0.97],
      normal: [0, 0, 1],
      body: [
        "The passenger compartment is protected with high strength",
        "steel in the pillars, rocker panels, door reinforcement",
        "beams and floor structure.",
        "Expect these to resist conventional cutting. Plan relief",
        "cuts around them and exercise caution.",
      ],
      source: "Blazer EV ERG p.10",
      verified: false,
    },
    {
      id: "charge-port",
      title: "Charge Port",
      severity: "info",
      pos: [1.38, 0.9, 0.97],
      normal: [0, 0, 1],
      body: [
        "VEHICLE AT A CHARGE STATION: if able, terminate charging by",
        "removing the charge handle from the vehicle.",
        "If the charge handle will not release, a manual release loop",
        "is located underhood, near the battery.",
        "If enabled, the anti-theft alarm may activate.",
      ],
      source: "Blazer EV ERG p.7",
      verified: false,
    },
    {
      id: "lifting-points",
      title: "Lifting Point",
      severity: "info",
      pos: [1.08, 0.32, 0.95],
      normal: [0, 0, 1],
      body: [
        "There are features on the body for use as primary lifting",
        "points.",
        "Do NOT lift the vehicle from any location on the high",
        "voltage battery.",
        "Immobilize first: block the wheels, apply the EPB, and shift",
        "to P using the button on the end of the shift lever.",
      ],
      source: "Blazer EV ERG p.5",
      verified: false,
    },
  ],
};

/**
 * Markers that exist on both sides of the vehicle and so get a passenger-side
 * twin. The front-compartment entries are deliberately absent: the loop, the
 * 12V battery, the SRS module and the front drive unit are each in exactly one
 * place, and the pack marker is on the centreline already.
 *
 * This is applied to the ACTIVE set only - see the bottom of the file.
 */
const SYMMETRIC = new Set(["restraints-pillar", "high-strength-zone", "lifting-points"]);

/**
 * The charge port is the odd one out. A vehicle has ONE, so a twin is not a
 * second port - it is the other candidate fender for an unconfirmed marker.
 * Say so on the card rather than letting the mirror imply two.
 */
const MIRROR_NOTES: Record<string, string[]> = {
  "charge-port": [
    "SIDE UNCONFIRMED: this vehicle has ONE charge port. This marker is",
    "the alternate fender - confirm which side, then delete the other.",
  ],
};

/** Reflect a driver-side (+Z) marker across the vehicle centreline. */
function mirrorToPassengerSide(h: Hotspot): Hotspot {
  return {
    ...h,
    id: `${h.id}-passenger`,
    pos: [h.pos[0], h.pos[1], -h.pos[2]],
    normal: [h.normal[0], h.normal[1], -h.normal[2]],
    body: MIRROR_NOTES[h.id] ? [...h.body, ...MIRROR_NOTES[h.id]] : [...h.body],
    // Mirroring cannot confirm a placement that was never confirmed. The dashed
    // violet ring and the UNCONFIRMED banner stay on both copies.
    verified: false,
    mirroredFrom: h.id,
  };
}

function withPassengerSide(list: Hotspot[]): Hotspot[] {
  const out: Hotspot[] = [];
  for (const h of list) {
    out.push(h);
    if (SYMMETRIC.has(h.id) || h.id in MIRROR_NOTES) out.push(mirrorToPassengerSide(h));
  }
  return out;
}

/**
 * Which of the blocks above actually become markers in VR.
 *
 * Trimmed 2026-08-31 from nine authored entries (thirteen after mirroring) to
 * three. Thirteen beacons around a 4.79 m car read as a halo of dots rather
 * than as the things you must know before you cut - the exact failure the
 * DEPTH note in hotspots.ts warns about, arrived at from the other direction.
 *
 * The other six stay authored above with their ERG quotes and page citations
 * intact, because that sourcing is the expensive part and re-deriving it costs
 * an afternoon. Add an id here to put its marker back in VR; nothing else
 * needs to change.
 *
 * Note that this drops every `caution` entry, so the amber tier is currently
 * absent from the field by design - the survivors are two danger and one info.
 */
const ACTIVE = new Set<string>([
  "first-responder-loop", // danger - where you cut
  "hv-battery-pack", // danger - what kills you
  "lifting-points", // info   - mirrored to both sides
]);

/**
 * Filter BEFORE mirroring, so a switched-off entry takes its passenger-side
 * twin with it. A surviving orphan twin would have no driver-side entry to
 * reflect, which is both wrong on the vehicle and a vr_check.mjs failure.
 */
function active(list: Hotspot[]): Hotspot[] {
  return list.filter((h) => ACTIVE.has(h.id));
}

export const HOTSPOTS: Record<VehicleId, Hotspot[]> = {
  "equinox-ev-2024": withPassengerSide(active(DRIVER_SIDE["equinox-ev-2024"])),
  "blazer-ev-2024": withPassengerSide(active(DRIVER_SIDE["blazer-ev-2024"])),
};

export function hotspotsFor(vehicle: VehicleId): Hotspot[] {
  return HOTSPOTS[vehicle] ?? [];
}
