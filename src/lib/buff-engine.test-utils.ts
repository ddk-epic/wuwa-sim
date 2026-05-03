import type { BuffEngine, BuffEngineInternals } from "./buff-engine"

/**
 * Test-only access to internal stores. Not exported through the public engine
 * type so production callers cannot reach into engine internals.
 */
export function pendingNextOnFieldCount(engine: BuffEngine): number {
  return (
    engine as unknown as BuffEngineInternals
  ).store.pendingNextOnFieldCount()
}
