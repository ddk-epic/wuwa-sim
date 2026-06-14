# Docs Index

Concept pages documenting `src/`. ADRs (`adr/`) record architectural decisions.
Workflow rules: [conventions.md](conventions.md). Per-decision history: [log.md](log.md). Testing: which tests to drop — [test-pruning-guidelines.md](test-pruning-guidelines.md).

## Engine

- [engine-overview](engine-overview.md) — start here: how Timeline → Engine → Damage flows, which modules compose
- [sim-flow](sim-flow.html) — interactive subway map of the simulation flow: how an authored Timeline Entry is processed, station by station, with state stores and click-for read/write arrows. Open in a browser; regenerate with `pnpm gen:sim-flow`. Content is hand-authored in `scripts/generate-sim-flow.ts` — update it when an ADR reshapes the pipeline
- [buff-engine](buff-engine.md) — coordinator, Phase Pipeline, Instance Store lifecycle
- [buff-reference](buff-reference.md) — StatPath reference table (stat paths, keys, semantics)
- [row-messages](row-messages.md) — the timeline message catalog and the wording rules every diagnostic/validator message follows

## Game model

- [enriched-model](enriched-model.md) — raw extracted data vs the `Enriched*` shapes the engine runs; enrichment as a manual authoring step
- [loadout](loadout.md) — the configurable team unit: numeric-ID slots, sequences, echo build, main-stat choices, and how ids resolve to data
- [stat-table](stat-table.md) — the flat aggregated stat sheet buffs write into and the damage formula reads

## Data

- [data](data.md) — the data layer: per-domain folder triad (authored entry + `index.ts` registry + `raw/` extraction), the ID scheme, and shared vocabularies
- [CHARACTERS.md](../src/data/CHARACTERS.md) — authoring guide: the character-file shell, skills, stages, timing, and stageId lineage
- [BUFFS.md](../src/data/BUFFS.md) — authoring guide: writing `BuffDef` entries on characters, weapons, echoes, and echo sets

## Dev tools

- [dev/frames](dev/frames.md) — the `/dev/frames` Frame Tool: deriving stage `actionTime`/`actionFrame` empirically from gameplay by marking action-string clips and solving across them

## Decisions

- [adr/](adr/) — architectural decisions, referenced by number (ADR-0001 onward)
