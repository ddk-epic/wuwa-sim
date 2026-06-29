import { Trash2 } from "lucide-react"
import { IconBtn } from "#/components/ui/IconBtn"
import type { TimelineDrag } from "#/hooks/useTimelineDrag"

function colCount(showWait: boolean): number {
  return showWait ? 12 : 11
}

export function OpenerHeaderRow({ showWait = false }: { showWait?: boolean }) {
  return (
    <tr className="border-t border-border bg-darkest">
      <td
        colSpan={colCount(showWait)}
        className="px-3 py-1 font-mono text-xs uppercase tracking-[1px] text-muted-foreground"
      >
        Opener
      </td>
    </tr>
  )
}

interface LoopMarkerRowProps {
  markerId: string
  containerIndex: number
  drag: TimelineDrag
  hidden?: boolean
  showWait?: boolean
  onDelete: () => void
}

export function LoopMarkerRow({
  markerId,
  containerIndex,
  drag,
  hidden = false,
  showWait = false,
  onDelete,
}: LoopMarkerRowProps) {
  const source = drag.markerSource(markerId, containerIndex)
  const isDragging = drag.draggedId === markerId
  return (
    <tr
      draggable
      onDragStart={source.onDragStart}
      onDragEnd={source.onDragEnd}
      className={[
        "border-t-2 border-glacio cursor-grab bg-darkest",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
      style={hidden ? { display: "none" } : undefined}
    >
      <td
        colSpan={colCount(showWait) - 1}
        className="px-3 py-1 font-mono text-xs font-bold uppercase tracking-[1px] text-glacio"
      >
        Loop
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center justify-end pr-px -my-1">
          <IconBtn
            icon={Trash2}
            label="Delete loop marker"
            variant="destructive"
            w={24}
            h={30}
            onClick={onDelete}
          />
        </div>
      </td>
    </tr>
  )
}
