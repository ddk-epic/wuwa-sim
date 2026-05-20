import type { RenderItem } from "#/lib/timeline-render-items"

type GhostItem = Extract<RenderItem, { type: "ghost" }>

interface GhostEntryRowProps {
  item: GhostItem
}

export function GhostEntryRow({ item }: GhostEntryRowProps) {
  const { charHex, skillName } = item
  return (
    <tr className="opacity-40 pointer-events-none">
      <td className="px-2 py-2 w-8" />
      <td className="px-2 py-2 w-18" />
      <td className="px-2 py-2 w-36">
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-xs font-black text-gray-900 shrink-0"
          style={{ backgroundColor: charHex }}
        />
      </td>
      <td className="px-2 py-2 w-16" />
      <td className="px-2 py-2" style={{ borderLeft: `3px solid ${charHex}` }}>
        <span className="text-sm text-gray-200 truncate">
          {skillName ?? "—"}
        </span>
      </td>
      <td className="px-2 py-2 w-18" />
      <td className="px-2 py-2 w-20" />
      <td className="px-2 py-2 w-20" />
      <td className="px-2 py-2 w-24" />
      <td className="px-2 py-2 w-20.75" />
    </tr>
  )
}
