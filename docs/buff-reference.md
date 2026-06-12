# Buff Reference

Reference for `StatPath` values accepted by `kind: "stat"` buff effects.

## Stat paths

| `stat`              | `key`       | Description                                                                             |
| ------------------- | ----------- | --------------------------------------------------------------------------------------- |
| `atkPct`            | —           | ATK multiplier (additive with other atkPct contributions)                               |
| `atkFlat`           | —           | Flat ATK added after percent                                                            |
| `hpPct`             | —           | HP multiplier                                                                           |
| `hpFlat`            | —           | Flat HP                                                                                 |
| `defPct`            | —           | DEF multiplier                                                                          |
| `defFlat`           | —           | Flat DEF                                                                                |
| `critRate`          | —           | Critical rate                                                                           |
| `critDmg`           | —           | Critical damage multiplier                                                              |
| `defShred`          | —           | Enemy DEF reduction                                                                     |
| `allDmgBonus`       | —           | Wildcard DMG bonus summed alongside element/skill-type bonuses                          |
| `allAmp`            | —           | Wildcard Amplify summed alongside element/skill-type Amplify                            |
| `energyRechargePct` | —           | Energy recharge percent                                                                 |
| `elementBonus`      | `Element`   | Per-element DMG bonus                                                                   |
| `skillTypeBonus`    | `SkillType` | Per-skill-type DMG bonus                                                                |
| `elementAmp`        | `Element`   | Per-element Amplify                                                                     |
| `skillTypeAmp`      | `SkillType` | Per-skill-type Amplify                                                                  |
| `shred`             | `SkillType` | Enemy RES reduction for the given skill type                                            |
| `healingBonus`      | —           | Flat additive healing bonus; multiplies the entire heal expression `(1 + healingBonus)` |

### DMG bonus and Amplify buckets

DMG bonus and Amplify each have three symmetric buckets — per-element, per-skill-type, and a global wildcard. They sum additively at hit time:

```
dmgBonus = elementBonus[element] + skillTypeBonus[skillType] + allDmgBonus
amp      = elementAmp[element] + skillTypeAmp[skillType] + allAmp
```

Authored buffs targeting "all" damage of a kind should use the scalar paths `allDmgBonus` / `allAmp`. See ADR-0017.

## Healing pipeline

### `HealTarget` (DamageEntry.target)

Specifies the recipient scope of a heal entry (`dmgType: "Heal"`). Omitting `target` defaults to `"self"` (healer only — safe under-heal rather than over-counting).

| Value              | Recipients                                            |
| ------------------ | ----------------------------------------------------- |
| `"self"`           | Healer character only                                 |
| `"source"`         | Same as `"self"` for authored heals                   |
| `"team"`           | All non-null party slots                              |
| `"currentOnField"` | Character currently on the field at heal time         |
| `"nextOnField"`    | Unknown at heal time — resolves to empty in this pass |

### `healLanded` trigger event

```ts
{ event: "healLanded"; actor?: "self" | "any"; characterId?: number; skillType?: SkillType | SkillType[]; stageId?: string | string[]; hitIndex?: number }
```

Fires once per heal entry (not once per recipient). No `source` filter (no synthetic-heal mechanism in this pass).

### `SustainEvent` log entry

`kind: "sustain"`, `sub: "heal"` — recorded in `SimulationLogEntry` alongside `HitEvent`. Key fields:

- `amount` — rounded integer heal value
- `targets` — resolved recipient characterIds
- `statsSnapshot` — healer's full StatTable at fire time
- `multiplier`, `flat`, `scalingStat` — raw inputs for inspection

## Hit-scoped DMG Bonus (`appliesToHits`)

Some buffs should boost only specific hits rather than every hit from the character. `BuffDef.appliesToHits?: HitFilter` marks a buff as hit-scoped (ADR-0029).

### How it works

A hit-scoped buff is **excluded from the normal stat-table fold** (both bootstrap and `resolveStats` without a hit context). It contributes only when `resolveStats(charId, hit)` is called with a matching `HitContext`:

1. Normal pass: buffs with `appliesToHits` are skipped.
2. Second pass (only when `hit` is provided): buffs whose `appliesToHits` filter matches the hit are folded in — their stat effects (typically `allDmgBonus`) are added to the snapshot.

Damage computed from that snapshot therefore reflects the per-hit bonus. The log's `statsSnapshot` and `activeBuffs` list both reflect the second-pass result, so the Hit Drawer shows exactly which buffs contributed.

### `HitFilter` axes (conjunction)

All present axes must match; absent = unconstrained. An axis the hit lacks (e.g. `sourceBuffId` on an authored hit) never matches a constrained filter.

Stage scope is expressed through three independent axes (ADR-0039): `stageId` matches the lineage id by **exact equality**; `skill` matches by skill key — every hit of every stage of that skill, regardless of category (Camellya's Sweet Dream scope is just `["burgeoning", "valse-of-bloom-and-blight"]` once lowered); `hitIndex` pins the Nth hit (1-based, DamageEntry order).

| Axis            | Type                       | Notes                          |
| --------------- | -------------------------- | ------------------------------ |
| `sourceBuffId`  | `string \| string[]`       | Only synthetic hits carry this |
| `stageId`       | `string \| string[]`       | Exact lineage id               |
| `skill`         | `string \| string[]`       | Skill key                      |
| `hitIndex`      | `number \| number[]`       | 1-based, DamageEntry order     |
| `skillType`     | `SkillType \| SkillType[]` |                                |
| `skillCategory` | `SkillCategory \| ...`     |                                |
| `element`       | `Element \| Element[]`     |                                |

### Example — Sanhua Avalanche

```ts
{
  id: "char.sanhua.passive.avalanche",
  trigger: { event: "skillCast", stageId: "...frigid-light.stage-5::basic-attack" },
  target: { kind: "self" },
  duration: { kind: "seconds", v: 8 },
  appliesToHits: {
    sourceBuffId: [
      "char.sanhua.ice-thorn-burst",
      "char.sanhua.ice-prism-burst",
      "char.sanhua.ice-glacier-burst",
    ],
  },
  effects: [{ kind: "stat", path: { stat: "allDmgBonus" }, value: { kind: "const", v: 0.2 } }],
}
```

The +20% folds into the snapshot only when one of the three ice burst emits is resolved within the 8-second window. Authored hits and other synthetics are unaffected.
