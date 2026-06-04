# Docs Log

Per-decision history. Newest first.

## 2026-06-04 — Populated the empty Game model and Data index sections

Captured the concepts behind the two empty `index.md` sections rather than mechanically mirroring folders. Agreed boundary: Game model = `src/types/` domain shapes, Data = `src/data/` authoring/storage; buff/timeline/log types stay engine-owned. Centerpiece is `enriched-model.md` — the non-obvious raw→`Enriched*` bridge, which is a **manual authoring step** (author hand-writes the enriched `.ts` from `raw/*.json` + `references/`), not a runtime transform; the lone runtime exception is `injectMovement`. Added `loadout.md` (numeric-ID-decoupled team unit, resolved via `catalog.ts`), `stat-table.md` (flat aggregated stat sheet, 5%/150% crit floor in the builder, links to BUFFS for StatPath), and `data.md` (folder triad: authored entry + `index.ts` registry + `raw/` extraction). Linked the orphaned `test-pruning-guidelines.md` from the intro line (workflow doc, not a concept section).

Pages touched: enriched-model.md (new), loadout.md (new), stat-table.md (new), data.md (new), index.md.

## 2026-06-04 — Concerto consumption model

Designed how concerto is spent and observed. Concerto stays uncapped (parallel to energy) so wasted overcap is visible; no cap is registered. Outro Skills drain all concerto to 0 via an engine-internal branch in the `skillCast` handler (sibling to the energy-on-Liberation block): `console.warn` when concerto < `OUTRO_CONCERTO_COST` (=100), still firing, then `setResource(concerto, 0)` — surplus above 100 is wasted by design. The "Outro needs ≥ 100" rule is warn-only, not a static row error, because `validate-timeline.ts` is resource-agnostic (a post-sim pass could upgrade it later). Character kits spend partial concerto via the existing data-authored `resource` `op: "sub"` effect gated by `resourceAtLeast` — distinct path from Outro, unified only at the ledger. Readers key on a new `resourceConsumed` trigger (fires on any net decrease), not `resourceCrossed`, which is threshold-keyed and can't express "any spend." Added a low-side `Math.max(0, …)` floor to `ResourceLedger.applyDelta`. Unblocks the deferred Red Spring concerto-consumed passive. Considered and rejected: a hard 100 cap (hides overcap), per-character Outro drain authoring (rule is universal), and reusing `resourceCrossed down` for readers (misses partial spends).

Pages touched: ADR-0031 (new). Implementation pending (handed to /to-issues).

## 2026-05-31 — Footing snapshot removed; footing is pure team state

Architecture review of the simulation loop found the per-character footing snapshot (`FootingTracker.snapshots_`) is dead weight: its only producer (`snapshotTrailing` at re-entry) and consumer (`promoteOnSwapIn`) fire in the **same loop iteration**, so the per-character dict never spans a tick. The off-field divergence it was meant to hold is already carried, per-character, by the Trailing Window's `pendingFooting` — which the same ADR-0022 introduced. The "Team-global only" option ADR-0022 rejected was rejected on a premise (commit fires off-field, `air` lost without a snapshot) that the as-built engine never exercises: commits land at the owner's re-entry, when the owner is on-field, so `setTeam(exitFooting)` applies directly. Decision: drop the snapshot; `FootingTracker` keeps only the single team-footing value; the Trailing Window calls `footing.commit()` at re-entry. One-way dependency Trailing Window → Footing, no cycle. Off-field-commit generality is cut until a real consumer (off-field-damage projection) needs it. The wider review also flagged the per-entry frame-cursor split and the scattered Padding Delay assembly as lesser, separable cleanups — not pursued here.

Pages touched: ADR-0022 (amendment), CONTEXT.md (FootingTracker, FootingModule, Trailing Window). Implementation pending.

## 2026-05-30 — Auto-run simulation on timeline change; keep-and-mark-stale

Added an opt-in auto-run mode: after an invalidating change the simulation re-runs on a 300ms trailing debounce, removing the need to press Simulate. Two trigger paths — the timeline _edit-stream_ (reuses the existing `onShapeChange` hook, debounced; the realistic burst is rapid skill-adds) and a _commit_ path for team/loadout/settings (fires on modal close, dirty-checked against an on-open snapshot). Opening any modal cancels the pending debounce; closing reconciles staleness (`if autoRun && stale → run now`), which both resumes the cancelled edit-stream run and handles the modal's own edits. `onShapeChange` no longer calls `clearLog` — there is no longer an argument for clearing: an invalidating change now sets a `stale` flag and _keeps_ the previous log, rendered muted-grey with the timeline header swapped from `· {n} actions` to `· outdated`, until a run lands. The only React state is `stale` (for paint); the debounce timer and latest-input snapshots are refs, so the run reads fresh inputs with no stale closure and no revision counter. The Simulate button is always present (Q4-A): in auto mode enabled only when stale (= "run now / retry after a caught error"), in manual mode unchanged. Auto-run is wrapped in try/catch — a throw keeps the prior log rather than blanking it. Staleness survives reload via a persisted input _signature_ (hash of entries+slots+loadouts+settings) stored beside the log; on mount, auto mode runs once if entries exist, and an emptied timeline drops straight to the clean empty state. The `autoRun` flag (default on) lives in a new `useUiPreferences` store, not `Settings`.

Pages touched: ADR-0027 (new). Implementation pending.

## 2026-05-30 — StatTable stays nested; 1D flatten deferred

Considered flattening `StatTable` from its current heterogeneous shape (scalar `number` fields + five nested `Record<Element|SkillType, number>` groups) into a uniform `Record<StatKey, number>` with template-literal composite keys. Rejected for now: the flatten does not eliminate special-casing, it relocates it — nested keeps reads clean (`snap.elementBonus[el]`) at the cost of branchy writes/clone; 1D cleans writes/clone/serialization at the cost of construction loops and key-construction at every read. The one capability the flatten uniquely unlocks (`scaledByStat` over a nested key) has zero current usage. A spelled-out flat enum was also rejected: not indexable by a runtime `Element`/`SkillType` without a cast or lookup map. Cheap interim win kept instead: extract the curated scalar union from `StatPath` into `ScalarStatKey` and reuse it in `StatPath`, `ValueExpr.scaledByStat.stat`, and `getCharStat`, removing the `buff-engine.ts` double-cast.

Pages touched: ADR-0026 (new), index.md (Decisions pointer).

## 2026-05-30 — Global buffs as single shared instances

Replaced the per-target `team` target kind (which fanned a buff out to N per-member instances) with `target: { kind: "global" }` — one shared Buff Instance every character reads. Soundness rests on a data restriction enforced by `validateBuffDef`: global effect values must be target-independent (`const`, or `scaledByStat` pinned to an explicit `characterId`) and conditions may reference only the source (`on:"source"`); reader-referencing conditions are validate-rejected. Storage is a tagged subset of `InstanceStore.active` (`global: true` + `GLOBAL` sentinel target), not a standalone store — expiry, consume, stacking, swap-out all work unchanged. Reverses the prior "engine owns no globals" invariant. The 6 Stellarealm/Butterfly defs fold into `shorekeeper.ts`; `global-buffs.ts`, the bootstrap loop, and the `owner` field are deleted. Ownerless level buffs (permanent global instances seeded at bootstrap) are envisioned but not built.

Pages touched: ADR-0025 (new), CONTEXT.md (Global Buff Store, global target kind).

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
