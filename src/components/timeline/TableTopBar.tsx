import { useSetAtom } from "jotai"
import { renamingGroupIdAtom } from "#/state/renaming"

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
  stale?: boolean
  hasLoopMarker: boolean
  onAddGroup: () => string
  onAddLoopMarker: () => void
}

export function TableTopBar({
  entriesNumber,
  totalDmg,
  dps,
  totalTimeSec,
  stale,
  hasLoopMarker,
  onAddGroup,
  onAddLoopMarker,
}: TableTopBarProps) {
  const setRenamingGroupId = useSetAtom(renamingGroupIdAtom)
  return (
    <div className="flex h-11 shrink-0 items-center gap-4 px-4 border-b border-border bg-card">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-foreground">Timeline</span>

        <span className="space-x-2 text-muted-foreground font-mono">
          <span>·</span>
          {stale ? (
            <span>outdated</span>
          ) : (
            <>
              <span>{entriesNumber}</span> actions
            </>
          )}
        </span>
      </div>

      <div className="flex-1" />

      <button
        className="items-center gap-1 px-1.5 py-0.75 font-mono text-sm rounded-sm border border-muted-foreground text-muted-foreground hover:text-foreground"
        onClick={() => setRenamingGroupId(onAddGroup())}
      >
        + Group
      </button>

      <button
        className="items-center gap-1 px-1.5 py-0.75 font-mono text-sm rounded-sm border border-muted-foreground text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
        disabled={hasLoopMarker}
        onClick={onAddLoopMarker}
      >
        + Loop
      </button>

      <div className="flex items-end gap-3">
        <Display
          label="dmg"
          value={totalDmg > 0 ? totalDmg.toLocaleString() : " — "}
          accent={
            !stale && totalDmg > 0 ? "text-spectro" : "text-muted-foreground"
          }
          big
        />

        <Display
          label="dps"
          value={dps > 0 ? dps.toLocaleString() : " — "}
          accent={!stale && dps > 0 ? "text-glacio" : "text-muted-foreground"}
        />

        <Display label="time" value={`${totalTimeSec.toFixed(2)}s`} />
      </div>
    </div>
  )
}
