# Character Authoring Guide

How to write a character file: the `EnrichedCharacter` shell, its `skills`, and the `stages` that carry timing and damage. Start with **Anatomy** for the mental model, jump to the **Cookbook** for a stage shape close to what you're authoring, drop into **Reference** to look up a specific field.

The authoritative type is `src/types/character.ts`. This doc explains the semantics the type can't, from the author's seat.

A character file is the **enriched** half of a two-shape model. You don't write it from scratch: a generator scaffolds it from extracted data, and you fill in the parts extraction can't know. This guide is the hands-on counterpart to the concept page — see [enriched-model](../../docs/enriched-model.md) for _why_ two shapes exist.

The `buffs:` array is **not** covered here — it has its own guide, [BUFFS.md](BUFFS.md). This doc owns everything else, plus the one seam where the two meet: the **stageId** a buff trigger references (see [Reference → stageId lineage](#stageid-lineage)).

## How a character file is created

Three steps. You only hand-edit the output of the third.

1. **Extract** — `pnpm extract` (`scripts/extract.ts`) pulls the character from the game API into `src/data/characters/raw/<name>.json`, conforming to the raw `Character` type.
2. **Generate** — `pnpm gen:character <name>` (`scripts/generate-character.ts`) reads that raw JSON and writes the `src/data/characters/<name>.ts` **scaffold**. It refuses to overwrite an existing file, so it's a one-time bootstrap. From raw it populates the shell (`id`/`name`/`element`/`weaponType`/`rarity`/`stats`/`skillTreeBonuses`), every skill, every stage, and every `DamageEntry`. It also makes a few decisions for you: `newName` is derived by `deriveNewName` (`"Skill DMG"` → `""`, a trailing `" DMG"`/`" Damage"` stripped); Inherent Skills and Dodge Counter stages get `hidden: true`; Outro skills get a synthetic zero-damage Outro stage; a Liberation with no cast stage gets one synthesized with `animationFrames: 60`.
3. **Enrich** — you hand-fill what the API can't provide. The scaffold deliberately emits placeholders:
   - **`actionTime: 0`** on every stage and **`actionFrame: 0`** on every `DamageEntry` — the timing is yours to author (see [timing model](#stage-timing-model)). This is the bulk of the work.
   - **`variants: {}`** — add cancel/swap/footing timing as needed.
   - **`template`** — emitted as empty strings; fill with the recommended build.
   - **`buffs: []`** — write the engine `BuffDef`s by hand ([BUFFS.md](BUFFS.md)).

So when you open a freshly generated file, the structure and all raw-derived numbers are already there; your job is the timing placeholders, `template`, and `buffs`. The examples below show enriched (finished) stages — the `actionTime`/`actionFrame` values are what you'd fill in over the scaffold's zeros.

---

## Anatomy of a character file

A character file is three nested tiers: the **character shell**, its **skills**, and each skill's **stages**. A stage's per-hit numbers live in its **`damage` entries**. Here's Sanhua trimmed to one skill and one stage, every field labeled:

```ts
import type { EnrichedCharacter } from "#/types/character"

export const sanhua = {
  // ── CHARACTER SHELL ──────────────────────────────────────────
  id: 1102, // API character id. Used by triggers (characterId), loadout slots.
  name: "Sanhua", // Kebabed into the stageId lineage (→ "sanhua").
  element: "Glacio", // The character's element; every stage inherits it.
  weaponType: "Sword",
  rarity: "SR",
  template: {
    // Recommended build, used to seed a fresh loadout.
    weapon: "Emerald of Genesis",
    echo: "Impermanence Heron",
    echoSet: "Moonlit Clouds",
  },
  stats: {
    // base = level-1 sheet, max = level-90 sheet.
    base: { hp: 805, atk: 22, def: 77 },
    max: { hp: 10062.5, atk: 275, def: 941.1094 },
  },
  skillTreeBonuses: ["Glacio DMG Bonus", "ATK"], // Compiled into permanent stat buffs at bootstrap.
  recommendedSkillDmgPriority: "Resonance Liberation", // UI hint only.

  buffs: [
    /* … BuffDef[] — see BUFFS.md … */
  ],

  // ── SKILLS ───────────────────────────────────────────────────
  skills: [
    {
      id: 1000502, // API skill id.
      name: "Eternal Frost", // Kebabed into the stageId (→ "eternal-frost").
      type: "Resonance Skill", // SkillGrouping — the UI sidebar section (NOT a trigger axis).
      cooldown: 10, // Skill-level cooldown, seconds.
      concerto: 15, // Concerto granted by the skill's CAST stage.
      // resonanceCost, duration, hidden — see Reference.
      stages: [
        {
          // ── STAGE ───────────────────────────────────────────
          name: "Skill DMG", // "Skill DMG" marks the CAST stage (see Reference).
          category: "Resonance Skill", // SkillCategory — the trigger axis (what action fired this).
          newName: "", // Display label only; the stage key comes from `name` ("Skill DMG" → "cast").
          value: "359.85%", // Human-readable scaling string, UI only.
          actionTime: 64, // Frames this stage advances the timeline.
          variants: {
            // Alternate actionTimes when cancelled / swapped.
            cancel: { actionTime: 20 },
          },
          damage: [
            {
              // ── DAMAGE ENTRY (one hit) ──────────────────────
              type: "Resonance Skill", // SkillType — the damage-calc axis.
              dmgType: "Damage",
              scalingStat: "ATK",
              actionFrame: 20, // Frame WITHIN the stage when this hit lands.
              value: 3.5985, // Multiplier (motion value).
              energy: 10,
              concerto: 0,
              toughness: 1,
              weakness: 0.8,
            },
          ],
        },
      ],
      damage: [], // Enrichment leftover bucket — empty = all hits assigned (see Reference).
    },
  ],
} satisfies EnrichedCharacter
```

The three same-looking strings — skill `type`, stage `category`, damage `type` — are **three different axes**. Internalize that distinction before anything else; it's in the Reference and it's the most common authoring mistake.

---

## Cookbook

Each recipe is a **stage shape**. Copy, rename, retime.

### 1. Single-hit stage

**When to use**: a skill that lands one hit — most Skills, Intros, Liberations.

**Key fields**: one `damage` entry whose `actionFrame` sits inside `actionTime`. `name: "Skill DMG"` and `newName: ""` for a skill that is a single cast stage.

```ts
{
  name: "Skill DMG",
  category: "Resonance Skill",
  newName: "",
  value: "359.85%",
  actionTime: 64,
  variants: { cancel: { actionTime: 20 } },
  damage: [
    {
      type: "Resonance Skill",
      dmgType: "Damage",
      scalingStat: "ATK",
      actionFrame: 20,
      value: 3.5985,
      energy: 10,
      concerto: 0,
      toughness: 1,
      weakness: 0.8,
    },
  ],
}
```

See: `src/data/characters/sanhua.ts` — Eternal Frost.

### 2. Multi-hit stage

**When to use**: one stage that connects several times — a flurry basic, a multi-tick heavy. The in-game value reads like `21.58%*4`.

**Key fields**: one `damage` entry **per hit**, each with its own `actionFrame`. The entries fire in `actionFrame` order; the engine appends a 1-based `.n` suffix to each hit's stageId in that order (see [stageId lineage](#stageid-lineage)), so hit 1 is the earliest `actionFrame`.

**Gotchas**: keep `actionFrame`s ordered and inside `actionTime`. A buff that wants "the 3rd hit" pins `…::basic-attack.3`; a buff that wants "any hit of this stage" omits the suffix.

```ts
{
  name: "Stage 3 DMG",
  category: "Basic Attack",
  newName: "Stage 3",
  value: "21.58%*4",
  actionTime: 39,
  variants: { cancel: { actionTime: 34 }, swap: { actionTime: 0 } },
  damage: [
    // Four hits, identical but for actionFrame (→ stageId suffix .1–.4).
    {
      type: "Basic Attack",
      dmgType: "Damage",
      scalingStat: "ATK",
      actionFrame: 15,
      value: 0.2158,
      energy: 0.38,
      concerto: 2,
      toughness: 0.155,
      weakness: 0.124,
    },
    {
      type: "Basic Attack",
      dmgType: "Damage",
      scalingStat: "ATK",
      actionFrame: 21,
      value: 0.2158,
      energy: 0.38,
      concerto: 2,
      toughness: 0.155,
      weakness: 0.124,
    },
    {
      type: "Basic Attack",
      dmgType: "Damage",
      scalingStat: "ATK",
      actionFrame: 27,
      value: 0.2158,
      energy: 0.38,
      concerto: 2,
      toughness: 0.155,
      weakness: 0.124,
    },
    {
      type: "Basic Attack",
      dmgType: "Damage",
      scalingStat: "ATK",
      actionFrame: 34,
      value: 0.2158,
      energy: 0.38,
      concerto: 2,
      toughness: 0.155,
      weakness: 0.124,
    },
  ],
}
```

See: `src/data/characters/sanhua.ts` — Frigid Light, Stage 3.

### 3. Multi-stage combo skill

**When to use**: a Normal Attack / Forte chain — several stages under one skill, played in sequence (Stage 1 → 2 → 3 …).

**Key fields**: multiple entries in `stages[]`, each its own stage with a distinct `name` (its key derives from `name`, not `newName`). They share the parent skill, so their stage keys differ only by stage. **`requiresPriorStage`** enforces the order: gate every stage after the first on its predecessor's `"skill/stage"` token, and leave stage 1 ungated. The chain only advances when the prior stage was the one that just played.

**Gotchas**: each stage's key comes from its `name` (`deriveKey`), so two stages of one skill must have distinct names (or an explicit `key`). `requiresPriorStage` names exactly one stage with a `"skill/stage"` token — see [stageId lineage](#stageid-lineage).

```ts
{
  id: 1000501,
  name: "Frigid Light",
  type: "Normal Attack",          // SkillGrouping — collapses to "Basic Attack" skillType.
  stages: [
    {
      name: "Stage 1 DMG",
      category: "Basic Attack",
      newName: "Stage 1",          // first stage — ungated, opens the chain.
      actionTime: 21,
      value: "48.71%",
      damage: [/* … */],
    },
    {
      name: "Stage 2 DMG",
      category: "Basic Attack",
      newName: "Stage 2",
      // only reachable after Stage 1 played:
      requiresPriorStage: "frigid-light/stage-1",
      actionTime: 31,
      value: "73.76%",
      damage: [/* … */],
    },
    // … Stage 3 gated on Stage 2, Stage 4 on Stage 3, … (Heavy / Mid-air, etc.)
  ],
  damage: [],
}
```

See: `src/data/characters/sanhua.ts` — Frigid Light.

### 4. Windowed follow-up (`minDelay`)

**When to use**: a stage that follows a prerequisite cast but is **not** a strict combo link — it stays available after swaps and the actor's own other actions, and only becomes castable a fixed time after the prerequisite. Encore's Energetic Welcome (castable ~103 frames after Flaming Woolies, surviving a swap-out) is the canonical case.

**Key fields**: same `requiresPriorStage` gate as the combo chain (recipe 3), **plus** a sibling `minDelay` (frames). Presence of `minDelay` flips the gate from **chain mode** (prerequisite must immediately precede) to **window mode**: the prerequisite need only have cast earlier on the **same character** at any distance — intervening swaps, teammate entries, and the actor's own other actions do not break it. The simulator then pads the follow-up's start so it cannot begin before `prerequisiteCastFrame + minDelay`, surfaced as a `prior-gate` Padding Delay component.

**Gotchas**: the anchor is the prerequisite's **cast frame**, recorded even on a swap-cancel, so a swap-cancelled prerequisite still arms the gate. The pad **`max`-combines with swap-back** (both are floors on the same start), so it bites only when the prerequisite was swap-cancelled and the actor returns early; on a full cast that advances ≥ `minDelay`, the pad is **0**. Set `minDelay` to the prerequisite's "castable-after" delay (Energetic Welcome uses `103`, Flaming Woolies' last-hit `actionFrame`). See ADR-0036.

```ts
{
  name: "Energetic Welcome Damage",
  category: "Resonance Skill",
  newName: "Energetic Welcome",
  // Window-mode follow-up to Flaming Woolies: castable ~103 frames after its
  // cast, staying available across a swap-out. Timing pad is computed sim-side.
  requiresPriorStage: "flaming-woolies/flaming-woolies",
  minDelay: 103,
  value: "339.16%",
  actionTime: 51,
  variants: { cancel: { actionTime: 15 }, swap: { actionTime: 0 } },
  damage: [/* … */],
}
```

See: `src/data/characters/encore.ts` — Flaming Woolies → Energetic Welcome.

### 5. Cancel / swap variants

**When to use**: a stage whose timeline cost shrinks when the player cancels into the next action or swaps out early.

**Key fields**: `variants` — a partial map of `cancel` / `instantCancel` / `swap` to an alternate `actionTime`. `swap: { actionTime: 0 }` is the common "swap-cancel costs nothing" case.

**Rule of thumb for `cancel`**: set its `actionTime` to the `actionFrame` of the stage's **last** `damage` hit. Sanhua's Stage 5 lands at `actionFrame: 32` and its `cancel` is `{ actionTime: 32 }`.

**Gotchas**: hit-dropping applies to **`cancel`/`instantCancel`**. Those shorten the stage and any `damage` entry whose `actionFrame` lands past the shortened advance is **dropped** (it never connects) — unless that entry is marked `independent: true`. So a cancel that cuts `actionTime` from 108 to 32 keeps only hits at `actionFrame ≤ 32`. **`swap` is different**: it plays out **all** the stage's hits regardless of its (often `0`) `actionTime` — the hits buffer out while you swap. Author the full-length hits, then let `cancel`/`instantCancel` prune them; don't hand-trim the `damage` array per variant.

```ts
{
  name: "Stage 5 DMG",
  category: "Basic Attack",
  newName: "Stage 5",
  value: "233.81%",
  actionTime: 108,
  variants: {
    cancel: { actionTime: 32 },
    swap: { actionTime: 0 },
  },
  damage: [
    {
      type: "Basic Attack",
      dmgType: "Damage",
      scalingStat: "ATK",
      actionFrame: 32,
      value: 2.3381,
      energy: 4.2,
      concerto: 10,
      toughness: 1.68,
      weakness: 1.344,
    },
  ],
}
```

See: `src/data/characters/sanhua.ts` — Frigid Light, Stage 5.

### 6. Zero-damage stage (Outro, utility)

**When to use**: a stage that exists for timing and triggers but deals no damage — an Outro that only buffs, a stance toggle.

**Key fields**: `value: "0%"`, `actionTime: 0` (instant), `damage: []`. The stage still emits a `skillCast` event, so buffs can trigger off it.

```ts
{
  name: "Outro DMG",
  category: "Outro Skill",
  newName: "",
  value: "0%",
  actionTime: 0,
  variants: {},
  damage: [],
}
```

See: `src/data/characters/sanhua.ts` — Silversnow (Outro).

### 7. Hidden stage

**When to use**: a stage that's a real, schedulable action but shouldn't clutter the skill sidebar — a dodge counter, a conditional follow-up.

**Key fields**: `hidden: true` on the stage. It still resolves and can be referenced by buffs; it's just filtered from the UI listing.

```ts
{
  name: "Dodge Counter DMG",
  category: "Basic Attack",
  newName: "Dodge Counter",
  value: "167.01%",
  hidden: true,
  actionTime: 1,
  variants: {},
  damage: [
    {
      type: "Heavy Attack",
      dmgType: "Damage",
      scalingStat: "ATK",
      actionFrame: 1,
      value: 1.6701,
      energy: 3,
      concerto: 6,
      toughness: 1.5,
      weakness: 0.96,
    },
  ],
}
```

Note this stage's `category` is `Basic Attack` (the action) while its hit `type` is `Heavy Attack` (the damage class) — the two axes diverge by design.

See: `src/data/characters/sanhua.ts` — Frigid Light, Dodge Counter.

### 8. Forte Circuit payload stage

**When to use**: a Forte Circuit payload — authored under a `type: "Forte Circuit"` skill, but its stage is the actual heavy-attack action the player presses.

**Key fields**: skill `type: "Forte Circuit"` (a SkillGrouping; it collapses to a `Basic Attack` skillType for the lineage unless the hit's `damage[].type` says otherwise), stage `category: "Heavy Attack"`, and the per-hit `damage[].type` carrying the real damage class. Stage-level `concerto` adds on top of the hit's concerto.

```ts
{
  id: 1000507,
  name: "Clarity of Mind",
  type: "Forte Circuit",
  duration: 8,
  stages: [
    {
      name: "Detonate Damage",
      category: "Heavy Attack",
      newName: "Detonate",
      value: "186.29%*2",
      concerto: 15,
      actionTime: 82,
      variants: { cancel: { actionTime: 80 }, swap: { actionTime: 0 } },
      damage: [
        {
          type: "Heavy Attack",
          dmgType: "Damage",
          scalingStat: "ATK",
          actionFrame: 80,
          value: 1.8629,
          energy: 2.34,
          concerto: 7.5,
          toughness: 0.937,
          weakness: 0.7496,
        },
        {
          type: "Heavy Attack",
          dmgType: "Damage",
          scalingStat: "ATK",
          actionFrame: 80,
          value: 1.8629,
          energy: 2.34,
          concerto: 7.5,
          toughness: 0.937,
          weakness: 0.7496,
        },
      ],
    },
  ],
  damage: [],
}
```

The buff that wires a flag onto this stage references it as `stage: "clarity-of-mind/detonate"` — see [stageId lineage](#stageid-lineage) for the token grammar.

See: `src/data/characters/sanhua.ts` — Clarity of Mind.

### 9. Launching (footing) stage

**When to use**: a stage that takes the character off the ground — a plunge launcher, an aerial attack, a skill that commits to a `{ launch }` or `{ land }`. `footing` declares the ground/air state the stage enters on so footing-aware combos and timing resolve correctly.

**Key fields**: `footing` — `{ launch: n }` (begins on the **ground**, launches at frame `n`), `{ land: n }` (begins in the **air**), or the sustained values `"ground"`/`"air"`. Omit it entirely for footing-transparent stages (no entry requirement). Per `stageEntryFooting`, a `{ launch }` enters on the ground and a `{ land }` enters in the air.

**Gotchas**: `footing` is the same field on character and echo stages — the example below is an echo (`EnrichedEcho.skill.stages`), the only authored use today, but a character stage carries it identically. The launch frame and the hit's `actionFrame` are independent numbers. Canonical concept: `references/footing.md`.

```ts
{
  name: "Tap",
  newName: "",
  actionTime: 72,
  footing: { launch: 30 }, // begins grounded, leaves the ground at frame 30
  damage: [
    {
      type: "Echo Skill",
      dmgType: "Damage",
      scalingStat: "ATK",
      actionFrame: 60,
      value: 2.646,
      energy: 3.67,
      concerto: 0,
      toughness: 1.47,
      weakness: 0,
    },
  ],
}
```

See: `src/data/echoes/nightmare-crownless.ts` — Tap.

---

## Reference

Concept-grouped lookup, organized by tier: **Character shell → Skill → Stage → DamageEntry**, then the cross-cutting **stageId lineage** and **timing model**.

### The three axes (read this first)

`SkillGrouping`, `SkillCategory`, and `SkillType` share most of their string values but live on different fields and mean different things. Conflating them is the most common authoring bug.

| Axis            | Field            | Lives on | Means                                                              |
| --------------- | ---------------- | -------- | ------------------------------------------------------------------ |
| `SkillGrouping` | skill `type`     | Skill    | UI sidebar section. No engine semantics beyond lineage collapse.   |
| `SkillCategory` | stage `category` | Stage    | The **player action** that fired the stage — the **trigger** axis. |
| `SkillType`     | `damage[].type`  | Damage   | The **damage-calc class** — keys `skillTypeBonus`/`shred`/etc.     |

- `"Forte Circuit"` and `"Normal Attack"` exist **only** as a skill `type` (SkillGrouping). They are **not** valid stage `category` values and not `SkillType`s. A `Normal Attack` / `Forte Circuit` / `Inherent Skill` / `Tune Break` grouping collapses to a `Basic Attack` skillType in the lineage.
- Triggers and `consumedBy` filters match on `category` (the action), never on the damage `type`. (ADR-0024.)

### Character shell fields

| Field                         | Drives                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`                          | API character id. Referenced by buff `trigger.characterId` and loadout slots.                                          |
| `name`                        | Display name; kebabed into the `<charName>` stageId segment.                                                           |
| `element`                     | Character element. Every stage/hit inherits it for elemental DMG.                                                      |
| `weaponType`, `rarity`        | Metadata; weapon-slot filtering and display.                                                                           |
| `template`                    | `{ weapon, echo, echoSet }` recommended build used to seed a fresh loadout. Scaffolded as empty strings — you fill it. |
| `stats.base` / `stats.max`    | Level-1 and level-90 stat sheets; the loadout interpolates between them by level.                                      |
| `skillTreeBonuses`            | Array of `SkillTreeStat` strings; compiled into permanent stat buffs at bootstrap (`compileSkillTreeNode`).            |
| `recommendedSkillDmgPriority` | UI hint only (which skill type to prioritize).                                                                         |
| `primaryScalingStat`          | Optional `"atk" \| "hp" \| "def"` — the character's main scaling stat, for UI/build hints.                             |
| `forteCap`                    | Max value of the character's forte resource (e.g. Camellya `100`). Omit if not used.                                   |
| `buffs`                       | `BuffDef[]` — scaffolded as `[]`, written by hand. See [BUFFS.md](BUFFS.md).                                           |
| `skills`                      | `EnrichedSkill[]` — see below.                                                                                         |

### Skill fields

| Field           | Drives                                                                                                                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | API skill id.                                                                                                                                                                                                                                                          |
| `name`          | Display name; kebabed into the `<skillName>` stageId segment. **Shared by all the skill's stages.**                                                                                                                                                                    |
| `type`          | `SkillGrouping` — UI sidebar section (see [the three axes](#the-three-axes-read-this-first)).                                                                                                                                                                          |
| `cooldown`      | Skill cooldown, seconds.                                                                                                                                                                                                                                               |
| `duration`      | For stance/forte skills, the window length in seconds.                                                                                                                                                                                                                 |
| `concerto`      | Concerto granted by the skill's **cast** stage (the `"Skill DMG"`-named stage), added on top of per-hit concerto.                                                                                                                                                      |
| `resonanceCost` | Liberation resonance cost.                                                                                                                                                                                                                                             |
| `stages`        | `EnrichedSkillAttribute[]` — the actual schedulable actions.                                                                                                                                                                                                           |
| `hidden`        | Hide the whole skill from the sidebar.                                                                                                                                                                                                                                 |
| `damage`        | **Enrichment leftover bucket.** Raw extraction puts all hit objects here; enrichment distributes them into stages. **Empty `[]` means every hit was assigned**; a non-empty array means there are unassigned remainders still to place. Always `[]` in finished files. |

### Stage fields

A stage is an `EnrichedSkillAttribute`.

| Field                | Drives                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`               | Raw stage name. `"Skill DMG"` (the `STAGE_CAST_NAME` constant) marks the **cast stage** — the one that collects the skill-level `concerto`.                                                                            |
| `category`           | `SkillCategory` — the player action / **trigger** axis.                                                                                                                                                                |
| `newName`            | Display label only — never part of the stageId. Renaming it is always safe.                                                                                                                                            |
| `key`                | Explicit stage-key override for the rare within-skill `deriveKey(name)` collision (e.g. Camellya's held Basic Attack 4 → `basic-attack-4-hold`). Normally omit — the key derives from `name`.                          |
| `value`              | Human-readable scaling string (`"233.81%"`, `"21.58%*4"`). UI only — the engine reads `damage[].value`.                                                                                                                |
| `actionTime`         | Frames the stage advances the timeline. **Scaffolded as `0` — you author the real value.** See [timing model](#stage-timing-model).                                                                                    |
| `damage`             | `DamageEntry[]` — the hits (see below).                                                                                                                                                                                |
| `variants`           | Partial map of `cancel`/`instantCancel`/`swap` → `{ actionTime }`, alternate costs when cut short.                                                                                                                     |
| `hidden`             | Hide the stage from the sidebar (still schedulable/referenceable).                                                                                                                                                     |
| `footing`            | Entry footing — `"ground"`, `"air"`, `{ launch: n }`, `{ land: n }`.                                                                                                                                                   |
| `requiresPriorStage` | Combo gating — this stage only follows the predecessor named by a `"skill/stage"` token.                                                                                                                               |
| `minDelay`           | Frames. Only alongside `requiresPriorStage`; flips the gate to window mode (prerequisite cast earlier anywhere on the same character) and pads the start to `prerequisiteCastFrame + minDelay`. See Cookbook recipe 4. |

**Rare fields:**

- `instantCancel` variant, `animationFrames` — see [timing model](#stage-timing-model).

### DamageEntry fields

One entry = one hit.

| Field                    | Drives                                                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                   | `SkillType` — the **damage-calc** axis (keys `skillTypeBonus`/`shred`/etc.).                                                                                                                                                                                   |
| `dmgType`                | Damage label (`"Damage"`, `"Heal"`, …). `"Heal"` makes it a heal entry using `target`.                                                                                                                                                                         |
| `scalingStat`            | Which stat the multiplier scales off (`"ATK"`, `"HP"`, `"DEF"`).                                                                                                                                                                                               |
| `actionFrame`            | Frame **within the stage** when the hit lands. Must sit inside `actionTime` (or be `independent`). **Scaffolded as `0` — you author it.**                                                                                                                      |
| `value`                  | Multiplier (motion value), e.g. `0.4871` for 48.71%.                                                                                                                                                                                                           |
| `flat`                   | Optional flat add on top of the multiplier.                                                                                                                                                                                                                    |
| `energy`                 | Energy granted on hit.                                                                                                                                                                                                                                         |
| `concerto`               | Concerto granted on hit.                                                                                                                                                                                                                                       |
| `toughness` / `weakness` | Stagger numbers.                                                                                                                                                                                                                                               |
| `forte`                  | Per-hit forte gain for the actor (scaled by `forteRechargePct`).                                                                                                                                                                                               |
| `target`                 | Heal recipient scope (`HealTarget`) — only for `dmgType: "Heal"`.                                                                                                                                                                                              |
| `independent`            | The hit lands at its `actionFrame` even if a cancel/swap cuts the stage short. It's per-hit, not per-stage, because the real cases (a summon spawn, a delayed drop) are one specific hit that survives the cancel while the stage's other hits still truncate. |
| `labels`                 | "Counts-as" `HitLabel`s (e.g. a plunge that also counts as Aero Erosion DMG).                                                                                                                                                                                  |

### stageId lineage

A buff trigger references a stage by an id you **never write on the stage** — it's composed once per stage by the compile pass (`src/lib/compile-character.ts`). Knowing the rule lets you predict the id when wiring a buff.

```
char.sanhua.basic-attack.frigid-light.stage-5::basic-attack
 │     │         │             │           │         │
 │     │         │             │           │         └─ skillType: damage[0].type ?? category
 │     │         │             │           │            (Tune Break → Basic Attack)
 │     │         │             │           └─ stage key: deriveKey(stage.name)
 │     │         │             └─ skill key: deriveKey(skill.name)
 │     │         └─ stage.category  (identity only — matching uses the skillCategory axis)
 │     └─ character.name
 └─ literal "char"
```

`deriveKey(name)` strips a trailing `" DMG"` / `" Damage"` and kebab-cases; the cast names `"Skill DMG"` and `"Outro DMG"` normalize to `cast` (`char.sanhua.resonance-skill.eternal-frost.cast::resonance-skill`). Keys come from the read-only API `name` — never `newName` — so display renames never move an id. On a within-skill collision, set an explicit `key:` on one stage (the compile pass throws otherwise).

Key points an author trips on:

- The `::<skillType>` segment is derived from `damage[0].type`, falling back to the stage `category` (Tune Break → Basic Attack). It is **not** the skill's `type` grouping.
- A specific hit is targeted with the `hitIndex` trigger/filter axis (1-based, DamageEntry order) — not by a suffix on the id.

**Referencing a stage**: you never write the lineage id. Author references — `requiresPriorStage`, a buff's `trigger.stage`, `appliesToHits.stage` — use a **`"skill/stage"` token** (both keys from `deriveKey`). Append `#n` to pin the 1-based Nth hit (`"frigid-light/stage-5#1"`), or write a bare `"skill"` for the whole-skill axis — every stage of that skill, regardless of category (`skill: "burgeoning"`). An array is an OR within the axis; `skillCategory` stays its own field. The compile pass lowers the token to the structured `stageId` / `skill` / `hitIndex` axes and throws on any unresolved reference (ADR-0039).

Echo stages have one implicit skill, so a reference is just `"stage"` / `"stage#n"`; the resolved id is `echo.<echoName>.<stageKey>::echo-skill`.

### Stage timing model

Four numbers govern a stage's clock. Authored from the player's seat:

| Field                       | Unit             | Meaning                                                                                               |
| --------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| stage `actionTime`          | engine frames    | How far the stage advances the timeline — the stage's "cost". The outer bound.                        |
| `damage[].actionFrame`      | engine frames    | When **within** the stage a hit connects. Must satisfy `actionFrame ≤ actionTime` (or `independent`). |
| `variants[kind].actionTime` | engine frames    | A shortened `actionTime` when the stage is `cancel`/`instantCancel`/`swap`-cut.                       |
| `animationFrames`           | wall-clock 60fps | Cutscene length during which the **engine clock does not advance** (e.g. a Liberation animation).     |

The relationship in one line: a stage advances `actionTime` frames; each hit lands at its `actionFrame` inside that window; a `cancel`/`instantCancel` variant **replaces** `actionTime` with a smaller number and any hit whose `actionFrame` now exceeds the advance is **dropped unless `independent`**. `swap` is the exception — it advances by its `actionTime` but **keeps all hits** (`resolveStageExecution`).

A cutscene stage carries **both**: it plays `animationFrames` of frozen animation first (engine clock paused — only off-field swap-back CDs recover), **then** advances `actionTime` as the action lock. `actionTime: 0` is a real value (the character acts the instant the cutscene ends), distinct from omitting `animationFrames` (a non-cutscene stage). `actionFrame` is measured from the lock's start, so a cutscene stage's hits sit at `0`.

**Worked example** — Stage 5 has `actionTime: 108` with its hit at `actionFrame: 32`. Played in full it advances 108 frames and connects at frame 32. Cancelled (`cancel: { actionTime: 32 }`) it advances only 32 frames; the hit at 32 still lands (`32 ≤ 32`). Swap-cut (`swap: { actionTime: 0 }`) advances 0 frames but **still deals the hit** — `swap` never drops hits, so the damage buffers out as you swap away.

---

## Related

- [BUFFS.md](BUFFS.md) — authoring the `buffs:` array (the other half of a character file).
- [enriched-model](../../docs/enriched-model.md) — why characters exist in raw + enriched shapes.
- ADR-0024 — the `SkillCategory` vs `SkillType` split and the stageId lineage format.
