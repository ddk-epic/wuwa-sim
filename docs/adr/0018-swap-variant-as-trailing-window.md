# Swap variant as trailing-window with auto-pad and cancel-drop on same-character re-entry

> **Later note:** The authored-`swap` advance formula in this ADR (`variant.actionTime + reactionDelay`) is subject to the **Variant Floor** added in the [ADR-0008 amendment](0008-stage-variants-as-actionframe-truncation.md#amendment--variant-floor-minimum-advance-for-authored-variants): `advance = max(actionTime + reactionDelay, variantFloor)`. Trailing-window behavior continues to key off the resulting `advance` value; the floor changes which hits are immediate vs. trailing but never changes total damage.

The `swap` Stage Variant — deferred by [ADR-0008](0008-stage-variants-as-actionframe-truncation.md) pending the Trailing Window concept — ships as a third member of `VariantKind` alongside `cancel` and `instantCancel`. Unlike the other two, `swap` does **not** truncate the stage's damage: the cursor advances by a short `advance` value while every authored Damage Entry still resolves at its original `stageStartFrame + actionFrame`, including frames past the next entry's start. This is the **Trailing Window**: the swapped-out character's stage continues to emit hits in the background while the timeline cursor proceeds under whoever the player switched to (or the same character on a later re-entry). To make the split expressible in the engine, `resolveStageExecution` returns `{ advance, hits }` instead of `{ duration, damage }`: for `cancel`/`instantCancel` the two numbers are equal and `hits` is filtered to `actionFrame ≤ advance` (the contract from ADR-0008 is preserved); for `swap` they decouple — `advance` is the cursor step and `hits` is the full authored list, unfiltered. The `advance` value for swap follows a **default-fallback** rule, not a floor: if the stage authors `variants.swap = { actionTime: N }` the value is `N + reactionDelay` (the same shape as the other variants); otherwise the value is the global `swapFrames` setting. `swapFrames` is a new player-level field on `Settings` parallel to `reactionDelay`, defaulting to 6 frames at 60fps (with `reactionDelay`'s default also dropping from 9 to 6 in the same change); both live in the existing `wuwa.settings` localStorage key. A `swap`-variant entry whose **immediately following** Timeline Entry has the same `characterId` raises a validation warning (not error) — swap exits the character from the field, so the next input cannot logically be the same character.

**Same-character re-entry rule.** When a later entry shares `characterId` with a swap-variant stage whose trailing hits have not all landed, the engine branches on the re-entry's `resolved.skillType`:

- **Cancel-capable types** — `Resonance Skill`, `Resonance Liberation`, `Intro Skill`, `Outro Skill`, `Echo Skill`. The re-entry's own animation cancels the residual: no padding occurs, and any trailing hit whose `hitFrame ≥ newEntry.startFrame` is **dropped**. Cast-time resources on the original swap stage (cooldown, concerto, energy, resonance) were credited at its start, so no rollback. The Simulation Log surfaces a per-entry "N hits dropped" annotation on the swap-canceled stage; the Timeline row does not.
- **Non-cancel-capable types** — `Basic Attack`, `Movement` (i.e., what `categoryToSkillType` rolls Normal Attack / Inherent Skill / Tune Break into, plus Movement). The character is still locked in animation, so the **immediately preceding** entry's `advance` is extended just enough to push the re-entry's start past the last trailing hit's frame. All trailing hits land. The added frames are attributed to the preceding entry, not to the swap stage.

The split is by post-rollup `skillType` so that "normal attack combos cannot be cancel-interrupted" falls out of the type taxonomy rather than needing a stage-level `canInterrupt` flag. Hits dropped under the cancel-capable branch and frames added under the non-cancel-capable branch are mutually exclusive — exactly one applies per same-character re-entry. Different-character entries never trigger either path: their activity overlaps the trailing hits silently, by design.

**Padding/delay rendering.** Any frames added on top of a stage's base `advance` — whether from `reactionDelay` (every variant, including the retroactive treatment of `cancel`/`instantCancel` entries authored before this ADR) or from a swap-back auto-pad — surface as a `+0.Xs` suffix on the Timeline row and the Simulation Log entry. The displayed number is the **merged** total; a tooltip splits the components (`react: 0.1s, pad: 0.3s`) for forensics. Display unit is seconds; the underlying values stay in frames.

**Trailing-hit ownership.** A trailing hit retains the swap stage's `characterId` as its acting character — already the behavior of `processHit`, since the entry's `characterId` is captured at scheduling time. Buff snapshotting continues to read whatever state is active at `hitFrame`, with no concept of on-field versus off-field character. A team buff activated by the swapped-in character mid-window therefore _does_ affect trailing hits of the swapped-out character if the buff's filters match. This is the deliberate minimal-scope choice: on-field/off-field semantics are out of scope and would be introduced by a future ADR when the first buff actually keys on that distinction.

## Considered Options

- **Validation-only — `swap` is purely a UI label, engine treats it as no-variant.** Rejected. The user-visible behavior the variant exists to deliver — combo chains and damage continuing while other inputs happen on a short timeline cost — does not emerge without the cursor-advance / damage-cutoff split. A label that produces identical sim output would be cosmetic.
- **`swap` as truncation, identical mechanic to `cancel`.** Rejected for the reason ADR-0008 already gave: it silently deletes hits the player actually landed, producing systematically wrong DPS for swap-cancel rotations — the exact workflow the feature exists to enable.
- **`swapFrames` as a literal floor (`advance = max(authoredActionTime + reactionDelay, swapFrames)`).** Rejected. `reactionDelay` already stacks rather than flooring; making `swapFrames` a floor would be the only setting in `Settings` to behave that way, and authors who want a longer swap can just write a higher `actionTime`. Default-fallback semantics are consistent with the rest of the variant schema.
- **`canInterrupt: boolean` flag on Stages to mark normal-attack chains as un-cancellable.** Rejected. Variants in ADR-0008 are already explicit per-stage opt-ins — a stage that should not be swap-cancellable simply omits `variants.swap`. The flag adds no information the absence of the variant doesn't already convey, and the auto-pad rule itself is type-driven (Basic Attack falls into the non-cancel-capable bucket), not stage-flag-driven.
- **Pad the swap stage itself instead of the preceding entry.** Rejected. The swap stage's `advance` is the user-visible commitment of "I'm switching now"; retroactively inflating it to cover the trailing tail would obscure the gameplay reality and conflate the cursor-advance number with the animation-completion number, recreating the conflation this ADR exists to break. Attributing the pad to the _preceding_ entry models the actual game state — the player's last input on the previous character is what's holding the re-entry off.
- **Pad on all same-character re-entries regardless of `skillType`.** Rejected. The cancel-capable skill types (`Resonance Skill`, `Resonance Liberation`, `Intro Skill`, `Outro Skill`, `Echo Skill`) genuinely interrupt residual animation in WuWa; padding them would over-charge frames the player doesn't actually spend, and the dropped-hits outcome is the in-game truth. The branch is load-bearing.
- **Drop trailing hits on _all_ same-character re-entries (no auto-pad anywhere).** Rejected for the symmetric reason: Basic-Attack continuations cannot interrupt a prior swap-cancel, so silently dropping hits would under-count damage the player actually lands.
- **Introduce on-field / off-field tracking now and key buff filters on it.** Rejected as scope creep. No currently authored buff differentiates on-field from off-field characters, and the only thing trailing hits need today is correct acting-character ownership (already preserved by `entry.characterId`). When the first on-field-keyed buff is authored, it earns its own ADR and brings the tracking with it.
- **Validation _error_ (instead of warning) on same-character entry immediately after a swap.** Rejected. The warning is informational; a future authoring case may want the warning suppressed (e.g., demonstrating an invalid input to illustrate a constraint), and ADR-0008's pattern is that variants degrade gracefully rather than hard-blocking. Other immediate-prerequisite checks (`requiresStageId`) are errors because the sim cannot proceed; here the sim can proceed and just produces a result the player flagged as physically impossible.
- **Per-entry `swapFrames` override.** Rejected for the same reason ADR-0008 removed the editable `actionTime` field: stage + variant + global settings derive the value, and a manual override creates a second source of truth that drifts.
- **Surface the pad/delay only in the Simulation Log, not on the Timeline row.** Rejected. The Timeline is the editing surface — the user needs to see at the row level why a stage is taking longer than its authored frames, otherwise the auto-pad behaves as "invisible engine magic." The merged `+0.Xs` suffix is compact enough not to clutter; the tooltip handles the split.
- **Surface dropped hits as a Timeline-row badge.** Rejected. Drops happen on the _prior_ (swap-canceled) entry, not the row the user is currently editing; the visual association is weak. Log-only annotation matches where the user looks when reconciling expected vs. actual damage.

## Consequences

- `VariantKind` becomes `"cancel" | "instantCancel" | "swap"`. The Timeline variant toggle order in `TimelineEntryRow.tsx` becomes `Full → Cancel → Instant Cancel → Swap → Full`, with undefined variants skipped per existing logic. Label: `"SWAP"`.
- `Settings` becomes `{ reactionDelay: number; swapFrames: number }`; defaults `{ reactionDelay: 6, swapFrames: 6 }`. The setter generalizes from a single-field signature (`setReactionDelay(value)`) to a patch shape. The localStorage key (`wuwa.settings`) is unchanged; older saved settings missing `swapFrames` fall back to the default via the `useLocalStorage` merge path.
- `resolveStageExecution` and `resolveActionTime` in `src/lib/stage/stage.ts` change shape. Callers in `src/lib/simulation.ts` and `src/components/TimelineEntryRow.tsx` are updated to consume `{ advance, hits }`. The `cancel`/`instantCancel` numerics are preserved bit-exact — `advance === oldDuration`, `hits === oldDamage` — so existing tests in `stage.test.ts` and `simulation.test.ts` continue to bind unchanged behavior on those paths.
- `simulation.ts` schedules swap-variant hits at `stageStartFrame + hit.actionFrame` without the duration filter. Cursor advances by `advance`. After each entry, a same-character lookahead identifies pending trailing hits whose `hitFrame > stageStartFrame + advance`; on the corresponding later same-character entry, the engine consults `resolved.skillType` to decide between hit-drop and pad-preceding-entry. Drops mutate the in-flight hit schedule for the swap stage; pads mutate the prior entry's effective `advance` and contribute to its rendered `+0.Xs` suffix.
- `validate-timeline` gains a warning channel distinct from `rowErrors`. The same-character-after-swap rule emits into that channel only; existing `requiresStageId` reachability continues to treat any variant — including `swap` — as satisfying the gate, matching ADR-0008's rule.
- The Simulation Log's Action Event already records `variantKind`; `swap` rides that field. A new optional field captures dropped-hit count on the swap stage's Action Event for the log-only annotation.
- Cast-time effects (`skillCast` dispatch, cooldown roll, concerto, energy, resonance cost) fire on `swap` identically to `instantCancel`. The cast happened.
- Stages whose authored Damage Entries are all at `actionFrame: 0` derive no trailing window from `swap` — every hit lands at the cursor regardless. The variant remains authorable on such stages but produces the same DPS as `instantCancel` plus the `swapFrames` cursor cost. A backfill of realistic `actionFrame` data on swap-relevant stages is a prerequisite for swap to be meaningfully distinguishable on those stages, exactly as ADR-0008 already noted for `cancel`/`instantCancel`.
- New domain terms enter the project glossary under Core simulation: **Swap (Variant Kind)**, **Swap Frames**, **Trailing Window**, **Padding Delay**.
- On-field / off-field character tracking remains explicitly out of scope. Future authors of a buff that keys on field state will reopen this question in a new ADR.

## Amendment — Trailing Window extracted to its own module; drop-count annotation removed

Two sections of this ADR are superseded:

1. **Drop-count annotation removed.** The "per-entry 'N hits dropped' annotation on the swap-canceled stage's Action Event" (described in the cancel-capable branch above and in the Simulation Log consequence) is dropped. Cancel-capable trailing hits are silently discarded. The `droppedHitCount` field on `ActionEvent` is removed; the `swapActionRef` reach-back into the log no longer exists. Forensics can be reintroduced later as a dedicated log event emitted at drop time (which is temporally honest — drops happen at the new entry's frame, not at the swap stage) if a use case arises.

2. **Trailing Window coordination lives in its own module.** The pending-trailing-hit Map, the same-character collision branching, the pad-extension, the immediate/trailing partition rule, and the `CANCEL_CAPABLE` Skill Type set move out of `simulation.ts` and into `src/lib/stage/trailing-window.ts` as pure functions over a `TrailingWindowState` value:

   ```ts
   export interface TrailingHit {
     hit
     hitIndex
     stageStartFrame
     entry
     resolved
     hitFrame
   }
   export type TrailingWindowState = ReadonlyMap<number, readonly TrailingHit[]>
   export function empty(): TrailingWindowState
   export function onEntryArrival(
     state,
     { characterId, skillType, frame },
   ): { fireBeforeEntry; padFrames; stateAfter }
   export function scheduleStage(
     state,
     { entry, resolved, stageStartFrame, hits, variantKind, stageDuration },
   ): { immediate; stateAfter }
   export function drainAll(state): readonly TrailingHit[]
   ```

   `runSimulation` becomes a thin walker: per entry it calls `onEntryArrival` (drain + pad), runs the entry, calls `scheduleStage` (partition + schedule), and `drainAll` at the end. `processHit` is refactored to take a `TrailingHit` bundle so immediate, pre-entry, and final-drain hits all flow through the same firing loop. No engine, log, or stage data leaks into `trailing-window.ts` — the state machine is testable in isolation against ADR-0018's branching rules.

   The behavioral contract above (cancel-capable drops vs. non-cancel-capable pad, default-fallback `advance`, trailing-hit ownership, `reactionDelay` stacking) is preserved bit-exact on every path except the removed annotation.

## Amendment — Trailing Window module dissolved onto the event stream

The `TrailingWindowState` Map and its `onEntryArrival` / `scheduleStage` / `drainAll` operations are removed (see [ADR-0028](0028-emithits-as-frame-honest-worklist.md)'s endgame). Trailing hits are no longer stored in a per-character map; they become members of the one frame-ordered **pending event stream** the simulation drains, resolving frame-honestly at their `hitFrame` interleaved with synthetics and footing commits. The behavioral rules of this ADR survive, relocated:

- **Drop-on-cancel → tombstone.** A same-character cancel-capable re-entry at frame `F` marks the character's pending trailing hits with `frame ≥ F` invalid (skipped at pop) instead of deleting them from a map. Sound by causality: a cancel only drops `hitFrame ≥ F`, so it can never arrive after the hit it cancels.
- **Pad-on-collision → cursor rule.** The non-cancel-capable pad stays an arrival-time `nextStart = max(cursor, latestPendingSameCharFrame)` computation on the authored walk.
- **Immediate/trailing partition** survives as the pure helper `partitionStage` in `trailing-window.ts` (the only thing left in that file, alongside `isCancelCapable`); the simulation enqueues the trailing partition onto the stream.

The Trailing Window's footing commit (`pendingFooting`) likewise dissolves into a footing **stream event** carrying per-character footing — see [ADR-0022](0022-footing-as-team-state-with-trailing-window-snapshot.md)'s "Per-character footing on the event stream" amendment. The contract (which hits drop vs. land, which pad, trailing-hit ownership) is preserved; what changes is that a trailing hit now resolves in global frame order rather than in a per-entry batch, so it can interleave into the log between a later entry's events (the off-field-damage interleaving the endgame exists for).
