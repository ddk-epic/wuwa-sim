import type { EnrichedSkill } from "#/types/character"

export const DODGE_ACTION_TIME = 21
export const JUMP_ACTION_TIME = 18

export const DODGE_SKILL: EnrichedSkill = {
  id: 9001,
  name: "Dodge",
  type: "Movement",
  stages: [
    {
      name: "Dodge",
      category: "Movement",
      value: "",
      damage: [],
      actionTime: DODGE_ACTION_TIME,
      footing: "either",
    },
  ],
  damage: [],
}

export const JUMP_SKILL: EnrichedSkill = {
  id: 9002,
  name: "Jump",
  type: "Movement",
  stages: [
    {
      name: "Jump",
      category: "Movement",
      value: "",
      damage: [],
      actionTime: JUMP_ACTION_TIME,
      footing: { entry: "ground", exit: "air", commit: 9 },
    },
  ],
  damage: [],
}
