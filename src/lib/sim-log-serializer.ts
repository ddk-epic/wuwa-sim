import type {
  SimulationLogEntry,
  ActionEvent,
  HitEvent,
  SustainEvent,
  BuffEvent,
  ActiveBuff,
} from "#/types/simulation-log"

/**
 * Deterministic text projection of a Simulation Log, one line per entry, in
 * **log order** (never re-sorted — the order IS the product). Built as the
 * characterization oracle for the first-class-emitHits port (ADR-0028): it
 * surfaces the three things the worklist can silently corrupt —
 *
 *  1. **order** — the line sequence is the log sequence,
 *  2. **damage / heal amount** — a reorder that crosses a buff/resource
 *     mutation changes the resolved number,
 *  3. **active-buff set** — a snapshot taken at the wrong frame (§6) changes
 *     which buffs are live at the hit.
 *
 * Buff *sets* are sorted (membership is the signal, not their array order);
 * everything else is emitted verbatim so any reordering shows up in a diff.
 */
export function serializeLog(log: readonly SimulationLogEntry[]): string {
  return log.map(serializeEntry).join("\n")
}

function serializeEntry(e: SimulationLogEntry): string {
  switch (e.kind) {
    case "action":
      return serializeAction(e)
    case "hit":
      return serializeHit(e)
    case "sustain":
      return serializeSustain(e)
    default:
      return serializeBuff(e)
  }
}

/** Stable numeric format — integers stay bare, fractions pin to 3 dp. */
function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3)
}

function frame(f: number): string {
  return `@${String(f).padStart(4, " ")}`
}

function res(energy: number, concerto: number): string {
  return `E=${num(energy)} C=${num(concerto)}`
}

/** Membership-only projection of active buffs: sorted `id×stacks`. */
function buffs(active: readonly ActiveBuff[]): string {
  if (active.length === 0) return "buffs=[]"
  const ids = active
    .map((b) => (b.stacks > 1 ? `${b.id}×${b.stacks}` : b.id))
    .sort()
  return `buffs=[${ids.join(",")}]`
}

function originTags(e: HitEvent | SustainEvent): string {
  const tags: string[] = []
  if (e.synthetic) tags.push(e.coord ? "coord" : "synth")
  if (e.sourceBuffId) tags.push(`from=${e.sourceBuffId}`)
  return tags.length ? ` (${tags.join(" ")})` : ""
}

function serializeAction(e: ActionEvent): string {
  const parts = [
    frame(e.frame),
    "ACTION",
    `c${e.characterId}`,
    `"${e.skillName}"`,
    `[${e.skillType}]`,
    res(e.cumulativeEnergy, e.cumulativeConcerto),
  ]
  if (e.variantKind) parts.push(`var=${e.variantKind}`)
  if (e.delayBreakdown) {
    const d = e.delayBreakdown
    const split = (["react", "floor", "pad", "fall", "swapBack"] as const)
      .filter((k) => d[k] > 0)
      .map((k) => `${k}:${d[k]}`)
    if (split.length) parts.push(`delay{${split.join(",")}}`)
  }
  return parts.join(" ")
}

function serializeHit(e: HitEvent): string {
  return (
    [
      frame(e.frame),
      "HIT  ",
      `c${e.characterId}`,
      `"${e.skillName}"`,
      `[${e.skillType}/${e.dmgType}]`,
      `dmg=${num(e.damage)}`,
      res(e.cumulativeEnergy, e.cumulativeConcerto),
      buffs(e.activeBuffs),
    ].join(" ") + originTags(e)
  )
}

function serializeSustain(e: SustainEvent): string {
  return (
    [
      frame(e.frame),
      "HEAL ",
      `c${e.characterId}`,
      `"${e.skillName}"`,
      `[${e.sub}]`,
      `amt=${num(e.amount)}`,
      `tgt=[${[...e.targets].sort((a, b) => a - b).join(",")}]`,
      res(e.cumulativeEnergy, e.cumulativeConcerto),
      buffs(e.activeBuffs),
    ].join(" ") + originTags(e)
  )
}

function serializeBuff(e: BuffEvent): string {
  const sym = {
    buffApplied: "BUFF+",
    buffRefreshed: "BUFF~",
    buffExpired: "BUFF-",
    buffConsumed: "BUFF!",
  }[e.kind]
  const stacks = e.stacks > 1 ? `×${e.stacks}` : ""
  return [
    frame(e.frame),
    sym,
    `${e.buffId}${stacks}`,
    `src=c${e.sourceCharacterId}`,
    `tgt=c${e.targetCharacterId}`,
  ].join(" ")
}
