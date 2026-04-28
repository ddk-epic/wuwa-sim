import { describe, expect, it } from 'vitest'
import { enrichCharacters } from './enrichCharacters'
import type { Character } from '#/types/character'

const base: Character = {
  id: 1,
  name: 'Test',
  element: 'Fusion',
  weaponType: 'Sword',
  rarity: 'SR',
  stats: { base: { hp: 1, atk: 1, def: 1 }, max: { hp: 1, atk: 1, def: 1 } },
  skills: [
    {
      id: 9001,
      name: 'Slash',
      type: 'Normal Attack',
      stages: [{ name: 'Stage 1', value: '50%', staCost: 10 }],
      damage: [],
    },
    {
      id: 9002,
      name: 'Guard',
      type: 'Skill',
      stages: [{ name: 'Stage 1', value: '30%' }],
      damage: [],
    },
  ],
}

describe('enrichCharacters', () => {
  it('strips staCost from every stage', () => {
    const [enriched] = enrichCharacters([base], {})
    expect(enriched.skills[0].stages[0]).not.toHaveProperty('staCost')
    expect(enriched.skills[1].stages[0]).not.toHaveProperty('staCost')
  })

  it('skill metadata matched by character name and skill name', () => {
    const [enriched] = enrichCharacters([base], {
      Test: [{ name: 'Slash', hidden: true, stages: [] }],
    })
    expect(enriched.skills[0].hidden).toBe(true)
  })

  it('skill metadata does not apply to unmatched skill names', () => {
    const [enriched] = enrichCharacters([base], {
      Test: [{ name: 'Slash', hidden: true, stages: [] }],
    })
    expect(enriched.skills[1].hidden).toBeUndefined()
  })

  it('leaves skills with no metadata entry otherwise unchanged', () => {
    const [enriched] = enrichCharacters([base], {})
    expect(enriched.skills[0].name).toBe('Slash')
    expect(enriched.skills[0].type).toBe('Normal Attack')
  })

  it('metadata hidden flag surfaces on skill', () => {
    const [enriched] = enrichCharacters([base], {
      Test: [{ name: 'Guard', hidden: true, stages: [] }],
    })
    expect(enriched.skills[1].hidden).toBe(true)
    expect(enriched.skills[0].hidden).toBeUndefined()
  })

  it('each stage gets actionTime: 0 by default', () => {
    const [enriched] = enrichCharacters([base], {})
    expect(enriched.skills[0].stages[0].actionTime).toBe(0)
    expect(enriched.skills[1].stages[0].actionTime).toBe(0)
  })

  it('stage metadata applies actionTime by stage name', () => {
    const [enriched] = enrichCharacters([base], {
      Test: [{ name: 'Slash', stages: [{ name: 'Stage 1', actionTime: 30 }] }],
    })
    expect(enriched.skills[0].stages[0].actionTime).toBe(30)
  })

  it('stage metadata does not affect non-matching stage names', () => {
    const [enriched] = enrichCharacters([base], {
      Test: [{ name: 'Slash', stages: [{ name: 'Stage 2', actionTime: 30 }] }],
    })
    expect(enriched.skills[0].stages[0].actionTime).toBe(0)
  })

  it('stage-level hidden surfaces on stage', () => {
    const [enriched] = enrichCharacters([base], {
      Test: [{ name: 'Slash', stages: [{ name: 'Stage 1', hidden: true }] }],
    })
    expect(enriched.skills[0].stages[0].hidden).toBe(true)
  })
})
