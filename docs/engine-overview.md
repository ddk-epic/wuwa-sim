# Engine Overview

The simulator walks an authored Timeline of Stages, resolves each hit against a live Stat Table maintained by the Buff Engine, and emits a Simulation Log of Action/Hit/Buff events. This page is the map: it names the major moving parts and points at the concept page for each.

**Source files:** `src/lib/engine-bootstrap.ts`, `src/lib/engine/buff-engine.ts`, `src/lib/stage.ts`, `src/lib/damage/compute-damage.ts`, `src/types/simulation-log.ts`

## How it works

At the highest level:

1. **Bootstrap** (`src/lib/engine-bootstrap.ts`) — for each team slot, resolve character + loadout into base stats and seed permanent buff instances (passive buffs, weapon effects, echo set bonuses).
2. **Timeline walk** (`src/lib/stage.ts` and the simulator loop) — iterate Timeline Entries in order. For each entry, fetch its Stage, apply any Stage Variant, schedule its Damage Entries against the frame clock.
3. **Per-hit resolution** — at each Damage Entry's frame, the Buff Engine ticks expirations, dispatches the `hitLanded` event through its Phase Pipeline (`resource → stat → emitHit → consume`), resolves a Stat Table snapshot, and runs the damage formula in `src/lib/damage/compute-damage.ts`.
4. **Logging** (`src/types/simulation-log.ts`) — every Action, Hit, and Buff lifecycle transition emits onto the Simulation Log for inspection.

## Modules

Modules are grouped into sub-folders under `src/lib/`:

- **`engine/`** — buff pipeline core: `buff-engine` (coordinator, Phase Pipeline), `instance-store`, `resource-ledger`, `on-field-tracker`, `emit-hit-dispatcher`, `stat-table-builder`, `condition-evaluator`, `trigger-index`. See [buff-engine](buff-engine.md).
- **`damage/`** — pure formulas: `compute-damage`, `compute-healing`, `hit-formula`.
- **`timeline/`** — timeline tooling: `validate-timeline`, `migrate-timeline`, `timeline-summary`, `timeline-render-items`, `timeline-group-formatting`, `timeline-drag-preview`.
- **`loadout/`** — data resolution: `catalog`, `template`, `resolve-echo-sets`, `weapon-resolve`, `echo-stat-constants`.
- **`stage.ts`** — stage resolution (one Timeline Entry → one Stage); at `src/lib/` root.
- **`trailing-window.ts`** — inter-entry deferred-hit state machine consumed by `simulation.ts`; at `src/lib/` root.
- **`engine-bootstrap.ts`** — bridges `loadout/` and `engine/`; stays at `src/lib/` root.
- **`simulation.ts`** — top-level orchestrator; stays at `src/lib/` root.

The sidebar's clickable stage catalog (`focused-stage-catalog`) is co-located with its sole consumer in `src/components/skills/`, not under `src/lib/`.

## Related

- [buff-engine](buff-engine.md)
- [CONTEXT.md § Core simulation](../CONTEXT.md#core-simulation)
- [CONTEXT.md § The buff system](../CONTEXT.md#the-buff-system)
- [ADR-0001: buff system as unified modifier pipeline](adr/0001-buff-system-as-unified-modifier-pipeline.md)
- [ADR-0006: phase-based effect dispatch](adr/0006-phase-based-effect-dispatch.md)
