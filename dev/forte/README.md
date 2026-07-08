# `/dev/forte` — Forte Tool

A dev-only authoring aid for deriving each stage's **forte** — the resource a
character builds and spends on the forte gauge — **empirically from gameplay**.
You record a **repeated stage sequence** (`b1 b1 b1 b1`), calibrate the on-screen
gauge for that clip, drop a **separator** on the settle plateau of each repeat,
and the tool averages the consecutive gauge deltas into that clip's per-repeat
forte, with a spread. You read the summary table and difference the clip totals
into per-stage forte by hand; the automated solver and file export are a deferred
Phase 2.

**Source files:** `src/routes/dev.forte.tsx` (and supporting `dev/forte/` at the
repo root) — a `DEV`-gated, pure client-side route, sibling to `dev/frames/` and
reusing its video stepper, stage catalog, and persistence helpers.

- `clip.ts` — the `ForteClip` model and the single mutation door, `applyForteEdit`.
  Also the even-division section projection (`forteSections`, `forteStageIndexOf`).
- `calibration.ts` — the per-clip gauge axis and the fill-to-fraction projection.
- `reconcile.ts` — the statistical per-clip averager (`mean ± spread`).
- `summary.ts` — gathers every clip into the holder table's rows and its TSV.
- `storage.ts` — localStorage persistence, keyed per character.
- `FortePage.tsx` — the editor plus the summary modal.

## Why it exists

Forte values (`stage.forte` on cast, `damage[i].forte` per hit) are read off the
gauge frame-by-frame, the same hand-count problem `/dev/frames` solves for timing.
Two things make forte its own tool rather than a column in the frames tool:

- **The reading is a gauge level, not a frame.** It's measured against an
  on-screen bar whose pixel extent differs per recording, so each clip owns a
  **calibration**, and a reading is a fraction along that calibrated bar.
- **The averaging is statistical.** A repeated sequence gives several independent
  readings of the same quantity, so they average with a spread — the opposite of
  the timing tool's exact-agreement discrepancy check. Reusing that reconciler
  would be wrong; `dev/forte/reconcile.ts` is deliberately separate.

Combo-reliant stages can't be cast alone, so their forte is only reachable by
**differencing prefix sequences** (`forte(b12) = seq(b1 b2) − seq(b1)`), the same
differencing method the frames tool uses for timing. That second layer is the
Phase 2 solver; Phase 1 ships the per-clip measurement and the holder that makes
the differencing legible.

## Core model

- **ForteClip** — one recording of a **repeated stage sequence**. It measures a
  single scalar: the forte of **one repeat** of its sequence, `± spread`. No
  shared state with the timing `Clip`; it carries its own sequence, scope, video
  alignment, calibration, and separators. The clip has **no interior dividers** —
  a repeated sequence's occurrences split the span **evenly** (`forteSections`),
  which is enough to credit a reading to a repeat.

- **Calibration** — a per-clip `{ empty, full }` axis overlaid on the gauge, in
  **normalized `[0,1]` video-frame coordinates** (never display pixels), so a
  canvas resize or the 50%/100% toggle doesn't move it. `full → forteCap`,
  `empty → 0`; any straight bar at any angle. Radial gauges are out of scope.

- **Separator** — one gauge reading at a settle plateau, `{ id, frame, fill,
owner }`, no cue tag. `fill` is the **raw handle point** (normalized canvas
  coords) where the gauge's fill edge sits; the **gauge level** (a fraction along
  the calibrated axis) and the **gain** are projected through the clip's
  calibration, never stored. `owner` is the stage occurrence the placement frame
  lands in (`forteStageIndexOf`), **sticky**: dragging the frame into a later
  section keeps the credit and the table shows a trailing displacement badge
  (mirroring the frames tool's `MarksTable`). Marks are truth; gains are
  projections.

- **Per-clip reading** — order the separators by `owner`, prepend the **baseline**
  (`0` by default; a non-zero start is an explicit clip field), take consecutive
  differences; each diff `× forteCap` is one observation of the sequence's
  per-repeat forte. Sign falls out of the delta (a spend reads negative).
  `reconcile.ts` averages the observations: `n` readings → `mean ± spread`
  (sample standard deviation, so Phase 2 can combine spreads by adding variances),
  `unmeasured` below two fenceposts (baseline plus at least one separator). A
  `b1×4` clip yields four readings of `forte(b1)`.

- **Frame unit** — 60fps engine frames, 1:1 with the recording, exactly as
  `/dev/frames` (which owns the video stepper this tool reuses).

## The holder table

The summary modal (`SummaryModal`, opened from the Clips panel) gathers **every
clip into one read-only table** — one row per clip, columns for the per-repeat
readings, the average, the percentage, the forte value (`× forteCap`), and the
error margin (spread). It reproduces the manual spreadsheet
(`tmp/forte-solver-manually.png`, left table). Every value is
**calibration-normalized** (%/forte), **never raw pixels**, since each clip owns
its own calibration and a pixel means nothing across clips. Copy-to-clipboard
emits a **tab-separated** table so you can paste it into a sheet and do the
differencing and rotation sums by hand.

It is a **holder**, not a solver: it lists the clip totals as measured and leaves
the per-action reconciliation to Phase 2. A clip with no separators shows as
`unmeasured` rather than a fabricated zero.

## Deferred: the solver and export

Phase 2 turns the holder's per-clip totals into **per-stage** forte and patches
the character file:

- **Differencing solver** — for a combo-reliant stage, `forte(bk) = mean(prefix
b1..bk) − mean(prefix b1..b(k-1))`; independent stages read directly from their
  own clip. Spread propagates through the subtraction. Produces the per-action
  reconciliation (the spreadsheet's right table).
- **`damage[i].forte` export** — even split across a stage's hits, emitted as the
  literal `total / hitCount` (matching the authored form), through the same
  serializer/diff machinery the frames tool's export uses. No gating: whatever is
  measured is written.

Until it lands, you read the holder and difference by hand.

## Persistence

The clip set persists to **localStorage, keyed per character**, debounced off the
edit hot path (`useDebouncedSave`, reused from `dev/frames`), flushed on character
switch and unload. Calibration, separators, and baseline are plain fields on the
clip, so they round-trip with it and need no separate store. A clip's `stageRefs`
re-hydrate from the live catalog by id on load (`rehydrateForteClips`), so a
catalog edit propagates without a migration.

## Recording protocol

The measurement assumes a **clean base reading**: start the gauge **depleted**,
execute at **combo speed** (the same tight-execution assumption differencing
rests on), and run with **no Forte Recharge bonuses**, so what you measure is the
base value the character file wants. Place one separator per repeat at the
**settle plateau** — the frame the gauge stops moving after the hit resolves — not
mid-animation.

## Gotchas

- **Nothing derived is stored.** A separator stores its raw fill **point** and
  frame; the gauge level, the gain, and the section owner-position are all
  recomputed. Re-calibrating the bar or moving the baseline **reflows every gain**
  automatically — you never re-measure a separator because the bar moved.
- **`owner` is sticky, position is not.** The credit is set at placement and
  survives dragging the frame; the displacement badge flags a separator whose
  frame has drifted out of its owning repeat, exactly as delayed hits work in the
  frames tool.
- **Even division is an approximation.** With no interior dividers, occurrences
  split the span evenly; it only has to be good enough to assign a plateau reading
  to the right repeat, which it is for a tightly-executed loop.
- **The statistical reconciler is not the timing one.** Forte readings **average**;
  timing readings **must agree**. Don't reuse `dev/frames/reconcile.ts` here.
- **`forteCap` is per-character** (Camellya 100, Cartethyia 120; default 100), read
  off the enriched character, the same source `dev/frames` reads.

## Related

- [CHARACTERS.md](../../src/data/CHARACTERS.md) — the `forte` / `forteCap` /
  `damage[i].forte` model these numbers feed.
- [`dev/frames/README.md`](../frames/README.md) — the sibling timing tool whose
  video stepper, stage catalog, persistence, and export machinery this reuses.
