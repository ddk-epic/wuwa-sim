import type { EnrichedCharacter } from "#/types/character"
import { stageGroups } from "./stages"
import {
  clipDisplayName,
  hitsByStage,
  resolveVariantTarget,
  sections,
} from "./types"
import type { Clip, VariantTrack } from "./types"

const DASH = "—"

// The resolved label for a stage's variant pin, read off the selected clip:
// a number for a hit/last pin, "instant" for a cancel pinned to start, "—" when
// the variant isn't opted in, or "unresolved" for a dangling pin.
function variantLabel(
  clip: Clip,
  occurrence: number,
  track: VariantTrack,
): string {
  const target = clip.variants?.[occurrence]?.[track]
  if (!target) return DASH
  const resolved = resolveVariantTarget(clip, occurrence, target)
  if (!resolved.ok) return "unresolved"
  if (track === "cancel" && target.kind === "start") return "instant"
  return String(resolved.actionTime)
}

/**
 * A shareable markdown read-out of the whole stage catalog, measured against the
 * selected clip — the read-only sidebar's view as a table. Every hit slot up to
 * capacity is listed even when unmeasured (em-dash), so the snapshot doubles as a
 * checklist of what's left to count. Stages absent from the clip read as
 * untouched. Single-clip, like the sidebar; the solver later feeds the same table.
 */
export function snapshotMarkdown(char: EnrichedCharacter, clip: Clip): string {
  const secs = sections(clip)
  const byStage = hitsByStage(clip)
  const out: string[] = [
    `# ${char.name} — frame snapshot`,
    "",
    `_Source clip: ${clipDisplayName(clip)}. Unmeasured values shown as ${DASH}._`,
    "",
  ]

  for (const group of stageGroups(char)) {
    out.push(`### ${group.skill}`, "")
    for (const stage of group.stages) {
      const occ = secs
        .map((sec, i) => ({ sec, i }))
        .filter(({ sec }) => sec.ref.id === stage.id)
      const measured = occ.length > 0
      const actionTime = measured ? occ[0].sec.end - occ[0].sec.start : null
      const cancel = measured ? variantLabel(clip, occ[0].i, "cancel") : DASH
      const swap = measured ? variantLabel(clip, occ[0].i, "swap") : DASH
      out.push(
        `**${stage.stage}** — actionTime \`${actionTime ?? DASH}\` · cancel \`${cancel}\` · swap \`${swap}\``,
        "",
      )

      const hits = occ.flatMap(({ sec, i }) =>
        byStage[i].map((h) => ({ af: h.frame - sec.start, cue: h.cue })),
      )
      const capacity = (occ.length || 1) * stage.hitCount
      const rows = Math.max(capacity, hits.length)
      if (rows === 0) {
        out.push("_no hits_", "")
        continue
      }

      out.push("| Hit | actionFrame | cue |", "| --- | --- | --- |")
      for (let k = 0; k < rows; k++) {
        const h = k < hits.length ? hits[k] : undefined
        // A hit past capacity is a miscount signal; flag it rather than hide it.
        const label = k >= capacity ? `${k + 1} ⚠` : `${k + 1}`
        out.push(`| ${label} | ${h ? h.af : DASH} | ${h ? h.cue : DASH} |`)
      }
      out.push("")
    }
  }

  return out.join("\n")
}
