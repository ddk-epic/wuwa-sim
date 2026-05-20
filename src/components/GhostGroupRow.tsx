import type { RenderItem } from "#/lib/timeline-render-items"
import type { DropHandlerBundle } from "#/hooks/useTimelineDrag"

type GroupGhostItem = Extract<RenderItem, { type: "groupGhost" }>

interface GhostGroupRowProps {
  item: GroupGhostItem
  handlers: DropHandlerBundle
}

export function GhostGroupRow({ item, handlers }: GhostGroupRowProps) {
  const { label, entryCount, dominantHex } = item
  return (
    <tr
      className="opacity-40"
      onDragOver={handlers.onDragOver}
      onDrop={handlers.onDrop}
    >
      <td className="px-2 py-1.5 w-8" />
      <td className="px-2 py-1.5 w-18" />
      <td className="px-2 py-1.5 w-36" />
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
