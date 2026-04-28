export interface TimelineEntry {
  id: string
  characterId: number
  skillType: string
  skillName: string
  attackType: string
  /** Duration of this action in frames (60 fps). Integer. */
  actionTime: number
  multiplier: number
}
