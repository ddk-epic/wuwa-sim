import type { RenderItem } from "#/lib/timeline/timeline-render-items"
import type { DropHandlerBundle } from "#/hooks/useTimelineDrag"
import { characterVisual } from "#/components/ui/character-visual"

type GroupGhostItem = Extract<RenderItem, { type: "groupGhost" }>

interface GhostGroupRowProps {
  item: GroupGhostItem
  handlers: DropHandlerBundle
  showWait?: boolean
}

export function GhostGroupRow({
  item,
  handlers,
  showWait = false,
}: GhostGroupRowProps) {
  const { label, entryCount, dominantHex, distinctCharIds } = item
  return (
    <tr
      className="opacity-40"
      onDragOver={handlers.onDragOver}
      onDrop={handlers.onDrop}
    >
      <td className="px-2 py-1.5 w-8" />
      <td className="px-2 py-1.5 w-18" />
      {showWait && <td className="px-0 py-1.5 w-7.5" />}
      <td className="px-2 py-1.5 w-36">
        <div className="flex items-center">
          {distinctCharIds.map((charId, idx) => {
            const { hex } = characterVisual(charId)
            return (
              <span
                key={charId}
                className="w-5 h-5 rounded-full"
                style={{
                  marginLeft: idx > 0 ? "-6px" : undefined,
                  outline: `1.5px solid ${hex}93`,
                  outlineOffset: "0px",
                }}
              />
            )
          })}
        </div>
      </td>
      <td className="px-2 py-1.5 w-16">
        <span
          className="inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase"
          style={{
            background: `${dominantHex}15`,
            border: `1px solid ${dominantHex}33`,
            color: dominantHex,
          }}
        >
          GROUP
        </span>
      </td>
      <td className="px-2 py-1.5">
        <span className="text-sm text-gray-200 font-medium">
          ◈ {label || "Group"} · {entryCount} entries
        </span>
      </td>
      <td className="px-2 py-1.5 w-18" />
      <td className="px-2 py-1.5 w-20" />
      <td className="px-2 py-1.5 w-20" />
      <td className="px-2 py-1.5 w-24" />
      <td className="px-2 py-1.5 w-20.75" />
    </tr>
  )
}
