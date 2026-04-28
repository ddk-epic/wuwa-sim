// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from './useLocalStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('useLocalStorage', () => {
  it('returns defaultValue when storage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('key', 42))
    expect(result.current[0]).toBe(42)
  })

  it('reads existing value from storage on mount', () => {
    localStorage.setItem('key', JSON.stringify(99))
    const { result } = renderHook(() => useLocalStorage('key', 0))
    expect(result.current[0]).toBe(99)
  })

  it('setValue with a plain value updates state and persists', () => {
    const { result } = renderHook(() => useLocalStorage('key', 0))
    act(() => {
      result.current[1](7)
    })
    expect(result.current[0]).toBe(7)
    expect(JSON.parse(localStorage.getItem('key')!)).toBe(7)
  })

  it('setValue with an updater function works correctly', () => {
    const { result } = renderHook(() => useLocalStorage('key', 10))
    act(() => {
      result.current[1]((prev) => prev + 5)
    })
    expect(result.current[0]).toBe(15)
    expect(JSON.parse(localStorage.getItem('key')!)).toBe(15)
  })

  it('falls back to defaultValue on malformed JSON', () => {
    localStorage.setItem('key', 'not-valid-json{{{')
    const { result } = renderHook(() => useLocalStorage('key', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('works with object values', () => {
    const defaultVal = { a: 1 }
    const { result } = renderHook(() => useLocalStorage('obj', defaultVal))
    act(() => {
      result.current[1]({ a: 2 })
    })
    expect(result.current[0]).toEqual({ a: 2 })
    expect(JSON.parse(localStorage.getItem('obj')!)).toEqual({ a: 2 })
  })

  it('updater function receives the current persisted value', () => {
    localStorage.setItem('key', JSON.stringify(100))
    const { result } = renderHook(() => useLocalStorage('key', 0))
    act(() => {
      result.current[1]((prev) => prev * 2)
    })
    expect(result.current[0]).toBe(200)
  })
})
