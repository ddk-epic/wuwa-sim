# Resources

Resources are the per-character gauges the engine accrues, caps, spends, and
triggers off — kept deliberately separate from the [Stat Table](stat-table.md)
([ADR-0003](adr/0003-resources-separate-from-stat-table.md)). A buff reads a
resource through a Value Expr or a condition; it never folds into the damage
formula directly.

**Source files:** `src/lib/engine/resource-ledger.ts`,
`src/lib/engine/resource-accrual.ts`, `src/lib/engine/pool-store.ts`,
`src/lib/engine/buff-engine.ts` (dispatch + accrual wiring), `src/types/buff.ts`
(`ResourceKind`, `ResourceState`).

## The four kinds

`ResourceKind = "energy" | "concerto" | "forte" | "pool"`. Each character holds a
`ResourceState { energy, concerto, forte, pool }` in the `ResourceLedger`.

| Kind       | Cap                        | Scaled on gain                                                        | Spent by                                                  |
| ---------- | -------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| `energy`   | uncapped                   | ER (`× (1 + energyRechargePct)`)                                      | Resonance Liberation cast — drained to 0                  |
| `concerto` | uncapped                   | raw                                                                   | Outro Skill cast (drained to 0); on-cast stage `concerto` |
| `forte`    | `forteCap` (per character) | FR (`× (1 + forteRechargePct)`) on gains, raw on spend                | data-authored `resource` effects; on-cast stage `forte`   |
| `pool`     | `emitPool.cap` (optional)  | not accrued — projection of the [Emit Pool](#the-pool-resource) store | conversion (timer / displacement / `convert`)             |

## Accrual from hits

A landed hit grants energy/concerto/forte read off its `DamageEntry`
(`energy`, `concerto`, `forte`). The pure rule lives in `accrueForHit`
(`resource-accrual.ts`); the engine only supplies state:

- **Energy** — actor gets `energy × (1 + ER) × (1 + energyGainMult)`; each
  teammate gets a `× 0.5 × (1 + ER)` share. `energyGainMult` applies only to
  consuming attacks (a hit with negative `forte`). An **Intro Skill** grants its
  `energy` verbatim (`energyFlat` — no ER, no mult) to actor and shares alike.
- **Concerto** — raw, actor only.
- **Forte** — FR-scaled when positive (a gain), raw when negative (a spend).
- **Synthetic hits** (emitHit / coordHit / matured Emit Pool butterflies) accrue
  to the actor but **do not** share energy to teammates.

Implicit accrual runs at the top of `dispatchEvent` for a `hitLanded`, **before**
candidate selection — so a buff that reads a gauge in a Value Expr sees the
post-hit value.

`DamageEntry.spawn` is the exception: it routes to the Emit Pool's spawn op, not
`accrueForHit`, and is never FR-scaled.

## Accrual on cast

Two **stage-level** fields apply a resource delta on the cast (`skillCast`),
before any hit lands: `concerto` and `forte`. They thread as
`ResolvedStage.concerto` / `ResolvedStage.forte` into the `skillCast` event and
go through `applyResourceDelta` (cap + floor) in the buff engine's cast handler —
**raw**, not FR-scaled (unlike the hit-accrual path above). Negative is a spend,
positive a gain; `forteCap` clamps forte.

This is the home for a cost or mode-resource that the cast commits **regardless of
whether the damage resolves** — an interrupted stage still pays its concerto and
recovers its pistils, because the player entered the mode on cast. It is distinct
from the damage-entry `concerto` / `forte`, which accrue only on a landed hit.

## Caps

Caps live on the `ResourceLedger`, registered at bootstrap: `forteCap → forte`,
`emitPool.cap → pool`. `applyDelta` clamps to the cap and floors at 0; `setValue`
writes verbatim (no clamp, no floor). Energy and concerto register no cap.

The `pool` cap is the deliberate exception — it is registered but **not** enforced
by the ledger clamp. Capacity is enforced by the pool store via FIFO
displacement, because a clamp would silently drop a member instead of converting
it (see [the Emit Pool](#the-pool-resource)).

## Explicit movement: the `resource` effect

A buff moves a resource with `{ kind: "resource", resource, op: "add" | "sub" |
"set", value, target? }`, applied in the pipeline's `resource` phase. `target`
defaults to the buff's target (`"self"` / `"source"` / `"target"`). Only a
`const` Value Expr is honored. `add`/`sub` go through `applyDelta` (cap + floor);
`set` through `setValue`.

## Triggers and conditions

Resource movement drives further dispatch — every write fires the relevant
follow-up event, which can chain more buffs:

- **`resourceCrossed`** `{ resource, threshold, direction }` — fires when a write
  crosses a threshold up or down.
- **`resourceConsumed`** `{ resource }` — fires on any net decrease, threshold-free
  (the faithful "on spend" hook).
- **`resourceStep`** `{ resource, step, direction }` — fires once per `step`
  crossed; the trigger index expands it to a threshold at every multiple (see
  [ADR-0032](adr/0032-pistil-bud-conversion-via-resourcestep-and-scaledbystacks.md)).

A buff gates on a level with the **`resourceAtLeast`** `{ resource, n, on }`
condition. Value Exprs read a live count via `scaledByStat` (e.g. Crit Rate
scaling with Energy Regen).

## Consumption

- **Resonance Liberation** drains energy to 0 on cast. Cost is
  `resonanceCost ?? 100`; `maxEnergy` equals that cost. Casting below cost still
  proceeds but raises an `insufficientEnergy` diagnostic.
- **Outro Skill** drains concerto to 0 on cast. The cost gate is
  `OUTRO_CONCERTO_COST` (100); surplus above it is wasted by the full drain, and
  casting below it raises an `insufficientConcerto` diagnostic
  ([ADR-0031](adr/0031-concerto-consumption-model.md)).

## The pool resource

`pool` is unlike the scalar gauges: it mirrors the size of a per-character
**Emit Pool** — a capacity-bounded FIFO of cancellable Deferred Emits owned by
the `PoolStore` ([ADR-0043](adr/0043-emit-pool-of-cancellable-deferred-emits.md)).

- The store is the single source of truth; the `pool` resource is a **projection**
  its operations keep in sync via `setValue`, so the count always equals the
  member-list length. Pool ops are the resource's sole writer.
- A hit's `spawn: N` pushes N members; each matures into a Synthetic Hit after
  `maturation` frames. A spawn over `cap` displaces the oldest (FIFO), converting
  them early; a `convert` effect matures N (or `"all"`) now. Every member
  converts exactly once.
- Because it is a real `ResourceKind`, the count surfaces in the log and feeds the
  same `resourceAtLeast` / `resourceStep` / `resourceCrossed` machinery as the
  scalar gauges, for free.

## Display

Resource snapshots ride the Simulation Log: every `ActionEvent`, `HitEvent`, and
`SustainEvent` carries `cumulativeEnergy` and `cumulativeConcerto` at its frame.
`ActionEvent` also carries `pool` (omitted when zero). Forte is not surfaced as a
cumulative column today.

## Gotchas

- **Implicit accrual precedes the `resource` phase.** A `hitLanded` has already
  mutated the ledger before any data-authored `resource` effect runs.
- **`setValue` does not clamp or floor.** It is for drains-to-0 and the pool
  projection. Authored `add`/`sub` (which do clamp/floor) are the normal path.
- **Pool is not FR-scaled and never routes through `accrueForHit`.** Spawning
  creates timed entities, not a gauge gain.

## Related

- [stat-table](stat-table.md) — the sibling sheet resources are kept out of
- [buff-engine](buff-engine.md) — the Phase Pipeline and dispatch order
- [CONTEXT.md](../CONTEXT.md) — glossary (Emit Pool, Deferred Emit)
- [ADR-0003: resources separate from stat table](adr/0003-resources-separate-from-stat-table.md)
- [ADR-0031: concerto consumption model](adr/0031-concerto-consumption-model.md)
- [ADR-0032: pistil-bud conversion via resourceStep and scaledByStacks](adr/0032-pistil-bud-conversion-via-resourcestep-and-scaledbystacks.md)
- [ADR-0043: emit pool of cancellable deferred emits](adr/0043-emit-pool-of-cancellable-deferred-emits.md)
