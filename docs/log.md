# Docs Log

Per-decision history. Newest first.

## 2026-05-16 — Established docs/ structure

Decided on a concept-page model (one page per concept, not per file) with a light required-sections template; concept pages live alongside ADRs under `docs/`. Workflow: Claude proactively suggests doc updates at end of turn when a session produces a new concept, a correction, or a non-obvious invariant. Per-page timestamps rejected in favor of git + this log. Memory-vs-docs boundary set by the "useful to any contributor?" test.

Pages touched: index.md, conventions.md, log.md, engine-overview.md, buff-engine.md. `CLAUDE.md` updated with pointer to `docs/index.md`.
