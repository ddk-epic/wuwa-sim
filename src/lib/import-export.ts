import { ALL_CHARACTERS } from "#/data/characters"
import { ALL_ECHOES } from "#/data/echoes"
import { ALL_ECHO_SETS } from "#/data/echo-sets"
import { ALL_WEAPONS } from "#/data/weapons"
import { makeStageId } from "#/lib/stage"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry, TimelineNode } from "#/types/timeline"

export interface ImportExportPayload {
  team: {
    slots: Slots
    loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
    focusedId: number | null
  }
  timeline: TimelineNode[] | null
}

// ---- Base91 codec ----
const B91 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"'

function b91encode(src: Uint8Array): string {
  let o = "",
    b = 0,
    n = 0,
    v = -1
  for (const x of src) {
    b |= x << n
    n += 8
    if (n > 13) {
      let m = b & 8191
      if (m > 88) {
        b >>= 13
        n -= 13
      } else {
        m = b & 16383
        b >>= 14
        n -= 14
      }
      if (v < 0) v = m
      else {
        v += m * 91
        o += B91[v % 91] + B91[(v / 91) | 0]
        v = -1
      }
    }
  }
  if (v > -1) o += B91[v % 91] + B91[(v / 91) | 0]
  else if (n) {
    o += B91[b % 91]
    if (b > 90 || n > 7) o += B91[(b / 91) | 0]
  }
  return o
}

function b91decode(src: string): Uint8Array {
  const idx = new Uint8Array(256).fill(255)
  for (let i = 0; i < 91; i++) idx[B91.charCodeAt(i)] = i
  const out: number[] = []
  let v = -1,
    b = 0,
    n = 0
  for (const ch of src) {
    const c = idx[ch.charCodeAt(0)]
    if (c === 255) continue
    if (v < 0) v = c
    else {
      v += c * 91
      b |= v << n
      n += (v & 8191) > 88 ? 13 : 14
      v = -1
      do {
        out.push(b & 0xff)
        b >>= 8
        n -= 8
      } while (n > 7)
    }
  }
  if (v > -1) out.push((b | (v << n)) & 0xff)
  return new Uint8Array(out)
}

// ---- Static lookup tables ----
const NULL_BYTE = 0xff
const ECHO_BUILDS = ["4-3-3-1-1", "4-4-1-1-1"] as const
const COST4_MAINS = ["scaling", "cr", "cd"] as const
const COST3_MAINS = ["scaling", "er", "elemDmg"] as const
const VARIANT_KINDS = ["cancel", "instantCancel", "swap"] as const

// Sorted list of all stageIds produced by makeStageId across all character skills and echoes.
const ALL_STAGE_IDS: readonly string[] = (() => {
  const ids = new Set<string>()
  for (const char of ALL_CHARACTERS) {
    for (const skill of char.skills) {
      for (const stage of skill.stages) {
        ids.add(makeStageId(skill.name, stage.newName))
      }
    }
  }
  for (const echo of ALL_ECHOES) {
    for (const stage of echo.skill.stages) {
      ids.add(makeStageId(echo.name, stage.newName))
    }
  }
  return [...ids].sort()
})()

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

// ---- Index helpers (game ID → array index, null → NULL_BYTE) ----
const charIdx = (id: number | null) => {
  if (id === null) return NULL_BYTE
  const i = ALL_CHARACTERS.findIndex((c) => c.id === id)
  if (i < 0) throw new Error(`Unknown character id ${id}`)
  return i
}
const weaponIdx = (id: number | null) => {
  if (id === null) return NULL_BYTE
  const i = ALL_WEAPONS.findIndex((w) => w.id === id)
  if (i < 0) throw new Error(`Unknown weapon id ${id}`)
  return i
}
const echoIdx = (id: number | null) => {
  if (id === null) return NULL_BYTE
  const i = ALL_ECHOES.findIndex((e) => e.id === id)
  if (i < 0) throw new Error(`Unknown echo id ${id}`)
  return i
}
const echoSetIdx = (id: number | null) => {
  if (id === null) return NULL_BYTE
  const i = ALL_ECHO_SETS.findIndex((s) => s.id === id)
  if (i < 0) throw new Error(`Unknown echo set id ${id}`)
  return i
}
const stageIdx = (stageId: string) => {
  const i = ALL_STAGE_IDS.indexOf(stageId)
  if (i < 0) throw new Error(`Unknown stageId "${stageId}"`)
  return i
}

// ---- Encode ----
const VERSION = 1

export function encodePayload(payload: ImportExportPayload): string {
  const w = new Writer()
  w.push(VERSION)

  const { team, timeline } = payload
  w.push(charIdx(team.focusedId))
  for (const id of team.slots) w.push(charIdx(id))

  for (const l of team.loadouts) {
    w.push(weaponIdx(l.weaponId))
    w.push(l.weaponRank)
    w.push(echoIdx(l.echoId))
    w.push(echoSetIdx(l.echoSetSlot1Id))
    w.push(echoSetIdx(l.echoSetSlot2Id))
    w.push(l.sequence)
    const bi = ECHO_BUILDS.indexOf(l.echoBuild)
    w.push(bi)
    // counts fixed by echoBuild: "4-3-3-1-1" → (1 cost4, 2 cost3), "4-4-1-1-1" → (2 cost4, 0 cost3)
    const c4 = bi === 0 ? 1 : 2
    const c3 = bi === 0 ? 2 : 0
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
        w.push(stageIdx(node.stageId))
        w.push(
          node.variantKind ? VARIANT_KINDS.indexOf(node.variantKind) + 1 : 0,
        )
      } else {
        w.push(1)
        w.push(node.locked ? 1 : 0)
        w.str(node.label)
        w.push(node.entries.length)
        for (const e of node.entries) {
          w.push(charIdx(e.characterId))
          w.push(stageIdx(e.stageId))
          w.push(e.variantKind ? VARIANT_KINDS.indexOf(e.variantKind) + 1 : 0)
        }
      }
    }
  }

  return b91encode(w.bytes())
}

// ---- Decode ----
function readEntry(r: Reader): TimelineEntry {
  const ci = r.next()
  const si = r.next()
  const vk = r.next()
  return {
    id: crypto.randomUUID(),
    characterId: ALL_CHARACTERS[ci].id,
    stageId: ALL_STAGE_IDS[si],
    variantKind: vk === 0 ? undefined : VARIANT_KINDS[vk - 1],
  }
}

export function decodePayload(encoded: string): ImportExportPayload {
  let data: Uint8Array
  try {
    data = b91decode(encoded.trim())
  } catch {
    throw new Error("Invalid export code")
  }

  const r = new Reader(data)

  const version = r.next()
  if (version !== VERSION)
    throw new Error(`Unsupported format version ${version}`)

  const focusedIdx = r.nullable()
  const focusedId = focusedIdx === null ? null : ALL_CHARACTERS[focusedIdx].id

  const slots = [r.nullable(), r.nullable(), r.nullable()].map((i) =>
    i === null ? null : ALL_CHARACTERS[i].id,
  ) as Slots

  const loadouts = [0, 1, 2].map((): SlotLoadout => {
    const wIdx = r.nullable()
    const weaponRank = r.next()
    const eIdx = r.nullable()
    const es1Idx = r.nullable()
    const es2Idx = r.nullable()
    const sequence = r.next()
    const bi = r.next()
    const echoBuild = ECHO_BUILDS[bi]
    const c4 = bi === 0 ? 1 : 2
    const c3 = bi === 0 ? 2 : 0
    return {
      weaponId: wIdx === null ? null : ALL_WEAPONS[wIdx].id,
      weaponRank,
      echoId: eIdx === null ? null : ALL_ECHOES[eIdx].id,
      echoSetSlot1Id: es1Idx === null ? null : ALL_ECHO_SETS[es1Idx].id,
      echoSetSlot2Id: es2Idx === null ? null : ALL_ECHO_SETS[es2Idx].id,
      sequence,
      echoBuild,
      cost4Mains: Array.from({ length: c4 }, () => COST4_MAINS[r.next()]),
      cost3Mains: Array.from({ length: c3 }, () => COST3_MAINS[r.next()]),
    }
  }) as [SlotLoadout, SlotLoadout, SlotLoadout]

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

  return { team: { slots, loadouts, focusedId }, timeline }
}
