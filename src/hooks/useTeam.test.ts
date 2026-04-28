// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTeam } from './useTeam'

describe('useTeam — focusCharacter', () => {
  it('focusCharacter updates focusedId to the given id', () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1)
      result.current.toggleCharacter(2)
    })
    act(() => {
      result.current.focusCharacter(1)
    })
    expect(result.current.focusedId).toBe(1)
  })

  it('focusCharacter can switch focus back and forth', () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1)
      result.current.toggleCharacter(2)
    })
    act(() => {
      result.current.focusCharacter(1)
    })
    expect(result.current.focusedId).toBe(1)
    act(() => {
      result.current.focusCharacter(2)
    })
    expect(result.current.focusedId).toBe(2)
  })
})
