# Frame Tool (`/dev/frames`)

A dev-only authoring aid for deriving stage timing — `actionTime` and per-hit `actionFrame` — **empirically from gameplay**, the numbers `gen:character` can't know and that today are hand-counted by eye. You define **clips** (recorded action strings) of known length, mark stage cutoffs and hits inside them, tag each mark with the visual cue you used, and the tool **solves** for each stage's timing across all clips, scoring every result by confidence. Output is copy/download — you paste it into the character file by hand.

This is a spec for an unbuilt tool; the model below is the agreed design.

**Source files (planned):** `src/routes/dev.frames.tsx` (and supporting `src/dev/frames/`) — a `DEV`-gated, pure client-side route. No node/server side.

## Why it exists

A freshly generated character file scaffolds every stage with `actionTime: 0` and every `DamageEntry` with `actionFrame: 0` (see [CHARACTERS.md](../../src/data/CHARACTERS.md) → timing model). Filling those zeros is the bulk of enrichment, and the values are read off recorded gameplay frame-by-frame. The hard part is that **stage boundaries are often not directly observable** mid-combo — so they're recovered by _differencing_ action strings (`len(basic 1234) − len(basic 234) = len(basic 1)`). This tool makes that measurement and arithmetic first-class.

Note the term collision: `pnpm extract` already means "pull raw character JSON from the game API." This tool does **empirical timing measurement**, a different sense — it is deliberately not called "extract."

## Core model

- **Clip** — one action string: an ordered, _contiguous_ run of stage references with a `start`/`end` (its total length in frames), plus internal **marks**. A Clip exists as pure numbers first; an mp4 backing is an optional measurement aid layered on later (phase 2), never a separate mode. Contiguity means `clipLength = Σ (its stages' actionTimes)` — which holds only under tight execution (no dawdling between inputs), an assumption the whole differencing method already rests on. A Clip may chain stages from **different skills** (a basic string flowing into a resonance skill is one action string).

- **Mark** — a point in a Clip. Two structural roles decide _what it constrains_:
  - **cutoff mark** — where one stage hands off to the next (a stage boundary).
  - **hit mark** — where a hit connects (becomes an `actionFrame`).

  Plus the Clip's own `start`/`end` act as boundary constraints. **Every mark is stored as an absolute clip-frame — this is the single source of truth.** `actionTime` and `actionFrame` are _derived projections_, recomputed on every solve, never stored. So a hit measured once survives forever as its absolute frame: if a later revisit refines a fuzzy `actionTime` (shifting where its stage starts), the projected `actionFrame = absoluteHitFrame − stageStart` updates automatically — you never re-watch footage to re-measure the hit.

- **Stage** — the unknown being solved for. A stage is a **shared identity across clips** (a real stage key from the bundled character registry): "Basic 1" has one true `actionTime`, and every clip containing it is one observation constraining that single unknown. This is what makes differencing valid.

- **Frame unit** — every number is a **60fps engine frame**, matching the simulator's timing model. Only 60fps input is supported for now; the phase-2 video path will carry a per-clip source-fps and convert on import (`engineFrame = videoFrame × 60 / sourceFps`), but that seam is deferred.

## The solver

Each mark and clip is a linear equation over the stages' `actionTime`s:

- a directly-marked cutoff or clip boundary → `A = 50`
- a marked sub-span → `A + B = M`
- a whole clip → `Σ (its stages) = clipLength`
- cross-clip differences fall out for free (`len(1234) − len(234)` is just two equations)

The tool solves the small linear system (a skill is ~4–10 stages, a handful of clips — trivial to re-run on every edit) and reports per stage:

- **under-determined** — not yet pinned; record another clip that adds an equation.
- **solved** — determined, with a confidence score.
- **conflicting** — over-determined and inconsistent (two measurements disagree). Surfaced rather than silently averaged: for empirical frame-counting this is how a miscount is caught, so redundant clips are cross-checks, not waste.

## Confidence

Confidence splits cleanly into two inputs, and is **auto-derived** — no manual override:

- **Trust of each mark** comes from its **cue tag** — the visual cue you used to place it. Trust lives on the cue, not the structural role: a cutoff justified by an `animationBreak` is far more trustworthy than an `estimate` cutoff.
- **Corroboration** — redundancy and agreement across clips (system rank and residuals). A value confirmed by three clips that agree to the frame scores high; a lone fuzzy mark scores low.

Final confidence = best contributing cue × corroboration, surfaced as **high / medium / low** with a one-line provenance that cites the cue — e.g. _"3 clips, `impactFlash`-bounded, agree ±0"_ vs _"single mid-combo `estimate` cutoff."_

### Cue taxonomy (closed, fixed weights)

| Cue              | What it means                                                   | Trust   |
| ---------------- | --------------------------------------------------------------- | ------- |
| `impactFlash`    | hit flash / damage number / hitstop freeze                      | highest |
| `vfxEdge`        | a skill effect or trail appears or clears (rising/falling edge) | high    |
| `animationBreak` | an abrupt pose or motion discontinuity                          | medium  |
| `estimate`       | judgement call, no clean visual anchor                          | lowest  |

`actionFrame` confidence is the **weaker of** (the hit mark's cue, the stage-start it's measured against): a crisp `impactFlash` hit over a fuzzy stage start is only as trustworthy as that start — but refining the start later sharpens it for free.

## Variants (derived, not marked)

Cancel/swap timings need **no new measurement** — they project off the hit marks:

- **`cancel`** → `actionTime` = the stage's last hit's `actionFrame` (the documented rule of thumb). Computed.
- **`swap`** → `actionTime: 0` by default. The lone exception is a multi-hit stage that commits the swap on a specific hit (Inferno Rider — swap starts the frame the 3rd hit lands): a per-stage "swap pins to hit #N" toggle sets `swap.actionTime` = that hit's `actionFrame`.

## Output

Read-only against the **bundled character registry** (the compiled character modules the app already imports) — pick a character, the stage list seeds from its scaffolded `stages[]`. After solving, **copy or download** a paste-ready TS block keyed by stage, carrying each stage's `actionTime`, its hits' `actionFrame`s, the computed `cancel`, and `swap`. You paste it into the character file by hand — the tool never reads or writes a `.ts` on disk.

## Persistence

The clip set persists to **localStorage, keyed per character**, so a reload doesn't wipe a measurement campaign (the accumulation of clips is the whole point of differencing).

## Phase 2 (deferred)

A full frame-stepping player with mp4 (or similar) upload, layered onto the same Clip entity: scrub/step to find frame numbers, mark on the video timeline. This is where the per-clip source-fps → 60fps conversion seam activates. The phase-1 data model is built to absorb it without reshaping (marks already store absolute clip-frames).

## Gotchas

- **Contiguity assumes tight execution.** `clipLength = Σ actionTimes` breaks if you dawdle between inputs; record clips at combo speed.
- **Marks are truth; timings are projections.** Never persist `actionTime`/`actionFrame` — always re-derive from absolute marks so an upstream refinement propagates.
- **Conflicts are a feature.** An over-determined inconsistency is a miscount signal, not an error to suppress.
- **One door for every clip mutation.** All edits flow through the closed `ClipEdit` set and the pure `applyClipEdit` reducer (in `src/dev/frames/types.ts`) — editors dispatch an edit and never reshape a `Clip` in place. That single door is where the structural invariants live: the boundary-count rule (`boundaries.length === max(0, stageRefs.length − 1)`) and per-stage hit capacity. An illegal edit (over capacity, no room for a divider) returns the clip unchanged rather than throwing, so callers may dispatch optimistically and check the returned clip.

## Related

- [CHARACTERS.md](../../src/data/CHARACTERS.md) — the stage timing model these numbers feed (`actionTime`, `actionFrame`, variants).
- [enriched-model](../enriched-model.md) — why timing is a manual enrichment step over raw extraction.
- [ADR-0008](../adr/0008-stage-variants-as-actionframe-truncation.md) — the cancel/swap truncation contract the derived variants conform to.
