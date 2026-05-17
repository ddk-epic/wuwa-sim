import { describe, expect, it } from "vitest"
import {
  DODGE_ACTION_TIME,
  DODGE_SKILL,
  JUMP_ACTION_TIME,
  JUMP_SKILL,
} from "./movement"
import { STAGE_TYPE_LABELS } from "./skill-types"
import { ALL_CHARACTERS } from "./characters/index"

describe("movement constants", () => {
  it("DODGE_ACTION_TIME is 21", () => {
    expect(DODGE_ACTION_TIME).toBe(21)
  })

  it("JUMP_ACTION_TIME is 18", () => {
    expect(JUMP_ACTION_TIME).toBe(18)
  })
})

describe("DODGE_SKILL and JUMP_SKILL", () => {
  it("Dodge has type Movement", () => {
    expect(DODGE_SKILL.type).toBe("Movement")
  })

  it("Jump has type Movement", () => {
    expect(JUMP_SKILL.type).toBe("Movement")
  })

  it("Dodge stage actionTime equals DODGE_ACTION_TIME", () => {
    expect(DODGE_SKILL.stages[0].actionTime).toBe(DODGE_ACTION_TIME)
  })

  it("Jump stage actionTime equals JUMP_ACTION_TIME", () => {
    expect(JUMP_SKILL.stages[0].actionTime).toBe(JUMP_ACTION_TIME)
  })

  it("Dodge stage produces stageId 'Dodge::_' via makeStageId semantics", () => {
    const stage = DODGE_SKILL.stages[0]
    const name = DODGE_SKILL.name
    const newName = stage.newName ?? ""
    const stageId = newName ? `${name}::${newName}` : `${name}::_`
    expect(stageId).toBe("Dodge::_")
  })

  it("Jump stage produces stageId 'Jump::_' via makeStageId semantics", () => {
    const stage = JUMP_SKILL.stages[0]
    const name = JUMP_SKILL.name
    const newName = stage.newName ?? ""
    const stageId = newName ? `${name}::${newName}` : `${name}::_`
    expect(stageId).toBe("Jump::_")
  })
})

describe("STAGE_TYPE_LABELS Movement", () => {
  it("Movement maps to 'MOVE'", () => {
    expect(STAGE_TYPE_LABELS["Movement"]).toBe("MOVE")
  })
})

describe("Movement injection into ALL_CHARACTERS", () => {
  it("every character has Dodge and Jump at the end of skills", () => {
    for (const char of ALL_CHARACTERS) {
      const lastTwo = char.skills.slice(-2)
      expect(lastTwo[0].name).toBe("Dodge")
      expect(lastTwo[1].name).toBe("Jump")
    }
  })

  it("Dodge appears before Jump for every character", () => {
    for (const char of ALL_CHARACTERS) {
      const dodgeIdx = char.skills.findIndex((s) => s.name === "Dodge")
      const jumpIdx = char.skills.findIndex((s) => s.name === "Jump")
      expect(dodgeIdx).toBeGreaterThan(-1)
      expect(jumpIdx).toBeGreaterThan(-1)
      expect(dodgeIdx).toBeLessThan(jumpIdx)
    }
  })

  it("Dodge::_ and Jump::_ stage IDs exist on every character via last two skills", () => {
    for (const char of ALL_CHARACTERS) {
      const dodge = char.skills.find((s) => s.name === "Dodge")
      const jump = char.skills.find((s) => s.name === "Jump")
      expect(dodge?.stages[0].name).toBe("Dodge")
      expect(jump?.stages[0].name).toBe("Jump")
    }
  })
})
