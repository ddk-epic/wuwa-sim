// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimeline } from './useTimeline'

const sample = {
  characterId: 1,
  skillType: 'Normal Attack',
  skillName: 'Normal Attack · Stage 1',
  attackType: 'Basic Attack',
  duration: 3,
  multiplier: 1.5,
}

describe('useTimeline', () => {
  it('addEntry appends with correct fields', () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0]).toMatchObject(sample)
    expect(typeof result.current.entries[0].id).toBe('string')
    expect(result.current.entries[0].id.length).toBeGreaterThan(0)
  })

  it('two addEntry calls preserve insertion order', () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry({ ...sample, skillName: 'Skill A' })
      result.current.addEntry({ ...sample, skillName: 'Skill B' })
    })
    expect(result.current.entries[0].skillName).toBe('Skill A')
    expect(result.current.entries[1].skillName).toBe('Skill B')
  })

  it('removeEntry removes only the targeted entry', () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
      result.current.addEntry({ ...sample, skillName: 'Other' })
    })
    const idToRemove = result.current.entries[0].id
    act(() => {
      result.current.removeEntry(idToRemove)
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].skillName).toBe('Other')
  })

  it('each addEntry produces a distinct id', () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
      result.current.addEntry(sample)
      result.current.addEntry(sample)
    })
    const ids = result.current.entries.map((e) => e.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('clearTimeline resets entries to empty array', () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
      result.current.addEntry(sample)
    })
    expect(result.current.entries).toHaveLength(2)
    act(() => {
      result.current.clearTimeline()
    })
    expect(result.current.entries).toHaveLength(0)
  })
})
