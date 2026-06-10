# Enriched Model

Every game-model noun the engine runs (Character, Weapon, Echo) exists in two
shapes: a **raw** type that mirrors the extracted game data, and an
**`Enriched*`** type the engine actually consumes. Enrichment is a **build-time
authoring step**, not a runtime one. A generator scaffolds the enriched `.ts`
entry from the raw extraction, then an author hand-fills the parts the extraction
cannot know: action timing, stage identity, combo/footing rules, and real engine
`BuffDef`s. The raw shape carries stats and API-named scaffolds; the enriched
shape is the engine-facing source of truth.

For characters the generator is `scripts/generate-character.ts` (`pnpm
gen:character <name>`): it reads `raw/<name>.json` and emits the `.ts` skeleton —
shell fields, every skill, every stage, every `DamageEntry` — with timing fields
as `0` placeholders and `buffs: []` / `template` stubbed. It refuses to overwrite
an existing file, so it is a one-time bootstrap; everything after is hand-editing.
The hands-on field-by-field guide is [CHARACTERS.md](../src/data/CHARACTERS.md).

**Source files:** `src/types/character.ts`, `src/types/weapon.ts`, `src/types/echo.ts`, `src/data/characters/index.ts`, `src/data/movement.ts`

## How it works

The data layer stores both shapes side by side (see [data](data.md)): the
extracted raw object lives under `src/data/<domain>/raw/<name>.json` and conforms
to the raw type; the authored entry lives at `src/data/<domain>/<name>.ts` and is
written `satisfies` the enriched type. A `gen:*` script scaffolds that entry from
the raw object (see above), but it only emits a skeleton — timing placeholders and
stubbed buffs — so the author still does the real enrichment by hand. The
registries in each `index.ts` aggregate the enriched entries for the engine to
load.

### Raw → enriched by noun

| Noun      | Raw type    | Enriched type       | What enrichment adds                                                                                                                                                                                                                 |
| --------- | ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Character | `Character` | `EnrichedCharacter` | per-stage `actionTime`, `variants` (cancel/instantCancel/swap), `footing`, `animationLock`, stage `id`/`newName`, combo lineage (`requiresPriorStageId`); `buffs` go from name scaffolds to `BuffDef[]`; adds `forteCap`, `template` |
| Weapon    | `Weapon`    | `WeaponData`        | hand-built `buffs: WeaponBuffDef[]` derived from the passive description + `params`; drops `rarity` and the passive `description`                                                                                                    |
| Echo      | `Echo`      | `EnrichedEcho`      | skill `hits` become timed `stages` (`actionTime`, `newName`)                                                                                                                                                                         |

The common theme: the raw shape is **what the game tells us** (stats,
descriptions, API names), and enrichment supplies **what the engine needs to
schedule and resolve** — timing and hand-authored buff logic.

### Buffs are the deepest gap

The raw character carries `buffs: CharacterBuffNames` — just the verbatim API
names of Inherent Skills and Resonance Chain nodes (see the comment on
`CharacterBuffNames`). These are scaffolds. The author reads each name's
`references/` description and hand-writes the corresponding engine `BuffDef`
(see [buff-engine](buff-engine.md)). The weapon path is parallel: the raw
`WeaponPassive.description` + `params` become a `WeaponBuffDef[]`, where
`WeaponValueExpr` lets a value be a rank-indexed array of five numbers.

### Timing is the other gap

Extraction yields per-hit `actionFrame` data but not the **stage action time**
the timeline scheduler needs. Enriched stages carry a required `actionTime`,
optional `variants` (alternate action times when a stage is cancelled or swapped
out), `footing` (ground/air/launch/land), and `animationLock`. Movement is the
limiting case: `src/data/movement.ts` defines `DODGE_SKILL` and `JUMP_SKILL`
directly as `EnrichedSkill`s — there is no raw source for them — and the
character registry's `injectMovement` appends them to every character at load.
This is the one place enrichment happens at runtime rather than by hand.

### Who consumes the enriched shape

The engine bootstrap and stat-table builder load the registries
(`ALL_CHARACTERS`, etc.) and never see the raw types. See
[engine-overview](engine-overview.md).

## Gotchas

- The enriched weapon type is **`WeaponData`**, not `EnrichedWeapon` — the naming
  is asymmetric with `EnrichedCharacter`/`EnrichedEcho`.
- `EchoSet` has **no** enriched variant; it is consumed as-authored.
- Editing a `raw/*.json` file changes nothing the engine sees — the enriched
  `.ts` is the source of truth. Re-running extraction overwrites raw but never
  the authored entry.
- `SkillType` (damage-calc axis) and `SkillCategory` (trigger axis) are
  orthogonal and both survive into the enriched stage; don't conflate them
  (see ADR-0024).

## Related

- [CHARACTERS.md](../src/data/CHARACTERS.md) — hands-on guide to authoring a character file (shell, skills, stages, timing)
- [data](data.md) — where raw and authored entries live, and the extraction step
- [buff-engine](buff-engine.md) — how authored `BuffDef`s are run
- [buff-reference](buff-reference.md) — StatPath reference the buffs target
- [engine-overview](engine-overview.md) — the engine that consumes the enriched registries
