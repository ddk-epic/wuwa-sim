import { decode as base91Decode, encode as base91Encode } from "./base91"
import { ALL_CHARACTERS } from "#/data/characters"
import { ALL_ECHOES } from "#/data/echoes"
import { compileCharacter, compileEcho } from "#/lib/compile-character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import { ECHO_BUILDS as ECHO_BUILD_LAYOUTS } from "#/lib/loadout/echo-stat-constants"
import type { TimelineEntry, TimelineNode } from "#/types/timeline"
import { DEFAULT_SETTINGS } from "#/lib/settings"
import type { Settings } from "#/lib/settings"
import {
  BUILD_WIRE_ORDER,
  CHARACTER_WIRE,
  COST3_MAINS,
  COST4_MAINS,
  ECHO_SET_WIRE,
  ECHO_WIRE,
  fromWire,
  SKILL_WIRE,
  toWire,
  VARIANT_KINDS,
  WEAPON_WIRE,
} from "#/lib/share/wire-tables"

export interface ImportExportPayload {
  team: {
    /** Mirrors `SavedTeam.name` so exported codes round-trip the label (wire VERSION 2). */
    name: string
    slots: Slots
    loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
    focusedId: number | null
    settings?: Settings
  }
  timeline: TimelineNode[] | null
}

// ---- Static lookup tables ----
const NULL_BYTE = 0xff
const ECHO_STAGE_FLAG = 0x80

// A stage's wire identity is (skill, ordinal-within-skill): a selector byte —
// the skill's index in the character's SKILL_WIRE (high bit clear) or the echo's
// index in ECHO_WIRE (high bit set) — then the stage's ordinal within that
// skill. Rebuilt from the compiled data. See docs/share.md.
interface OwnStage {
  skillId: number
  ordinal: number
}
const ownStageToWire = new Map<number, Map<string, OwnStage>>()
const ownStagesBySkill = new Map<number, Map<number, string[]>>()
for (const char of ALL_CHARACTERS) {
  const stageWire = new Map<string, OwnStage>()
  const bySkill = new Map<number, string[]>()
  for (const info of compileCharacter(char).stageIndex.values()) {
    const skillId = info.skill.id
    let stages = bySkill.get(skillId)
    if (stages === undefined) bySkill.set(skillId, (stages = []))
    stageWire.set(info.stageId, { skillId, ordinal: stages.length })
    stages.push(info.stageId)
  }
  ownStageToWire.set(char.id, stageWire)
  ownStagesBySkill.set(char.id, bySkill)
}

interface EchoStage {
  echoId: number
  ordinal: number
}
const echoStageToWire = new Map<string, EchoStage>()
const echoStagesById = new Map<number, string[]>()
for (const echo of ALL_ECHOES) {
  const stages: string[] = []
  for (const info of compileEcho(echo).stageIndex.values()) {
    echoStageToWire.set(info.stageId, {
      echoId: echo.id,
      ordinal: stages.length,
    })
    stages.push(info.stageId)
  }
  echoStagesById.set(echo.id, stages)
}

// ---- Byte writer / reader ----
class Writer {
  private b: number[] = []
  push(v: number) {
    this.b.push(v & 0xff)
  }
  str(s: string) {
    const bytes = new TextEncoder().encode(s)
    this.push(bytes.length)
    bytes.forEach((b) => this.push(b))
  }
  bytes() {
    return new Uint8Array(this.b)
  }
}

class Reader {
  pos = 0
  constructor(private d: Uint8Array) {}
  next() {
    if (this.pos >= this.d.length) throw new Error("Unexpected end of data")
    return this.d[this.pos++]
  }
  nullable() {
    const v = this.next()
    return v === NULL_BYTE ? null : v
  }
  str() {
    const len = this.next()
    const bytes = this.d.slice(this.pos, this.pos + len)
    this.pos += len
    return new TextDecoder().decode(bytes)
  }
}

// ---- Index helpers (game ID → wire index, null → NULL_BYTE) ----
const charIdx = (id: number | null) =>
  id === null ? NULL_BYTE : toWire(CHARACTER_WIRE, id, "character")
const weaponIdx = (id: number | null) =>
  id === null ? NULL_BYTE : toWire(WEAPON_WIRE, id, "weapon")
const echoIdx = (id: number | null) =>
  id === null ? NULL_BYTE : toWire(ECHO_WIRE, id, "echo")
const echoSetIdx = (id: number | null) =>
  id === null ? NULL_BYTE : toWire(ECHO_SET_WIRE, id, "echo set")

const skillWireFor = (charId: number): readonly number[] => {
  const wire = SKILL_WIRE[charId] as readonly number[] | undefined
  if (wire === undefined)
    throw new Error(`No skill wire for character ${charId}`)
  return wire
}

// (selector, ordinal) for a stage cast by the given character.
const stageBytes = (charId: number, stageId: string): [number, number] => {
  const own = ownStageToWire.get(charId)?.get(stageId)
  if (own !== undefined) {
    const skillWire = skillWireFor(charId).indexOf(own.skillId)
    if (skillWire < 0) throw new Error(`Unknown skill id ${own.skillId}`)
    if (skillWire >= ECHO_STAGE_FLAG)
      throw new Error(`Skill wire index ${skillWire} overflows selector`)
    return [skillWire, own.ordinal]
  }
  const echo = echoStageToWire.get(stageId)
  if (echo !== undefined) {
    const echoWire = toWire(ECHO_WIRE, echo.echoId, "echo")
    if (echoWire >= ECHO_STAGE_FLAG)
      throw new Error(`Echo wire index ${echoWire} overflows selector`)
    return [ECHO_STAGE_FLAG | echoWire, echo.ordinal]
  }
  throw new Error(`Unknown stageId "${stageId}"`)
}

const stageId = (charId: number, selector: number, ordinal: number): string => {
  if (selector & ECHO_STAGE_FLAG) {
    const echoId = fromWire(ECHO_WIRE, selector & ~ECHO_STAGE_FLAG, "echo")
    const stage = echoStagesById.get(echoId)?.[ordinal]
    if (stage === undefined)
      throw new Error(`Unknown echo stage ${echoId}:${ordinal}`)
    return stage
  }
  const wire = skillWireFor(charId)
  if (selector >= wire.length)
    throw new Error(`Unknown skill wire index ${charId}:${selector}`)
  const stage = ownStagesBySkill.get(charId)?.get(wire[selector])?.[ordinal]
  if (stage === undefined) throw new Error(`Unknown stage ${charId}:${ordinal}`)
  return stage
}

// ---- Slug prefix (legible label outside the Base91 envelope) ----
// Frozen contract: changing this normalisation invalidates the prefix of every
// previously emitted code, which decode then rejects as mismatched. Output is
// hyphen-free so the prefix splits unambiguously from the blob.
const EMPTY_SLOT_SLUG = "none"
const charSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "")
const slotSlug = (id: number | null) => {
  if (id === null) return EMPTY_SLOT_SLUG
  const char = ALL_CHARACTERS.find((c) => c.id === id)
  if (!char) throw new Error(`Unknown character id ${id}`)
  return charSlug(char.name)
}
const slugPrefix = (slots: Slots) => slots.map(slotSlug).join("-")

// ---- Encode ----
// v6 is a hard cut: entity refs index the frozen wire tables, and a stage is a
// (skill selector, ordinal) pair. Earlier versions are rejected, not migrated.
const VERSION = 6

export function encodePayload(payload: ImportExportPayload): string {
  const w = new Writer()
  w.push(VERSION)

  const { team, timeline } = payload
  w.str(team.name)
  w.push(charIdx(team.focusedId))
  for (const id of team.slots) w.push(charIdx(id))

  for (const l of team.loadouts) {
    w.push(weaponIdx(l.weaponId))
    w.push(l.weaponRank)
    w.push(echoIdx(l.echoId))
    w.push(echoSetIdx(l.echoSetSlot1Id))
    w.push(echoSetIdx(l.echoSetSlot2Id))
    w.push(l.sequence)
    w.push(BUILD_WIRE_ORDER.indexOf(l.echoBuild))
    const { cost4: c4, cost3: c3 } = ECHO_BUILD_LAYOUTS[l.echoBuild]
    for (let j = 0; j < c4; j++) w.push(COST4_MAINS.indexOf(l.cost4Mains[j]))
    for (let j = 0; j < c3; j++) w.push(COST3_MAINS.indexOf(l.cost3Mains[j]))
  }

  if (timeline === null) {
    w.push(NULL_BYTE)
  } else {
    w.push(timeline.length)
    for (const node of timeline) {
      if (node.kind === "entry") {
        w.push(0)
        w.push(charIdx(node.characterId))
        for (const b of stageBytes(node.characterId, node.stageId)) w.push(b)
        w.push(
          node.variantKind ? VARIANT_KINDS.indexOf(node.variantKind) + 1 : 0,
        )
      } else if (node.kind === "loopMarker") {
        w.push(2)
      } else {
        w.push(1)
        w.push(node.locked ? 1 : 0)
        w.str(node.label)
        w.push(node.entries.length)
        for (const e of node.entries) {
          w.push(charIdx(e.characterId))
          for (const b of stageBytes(e.characterId, e.stageId)) w.push(b)
          w.push(e.variantKind ? VARIANT_KINDS.indexOf(e.variantKind) + 1 : 0)
        }
      }
    }
  }

  const s = team.settings ?? DEFAULT_SETTINGS
  w.push(s.reactionDelay)
  w.push(s.swapFrames)
  w.push(s.variantFloor)
  w.push(s.fallFrames)
  w.push(s.startWithFullEnergy ? 1 : 0)
  w.push(s.startWithFullConcerto ? 1 : 0)

  return `${slugPrefix(team.slots)}-${base91Encode(w.bytes())}`
}

// ---- Decode ----
function readEntry(r: Reader): TimelineEntry {
  const charId = fromWire(CHARACTER_WIRE, r.next(), "character")
  const selector = r.next()
  const ordinal = r.next()
  const vk = r.next()
  return {
    id: crypto.randomUUID(),
    characterId: charId,
    stageId: stageId(charId, selector, ordinal),
    variantKind: vk === 0 ? undefined : VARIANT_KINDS[vk - 1],
  }
}

export function decodePayload(encoded: string): ImportExportPayload {
  // The slug prefix lives outside the Base91 envelope; the blob is the substring
  // after the last hyphen (hyphen is absent from the Base91 alphabet). A legacy
  // code has no hyphen and is a bare blob.
  const trimmed = encoded.trim()
  const lastHyphen = trimmed.lastIndexOf("-")
  const incomingPrefix = lastHyphen === -1 ? null : trimmed.slice(0, lastHyphen)
  const blob = lastHyphen === -1 ? trimmed : trimmed.slice(lastHyphen + 1)

  let data: Uint8Array
  try {
    data = base91Decode(blob)
  } catch {
    throw new Error("Invalid export code")
  }

  const r = new Reader(data)

  const version = r.next()
  if (version !== VERSION)
    throw new Error(
      `Unsupported format version ${version}; re-export this code from the current app`,
    )

  const name = r.str()

  const focusedIdx = r.nullable()
  const focusedId =
    focusedIdx === null
      ? null
      : fromWire(CHARACTER_WIRE, focusedIdx, "character")

  const readSlot = (): number | null => {
    const i = r.nullable()
    return i === null ? null : fromWire(CHARACTER_WIRE, i, "character")
  }
  const slots: Slots = [readSlot(), readSlot(), readSlot()]

  // Reject a present-but-mismatched label as tampered; the blob is authoritative.
  if (incomingPrefix !== null && incomingPrefix !== slugPrefix(slots))
    throw new Error("Export code label does not match its contents")

  const readLoadout = (): SlotLoadout => {
    const wIdx = r.nullable()
    const weaponRank = r.next()
    const eIdx = r.nullable()
    const es1Idx = r.nullable()
    const es2Idx = r.nullable()
    const sequence = r.next()
    const echoBuild = BUILD_WIRE_ORDER[r.next()]
    const { cost4: c4, cost3: c3 } = ECHO_BUILD_LAYOUTS[echoBuild]
    return {
      weaponId: wIdx === null ? null : fromWire(WEAPON_WIRE, wIdx, "weapon"),
      weaponRank,
      echoId: eIdx === null ? null : fromWire(ECHO_WIRE, eIdx, "echo"),
      echoSetSlot1Id:
        es1Idx === null ? null : fromWire(ECHO_SET_WIRE, es1Idx, "echo set"),
      echoSetSlot2Id:
        es2Idx === null ? null : fromWire(ECHO_SET_WIRE, es2Idx, "echo set"),
      sequence,
      echoBuild,
      cost4Mains: Array.from({ length: c4 }, () => COST4_MAINS[r.next()]),
      cost3Mains: Array.from({ length: c3 }, () => COST3_MAINS[r.next()]),
    }
  }
  const loadouts: [SlotLoadout, SlotLoadout, SlotLoadout] = [
    readLoadout(),
    readLoadout(),
    readLoadout(),
  ]

  const timelineCount = r.next()
  let timeline: TimelineNode[] | null

  if (timelineCount === NULL_BYTE) {
    timeline = null
  } else {
    timeline = []
    for (let i = 0; i < timelineCount; i++) {
      const kind = r.next()
      if (kind === 0) {
        timeline.push({ kind: "entry", ...readEntry(r) })
      } else if (kind === 2) {
        timeline.push({ kind: "loopMarker", id: crypto.randomUUID() })
      } else {
        const locked = r.next() === 1
        const label = r.str()
        const entryCount = r.next()
        timeline.push({
          kind: "group",
          id: crypto.randomUUID(),
          locked,
          label,
          entries: Array.from({ length: entryCount }, () => readEntry(r)),
        })
      }
    }
  }

  const settings: Settings = {
    reactionDelay: r.next(),
    swapFrames: r.next(),
    variantFloor: r.next(),
    fallFrames: r.next(),
    startWithFullEnergy: r.next() === 1,
    startWithFullConcerto: r.next() === 1,
  }

  return { team: { name, slots, loadouts, focusedId, settings }, timeline }
}
