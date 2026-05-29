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

// Map view for lookups keyed by an arbitrary string; `.get` yields `| undefined`.
const LABELS_BY_STRING = new Map<string, string>(
  Object.entries(STAGE_TYPE_LABELS),
)

export function formatSkillType(raw: string): string {
  return LABELS_BY_STRING.get(raw) ?? raw
}
