import { Trash2 } from "lucide-react"
import { IconBtn } from "#/components/ui/IconBtn"
import type { TimelineDrag } from "#/hooks/useTimelineDrag"

function colCount(showWait: boolean): number {
  return showWait ? 12 : 11
}

const bandClass =
  "relative flex items-center justify-center border-y border-ui-damage/20 bg-gradient-to-r from-transparent via-ui-damage/20 to-transparent px-3 py-0.5"
const labelClass =
  "py-0.75 text-xs font-semibold uppercase leading-none tracking-[1.5px] text-ui-damage"

export function OpenerHeaderRow({ showWait = false }: { showWait?: boolean }) {
  return (
    <tr>
      <td colSpan={colCount(showWait)}>
        <div className={bandClass}>
          <span className={labelClass}>Opener</span>
        </div>
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
      className={`cursor-grab ${isDragging ? "opacity-40" : ""}`}
      style={hidden ? { display: "none" } : undefined}
    >
      <td colSpan={colCount(showWait)}>
        <div className={bandClass}>
          <span className={labelClass}>Loop</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            <IconBtn
              icon={Trash2}
              label="Delete loop marker"
              variant="destructive"
              w={24}
              h={26}
              onClick={onDelete}
            />
          </span>
        </div>
      </td>
    </tr>
  )
}
