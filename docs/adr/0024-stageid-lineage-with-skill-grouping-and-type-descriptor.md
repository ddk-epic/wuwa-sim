# StageId with SkillCategory lineage and `::` type descriptor

Stage IDs are a two-part format separated by `::`:

```
char.<name>.<skill-category>.<skill-name>.<stage-name>::<skill-type>.<hit-index>
echo.<echo-name>.<stage-name>::echo-skill.<hit-index>
```

The left side of `::` is the **lineage** — where the stage comes from and what player action triggered it, using `SkillCategory`. The right side is the **hit descriptor** — the damage type (`SkillType`, derived from `damage[0].type`) and the hit index. `skillCast` events use the stageId without a hit index: `lineage::skill-type`. The stageId is the canonical Timeline Entry reference (ADR-0009) and the single source of truth for a hit's identity: there is no separate `hitIndex` field on events or triggers, and no bare stage name anywhere in the trigger vocabulary.

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

## Matching semantics

`hitLanded` / `healLanded` triggers match by lineage **prefix** (`stageIdMatches` in `instance-store.ts`): a trigger id without a trailing `.<n>` matches every hit of that stage lineage; including the `.<n>` suffix pins a specific hit. `skillCast` triggers match by **exact equality**. The asymmetry is intentional: hit events carry a `.<n>` hit-index suffix that cast events don't.

Synthetic hits (from `emitHit` / `coordHit`) carry no `stageId`, so a trigger that filters on `stageId` is implicitly restricted to authored hits.

## Three-layer type model

Three typed unions:

- **`SkillGrouping`** — the UI skill-tree section a skill belongs to. Includes `"Normal Attack"` and `"Forte Circuit"` (pure display groupings). Used on `Skill.type` (populated from game API) and for sidebar filtering. Has no engine presence — not in stageIds, not in events, not in triggers.
- **`SkillCategory`** — the player input/action that triggered the stage. A mandatory field on every stage in character data. Encoded in the stageId lineage. Carried as an explicit field on `EngineEvent`. Used for trigger matching.
- **`SkillType`** — the damage-calc type derived from `damage[0].type` (falling back to the skill's category for stages with no damage entries). Encoded after `::` in the stageId. Used for `skillTypeBonus`, `skillTypeAmp`, `shreds` lookups in the damage formula.

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

1. **Lineage must serve trigger matching, not UI display.** Triggers match on player actions ("when casting Heavy Attack"), which is `SkillCategory`. Earlier encodings put `SkillType` or `SkillGrouping` in the lineage (see Considered Options); both are wrong axes for matching.

2. **`skillType` dropped from all `EngineEvent` variants.** With the type encoded after `::` in the stageId, a separate field is redundant. The engine carries `skillCategory` as an explicit field instead — the primary axis for trigger matching.

3. **Bug fix: `hitLanded` event type mismatch.** Events previously carried `resolved.skillType` (stage-level collapsed type) while damage calc used `hit.type` (per-hit type). With `skillCategory` as the event field and `skillType` in the `::` segment, this inconsistency is eliminated.

4. **`::` makes parsing unambiguous.** The lineage (dot-separated) and hit descriptor (type + index) are cleanly separable with a single `split("::")`. Prefix matching on lineage (`startsWith`) works without accidentally matching the type segment.

## Considered Options

The format reached its current shape through three shipped predecessors, each superseded for a structural reason:

- **Bare stage names on `hitLanded` (`stage: "Tap"` + `hitIndex: 3`) — the original trigger vocabulary.** Superseded: stage names are not unique across skills. Inferno Rider's "after 3rd Tap hit" buff was authored `stage: "Tap"`; Impermanence Heron also has a stage named "Tap", so the filter could false-trigger on hits the author never intended, and any wielder equipping two echoes with same-named stages reproduces the collision. Replaced by namespaced ids matching `skillCast`'s existing convention.
- **Flat `"<SkillName>::<StageName>"` ids.** The first namespaced encoding (ADR-0009's original synthesis). Superseded: it carries no lineage, so a trigger like Stellar Symphony's "when casting Resonance Skill that heals" cannot distinguish a heal originating from a Resonance Skill from any other heal — the parent skill's category isn't in the id and `skillType` on events was sourced from the per-damage-entry `type` (a damage-calc concern), which diverges from the player action.
- **Dot-only hierarchical ids (`char.<name>.<skill-type>.<skill-name>.<stage-name>.<hit-index>`).** The second encoding — lineage added, but typed with `SkillType` and with no `::` delimiter. Superseded twice over: `SkillType` is the wrong lineage axis (triggers match player actions, i.e. `SkillCategory`), and parsing the type from a fixed positional index is fragile — echo stageIds have a different segment count. The `::` delimiter removes the positional ambiguity.
- **Encode `SkillGrouping` in lineage.** Rejected: `SkillGrouping` is a UI concern. StageIds exist for trigger matching, which needs the player action (`SkillCategory`), not the sidebar section. This was the fundamental mistake that prompted the final rewrite.
- **A single `SkillType` taxonomy for everything, `Skill.type` left untyped.** The pre-lineage type model (one closed union typing `DamageEntry.type`, trigger filters, and stat-table keys, with the UI grouping label left a bare `string`). Superseded by the three-layer model: one union conflates three different questions — which sidebar section (UI), which player action (trigger matching), which damage classification (formula) — and the moment lineage needed the player action as its own axis, the conflation broke. Its companion decision survives in derived form: the per-stage `replacesSkillType` override was removed as redundant with `damage[0].type`, which is exactly how `SkillType` is still derived today.
- **A separate `hitIndex` field alongside the stageId.** Superseded: the hit index is encoded positionally in the id. Removing the field eliminates a redundant axis — one `stageId` match replaces `stageId` + `hitIndex`.
- **Add a `parentSkillType` field to hit/heal events.** Rejected: introduces a second "skill type" concept on every event, with the existing `skillType` (from `hit.type`) still present for damage calc. Two fields answering "what kind of skill is this?" with different answers is a footgun.
- **Derive `SkillCategory` from `damage[0].type` with an optional override.** Rejected: silent fallback hides bugs. Stages where category and damage type diverge (Encore Cloudy Frenzy, Sanhua Dodge Counter, Camellya Ephemeral) would get wrong stageIds without any compile-time error.
- **Drop `::skill-type` segment since triggers use `skillCategory`.** Rejected for structural completeness: the damage type in the ID is useful for debugging and readability. If `skillType` on triggers is eventually removed, the type remains recoverable from the stageId.
- **Omit `::skill-type` from `skillCast` stageIds.** Rejected: uniform format across cast and hit events keeps parsing simple.

## Consequences

- **Three typed unions**: `SkillGrouping` (UI), `SkillCategory` (engine/trigger), `SkillType` (damage calc).
- **`SkillGrouping`** becomes a typed union on `Skill.type`. Purely UI — no engine presence. (A typed union prevents typos in API-generated data; the earlier single-taxonomy model had deliberately left it untyped.)
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
- Supersedes the encoding (not the structural decisions) of ADR-0009: a Timeline Entry still references its Stage by one canonical id with loud-failure rename semantics; only the id format and matching rules are defined here.
