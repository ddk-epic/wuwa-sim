# `/dev/frames` — Frame Tool

A dev-only authoring aid for deriving stage timing — `actionTime` and per-hit `actionFrame` — **empirically from gameplay**, the numbers `gen:character` can't know and that today are hand-counted by eye. You define **clips** (recorded action strings) of known length, mark stage cutoffs and hits inside them, tag each mark with the visual cue you used, and the tool **solves** for each stage's timing across all clips, scoring every result by confidence. Output is copy/download — you paste it into the character file by hand.

**Source files:** `src/routes/dev.frames.tsx` (and supporting `dev/frames/` at the repo root) — a `DEV`-gated, pure client-side route. No node/server side.

- `types.ts` — the `Clip` model and the single mutation door, `applyClipEdit`. Marks are stored as absolute clip-frames; stage membership and per-hit `actionFrame` are derived projections, never stored.
- `stages.ts` — flattens the bundled character registry into pickable `StageRef`s.
- `storage.ts` — localStorage persistence, keyed per character.
- `FramesPage.tsx` — the editor (ruler, marks table, stage overview).

## Why it exists

A freshly generated character file scaffolds every stage with `actionTime: 0` and every `DamageEntry` with `actionFrame: 0` (see [CHARACTERS.md](../../src/data/CHARACTERS.md) → timing model). Filling those zeros is the bulk of enrichment, and the values are read off recorded gameplay frame-by-frame. The hard part is that **stage boundaries are often not directly observable** mid-combo — so they're recovered by _differencing_ action strings (`len(basic 1234) − len(basic 234) = len(basic 1)`). This tool makes that measurement and arithmetic first-class.

Note the term collision: `pnpm extract` already means "pull raw character JSON from the game API." This tool does **empirical timing measurement**, a different sense — it is deliberately not called "extract."

## Core model

- **Clip** — one action string: an ordered, _contiguous_ run of stage references with a `start`/`end` (its total length in frames), plus internal **marks**. A Clip exists as pure numbers first; an mp4 backing is an optional measurement aid layered on later (phase 2), never a separate mode. Contiguity means `clipLength = Σ (its stages' actionTimes)` — which holds only under tight execution (no dawdling between inputs), an assumption the whole differencing method already rests on. A Clip may chain stages from **different skills** (a basic string flowing into a resonance skill is one action string).

- **Mark** — a point in a Clip. Two structural roles decide _what it constrains_:
  - **cutoff mark** — where one stage hands off to the next (a stage boundary).
  - **hit mark** — where a hit connects (becomes an `actionFrame`). A hit's frame places it, but its **owning stage** is a separate, sticky fact: delayed (trailing) damage lands inside a later stage's frames while it is caused by an earlier one. A hit stores an absolute `owner` stage index, **set at placement** (you click inside the stage that causes it) and never changed by dragging — dragging moves only the frame, so dragging a hit across a boundary makes it delayed (the table keeps it under its owner and shows a displacement badge). Re-owning is delete-and-replace; there is no reassign gesture. Capacity, grouping, and `actionFrame` (`hitFrame − owningStageStart`, which legitimately exceeds the owning stage's length for trailing damage) all key off the owner, not position. Authorship is manual: no rule recovers ownership, since a later stage's own hit can land before the earlier stage's trailing one.

    A hit can also sit in the **rest zone** — the placeholder tail `(restStart, end]` that opens when the last stage is deleted, so the survivor keeps its measured length instead of stretching over the gap. The rest zone is not a stage: it owns nothing, shows no badge, and is overwritten when a stage is appended. Its left edge (`restStart`) is a draggable divider that doubles as the last stage's end, so that stage stays resizable. A trailing hit orphaned there keeps its real owner and a large `actionFrame`.

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

> **MVP status.** The solver and confidence scoring are deferred — they are a second layer. Until they land, `actionTime`/`actionFrame` are projected from a **single selected clip** at face value (section widths and hit offsets, no cross-clip reconciliation). The variant and export steps below are built against that single-clip projection; the solver later replaces "section width" with a reconciled value without changing the export shape.

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

Cancel/swap timings need **no new measurement** — they project off the hit marks. A variant is an **ordinal pin to a target**, resolving to that target's `actionFrame` (0 for `start`):

```
target = "start" | "last" | { hit: n }
```

- **`cancel`** — default `last`; pins over `{start} ∪ hits`. Pin to a hit → produces `cancel = { actionTime: hit.actionFrame }`; pin to `start` → produces `instantCancel = { actionTime: 0 }`. The UI shows which kind it currently is. There is deliberately no `independent` flag: cancel defaults to the literal last hit, and the author overrides to an earlier hit (and hand-adds `DamageEntry.independent` on paste) when trailing hits fire either way.
- **`swap`** — default `start` (`actionTime: 0`, the [ADR-0018](../../docs/adr/0018-swap-variant-as-trailing-window.md) `swapFrames` fallback); pins over `{start} ∪ hits`. The override case is a multi-hit stage that commits the swap on a specific hit (Inferno Rider — swap starts the frame the 3rd hit lands).

`last` is a live sentinel — it resolves to the highest-`actionFrame` **placed** hit at export time, so it auto-tracks as hits are added (not a frozen ordinal). Resolution: `start` always resolves; `last` resolves iff ≥1 hit; `{ hit: n }` resolves iff that hit exists. An opted-in variant whose target is absent (dangling pin, or `last` with no hits) is **excluded from the export and warned** — never written, never auto-shifted.

The opt-in + ordinal target is **authored state**, not a measurement, so it is stored on the `Clip` keyed by stage-occurrence index (ordinal targets only, never a frame — the marks-are-truth invariant holds), mutated through the closed `ClipEdit` set, and authored in the marks table (the read-only stage overview can't host it). Per-occurrence storage is an MVP simplification; cross-clip identity reconciliation is the solver's concern.

## Output

Read-only against the **bundled character registry** (the compiled character modules the app already imports) — pick a character, the stage list seeds from its scaffolded `stages[]`. The tool holds the **runtime object**, not the `.ts` source text, so the export is **clone the whole character object → sparse-patch the selected clip's measurements → serialize**:

- `stage.actionTime` ← the stage's section width (rest-zone-aware at the tail).
- `stage.damage[i].actionFrame` ← the _i_-th hit by frame, capped at `hitCount`; fewer hits patch only the leading entries.
- `stage.variants` ← resolved variants only (init `variants ??= {}` first — the field is optional and can be absent at runtime even though the generator scaffolds `{}`).
- A stage the selected clip **repeats** can't patch one slot twice — detect the duplicate identity and **skip it with a warning** rather than silently picking an occurrence.

The **export menu** sits beside the character name (character-scoped, though still fed by the selected clip — disabled until one is picked) and is **copy-only**, two kinds, each opening a tabbed modal:

- **TS** — a GitHub-style diff: `characterToTs(registry)` vs `characterToTs(patched)`. Both sides go through the **same serializer** (object literal with unquoted keys, wrapped in the deterministic `import … / export const <name> = … satisfies <Type>` boilerplate), so the diff is noise-free — only patched values and added variant lines show. A self-rolled LCS line diff renders changed hunks with context in a split view; unresolved-variant / repeated-stage **warnings** banner above it. You paste the result into the character file by hand; the tool never reads or writes a `.ts` on disk.
- **MD** — a shareable read-out, not paste source: the read-only sidebar's view as a table — the whole stage catalog, measured against the selected clip, with each stage's `actionTime` and resolved `cancel`/`swap` and a row per hit slot up to capacity. Unmeasured hits (and stages absent from the clip) render as an em-dash, so it doubles as a checklist of what's left to count. Shown as raw markdown (no renderer dependency).

(JSON and a download button were considered and dropped — the diff is the transcription aid, and the markdown is the shareable artifact.)

## Persistence

The clip set persists to **localStorage, keyed per character**, so a reload doesn't wipe a measurement campaign (the accumulation of clips is the whole point of differencing).

## Phase 2 (deferred)

A full frame-stepping player with mp4 (or similar) upload, layered onto the same Clip entity: scrub/step to find frame numbers, mark on the video timeline. This is where the per-clip source-fps → 60fps conversion seam activates. The phase-1 data model is built to absorb it without reshaping (marks already store absolute clip-frames).

## Gotchas

- **Contiguity assumes tight execution.** `clipLength = Σ actionTimes` breaks if you dawdle between inputs; record clips at combo speed.
- **Marks are truth; timings are projections.** Never persist `actionTime`/`actionFrame` — always re-derive from absolute marks so an upstream refinement propagates. Variants store an ordinal target, not a frame, for the same reason.
- **Conflicts are a feature.** An over-determined inconsistency is a miscount signal, not an error to suppress.
- **One door for every clip mutation.** All edits flow through the closed `ClipEdit` set and the pure `applyClipEdit` reducer (in `types.ts`) — editors dispatch an edit and never reshape a `Clip` in place. That single door is where the structural invariants live: the boundary-count rule (`boundaries.length === max(0, stageRefs.length − 1)`) and per-stage hit capacity. An illegal edit (over capacity, no room for a divider) returns the clip unchanged rather than throwing, so callers may dispatch optimistically and check the returned clip.
- **`variants` may be absent at runtime.** The optional field is dropped from enriched stages that author no variant; the export patch must `variants ??= {}` before writing.

## Related

- [CHARACTERS.md](../../src/data/CHARACTERS.md) — the stage timing model these numbers feed (`actionTime`, `actionFrame`, variants).
- [enriched-model](../../docs/enriched-model.md) — why timing is a manual enrichment step over raw extraction.
- [ADR-0008](../../docs/adr/0008-stage-variants-as-actionframe-truncation.md) — the cancel/swap truncation contract the derived variants conform to.
- [ADR-0018](../../docs/adr/0018-swap-variant-as-trailing-window.md) — swap's trailing-window semantics and the `swapFrames` default.
