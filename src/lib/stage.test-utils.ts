import type { ResolvedStage } from "./stage"

/**
 * Builds a structurally-valid {@link ResolvedStage} for tests. All required
 * fields get inert defaults; pass `overrides` to set the ones a test cares
 * about (commonly `stage.footing` or `stage.variants`).
 */
export function makeResolvedStage(
  overrides: Partial<ResolvedStage> = {},
): ResolvedStage {
  return {
    stage: { actionTime: 0 },
    stageId: "test-stage",
    stageName: "Test Stage",
    element: "Fusion",
    concerto: 0,
    damage: [],
    skillGrouping: "Normal Attack",
    skillCategory: "Basic Attack",
    skillType: "Basic Attack",
    skillName: "Test",
    ...overrides,
  }
}
