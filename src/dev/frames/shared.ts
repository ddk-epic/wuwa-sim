import type { CueTag } from "./types"

export const uid = () => Math.random().toString(36).slice(2, 9)

export const CUE_COLOR: Record<CueTag, string> = {
  impactFlash: "bg-emerald-500",
  vfxEdge: "bg-sky-500",
  animationBreak: "bg-amber-500",
  estimate: "bg-zinc-500",
}

export type Selected = { type: "boundary" | "hit"; id: string } | null
