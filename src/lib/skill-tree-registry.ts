import type { BuffDef, StatPath } from "#/types/buff"

const ELEMENTS = ["Fusion", "Glacio", "Electro", "Aero", "Havoc", "Spectro"]

interface CompileContext {
  characterId: number
  characterElement: string
}

const FLAT_VALUE_BY_NAME: Record<string, { path: StatPath; v: number }> = {
  ATK: { path: { stat: "atkPct" }, v: 0.12 },
  HP: { path: { stat: "hpPct" }, v: 0.12 },
  DEF: { path: { stat: "defPct" }, v: 0.12 },
  "Crit. Rate": { path: { stat: "critRate" }, v: 0.08 },
  "Crit. DMG": { path: { stat: "critDmg" }, v: 0.16 },
}

export function compileSkillTreeNode(
  nodeName: string,
  ctx: CompileContext,
): BuffDef | null {
  const elementMatch = ELEMENTS.find((e) => nodeName === `${e} DMG Bonus`)
  if (elementMatch) {
    return {
      id: `skill-tree.${ctx.characterId}.${nodeName}`,
      name: nodeName,
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: elementMatch },
          value: { kind: "const", v: 0.12 },
        },
      ],
    }
  }

  const flat = FLAT_VALUE_BY_NAME[nodeName]
  if (flat) {
    return {
      id: `skill-tree.${ctx.characterId}.${nodeName}`,
      name: nodeName,
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: flat.path,
          value: { kind: "const", v: flat.v },
        },
      ],
    }
  }

  return null
}
