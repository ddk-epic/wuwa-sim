import type { Diagnostic } from "#/types/simulation-log"

/**
 * The single catalog of Timeline row message wording. The engine and validator
 * emit structured findings; this is the only place that turns them into English.
 */
export type RowMessage = Diagnostic

export function renderMessage(m: RowMessage): string {
  switch (m.kind) {
    case "footingViolation":
      return m.isLand
        ? "Nothing to land from — not currently airborne"
        : "Launch/Jump required before an aerial stage"
    case "insufficientEnergy":
      return `${m.actor} cast Liberation below cost (${Math.floor(m.energy)} / ${m.cost} energy)`
    case "insufficientConcerto":
      return `${m.actor} cast Outro below cost (${Math.floor(m.concerto)} / ${m.cost} concerto)`
  }
}
