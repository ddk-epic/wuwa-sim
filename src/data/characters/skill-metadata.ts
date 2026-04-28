import type { SkillMetadata } from '#/types/character'

export const SKILL_METADATA: Record<string, SkillMetadata[]> = {
  Sanhua: [
    {
      name: 'Frigid Light',
      stages: [
        {
          name: 'Stage 1 DMG',
          actionTime: 30,
        },
        {
          name: 'Stage 2 DMG',
          actionTime: 0,
        },
        {
          name: 'Stage 3 DMG',
          actionTime: 0,
        },
        {
          name: 'Stage 4 DMG',
          actionTime: 0,
        },
        {
          name: 'Stage 5 DMG',
          actionTime: 0,
        },
        {
          name: 'Heavy Attack DMG',
          actionTime: 0,
        },
        {
          name: 'Mid-air Attack DMG',
          actionTime: 0,
        },
        {
          name: 'Dodge Counter DMG',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Eternal Frost',
      stages: [
        {
          name: 'Skill DMG',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Glacial Gaze',
      stages: [
        {
          name: 'Skill DMG',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Freezing Thorns',
      stages: [
        {
          name: 'Skill DMG',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Clarity of Mind',
      stages: [
        {
          name: 'Detonate Damage',
          actionTime: 0,
        },
        {
          name: 'Glacier Burst Damage',
          actionTime: 0,
        },
        {
          name: 'Ice Prism Burst Damage',
          actionTime: 0,
        },
        {
          name: 'Ice Thorn Burst Damage',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Condensation',
      stages: [],
    },
    {
      name: 'Avalanche',
      stages: [],
    },
    {
      name: 'Silversnow',
      stages: [],
    },
  ],
  Encore: [
    {
      name: 'Wooly Attack',
      stages: [
        {
          name: 'Stage 1 DMG',
          actionTime: 0,
        },
        {
          name: 'Stage 2 DMG',
          actionTime: 0,
        },
        {
          name: 'Stage 3 DMG',
          actionTime: 0,
        },
        {
          name: 'Stage 4 DMG',
          actionTime: 0,
        },
        {
          name: 'Woolies Damage',
          actionTime: 0,
        },
        {
          name: 'Heavy Attack DMG',
          actionTime: 0,
        },
        {
          name: 'Mid-air Attack',
          actionTime: 0,
        },
        {
          name: 'Dodge Counter DMG',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Flaming Woolies',
      stages: [
        {
          name: 'Flaming Woolies Damage',
          actionTime: 0,
        },
        {
          name: 'Energetic Welcome Damage',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Cosmos Rave',
      stages: [
        {
          name: 'Cosmos: Frolicking Stage 1 DMG',
          actionTime: 0,
        },
        {
          name: 'Cosmos: Frolicking Stage 2 DMG',
          actionTime: 0,
        },
        {
          name: 'Cosmos: Frolicking Stage 3 DMG',
          actionTime: 0,
        },
        {
          name: 'Stage 4 DMG',
          actionTime: 0,
        },
        {
          name: 'Cosmos: Heavy Attack DMG',
          actionTime: 0,
        },
        {
          name: 'Cosmos Rampage Damage',
          actionTime: 0,
        },
        {
          name: 'Cosmos: Dodge Counter DMG',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Woolies Helpers',
      stages: [
        {
          name: 'Skill DMG',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Black & White Woolies',
      stages: [
        {
          name: 'Cloudy Frenzy Damage',
          actionTime: 0,
        },
        {
          name: 'Cosmos Rupture Damage',
          actionTime: 0,
        },
      ],
    },
    {
      name: 'Angry Cosmos',
      stages: [],
    },
    {
      name: 'Woolies Cheer Dance',
      stages: [],
    },
    {
      name: 'Skillful Cooking',
      stages: [],
    },
    {
      name: 'Thermal Field',
      stages: [],
    },
  ],
}
