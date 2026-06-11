# Resources stored separately from Stat Table, queried through unified vocabulary

Energy, Concerto, Forte, and Resonance are stored on the Buff Engine as a per-character `ResourceState`, NOT as fields on the Stat Table. They have caps, consumption semantics, and per-character ownership that don't align with the way damage-modifier stats are read and combined. However, the authoring vocabulary is unified: buff Triggers and Conditions query resource state through the same `{ kind: "resource", ... }` shape used for stat queries, so buff authors only need one mental model.

## Consequences

- Hit-driven resource generation moves out of `simulation-log.ts` into the engine. A hit's `DamageEntry.energy` / `.concerto` / `.forte` are interpreted as implicit `resource`-kind effects fired on `hitLanded`, with the engine owning the accumulators.
- A new Effect kind `resource` exists alongside `stat` and `emitHit`. Its phase ordering in dispatch is `resource → stat → emitHit`.
- Energy gained from a `DamageEntry.energy` is scaled at gain time by the actor's `energyRechargePct`: `actorGain = entryEnergy × (1 + actorER)`. Concerto is not scaled. Flat resource grants from `resource`-kind buff effects are also unscaled (see CONTEXT.md "Resonance Energy" for the two gain channels and shared-energy semantics).
- **Forte** is the third implicit channel, with three differences from energy/concerto:
  - It is **optional** on `DamageEntry` (`forte?: number`). Missing/0/undefined is a no-op — only entries that actually grant forte declare it.
  - It is scaled at gain time by the actor's `forteRechargePct`: `actorGain = entry.forte × (1 + actorForteRechargePct)`, parallel to energy's ER scaling — but applied to **gains only**; a negative `forte` (a consumption cost, ADR-0032) is applied raw. The stat is buff-writable but is not surfaced in UI, skill-tree bonuses, or echo substats.
  - It is **not shared** to teammates (unlike energy's 50% split). It is per-character, capped by `EnrichedCharacter.forteCap`, enforced by the existing resource-ledger clamp.
- The scaled forte value is not floored — the ledger accepts fractional forte. Authors who want integer grants should keep the entry's `forte` integer and accept that scaling may produce fractions. Authoring a per-cast grant on a multi-hit stage: set `forte` on exactly one entry (typically the first) rather than splitting across entries.

## Known limitations to revisit

- **Resonance Liberation cost gating** is not enforced; the sim computes Liberation damage even when energy < cost and raises an `insufficientEnergy` Diagnostic on the Action Event (surfaced on the timeline row). Revisit if/when the timeline editor is taught to gate availability.
