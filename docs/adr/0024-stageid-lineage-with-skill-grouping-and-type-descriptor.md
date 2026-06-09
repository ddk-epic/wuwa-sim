# StageId with SkillCategory lineage and `::` type descriptor

Supersedes ADR-0023.

Stage IDs are reworked from `char.<name>.<skill-type>.<skill-name>.<stage-name>.<hit-index>` to a two-part format separated by `::`:

```
char.<name>.<skill-category>.<skill-name>.<stage-name>::<skill-type>.<hit-index>
echo.<echo-name>.<stage-name>::echo-skill.<hit-index>
```

The left side of `::` is the **lineage** — where the stage comes from and what player action triggered it, using `SkillCategory`. The right side is the **hit descriptor** — the damage type (`SkillType`, derived from `damage[0].type`) and the hit index. `skillCast` events use the stageId without a hit index: `lineage::skill-type`.

Examples:

```
skillCast:   char.sanhua.basic-attack.frigid-light.stage-5::basic-attack
hitLanded:   char.sanhua.basic-attack.frigid-light.stage-5::basic-attack.1
skillCast:   char.sanhua.heavy-attack.frigid-light.heavy-attack::heavy-attack
hitLanded:   char.sanhua.heavy-attack.frigid-light.heavy-attack::heavy-attack.1
skillCast:   char.encore.heavy-attack.black-white-woolies.cloudy-frenzy::resonance-liberation
hitLanded:   char.encore.heavy-attack.black-white-woolies.cloudy-frenzy::resonance-liberation.1
skillCast:   char.encore.resonance-liberation.cosmos-rave.cosmos-rave::resonance-liberation
hitLanded:   echo.inferno-rider._::echo-skill.3
```

## Three-layer type model

Three typed unions replace the old `SkillCategory`:

- **`SkillGrouping`** — the UI skill-tree section a skill belongs to. Includes `"Normal Attack"` and `"Forte Circuit"` (pure display groupings). Used on `Skill.type` (populated from game API) and for sidebar filtering. Has no engine presence — not in stageIds, not in events, not in triggers.
- **`SkillCategory`** — the player input/action that triggered the stage. A mandatory field on every stage in character data. Encoded in the stageId lineage. Carried as an explicit field on `EngineEvent`. Used for trigger matching.
- **`SkillType`** — the damage-calc type derived from `damage[0].type`. Encoded after `::` in the stageId. Used for `skillTypeBonus`, `skillTypeAmp`, `shreds` lookups in the damage formula.

```typescript
type SkillGrouping =
  | "Normal Attack" // UI grouping: contains Basic Attack + Heavy Attack stages
  | "Forte Circuit" // UI grouping: contains stages of varying categories
  | "Inherent Skill" // UI grouping: stages always Basic Attack
  | "Resonance Skill" // 1:1 with SkillCategory
  | "Resonance Liberation"
  | "Intro Skill"
  | "Outro Skill"
  | "Tune Break"
  | "Echo Skill"
  | "Movement"

type SkillCategory =
  | "Basic Attack" // tap attack input
  | "Heavy Attack" // hold attack input
  | "Resonance Skill"
  | "Resonance Liberation"
  | "Intro Skill"
  | "Outro Skill"
  | "Tune Break"
  | "Echo Skill"
  | "Movement"

type SkillType =
  | "Basic Attack"
  | "Heavy Attack"
  | "Resonance Skill"
  | "Resonance Liberation"
  | "Intro Skill"
  | "Outro Skill"
  | "Tune Break"
  | "Echo Skill"
  | "Movement"
```

`"Forte Circuit"`, `"Normal Attack"`, and `"Inherent Skill"` are `SkillGrouping` only — they are NOT `SkillCategory` or `SkillType` values.

`SkillCategory` and `SkillType` have the same members but are distinct concepts: category is the player action, type is the damage classification. They usually align but can diverge (e.g. Encore's Cloudy Frenzy: category `"Heavy Attack"`, type `"Resonance Liberation"`; Sanhua's Dodge Counter: category `"Basic Attack"`, type `"Heavy Attack"`).

## Why SkillCategory is mandatory

The game API does not expose the action category per stage. It provides:

- Skill-level: `Skill.type` (the grouping, e.g. `"Normal Attack"`)
- Hit-level: `damage[].type` (the damage type, e.g. `"Heavy Attack"`)
- No stage-level action category

A derivation fallback (`damage[0].type`) would silently produce wrong categories for stages where category and damage type diverge. Making `category` a required field on every stage means TypeScript catches missing tags at compile time. The reference data for all implemented characters is in `references/characters/categories.md`.

## Motivating cases

1. **Lineage must serve trigger matching, not UI display.** ADR-0023 encoded `SkillType` as lineage; the first revision encoded `SkillGrouping`. Both are wrong — triggers match on player actions ("when casting Heavy Attack"), which is `SkillCategory`. `SkillGrouping` is a UI concern that never reaches the engine.

2. **`skillType` dropped from all `EngineEvent` variants.** With the type encoded after `::` in the stageId, a separate field is redundant. The engine carries `skillCategory` as an explicit field instead — the primary axis for trigger matching.

3. **Bug fix: `hitLanded` event type mismatch.** Events previously carried `resolved.skillType` (stage-level collapsed type) while damage calc used `hit.type` (per-hit type). With `skillCategory` as the event field and `skillType` in the `::` segment, this inconsistency is eliminated.

4. **`::` makes parsing unambiguous.** The lineage (dot-separated) and hit descriptor (type + index) are cleanly separable with a single `split("::")`. Prefix matching on lineage (`startsWith`) works without accidentally matching the type segment.

## Considered Options

- **Encode `SkillGrouping` in lineage (first revision).** Rejected: `SkillGrouping` is a UI concern. StageIds exist for trigger matching, which needs the player action (`SkillCategory`), not the sidebar section. This was the fundamental mistake that prompted the rewrite.
- **Derive `SkillCategory` from `damage[0].type` with an optional override.** Rejected: silent fallback hides bugs. Stages where category and damage type diverge (Encore Cloudy Frenzy, Sanhua Dodge Counter, Camellya Ephemeral) would get wrong stageIds without any compile-time error.
- **Keep dot-only separators (ADR-0023 style).** Rejected: parsing the type from a fixed positional index is fragile — echo stageIds have a different segment count. The `::` delimiter removes positional ambiguity.
- **Drop `::skill-type` segment since triggers use `skillCategory`.** Rejected for structural completeness: the damage type in the ID is useful for debugging and readability. If `skillType` on triggers is eventually removed, the type remains recoverable from the stageId.
- **Omit `::skill-type` from `skillCast` stageIds.** Rejected: uniform format across cast and hit events keeps parsing simple.

## Consequences

- **Three typed unions** introduced: `SkillGrouping` (UI), `SkillCategory` (engine/trigger), `SkillType` (damage calc). Supersedes ADR-0012's single `SkillType` taxonomy.
- **`SkillGrouping`** becomes a typed union on `Skill.type`. Purely UI — no engine presence. Reverses ADR-0012's decision to leave `Skill.type` untyped (typed union prevents typos in API-generated data).
- **`SkillCategory`** is a mandatory field on every stage in character data. The reference data is in `references/characters/categories.md`.
- **`ResolvedStage`** carries all three: `skillGrouping: SkillGrouping`, `skillCategory: SkillCategory`, `skillType: SkillType`.
- **`EngineEvent`** carries `skillCategory: SkillCategory` as an explicit field. `skillType` is removed from all event variants.
- **`Trigger`** gains `skillCategory?: SkillCategory | SkillCategory[]` filter. `skillType` filter is retained during transition but deprecated — to be ported to `skillCategory` and removed.
- **`categoryToSkillType()`** is deleted.
- **`skillType` stays on `SimulationLogBase`** for UI display. `HitEvent.skillType` sourced from `hit.type`.
- **Type pills render different axes by panel.** The **skill sidebar** (authoring intent) shows `SkillCategory` — how the stage is triggered. The post-run **buff-timeline** strips also show `SkillCategory` (the strip pill and the action-lane block height; #345/#346), with the damage type retained on the sidebar detail line. The post-run **log table**, by contrast, shows the damage type (`damage[0].type`, falling back to the stage's collapsed `skillType` when a stage has no hits) — what the stage counts as for damage scaling. A stage can therefore read as e.g. `SKILL` in the timeline and `BASIC` in the table; this is intended, not a bug.
- **`makeCharStageId`** accepts `SkillCategory` for lineage and `SkillType` for the `::` segment. `makeEchoStageId` appends `::echo-skill`.
- **`FILTER_KEY_TO_TYPES`** in `SkillCatalog.tsx` switches to `SkillGrouping` for sidebar filtering.
- All hardcoded stageId strings updated in a single big-bang migration.
- Supersedes ADR-0023. Supersedes ADR-0012.
