import { describe, it, expect } from 'vitest'
import { RELEVANT_SKILL_TYPES } from '#/data/skill-types'

describe('RELEVANT_SKILL_TYPES', () => {
  it('includes all UI-relevant skill types', () => {
    expect(RELEVANT_SKILL_TYPES.has('Normal Attack')).toBe(true)
    expect(RELEVANT_SKILL_TYPES.has('Resonance Skill')).toBe(true)
    expect(RELEVANT_SKILL_TYPES.has('Resonance Liberation')).toBe(true)
    expect(RELEVANT_SKILL_TYPES.has('Forte Circuit')).toBe(true)
    expect(RELEVANT_SKILL_TYPES.has('Intro Skill')).toBe(true)
    expect(RELEVANT_SKILL_TYPES.has('Outro Skill')).toBe(true)
    expect(RELEVANT_SKILL_TYPES.has('Tune Break')).toBe(true)
  })

  it('excludes non-UI-relevant skill types', () => {
    expect(RELEVANT_SKILL_TYPES.has('Inherent Skill')).toBe(false)
  })
})
