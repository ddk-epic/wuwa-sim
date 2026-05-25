import type { BuffDef } from "#/types/buff"

export const globalBuffs: BuffDef[] = [
  {
    id: "char.shorekeeper.outro.binary-butterfly",
    name: "Binary Butterfly",
    description: "Outro Skill grants all team members allDeepen +15% for 30s.",
    owner: 1505,
    trigger: {
      event: "skillCast",
      characterId: 1505,
      skillType: "Outro Skill",
    },
    target: { kind: "team" },
    duration: { kind: "seconds", v: 30 },
    effects: [
      {
        kind: "stat",
        path: { stat: "allDeepen" },
        value: { kind: "const", v: 0.15 },
      },
    ],
  },
]
