# StatTable stays nested; the 1D `Record<StatKey, number>` flatten is deferred

`StatTable` (`src/types/stat-table.ts`) stays a heterogeneous shape: scalar `number`
fields (`atkBase`, `atkPct`, `critRate`, …) alongside five nested per-dimension
records — `elementBonus`/`elementDeepen` (`Record<Element, number>`) and
`skillTypeBonus`/`skillTypeDeepen`/`shreds` (`Record<SkillType, number>`). A proposal
to flatten it into a uniform `Record<StatKey, number>` using template-literal
composite keys (`` `elementBonus.${Element}` ``, `` `shred.${SkillType}` ``, …), in
the name of handling the whole table with no branch-on-shape, is **rejected for now.**

The decisive point: **the flatten does not eliminate special-casing, it relocates
it.** The special case is conserved; only its location changes.

- **Nested (chosen):** clean _reads_ — `snap.elementBonus[el]` indexes directly by a
  runtime `Element`/`SkillType`, no key construction, no cast. The special case lives
  in _writes/merge/clone_: `applyToPath` branches scalar-field vs nested-field, and
  `cloneStats` hand-spreads the five records.
- **1D template-literal:** clean _writes/merge/clone/serialization_ — `applyToPath`
  collapses to `stats[key] += v`, `cloneStats` to `{ ...s }`. But the special case
  moves to _construction_ (a loop over `dimension × group` to build the total record)
  and to _reads_, which must construct composite keys (``stats[`elementBonus.${el}`]``).

Nested reads are the deliberate elegant trade — the data shape mirrors the access
pattern — and the one capability the flatten uniquely unlocks (`scaledByStat` over a
nested key) has zero current usage: every authored `scaledByStat` targets
`energyRechargePct`. So the ~56-access / 12-file / data-migration cost buys no present
benefit.

Instead, capture the cheap, behavior-preserving type-safety win: extract the curated
scalar key union already inlined in `StatPath` into a named `ScalarStatKey`, and reuse
it in `StatPath`, `ValueExpr.scaledByStat.stat` (currently bare `string`), and
`getCharStat`. That alone types `resolveStats(cid)[stat]` as `number` and removes the
`as unknown as Record<string, number>` double-cast in `buff-engine.ts` — the only cast
that actually bites — without touching the table shape.

## Considered Options

- **Keep nested, add `ScalarStatKey` (chosen).** Removes the double-cast for a named
  type plus three signature touches; preserves the clean nested reads.
- **Full 1D flatten with template-literal composite keys.** Rejected now: relocates
  special-casing rather than removing it, and pays a 56-access / 12-file + data
  migration cost for a capability nothing uses yet.
- **Full 1D flatten with a spelled-out flat enum** (`"elementBonusFusion" | …`).
  Rejected: the members are opaque strings, so they cannot be indexed by a runtime
  `Element`/`SkillType` without a cast or a maintained `Record<Element, StatKey>`
  lookup map — reintroducing the exact special-casing the refactor set out to remove.

## Consequences

- The two `Object.fromEntries(...) as Record<…>` construction casts in
  `stat-table.ts` remain. Localized and low-risk.
- `scaledByStat` still cannot target a nested key. No authored buff needs this today.
- The `shred` (StatPath discriminant) vs `shreds` (table field) naming split persists;
  the flatten would have forced one canonical name. Left as-is.
- If a future feature genuinely needs `scaledByStat` over a nested key, the
  template-literal-union flatten is the path, and `ScalarStatKey` is expected to
  subsume into the broader `StatKey`. The curation question (which keys are legal
  scale-by targets) should be re-decided explicitly at that point.
