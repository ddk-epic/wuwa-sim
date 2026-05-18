interface DisplayProps {
  label: string
  value: string
  accent?: string
  big?: true | undefined
}

function Display({ label, value, accent, big }: DisplayProps) {
  return (
    <div className="flex items-baseline gap-1.25">
      <span className="tracking-[0.5px] text-xs text-muted-foreground font-mono">
        {label}
      </span>

      <span
        className={`font-semibold tracking-[-0.2px] tabular-nums font-mono ${
          big ? "text-2xl" : "text-lg"
        }
          ${accent}`}
      >
        {value}
      </span>
    </div>
  )
}

interface TableTopBarProps {
  entriesNumber: number
  totalDmg: number
  dps: number
  totalTimeSec: number
  onAddGroup: () => void
}

export function TableTopBar({
  entriesNumber,
  totalDmg,
  dps,
  totalTimeSec,
  onAddGroup,
}: TableTopBarProps) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-4 px-4 border-b border-border bg-card">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-foreground">Timeline</span>

        <span className="space-x-2 text-muted-foreground">
          <span>·</span>
          <span className="font-mono">{entriesNumber}</span> actions
        </span>
      </div>

      <button
        className="items-center gap-1 px-2.5 py-0.5 font-mono text-sm rounded-sm border border-border text-muted-foreground hover:text-foreground"
        onClick={onAddGroup}
      >
        + Group
      </button>

      <div className="flex-1" />

      <Display
        label="dmg"
        value={totalDmg.toLocaleString()}
        accent="text-[#f5cf4d]"
        big
      />

      <Display
        label="dps"
        value={dps.toLocaleString()}
        accent="text-[#5ad7f0]"
      />

      <Display label="time" value={`${totalTimeSec.toFixed(2)}s`} />
    </div>
  )
}
