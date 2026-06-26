# Buff Engine

`BuffEngine` is the state machine that coordinates buff lifecycle, resource changes, on-field tracking, synthetic hit emission, and per-hit Stat Table composition. It receives authored events (`skillCast`, `hitLanded`, `swapIn`/`swapOut`, `simStart`, `resourceCrossed`), selects matching buff candidates, and routes them through a fixed phase pipeline. It composes its internal modules rather than owning their state directly.

**Source files:** `src/lib/engine/buff-engine.ts`, `src/lib/engine/instance-store.ts`, `src/lib/engine/emit-hit-dispatcher.ts`, `src/lib/engine/on-field-tracker.ts`, `src/lib/engine/resource-ledger.ts`, `src/lib/engine/stat-table-builder.ts`, `src/lib/engine-bootstrap.ts`

## How it works

### Composition

- **`InstanceStore`** — active buff instances, the pending-nextOnField queue, trigger matching, cooldown bookkeeping
- **`ResourceLedger`** — per-character Energy / Concerto / Forte / Pool counters (see [resources](resources.md))
- **`PoolStore`** — per-character Emit Pool: the FIFO of Deferred Emits the `pool` resource projects
- **`OnFieldTracker`** — current on-field character; swap inference
- **`EmitHitDispatcher`** — synthetic hit firing with ICD
- **`StatTableBuilder`** — base stats + per-hit `stat`-effect accumulation
- **`FootingModule`** — ground/air footing per character, swap-back carry
- **`Target`** — target params + Negative Statuses
- **`TriggerIndex`** / **`ConditionEvaluator`** — triggerable-def lookup and condition evaluation against the engine's world

`engine-bootstrap.ts` seeds the engine: it resolves each slot's loadout into base stats and pushes permanent instances for passives, weapon effects, and echo set bonuses.

### Event dispatch

`dispatchEvent(event)` runs in this order:

1. **Implicit resource updates first.** Energy from hits (including shared energy to teammates) and Resonance-Liberation energy drain are applied to the Resource Ledger _before_ candidate selection. The `resource` phase below only handles explicit movements declared by buff defs.
2. **Candidate selection.** `InstanceStore.findCandidates` iterates triggerable buff defs, runs `matchesTrigger`, filters by per-buff `cooldownLastFired`, and evaluates conditions early for emitHit-only and `target: "nextOnField"` buffs (no persistent instance exists later to evaluate against). Survivors are sorted by `buffDef.id` lexicographically.
3. **Phase pipeline.** Each phase iterates the full candidate list before the next phase begins.

### Phase pipeline

Order is a data value, not inline control flow (see [ADR-0006](adr/0006-phase-based-effect-dispatch.md)):

1. **`resource`** — apply `kind: "resource"` effects. Resource caps emit recursive `resourceCrossed` events.
2. **`stat`** — `target: "nextOnField"` candidates push onto `pendingNextOnField`. Other candidates resolve target ids and call `InstanceStore.applyBuff`, which creates or refreshes an instance per its stacking policy (`ignore` / `refresh` / `addStackRefresh` / `addStackKeep` / `addStackIndependent` / `replace`).
3. **`negStatus`** — apply `kind: "negStatus"` / `negStatusMod` effects to the `Target` (apply / reduce / raise-to-max / raise-cap), scheduling the first tick and firing `negStatusInflicted`.
4. **`emitHit`** — for each `kind: "emitHit"` effect, the dispatcher takes the emit decision (ICD + chain-depth cap) at the trigger frame. A top-level or offset emit surfaces a `DeferredEmit` at `frame + actionFrame` for the simulation to resolve in frame order (ADR-0028); only an in-frame chain emit (depth ≥ 1, offset 0) resolves inline, firing its own `hitLanded` (incremented depth) to chain further triggers.
5. **`coordHit`** — like `emitHit` through the same ICD gate, but a coord emit carries no landing offset (it lands at the trigger frame) and never chains: synthetic coord hits are not re-entered into the trigger matcher.
6. **`convert`** — `kind: "convert"` effects mature N (or `"all"`) held Emit Pool members now, oldest-first, surfacing each as a `DeferredEmit` and keeping the `pool` resource in sync (see [resources](resources.md), [ADR-0043](adr/0043-emit-pool-of-cancellable-deferred-emits.md)).
7. **`consume`** — `InstanceStore.runConsumePhase` decrements stacks on instances whose `consumedBy` filter matches the event; instances at zero stacks are removed (`buffConsumed`).
8. **`removeBuffs`** — `kind: "removeBuffs"` effects remove active instances by buff id (`InstanceStore.removeBuffsById`).

### Instance lifecycle

- **Apply** — `applyBuff` creates a new instance (pushes to `active`, emits `buffApplied`) or refreshes an existing one (updates `endTime`, mutates stacks per policy).
- **Expire** — `tickToFrame` removes instances whose `endTime ≤ frame` (emits `buffExpired`). `expireOnSourceSwapOut` removes instances flagged to die when their source character leaves the field.
- **Pending nextOnField** — stored in `pendingNextOnField`; on `swapIn`, `drainPendingNextOnField` materializes them onto the incoming character via `applyBuff` (see [ADR-0013](adr/0013-outro-pending-buff-queue-on-buff-engine.md)).
- **Consume** — handled by the `consume` phase above.

### Stat table snapshot

`resolveHit(frame, …)` ticks expirations to `frame`, then walks active instances whose condition currently passes. Stat-effect conditions are evaluated lazily here (per `resolveStats` call), not at instance-creation time. The result is the Stat Table consumed by `compute-damage`.

Resolution runs in two passes (see [stat-table § Intrinsic vs derived resolution](stat-table.md#intrinsic-vs-derived-resolution)): `resolveIntrinsicStats` folds base stats and every non-`scaledByStat` buff, then `resolveStats` applies `scaledByStat` effects on top, reading the _intrinsic_ table of the referenced character. The derived pass reads intrinsic tables only, so a `scaledByStat` lookup can never re-enter stat resolution — no recursion guard exists.

## Gotchas

- **Condition evaluation timing differs by effect kind.** Stat effects on persistent instances are evaluated lazily at every `resolveStats` call. EmitHit-only and `nextOnField` buffs evaluate their condition once, at trigger time during candidate selection, because no instance exists to re-evaluate later (see [ADR-0011](adr/0011-emithit-condition-checked-at-candidate-selection.md)).
- **Implicit energy applies before candidate selection.** A `hitLanded` event has already mutated the Resource Ledger by the time the `resource` phase runs. Buffs that read energy in a Value Expr see the post-hit value.
- **Synthetic hits are invisible to most triggers by default.** `matchesTrigger` defaults `trigger.source` to `"self"`, which excludes synthetic hits (`synthetic: true`). Buffs intended to chain off coordinated-attack hits must opt in with `source: "synthetic"` or `"any"`.
- **Cooldown only updates on successful candidacy.** `cooldownLastFired` is set during `findCandidates` only when a buff passes filtering and enters the pipeline. A buff that fails its trigger filter does not have its cooldown stamped — the next matching event still sees a fresh cooldown.
- **Conditional `simStart` permanent instances contribute silently — no log rows.** A `simStart` + `permanent` buff _with_ a `condition` is injected at bootstrap via `pushPermanentInstance` (engine-bootstrap.ts), bypassing `applyBuff` entirely. It contributes its stat effects whenever its condition passes (it shows up in the per-hit `activeBuffs` snapshot), but it never emits `buffApplied`/`buffExpired` rows, because those come only from `applyBuff` during dispatch. So in the Simulation Log it appears "active" on hits yet has no lifecycle row marking when it switched on. If a buff genuinely tracks a discrete, time-boxed window (e.g. Encore's Angry Cosmos, gated on the 10s Cosmos Rave liberation window), prefer authoring it as a real triggered buff — fire off the same event that opens the window, with a matching `duration` — so it produces proper lifecycle rows. Reserve the conditional-permanent shape for genuinely continuous predicates with no natural trigger+duration (e.g. Stringmaster's `actorIsOffField` off-field ATK).

## Related

- [engine-overview](engine-overview.md)
- [CONTEXT.md § The buff system](../CONTEXT.md#the-buff-system)
- [LANGUAGE.md](../LANGUAGE.md)
- [ADR-0001: buff system as unified modifier pipeline](adr/0001-buff-system-as-unified-modifier-pipeline.md)
- [ADR-0002: structured trigger over closed event taxonomy](adr/0002-structured-trigger-over-closed-event-taxonomy.md)
- [ADR-0004: buff instance dedupe by id and target](adr/0004-buff-instance-dedupe-by-id-and-target.md)
- [ADR-0006: phase-based effect dispatch](adr/0006-phase-based-effect-dispatch.md)
- [ADR-0011: emitHit condition checked at candidate selection](adr/0011-emithit-condition-checked-at-candidate-selection.md)
- [ADR-0013: outro pending buff queue on buff engine](adr/0013-outro-pending-buff-queue-on-buff-engine.md)
