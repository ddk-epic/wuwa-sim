import { describe, expect, it } from 'vitest'
import type { TimelineEntry } from '#/types/timeline'
import { accumulateTime, computeDamage } from './timeline'

function entry(actionTime: number, multiplier = 0): TimelineEntry {
  return {
    id: 'x',
    characterId: 1,
    skillType: 'Normal Attack',
    skillName: 'Normal Attack · Stage 1',
    attackType: 'Basic Attack',
    actionTime,
    multiplier,
  }
}

describe('accumulateTime', () => {
  it('returns empty array for empty input', () => {
    expect(accumulateTime([])).toEqual([])
  })

  it('single entry starts at time 0', () => {
    expect(accumulateTime([entry(5)])).toEqual([0])
  })

  it('accumulates durations across entries', () => {
    expect(accumulateTime([entry(3), entry(5), entry(0)])).toEqual([0, 3, 8])
  })

  it('zero-duration entries do not advance time', () => {
    expect(accumulateTime([entry(0), entry(4)])).toEqual([0, 0])
  })
})

describe('computeDamage', () => {
  it('returns multiplier times maxAtk', () => {
    expect(computeDamage(1.5, 1000)).toBe(1500)
  })

  it('returns 0 when multiplier is 0', () => {
    expect(computeDamage(0, 5000)).toBe(0)
  })

  it('rounds to whole number for large ATK values', () => {
    expect(computeDamage(2.5, 3)).toBe(8)
  })
})
