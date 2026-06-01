import { useState } from "react"
import type { SimulationLogEntry } from "#/types/simulation-log"
import { ActionEventRow } from "./ActionEventRow"
import { HitEventRow } from "./HitEventRow"
import { BuffEventRow, isBuff } from "./BuffEventRow"
import { SustainEventRow } from "./SustainEventRow"
import { groupBuffEvents } from "./groupBuffEvents"
import type { BuffGroupRow } from "./groupBuffEvents"
import { CharCell, CharChip, numCell, COL_COUNT } from "./log-cells"
import { formatFrames } from "#/lib/format"

const headerCell = "px-2 py-2 font-mono text-xs tracking-[1px] uppercase"

function verbAndColor(kind: BuffGroupRow["buffKind"]) {
  if (kind === "buffApplied")
    return { verb: "applied", color: "text-emerald-400/80" }
  if (kind === "buffRefreshed")
    return { verb: "refreshed", color: "text-emerald-400/80" }
  if (kind === "buffConsumed")
    return { verb: "consumed", color: "text-amber-400/80" }
  return { verb: "expired", color: "text-rose-400/70" }
}

function GroupedBuffRow({ row, index }: { row: BuffGroupRow; index: number }) {
  const { verb, color } = verbAndColor(row.buffKind)

  const allTargets = row.entries.flatMap((e) => e.targetCharacterIds)
  const uniqueTargets = [...new Set(allTargets)]
  const singleTarget = uniqueTargets.length === 1 ? uniqueTargets[0] : null
  const showInlineChips = singleTarget === null

  return (
    <tr className="border-t border-border/40 bg-darkest/40">
      <td className="px-2 py-1 font-mono text-xs text-right text-muted-foreground/60">
        {index + 1}
      </td>
      <td className={`${numCell} text-ui-damage text-label`}>
        {formatFrames(row.frame)}
      </td>
      <td className="px-2 py-1">
        {singleTarget !== null ? <CharCell id={singleTarget} /> : null}
      </td>
      <td className={`py-1 italic text-detail ${color}`}>buff {verb}</td>
      <td
        className="px-2 py-1 text-sm text-gray-300 whitespace-normal wrap-break-word"
        colSpan={Math.max(1, COL_COUNT - 4)}
      >
        {row.entries.map((e, j) => (
          <span key={`${e.buffId}-${e.stacks}`}>
            {j > 0 && <span className="text-muted-foreground/50">, </span>}
            {e.buffName}
            {e.stacks > 1 && (
              <span className="ml-1 text-muted-foreground/70">
                × {e.stacks}
              </span>
            )}
            {showInlineChips &&
              e.targetCharacterIds.map((id) => <CharChip key={id} id={id} />)}
          </span>
        ))}
      </td>
    </tr>
  )
}

export function LogTable({ log }: { log: SimulationLogEntry[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const onToggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const rows = groupBuffEvents(log)

  return (
    <table className="w-full text-sm text-left table-fixed min-w-300">
      <thead className="sticky top-0 z-10 bg-darkest border-b border-border">
        <tr className="text-muted-foreground">
          <th className={`${headerCell} text-right w-7.5`}>#</th>
          <th className={`${headerCell} text-right w-18`}>time</th>
          <th className={`${headerCell} w-36`}>char</th>
          <th className={`${headerCell} w-16`}>type</th>
          <th className={headerCell}>skill</th>
          <th className={`${headerCell} text-right w-16`}>con</th>
          <th className={`${headerCell} text-right w-16`}>res</th>
          <th className={`${headerCell} text-right w-22`}>dmg</th>
          <th className={`${headerCell} text-right w-24`}>scale</th>
          <th className={`${headerCell} text-right w-14`}>er</th>
          <th className={`${headerCell} text-right w-16`}>cr</th>
          <th className={`${headerCell} text-right w-16`}>cd</th>
          <th className={`${headerCell} text-right w-14`}>dmg%</th>
          <th className={`${headerCell} text-right w-12`}>deep</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          if (row.kind === "buffGroup") {
            return <GroupedBuffRow key={i} row={row} index={i} />
          }
          const entry = row.entry
          if (isBuff(entry)) {
            return <BuffEventRow key={i} buff={entry} index={i} />
          }
          if (entry.kind === "hit") {
            return (
              <HitEventRow
                key={i}
                ev={entry}
                index={i}
                isOpen={open.has(i)}
                onToggle={() => onToggle(i)}
              />
            )
          }
          if (entry.kind === "action") {
            return <ActionEventRow key={i} ev={entry} index={i} />
          }
          return <SustainEventRow key={i} ev={entry} index={i} />
        })}
      </tbody>
    </table>
  )
}
