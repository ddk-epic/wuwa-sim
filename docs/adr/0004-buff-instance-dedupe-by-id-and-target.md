# Buff instance dedupe by `(buffId, target)`, not by source

Two characters applying the same Buff Def to the same target produce **one** Buff Instance — the second application refreshes the first rather than creating a parallel copy. The dedupe key is `(buffDef.id, target.characterId)`. This matches in-game behavior for named buffs in WuWa, where two supports applying "+22.5% ATK" of the same name do not stack into +45%. To opt into per-source parallel instances (the rare case where two sources should each contribute), a Buff Def sets `perSource: true`, switching the key to `(buffDef.id, target.characterId, sourceCharacterId)`.

## Considered Options

- Per-source by default, opt-out for refresh — rejected because it inverts the WuWa norm and makes the common case verbose.
- Global dedupe by `buffDef.id` only — rejected because it incorrectly merges instances applied to different targets (e.g. a team buff resolves into one instance per loadout slot).

## Consequences

- A separate `nonStackingGroup: string` field exists for the rare case of cross-buff caps ("only one of group X across the team"). Deferred until forced by a real character; reach for `perSource` first.
- Targets like `nextOnField` resolve **deferred** at the next `swapIn` event, not at apply time. The buff sits in a pending list until materialized.
