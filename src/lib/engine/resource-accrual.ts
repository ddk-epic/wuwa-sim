import type { ResourceKind } from "#/types/buff"

/** A single resource write attributed to one character. */
export interface Accrual {
  characterId: number
  resource: ResourceKind
  delta: number
}

/** Per-hit/per-cast resource grants read off a damage entry. */
export interface AccrualGains {
  energy?: number
  concerto?: number
  forte?: number
  /** Synthetic (emitHit/coordHit) gains do not share energy to teammates. */
  synthetic?: boolean
}

/** The accruing actor's hit-agnostic recharge stats. */
export interface AccrualActor {
  id: number
  /** energyRechargePct */
  er: number
  /** forteRechargePct */
  fr: number
}

/** Fraction of the actor's (already-ER-scaled) energy each teammate receives. */
const TEAMMATE_ENERGY_SHARE = 0.5

/**
 * The single rule for "how much energy/concerto/forte does this hit grant, and
 * to whom." Pure: no engine state, no callbacks — unit-testable on numbers.
 *
 * Returns an **ordered** list the engine applies in sequence (so `resourceCrossed`
 * chaining stays deterministic): actor energy, then each teammate's shared
 * energy in `partyIds` order, then actor concerto, then actor forte.
 *
 * Energy is ER-scaled once by the **actor's** ER — the teammate share is
 * `energy * 0.5 * (1 + actorER)`, never re-scaled by the teammate's own ER.
 * Concerto is raw; forte is FR-scaled on gains only (raw on consumption).
 * Synthetic gains never share energy.
 *
 * `energyGainMult` scales the actor's own energy:
 * `energy × (1 + ER) × (1 + energyGainMult)`. The teammate share is not scaled
 * by it. Defaults to 0.
 */
export function accrueForHit(
  gains: AccrualGains,
  actor: AccrualActor,
  partyIds: number[],
  energyGainMult = 0,
): Accrual[] {
  const accruals: Accrual[] = []

  if (gains.energy) {
    const actorEnergy = gains.energy * (1 + actor.er) * (1 + energyGainMult)
    accruals.push({
      characterId: actor.id,
      resource: "energy",
      delta: actorEnergy,
    })
    if (!gains.synthetic) {
      const sharedEnergy = gains.energy * TEAMMATE_ENERGY_SHARE * (1 + actor.er)
      for (const teammateId of partyIds) {
        if (teammateId !== actor.id) {
          accruals.push({
            characterId: teammateId,
            resource: "energy",
            delta: sharedEnergy,
          })
        }
      }
    }
  }

  if (gains.concerto) {
    accruals.push({
      characterId: actor.id,
      resource: "concerto",
      delta: gains.concerto,
    })
  }

  if (gains.forte) {
    // FR scales gains only: positive forte is FR-scaled, negative forte
    // (consumption) applies raw.
    accruals.push({
      characterId: actor.id,
      resource: "forte",
      delta: gains.forte > 0 ? gains.forte * (1 + actor.fr) : gains.forte,
    })
  }

  return accruals
}
