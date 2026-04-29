import { describe, expect, it } from 'vitest'
import type { DamageEntry } from '../src/types/echo.js'
import { formatStage } from './generate-echo.js'

const noHits: DamageEntry[] = []

describe('formatStage', () => {
  it('emits parenthesised newName for Tap', () => {
    const out = formatStage('Tap', noHits, 1)
    expect(out).toContain("newName: '(Tap)'")
  })

  it('does not emit hidden field for Tap (hidden defaults to false)', () => {
    const out = formatStage('Tap', noHits, 1)
    expect(out).not.toContain('hidden:')
  })

  it('emits parenthesised newName for Hold', () => {
    const out = formatStage('Hold', noHits, 1, true)
    expect(out).toContain("newName: '(Hold)'")
  })

  it('emits hidden: true for Hold when hidden=true', () => {
    const out = formatStage('Hold', noHits, 1, true)
    expect(out).toContain('hidden: true,')
  })
})
