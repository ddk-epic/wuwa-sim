import type { StageVariant, VariantKind } from "#/types/character"

export interface ActionTimeStage {
  actionTime: number
  variants?: Partial<Record<VariantKind, StageVariant>>
}

export function resolveActionTime(
  stage: ActionTimeStage,
  variantKind: VariantKind | undefined,
  reactionDelay: number,
): number {
  if (!variantKind) return stage.actionTime
  const variant = stage.variants?.[variantKind]
  if (!variant) return stage.actionTime
  return variant.actionTime + reactionDelay
}
