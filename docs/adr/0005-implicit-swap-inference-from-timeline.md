# On-field state inferred implicitly from authored timeline entries

The Timeline does not have explicit swap entries. The on-field character is whoever authored the most recent Timeline Entry. When `entry.characterId` changes between successive authored entries, the engine fires `swapOut` for the previous on-field character and `swapIn` for the new one. Synthetic hits (from `emitHit` Effects) never change on-field state, regardless of their Acting Character.

## Considered Options

- Explicit swap entries as a new Timeline Entry kind — rejected because they add noise to the timeline editor for no information gain. Authored entries are by definition on-field actions; the swap is unambiguously inferred.
- "Acting = on-field" simplification — rejected because it mismodels off-field synthetic hits (coordinated attacks) by claiming they swap their owner in.

## Consequences

- The distinction between **Acting Character** (whose ability produced the hit) and **On-Field Character** (currently positioned to receive on-field effects) is load-bearing in the engine. Both are queryable in Triggers and Conditions.
- Outro→Intro chains work without special-casing: the outro is one entry (Char A on-field), the intro is the next entry (Char B on-field), and the boundary fires the swap events naturally.
- This rule depends on authored entries always representing on-field player actions. If a future feature adds non-action authored entries (e.g. a "wait" entry for timing), they must opt out of swap inference.
