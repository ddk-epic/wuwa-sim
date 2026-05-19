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
| `allDmgBonus`       | —           | Wildcard DMG amp summed alongside element/skill-type bonuses                            |
| `allDeepen`         | —           | Wildcard deepen summed alongside element/skill-type deepens                             |
| `energyRechargePct` | —           | Energy recharge percent                                                                 |
| `elementBonus`      | `Element`   | Per-element DMG amp                                                                     |
| `skillTypeBonus`    | `SkillType` | Per-skill-type DMG amp                                                                  |
| `elementDeepen`     | `Element`   | Per-element deepen                                                                      |
| `skillTypeDeepen`   | `SkillType` | Per-skill-type deepen                                                                   |
| `shred`             | `SkillType` | Enemy RES reduction for the given skill type                                            |
| `healingBonus`      | —           | Flat additive healing bonus; multiplies the entire heal expression `(1 + healingBonus)` |

### DMG bonus and deepen buckets

DMG bonus and deepen each have three symmetric buckets — per-element, per-skill-type, and a global wildcard. They sum additively at hit time:

```
dmgBonus = elementBonus[element] + skillTypeBonus[skillType] + allDmgBonus
deepen   = elementDeepen[element] + skillTypeDeepen[skillType] + allDeepen
```

Authored buffs targeting "all" damage of a kind should use the scalar paths `allDmgBonus` / `allDeepen`. See ADR-0017.

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
