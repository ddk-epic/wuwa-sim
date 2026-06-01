# In-game wording conventions

How recurring phrasings in Wuthering Waves skill text map to engine stat
semantics. Consult this before authoring a buff from a description — the same
English phrase consistently denotes one stat class, and the classes are not
interchangeable in the damage formula.

The damage formula has three independent modifier spaces (see
`docs/damage-calculation.md` and `compute-damage.ts`):

```
D = MV × scaling × (1 + bonusMultiplier) × (1 + dmgBonus) × (1 + deepen) × crit × def × res
                    └─ separate ───┘        └─ additive ──┘   └─ additive ─┘
                       multiplier             DMG-Bonus         Deepen
```

`dmgBonus` and `deepen` each sum their contributions additively within their
bucket; `bonusMultiplier` is its own multiplicative factor. Putting a value in
the wrong space changes the result whenever other modifiers are present.

## Phrase → stat class

| In-game wording                                                            | Stat class               | Engine path                                              |
| -------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| "**DMG is increased by** N%" / "**Damage dealt** … **is increased by** N%" | **DMG Bonus** (additive) | `allDmgBonus`, `elementBonus[…]`, or `skillTypeBonus[…]` |
| "**DMG Bonus +**N%"                                                        | DMG Bonus (additive)     | same as above                                            |
| "DMG is **Amplified by** N%" / "**Amplified**"                             | **Deepen** (additive)    | `allDeepen`, `elementDeepen[…]`, `skillTypeDeepen[…]`    |
| "**Deepen**"                                                               | Deepen (additive)        | same as above                                            |

**Key point:** "**increased by** N%" is **DMG Bonus**, an additive contribution
to the `dmgBonus` bucket — **not** a standalone ×(1 + N%) multiplier. It yields
less than ×(1 + N%) whenever other DMG Bonus is already present. Reserve the
separate multiplicative `bonusMultiplier` factor for effects that explicitly read
as their own multiplier (e.g. Shorekeeper S6 "Bonus Multiplier").

## Verified examples

- **Sanhua — Avalanche:** "Damage dealt by Sanhua's Forte Circuit Ice Burst is
  increased by 20% for 8s after casting Basic Attack 5." → DMG Bonus +20% on the
  Ice Burst hits (scoped to those hits).
- **Encore — Angry Cosmos:** "Encore's All DMG Bonus increases by 10%." → modeled
  as `allDmgBonus += 0.1` (`src/data/characters/encore.ts`).

## Related

- `CONTEXT.md` → "Flagged ambiguities" → "Amplify / Amplified" and "DMG Bonus".
