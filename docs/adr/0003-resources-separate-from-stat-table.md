# Resources stored separately from Stat Table, queried through unified vocabulary

Energy, Concerto, Forte, and Resonance are stored on the Buff Engine as a per-character `ResourceState`, NOT as fields on the Stat Table. They have caps, consumption semantics, and per-character ownership that don't align with the way damage-modifier stats are read and combined. However, the authoring vocabulary is unified: buff Triggers and Conditions query resource state through the same `{ kind: "resource", ... }` shape used for stat queries, so buff authors only need one mental model.

## Consequences

- Hit-driven energy and concerto generation moves out of `simulation-log.ts` into the engine. A hit's `DamageEntry.energy` / `.concerto` are interpreted as implicit `resource`-kind effects fired on `hitLanded`, with the engine owning the accumulators.
- A new Effect kind `resource` exists alongside `stat` and `emitHit`. Its phase ordering in dispatch is `resource → stat → emitHit`.
- Energy gained from a `DamageEntry.energy` is scaled at gain time by the actor's `energyRechargePct`: `actorGain = entryEnergy × (1 + actorER)`. Concerto and other resources are not scaled. Flat resource grants from `resource`-kind buff effects are also unscaled (see CONTEXT.md "Resonance Energy" for the two gain channels and shared-energy semantics).

## Known limitations to revisit

- **Resonance Liberation cost gating** is not enforced; v1 computes Liberation damage even when energy < 100 and emits a console warning. Revisit if/when the timeline editor is taught to gate availability.

## Amendment (2026-05-22): Forte joins the implicit hit-driven channel

`DamageEntry.forte` is now a third implicit resource channel alongside `energy` and `concerto`. On `hitLanded`, the engine dispatches `entry.forte` as a `resource`-kind delta on `forte`, scoped to the actor.

- Unlike `energy`/`concerto`, `forte` is **optional** on `DamageEntry` (`forte?: number`). Missing/0/undefined is a no-op. Only entries that actually grant forte declare it; existing entries are not touched.
- Forte is scaled at gain time by the actor's `forteRechargePct`: `actorGain = entry.forte × (1 + actorForteRechargePct)`. Parallel to energy's ER scaling. The stat is buff-writable but is not surfaced in UI, skill-tree bonuses, or echo substats.
- Forte is **not shared** to teammates (unlike energy's 50% split). It is per-character, capped by `EnrichedCharacter.forteCap`, enforced by the existing resource-ledger clamp.
- The scaled value is not floored — the ledger accepts fractional forte. Authors who want integer grants should keep the entry's `forte` integer and accept that scaling may produce fractions.
- Authoring a per-cast grant on a multi-hit stage: set `forte` on exactly one entry (typically the first) rather than splitting across entries. This mirrors the previous `hitIndex: 1` convention used by removed buffs like `char.verina.forte.grant-skill`.
