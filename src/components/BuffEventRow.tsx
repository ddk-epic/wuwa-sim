import type { SimulationLogEntry } from "#/types/simulation-log"
import { getCharacterById } from "#/lib/catalog"

type BuffEntry = Extract<
  SimulationLogEntry,
  {
    kind: "buffApplied" | "buffRefreshed" | "buffExpired" | "buffConsumed"
  }
>

interface BuffEventRowProps {
  index: number
  buff: BuffEntry
}

export function BuffEventRow({ index, buff }: BuffEventRowProps) {
  const target = getCharacterById(buff.targetCharacterId)
  const verb =
    buff.kind === "buffApplied"
      ? "applied"
      : buff.kind === "buffRefreshed"
        ? "refreshed"
        : buff.kind === "buffConsumed"
          ? "consumed"
          : "expired"
  const color =
    buff.kind === "buffExpired"
      ? "text-rose-400/70"
      : buff.kind === "buffConsumed"
        ? "text-amber-400/80"
        : "text-emerald-400/80"
  return (
    <tr className="border-b border-gray-800 bg-gray-950/40">
      <td className="py-1 pr-3 text-gray-500">{index + 1}</td>
      <td className="py-1 pr-3">{target?.name ?? "?"}</td>
      <td className={`py-1 pr-3 italic ${color}`}>buff {verb}</td>
      <td className="py-1 pr-3">
        {buff.buffName}
        {buff.stacks > 1 ? ` × ${buff.stacks}` : ""}
      </td>
      <td className="py-1 pr-3">{(buff.frame / 60).toFixed(2)}s</td>
      <td className="py-1 pr-3 text-right" />
      <td className="py-1 pr-3 text-right" />
      <td className="py-1 pr-3 text-right" />
      <td className="py-1 pr-3 text-right" />
      <td className="py-1 pr-3 text-right" />
      <td className="py-1 pr-3 text-right" />
      <td className="py-1 pr-3 text-right" />
      <td className="py-1 pr-3 text-right" />
      <td className="py-1 text-right" />
    </tr>
  )
}
