# Docs Index

Concept pages documenting `src/`. ADRs (`adr/`) record architectural decisions.
Workflow rules: [conventions.md](conventions.md). Per-decision history: [log.md](log.md). Testing: which tests to drop — [test-pruning-guidelines.md](test-pruning-guidelines.md).

## Engine

- [engine-overview](engine-overview.md) — start here: how Timeline → Engine → Damage flows, which modules compose
- [buff-engine](buff-engine.md) — coordinator, Phase Pipeline, Instance Store lifecycle
- [buff-reference](buff-reference.md) — StatPath reference table (stat paths, keys, semantics)

## Game model

- [enriched-model](enriched-model.md) — raw extracted data vs the `Enriched*` shapes the engine runs; enrichment as a manual authoring step
- [loadout](loadout.md) — the configurable team unit: numeric-ID slots, sequences, echo build, main-stat choices, and how ids resolve to data
- [stat-table](stat-table.md) — the flat aggregated stat sheet buffs write into and the damage formula reads

## Data

- [data](data.md) — the data layer: per-domain folder triad (authored entry + `index.ts` registry + `raw/` extraction), the ID scheme, and shared vocabularies
- [CHARACTERS.md](../src/data/CHARACTERS.md) — authoring guide: the character-file shell, skills, stages, timing, and stageId lineage
- [BUFFS.md](../src/data/BUFFS.md) — authoring guide: writing `BuffDef` entries on characters, weapons, echoes, and echo sets

## Decisions

- [adr/](adr/) — architectural decisions, referenced by number (ADR-0001 onward)
