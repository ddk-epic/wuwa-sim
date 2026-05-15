# Outro-pending buff queue lives on the Buff Engine

`nextOnField` Buff Defs (used exclusively by Outro Skills — Sanhua's Silversnow, Impermanence Heron, etc.) defer materialization until the next `swapIn` event so the resulting Buff Instance targets the incoming character and its duration anchors to swap-in time, not to outro cast time.

The pending queue is owned by the Buff Engine directly and drained at `swapIn` before normal candidate matching. The Instance Store no longer carries `pendingNextOnField` state and no longer treats `nextOnField` as a target kind it knows about.

```
event = outro skillCast
  → applyOrDefer(silversnow, sourceCharacterId=sanhua, frame=100)
    → def.target.kind === "nextOnField"
    → engine.deferOutroBuff(def, sourceCharacterId, frame=100)
  pending = [{ def: silversnow, sourceCharacterId: sanhua, triggerFrame: 100 }]

event = swapIn(verina, frame=130)
  → engine.materializePending(swapIn) [runs first, before candidate matching]
    → for each pending: store.applyBuff(def, sourceCharacterId, target=verina, frame=130)
    → BuffInstance(silversnow, target=verina, endTime=130 + 14*60) created
  → findCandidates(swapIn) … phase pipeline
```

`applyOrDefer` is the single dispatch point used by every phase that applies a buff (`runStatPhase`, and trivially `runResourcePhase` / `runEmitHitPhase` though no current outro buff uses non-stat effects). The dispatch on `target.kind` lives in one helper rather than in per-phase branches.

The condition gate fires at trigger time (preserving ADR-0011 semantics): a `nextOnField` def with a false condition at outro time never enters the pending queue. Outro entry validity (was the cast legal — Concerto threshold, etc.) is enforced upstream by the Timeline authoring layer, not by the buff condition.

If the simulation ends with pending entries unresolved (no swap-in followed an outro), they are silently dropped. No warning, no error.

## Considered Options

- **Status quo (queue lives in Instance Store, special branch in `runStatPhase`).** Rejected: target kind leaks into `resolveTargetIds` as a sentinel `[]`; the special branch only handles the stat phase, so any future `nextOnField` resource/emitHit effect would silently no-op; queue inspection forces a test-only public method on the Store.
- **Decompose `nextOnField` into two coordinated buffs (presence tag on outro + `swapIn`-triggered reaction gated by tag), per the Coordinated Attack idiom.** Rejected: at the projected scale (every non-DPS character ships at least one outro buff, ~20+), authoring overhead doubles. The deferred-application primitive carries its weight when it's used 20+ times.
- **Compile-time desugar (author as `nextOnField`, compile to two buffs at bootstrap).** Rejected on the same scale grounds plus the extra primitives required (consumed-by-event expiry, derived buff IDs).
- **Generalize to a `ReleasePredicate` union (`nextSwapInOfElement`, etc.).** Rejected (YAGNI): only the outro pattern is in scope. Generalize when a second consumer arrives.
- **Store the actual `BuffInstance` with `targetCharacterId: null`, patch at swap-in.** Rejected: weakens the `BuffInstance` invariant ("live, active occurrence" — has a target), forces a null branch on every consumer, breaks the `(buffDef.id, target.characterId)` dedup key (ADR-0004), collides with `expiresOnSourceSwapOut` (the outro source IS the character swapping out, so a pending instance would be expired before materialization), and adds branching to the per-hit `resolveStats` hot path. Pending applications and live buff instances are different concepts; modeling them with two types preserves invariants.

## Consequences

- `InstanceStore`: deletes `pendingNextOnField`, `pushPendingNextOnField`, `drainPendingNextOnField`, `pendingNextOnFieldCount`, and the `case "nextOnField": return []` branch in `resolveTargetIds`. `resolveTargetIds` only handles target kinds it can actually resolve.
- `BuffEngine`: gains a private `pendingOutroBuffs` field, a `deferOutroBuff` method, an `applyOrDefer` helper, and a `materializePending(swapInEvent)` method called at the top of `processEvent` for `swapIn` events.
- `runStatPhase` loses its `if (def.target.kind === "nextOnField")` branch; calls `applyOrDefer` uniformly.
- `nextOnField` is now scoped semantically as "outro pending" — non-outro uses are not supported and not on the roadmap.
- `BuffInstance` invariants are unchanged (still has a concrete `targetCharacterId` and `endTime` from creation).
