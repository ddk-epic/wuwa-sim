# Enemy-conceptual buffs modeled on the source character pending enemy-target support

Buffs whose game-text concept is "a flag/mark on the enemy" (e.g. Verina's Photosynthesis Mark) are authored with `target: self` on the source character — a self-applied presence flag — rather than via an `enemy` `BuffTarget`. The engine has no `enemy` target variant today: `BuffTarget` is `self | global | nextOnField` (ADR-0025). Because the simulator is single-target (ADR-0007), "Mark on the enemy" and "the source character has applied a Mark presence" are isomorphic, so the self-flag faithfully reproduces the mechanic while avoiding the cross-cutting work of adding an enemy-target vocabulary.

## Migration trigger

Revisit when **multiple** enemy-conceptual buffs accumulate and the self-flag pattern starts producing surprising authoring — e.g. when a buff needs to query whether a teammate's Mark is present on the same enemy (with the self-flag model, each Mark lives on a different source, and "is _any_ Mark present" becomes an awkward disjunction across sources). At that point, extend `BuffTarget` with `{ kind: "enemy" }`, give `Condition.buffActive` an `on: "enemy"` option, and migrate accumulated marks in one sweep. Single-character occurrences alone are not enough — Verina is the first; this ADR exists to make sure the second and third don't quietly entrench the pattern.

## Consequences

- `Condition.buffActive` references such marks with `on: "source"`, not `on: "target"`.
- Multi-source mark stacking (two characters who both apply "their own" mark to the enemy) is currently impossible to query as a single fact — the disjunction is the author's problem until the migration.
- A teammate's hit against a Mark-tagged enemy queries the **mark-owner's** self-flag, which means the reaction buff's `sourceCharacterId` is the mark owner (correct — the reaction is _their_ coord attack). `actor: "any"` on the trigger is what lets teammate hits qualify.
- The reaction buff's effects use `coordHit` (not `emitHit`) so the resulting hit and heal events are never re-entered into the trigger matcher — preventing coord→coord chains. See ADR-0020.
