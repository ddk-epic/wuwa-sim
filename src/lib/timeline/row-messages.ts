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
    // --- Diagnostic (engine runtime findings) ---
    // Actor and current resource value are omitted: both already appear on the
    // timeline row (character cell, resource cells), so the wording carries only
    // the required cost, which the row does not show.
    case "footingViolation":
      return m.isLand
        ? "Airborne state required before a landing stage"
        : "Launch/Jump required before an aerial stage"
    case "insufficientEnergy":
      return `Liberation requires ${m.cost} energy`
    case "insufficientConcerto":
      return `Outro requires ${m.cost} concerto`

    // --- ValidatorMessage (structural validator findings) ---
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
