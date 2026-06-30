# Stat Table

A `StatTable` is the **flattened, aggregated stat sheet** for one character at one
moment: every base/percent/flat stat, crit, damage bonus, Amplify, shred, and
recharge value the damage formula needs, already summed across character, weapon,
echoes, and active buffs. It is the single object buffs write into and the damage
pipeline reads from.

**Source files:** `src/types/stat-table.ts`, `src/lib/loadout/resolve-slot.ts` (base table), `src/lib/engine/apply-stat-effects.ts` (buff fold)

## How it works

The shape is intentionally wide and flat. Scalars cover the three primary stats in
`base` / `Pct` / `Flat` form (`atkBase`/`atkPct`/`atkFlat`, likewise HP and DEF),
`critRate` / `critDmg`, `defShred`, recharge (`energyRechargePct`,
`forteRechargePct`), `healingBonus`, and `bonusMultiplier`. Three axes are keyed
maps rather than scalars:

- `elementBonus` / `elementAmp` — `Record<Element, number>`
- `skillTypeBonus` / `skillTypeAmp` / `shreds` — `Record<SkillType, number>`

…each paired with an `all*` scalar (`allDmgBonus`, `allAmp`) for
element-/type-agnostic contributions. `emptyStatTable()` seeds every field to
zero (maps included) and is the starting point the builder accumulates onto.

`ScalarStatKey` enumerates just the scalar (non-map) fields — it is the address
space a buff `StatEffect` can target directly. The keyed-map axes are addressed
separately. See [buff-reference](buff-reference.md) for the full StatPath ↔ field mapping rather
than duplicating it here.

### How it's built

`resolve-slot.ts` (`resolveBaseStats`) starts from `emptyStatTable()` and layers
the base contributions via the per-entity peers: `resolve-character` (character
base stats, with the intrinsic 5% crit-rate / 150% crit-dmg floor every character
starts at), `resolve-weapon` (weapon main/sub stats), and `resolve-echo` (the echo
build — expanded from the `SlotLoadout`'s `echoBuild` pattern and main-stat choices
into concrete main + substat rolls via `echo-stat-constants`). The active
`BuffDef`s are folded on top later by `apply-stat-effects` (`accumulateStatEffects`),
which resolves each `ValueExpr` and writes into the matching field.

### Intrinsic vs derived resolution

Stat resolution runs in two tiers. The **intrinsic** pass folds base stats plus
every non-`scaledByStat` buff (`const`, `perStack`, `scaledByStacks`,
`fromStatusStacks`) — none of which read another character's stat table. The
**derived** pass then applies `scaledByStat` effects, each reading the
_intrinsic_ table of the character it points at (`scaledByStat.characterId`).

Because the derived pass reads only intrinsic tables — never derived ones — a
`scaledByStat` chain cannot feed back into itself: the cycle is unrepresentable,
not guarded against. Concretely, Shorekeeper's Stellarealm Crit conversion reads
her intrinsic Energy Regen — gear + weapon + Self Gravitation's +10% while a
realm is up — but never Crit produced by another `scaledByStat`.

## Gotchas

- The crit floor (5% / 150%) is applied in the builder, not stored on the
  character — an empty table has `critRate: 0`.
- `SkillType` here excludes `"Movement"`-only nuances and `"Forte Circuit"`
  (which is a `SkillGrouping`, not a `SkillType`); the map keys follow the
  `SkillType` union exactly.
- `scaledByStat` reads the source character's **intrinsic** stats, not a
  fully-resolved table. A `const`/`perStack` ER buff flows into a `scaledByStat`
  ER reader; a (hypothetical) ER buff that was itself `scaledByStat` would not.

## Related

- [buff-reference](buff-reference.md) — StatPath reference: which path writes which field
- [buff-engine](buff-engine.md) — how buffs accumulate onto the table
- [loadout](loadout.md) — the echo build / main-stat inputs the builder expands
- [enriched-model](enriched-model.md) — the character/weapon/echo shapes consumed
