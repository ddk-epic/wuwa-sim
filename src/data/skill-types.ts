import type { SkillGrouping, SkillType } from "#/types/character"

export const STAGE_TYPE_LABELS: Record<SkillType | SkillGrouping, string> = {
  "Basic Attack": "BASIC",
  "Heavy Attack": "HEAVY",
  "Resonance Skill": "SKILL",
  "Resonance Liberation": "LIBER",
  "Forte Circuit": "FORTE",
  "Intro Skill": "INTRO",
  "Outro Skill": "OUTRO",
  "Echo Skill": "ECHO",
  Movement: "MOVE",
  "Normal Attack": "NORMAL",
  "Inherent Skill": "INHERENT",
  "Tune Break": "TUNE",
}

export function formatSkillType(raw: string): string {
  return (STAGE_TYPE_LABELS as Record<string, string | undefined>)[raw] ?? raw
}
