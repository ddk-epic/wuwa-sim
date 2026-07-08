# `/dev/forte` — Forte Tool

A dev-only authoring aid for deriving each stage's **forte** — the resource a
character builds and spends on the forte gauge — **empirically from gameplay**.
You author a **repeated stage sequence** (`b1 b1 b1 b1`), capture **one
screenshot per occurrence** of the gauge, calibrate the on-screen bar once, mark
the gauge fill on each screenshot, and the tool averages the consecutive gauge
deltas into that clip's per-repeat forte, with a spread. You read the summary
table and difference the clip totals into per-stage forte by hand; the automated
solver and file export are a deferred Phase 2.

**Screenshots, not video.** Forte is read by counting pixels along a thin gauge,
so still frames at full resolution beat a decoded video frame. Each occurrence
holds its own screenshot; there is no footage, scope, or frame timeline.

**Source files:** `src/routes/dev.forte.tsx` (and supporting `dev/forte/` at the
repo root) — a `DEV`-gated, pure client-side route, sibling to `dev/frames/` and
reusing its stage catalog and persistence helpers.

- `clip.ts` — the `ForteClip`/`ForteSlot` model and the single mutation door,
  `applyForteEdit`.
- `calibration.ts` — the per-clip gauge axis and the fill-to-fraction projection.
- `reconcile.ts` — the statistical per-clip averager (`mean ± spread`).
- `summary.ts` — gathers every clip into the holder table's rows and its TSV.
- `storage.ts` — localStorage persistence, keyed per character, plus the
  last-calibration seed and the migration off the retired frame model.
- `components/ScreenshotHolder.tsx` — the per-slot screenshot pane (paste, drop,
  pick) the calibration/fill overlay sits on.
- `components/ForteRuler.tsx` — the equal-width slot selector.
- `FortePage.tsx` — the editor plus the summary modal.

## Why it exists

Forte values (`stage.forte` on cast, `damage[i].forte` per hit) are read off the
gauge by eye, the same hand-count problem `/dev/frames` solves for timing. Two
things make forte its own tool rather than a column in the frames tool:

- **The reading is a gauge level, not a frame.** It's measured against an
  on-screen bar whose pixel extent differs per capture, so each clip owns a
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

- **ForteClip** — one capture of a **repeated stage sequence**, as an array of
  **slots**. It measures a single scalar: the forte of **one repeat** of its
  sequence, `± spread`. No shared state with the timing `Clip`; it carries its
  own sequence, calibration, and readings.

- **ForteSlot** — one occurrence in the sequence: its `ref`, an optional gauge
  `reading`, and a stable `id`. The slot's **screenshot lives only in editor
  memory** (see Persistence); the reading persists. Slots are the equal-width
  cells of the ruler, and the slot index _is_ the repeat number the reconciler
  orders by.

- **Calibration** — a per-clip `{ empty, full }` axis overlaid on the gauge, in
  **normalized `[0,1]` screenshot coordinates** (never display pixels), so it
  transfers across every slot's screenshot as long as they're framed alike.
  `full → forteCap`, `empty → 0`; any straight bar at any angle. One calibration
  covers the whole clip; a fresh clip **seeds it from the last calibrated axis**,
  since the gauge sits at a fixed screen position. Radial gauges are out of scope.

- **Reading** — one slot's **raw fill-marker point** (normalized screenshot
  coords) where the gauge's fill edge sits. The **gauge level** (a fraction along
  the calibrated axis) and the **gain** are projected through the clip's
  calibration, never stored. Marks are truth; gains are projections.

- **Per-clip reading** — walk the slots in order from a **depleted (`0`) start**,
  take consecutive differences across the **measured** slots; each diff
  `× forteCap` is one observation of the sequence's per-repeat forte. Sign falls
  out of the delta (a spend reads negative). The recording protocol starts the
  gauge empty, so the first entry's gain is read straight off `0`.
  `reconcile.ts` averages the observations: `n` readings →
  `mean ± spread` (sample standard deviation, so Phase 2 can combine spreads by
  adding variances), `unmeasured` when no slot carries a reading. A `b1×4` clip
  with all four slots marked yields four readings of `forte(b1)`.

## The holder table

The summary modal (`SummaryModal`, opened from the Clips panel) gathers **every
clip into one read-only table** — one row per clip, columns for the per-repeat
readings, the average, the percentage, the forte value (`× forteCap`), and the
error margin (spread). Every value is **calibration-normalized** (%/forte),
**never raw pixels**, since each clip owns its own calibration and a pixel means
nothing across clips. Copy-to-clipboard emits a **tab-separated** table so you
can paste it into a sheet and do the differencing and rotation sums by hand.

It is a **holder**, not a solver: it lists the clip totals as measured and leaves
the per-action reconciliation to Phase 2. A clip with no readings shows as
`unmeasured` rather than a fabricated zero.

## Deferred: the solver and export

Phase 2 turns the holder's per-clip totals into **per-stage** forte and patches
the character file:

- **Differencing solver** — for a combo-reliant stage, `forte(bk) = mean(prefix
b1..bk) − mean(prefix b1..b(k-1))`; independent stages read directly from their
  own clip. Spread propagates through the subtraction.
- **`damage[i].forte` export** — even split across a stage's hits, emitted as the
  literal `total / hitCount` (matching the authored form), through the same
  serializer/diff machinery the frames tool's export uses.

Until it lands, you read the holder and difference by hand.

## Persistence

The clip set persists to **localStorage, keyed per character**, debounced off the
edit hot path (`useDebouncedSave`, reused from `dev/frames`), flushed on character
switch and unload. Calibration and readings are plain fields on the clip/slots,
so they round-trip with it and need no separate store. A slot's `ref`
re-hydrates from the live catalog by id on load (`rehydrateForteClips`), so a
catalog edit propagates without a migration.

**Screenshots are in-memory only.** The pixels are heavy and would blow the
localStorage quota, so they live in editor state and are **dropped on clip switch
or reload** (the `key={clip.id}` remount clears them). The _readings_ survive;
reopening a clip shows the measured %s over empty holders until you re-paste the
images. The last calibrated axis persists separately (`lastCalibration`) to seed
new clips.

Clips saved under the retired frame model (`stageRefs` + frame-keyed separators)
**migrate on load** (`normalizeClip`): the name, sequence, and calibration carry
over as slots; the frame-keyed readings are dropped, since they're meaningless
without that timeline.

## Recording protocol

The measurement assumes a **clean base reading**: start the gauge **depleted**,
execute at **combo speed** (the same tight-execution assumption differencing
rests on), and run with **no Forte Recharge bonuses**, so what you measure is the
base value the character file wants. Take one screenshot per repeat at the
**settle plateau** — the moment the gauge stops moving after the hit resolves —
not mid-animation. Capture the same window/crop each time so one calibration
covers every slot.

## Gotchas

- **Nothing derived is stored.** A reading stores its raw fill **point**; the
  gauge level and the gain are recomputed. Re-calibrating the bar **reflows every
  gain** automatically — you never re-mark a slot because the bar moved.
- **Screenshots don't survive a reload.** Only the readings do. This is
  deliberate: the measured numbers are the deliverable, the pixels are scratch.
- **One calibration per clip.** It relies on consistent framing across a clip's
  screenshots; a screenshot framed differently will show the bar sitting wrong,
  re-shoot rather than per-slot calibrate.
- **The statistical reconciler is not the timing one.** Forte readings **average**;
  timing readings **must agree**. Don't reuse `dev/frames/reconcile.ts` here.
- **`forteCap` is per-character** (Camellya 100, Cartethyia 120; default 100), read
  off the enriched character, the same source `dev/frames` reads.

## Related

- [CHARACTERS.md](../../src/data/CHARACTERS.md) — the `forte` / `forteCap` /
  `damage[i].forte` model these numbers feed.
- [`dev/frames/README.md`](../frames/README.md) — the sibling timing tool whose
  stage catalog, persistence, and export machinery this reuses.
