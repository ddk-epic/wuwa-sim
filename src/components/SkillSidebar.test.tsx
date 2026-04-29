// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SkillSidebar } from './SkillSidebar'
import type { EnrichedCharacter } from '#/types/character'
import type { Slots } from '#/types/loadout'

const char1: EnrichedCharacter = {
  id: 1,
  name: 'Encore',
  element: 'Fusion',
  weaponType: 'Rectifier',
  rarity: '5',
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 0, def: 0 } },
  skills: [
    {
      id: 101,
      name: 'Normal Attack',
      type: 'Normal Attack',
      stages: [
        {
          name: 'Stage 1',
          value: '1',
          actionTime: 0,
          damage: [
            {
              type: 'Basic Attack',
              dmgType: 'Physical',
              scalingStat: 'ATK',
              value: 1.5,
              energy: 0,
              concerto: 0,
              toughness: 0,
              weakness: 0,
            },
          ],
        },
      ],
      damage: [],
    },
    {
      id: 102,
      name: 'Hidden Skill',
      type: 'Normal Attack',
      hidden: true,
      stages: [{ name: 'Hidden Stage', value: '1', actionTime: 0, damage: [] }],
      damage: [],
    },
  ],
}

const char2: EnrichedCharacter = {
  id: 2,
  name: 'Sanhua',
  element: 'Glacio',
  weaponType: 'Sword',
  rarity: '4',
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 0, def: 0 } },
  skills: [
    {
      id: 201,
      name: 'Normal Attack',
      type: 'Normal Attack',
      stages: [{ name: 'Stage 1', value: '1', actionTime: 0, damage: [] }],
      damage: [],
    },
  ],
}

const characters = [char1, char2]

afterEach(cleanup)

describe('SkillSidebar — tab strip', () => {
  it('renders one tab per filled slot', () => {
    const slots: Slots = [1, 2, null]
    render(
      <SkillSidebar
        slots={slots}
        characters={characters}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Encore')).toBeTruthy()
    expect(screen.getByText('Sanhua')).toBeTruthy()
  })

  it('shows skills for the focused character', () => {
    const slots: Slots = [1, 2, null]
    render(
      <SkillSidebar
        slots={slots}
        characters={characters}
        focusedId={2}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    // Sanhua's skill stage should appear in the skill list
    expect(screen.getAllByText('Stage 1').length).toBeGreaterThan(0)
  })

  it('clicking an unfocused tab calls onFocus with that character id', () => {
    const slots: Slots = [1, 2, null]
    const onFocus = vi.fn()
    render(
      <SkillSidebar
        slots={slots}
        characters={characters}
        focusedId={1}
        onFocus={onFocus}
        onStageClick={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Sanhua/ }))
    expect(onFocus).toHaveBeenCalledWith(2)
  })

  it('does not display rarity anywhere', () => {
    const slots: Slots = [1, null, null]
    const { container } = render(
      <SkillSidebar
        slots={slots}
        characters={characters}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(container.textContent).not.toContain('rarity')
    expect(container.textContent).not.toContain(char1.rarity)
  })

  it('falls back to name when newName is empty string', () => {
    const charWithEmptyNewName: EnrichedCharacter = {
      ...char1,
      skills: [
        {
          ...char1.skills[0],
          stages: [{ ...char1.skills[0].stages[0], newName: '' }],
        },
      ],
    }
    render(
      <SkillSidebar
        slots={[1, null, null]}
        characters={[charWithEmptyNewName]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Stage 1')).toBeTruthy()
  })

  it('renders newName instead of name when set on a stage', () => {
    const charWithNewName: EnrichedCharacter = {
      ...char1,
      skills: [
        {
          ...char1.skills[0],
          stages: [{ ...char1.skills[0].stages[0], newName: 'Override Label' }],
        },
      ],
    }
    render(
      <SkillSidebar
        slots={[1, null, null]}
        characters={[charWithNewName]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Override Label')).toBeTruthy()
    expect(screen.queryByText('Stage 1')).toBeNull()
  })

  it('hides skills with hidden: true', () => {
    const slots: Slots = [1, null, null]
    render(
      <SkillSidebar
        slots={slots}
        characters={characters}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.queryByText('Hidden Stage')).toBeNull()
    expect(screen.queryByText('Hidden Skill')).toBeNull()
  })
})
