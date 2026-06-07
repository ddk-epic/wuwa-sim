# `SkillType` as the engine taxonomy; `replacesSkillType` removed

The engine recognizes one closed taxonomy of skill types — `SkillType` — used everywhere a trigger, event, or stat-table key references "what kind of skill produced this":

```
SkillType = "Basic Attack" | "Heavy Attack" | "Resonance Skill" | "Resonance Liberation"
          | "Forte Circuit" | "Intro Skill" | "Outro Skill" | "Echo Skill"
```

`SkillType` types `DamageEntry.type`, `Trigger.skillType` (on both `skillCast` and `hitLanded` branches), `EngineEvent.skillType` (both branches), and the keys of `Stat Table` `amps` / `skillTypeBonus` / `shreds`.

`Skill.type` is **not** a `SkillType`. It carries a UI grouping label that includes the parent term `"Normal Attack"` (covering both `"Basic Attack"` and `"Heavy Attack"`) and is used only for the skill sidebar grouping. It stays an untyped `string` because it never reaches the engine — every `skillCast` and `hitLanded` event reports a `SkillType`, never a UI label.

## `replacesSkillType` removed

The previously-introduced `EnrichedSkillAttribute.replacesSkillType?: string` (ADR pre-existing in #87) is removed. Its job was to override what the `skillCast` event reports for stages whose effective type differs from the parent skill's category — e.g. Encore's Cosmos Rave Liberation contains stages that play as Basic Attack hits and one that plays as a Resonance Skill hit.

In every authored use, `replacesSkillType` is redundant with `damage[0].type`. The Resolved Stage's `skillType` therefore derives as:

```
effectiveSkillType = stage.damage[0]?.type ?? skill.type
```

The opener stage of Cosmos Rave (no damage entries) falls through to `skill.type === "Resonance Liberation"`, which is a valid `SkillType`. Stages whose `Skill.type === "Normal Attack"` (a non-`SkillType` UI label) always have damage entries, so the fallback is never exercised for those — coercion is safe by construction.

## Considered Options

- **Two unions, `SkillType` (engine) and `SkillCategory` (UI grouping including `"Normal Attack"`).** Rejected: `SkillCategory` is only used in one display path; typing it adds friction (every UI label literal must be in the union) without buying invariants. Untyped `Skill.type` is sufficient.
- **Keep `replacesSkillType` and tighten its type to `SkillType`.** Rejected: it carries no information not already in `damage[0].type`. Two derivation rules (`skillType` and `attackType` in `ResolvedStage`) collapse into one.
- **Per-buff `skillType?: string` (loose).** Rejected: the silent-no-fire bug (e.g. `skillType: "Basic"` typo) is exactly what `SkillType` prevents.

## Consequences

- A buff author who writes `Trigger.skillType: "Normal Attack"` gets a TypeScript error. Today this typo silently never fires (since `"Normal Attack"` never appears on an engine event).
- `Skill.actsAs`, per-skill flags, or any other category-level override is unnecessary. Heterogeneity within a skill (Cosmos Rave's mix of Basic Attack / Resonance Skill / Resonance Liberation stages) is expressed at the damage entry, which is where it already lives.
- `STAGE_TYPE_LABELS` becomes a `Record<SkillType, string>` keyed by the closed union plus an explicit `"Normal Attack"` entry for UI display.
- `ResolvedStage.skillType` and `ResolvedStage.attackType` collapse to a single field (`skillType: SkillType`).
- Character data files (`src/data/characters/*.ts`) lose all `replacesSkillType:` lines; TypeScript surfaces every typo'd `damage[].type` value during the migration.
