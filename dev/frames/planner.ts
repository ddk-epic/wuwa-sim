import type {
  EnrichedCharacter,
  EnrichedSkill,
  EnrichedSkillAttribute,
  SkillCategory,
} from "#/types/character"
import { isMeasurableSkill, isMeasurableStage, stageRefOf } from "./stages"
import type { Clip, StageRef } from "./types"

/**
 * The prep step: suggest the minimal set of action-string clips an author must
 * record so the solver can later recover every stage's `actionTime` and every
 * hit's `actionFrame`. Planning is driven entirely by static character data — the
 * cancel/pin rules in `references/cancellation.md` — never author annotation.
 *
 * Two recording targets, both met by one covering set: every stage's natural
 * `actionTime` (pinned by a trailing basic sentinel, or an interior cutoff), and
 * every stage visible in ≥1 clip so its hits can be marked. Variants are out of
 * scope — they project off hit marks with no dedicated recording.
 */

/** A recording setup the author must arrange before a clip is filmable. */
export type Precondition =
  | "swap-in" // Intro: only fires on a swap-in
  | "full-energy" // Liberation: needs a charged bar
  | "cutscene" // Liberation with a clock-frozen animation — measure separately
  | "airborne" // aerial: jump first
  | "verify-forte" // forte stage: confirm whether a gauge is required
  | "requires-prior" // window follow-up: a prerequisite must have cast earlier

/** One measured stage inside a suggestion. */
export interface PlannedStage {
  ref: StageRef
  /** Display label — the skill name for an unnamed cast stage, else the stage's own. */
  label: string
  /** The link feeding into this stage is an assumed (unproven) input transition. */
  verify: boolean
  /** This stage is aerial-by-name but carries no `footing` — its instruction may be wrong. */
  footingGap: boolean
}

export interface SuggestedClip {
  /** Stable identity = the joined member stage ids, so coverage survives re-renders. */
  id: string
  stages: PlannedStage[]
  /** The scoped-out trailing basic that reveals the last stage's true end. */
  sentinel: string
  preconditions: Precondition[]
}

const NON_CANCELLING: ReadonlySet<SkillCategory> = new Set([
  "Basic Attack",
  "Heavy Attack",
])

interface Candidate {
  ref: StageRef
  label: string
  stage: EnrichedSkillAttribute
  skill: EnrichedSkill
  category: SkillCategory
  isForte: boolean
  aerial: boolean
  footingGap: boolean
}

/** Strip a trailing " DMG"/" Damage" and kebab-case — mirrors the compile-pass key derivation. */
function deriveKey(name: string): string {
  return name
    .replace(/ (DMG|Damage)$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function stageToken(
  skill: EnrichedSkill,
  stage: EnrichedSkillAttribute,
): string {
  return `${deriveKey(skill.name)}/${stage.key ?? deriveKey(stage.name)}`
}

/** Outro/utility stages that are instant and dealt no damage — nothing to record. */
function isOmitted(
  stage: EnrichedSkillAttribute,
  category: SkillCategory,
): boolean {
  return category === "Outro Skill" && (stage.damage?.length ?? 0) === 0
}

function aerialInfo(stage: EnrichedSkillAttribute): {
  aerial: boolean
  footingGap: boolean
} {
  const f = stage.footing
  if (f === "air") return { aerial: true, footingGap: false }
  if (f && typeof f === "object" && "land" in f)
    return { aerial: true, footingGap: false }
  // A launch enters from the ground; "ground"/"either" are explicit. No airborne setup.
  if (f) return { aerial: false, footingGap: false }
  // Omitted footing defaults to ground, so not aerial. An aerial-sounding name with
  // no footing tag is a genuine data gap — the instruction likely needs one.
  const named = /mid-?air|plung/i.test(stage.newName || stage.name)
  return { aerial: false, footingGap: named }
}

function candidates(char: EnrichedCharacter): Candidate[] {
  const out: Candidate[] = []
  for (const skill of char.skills) {
    if (!isMeasurableSkill(skill)) continue
    for (const stage of skill.stages) {
      if (!isMeasurableStage(stage)) continue
      if (isOmitted(stage, stage.category)) continue
      const { aerial, footingGap } = aerialInfo(stage)
      out.push({
        ref: stageRefOf(skill.name, stage),
        // An unnamed cast stage ("Skill DMG") reads as its skill; the skill name
        // is what the author recognizes in the action string.
        label: stage.newName?.trim() ? stage.newName.trim() : skill.name,
        stage,
        skill,
        category: stage.category,
        isForte: skill.type === "Forte Circuit",
        aerial,
        footingGap,
      })
    }
  }
  return out
}

/** Maximal root-to-leaf paths through the `requiresPriorStage` forest (combo chains). */
function comboChains(cands: Candidate[]): Candidate[][] {
  const byToken = new Map<string, Candidate>()
  for (const c of cands) byToken.set(stageToken(c.skill, c.stage), c)

  const parentOf = new Map<Candidate, Candidate | undefined>()
  const children = new Map<Candidate, Candidate[]>()
  for (const c of cands) {
    const req = c.stage.requiresPriorStage
    // A window follow-up (minDelay) is not a tight combo link — don't chain it.
    const parent =
      req && c.stage.minDelay == null ? byToken.get(req) : undefined
    parentOf.set(c, parent)
    if (parent) {
      const list = children.get(parent) ?? []
      list.push(c)
      children.set(parent, list)
    }
  }

  const roots = cands.filter(
    (c) => !parentOf.get(c) && (children.get(c)?.length ?? 0) > 0,
  )
  const chains: Candidate[][] = []
  for (const root of roots) {
    const leaves = children.get(root) ?? []
    // One path per leaf branch; linear combos yield exactly one.
    for (const first of leaves) {
      const path = [root]
      let node: Candidate | undefined = first
      while (node) {
        path.push(node)
        const kids = children.get(node)
        node = kids && kids.length > 0 ? kids[0] : undefined
      }
      chains.push(path)
    }
  }
  return chains
}

function preconditionsFor(cands: Candidate[]): Precondition[] {
  const set = new Set<Precondition>()
  for (const c of cands) {
    if (c.category === "Intro Skill") set.add("swap-in")
    if (c.category === "Resonance Liberation") {
      set.add("full-energy")
      if ((c.stage.animationFrames ?? 0) > 0) set.add("cutscene")
    }
    if (c.isForte) set.add("verify-forte")
    if (c.aerial) set.add("airborne")
    if (c.stage.requiresPriorStage && c.stage.minDelay != null)
      set.add("requires-prior")
  }
  return [...set]
}

/** A link into `cur` from `prev` is proven only for combo chains and liberation→skill. */
function isSolidLink(
  prev: Candidate | undefined,
  cur: Candidate,
  fromChain: boolean,
): boolean {
  if (!prev) return true // clip start — clean
  if (fromChain) return true
  return (
    prev.category === "Resonance Liberation" &&
    cur.category === "Resonance Skill"
  )
}

function toSuggestion(seq: Candidate[], fromChain: boolean): SuggestedClip {
  const stages: PlannedStage[] = seq.map((c, i) => ({
    ref: c.ref,
    label: c.label,
    verify: !isSolidLink(seq[i - 1], c, fromChain),
    footingGap: c.footingGap,
  }))
  return {
    id: seq.map((c) => c.ref.id).join("|"),
    stages,
    sentinel: "",
    preconditions: preconditionsFor(seq),
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}

/**
 * Order neutral standalones so every stage's natural end is pinned by its
 * successor: liberations first (uncancellable → anything waits), then each skill
 * trailed by a non-cancelling stage that waits for it, then the rest. The final
 * stage is pinned by the sentinel.
 */
function orderNeutral(cands: Candidate[]): Candidate[] {
  const libs = cands.filter((c) => c.category === "Resonance Liberation")
  const skills = cands.filter((c) => c.category === "Resonance Skill")
  const nons = cands.filter((c) => NON_CANCELLING.has(c.category))
  const queue = [...nons]
  const out = [...libs]
  for (const s of skills) {
    out.push(s)
    const pin = queue.shift()
    if (pin) out.push(pin)
  }
  out.push(...queue)
  return out
}

/** Default per-clip stage cap — a sanity ceiling on how much an author marks per recording. */
export const STAGE_CAP = 8

export function planClips(
  char: EnrichedCharacter,
  cap: number = STAGE_CAP,
): SuggestedClip[] {
  const cands = candidates(char)
  const inChain = new Set<Candidate>()

  const chains = comboChains(cands)
  const chainClips: SuggestedClip[] = []
  for (const chain of chains) {
    chain.forEach((c) => inChain.add(c))
    for (const part of chunk(chain, cap)) {
      chainClips.push(toSuggestion(part, true))
    }
  }

  const standalone = cands.filter((c) => !inChain.has(c))
  const intros = standalone.filter((c) => c.category === "Intro Skill")
  const aerials = standalone.filter(
    (c) => c.aerial && c.category !== "Intro Skill",
  )
  const neutral = standalone.filter(
    (c) => !c.aerial && c.category !== "Intro Skill",
  )

  const neutralClips = chunk(orderNeutral(neutral), cap).map((seq) =>
    toSuggestion(seq, false),
  )
  // Swap-in and aerial rituals stay singletons — each carries its own setup.
  const introClips = intros.map((c) => toSuggestion([c], false))
  const aerialClips = aerials.map((c) => toSuggestion([c], false))

  const sentinel = sentinelLabel(cands)
  return [...chainClips, ...neutralClips, ...introClips, ...aerialClips].map(
    (s) => ({ ...s, sentinel }),
  )
}

/** The basic-loop restart used as the scoped-out tail sentinel — the first basic stage. */
function sentinelLabel(cands: Candidate[]): string {
  const basic = cands.find((c) => c.category === "Basic Attack")
  return basic ? basic.label : "Basic 1"
}

export type Coverage = "covered" | "partial" | "none"

/** How much of a suggestion's measured stages already appear in some existing clip. */
export function coverageOf(suggestion: SuggestedClip, clips: Clip[]): Coverage {
  const recorded = new Set<string>()
  for (const c of clips) for (const r of c.stageRefs) recorded.add(r.id)
  const hits = suggestion.stages.filter((s) => recorded.has(s.ref.id)).length
  if (hits === 0) return "none"
  if (hits === suggestion.stages.length) return "covered"
  return "partial"
}
