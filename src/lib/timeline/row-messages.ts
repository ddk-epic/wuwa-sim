import type { Diagnostic } from "#/types/simulation-log"

/**
 * A structural finding from the Timeline validator. Stage IDs are carried raw —
 * the catalog does no name resolution.
 */
export type ValidatorMessage =
  | { kind: "introNeedsOutro" }
  | { kind: "characterNotInTeam" }
  | { kind: "unknownCharacter" }
  | { kind: "stageNotFound"; stageId: string }
  | { kind: "missingChainPrereq"; stageId: string; requiredStageId: string }
  | { kind: "missingWindowedPrereq"; stageId: string; requiredStageId: string }
  | { kind: "swapForcesDifferentChar" }

/**
 * The single catalog of Timeline row message wording. The engine and validator
 * emit structured findings; this is the only place that turns them into English.
 */
export type RowMessage = ValidatorMessage | Diagnostic

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
    case "introNeedsOutro":
      return "Intro Skill must immediately follow an Outro Skill"
    case "characterNotInTeam":
      return "Character is not in the team"
    case "unknownCharacter":
      return "Unknown character"
    case "stageNotFound":
      return `Stage "${m.stageId}" not found`
    case "missingChainPrereq":
      return `Stage "${m.stageId}" requires "${m.requiredStageId}" to immediately precede it`
    case "missingWindowedPrereq":
      return `Stage "${m.stageId}" requires a prior "${m.requiredStageId}" on the same character`
    case "swapForcesDifferentChar":
      return "Swap forces the next entry to be a different character"
  }
}
