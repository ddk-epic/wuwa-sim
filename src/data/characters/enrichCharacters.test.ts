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

  it('applies metadata override to matching skill', () => {
    const [enriched] = enrichCharacters([base], {
      9001: { animationLock: 0.5 },
    })
    expect(enriched.skills[0].animationLock).toBe(0.5)
  })

  it('does not apply metadata to non-matching skill', () => {
    const [enriched] = enrichCharacters([base], {
      9001: { animationLock: 0.5 },
    })
    expect(enriched.skills[1].animationLock).toBeUndefined()
  })

  it('leaves skills with no metadata entry otherwise unchanged', () => {
    const [enriched] = enrichCharacters([base], {})
    expect(enriched.skills[0].name).toBe('Slash')
    expect(enriched.skills[0].type).toBe('Normal Attack')
  })

  it('metadata hidden flag surfaces on skill', () => {
    const [enriched] = enrichCharacters([base], { 9002: { hidden: true } })
    expect(enriched.skills[1].hidden).toBe(true)
    expect(enriched.skills[0].hidden).toBeUndefined()
  })

  it('each stage gets actionTime: 0 by default', () => {
    const [enriched] = enrichCharacters([base], {})
    expect(enriched.skills[0].stages[0].actionTime).toBe(0)
    expect(enriched.skills[1].stages[0].actionTime).toBe(0)
  })

  it('stageOverrides with matching stage name applies actionTime', () => {
    const [enriched] = enrichCharacters([base], {
      9001: { stageOverrides: { 'Stage 1': { actionTime: 30 } } },
    })
    expect(enriched.skills[0].stages[0].actionTime).toBe(30)
  })

  it('stageOverrides does not affect non-matching stage names', () => {
    const [enriched] = enrichCharacters([base], {
      9001: { stageOverrides: { 'Stage 2': { actionTime: 30 } } },
    })
    expect(enriched.skills[0].stages[0].actionTime).toBe(0)
  })
})
