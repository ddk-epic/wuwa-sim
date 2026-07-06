import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "../loadout/catalog"
import { findStageByEntry } from "../compile-character"
import type { ResolvedStage } from "../stage"
import type { ValidatorMessage } from "./row-messages"

// Footing is deliberately NOT validated here. Footing rules are frame-dependent
// (variant advances, Reaction Delay, trailing-window commits), so a static walk
// can only mirror the engine approximately — and a previous mirror drifted (it
// ignored Reaction Delay). The engine emits footing violations as Diagnostics on
// the ActionEvent of the run that observed them; do not re-add a predictor here.

/**
 * A structural problem the validator found on a row. The message is structured —
 * the validator never renders English. Severity drives styling; the view turns
 * the message into text via the row-messages catalog.
 */
export interface RowFinding {
  message: ValidatorMessage
  severity: "invalid" | "warning"
}

export interface ValidationResult {
  /** Displayable findings per row; consequence-only invalidations are dropped. */
  findings: Map<string, RowFinding[]>
  /** Every invalid row — roots and cascade consequences — for red styling. */
  invalidRowIds: Set<string>
}

// `consequence` is internal to the walk: a row invalid only because an upstream
// prerequisite is itself broken. It counts toward invalidRowIds (the cascade
// stays red) but its message is suppressed so only the root row carries text.
type RawFinding = RowFinding & { consequence: boolean }

const invalid = (message: ValidatorMessage): RawFinding => ({
  message,
  severity: "invalid",
  consequence: false,
})
const consequence = (message: ValidatorMessage): RawFinding => ({
  message,
  severity: "invalid",
  consequence: true,
})
const warning = (message: ValidatorMessage): RawFinding => ({
  message,
  severity: "warning",
  consequence: false,
})

interface WalkContext {
  entries: TimelineEntry[]
  resolved: (ResolvedStage | null)[]
  slots: Slots
  loadouts: SlotLoadout[]
  invalidRowIds: Set<string>
  /** Immediately preceding entry of each character, as of the current row. */
  lastByChar: Map<number, TimelineEntry>
  /** Per character, the last occurrence of each stage id seen so far. */
  stagesByChar: Map<number, Map<string, TimelineEntry>>
}

export function validateTimeline(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
): ValidationResult {
  const ctx: WalkContext = {
    entries,
    resolved: entries.map((e) => findStageByEntry(e, slots, loadouts)),
    slots,
    loadouts,
    invalidRowIds: new Set(),
    lastByChar: new Map(),
    stagesByChar: new Map(),
  }

  const findings = new Map<string, RowFinding[]>()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const raw = [
      ...checkIntroFollowsOutro(i, ctx),
      ...checkReachability(i, ctx),
      ...checkStageSequence(i, ctx),
      ...checkSwapForcesDifferentChar(i, ctx),
    ]

    if (raw.some((f) => f.severity === "invalid")) {
      ctx.invalidRowIds.add(entry.id)
    }
    const visible = raw
      .filter((f) => !f.consequence)
      .map(({ consequence: _omit, ...f }) => f)
    if (visible.length > 0) findings.set(entry.id, visible)

    // Advance running state only after this row's rules have read "prior":
    // the maps must reflect strictly-earlier entries when a rule consults them.
    ctx.lastByChar.set(entry.characterId, entry)
    const seen = ctx.stagesByChar.get(entry.characterId) ?? new Map()
    seen.set(entry.stageId, entry)
    ctx.stagesByChar.set(entry.characterId, seen)
  }

  return { findings, invalidRowIds: ctx.invalidRowIds }
}

function checkIntroFollowsOutro(i: number, ctx: WalkContext): RawFinding[] {
  if (ctx.resolved[i]?.skillType !== "Intro Skill") return []
  const prevType = i > 0 ? (ctx.resolved[i - 1]?.skillType ?? null) : null
  return prevType === "Outro Skill"
    ? []
    : [invalid({ kind: "introNeedsOutro" })]
}

function checkReachability(i: number, ctx: WalkContext): RawFinding[] {
  const entry = ctx.entries[i]
  const resolved = ctx.resolved[i]
  const skillType = resolved?.skillType ?? null

  if (!ctx.slots.includes(entry.characterId)) {
    return [invalid({ kind: "characterNotInTeam" })]
  }
  if (skillType === null) {
    return getCharacterById(entry.characterId)
      ? [invalid({ kind: "stageNotFound", stageId: entry.stageId })]
      : [invalid({ kind: "unknownCharacter" })]
  }

  const requiredStageIds = resolved?.requiresPriorStageId
  if (skillType === "Echo Skill" || requiredStageIds === undefined) return []

  // Window mode: any earlier matching stage on this character satisfies the gate,
  // regardless of intervening entries. Chain mode: the immediately preceding
  // same-character entry must BE one of the prerequisites. Either mode is
  // satisfied by any listed prerequisite (OR / any-of).
  const windowed = resolved?.followUpDelay !== undefined
  const anchor = windowed
    ? pickWindowAnchor(
        ctx.stagesByChar.get(entry.characterId),
        requiredStageIds,
      )
    : pickChainAnchor(ctx.lastByChar.get(entry.characterId), requiredStageIds)

  const message: ValidatorMessage = {
    kind: windowed ? "missingWindowedPrereq" : "missingChainPrereq",
    stageId: entry.stageId,
    requiredStageIds,
  }
  if (!anchor) return [invalid(message)]
  return ctx.invalidRowIds.has(anchor.id) ? [consequence(message)] : []
}

function pickChainAnchor(
  prev: TimelineEntry | undefined,
  requiredStageIds: string[],
): TimelineEntry | undefined {
  return prev && requiredStageIds.includes(prev.stageId) ? prev : undefined
}

function pickWindowAnchor(
  seen: Map<string, TimelineEntry> | undefined,
  requiredStageIds: string[],
): TimelineEntry | undefined {
  for (const id of requiredStageIds) {
    const hit = seen?.get(id)
    if (hit) return hit
  }
  return undefined
}

function checkStageSequence(i: number, ctx: WalkContext): RawFinding[] {
  const entry = ctx.entries[i]
  const requiredSequence = ctx.resolved[i]?.requiresSequence ?? 0
  if (requiredSequence === 0) return []
  const slotIndex = ctx.slots.findIndex((id) => id === entry.characterId)
  const sequence = slotIndex >= 0 ? (ctx.loadouts[slotIndex]?.sequence ?? 0) : 0
  return sequence < requiredSequence
    ? [
        invalid({
          kind: "stageRequiresSequence",
          stageId: entry.stageId,
          requiredSequence,
        }),
      ]
    : []
}

function checkSwapForcesDifferentChar(
  i: number,
  ctx: WalkContext,
): RawFinding[] {
  const entry = ctx.entries[i]
  if (i + 1 >= ctx.entries.length || entry.variantKind !== "swap") return []
  return ctx.entries[i + 1].characterId === entry.characterId
    ? [warning({ kind: "swapForcesDifferentChar" })]
    : []
}
