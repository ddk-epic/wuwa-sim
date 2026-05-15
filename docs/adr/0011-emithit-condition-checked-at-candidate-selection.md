# emitHit condition checked at candidate selection, not at execution

`stat` effects create persistent Buff Instances whose `condition` is re-evaluated lazily in `resolveStats` on every hit — the instance always exists; the condition gates whether its effects contribute right now. `emitHit` effects are transient: they fire once and leave no persistent instance, so there is no "later" to re-evaluate against.

For `emitHit`-only buff defs, the `condition` is therefore checked at **candidate selection** (`findCandidates`): if the condition is not met when the trigger fires, the def is excluded from candidates and the hit never executes. Stat buff defs are unaffected and continue to use lazy evaluation in `resolveStats`.

The immediate driver is Sanhua's Ice Creation detonation: Intro/Skill/Liberation each create a presence-flag Buff Instance; separate emitHit buff defs (one per creation type) are triggered by Detonate's `hitLanded` and conditioned on their respective flag being active. Detonate's own authored hit always fires; the Ice Burst hits are additive and conditional.
