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
 * Pure rule for the energy/concerto/forte a hit grants. Returns an ordered list
 * (actor energy, teammate shares, concerto, forte) for deterministic dispatch.
 *
 * Energy: actor gets `energy × (1 + ER) × (1 + energyGainMult)`, each teammate
 * `energy × 0.5 × (1 + ER)`; synthetic gains don't share. Concerto is raw; forte
 * is FR-scaled on gains, raw on consumption. `energyFlat` grants energy verbatim
 * (no ER, no mult) to actor and share alike — for Intro Skills.
 */
export function accrueForHit(
  gains: AccrualGains,
  actor: AccrualActor,
  partyIds: number[],
  energyGainMult = 0,
  energyFlat = false,
): Accrual[] {
  const accruals: Accrual[] = []

  if (gains.energy) {
    const erScale = energyFlat ? 1 : 1 + actor.er
    const actorEnergy = energyFlat
      ? gains.energy
      : gains.energy * erScale * (1 + energyGainMult)
    accruals.push({
      characterId: actor.id,
      resource: "energy",
      delta: actorEnergy,
    })
    if (!gains.synthetic) {
      const sharedEnergy = gains.energy * TEAMMATE_ENERGY_SHARE * erScale
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
