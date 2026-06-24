import type { EnrichedCharacter } from "#/types/character"
import { stageGroups } from "./stages"
import { projectionOf } from "./projection"
import type { StageProjection, TrackProjection } from "./projection"

const DASH = "—"

function actionTimeLabel(status: StageProjection["status"]): string {
  if (status.status === "single" || status.status === "confirmed")
    return String(status.actionTime)
  if (status.status === "conflict") return String(status.estimate)
  return DASH
}

// Resolved variant label: a number, "instant" (cancel pinned to start), "—" (not
// opted in), "unresolved" (dangling pin), or "conflict" (clips disagree).
function variantLabel(
  track: TrackProjection | undefined,
  cancel: boolean,
): string {
  if (!track) return DASH
  if (!track.agreed) return "conflict"
  if (!track.resolution.ok) return "unresolved"
  if (cancel && track.target.kind === "start") return "instant"
  return String(track.resolution.actionTime)
}

/**
 * The read-only sidebar's view as a shareable markdown table, read off each
 * stage's best clip (via stage projection) so it mirrors exactly what the TS
 * export writes. Every hit slot up to capacity, unmeasured ones as em-dash, so it
 * doubles as a checklist; a stage absent from every clip is all em-dash.
 */
export function snapshotMarkdown(
  char: EnrichedCharacter,
  projections: Map<string, StageProjection>,
): string {
  const out: string[] = [
    `# ${char.name} — frame snapshot`,
    "",
    `_Best clip per stage. Unmeasured values shown as ${DASH}._`,
    "",
  ]

  for (const group of stageGroups(char)) {
    out.push(`### ${group.skill}`, "")
    for (const stage of group.stages) {
      const p = projectionOf(projections, stage.id)
      const animLabel =
        p.animationFrames !== null && p.animationFrames > 0
          ? ` · animationFrames \`${p.animationFrames}\``
          : ""
      const cancel = variantLabel(p.variants.cancel, true)
      const swap = variantLabel(p.variants.swap, false)
      out.push(
        `**${stage.stage}** — actionTime \`${actionTimeLabel(p.status)}\`${animLabel} · cancel \`${cancel}\` · swap \`${swap}\``,
        "",
      )

      const capacity = stage.hitCount
      const rows = Math.max(capacity, p.hits.length)
      if (rows === 0) {
        out.push("_no hits_", "")
        continue
      }

      out.push("| Hit | actionFrame | cue |", "| --- | --- | --- |")
      for (let k = 0; k < rows; k++) {
        const h = k < p.hits.length ? p.hits[k] : undefined
        // A hit past capacity is a miscount signal; flag it rather than hide it.
        const label = k >= capacity ? `${k + 1} ⚠` : `${k + 1}`
        out.push(
          `| ${label} | ${h ? h.actionFrame : DASH} | ${h ? h.cue : DASH} |`,
        )
      }
      out.push("")
    }
  }

  return out.join("\n")
}
