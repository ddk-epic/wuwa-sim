# wuwa-sim · Design system

A focused design system extracted from the wuwa-sim timeline editor — a dark, dense, information-first interface for building character action rotations.

This system covers the **foundations only**: type, colors, backgrounds, and buttons. It does not ship a full UI kit; the existing `Main Page Directions.html` serves as the in-product reference.

## Index

- `README.md` — this file
- `colors_and_type.css` — every token as CSS custom properties + a small set of semantic utility classes
- `preview/*.html` — visual specimens (each registered as a card in the Design System tab)
- `SKILL.md` — agent skill manifest

## Content fundamentals

The product speaks like a power-user tool, not a marketing surface.

- **No marketing copy, no exclamations.** Every label is a noun or a short verb: `simulate`, `log`, `reset`, `import`, `export`, `new group`, `dmg`, `dps`, `t`.
- **All-lowercase action labels.** `simulate`, not `Simulate`. The only Title Case strings are proper nouns (character + skill names like _Sanhua_, _Frostfall Combo 1–3_).
- **All-uppercase mono tags.** Column headers (`TIME`, `CHAR`, `DAMAGE`), skill type chips (`INTRO`, `RESONANCE`), and variant tags (`IC`, `CX`, `FL`) sit in 9–10px uppercase Mono with wide tracking.
- **Mono everywhere numerics live.** Time, frames, damage, energy, kbd hints, skill counts — all JetBrains Mono with `font-variant-numeric: tabular-nums` so columns stay aligned.
- **Zero emoji.** Every glyph is either a lucide icon or a single semantic Unicode character (`├`, `└`, `—`, `·`, `×`).
- **No "you" / no "we".** The product never addresses the user directly. Status reads like a log line: `ready`, `14 actions, 3 groups`, `untitled`.

## Visual foundations

### Surfaces

A three-tier dark palette, used consistently:

| Token   | Hex       | Role                                                       |
| ------- | --------- | ---------------------------------------------------------- |
| `--bg`  | `#0b0c10` | Neutral canvas — the timeline rows themselves              |
| `--bg2` | `#10131a` | Raised chrome — header strip, table-top bar, row hover     |
| `--bg3` | `#090a0e` | Receded chrome — sidebars, left rail, sticky column header |

The relationship is **canvas → raise → recede**, not "darker = behind". `bg3` is darker than `bg` but visually sits _behind_ it because every region is divided by a 1px `--line` border, not by shadow or elevation.

There are no shadows in the system. No blur, no glassmorphism. Depth comes from these three tones plus hairline borders.

### Borders

- **Always 1px, always `--line` (`#1c2029`)**, except where an element color tints the border (e.g. group bar top: `${element}66`).
- Vertical dividers between header sections are 1px high-contrast `--line` strips, 20px tall.
- Row separators inside the table are also 1px `--line`, but when the character switches between two adjacent rows the border picks up the new character's element color at `33` alpha (≈20%).

### Type

- **Manrope** for everything that isn't a number or a tag. Weights 400 / 500 / 600 / 700.
- **JetBrains Mono** for numerics, identifiers, tags, keyboard hints, and column headers. Same weights.
- Body sits at **12px** — that's the default. The scale runs 9 / 10 / 11 / 12 / 13 / 16. There is no 14, 15, 18, 20, etc. Density is the point.
- Hero numbers (the dmg total) hit **16px semibold mono with -0.2px tracking** — the only place the eye is told "this is the headline".

### Color usage

Color is **semantic, not decorative**.

- **Yellow `#f5cf4d`** always means damage or concerto energy.
- **Cyan `#5ad7f0`** always means time / dps / rate.
- **Purple `#9b6cf0`** always means resonance.
- **Periwinkle `#a3bfff`** is the neutral accent — time values, primary CTA text, kbd hints.
- **Red `#ff7a8a`** is destructive only — the per-row × cross icon on hover, the group delete icon on hover. There are no warning yellows or info blues — those would conflict with the data colors above.
- **Green `#5fd49a`** is positive state only (e.g. the "● ready" status dot).

The **element palette** (Fusion / Glacio / Electro / Aero / Havoc / Spectro) is its own slot — these colors appear only on character avatars, element badges, skill-type chips that follow a character, and group-header gradient stops.

### Backgrounds with gradient

The single exception to the "no gradient" rule is the **group bar background**. A group spans multiple characters; its header bar shows a left-to-right linear gradient between member element colors at low alpha (`33` ≈ 20%), weighted by each member's action count, fading to `transparent` past 75%. This is the only place color is used to encode _composition_ rather than identity.

### Buttons

Three variants, all on the same 24px-tall horizontal rhythm:

1. **Primary** — only one per region. `--accent-btn-bg` fill, `--accent-text` color, `--accent-btn-border` 1px border. Used for `simulate`.
2. **Ghost** — transparent with 1px `--line` border. Hover lifts to `--bg3` background and `--fg` text. Used for every other action button (`log`, `reset`, `import`, `export`, `new group`).
3. **Icon** — square, borderless. Color shifts from `--muted` to `--fg` on hover. The destructive variant shifts to `--data-danger` instead. Three sizes (20 / 22 / 32).

All buttons share:

- `--radius-2` (3px) corners — hard but not square.
- Inline-flex with a 5px gap between a leading icon and label text.
- 11px Manrope medium label, no uppercase, no letter-spacing change.
- No focus ring is defined; rely on the host browser default.

### Hover / press

- **Buttons** — color shift only. No scale, no shadow.
- **Rows** — background lifts from `--bg` to `--bg2` on hover; selected rows use `--accent-bg` and gain a left-edge accent strip in the row's element color.
- **Icons** — color shift only. Destructive icons (× / trash) shift to red.

### Iconography

All chrome icons are from **lucide icons**, inlined as SVG paths and tinted via `currentColor`. The full set in use:

`ChevronRight`, `Cross1`, `LockClosed`, `Copy`, `Trash`, `PlusCircled`, `Play`, `Reset`, `Download`, `Upload`, `Gear`, `Layers`, `Rows`, `Clock`, `Pencil1`.

A handful of semantic Unicode characters are also load-bearing:

- `├` / `└` — group child indicators (tree branches)
- `—` — null/empty cell
- `·` — separator (between character names)
- `×` — replaced by `Cross1` on rows; still appears in counts like "× 4"

There is no icon font, no emoji, no decorative imagery.

## Caveats

This system covers **type, color, backgrounds, buttons** as requested — nothing else. There are no spacing tokens, elevation tokens, motion tokens, or component recreations beyond the buttons. The full timeline component (`design-groups.jsx`) is the high-fidelity reference if you need more.

## Iterate

Tell me what's missing or wrong. Likely candidates:

- A token I missed (e.g. a spacing scale — there isn't one yet because spacing is hand-tuned per row).
- A button state you want defined (focus ring? pressed?).
- Whether the element palette belongs in this system at all, or should move to a separate "data semantics" doc.
