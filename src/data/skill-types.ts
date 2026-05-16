import type { SkillType } from "#/types/character"

export const STAGE_TYPE_LABELS: Record<SkillType, string> = {
  "Basic Attack": "BASIC",
  "Heavy Attack": "HEAVY",
  "Resonance Skill": "SKILL",
  "Resonance Liberation": "LIBER",
  "Forte Circuit": "FORTE",
  "Intro Skill": "INTRO",
  "Outro Skill": "OUTRO",
  "Echo Skill": "ECHO",
}

export function formatSkillType(raw: string): string {
  return STAGE_TYPE_LABELS[raw as SkillType] ?? raw
}
