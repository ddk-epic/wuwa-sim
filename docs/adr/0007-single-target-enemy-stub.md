# Single-target enemy as a global namespace; defense and resistance as constants

The simulator models exactly one enemy. Buffs targeting `enemy` resolve into a single global namespace; multi-target effects fan out to the same target. Defense and resistance multipliers in the damage formula are compile-time constants tuned to a representative L90-vs-L90 matchup with 10% all-element resistance. No enemy state — HP, debuffs, or per-element resistance — is modeled as live data.

## Consequences

- The damage numbers produced are **comparison-grade**, not absolute-grade. Relative DPS between rotations and buff sets is meaningful; absolute DPS against a specific in-game target is not.
- No buff's behavior depends on enemy state today, so this stub is orthogonal to the buff system. Lifting it later is local to the damage formula, not a buff-system rewrite.
- Enemy-targeted buffs ("marks") have no first-class `BuffTarget` variant; they are modeled as self-applied presence flags on the mark's owning character — see ADR-0019. When multi-target enemies are eventually modeled, an `enemy` target variant is added and accumulated self-flag marks migrate in one sweep.
