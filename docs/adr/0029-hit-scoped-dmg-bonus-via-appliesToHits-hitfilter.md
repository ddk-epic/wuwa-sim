# A hit-scoped DMG Bonus is a buff-level `appliesToHits` Hit Filter, folded into the matching hit's own snapshot in a second `resolveStats` pass

A DMG Bonus that applies only to _certain hits_ — Sanhua's Avalanche raises her three Forte
Circuit Ice Burst emits by 20%, but not the detonate's own Heavy Attack hits that land in the
same 8s window — is modeled by an optional buff-level `appliesToHits: HitFilter` on the
`BuffDef`. When present, **all** the buff's `stat` Effects are hit-scoped: they are excluded
from the hit-agnostic snapshot and folded additively into the matching hit's _own_ Stat Table
snapshot, landing in `allDmgBonus`. There is **no** new effect kind, no new `Stat Table`
dimension, no minted tag on the hit, no sibling emit/coord hit, and no new `Condition`.

The load-bearing constraint: a DMG Bonus must land in the hit's **own** `(1 + dmgBonus)`
factor. Any _separate_ hit — coord or emit — carries its own `(1 + dmgBonus)` and so can only
ever produce a multiplicative `×1.2`, never an additive `+0.20` into the burst's bucket.
`×1.2 ≠ +0.20` whenever the hit already carries element/skill-type bonus (always true in
practice), so the sibling-hit model overstates the bonus. The fix therefore _requires_
hit-scoped stat application folded into the hit's snapshot; it cannot be another emitted hit.
(This was the prior `coordHit`-based Avalanche model — wrong twice over: it also mislabeled
self additional-damage as a teammate Coordinated Attack via the `coord` pill.)

`HitFilter` is a conjunction of narrowing axes (`sourceBuffId`, `stageId`, `skillType`,
`skillCategory`, `element` — each a value or array). An absent axis is unconstrained; an axis
the hit lacks **never matches** — a [[Synthetic Hit]] has no `stageId`/`skillCategory`, and an
authored hit has no `sourceBuffId`. (This is why Sanhua's `{ sourceBuffId: [the three bursts] }`
excludes the detonate's authored Heavy hits unconditionally: an authored hit can never carry a
`sourceBuffId`, regardless of whether its path threads a hit context.) The `stageId` axis matches
by **lineage prefix** via the same `stageIdMatches` the trigger matcher uses (added by
[ADR-0032](0032-pistil-bud-conversion-via-resourcestep-and-scaledbystacks.md), unifying a latent
inconsistency where the Hit Filter required exact equality): an id without a `.<hitIndex>` suffix
matches every hit of that stage lineage; with the suffix it pins exactly that hit.

The predicate is **buff-level**, not effect-level: one rule per buff, scoping every stat effect
the buff carries. This keeps the engine change to a single `if (def.appliesToHits)` guard in
each of two places. `accumulateStatEffects` (shared by the bootstrap permanent-fold and the
normal `resolveStats` pass) now **skips** any `appliesToHits` buff, so a hit-scoped bonus never
touches the base table or the hit-agnostic snapshot. A mirror `accumulateMatchingStatEffects`
folds an `appliesToHits` buff's effects only when `matchesHit(filter, hit)`. `resolveStats`
gains an optional `hit?: HitContext`: when present it runs the second sub-pass after the normal
accumulation. The bonus folds into `allDmgBonus`, summed by the single `computeDamage` path
every hit flows through — so it applies uniformly to authored and synthetic hits with no new
keyed dimension.

Crucially, `appliesToHits` is **not** a `Condition`: it runs uncached in the fold pass and
never touches the `ConditionEvaluator`, whose cache is keyed by `(buffId, sourceId, targetId,
actingId)` and invalidated by subsystem _version_ tuples. A per-hit predicate has no version, so
routing it through the condition layer would pollute or bypass that cache. A buff's `condition`
(e.g. "is the window open?") stays cacheable and composes with `appliesToHits` (the per-hit
"is this one of the bursts?") — two orthogonal gates.

Both damage paths build a `HitContext` and thread it through `resolveHit(actor, frame, hit?)`
→ `resolveStats(charId, hit?)`, and through `activeBuffs(charId, hit?)`: the synthetic-emit path
(`emit-hit-dispatcher`, carrying `sourceBuffId`/`skillType`/`element`) and the authored path
(`resolveTrailingBundle`, carrying `stageId`/`skillCategory`/`skillType`/`element` — all in hand
at the call site). Non-hit callers (ER calc, forte-recharge, `scaledByStat` recursion) pass
nothing, so the second sub-pass is skipped and they behave exactly as before. Because
`activeBuffs` also takes the hit, a non-matching `appliesToHits` buff is filtered out of a hit's
`activeBuffs` list — preserving the invariant "a buff listed on a hit contributed to that hit."

## Considered Options

- **Buff-level `appliesToHits: HitFilter`, second `resolveStats` fold pass (chosen).** No new
  effect kind, no new Stat Table dimension, no minted hit identity. One new resolution seam
  keyed off a hit context that already exists at both emit and authored resolution sites. The
  buff fully owns the rule; the hit stays dumb (carries only its intrinsic identity). Correct
  generally — true hit-scoping that folds into the hit's own `allDmgBonus`.
- **A `DmgTag` dimension on the hit (shipped, then reverted).** A fourth keyed bonus bucket
  (`tagBonus: Record<DmgTag, number>`) alongside element and skill type; the hit carries an open
  `tag` string and the buff grants `tagBonus[tag]`. Numerically correct and uniform across paths,
  and its insight survives — a hit-scoped bonus _is_ just another additive term in the one
  `computeDamage` path. Rejected on two grounds: (1) it mints a new string namespace whose only
  job is to bridge buff↔hit, which must be kept in sync in two places (a `tag` on the emit and a
  `tagBonus` key on the buff) and grows with the roster; (2) it pushes identity onto the hit
  rather than letting the buff own the rule. Folding into `allDmgBonus` via the buff's own
  predicate keeps the insight (one additive path) while dropping both the namespace and the
  hot-struct dimension.
- **Effect-level `match: HitFilter` on each `StatEffect` (superseded).** The same predicate but
  attached per-effect rather than per-buff. More granular — one buff could mix an unconditional
  stat and a hit-scoped one — but it pushes the rule down onto each effect rather than the buff
  owning it, and grows the type surface on the most-used effect kind. Buff-level captures every
  real case (a hit-scoped buff's effects share one scope) at lower cost; a buff needing both an
  unconditional and a scoped effect splits into two buffs, as it would today.
- **A `skillTypeBonus["Resonance Skill"] += 0.2` window buff.** One stat buff, zero engine
  change — but _type_-scoped, not _hit_-scoped: it leaks onto any other Resonance Skill recast in
  the window. Near-exact for Sanhua _in practice_ (Eternal Frost's 10s CD keeps it out of the 8s
  window) but not correct generally.
- **A new `Condition` kind reading the current hit.** Rejected: the `ConditionEvaluator` cache is
  keyed by `(buffId, sourceId, targetId, actingId)` and invalidated by subsystem _version_ tuples.
  A per-hit predicate has no version, so it would pollute or bypass the cache. Routing the scoping
  through a stat fold pass avoids the condition layer entirely.
- **Sibling emit/coord hit (the prior model).** Rejected by the load-bearing constraint above: a
  separate hit can only multiply, never add into the burst's own bucket.

## Consequences

- `BuffDef` grows an optional `appliesToHits`; the default (absent) is today's behavior, so every
  existing buff is unchanged. `accumulateStatEffects` and the new `accumulateMatchingStatEffects`
  partition the stat effects exactly on `def.appliesToHits` — neither double-applies.
- Sanhua's Avalanche collapses from four buffs (an empty window flag + three `coordHit` bonuses)
  to one window buff: `trigger: BA5`, `duration: 8s`, `appliesToHits: { sourceBuffId: [the three
Ice Burst emits] }`, `effects: [allDmgBonus += 0.2]`. The detonate's own Heavy hits read the
  snapshot but never match (authored hits carry no `sourceBuffId`), so they are excluded.
- Both the synthetic and authored paths thread a hit context from day one, so a `stageId`-scoped
  bonus on an authored hit works immediately — no deferred follow-up, no silent no-op.
- `activeBuffs` takes an optional hit and filters non-matching `appliesToHits` buffs, so the Hit
  Drawer keeps "listed = contributed." This is the first buff that is _active_ at a frame yet does
  not contribute to every hit in that frame; the hit-aware filter is what reconciles the two
  readings.
- The `DmgTag` dimension and all its plumbing (`tagBonus` on `StatTable`, the `tagBonus`
  `StatPath`/`applyToPath` case, `DamageEntry.tag`, `HitEvent.tag`, `DamageContext.tag` and its
  `computeDamage`/`hit-formula` sums, `src/data/dmg-tags.ts`) are removed — the bonus folds into
  the existing `allDmgBonus` instead.
