# Echo stat rolls bypass the buff pipeline as base-value contributions

Echo main stats and the default substat block accumulate directly into the base Stat Table during `bootstrapSlot`, following the existing `applyWeaponIntrinsic` precedent. They are not wrapped as `BuffDef`s and do not enter the buff pipeline. Echo _skill buffs_ (`Echo.buffs`) and echo-set bonuses (`EchoSet.buffs`) remain pipeline citizens — only the flat stat rolls take the direct path. Reason: a fully populated echo build contributes 5 main stats + ~16 substat rolls per character (~21 values × 3 chars = ~63 per loadout). All are unconditionally `simStart` + `permanent` + no-stacks — they never exercise any pipeline feature beyond the bootstrap fast-path accumulation, and wrapping them as buffs would inflate permanent-instance volume ~5–7× while inventing synthetic IDs (`echo-sub.{charId}.crit-rate.3`) with no inspection or debugging value.

## Considered Options

- Compile every echo main and substat roll to a permanent `simStart` `BuffDef` (the literal reading of ADR-0001). Rejected: high volume, synthetic IDs with no natural meaning, and zero use of pipeline features — pure ceremony.
- Accumulate echo stats directly into `baseStats` via a dedicated bootstrap path. Chosen: matches how `applyWeaponIntrinsic` already handles weapon main/sub stats, keeps stat-roll values in a single constants file, and leaves the buff pipeline reserved for things that actually have triggers, conditions, or durations.

## Consequences

- ADR-0001's "every damage modifier is a buff" no longer holds literally. The carve-out: pure base-value contributions (character intrinsic stats, weapon main/sub stats, echo stat rolls) bypass the pipeline; everything with a trigger, condition, duration, or stack count stays in it.
- The Stat Table glossary entry's phrase "Permanent buffs are folded into a base table at sim start" must be read narrowly — echo stats _are_ the base table for that purpose, not buffs folded into it.
- Echo stat-roll constants live in one file (`src/lib/loadout/echo-stat-constants.ts`) so revising values when sourced data arrives is a single-file edit.
- Adding a new echo stat _kind_ (a new main-stat option, a new substat) means editing the constants file and possibly the Stat Table type — not authoring a BuffDef.

## Amendment — resolver reorg

The direct-accumulation path moved out of `bootstrapSlot` into the per-entity `resolve-*` peers: echo rolls now accumulate in `resolveEchoStats` (`loadout/resolve-echo.ts`) and weapon main/sub in `resolveWeaponStats` (`loadout/resolve-weapon.ts`), composed by `resolveSlot` (`loadout/resolve-slot.ts`); `bootstrapSlot` keeps only the fold-vs-seed seeding. The decision is unchanged — flat rolls still bypass the buff pipeline as base-value contributions, still alongside the `applyWeaponIntrinsic` precedent (which moved into `resolve-weapon` with them).
