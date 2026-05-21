import { useState } from "react"
import type { SimulationLogEntry } from "#/types/simulation-log"
import { ActionEventRow } from "./ActionEventRow"
import { HitEventRow } from "./HitEventRow"
import { BuffEventRow, isBuff } from "./BuffEventRow"

const headerCell = "px-2 py-2 font-mono text-xs tracking-[1px] uppercase"

export function LogTable({ log }: { log: SimulationLogEntry[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const onToggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

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
        {log.map((entry, i) => {
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
          return null
        })}
      </tbody>
    </table>
  )
}
