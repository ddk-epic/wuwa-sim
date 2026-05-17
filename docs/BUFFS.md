# Buff Reference

Reference for `StatPath` values accepted by `kind: "stat"` buff effects.

## Stat paths

| `stat`              | `key`                              | Description                                                                                                                                                                 |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atkPct`            | —                                  | ATK multiplier (additive with other atkPct contributions)                                                                                                                   |
| `atkFlat`           | —                                  | Flat ATK added after percent                                                                                                                                                |
| `hpPct`             | —                                  | HP multiplier                                                                                                                                                               |
| `hpFlat`            | —                                  | Flat HP                                                                                                                                                                     |
| `defPct`            | —                                  | DEF multiplier                                                                                                                                                              |
| `defFlat`           | —                                  | Flat DEF                                                                                                                                                                    |
| `critRate`          | —                                  | Critical rate                                                                                                                                                               |
| `critDmg`           | —                                  | Critical damage multiplier                                                                                                                                                  |
| `defShred`          | —                                  | Enemy DEF reduction                                                                                                                                                         |
| `allDmgBonus`       | —                                  | Flat additive DMG bonus applied across all skill types                                                                                                                      |
| `energyRechargePct` | —                                  | Energy recharge percent                                                                                                                                                     |
| `elementBonus`      | `string` (element name or `"all"`) | Element-typed DMG amp; `"all"` applies to every element                                                                                                                     |
| `skillTypeBonus`    | `SkillType`                        | Skill-type DMG amp (additive)                                                                                                                                               |
| `deepen`            | `SkillType` \| `"all"`             | Multiplicative DMG amp applied as a separate `(1 + deepen)` factor; `"all"` applies to every skill type and stacks additively with a skill-type-specific deepen at hit time |
| `shred`             | `SkillType`                        | Enemy RES reduction for the given skill type                                                                                                                                |
| `healingBonus`      | —                                  | Flat additive healing bonus; multiplies the entire heal expression `(1 + healingBonus)`                                                                                     |

### `deepen "all"` semantics

`deepen` keyed `"all"` is evaluated at hit time in `compute-damage.ts`:

```
deepen = deepens[skillType] + deepens["all"]
```

Both contributions fold into the single `(1 + deepen)` factor in the damage formula. Authored buffs that use `{ stat: "deepen", key: "all" }` will boost all skill types by the same amount.

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
