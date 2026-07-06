import type {
  EnrichedCharacter,
  EnrichedSkill,
  EnrichedSkillAttribute,
  SkillType,
} from "#/types/character"
import type { EnrichedEcho, EnrichedEchoStage } from "#/types/echo"
import type {
  BuffDef,
  Condition,
  Effect,
  HitFilter,
  Trigger,
} from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById, getEchoById } from "./loadout/catalog"
import type { ResolvedStage } from "./stage"
import {
  STAGE_CAST_NAME,
  SWAP_IN_SENTINEL,
  resolveStageLabel,
  deriveKey,
  stageLabel,
  stageSkillType,
  toKebab,
} from "./stage"

const KEY_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export interface StageInfo {
  stageId: string
  skillKey: string
  stageKey: string
  skillType: SkillType
  skill: EnrichedSkill
  stage: EnrichedSkillAttribute
  requiresPriorStageId?: string[]
}

export interface CompiledCharacter {
  stageIndex: Map<string, StageInfo>
  /** skillKey → stageKey → stageId */
  refIndex: Map<string, Map<string, string>>
  /** buff key (last id segment) → full buff id */
  buffKeys: Map<string, string>
  buffs: BuffDef[]
}

export interface EchoStageInfo {
  stageId: string
  stageKey: string
  stage: EnrichedEchoStage
}

export interface CompiledEcho {
  stageIndex: Map<string, EchoStageInfo>
  buffs: BuffDef[]
}

/** `char.<char>.<skill-category>.<skillKey>.<stageKey>::<skill-type>` */
function makeStageId(
  charSlug: string,
  categorySlug: string,
  skillKey: string,
  stageKey: string,
  skillType: SkillType,
): string {
  return `char.${charSlug}.${categorySlug}.${skillKey}.${stageKey}::${toKebab(skillType)}`
}

function assertKey(key: string, owner: string): void {
  if (!KEY_RE.test(key)) {
    throw new Error(`${owner}: invalid key "${key}"`)
  }
}

type LoweredRefs = {
  stageId?: string | string[]
  skill?: string | string[]
  hitIndex?: number
}

type StageRef = { stageId: string; hitIndex?: number } | { skill: string }
type RefLowerer = (refs: string | string[]) => LoweredRefs
type BuffResolver = (key: string) => string

function parseHit(
  owner: string,
  ref: string,
): { base: string; hitIndex?: number } {
  const hash = ref.indexOf("#")
  if (hash < 0) return { base: ref }
  const hitIndex = Number(ref.slice(hash + 1))
  if (!Number.isInteger(hitIndex) || hitIndex < 1) {
    throw new Error(`${owner}: invalid hit index in "${ref}"`)
  }
  return { base: ref.slice(0, hash), hitIndex }
}

function combineRefs(
  owner: string,
  lowerOne: (ref: string) => StageRef,
): RefLowerer {
  return (refs) => {
    const list = Array.isArray(refs) ? refs : [refs]
    const lowered = list.map(lowerOne)
    const skills: string[] = []
    const exact: { stageId: string; hitIndex?: number }[] = []
    for (const l of lowered) {
      if ("skill" in l) skills.push(l.skill)
      else exact.push(l)
    }
    if (skills.length > 0 && exact.length > 0) {
      throw new Error(
        `${owner}: mixed skill/stage granularity in ${JSON.stringify(refs)}`,
      )
    }
    if (skills.length > 0) {
      return { skill: skills.length === 1 ? skills[0] : skills }
    }
    const pinned = exact.filter((e) => e.hitIndex !== undefined)
    if (pinned.length > 0 && exact.length > 1) {
      throw new Error(
        `${owner}: a hit-pinned reference must stand alone in ${JSON.stringify(refs)}`,
      )
    }
    const ids = exact.map((e) => e.stageId)
    const out: LoweredRefs = { stageId: ids.length === 1 ? ids[0] : ids }
    if (pinned.length === 1) out.hitIndex = pinned[0].hitIndex
    return out
  }
}

/**
 * `"skill/stage"`, `"skill/stage#n"`, or a bare `"skill"` (whole-skill axis).
 */
function makeStageLowerer(
  owner: string,
  refIndex: ReadonlyMap<string, ReadonlyMap<string, string>>,
): RefLowerer {
  return combineRefs(owner, (ref) => {
    const { base, hitIndex } = parseHit(owner, ref)
    const slash = base.indexOf("/")
    if (slash < 0) {
      if (hitIndex !== undefined) {
        throw new Error(`${owner}: skill reference "${ref}" cannot pin a hit`)
      }
      if (!refIndex.has(base)) {
        throw new Error(`${owner}: unresolvable skill reference "${base}"`)
      }
      return { skill: base }
    }
    const stageId = refIndex
      .get(base.slice(0, slash))
      ?.get(base.slice(slash + 1))
    if (stageId === undefined) {
      throw new Error(`${owner}: unresolvable stage reference "${ref}"`)
    }
    return hitIndex === undefined ? { stageId } : { stageId, hitIndex }
  })
}

/** Echoes have a single implicit skill, so a ref is just `"stage"` or `"stage#n"`. */
function makeEchoStageLowerer(
  owner: string,
  stageByKey: ReadonlyMap<string, string>,
): RefLowerer {
  return combineRefs(owner, (ref) => {
    const { base, hitIndex } = parseHit(owner, ref)
    if (base.includes("/")) {
      throw new Error(`${owner}: echo stage reference "${ref}" has no skill`)
    }
    const stageId = stageByKey.get(base)
    if (stageId === undefined) {
      throw new Error(`${owner}: unresolvable stage reference "${ref}"`)
    }
    return hitIndex === undefined ? { stageId } : { stageId, hitIndex }
  })
}

function makeBuffResolver(
  owner: string,
  buffKeys: ReadonlyMap<string, string>,
): BuffResolver {
  return (key) => {
    const id = buffKeys.get(key)
    if (id === undefined) {
      throw new Error(`${owner}: unresolvable buff reference "${key}"`)
    }
    return id
  }
}

function resolveBuffRefs(
  refs: string | string[],
  resolve: BuffResolver,
): string | string[] {
  return Array.isArray(refs) ? refs.map(resolve) : resolve(refs)
}

function lowerCondition(cond: Condition, resolveBuff: BuffResolver): Condition {
  if (cond.kind === "buffActive") {
    return { ...cond, buff: resolveBuff(cond.buff) }
  }
  if (cond.kind === "buffCount") {
    return { ...cond, buffs: cond.buffs.map(resolveBuff) }
  }
  return cond
}

function lowerTrigger(
  t: Trigger,
  owner: string,
  lowerStage: RefLowerer,
  resolveBuff: BuffResolver,
): Trigger {
  if (t.precondition !== undefined) {
    t = { ...t, precondition: lowerCondition(t.precondition, resolveBuff) }
  }
  if (t.event === "skillCast" && t.stage !== undefined) {
    const axes = lowerStage(t.stage)
    if (axes.hitIndex !== undefined) {
      throw new Error(`${owner}: skillCast trigger cannot pin a hit index`)
    }
    const next = { ...t }
    delete next.stage
    if (axes.stageId !== undefined) next.stageId = axes.stageId
    if (axes.skill !== undefined) next.skill = axes.skill
    return next
  }
  if (t.event === "buffExpired") {
    return { ...t, buff: resolveBuffRefs(t.buff, resolveBuff) }
  }
  if (t.event === "hitLanded" || t.event === "healLanded") {
    let next = t
    if (t.stage !== undefined) {
      const axes = lowerStage(t.stage)
      next = { ...next }
      delete next.stage
      if (axes.stageId !== undefined) next.stageId = axes.stageId
      if (axes.skill !== undefined) next.skill = axes.skill
      if (axes.hitIndex !== undefined) next.hitIndex = axes.hitIndex
    }
    if (next.event === "hitLanded" && next.sourceBuff !== undefined) {
      next = {
        ...next,
        sourceBuff: resolveBuffRefs(next.sourceBuff, resolveBuff),
      }
    }
    return next
  }
  return t
}

function lowerHitFilter(
  f: HitFilter,
  lowerStage: RefLowerer,
  resolveBuff: BuffResolver,
): HitFilter {
  let next = f
  if (f.stage !== undefined) {
    const axes = lowerStage(f.stage)
    next = { ...next }
    delete next.stage
    if (axes.stageId !== undefined) next.stageId = axes.stageId
    if (axes.skill !== undefined) next.skill = axes.skill
    if (axes.hitIndex !== undefined) next.hitIndex = axes.hitIndex
  }
  if (next.sourceBuff !== undefined) {
    next = {
      ...next,
      sourceBuff: resolveBuffRefs(next.sourceBuff, resolveBuff),
    }
  }
  return next
}

function lowerEffect(effect: Effect, resolveBuff: BuffResolver): Effect {
  if (effect.kind === "removeBuffs") {
    return { ...effect, buffs: effect.buffs.map(resolveBuff) }
  }
  if (effect.kind === "stat" && effect.value.kind === "scaledByStacks") {
    return {
      ...effect,
      value: { ...effect.value, buff: resolveBuff(effect.value.buff) },
    }
  }
  return effect
}

function lowerBuffDef(
  def: BuffDef,
  lowerStage: RefLowerer,
  resolveBuff: BuffResolver,
): BuffDef {
  const next: BuffDef = {
    ...def,
    trigger: lowerTrigger(def.trigger, def.id, lowerStage, resolveBuff),
    effects: def.effects.map((e) => lowerEffect(e, resolveBuff)),
  }
  if (def.consumedBy !== undefined) {
    next.consumedBy = lowerTrigger(
      def.consumedBy,
      def.id,
      lowerStage,
      resolveBuff,
    )
  }
  if (def.appliesToHits !== undefined) {
    next.appliesToHits = lowerHitFilter(
      def.appliesToHits,
      lowerStage,
      resolveBuff,
    )
  }
  if (def.condition !== undefined) {
    next.condition = lowerCondition(def.condition, resolveBuff)
  }
  if (def.duration?.kind === "inherit") {
    next.duration = { ...def.duration, buff: resolveBuff(def.duration.buff) }
  }
  if (
    (def.duration?.kind === "frames" || def.duration?.kind === "seconds") &&
    def.duration.while !== undefined
  ) {
    next.duration = {
      ...def.duration,
      while: { buff: resolveBuff(def.duration.while.buff) },
    }
  }
  return next
}

function buildBuffKeys(buffs: BuffDef[], owner: string): Map<string, string> {
  const keys = new Map<string, string>()
  for (const def of buffs) {
    const key = def.id.slice(def.id.lastIndexOf(".") + 1)
    assertKey(key, `${owner}, buff "${def.id}"`)
    const existing = keys.get(key)
    // Sequence-gated variants of one buff share an id; only two distinct
    // ids colliding on a key is ambiguous.
    if (existing !== undefined && existing !== def.id) {
      throw new Error(
        `${owner}: buff key "${key}" is ambiguous ("${existing}" vs "${def.id}")`,
      )
    }
    keys.set(key, def.id)
  }
  return keys
}

function compile(char: EnrichedCharacter): CompiledCharacter {
  const owner = `char ${char.name}`
  const charSlug = toKebab(char.name)
  assertKey(charSlug, owner)

  const liberation = char.skills.find((s) => s.resonanceCost !== undefined)
  if (liberation && liberation.resonanceCost !== char.maxEnergy) {
    throw new Error(
      `${char.name}: liberation resonanceCost (${liberation.resonanceCost}) disagrees with maxEnergy (${char.maxEnergy})`,
    )
  }

  const stageIndex = new Map<string, StageInfo>()
  const refIndex = new Map<string, Map<string, string>>()

  for (const skill of char.skills) {
    if (skill.stages.length === 0) continue
    const skillKey = skill.key ?? deriveKey(skill.name)
    assertKey(skillKey, `${owner}, skill "${skill.name}"`)
    if (refIndex.has(skillKey)) {
      throw new Error(`${owner}: duplicate skill key "${skillKey}"`)
    }
    const stageKeys = new Map<string, string>()
    refIndex.set(skillKey, stageKeys)

    for (const stage of skill.stages) {
      // Empty-name stages are raw-data placeholders: unkeyed and unreachable.
      if (stage.name === "" && stage.key === undefined) continue
      const stageKey = stage.key ?? deriveKey(stage.name)
      assertKey(stageKey, `${owner}, stage "${stage.name}" of "${skill.name}"`)
      if (stageKeys.has(stageKey)) {
        throw new Error(
          `${owner}: duplicate stage key "${stageKey}" in skill "${skill.name}"`,
        )
      }
      const skillType = stageSkillType(stage.category, stage.damage)
      const categorySlug = toKebab(stage.category)
      const stageId = makeStageId(
        charSlug,
        categorySlug,
        skillKey,
        stageKey,
        skillType,
      )
      stageKeys.set(stageKey, stageId)
      stageIndex.set(stageId, {
        stageId,
        skillKey,
        stageKey,
        skillType,
        skill,
        stage,
      })
    }
  }

  const buffKeys = buildBuffKeys(char.buffs, owner)
  const lowerStage = makeStageLowerer(owner, refIndex)
  const resolveBuff = makeBuffResolver(owner, buffKeys)

  for (const info of stageIndex.values()) {
    const ref = info.stage.requiresPriorStage
    if (ref === undefined) continue
    const refs = Array.isArray(ref) ? ref : [ref]
    info.requiresPriorStageId = refs.map((r) => {
      if (r === SWAP_IN_SENTINEL) return r
      const axes = lowerStage(r)
      if (typeof axes.stageId !== "string" || axes.hitIndex !== undefined) {
        throw new Error(
          `${owner}: requiresPriorStage must name exactly one stage, got "${r}"`,
        )
      }
      return axes.stageId
    })
  }

  return {
    stageIndex,
    refIndex,
    buffKeys,
    buffs: char.buffs.map((def) => lowerBuffDef(def, lowerStage, resolveBuff)),
  }
}

function compileEchoData(echo: EnrichedEcho): CompiledEcho {
  const owner = `echo ${echo.name}`
  const echoSlug = toKebab(echo.name)
  assertKey(echoSlug, owner)

  const stageIndex = new Map<string, EchoStageInfo>()
  const stageByKey = new Map<string, string>()

  for (const stage of echo.skill.stages) {
    const stageKey = stage.key ?? deriveKey(stage.name)
    assertKey(stageKey, `${owner}, stage "${stage.name}"`)
    const stageId = `echo.${echoSlug}.${stageKey}::echo-skill`
    if (stageIndex.has(stageId)) {
      throw new Error(`${owner}: duplicate stage key "${stageKey}"`)
    }
    stageIndex.set(stageId, { stageId, stageKey, stage })
    stageByKey.set(stageKey, stageId)
  }

  const lowerStage = makeEchoStageLowerer(owner, stageByKey)
  const resolveBuff = makeBuffResolver(owner, buildBuffKeys(echo.buffs, owner))

  return {
    stageIndex,
    buffs: echo.buffs.map((def) => lowerBuffDef(def, lowerStage, resolveBuff)),
  }
}

const compiledCharacters = new WeakMap<EnrichedCharacter, CompiledCharacter>()
const compiledEchoes = new WeakMap<EnrichedEcho, CompiledEcho>()

export function compileCharacter(char: EnrichedCharacter): CompiledCharacter {
  let compiled = compiledCharacters.get(char)
  if (!compiled) {
    compiled = compile(char)
    compiledCharacters.set(char, compiled)
  }
  return compiled
}

export function compileEcho(echo: EnrichedEcho): CompiledEcho {
  let compiled = compiledEchoes.get(echo)
  if (!compiled) {
    compiled = compileEchoData(echo)
    compiledEchoes.set(echo, compiled)
  }
  return compiled
}

export function getCompiledCharacter(
  characterId: number,
): CompiledCharacter | null {
  const char = getCharacterById(characterId)
  return char ? compileCharacter(char) : null
}

export function getCompiledEcho(echoId: number): CompiledEcho | null {
  const echo = getEchoById(echoId)
  return echo ? compileEcho(echo) : null
}

export function findStageByEntry(
  entry: TimelineEntry,
  slots: Slots,
  loadouts: SlotLoadout[],
): ResolvedStage | null {
  const character = getCharacterById(entry.characterId)
  const compiled = character ? compileCharacter(character) : undefined
  const info = compiled?.stageIndex.get(entry.stageId)

  if (character && compiled && info) {
    const { skill, stage } = info
    // Same-skill follow-up shares the initiating cast's cooldown, not its own.
    // Any-of gate: holds only if every predecessor shares the follow-up's skill.
    const continuesSkillCast =
      info.requiresPriorStageId !== undefined &&
      info.requiresPriorStageId.length > 0 &&
      info.requiresPriorStageId.every(
        (id) => compiled.stageIndex.get(id)?.skillKey === info.skillKey,
      )
    const isCastStage = stage.name === STAGE_CAST_NAME
    // Stage-level skillType, collapsed from the parent skill grouping.
    // Grouping-only labels that are not SkillTypes (Normal Attack,
    // Inherent Skill, Tune Break, Forte Circuit) collapse to "Basic Attack".
    // Independent of skillCategory (the trigger axis); per-hit damage type
    // lives on each DamageEntry.type.
    const skillType: SkillType =
      skill.type === "Normal Attack" ||
      skill.type === "Inherent Skill" ||
      skill.type === "Tune Break" ||
      skill.type === "Forte Circuit"
        ? "Basic Attack"
        : skill.type
    return {
      stage,
      stageId: info.stageId,
      stageName: stage.name,
      skillKey: info.skillKey,
      element: character.element,
      concerto:
        (stage.concerto ?? 0) + (isCastStage ? (skill.concerto ?? 0) : 0),
      forte: stage.forte,
      resonanceCost: skill.resonanceCost,
      damage: stage.damage ?? [],
      skillGrouping: skill.type,
      skillCategory: stage.category,
      skillType,
      skillName: isCastStage
        ? (stage.newSkillName ?? skill.name)
        : resolveStageLabel(skill.name, stage),
      requiresPriorStageId: info.requiresPriorStageId,
      requiresSequence: stage.requiresSequence,
      requiresConcerto: stage.requiresConcerto,
      followUpDelay:
        stage.requiresPriorStage !== undefined
          ? stage.followUpDelay
          : undefined,
      // A same-skill follow-up continues the initiating cast; it doesn't arm the timer.
      skillCooldown: continuesSkillCast ? undefined : skill.cooldown,
      cooldown: stage.cooldown,
    }
  }

  const slotIndex = slots.findIndex((id) => id === entry.characterId)
  const echoId = slotIndex >= 0 ? (loadouts[slotIndex]?.echoId ?? null) : null
  const echo = echoId !== null ? getEchoById(echoId) : null
  const echoInfo = echo
    ? compileEcho(echo).stageIndex.get(entry.stageId)
    : undefined
  if (echo && echoInfo) {
    const { stage } = echoInfo
    return {
      stage,
      stageId: echoInfo.stageId,
      stageName: stage.name,
      element: echo.element,
      concerto: 0,
      damage: stage.damage,
      skillGrouping: "Echo Skill",
      skillCategory: "Echo Skill",
      skillType: "Echo Skill",
      skillName: stageLabel(echo.name, stage.newName),
    }
  }

  return null
}

/**
 * Map every stage id reachable by a team (characters and equipped echoes) to
 * the user-facing label its Timeline row shows. Sourced from the same
 * `stageLabel(skill.name, stage.newName)` that `findStageByEntry` uses, so the
 * validator can name stages exactly as the rows do instead of leaking raw ids.
 */
export function buildStageLabels(
  slots: Slots,
  loadouts: SlotLoadout[],
): Map<string, string> {
  const labels = new Map<string, string>()
  for (let i = 0; i < slots.length; i++) {
    const characterId = slots[i]
    if (characterId === null) continue
    const character = getCharacterById(characterId)
    if (character) {
      for (const info of compileCharacter(character).stageIndex.values()) {
        labels.set(info.stageId, resolveStageLabel(info.skill.name, info.stage))
      }
    }
    const echoId = loadouts[i]?.echoId ?? null
    const echo = echoId !== null ? getEchoById(echoId) : null
    if (echo) {
      for (const info of compileEcho(echo).stageIndex.values()) {
        labels.set(info.stageId, stageLabel(echo.name, info.stage.newName))
      }
    }
  }
  return labels
}
