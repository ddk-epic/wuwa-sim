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
 * Drain emit decisions into their resolved synthetic events, the way the
 * simulation's frame-ordered stream does. Each decision resolves to its synthetic
 * event plus the in-frame DFS chain it spawns, flattened as `[event, ...chain]`.
 * Resolving also applies the synthetic's energy/concerto, so callers asserting on
 * post-emit resources must drain too.
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
 * `engine.onEvent` followed by an immediate drain of its emit decisions, returning
 * the resolved `syntheticEvents` inline. Resolving applies the synthetics' resource
 * gains too, so post-event resource assertions see them. For tests that fire a
 * single event and inspect its synthetics.
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
