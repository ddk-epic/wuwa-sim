# Docs Log

Per-decision history. Newest first.

## 2026-05-26 — StageId with SkillCategory lineage and three-layer type model

Reworked stageId to `char.<name>.<skill-category>.<skill-name>.<stage-name>::<skill-type>.<hit-index>`. Introduced three-layer type model: `SkillGrouping` (UI only, on `Skill.type`), `SkillCategory` (player input/action, mandatory per-stage, in stageId lineage + `EngineEvent`), `SkillType` (damage calc, from `damage[0].type`, after `::`). Key correction: lineage encodes `SkillCategory` (trigger matching axis), not `SkillGrouping` (UI concern). `SkillCategory` is mandatory on every stage — no derivation fallback. `skillType` dropped from all `EngineEvent` variants; `skillCategory` carried as explicit field. `"Forte Circuit"` removed from `SkillType`. Supersedes ADR-0023, ADR-0012.

Pages touched: ADR-0024 (rewritten), CONTEXT.md (Skill Grouping, Skill Category, Skill Type, Normal Attack ambiguity).

## 2026-05-24 — Footing transitions as in-stage frame events; on-field invariant

Amended ADR-0022. The `footing` field becomes `"ground" | "air" | { launch: number } | { land: number }` — sustained values stay strings, transitions carry an in-stage commit frame (the action-frame at which the vertical-position change actually happens, modeling the point-of-no-return). The eager `setFooting` at stage resolution and the eager `snapshotOnSwapOut` at swap-variant resolution are both replaced by a single scheduled event in the Trailing Window at `stageStartFrame + at`, dispatched by on-field check (on-field → team flip; off-field → snapshot). Cancel-capable drop / non-cancel-capable pad rules extend to the footing event identically to trailing hits. New on-field invariant: when a character becomes on-field via swap-in and consumes a snapshot, the snapshot value is promoted to team footing so footing-transparent stages after re-entry don't leak stale team state. The original ADR's worked example (Verina inherits Jiyan's aerial) now holds only when `swap.actionTime ≥ launch.at`; the early-cancel case correctly inherits ground at swap-in.

Pages touched: ADR-0022 (Amendment block), CONTEXT.md (Footing, FootingTracker, Trailing Window, Movement Stage).

## 2026-05-17 — Movement as first-class Stages (Dodge, Jump)

Decided to model universal player movement actions as first-class Stages injected into every `EnrichedCharacter.skills` at enrichment time, not as Stage Variants of the prior stage. Centralized constants in `src/data/movement.ts` (Dodge=21f, Jump=18f). New `Movement` member of both `SkillCategory` and `SkillType`; `buff-engine.onEvent` bypasses the Phase Pipeline when `stage.type === "Movement"` (Action Event still logged, no `skillCast`, no resource deltas, no cooldown). `requiresStageId` combo continuity through a movement entry is opt-in via new type-locked `comboAllows: readonly ("Dodge" | "Jump")[]` on the gating stage; default omitted is opaque. `SkillCatalog` renders Dodge above Jump at the bottom of the character-stages zone. Reaction Delay does not apply.

Pages touched: ADR-0015 (new), CONTEXT.md (Movement Stage, comboAllows, Skill Type extension, Reaction Delay note).

## 2026-05-16 — Established docs/ structure

Decided on a concept-page model (one page per concept, not per file) with a light required-sections template; concept pages live alongside ADRs under `docs/`. Workflow: Claude proactively suggests doc updates at end of turn when a session produces a new concept, a correction, or a non-obvious invariant. Per-page timestamps rejected in favor of git + this log. Memory-vs-docs boundary set by the "useful to any contributor?" test.

Pages touched: index.md, conventions.md, log.md, engine-overview.md, buff-engine.md. `CLAUDE.md` updated with pointer to `docs/index.md`.
