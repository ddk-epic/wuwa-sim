import { getCharacterById, getWeaponById } from "#/lib/loadout/catalog"
import { getTimelineSummary } from "#/lib/timeline/timeline-summary"
import { flattenNodes } from "#/types/timeline"
import type { SavedTeam } from "#/hooks/useLibrary"
import type { LibTeam, Member } from "./types"

/** Epoch ms → stable `YYYY-MM-DD` label (deterministic, locale-independent). */
function formatUpdated(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Pure projection of a persisted `SavedTeam` into the Library view model.
 *
 * - Members are resolved from the payload's filled slots via the loadout catalog
 *   (name/element, weapon name, `seq` from the loadout). Empty slots are skipped;
 *   `role` is dropped (no domain source).
 * - `dmgByChar` is re-keyed from `characterId` to member **name** so the donut can
 *   read it by name; `typeMix`/`concertoEnd`/`resEnd` pass through from the stats
 *   snapshot; `totalDmg` is their sum.
 * - `actions`/`totalTime` come from `getTimelineSummary` over the saved timeline
 *   (structural durations — no stored log); `dps` derives from `totalDmg / time`.
 */
export function savedTeamToLibTeam(saved: SavedTeam): LibTeam {
  const { payload, stats } = saved
  const { slots, loadouts } = payload.team

  const members: Member[] = []
  const dmgByChar: Record<string, number> = {}
  slots.forEach((charId, i) => {
    if (charId === null) return
    const character = getCharacterById(charId)
    if (!character) return
    const loadout = loadouts[i]
    members.push({
      name: character.name,
      element: character.element,
      seq: loadout.sequence,
      weapon: loadout.weaponId
        ? (getWeaponById(loadout.weaponId)?.name ?? "")
        : "",
    })
    const dmg = stats.dmgByChar[charId]
    if (dmg !== undefined) dmgByChar[character.name] = dmg
  })

  const totalDmg = Object.values(stats.dmgByChar).reduce((s, v) => s + v, 0)

  const entries = flattenNodes(payload.timeline ?? [])
  const summary = getTimelineSummary(entries, slots, loadouts)
  const totalTime = summary.totalTimeFrames / 60
  const dps = totalTime > 0 ? Math.round(totalDmg / totalTime) : 0

  return {
    id: saved.id,
    name: saved.name,
    updated: formatUpdated(saved.updated),
    pinned: saved.pinned,
    members,
    actions: entries.length,
    totalTime,
    totalDmg,
    dps,
    concertoEnd: stats.concertoEnd,
    resEnd: stats.resEnd,
    dmgByChar,
    typeMix: stats.typeMix,
  }
}
