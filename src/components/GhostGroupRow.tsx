import type { RenderItem } from "#/lib/timeline-render-items"
import type { DropHandlerBundle } from "#/hooks/useTimelineDrag"
import { getCharacterById } from "#/lib/catalog"
import { ELEMENT_HEX } from "#/data/elements"

type GroupGhostItem = Extract<RenderItem, { type: "groupGhost" }>

interface GhostGroupRowProps {
  item: GroupGhostItem
  handlers: DropHandlerBundle
}

export function GhostGroupRow({ item, handlers }: GhostGroupRowProps) {
  const { label, entryCount, dominantHex, distinctCharIds } = item
  return (
    <tr
      className="opacity-40"
      onDragOver={handlers.onDragOver}
      onDrop={handlers.onDrop}
    >
      <td className="px-2 py-1.5 w-8" />
      <td className="px-2 py-1.5 w-18" />
      <td className="px-2 py-1.5 w-36">
        <div className="flex items-center">
          {distinctCharIds.map((charId, idx) => {
            const char = getCharacterById(charId)
            const hex = (char?.element && ELEMENT_HEX[char.element]) ?? "#888"
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
