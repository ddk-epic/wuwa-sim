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
  | { kind: "missingChainPrereq"; stageId: string; requiredStageIds: string[] }
  | {
      kind: "missingWindowedPrereq"
      stageId: string
      requiredStageIds: string[]
    }
  | { kind: "stageRequiresSequence"; stageId: string; requiredSequence: number }
  | { kind: "swapForcesDifferentChar" }

/**
 * The single catalog of Timeline row message wording. The engine and validator
 * emit structured findings; this is the only place that turns them into English.
 */
export type RowMessage = ValidatorMessage | Diagnostic

function renderStageList(
  stageIds: string[],
  resolveStageName: (stageId: string) => string,
): string {
  return stageIds.map((id) => `"${resolveStageName(id)}"`).join(" or ")
}

export function renderMessage(
  m: RowMessage,
  resolveStageName: (stageId: string) => string,
): string {
  switch (m.kind) {
    // --- Diagnostic (engine runtime findings) ---
    // Actor and current resource value are omitted: both already appear on the
    // timeline row (character cell, resource cells), so the wording carries only
    // the required cost, which the row does not show.
    case "footingViolation":
      return m.isLand
        ? "Airborne state required before a landing stage"
        : "Launch/Jump required before an aerial stage"
    case "footingFall":
      return "Fall padding inserted before a grounded entry"
    case "footingForced":
      return m.footing === "air"
        ? "Air-only mode forces an aerial entry"
        : "Ground-only mode forces a grounded entry"
    case "insufficientEnergy":
      return `Liberation requires ${m.cost} energy`
    case "insufficientConcerto":
      return `Requires ${m.required} Concerto Energy`
    case "insufficientOutroConcerto":
      return `Outro requires ${m.cost} concerto`
    case "skillOnCooldown":
      return `Skill on cooldown for ${m.remaining} more frames`
    case "priorGateWindowClosed":
      return `Follow-up window closed ${m.overshoot} frames ago`

    // --- ValidatorMessage (structural validator findings) ---
    case "introNeedsOutro":
      return "Intro Skill must immediately follow an Outro Skill"
    case "characterNotInTeam":
      return "Character is not in the team"
    case "unknownCharacter":
      return "Unknown character"
    case "stageNotFound":
      return "This skill is no longer available for this character"
    case "missingChainPrereq":
      return `"${resolveStageName(m.stageId)}" must immediately follow ${renderStageList(m.requiredStageIds, resolveStageName)}`
    case "missingWindowedPrereq":
      return `"${resolveStageName(m.stageId)}" requires an earlier ${renderStageList(m.requiredStageIds, resolveStageName)} on this character`
    case "stageRequiresSequence":
      return `"${resolveStageName(m.stageId)}" requires Sequence ${m.requiredSequence}`
    case "swapForcesDifferentChar":
      return "Swap forces the next entry to be a different character"
  }
}
