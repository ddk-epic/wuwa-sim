# Sharing

Two ways to hand a rotation to someone else:

- **Share code** — a Base91 string that round-trips the full team + timeline back
  into the simulator. Lossless, re-importable, machine-only.
- **Share image** — a rendered picture of the rotation as a per-character
  action-press sequence (the [[Opener]] and [[Loop]] read off the timeline).
  Human-readable, not re-importable.

**Source files:** `src/lib/import-export.ts`, `src/lib/base91.ts`

## Share code

`import-export.ts` packs a team **plus its timeline** into a Base91 string. To
stay short it stores **array positions, not id values**: a character is its index
in `ALL_CHARACTERS`, a weapon its index in `ALL_WEAPONS`, and so on. A timeline
entry's stage is an ordinal into **its own character's** flattened stage list
(echo stages share one suffix after every character's stages), keyed off the
entry's character byte.

This makes the format **append-only**. Appending a character, echo, weapon, etc.
at the **end** of its registry — or a stage at the end of a character's stage
list — leaves every existing code decoding to the same things. But **inserting,
removing, or reordering** an entry mid-registry (or mid stage-list) renumbers the
positions after it and silently makes already-shared codes decode to the wrong
data. Such an edit is a breaking wire change: bump the `VERSION` byte (the decoder
rejects versions it doesn't recognise).

The current version is `5`. After the timeline it appends the team's
[[Settings]] as trailing bytes — the four frame knobs, then `startWithFullEnergy`
(`0`/`1`), then `startWithFullConcerto` (`0`/`1`, added by `v5`). Each is a pure
**append**: a `v3` code is a `v4` code minus the settings block, a `v4` code is a
`v5` code minus the last bit; the decoder accepts `v3`/`v4`/`v5` and fills the
missing fields from `DEFAULT_SETTINGS`. Versions outside `{3, 4, 5}` are rejected,
not migrated — a stale code is simply re-exported. A future trailing field should
follow the same pattern (append + keep accepting the shorter prior versions);
only a mid-stream renumber forces a hard version cut.

### Slug prefix

The emitted string carries a human-readable label **outside** the Base91
envelope:

```
<slug0>-<slug1>-<slug2>-<base91blob>
```

The three slugs are the team's slot characters, normalised from
`character.name` (lowercase, non-alphanumerics stripped) — `none` for an empty
slot. They let a person eyeball that a code is a real rotation for a known team.

The prefix is **decorative**: the blob stays the single source of truth, and the
slugs never resolve characters. It works because `-` is the one separator absent
from the Base91 alphabet, so the blob is always the substring after the **last**
hyphen (slugs are normalised hyphen-free, keeping the split unambiguous). The
prefix sits outside the versioned byte stream, so this needs **no `VERSION`
bump**: a legacy code has no hyphen and decodes as a bare blob.

Validation is recompute-and-reject: decode the blob, recompute the canonical
slugs from the decoded team, and **reject** a present-but-mismatched prefix as
tampered. Display and re-export always use the recomputed canonical slugs, never
the raw incoming prefix — a malicious author can't make the label say anything
other than the true team. This makes the **slug normaliser a frozen contract**:
changing how a name maps to a slug invalidates every prior code's prefix.

This prefix is legibility only — it does **not** address the array-position
order-dependence above (weapons, echoes, stages, enums, `focusedId`, and timeline
character refs are still positional).

## Share image

A rotation rendered as a picture: each on-field stint becomes a character card
bearing a string of action letters. Built off the live timeline and rasterized
client-side with `html-to-image` (`toPng` on the preview node). Portraits are
same-origin (`/portraits/*.png`), so the canvas is never CORS-tainted.

**Source files:** `src/components/share/ShareCard.tsx` (the rasterized node),
`src/components/share/ShareImageModal.tsx` (controls + capture), and
`src/lib/share/rotation-cards.ts` (timeline → cards + glyphs).

### Cards

One card per **stint** — a maximal run of consecutive entries by the same
character. Card boundaries are therefore swaps. Each card is a fixed-height pill:
a full-bleed square portrait on the left under a left **element accent bar** and a
short hue wash, then the **letter string** (one glyph per entry), an `IN` diamond
leading the string when the stint opens on an intro.

The two rotations come straight from `splitRotations()`: an **Opener** section
and a **Loop** section, each a wrapping horizontal flow of cards joined by `»`.
Every section is fronted by a vertical **label bar** tapered to a pen-nib point
(the opener points down; the loop points at both ends), reserving a two-row
minimum height and stretching as the cards wrap. When both sections are present a
**dashed divider** sits between them.

The card has a **fixed width** (`CARD_WIDTH`); only its height is content-sized,
growing as rows wrap. With no loop marker, `splitRotations` returns an empty loop
and the Loop block — and the divider — are **omitted from the DOM entirely**; an
empty opener is likewise dropped.

### Letter legend

Each entry maps to one glyph off its resolved stage:

| Action                              | Glyph                                        |
| ----------------------------------- | -------------------------------------------- |
| Basic Attack                        | `A`                                          |
| Heavy Attack (non-Forte-Circuit)    | `H`                                          |
| Resonance Skill                     | `E`                                          |
| Resonance Liberation                | `R`                                          |
| Echo Skill                          | `Q`                                          |
| `skillGrouping === "Forte Circuit"` | `Z`                                          |
| Intro Skill                         | `IN` diamond (not a letter)                  |
| Outro Skill                         | _dropped_                                    |
| Movement — dodge / jump             | `D` / `J` (reserved; not yet mapped in data) |
| Tune Break                          | `F` (reserved; unimplemented in data)        |
| other Movement                      | _omitted_                                    |

An **Intro Skill** that opens a stint shows as an `IN` diamond leading the card's
letter string and consumes no letter. **Outro Skills** are dropped — a stint
ending in a swap-out is implicit.

### Forte (`Z`) detection

There is no single model field that means "forte activation," so `Z` reads off
the parent **skill grouping**: `skillGrouping === "Forte Circuit"`. This is
correct for every implemented character except **Cartethyia**, whose entire
transformed moveset (basics, dodge counter, heavy, enhanced resonance) is authored
under the `Forte Circuit` grouping and would otherwise render as `ZZZZZ…`.

A **hardcoded override map** in the share/legend module special-cases Cartethyia's
transformed stages back to their natural category letters. It is a temporary shim
until the data carries a real signal, and is the intended home for the reserved
`D`/`J`/`F` glyphs too. Candidate signals already ruled out: negative-`forte`
(only ever fires on Camellya, whose ordinary basics spend forte) and skill
`duration` (the transformation — Cartethyia — is the one forte skill _without_ a
duration).

### Title and controls

Title line: the slot character names joined by `/`, plus an optional `{seconds}s`
duration. Duration is on by default with an opt-out; the `{seconds}` come from
`getTimelineSummary().totalTimeFrames`, derived from authored stage timing — **no
simulation run required**. No difficulty tag.

Entry point is a **Share image** button in the `Header` right zone, placed
`Save → Share image → Import/Export`. It opens a modal with a centered live
preview (the node that gets rasterized — WYSIWYG), **Download PNG** and **Copy to
clipboard**, the duration toggle, and a **theme toggle** (dark default / light).

The theme selects one of two **self-contained palettes** in `ShareCard.tsx`
(shell, card, glyph, label-bar, divider colors) — the card paints its own colors
inline rather than inheriting the app's CSS tokens, so the rendered PNG looks the
same regardless of the surrounding page theme. Light swaps to dark label bars and
outlines the cards (border on the non-accent sides) instead of relying on
luminance contrast.
