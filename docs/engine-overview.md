# Engine Overview

The simulator walks an authored Timeline of Stages, resolves each hit against a live Stat Table maintained by the Buff Engine, and emits a Simulation Log of Action/Hit/Buff events. This page is the map: it names the major moving parts and points at the concept page for each.

**Source files:** `src/lib/engine-bootstrap.ts`, `src/lib/buff-engine.ts`, `src/lib/stage.ts`, `src/lib/compute-damage.ts`, `src/lib/simulation-log.ts`

## How it works

At the highest level:

1. **Bootstrap** (`src/lib/engine-bootstrap.ts`) — for each team slot, resolve character + loadout into base stats and seed permanent buff instances (passive buffs, weapon effects, echo set bonuses).
2. **Timeline walk** (`src/lib/stage.ts` and the simulator loop) — iterate Timeline Entries in order. For each entry, fetch its Stage, apply any Stage Variant, schedule its Damage Entries against the frame clock.
3. **Per-hit resolution** — at each Damage Entry's frame, the Buff Engine ticks expirations, dispatches the `hitLanded` event through its Phase Pipeline (`resource → stat → emitHit → consume`), resolves a Stat Table snapshot, and runs the damage formula in `src/lib/compute-damage.ts`.
4. **Logging** (`src/lib/simulation-log.ts`) — every Action, Hit, and Buff lifecycle transition emits onto the Simulation Log for inspection.

## Modules

- **`buff-engine`** — the coordinator. Owns the Phase Pipeline and composes the modules below. See [buff-engine](buff-engine.md).
- **`instance-store`** — active buff instances, target resolution, expiry, pending-nextOnField queue.
- **`resource-ledger`** — per-character Energy, Concerto, Forte, Resonance counters.
- **`on-field-tracker`** — current on-field character; swap inference from successive Timeline Entries.
- **`emit-hit-dispatcher`** — synthetic hit emission with ICD bookkeeping.
- **`stat-table-builder`** — base stat bootstrap + per-hit stat-effect accumulation.
- **`compute-damage`** — pure damage formula given a Stat Table snapshot + Damage Entry.
- **`catalog` / `template` / `focused-stage-catalog`** — character/skill/stage data resolution.
- **`resolve-echo-sets` / `weapon-resolve` / `skill-tree-compile`** — loadout resolution into stat contributions.
- **`simulation-log` / `timeline-summary` / `validate-timeline` / `migrate-timeline`** — log structures and timeline tooling.

## Related

- [buff-engine](buff-engine.md)
- [CONTEXT.md § Core simulation](../CONTEXT.md#core-simulation)
- [CONTEXT.md § The buff system](../CONTEXT.md#the-buff-system)
- [ADR-0001: buff system as unified modifier pipeline](adr/0001-buff-system-as-unified-modifier-pipeline.md)
- [ADR-0006: phase-based effect dispatch](adr/0006-phase-based-effect-dispatch.md)
