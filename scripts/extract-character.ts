import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type {
  Character,
  CharacterBuffNames,
  CharacterStats,
  DamageEntry,
  Skill,
  SkillAttribute,
  SkillCategory,
  SkillGrouping,
  SkillType,
  StatGroup,
} from "../src/types/character.js"

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const BASE_URL = "https://api-v2.encore.moe/api/en"

// --- API shape ---

interface ApiGrowthValue {
  growthId: number
  level: number
  value: number
}

interface ApiProperty {
  Name: string
  BaseValue: number
  GrowthValues: ApiGrowthValue[]
}

export interface ApiSkillAttribute {
  attributeId: number
  attributeName: string
  values: string[]
  Description: string
}

export interface ApiDamageEntry {
  EntryNumber: number
  Id: number
  Condition: string
  Type: string
  DmgType?: string
  PropertyName: string
  RateLv: string[]
  Energy: number[]
  ElementPower: number[]
  ToughLv: number[]
  WeaknessLvl: number[]
}

interface ApiSkill {
  SkillId: number
  SkillType: string
  SkillName: string
  SkillDescribe: string
  SkillAttributes: ApiSkillAttribute[]
  DamageList: ApiDamageEntry[]
}

interface ApiSkillTreeNode {
  PropertyNodeTitle?: string
}

interface ApiResonantChainNode {
  NodeName: string
  GroupIndex: number
  AttributesDescription: string
}

interface ApiCharacter {
  Id: number
  Name: { Title: string; Content: string }
  ElementName: string
  WeaponType: number
  QualityName: string
  Properties: ApiProperty[]
  Skills: ApiSkill[]
  SkillTree: ApiSkillTreeNode[]
  ResonantChain: ApiResonantChainNode[]
}

// --- Mapping ---

const WEAPON_TYPE_MAP: Record<number, string> = {
  1: "Broadblade",
  2: "Sword",
  3: "Pistols",
  4: "Gauntlets",
  5: "Rectifier",
}

const STAT_KEY_MAP: Record<string, keyof StatGroup> = {
  HP: "hp",
  ATK: "atk",
  DEF: "def",
}

function mapStats(properties: ApiProperty[]): CharacterStats {
  const base = {} as StatGroup
  const max = {} as StatGroup

  for (const prop of properties) {
    const key = STAT_KEY_MAP[prop.Name]
    if (!key) continue // only hp/atk/def are stored as base/max growth stats
    base[key] = prop.BaseValue
    const maxGrowth = prop.GrowthValues[prop.GrowthValues.length - 1]
    max[key] = maxGrowth.value
  }

  return { base, max }
}

function parseValue(rateStr: string): number {
  const pct = rateStr.replace("%", "")
  const decimals = (pct.split(".")[1]?.length ?? 0) + 2
  return Number((parseFloat(pct) / 100).toFixed(decimals))
}

function mapDamageEntries(damageList: ApiDamageEntry[]): DamageEntry[] {
  return damageList.map((entry) => ({
    type: entry.Type as SkillType,
    dmgType: entry.DmgType ?? "damage",
    scalingStat: entry.PropertyName,
    actionFrame: 0,
    value: parseValue(entry.RateLv[9] ?? entry.RateLv[entry.RateLv.length - 1]),
    energy: entry.Energy[0],
    concerto: entry.ElementPower[0],
    toughness: entry.ToughLv[0],
    weakness: entry.WeaknessLvl[0],
  }))
}

interface ParsedRate {
  value: number
  count: number
}

interface ParsedValues {
  flat?: number
  rates: ParsedRate[]
}

export function parseValuesFromValue(value: string): ParsedValues {
  const flatMatch = value.match(/^(\d+(?:\.\d+)?)\+/)
  const flat = flatMatch ? parseFloat(flatMatch[1]) : undefined

  const rates: ParsedRate[] = []
  const regex = /([\d.]+)%(?:\*(\d+))?/g
  let match
  while ((match = regex.exec(value)) !== null) {
    const pct = match[1]
    const count = match[2] ? parseInt(match[2], 10) : 1
    const decimals = (pct.split(".")[1]?.length ?? 0) + 2
    rates.push({
      value: Number((parseFloat(pct) / 100).toFixed(decimals)),
      count,
    })
  }
  return { flat, rates }
}

/**
 * Skill groupings whose name is also a valid trigger-axis `SkillCategory`. For
 * these, group ≡ category, so the grouping is the right default. The groupings
 * NOT listed here ("Normal Attack", "Forte Circuit", "Inherent Skill") are not
 * categories, so their stages fall back to the first hit's damage type.
 */
const GROUPING_IS_CATEGORY = new Set<SkillGrouping>([
  "Resonance Skill",
  "Resonance Liberation",
  "Intro Skill",
  "Outro Skill",
  "Tune Break",
  "Echo Skill",
  "Movement",
])

function defaultCategory(
  grouping: SkillGrouping,
  firstHit: DamageEntry | undefined,
): SkillCategory {
  if (GROUPING_IS_CATEGORY.has(grouping)) return grouping as SkillCategory
  // Normal Attack / Forte Circuit / Inherent Skill: grouping is not a category.
  // The damage hit type splits e.g. Basic vs Heavy within "Normal Attack".
  return firstHit?.type ?? "Basic Attack"
}

export function enrichSkill(
  attributes: ApiSkillAttribute[],
  damageList: ApiDamageEntry[],
  grouping: SkillGrouping,
): {
  stages: SkillAttribute[]
  damage: DamageEntry[]
  cooldown?: number
  duration?: number
  concerto?: number
  resonanceCost?: number
} {
  const pool = mapDamageEntries(damageList)

  const enrichedAttributes: SkillAttribute[] = attributes.map((attr) => {
    const value = attr.values[9] ?? ""
    const { flat, rates: parsedRates } = parseValuesFromValue(value)

    if (parsedRates.length === 0) {
      return {
        name: attr.attributeName,
        category: defaultCategory(grouping, undefined),
        value,
      }
    }

    const matched: DamageEntry[] = []
    for (const { value: rate, count } of parsedRates) {
      let consumed = 0
      for (let i = 0; i < pool.length && consumed < count; i++) {
        if (pool[i].value === rate) {
          matched.push(...pool.splice(i, 1))
          i--
          consumed++
        }
      }
      if (consumed > 0 && consumed < count) {
        const missing = count - consumed
        console.warn(
          `  [fill] "${attr.attributeName}" expects ${count}× value ${rate} but only ${consumed} found — duplicating last entry ${missing} time(s)`,
        )
        for (let i = 0; i < missing; i++) {
          matched.push({ ...matched[matched.length - 1] })
        }
      }
    }

    if (matched.length === 0) {
      return {
        name: attr.attributeName,
        category: defaultCategory(grouping, undefined),
        value,
      }
    }

    if (flat !== undefined) {
      if (matched.length > 1) {
        console.warn(
          `  [flat] "${attr.attributeName}" has flat=${flat} but matched ${matched.length} entries — attaching to first only`,
        )
      }
      matched[0] = { ...matched[0], flat }
    }

    return {
      // Default the input-axis category from the skill grouping when the
      // grouping is itself a category; otherwise from the first hit's damage
      // type (ADR-0024: the two axes are orthogonal). Correct ~90% of the
      // time; off-type stages are fixed by hand in the enriched .ts.
      name: attr.attributeName,
      category: defaultCategory(grouping, matched[0]),
      value,
      damage: matched,
    }
  })

  const STA_COST_SUFFIX = " STA Cost"
  const COOLDOWN_SUFFIX = " Cooldown"
  const CONCERTO_SUFFIX = " Concerto Regen"
  const CONCERTO_ENERGY_SUFFIX = " Concerto Energy"
  let skillCooldown: number | undefined
  let skillDuration: number | undefined
  let skillConcerto: number | undefined
  let skillResonanceCost: number | undefined

  const finalAttributes = enrichedAttributes.filter((attr) => {
    if (attr.name === "Cooldown") {
      skillCooldown = parseFloat(attr.value)
      return false
    }
    if (attr.name === "Concerto Regen") {
      skillConcerto = parseFloat(attr.value)
      return false
    }
    if (attr.name === "Resonance Cost") {
      skillResonanceCost = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith("Duration")) {
      skillDuration = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith(STA_COST_SUFFIX)) {
      const keyword = attr.name.slice(0, -STA_COST_SUFFIX.length)
      const target = enrichedAttributes.find(
        (a) => a !== attr && a.name.includes(keyword),
      )
      if (target) target.staCost = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith(COOLDOWN_SUFFIX)) {
      const keyword = attr.name.slice(0, -COOLDOWN_SUFFIX.length)
      const target = enrichedAttributes.find(
        (a) => a !== attr && a.name.includes(keyword),
      )
      if (target) target.cooldown = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith(CONCERTO_SUFFIX)) {
      const keyword = attr.name.slice(0, -CONCERTO_SUFFIX.length)
      const target = enrichedAttributes.find(
        (a) => a !== attr && a.name.includes(keyword),
      )
      if (target) target.concerto = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith(CONCERTO_ENERGY_SUFFIX)) {
      const keyword = attr.name.slice(0, -CONCERTO_ENERGY_SUFFIX.length)
      const target = enrichedAttributes.find(
        (a) => a !== attr && a.name.includes(keyword),
      )
      if (target) target.concerto = parseFloat(attr.value)
      return false
    }
    return true
  })

  const orderedAttributes: SkillAttribute[] = finalAttributes.map(
    ({ name, category, value, staCost, cooldown, concerto, damage }) => ({
      name,
      category,
      value,
      ...(staCost !== undefined && { staCost }),
      ...(cooldown !== undefined && { cooldown }),
      ...(concerto !== undefined && { concerto }),
      ...(damage !== undefined && { damage }),
    }),
  )

  return {
    stages: orderedAttributes,
    damage: pool,
    cooldown: skillCooldown,
    duration: skillDuration,
    concerto: skillConcerto,
    resonanceCost: skillResonanceCost,
  }
}

function mapSkills(skills: ApiSkill[]): Skill[] {
  return skills.map((skill) => {
    const { stages, damage, cooldown, duration, concerto, resonanceCost } =
      enrichSkill(
        skill.SkillAttributes,
        skill.DamageList,
        skill.SkillType as SkillGrouping,
      )
    return {
      id: skill.SkillId,
      name: skill.SkillName,
      type: skill.SkillType as SkillGrouping,
      ...(cooldown !== undefined && { cooldown }),
      ...(duration !== undefined && { duration }),
      ...(concerto !== undefined && { concerto }),
      ...(resonanceCost !== undefined && { resonanceCost }),
      stages,
      damage,
    }
  })
}

// --- SkillTree / ResonantChain ---

export function mapSkillTreeBonuses(skillTree: ApiSkillTreeNode[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const node of skillTree) {
    if (!node.PropertyNodeTitle) continue
    const name = node.PropertyNodeTitle.replace(/\+$/, "")
    if (!seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
}

export function extractBuffNames(data: ApiCharacter): CharacterBuffNames {
  const inherent = data.Skills.filter(
    (s) => s.SkillType === "Inherent Skill" && s.SkillName.trim() !== "",
  ).map((s) => s.SkillName)
  const resonanceChain = [...data.ResonantChain]
    .sort((a, b) => a.GroupIndex - b.GroupIndex)
    .map((n) => n.NodeName)
  return { inherent, resonanceChain }
}

// --- Reference Markdown ---

function htmlToMarkdown(html: string): string {
  // <span class="font-bold font-whitney text-3xl ...">Title</span> → ### Title
  let result = html.replace(
    /<span[^>]*class="[^"]*font-bold[^"]*text-3xl[^"]*"[^>]*>(.*?)<\/span>/gi,
    (_, inner) => `### ${inner.replace(/<[^>]+>/g, "")}`,
  )
  // Every <br> is a line break in the source — bullets, enumerated lines, and
  // sentence joins alike. Render each as a newline; <br><br> naturally yields a
  // blank line, which the cleanup below collapses to a single paragraph break.
  result = result.replace(/<br\s*\/?>/gi, "\n")
  // strip remaining tags (e.g. <size=10>, </span>), keep inner text
  result = result.replace(/<[^>]+>/g, "")
  // Cleanup: drop horizontal whitespace stranded by spacer tags around the
  // line breaks, then collapse runs of blank lines to one paragraph break.
  result = result.replace(/[^\S\n]+\n/g, "\n")
  result = result.replace(/\n[^\S\n]+/g, "\n")
  result = result.replace(/\n{3,}/g, "\n\n")
  return result.trim()
}

const SECTION_ORDER: string[] = [
  "Intro Skill",
  "Outro Skill",
  "Normal Attack",
  "Resonance Skill",
  "Resonance Liberation",
  "Forte Circuit",
  "Inherent Skill",
  "Resonance Chain",
]

function buildReferenceMarkdown(data: ApiCharacter): string {
  const sections: string[] = []

  // Skills in canonical order (excluding Inherent Skill — handled separately)
  const mainSkillTypes = SECTION_ORDER.filter(
    (t) => t !== "Inherent Skill" && t !== "Resonance Chain",
  )

  for (const skillType of mainSkillTypes) {
    const skill = data.Skills.find((s) => s.SkillType === skillType)
    if (!skill) continue
    const description = htmlToMarkdown(skill.SkillDescribe)
    sections.push(`## ${skillType} — ${skill.SkillName}\n\n${description}`)
  }

  // Inherent Skills
  const inherentSkills = data.Skills.filter(
    (s) => s.SkillType === "Inherent Skill" && s.SkillName.trim() !== "",
  )
  if (inherentSkills.length > 0) {
    const inherentParts = inherentSkills.map((skill) => {
      const description = htmlToMarkdown(skill.SkillDescribe)
      return `### ${skill.SkillName}\n\n${description}`
    })
    sections.push(`## Inherent Skill\n\n${inherentParts.join("\n\n")}`)
  }

  // Resonance Chain
  const chainNodes = [...data.ResonantChain].sort(
    (a, b) => a.GroupIndex - b.GroupIndex,
  )
  if (chainNodes.length > 0) {
    const chainParts = chainNodes.map((node) => {
      const description = htmlToMarkdown(node.AttributesDescription)
      return `### S${node.GroupIndex} - ${node.NodeName}\n\n${description}`
    })
    sections.push(`## Resonance Chain\n\n${chainParts.join("\n\n")}`)
  }

  return sections.join("\n\n") + "\n"
}

// --- Main ---

export async function extractCharacter(id: string): Promise<void> {
  console.log(`Fetching character ${id}...`)

  let data: ApiCharacter
  if (id.endsWith(".json") || id.includes("/") || id.includes("\\")) {
    const filePath = path.isAbsolute(id) ? id : path.resolve(PROJECT_ROOT, id)
    const raw = await fs.readFile(filePath, "utf-8")
    data = JSON.parse(raw)
  } else {
    const res = await fetch(`${BASE_URL}/character/${id}`)
    if (!res.ok)
      throw new Error(`API responded with ${res.status}: ${res.statusText}`)
    data = await res.json()
  }

  const weaponType = WEAPON_TYPE_MAP[data.WeaponType]

  const character: Character = {
    id: data.Id,
    name: data.Name.Content,
    element: data.ElementName as Character["element"],
    weaponType: weaponType,
    rarity: data.QualityName,
    stats: mapStats(data.Properties),
    skills: mapSkills(data.Skills),
    skillTreeBonuses: mapSkillTreeBonuses(data.SkillTree),
    buffs: extractBuffNames(data),
  }

  const slug = data.Name.Content.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
  const outputDir = path.join(PROJECT_ROOT, "src/data/characters/raw")
  const outputPath = path.join(outputDir, `${slug}.json`)

  try {
    await fs.access(outputPath)
    console.warn(`Overwriting existing file for ${data.Name.Content}`)
  } catch {
    // File doesn't exist yet
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(character, null, 2))
  console.log(`Written to src/data/characters/raw/${slug}.json`)

  // Write reference markdown (skip if already exists)
  const refDir = path.join(PROJECT_ROOT, "references/characters")
  const refPath = path.join(refDir, `${slug}.md`)
  let refExists = false
  try {
    await fs.access(refPath)
    refExists = true
  } catch {
    // File doesn't exist yet
  }

  if (refExists) {
    console.log(
      `Skipping references/characters/${slug}.md (already exists — delete to regenerate)`,
    )
  } else {
    const markdown = buildReferenceMarkdown(data)
    await fs.mkdir(refDir, { recursive: true })
    await fs.writeFile(refPath, markdown)
    console.log(`Written to references/characters/${slug}.md`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const id = process.argv[2]
  if (!id) {
    console.error("Usage: pnpm extract-character <character-id>")
    process.exit(1)
  }
  extractCharacter(id).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
