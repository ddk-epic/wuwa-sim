# Global buffs as single shared instances replacing per-target `team` fan-out

A team-wide buff is now modeled as **one shared Buff Instance** every character reads, declared `target: { kind: "global" }`. This **replaces** the `team` target kind, which fanned each buff out to N per-target instances (one per party member). `team` is deleted from the `Target` union: no buff in the data needed per-target divergence, and "global" is the more honest name for "applies to everyone."

This reverses the prior `CONTEXT.md` invariant _"the engine owns no globals."_ The engine now owns exactly one team-wide bucket — the **Global Buff Store**.

## What makes a single shared instance sound

A per-target instance can carry target-dependent state — a value scaling off the _receiving_ character's stat, or a condition checking the _receiver's_ on-field status. A single shared instance cannot: it has no frozen target, so its contribution must be identical for every reader. We make that an enforced invariant rather than a hope:

- **Effect values must be target-independent** — `const`, or `scaledByStat` pinned to an explicit `characterId` (e.g. Shorekeeper's Stellarealm buffs scale off her `1505` Energy Regen, the same number for every reader).
- **Conditions may reference only the source** (`on:"source"`) — resolved against the buff's owner, once.
- **Reader-referencing conditions** (`on:"target"`, reader `onField`) are **validate-rejected**. None exist on team buffs today; the guard is an explicit "not yet supported" rather than speculative per-reader condition eval.

Because every allowed global effect contributes the same amount to every reader, the existing condition cache (keyed on the instance) stays correct with no per-reader divergence. The data restriction is precisely what licenses the storage collapse.

## Storage: tagged subset of `InstanceStore.active`, not a separate class

Global instances live in `InstanceStore.active`, tagged `global: true` with a `GLOBAL` sentinel `targetCharacterId` — they are **not** housed in a standalone store class.

- `applyBuff`: a `kind:"global"` def dedupes by `def.id` alone and stamps the sentinel target. This single apply _is_ the "push into the store once the buff is picked up as a candidate" step.
- `getActiveTargeting(charId)` / `activeBuffs(charId)`: return instances whose target is `charId` **or** that are `global` — so every character reads globals.
- `applyOrDefer` (stat phase): routes `global` to one `applyBuff` instead of `resolveTargetIds` → N applies.
- Expiry (`tickToFrame`), `runConsumePhase`, `expireOnSourceSwapOut`, and stacking work **unchanged** — a global instance is just an instance every reader sees.
- `buffApplied` / `buffExpired` log events carry the sentinel target; the renderer surfaces it as "team".

A global instance carrying a sentinel target does **not** contradict ADR-0013's rejection of `targetCharacterId: null` for outro-pending buffs. That rejection concerned _pending applications_ (not-yet-live, no concrete target, would break the `(id, target)` dedup key and collide with `expiresOnSourceSwapOut`). A global instance is _live_ — it has a concrete (sentinel) target, a real `endTime`, a stable dedup key (`def.id` alone), and its source is its owner (who is not swapping out the instance away). Pending-vs-live remain different concepts.

## Considered Options

- **Standalone `GlobalBuffStore` collaborator.** Rejected: it would re-implement the lifecycle `InstanceStore` already owns (`tickToFrame` expiry, `runConsumePhase`, `expireOnSourceSwapOut`, stacking) — duplicating the engine's trickiest code for conceptual tidiness. Not worth it until ownerless buffs need a distinct trigger-seeding path (they don't — see below).
- **Keep `team` as the data name, swap only its storage under the hood.** Rejected: "global" is the correct domain term and generalizes to the ownerless level-buff case ("the team's" buff is wrong for an environment-granted one). One name, one behavior.
- **Keep both `team` (per-target) and `global` (shared).** Rejected (YAGNI): no buff needs per-target fan-out. If a target-dependent buff ever appears, re-add a per-target kind then.
- **Build per-reader condition eval now.** Rejected: no team buff references the reader; validate-reject the case until a real consumer arrives.

## Consequences

- `Target` union loses `team`, gains `global`. Every `target:{kind:"team"}` in the data (9 files) migrates to `global`.
- `BuffInstance` gains a `global: true` tag; `applyBuff` / `getActiveTargeting` / `activeBuffs` / `applyOrDefer` gain a global branch.
- `validateBuffDef` gains the target-independence + source-only-condition guard for global defs.
- The 6 Stellarealm/Butterfly defs fold into `shorekeeper.ts` (a global buff is triggered from its owner's `triggerableBySource` bucket, so it must be seeded on the owner's slot path). `src/data/global-buffs.ts`, the bootstrap loop (`buff-engine.ts:246-260`) + its import, and the `owner` field on `BuffDef` are all **deleted** — sequence gating is already handled by `buildCharacterBuffDefs`, and `owner` had no other reader.
- **Deferred:** ownerless level buffs are envisioned as always-on **permanent global instances seeded at bootstrap** — no trigger path, no candidate selection. The store is already owner-agnostic (sentinel source + sentinel target), so the only future plumbing is a bootstrap seeding step. No part of it is built now.
