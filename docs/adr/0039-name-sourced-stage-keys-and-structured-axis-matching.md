# Stage keys derive from the API `name`; hit matching is a conjunction of structured axes

A stage's lineage id was a pure function of _display strings_: `makeCharStageId` kebab-cased the author's `newName` override (falling back to a `_` sentinel when empty) and every buff reference hand-copied the result into `trigger.stageId`, `requiresPriorStageId`, or `appliesToHits.stageId`. Two failure modes followed: typos in the copy, and renames silently changing the id so the copies dangle — the reaction just never fires. Skill- and hit-scoped matching was smuggled through the same string via `stageIdMatches`' prefix/descendant walk, which forced Camellya's Budding multiplier to enumerate Burgeoning twice (once per category) because the lineage stacks category above skill.

This ADR replaces both mechanisms:

1. **Keys, not labels.** Every stage and skill carries a key derived from the stable, read-only API `name` field: `deriveKey(name) = kebab(name with a trailing " DMG" / " Damage" stripped)`, with the two cast-stage names (`"Skill DMG"`, `"Outro DMG"`) normalized to `cast`. An explicit `key:` override exists only for within-skill collisions (today exactly one: Camellya's held `Basic Attack 4 DMG` → `basic-attack-4-hold`). `newName` stays purely display.
2. **One derivation, compiled.** A `compileCharacter` pass (memoized per character object, sibling `compileEcho` for echoes) walks the skills once and emits `stageIndex: Map<lineageId, StageInfo>` and `refIndex: Map<skillKey, Map<stageKey, lineageId>>` plus a buff-key map. Every former `makeCharStageId` call site reads these maps; the id makers are private to the pass.
3. **Structured axes, not string grammar.** `skill` (skill key) and `hitIndex` (1-based, DamageEntry order) are first-class axes on `HitContext`, `HitFilter`, and the `skillCast`/`hitLanded`/`healLanded` triggers and events. `stageId` matches by exact equality only. `matchesHit` and `matchesTrigger` are pure axis conjunctions (`matchesAxis` per axis; an array is an OR within its axis); `stageIdMatches` is deleted.

The compile pass also **lowers** the hand-written reference strings in buff data into the structured axes: an exact ref (with `::`) resolves against current ids first, then a legacy `newName`-derived map; a trailing `.<n>` becomes the `hitIndex` axis; a 4-segment category-scoped prefix becomes the `skill` axis. Unresolvable refs throw at bootstrap — a dangling reference is now a loud failure instead of a buff that never fires. Data files were not ported in this slice; the same lowering will later accept the short authoring tokens (`"clarity-of-mind/detonate"`), at which point the legacy map dies.

The lineage id keeps its ADR-0024 shape (`char.<char>.<category>.<skillKey>.<stageKey>::<type>`) but demotes to the concrete identity used for display, timeline entries, and the wire format — never the query language. The category segment is identity-only; category matching stays on the existing `skillCategory` axis.

## Key rules

- Format: `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` (leading letter required — a bare integer would be ambiguous with a hit index).
- Uniqueness scopes: stage key within its skill (across categories — Burgeoning's Basic and Heavy stages share one key space); skill key within its character among staged skills; buff key (last id segment) within its character, where sequence-gated variants sharing one id are allowed.
- Empty-name stages are raw-data placeholders: skipped by the pass, unkeyed and unreachable, exactly like stage-less skills.
- Movement (`Dodge`/`Jump`, injected into every character) and echo stages (`Tap`/`Hold`) derive the same way: `…movement.dodge.dodge::movement`, `echo.inferno-rider.tap::echo-skill`.

## Matching semantics

Events carry a clean `stageId` (no hit suffix) plus `skill` and `hitIndex` fields, populated at hit construction from `ResolvedStage`. A filter's axes are independent: `{ skill: "burgeoning", skillCategory: "Basic Attack" }` is "basic attacks of Burgeoning" — two orthogonal axes meeting, not a path. `skillCast` triggers cannot pin a hit index (the lowering throws). Lowering constraints keep the conjunction expressible: one reference array must not mix skill- and stage-granularity, and a hit-pinned ref must stand alone.

## Migration

No saved-timeline or export-code back-compat: `migrate-timeline` now validates entry ids against `stageIndex` and blanks unknown ones — stale user input is remade, not migrated. The ids that moved are exactly the old `_` casts (→ `cast`, echo `tap`, movement `dodge`/`jump`) and the handful of deliberate `newName` overrides (e.g. Encore `stage-5-wooly-strike` → `stage-5`, Verina's Starflower stages, Cartethyia's Liberation cast). The sorted id list is snapshotted in `compile-character.test.ts` as the drift tripwire.

## Considered Options

- **Faithful single-stage cast keys (`skill`, `outro`) instead of normalized `cast`.** Faithful keys make `deriveKey` rule-free, but scatter three different names over the same concept and keep reading like accidents of API naming. One normalization rule for the two cast names keeps every cast stage addressable the same way; the rule is small enough to hold in one's head.
- **Key source = `newName` (status quo source, made mandatory).** Rejected: `newName` is the author's display override and the whole point is that renaming display text must never move an id. The API `name` is read-only data.
- **Optional keys with derivation fallback.** Rejected: an optional key institutionalizes drift — half the stages keyed, half not, and a rename still moves the unkeyed ones.
- **Keep `stageIdMatches` and only resolve authoring tokens to prefix strings (the smaller variant).** Rejected: it preserves the string grammar as the query language, so the category-above-skill enumeration problem and the inconsistent hit-suffix forms (`…stage-5.1` with no `::type` vs `…ephemeral::basic-attack.1`) survive. Promoting the axes retires both.
- **Lower category-scoped prefixes to a `(category, skill)` pair constraint.** Rejected: an audit showed the skill axis alone is observationally equivalent for all shipped data (Valse is wholly Resonance Skill; Burgeoning's two categories were both enumerated), and category remains independently expressible via `skillCategory`.
- **A separate `hitIndex` field — previously rejected by ADR-0024.** Reinstated deliberately. ADR-0024 folded the hit index into the id to have _one_ match axis; that made the axis a string grammar with prefix semantics. With exact-equality ids the hit index must be its own axis, and the trade reverses: one extra field buys a matcher with no parsing at all.

## Consequences

- `deriveKey`/`toKebab` exported from `stage.ts`; `makeCharStageId`/`makeEchoStageId`/`stageIdMatches` deleted as exports (the id maker survives as a private helper of the compile pass; the legacy-form maker exists only to lower hand-written refs and dies with the data port).
- New module `compile-character.ts`: `compileCharacter`/`compileEcho` (WeakMap-memoized), `getCompiledCharacter`/`getCompiledEcho` accessors, `StageInfo`, and `findStageByEntry` (moved from `stage.ts`, now a map lookup instead of a nested scan). `import-export`'s `ALL_STAGE_IDS`, the focused-stage catalog, and timeline validation all read the compiled indexes.
- `EnrichedSkillAttribute.key?` / `EnrichedSkill.key?` / `EnrichedEchoStage.key?` — explicit overrides for collisions; the dead `EnrichedSkillAttribute.id?` slot is removed.
- `HitContext`, `HitFilter`, and the three stage-bearing trigger/event variants gain `skill` and `hitIndex`; `ResolvedStage` gains `skillKey`.
- `bootstrapSlot` consumes lowered buffs via the compile pass; ref resolution failures throw at bootstrap and the all-data compile is pinned by tests.
- Hit-scoped references in tests construct contexts with the structured axes instead of suffixed id strings.
- Supersedes ADR-0024's matching semantics (prefix walk, hit-index-in-id, "no separate hitIndex field") and its `newName`-sourced stage segment; the `::` format, the three-layer type model, and mandatory `SkillCategory` stand. ADR-0009's entry shape (one canonical id per timeline entry, loud-failure rename semantics) is unchanged. ADR-0029's `appliesToHits` HitFilter is extended with the new axes; its conjunction model is unchanged.
- Exported team codes encode stages positionally against the sorted id list, so codes minted before this change decode wrong or fail — accepted under the no-back-compat rule; wire-format hardening is a separate slice.
