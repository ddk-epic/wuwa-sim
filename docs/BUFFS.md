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

### `deepen "all"` semantics

`deepen` keyed `"all"` is evaluated at hit time in `compute-damage.ts`:

```
deepen = deepens[skillType] + deepens["all"]
```

Both contributions fold into the single `(1 + deepen)` factor in the damage formula. Authored buffs that use `{ stat: "deepen", key: "all" }` will boost all skill types by the same amount.
