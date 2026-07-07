/** A reference to one of the picked character's stages: the shared solve identity. */
export interface StageRef {
  id: string
  skill: string
  stage: string
  hitCount: number
  /** Registry stage carries `animationFrames`: a cutscene whose timing needs a split. */
  expectsSplit?: boolean
}

// A spacer occupies frames between two real stages (a mid-rotation jump/dodge)
// so their measured `actionTime` isn't inflated by the gap. It carries no
// catalog identity: invisible to the sidebar and export, owns no hits.
export const PLACEHOLDER_ID = "__placeholder__"

export const isPlaceholder = (ref: StageRef): boolean =>
  ref.id === PLACEHOLDER_ID

export function placeholderRef(): StageRef {
  return { id: PLACEHOLDER_ID, skill: "", stage: "spacer", hitCount: 0 }
}
