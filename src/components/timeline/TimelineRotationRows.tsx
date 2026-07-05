import type { ReactNode } from "react"
import { Trash2 } from "lucide-react"
import { IconBtn } from "#/components/ui/IconBtn"
import type { TimelineDrag, DropHandlerBundle } from "#/hooks/useTimelineDrag"

function colCount(showWait: boolean): number {
  return showWait ? 12 : 11
}

const bandClass =
  "relative flex items-center justify-center border-y border-ui-damage/20 bg-gradient-to-r from-transparent via-ui-damage/20 to-transparent px-3 py-0.5"
const labelClass =
  "py-0.75 text-xs font-semibold uppercase leading-none tracking-[1.5px] text-ui-damage"

function RotationBand({
  label,
  children,
}: {
  label: string
  children?: ReactNode
}) {
  return (
    <div className={bandClass}>
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  )
}

export function OpenerHeaderRow({ showWait = false }: { showWait?: boolean }) {
  return (
    <tr>
      <td colSpan={colCount(showWait)}>
        <RotationBand label="Opener" />
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
      className={`group cursor-grab ${isDragging ? "opacity-40" : ""}`}
      style={hidden ? { display: "none" } : undefined}
    >
      <td colSpan={colCount(showWait)}>
        <RotationBand label="Loop">
          <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
            <IconBtn
              icon={Trash2}
              label="Delete loop marker"
              variant="destructive"
              w={24}
              h={26}
              onClick={onDelete}
            />
          </span>
        </RotationBand>
      </td>
    </tr>
  )
}

export function GhostLoopMarkerRow({
  handlers,
  showWait = false,
}: {
  handlers: DropHandlerBundle
  showWait?: boolean
}) {
  return (
    <tr
      className="opacity-40"
      onDragOver={handlers.onDragOver}
      onDrop={handlers.onDrop}
    >
      <td colSpan={colCount(showWait)}>
        <RotationBand label="Loop" />
      </td>
    </tr>
  )
}
