/** One resolved team member in the Library view (role intentionally dropped — no domain source). */
export interface Member {
  name: string
  element: string
  seq: number
  weapon: string
}

/** One slice of the skill-type distribution: hit count + summed damage. */
export interface TypeEntry {
  count: number
  dmg: number
}

/**
 * The view model the Library renders. Built from a `SavedTeam` by
 * `savedTeamToLibTeam`: identity + resolved members + projected stats.
 * `dmgByChar` is re-keyed by member **name** (the donut reads it by name);
 * `typeMix` passes through from the stats snapshot keyed by Skill Type.
 */
export interface LibTeam {
  id: string
  name: string
  updated: string
  pinned: boolean
  members: Member[]
  actions: number
  totalTime: number
  totalDmg: number
  dps: number
  concertoEnd: number
  resEnd: number
  dmgByChar: Record<string, number>
  typeMix: Record<string, TypeEntry>
}
