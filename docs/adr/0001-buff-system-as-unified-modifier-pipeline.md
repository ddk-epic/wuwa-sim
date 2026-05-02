# Unified buff system as the only damage-modifier pipeline

Every damage modifier — crit rate, ATK%, element bonus, skill-type bonus, deepen, weapon passives, echo set bonuses, skill-tree nodes — flows through the buff system. There is no separate "permanent stat" pathway; permanent modifiers are buffs with `duration: { kind: "permanent" }`, baked into a base Stat Table at sim start as an optimization. Reason: in WuWa the line between "permanent" and "temporary" modifier is fuzzy (conditional resonance chain nodes have infinite duration but runtime predicates), and a single resolution path means one place to debug a wrong damage number.

## Considered Options

- Buffs as a layer on top of a separate stat-aggregation system. Rejected because the same modifier categories appear in both layers (e.g. ATK% from a weapon vs ATK% from an intro buff), and duplicating the application logic is the bug source we want to eliminate.

## Consequences

- The first-time bake of permanent buffs at sim start applies only to those with no condition predicate. Conditional-but-permanent buffs stay in the live list with `endTime: Infinity` so their condition can be re-evaluated each hit.
- Adding a new modifier category (a new field on the Stat Table) requires editing the type and the damage formula, not just adding a string. This is a feature: new categories are rare and worth a code review.
