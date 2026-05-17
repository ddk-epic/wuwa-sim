# Docs Log

Per-decision history. Newest first.

## 2026-05-17 — Movement as first-class Stages (Dodge, Jump)

Decided to model universal player movement actions as first-class Stages injected into every `EnrichedCharacter.skills` at enrichment time, not as Stage Variants of the prior stage. Centralized constants in `src/data/movement.ts` (Dodge=21f, Jump=18f). New `Movement` member of both `SkillCategory` and `SkillType`; `buff-engine.onEvent` bypasses the Phase Pipeline when `stage.type === "Movement"` (Action Event still logged, no `skillCast`, no resource deltas, no cooldown). `requiresStageId` combo continuity through a movement entry is opt-in via new type-locked `comboAllows: readonly ("Dodge" | "Jump")[]` on the gating stage; default omitted is opaque. `SkillCatalog` renders Dodge above Jump at the bottom of the character-stages zone. Reaction Delay does not apply.

Pages touched: ADR-0015 (new), CONTEXT.md (Movement Stage, comboAllows, Skill Type extension, Reaction Delay note).

## 2026-05-16 — Established docs/ structure

Decided on a concept-page model (one page per concept, not per file) with a light required-sections template; concept pages live alongside ADRs under `docs/`. Workflow: Claude proactively suggests doc updates at end of turn when a session produces a new concept, a correction, or a non-obvious invariant. Per-page timestamps rejected in favor of git + this log. Memory-vs-docs boundary set by the "useful to any contributor?" test.

Pages touched: index.md, conventions.md, log.md, engine-overview.md, buff-engine.md. `CLAUDE.md` updated with pointer to `docs/index.md`.
