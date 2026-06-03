import type { HealTarget } from "#/types/character"

/**
 * Map a `HealTarget` to the character ids it resolves to. The single home for a
 * mapping the authored-heal path (`simulation.ts`) and the synthetic-heal host
 * (`buff-engine.ts`) previously each carried their own copy of.
 *
 * `teamIds` is the resolved team/party list, supplied by the caller — the two
 * paths source it differently (the loadout slots vs the instance store), so the
 * list is a parameter rather than computed here.
 *
 * `currentOnField` is a stub: it resolves to the source/healer, not the actual
 * On-field character. Kept identical to the prior behavior so any future fix
 * lands in this one place.
 */
export function resolveHealTargets(
  target: HealTarget,
  sourceId: number,
  teamIds: number[],
): number[] {
  switch (target) {
    case "self":
    case "source":
    case "currentOnField":
      return [sourceId]
    case "team":
      return teamIds
    case "nextOnField":
      return []
  }
}
