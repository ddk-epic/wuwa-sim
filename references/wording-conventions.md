# In-game wording conventions

How recurring phrasings in Wuthering Waves skill text map to engine stat
semantics. Consult this before authoring a buff from a description — the same
English phrase consistently denotes one stat class, and the classes are not
interchangeable in the damage formula.

The damage formula has four independent modifier spaces (see
`docs/damage-calculation.md` and `compute-damage.ts`):

```
D = MV × scaling × (1 + bonusMultiplier) × (1 + dmgBonus) × (1 + deepen) × (1 + vul) × crit × def × res
                    └─ separate ───┘        └─ additive ──┘   └─ additive ─┘  └─ separate ┘
                       multiplier             DMG-Bonus         Deepen         vulnerability
```

`dmgBonus` and `deepen` each sum their contributions additively within their
bucket; `bonusMultiplier` and `vul` are each their own multiplicative factor.
Putting a value in the wrong space changes the result whenever other modifiers
are present.

## Phrase → stat class

| In-game wording                                                            | Stat class                                  | Engine path                                              |
| -------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| "**DMG is increased by** N%" / "**Damage dealt** … **is increased by** N%" | **DMG Bonus** (additive)                    | `allDmgBonus`, `elementBonus[…]`, or `skillTypeBonus[…]` |
| "**DMG Bonus +**N%"                                                        | DMG Bonus (additive)                        | same as above                                            |
| "DMG is **Amplified by** N%" / "**Amplified**"                             | **Deepen** (additive)                       | `allDeepen`, `elementDeepen[…]`, `skillTypeDeepen[…]`    |
| "**Deepen**"                                                               | Deepen (additive)                           | same as above                                            |
| "target **takes** N% **more DMG** (from X)"                                | **Vulnerability** (separate multiplicative) | `vul`                                                    |

**Key point:** "**increased by** N%" is **DMG Bonus**, an additive contribution
to the `dmgBonus` bucket — **not** a standalone ×(1 + N%) multiplier. It yields
less than ×(1 + N%) whenever other DMG Bonus is already present. Reserve the
separate multiplicative `bonusMultiplier` factor for effects that explicitly read
as their own multiplier (e.g. Shorekeeper S6 "Bonus Multiplier").

**Check the Chinese source when unsure which bucket applies.** The English
localization can blur the distinction, but the Chinese text is unambiguous:

- **提升** ("increased") → **DMG Bonus** bucket (the `dmgBonus` additive space).
- **加深** ("deepen") → **Deepen** bucket (the `deepen` additive space).

When a description is ambiguous about whether an effect is a DMG Bonus or a
Deepen, double-check against the Chinese wording (提升 vs. 加深) before deciding.

**"takes more DMG" → `vul` is provisional — verify against the Chinese.** The
English "takes N% more DMG" is read here as the separate multiplicative
vulnerability bucket, but the EN localization is unreliable and the same phrasing
can actually denote a **Bonus Multiplier** (or a Deepen). Confirm the Chinese
original before committing any "takes more DMG" effect to `vul`.

## Verified examples

- **Sanhua — Avalanche:** "Damage dealt by Sanhua's Forte Circuit Ice Burst is
  increased by 20% for 8s after casting Basic Attack 5." → DMG Bonus +20% on the
  Ice Burst hits (scoped to those hits).
- **Encore — Angry Cosmos:** "Encore's All DMG Bonus increases by 10%." → modeled
  as `allDmgBonus += 0.1` (`src/data/characters/encore.ts`).

## Related

- `CONTEXT.md` → "Flagged ambiguities" → "Amplify / Amplified" and "DMG Bonus".
