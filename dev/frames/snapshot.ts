import type { EnrichedCharacter } from "#/types/character"
import { stageGroups } from "./stages"
import {
  clipDisplayName,
  hitsByStage,
  resolveVariantTarget,
  sections,
  stageTiming,
} from "./types"
import type { Clip, VariantTrack } from "./types"

const DASH = "—"

// Resolved variant label: a number, "instant" (cancel pinned to start), "—"
// (not opted in), or "unresolved" (dangling pin).
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
 * The read-only sidebar's view as a shareable markdown table: the whole catalog
 * measured against the selected clip, every hit slot up to capacity (unmeasured
 * ones as em-dash) so it doubles as a checklist. Single-clip, like the sidebar.
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
      const timing = measured ? stageTiming(clip, occ[0].i, secs) : null
      const animLabel =
        timing && timing.animationFrames > 0
          ? ` · animationFrames \`${timing.animationFrames}\``
          : ""
      const cancel = measured ? variantLabel(clip, occ[0].i, "cancel") : DASH
      const swap = measured ? variantLabel(clip, occ[0].i, "swap") : DASH
      out.push(
        `**${stage.stage}** — actionTime \`${timing?.actionTime ?? DASH}\`${animLabel} · cancel \`${cancel}\` · swap \`${swap}\``,
        "",
      )

      const hits = occ.flatMap(({ sec, i }) => {
        const split = stageTiming(clip, i, secs).animationFrames > 0
        return byStage[i].map((h) => ({
          af: split ? 0 : h.frame - sec.start,
          cue: h.cue,
        }))
      })
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
