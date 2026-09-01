/**
 * One owner of "what is in input-source slot i".
 *
 * WHY THIS EXISTS
 * ---------------
 * Four modules used to run four independent state machines over the same two
 * events. vr-input.ts listened on the target-ray space, controller-hints.ts and
 * controller-models.ts each on the grip space, hand-input.ts on the hand space -
 * plus a fifth inside three's own XRControllerModelFactory. Every one of them
 * kept a private table of which slot held what, nothing reconciled them, and the
 * divergence only showed up on the transition none of them were written for:
 * putting the controllers down and carrying on with tracked hands.
 *
 * The symptoms were exactly what you would predict from five disagreeing state
 * machines. The on-controller legend's hand branch was an early `return` with no
 * teardown, so it kept naming Trigger/Stick/B/Y at a hand that has none. The
 * controller model accumulated overlapping glTF clones (see controller-models.ts
 * for that one - it is three's bug, but only reachable through this transition).
 *
 * three dispatches `connected`/`disconnected` to the target-ray, grip AND hand
 * spaces from a single WebXRController.dispatchEvent, so ONE listener pair per
 * slot sees every transition. The ray space is the one used here because it is
 * the space that always exists, whatever is in the slot.
 *
 * TWO TRAPS WORTH KNOWING
 * -----------------------
 * 1. THREE ASSIGNS AT MOST TWO SLOTS AND SILENTLY DROPS THE REST.
 *    WebXRManager's onInputSourcesChange comments it plainly - "If all
 *    controllers do currently receive input we ignore new ones" - and `break`s.
 *    A Quest that reports controllers and hands at the same time therefore
 *    delivers whichever pair arrived first and nothing else, forever, until one
 *    of them is removed. So `mode` here is derived from the SLOTS, not from
 *    session.inputSources: it has to describe what the app can actually act on.
 *    `droppedSources` exposes the difference for the ?diag=1 readout, because
 *    "hand tracking just doesn't work" is otherwise indistinguishable from a
 *    tracking fault and would send the next person hunting in the wrong place.
 *
 * 2. ORDER MATTERS AND IS RELIED ON. These listeners are installed at
 *    construction, before ControllerModels asks the factory to register its own
 *    on the grip, and three fires the ray space first. Every subscriber's state
 *    is therefore current by the time the factory reacts to the same event.
 *
 * `set()` is public on purpose: it is both the event path and the ?dev=1 seam
 * that lets vr_check.mjs drive a controller/hand handover headlessly. Nothing
 * else in this app can produce an `inputsourceschange` outside a headset, which
 * is why the handover could sit broken in a shipped build unnoticed.
 */
import type { WebGLRenderer } from "three";
import type { Handedness } from "./vr-input";

/** What the user is holding. Drives every surface that names a control. */
export type InputMode = "controllers" | "hands" | "mixed" | "none";

/** What one slot holds. `none` is an empty slot, not an unknown one. */
export type SlotKind = "controller" | "hand" | "none";

export type SlotState = {
  kind: SlotKind;
  /** Null when the runtime reports "none" handedness, which some do for gaze. */
  hand: Handedness | null;
};

/**
 * The part of XRInputSource this reads.
 *
 * Structural rather than the DOM type so the dev seam can hand in a plain
 * object. `hand` is an XRHand or undefined - a real, spec-defined discriminator,
 * which is why nothing here sniffs `profiles` for "generic-hand". A string match
 * on a profile list is a guess about naming; `hand` is the answer.
 */
export type InputSourceLike = {
  handedness?: string;
  hand?: unknown;
  gamepad?: unknown;
};

/** three creates a WebXRController per index on demand; this app uses two. */
export const SLOT_COUNT = 2;

function handOf(src: InputSourceLike): Handedness | null {
  return src.handedness === "left" || src.handedness === "right" ? src.handedness : null;
}

export class InputSources {
  readonly slots: SlotState[] = [];

  private listeners: ((slots: readonly SlotState[]) => void)[] = [];
  private renderer: WebGLRenderer;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    for (let i = 0; i < SLOT_COUNT; i++) {
      this.slots.push({ kind: "none", hand: null });
      const slot = i;
      // getController(i) is the target-ray space. Asking for it also CREATES
      // three's WebXRController for the slot, which is what makes the slot
      // eligible for an input source at all - so this loop is load-bearing even
      // before the listeners.
      const ray = renderer.xr.getController(i);
      ray.addEventListener("connected", (event) => {
        this.set(slot, (event as unknown as { data?: InputSourceLike }).data ?? null);
      });
      ray.addEventListener("disconnected", () => this.set(slot, null));
    }
  }

  /**
   * Record what a slot now holds, and tell everyone if it changed.
   *
   * Idempotent: a repeated `connected` for the same thing fires nothing, so a
   * subscriber's handler can be written as a plain transition without guarding
   * against being called twice.
   */
  set(index: number, src: InputSourceLike | null) {
    const slot = this.slots[index];
    if (!slot) return;
    const kind: SlotKind = !src ? "none" : src.hand ? "hand" : "controller";
    const hand = src ? handOf(src) : null;
    if (slot.kind === kind && slot.hand === hand) return;
    slot.kind = kind;
    slot.hand = hand;
    this.emit();
  }

  onChange(cb: (slots: readonly SlotState[]) => void) {
    this.listeners.push(cb);
  }

  private emit() {
    for (const cb of this.listeners) cb(this.slots);
  }

  kindOf(index: number): SlotKind {
    return this.slots[index]?.kind ?? "none";
  }

  handOf(index: number): Handedness | null {
    return this.slots[index]?.hand ?? null;
  }

  isHand(index: number): boolean {
    return this.kindOf(index) === "hand";
  }

  /** Which slot a given physical hand is in, or -1. */
  indexOf(hand: Handedness): number {
    return this.slots.findIndex((s) => s.hand === hand && s.kind !== "none");
  }

  /**
   * What the user is holding, as far as this app can respond to it.
   *
   * "mixed" means the two slots genuinely disagree - one controller, one tracked
   * hand - which is a state the Quest does produce and which both movement and
   * the bindings list have to handle.
   */
  get mode(): InputMode {
    let hands = 0;
    let pads = 0;
    for (const s of this.slots) {
      if (s.kind === "hand") hands++;
      else if (s.kind === "controller") pads++;
    }
    if (hands && pads) return "mixed";
    if (hands) return "hands";
    if (pads) return "controllers";
    return "none";
  }

  /** Slots three has actually filled. */
  get assignedCount(): number {
    return this.slots.filter((s) => s.kind !== "none").length;
  }

  /**
   * Input sources the session is reporting that three never handed to a slot.
   *
   * Non-zero means trap 1 above has bitten: the runtime is offering input this
   * app can never see. Surfaced rather than worked around, because the fix is
   * "put one pair down", not anything in this codebase.
   */
  get droppedSources(): number {
    const listed = this.renderer.xr.getSession()?.inputSources.length ?? 0;
    return Math.max(0, listed - this.assignedCount);
  }

  /** What the headless check reads back. */
  snapshot() {
    return {
      mode: this.mode,
      slots: this.slots.map((s) => ({ kind: s.kind, hand: s.hand })),
      assigned: this.assignedCount,
      dropped: this.droppedSources,
    };
  }
}
