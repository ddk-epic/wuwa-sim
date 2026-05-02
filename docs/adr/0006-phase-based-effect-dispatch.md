# Phase-based effect dispatch with deterministic lex tiebreak

When a single event fires multiple Buff Instance triggers, their Effects are dispatched in a fixed phase order — `resource → stat → emitHit` — and within each phase, in lexicographic order of `buffDef.id`. Insertion order into the active list does NOT influence dispatch order. This makes simulation output independent of bootstrap timing and re-application history: two equivalent buff catalogs always produce the same Simulation Log.

## Considered Options

- Insertion order — rejected because re-application (refresh) silently changes outcomes when it moves a buff to the end of the list.
- Per-buff `priority` field with stable sort — rejected because it puts the burden of knowing every other buff's priority on every buff author. Silent failure mode when forgotten.

## Consequences

- **Emitted-hit recursion** is bounded: synthetic hits from `emitHit` are queued and processed after the current event's phases complete. A hit-chain depth cap of 8 is enforced, with a console warning on overflow. ICDs on each `emitHit` Effect prevent the cap from being reached in normal use.
- A `consumedBy` decrement step runs as an implicit fifth phase after `emitHit`, allowing decrement-on-use buffs ("next attack guaranteed crit") to consume themselves only after they had a chance to contribute.
