import type { BuffEngine, BuffEngineInternals } from "./buff-engine"
import type { DeferredEmit } from "./emit-hit-dispatcher"
import type { HitEvent, SustainEvent } from "#/types/simulation-log"

/**
 * Test-only access to internal stores. Not exported through the public engine
 * type so production callers cannot reach into engine internals.
 */
export function pendingNextOnFieldCount(engine: BuffEngine): number {
  return (engine as unknown as BuffEngineInternals).pendingOutroBuffs.length
}

/**
 * Drain emit *decisions* into their resolved synthetic events, the way the
 * simulation's frame-ordered stream does (ADR-0028 first-class events). After the
 * narrowing, `onEvent`/`recordHit`/`recordHeal` return only `deferredEmits` (the
 * decision to emit), never resolved events — so engine-level tests resolve them
 * here and assert on the result, exactly as they once read `.syntheticEvents`.
 *
 * Each decision resolves to its synthetic event plus the in-frame DFS chain it
 * spawns (`resolveDeferredEmit` runs that chain inline); the flattened order
 * `[event, ...chain]` matches the old eager emission order. Resolving also applies
 * the synthetic's energy/concerto, so callers asserting on post-emit resources
 * must drain too. The FIFO queue mirrors emission order for the offset-0 emits
 * these tests use; offset emits (which the simulation frame-sorts) do not appear.
 */
export function drainSynthetics(
  engine: BuffEngine,
  deferredEmits: DeferredEmit[],
): (HitEvent | SustainEvent)[] {
  const out: (HitEvent | SustainEvent)[] = []
  const queue = [...deferredEmits]
  while (queue.length > 0) {
    const next = queue.shift() as DeferredEmit
    const r = engine.resolveDeferredEmit(next)
    out.push(r.event, ...r.syntheticEvents)
    queue.push(...r.deferredEmits)
  }
  return out
}

/**
 * `engine.onEvent` followed by an immediate drain of its emit decisions —
 * reproducing the pre-narrowing shape where `onEvent` returned resolved
 * `syntheticEvents` inline (ADR-0028). Resolving applies the synthetics' resource
 * gains too, so post-event resource assertions see them, matching the old eager
 * path. Use this in tests that fire a single event and inspect its synthetics;
 * the simulation itself drains the stream in frame order across entries instead.
 */
export function onEventResolved(
  engine: BuffEngine,
  event: Parameters<BuffEngine["onEvent"]>[0],
): {
  lifecycleEvents: ReturnType<BuffEngine["onEvent"]>["lifecycleEvents"]
  deferredEmits: DeferredEmit[]
  syntheticEvents: (HitEvent | SustainEvent)[]
} {
  const r = engine.onEvent(event)
  return {
    lifecycleEvents: r.lifecycleEvents,
    deferredEmits: r.deferredEmits,
    syntheticEvents: drainSynthetics(engine, r.deferredEmits),
  }
}
