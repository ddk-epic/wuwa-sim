# Resources stored separately from Stat Table, queried through unified vocabulary

Energy, Concerto, Forte, and Resonance are stored on the Buff Engine as a per-character `ResourceState`, NOT as fields on the Stat Table. They have caps, consumption semantics, and per-character ownership that don't align with the way damage-modifier stats are read and combined. However, the authoring vocabulary is unified: buff Triggers and Conditions query resource state through the same `{ kind: "resource", ... }` shape used for stat queries, so buff authors only need one mental model.

## Consequences

- Hit-driven energy and concerto generation moves out of `simulation-log.ts` into the engine. A hit's `DamageEntry.energy` / `.concerto` are interpreted as implicit `resource`-kind effects fired on `hitLanded`, with the engine owning the accumulators.
- A new Effect kind `resource` exists alongside `stat` and `emitHit`. Its phase ordering in dispatch is `resource → stat → emitHit`.

## Known limitations to revisit

- **Resource gain buffing** (e.g. "+20% Energy Regen") is not modeled in v1. The current path reads `DamageEntry.energy` directly into the resource pool with no scaling step. Revisit when the first such buff is needed.
- **Resonance Liberation cost gating** is not enforced; v1 computes Liberation damage even when energy < 100 and emits a console warning. Revisit if/when the timeline editor is taught to gate availability.
