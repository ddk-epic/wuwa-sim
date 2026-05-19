# Damage-modifier buckets: per-element / per-skill-type / global, applied symmetrically to bonus and deepen

`StatTable` exposes six buckets that the damage formula sums into two terms — `dmgBonus` and `deepen` — at hit time:

```
elementBonus[Element]     skillTypeBonus[SkillType]     allDmgBonus
elementDeepen[Element]    skillTypeDeepen[SkillType]    allDeepen

dmgBonus = elementBonus[el] + skillTypeBonus[skill] + allDmgBonus
deepen   = elementDeepen[el] + skillTypeDeepen[skill] + allDeepen
```

Each row is a complete triplet — per-element, per-skill-type, and a global flat scalar. The per-element and per-skill-type maps are pre-filled with every key set to `0` by `emptyStatTable()`, so reads are total and `applyToPath` uses `+=` directly with no `?? 0`. Wildcards live in the flat scalars `allDmgBonus` and `allDeepen`; there are no magic-key wildcards (`elementBonus["all"]`, `deepens["all"]`).

## Considered options

- **Mixed magic-key wildcards (status quo before this change).** The pre-change shape carried wildcards two different ways at once: `elementBonus` was `Record<string, number>` with a magic `"all"` key alongside the separate `allDmgBonus` scalar, while `deepens` was `Record<string, number>` keyed by `SkillType | "all"`. Rejected: introducing the new `elementDeepen` axis would have entrenched the asymmetry — bonus and deepen each having both styles of wildcard for no semantic reason. The damage formula already had to sum across both, and every read site needed `?? 0`. The cost of leaving it alone scaled with each new modifier we'd add.
- **Only `elementDeepen` added, magic-key wildcards kept.** Rejected. Solves the immediate motivating problem (elemental deepen for characters whose deepen is element-scoped, not skill-scoped) but perpetuates the magic-key style. Future readers would have to remember that `"all"` is a reserved bucket-name in two of four maps but not the others.
- **All wildcards as reserved keys in the per-element / per-skill-type maps.** Rejected. Mixes "the axis I'm keyed on" with "the bypass that means I'm not keyed on anything." Flat scalars are the honest shape for "this applies regardless of axis."
- **Keep `deepens` as `Record<string, number>` (mixed `SkillType` and `Element` keys in one bucket).** Rejected. Re-introduces the `string` key that the rest of the refactor is removing, and merges two independent axes into one map purely to avoid adding a field. A typo'd skill name would compile but never trigger.

## Consequences

- `StatTable` gains `elementDeepen`, `skillTypeDeepen` (renamed from `deepens`), and `allDeepen`. Drops the magic-key wildcards from `elementBonus` and the old `deepens`.
- `StatPath` gains `elementDeepen` / `skillTypeDeepen` / `allDeepen` variants and drops the `"deepen"` variant. `elementBonus.key` is `Element` (closed union); the `"all"` key is gone.
- `emptyStatTable()` pre-fills `elementBonus` and `elementDeepen` (via `emptyElementMap()`) for the same reason `skillTypeBonus` is pre-filled: closed-union records require all keys present, and pre-filling means `applyToPath` and the hit-time sums never need `?? 0`.
- Authored data migrations: Stringmaster's `elementBonus["all"]` becomes `allDmgBonus`; Verina's `deepen.all` becomes `allDeepen`; Sanhua's `deepen` becomes `skillTypeDeepen`. No semantic change.
- `compute-damage.ts` and `hit-formula.ts` simplify: dmgBonus is three additive terms, deepen is three additive terms, no `?? 0`. `formatDeepenCell` now takes `element` alongside `skillType` because elementDeepen contributes.
- The pattern is open for further symmetric additions (e.g. `elementShred` if a future mechanic needs it) without disturbing existing call sites.
