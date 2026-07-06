# `/dev/frames` — Frame Tool

A dev-only authoring aid for deriving stage timing — `actionTime` and per-hit `actionFrame` — **empirically from gameplay**, the numbers `gen:character` can't know and that today are hand-counted by eye. You define **clips** (recorded action strings) of known length, mark stage cutoffs and hits inside them, tag each mark with the visual cue you used, and the tool **reconciles** each stage's timing across all clips, scoring every result by confidence. Output is copy/download — you paste it into the character file by hand.

**Source files:** `src/routes/dev.frames.tsx` (and supporting `dev/frames/` at the repo root) — a `DEV`-gated, pure client-side route. No node/server side.

- `types.ts` — the `Clip` model and the single mutation door, `applyClipEdit`. Marks are stored as absolute clip-frames; stage membership and per-hit `actionFrame` are derived projections, never stored.
- `stages.ts` — flattens the bundled character registry into pickable `StageRef`s, applying the same catalog-visibility filter the main app uses (skips hidden skills, hidden stages, and empty-named stages).
- `planner.ts` — the clip planner: suggests the minimal covering set of clips to record before any solving (see below).
- `storage.ts` — localStorage persistence, keyed per character.
- `video.ts` — the throwaway mediabunny decode pipeline behind the frame stepper (session-only, per clip).
- `FramesPage.tsx` — the editor (ruler, marks table, stage overview).

## Why it exists

A freshly generated character file scaffolds every stage with `actionTime: 0` and every `DamageEntry` with `actionFrame: 0` (see [CHARACTERS.md](../../src/data/CHARACTERS.md) → timing model). Filling those zeros is the bulk of enrichment, and the values are read off recorded gameplay frame-by-frame. The hard part is that **stage boundaries are often not directly observable** mid-combo — so they're recovered by _differencing_ action strings (`len(basic 1234) − len(basic 234) = len(basic 1)`). This tool makes that measurement and arithmetic first-class.

Note the term collision: `pnpm extract` already means "pull raw character JSON from the game API." This tool does **empirical timing measurement**, a different sense — it is deliberately not called "extract."

## Core model

- **Clip** — one action string: an ordered, _contiguous_ run of stage references with a `start`/`end` (its total length in frames), plus internal **marks**. A Clip exists as pure numbers first; an mp4 backing is an optional, throwaway measurement aid (the video frame stepper), never a separate mode and never persisted. Contiguity means `clipLength = Σ (its stages' actionTimes)` — which holds only under tight execution (no dawdling between inputs), an assumption the whole differencing method already rests on. A Clip may chain stages from **different skills** (a basic string flowing into a resonance skill is one action string).

- **Mark** — a point in a Clip. Two structural roles decide _what it constrains_:
  - **cutoff mark** — where one stage hands off to the next (a stage boundary).
  - **hit mark** — where a hit connects (becomes an `actionFrame`). A hit's frame places it, but its **owning stage** is a separate, sticky fact: delayed (trailing) damage lands inside a later stage's frames while it is caused by an earlier one. A hit stores an absolute `owner` stage index, **set at placement** (you click inside the stage that causes it) and never changed by dragging — dragging moves only the frame, so dragging a hit across a boundary makes it delayed (the table keeps it under its owner and shows a displacement badge). Re-owning is delete-and-replace; there is no reassign gesture. Capacity, grouping, and `actionFrame` (`hitFrame − owningStageStart`, which legitimately exceeds the owning stage's length for trailing damage) all key off the owner, not position. Authorship is manual: no rule recovers ownership, since a later stage's own hit can land before the earlier stage's trailing one.

    A hit can also sit in the **rest zone** — the placeholder tail `(restStart, end]` that opens when the last stage is deleted, so the survivor keeps its measured length instead of stretching over the gap. The rest zone is not a stage: it owns nothing, shows no badge, and is overwritten when a stage is appended. Its left edge (`restStart`) is a draggable divider that doubles as the last stage's end, so that stage stays resizable. A trailing hit orphaned there keeps its real owner and a large `actionFrame`.

  Plus the Clip's own `start`/`end` act as boundary constraints. **Every mark is stored as an absolute clip-frame — this is the single source of truth.** `actionTime` and `actionFrame` are _derived projections_, recomputed on every solve, never stored. So a hit measured once survives forever as its absolute frame: if a later revisit refines a fuzzy `actionTime` (shifting where its stage starts), the projected `actionFrame = absoluteHitFrame − stageStart` updates automatically — you never re-watch footage to re-measure the hit.

- **Stage** — the unknown being solved for. A stage is a **shared identity across clips** (a real stage key from the bundled character registry): "Basic 1" has one true `actionTime`, and every clip containing it is one observation constraining that single unknown. This is what makes differencing valid.

- **Frame unit** — every number is a **60fps engine frame**, matching the simulator's timing model. Recordings are 60fps CFR, so a video frame is an engine frame 1:1 and the anticipated source-fps conversion seam (`engineFrame = videoFrame × 60 / sourceFps`) collapses to identity; only ~60fps input is supported, verified on attach.

## The clip planner

Before any marking or solving, an author has to **record** the clips — and each
recording is a ritual, so the planner suggests the **minimal covering set** for a
character, from static data alone (no annotation). It targets two things, both met
by the same set: every stage's natural `actionTime` (pinned by a trailing basic
**sentinel**, or an interior cutoff), and every stage visible in ≥1 clip so its
hits can be marked. Variants are out of scope — they project off hit marks.

It reasons from the cancel/pin rules in [`references/cancellation.md`](../../references/cancellation.md):

- **Combo chains** (`requiresPriorStage`) become one clip each — internal cutoffs
  are the visible swings, and the tail is pinned by a loop-restart sentinel.
- **Standalone stages** pack **aggressively** into clips up to a stage cap, ordered
  so each stage's natural end is pinned by its successor: liberations first
  (uncancellable → anything waits), each skill trailed by a non-cancelling stage,
  the rest after, sentinel last. Only two link kinds are **proven** (combo links
  and `liberation → skill`); the rest are flagged **`verify`** — the pin is valid,
  but the author must confirm the transition records in one take.
- **Preconditions** are read off the data and badged, never composed: `swap-in`
  (Intro), `full-energy`/`cutscene` (Liberation), `airborne` (footing), an advisory
  `verify-forte`. Swap-in and aerial stages stay singletons; zero-damage Outros are
  omitted. A stage that's aerial-by-name but has no `footing` raises a **footing
  gap** warning rather than guessing a grounded plan.

The panel computes **coverage live** against the clips that already exist, so it
doubles as a checklist; each row **seeds** a real `Clip` pre-loaded with its stage
sequence (the sentinel is a recording instruction, never a stored stage).

## The reconciler

Every clip already carries all its interior dividers, so **every stage in every
clip has a concrete section width** — a direct `actionTime` reading. The reconciler
doesn't solve a system; it **groups those readings by stage identity and
cross-checks them**. It is a discrepancy _checker_, never a value _deriver_: it
invents nothing and averages nothing, it only reports how well a stage's clips
agree.

`reconcile(clips): Reconciliation` returns a `Map` keyed by stage id, each entry a
rung on a four-step **corroboration** ladder:

- **`unmeasured`** — no clip measures it yet.
- **`single`** — one reading; usable but uncorroborated (the minimum bar).
- **`confirmed`** — two or more readings agree, within a ±1-frame tolerance.
- **`conflict`** — two or more _same-trust_ readings disagree beyond tolerance: a
  miscount signal, surfaced rather than reconciled.

Trust comes from the cue (see below). A disagreement between readings of
_different_ cue weight is not a conflict — the higher-trust reading wins
(`impactFlash` over `estimate`). Only a **same-trust** spread is a true `conflict`,
left for the author to re-count: there is no auto-pick and no stored resolution, so
re-counting or deleting the bad mark is the only fix. Each entry carries its
`observations` (`{ clipId, value, cue }`) — the conflict drill-down, the provenance
line, and the corroboration input the confidence layer reads.

> **Deferred: the linear system.** Cross-clip _differencing_ — using a precise clip
> total plus a precise neighbour to override a fuzzy interior divider
> (`len(1234) − len(234)`) — needs a real linear solve. It's deferred; the reconciler
> ships as group-by-identity. The linear upgrade would change only how an
> observation's `value` is derived, not the `Reconciliation` shape — and even then it
> stays a checker: it surfaces discrepancies, never silently corrects them.

> **Confidence is still deferred.** Confidence tiers (high/medium/low) are a second
> layer over the reconciler's `observations`; until they land a stage shows only its
> corroboration rung. `actionTime` is reconciled across clips; `actionFrame`, hit
> offsets, the animation split, and resolved variants come from the stage's **best
> clip** (see [Stage projection](#stage-projection)).

Two stage kinds are exceptions to "done," applied where the registry is in hand
(the sidebar checklist and `buildExport`), not in the pure reconciler:

- **No-damage stages** (`hitCount` 0, non-cutscene) — a zero-damage Outro and the
  like — have nothing to measure or mark, so they **pass from the start**: the
  checklist drops the corroboration chip, lights the label white, and reads `pass`
  in the counter slot (mirroring a cutscene's `split`). (The other no-damage stages
  are hidden at generation and never appear.)
- **Cutscene stages** (registry `animationFrames`) read as frozen-animation garbage
  until an [animation split](#animation-splits) carves out the action lock. The
  checklist holds them at `unmeasured` (grey) and shows `split` as the work to do;
  export withholds `actionTime` and warns until the split is placed.

## Stage projection

`reconcile` answers one cross-clip question — does a stage's `actionTime` agree across
clips. Every **other** cross-clip question about a stage — which clip measured it most
completely, what that clip's hits project to as `actionFrame`s, whether it carries an
animation split, and what its variants resolve to — is answered by `projectStages`,
a sibling that **composes** the reconciler (it takes the `Reconciliation` as input and
never re-derives `actionTime`).

`projectStages(clips, recon): Map<stageId, StageProjection>` keys by stage id, like
`reconcile`; `projectionOf(map, id)` defaults an absent stage to `unmeasured`/empty (the
`statusOf` pattern). Each entry is the stage's **best-clip** reading:

```
StageProjection = {
  status            // the reconciler's actionTime rung
  best?: { clipId, index }   // best clip + its first-occurrence index; null = unmeasured
  hits[]            // best clip's owned hits, frame-ordered, split→0 applied, uncapped
  animationFrames?  // best clip's frozen leading slice; null when unsplit
  variants          // { cancel?, swap? } — see below
}
```

- **Best clip** — the clip whose **first occurrence** of the stage carries the most hits
  (the same first-occurrence rule the reconciler and sidebar use). The honest "best
  you've captured anywhere," independent of which clip is selected.
- **Hits** are projected once, here: `actionFrame = hitFrame − stageStart`, except a
  split stage's hits land in the frozen animation and project to `0`. Left **uncapped** —
  each reader applies its own capacity rule (export caps at `damage.length`, the snapshot
  pads to capacity, the sidebar shows `count/capacity`).
- **Variants** carry both cross-clip operations a stage's pin needs: _agreement_ across
  every clip that pins the track, and _resolution_ against the best clip. A track is
  absent when nothing is pinned; otherwise it is either
  `{ agreed: true, target, resolution }` or `{ agreed: false, targets }` (clips disagree
  — export warns and skips). Callers keep only output shaping: export owns the
  `cancel`/`instantCancel` key split and change recording; the snapshot owns its label
  text. Resolution lives here, so the snapshot's variant column and the TS export agree
  by construction.

Three readers share this one source, so the `actionFrame` rule, the best-clip rule, and
variant resolution each have exactly one home:

- **`buildExport`** patches `actionTime` (from `status`), `animationFrames`, each
  `damage[i].actionFrame` (from `hits`), and `variants` (from the agreed, resolved track).
- **The stage overview sidebar** renders the corroboration chip (from `status`), the
  `hits / capacity` counter, and the hit / conflict drill-downs.
- **The markdown snapshot** is a **best-clip** read-out (not the selected clip — that was
  pre-reconciler residue), so it mirrors exactly what the TS export would write.

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

## Animation splits

A cutscene stage (a Liberation opener, an intro animation) holds two timings: the
**`animationFrames`** the cutscene plays for — during which the engine stage timer
is **frozen** — followed by the **`actionTime`** action lock. On the ruler that whole
window is one section, so a stage may carry one **animation split**: a divider
_inside_ its section at the "control returns" frame. Footage left of it is the frozen
`animationFrames`; footage right of it is the running `actionTime`. Without a split a
stage is all `actionTime`, as before.

- **Available on every stage** — the tool doesn't infer which stages are cutscenes;
  the author places a split where one belongs. The discriminator in the exported file
  is simply the presence of `animationFrames`, so a stage that gets a split gains the
  field and a stage without one never does.
- **Owned by its stage** — splits are stored aligned to `stageRefs` (a parallel array,
  not the occurrence-keyed Record `variants` use), so removing a stage splices its
  split out with it; no remap.
- **Hits resolve to `actionFrame: 0`** — a split stage's hits land inside the frozen
  animation, so they export at 0 (the engine measures `actionFrame` from the lock's
  start). The "skills act during the animation" case is deferred.

## Output

Read-only against the **bundled character registry** (the compiled character modules the app already imports) — pick a character, the stage list seeds from its scaffolded `stages[]`. The tool holds the **runtime object**, not the `.ts` source text, so the export is **clone the whole character object → sparse-patch the measurements → serialize**. It is **character-scoped across the whole clip set**, not the selected clip: it patches every stage measured in any clip. `actionTime` comes from the reconciler; each stage's hits, split, and variant resolution come from its **best clip** — the one that measures it most completely (most hits):

- `stage.actionTime` ← the **reconciled** value (the reconciler's cross-clip reading, a rest-zone-aware section width), minus any leading animation when the stage carries an [animation split](#animation-splits). A `conflict` stage is **skipped and warned** — its `actionTime` isn't committed; the registry value stands until re-counted. A cutscene stage (registry `animationFrames`) with no split placed is **likewise skipped and warned** — its width is still frozen animation.
- `stage.animationFrames` ← the frozen leading slice, written only for a stage that has an animation split.
- `stage.damage[i].actionFrame` ← the _i_-th hit by frame from the best clip, capped at `hitCount`; fewer hits patch only the leading entries. A split stage's hits resolve to `0` (they land inside the frozen animation).
- `stage.variants` ← resolved variants only (init `variants ??= {}` first — the field is optional and can be absent at runtime even though the generator scaffolds `{}`). The **target** (the ordinal pin) is the authored fact, **aggregated across clips**: every clip agrees → use it; they **disagree → skipped and warned** (a cross-clip variant conflict). The agreed target then resolves against the best clip's hits, so `last` tracks the true final hit.
- A stage **repeated** in a clip (a trailing sentinel) patches from its **first occurrence**; later occurrences are ignored — the same first-occurrence rule the reconciler and sidebar use.

The **export menu** sits beside the character name (truly character-scoped — both the TS patch and the MD snapshot read the whole clip set via [stage projection](#stage-projection), disabled only when no clip exists) and is **copy-only**, two kinds, each opening a tabbed modal:

- **TS** — a GitHub-style diff: `characterToTs(registry)` vs `characterToTs(patched)`. Both sides go through the **same serializer** (`character-ts.ts`, its own module — not the measurement-patch in `export.ts`), so the diff is noise-free — only patched values and added variant lines show. The serializer is **two phases**: a character-aware **break policy** (`forcedBreaks` — the only place schema knowledge lives: a skill `stages` object always breaks, `variants` always breaks, a `buffs` object with ≥3 keys breaks) feeding a **generic** prettier-emulating literal printer (`toTsLiteral` — inline-or-break by an 80-col print width, unquoted identifier keys, 2-space indent, trailing commas; no schema knowledge). Tuned to prettier's defaults so a paste needs no reflow, then wrapped in the deterministic `import … / export const <name> = … satisfies <Type>` boilerplate. A self-rolled LCS line diff renders changed hunks with context in a split view; conflict / missing-split / unresolved-variant **warnings** banner above it. You paste the result into the character file by hand; the tool never reads or writes a `.ts` on disk.
- **MD** — a shareable read-out, not paste source: the read-only sidebar's view as a table — the whole stage catalog read off each stage's best clip (via [stage projection](#stage-projection)), with each stage's `actionTime` and resolved `cancel`/`swap` and a row per hit slot up to capacity. Unmeasured hits (and stages absent from every clip) render as an em-dash, so it doubles as a checklist of what's left to count. Shown as raw markdown (no renderer dependency).

(JSON and a download button were considered and dropped — the diff is the transcription aid, and the markdown is the shareable artifact.)

## Persistence

The clip set persists to **localStorage, keyed per character**, so a reload doesn't wipe a measurement campaign (the accumulation of clips is the whole point of differencing).

A stored clip's `stageRefs` carry catalog-derived fields (`hitCount`, display name, `expectsSplit`) baked in at add time, but the **catalog is the truth**: `rehydrateClips` (in `stages.ts`) refreshes each ref from the live character by `id` on load, so a catalog edit propagates without a migration. Ids gone from the catalog (renamed/removed) and the spacer placeholder keep their stored ref. Re-hydration runs on load (mount and character switch), not on a hot-reload of the character while the same one is open — refresh the page to pick that up. The refreshed refs write back on the next clip edit, so stale snapshots self-heal out of storage.

## The video frame stepper

The editor is a **manual timing tool first** — set a length, add stages, place hits/dividers by clicking the ruler and typing frame numbers, with no recording involved. The mp4 stepper is an **optional overlay** bolted on top: attach footage to read exact frame numbers off it instead of counting by eye. Source files: `video.ts` (the decode pipeline) and `components/VideoPane.tsx` (canvas + transport). There is **one always-on editor** (`ClipEditor.tsx`), not a mode gate.

- **Clips are 0-based.** A clip is always `[0, length]`; marks are absolute clip-frames within it. A manually-timed clip is born 0-based; a clip scoped from footage is **normalized on lock-in** (`lockScope` sets `length = out − in` and keeps the in-cut as `offset`). Marks are **never shifted** — they're only ever authored in 0-based work space, so scoping moves only the window, not the marks. The video alignment is metadata, never a coordinate: `clip.offset` is the absolute video frame that clip-frame 0 maps to (`videoFrame = clipFrame + offset`). `enterScope` (Re-scope) lifts the window back to absolute frames; it's the inverse.
- **Footage assumption.** Recordings are 60fps CFR H.264, roughly cut, throwaway. So **a video frame is an engine frame, 1:1** — the anticipated source-fps → 60fps seam collapses to identity and is not built. The container fps is verified on attach and warns if it isn't ~60.
- **Decode path.** [mediabunny](https://mediabunny.dev) (zero-dep WebCodecs demux + decode). `Input`/`BlobSource` parses the file; `CanvasSink.getCanvas(frame / 60)` does the keyframe-seek-and-decode-forward internally and returns a rasterized canvas — frame-exact rather than `currentTime`-approximate, with `VideoFrame.close()` the library's job. `computePacketStats()` gives the exact frame count and fps.
- **Throwaway, per-clip.** The blob/decode pipeline is **session-only, never persisted**, scoped per clip — `ClipEditor` mounts with `key={clip.id}`, so switching clips unmounts the editor and `dispose()`s the pipeline. The new clip starts with no video until re-attached. Only the filename (`clip.source`) and `offset` persist, as alignment metadata — a re-attach of a different file warns.
- **Scoping is the recording's on-ramp, not a gate.** Attaching a recording drops into a transient scoping step: the scrub spans the **whole recording** with draggable in/out cut handles and a live span readout; "Lock in (normalize)" sets the length and offset and returns to the editor. Re-scope re-opens it. A clip with no recording never scopes.
- **Upload is independent of the ruler; marks are never rewritten.** A **fresh** attach (no offset yet) scopes the full recording (`scopeRecording`), ignoring whatever sequence the ruler holds, so a seeded sequence can't constrain the scope and the out-cut (`setScopeEnd`) carries no content floor. A **re-attach** of an already-scoped clip restores its saved window (`enterScope`), so a single Lock re-confirms the same scope. Lock-in always **keeps the entered dividers/hits**, only pulling any the span left off-ruler back inside — it never redistributes.
- **Playhead is the driver, additive to direct manipulation.** Clicking the ruler/scrub moves the playhead; `+ Hit` drops a hit there. Dragging hits/dividers still works and live-drives the video preview to that frame. Precise repositioning lives in the marks table — an editable frame field per row (no video needed) plus a snap-to-current-frame button when a recording is attached. The video only ever _reads_ frames and _captures_ the playhead into the existing `ClipEdit` set; it is never a second source of truth.
- **Stage lock freezes the skeleton.** Setting the dividers is the first step, so a per-clip `stagesLocked` flag (persisted) guards them once placed: `applyClipEdit` no-ops the structural edits (`addStage`/`removeStage`/`moveBoundary`/`moveRestStart`/`removeRestZone`) while locked, the ruler hides its X buttons and stops divider drags, and the marks-table boundary snap is hidden. Marks (hits, splits, cues, length) stay editable. The toggle is the lock glyph at the end of the ruler's instruction line.
- **Spacers carve out non-cataloged frames.** A mid-rotation jump/dodge eats frames that would otherwise inflate a neighbouring stage's measured `actionTime` (which is just section width). `+ Spacer` appends a placeholder `stageRef` (reserved `PLACEHOLDER_ID`, `hitCount: 0`) that reuses all the section/divider/lock machinery but owns no hits, takes no anim-split, is skipped in the clip name, and is invisible to the sidebar and export (its id isn't a catalog id). It renders as the rest-zone diagonal striping with a `spacer` label and the frame-count readout.
- **Layout.** Canvas full width (100%/50% toggle) on top, then two vertically-aligned tracks via the shared `TRACK_COLS` grid: stepper + scrub above, context buttons + ruler below, so the playhead lines up. Marks table beneath.
- **One coordinate seam: `FrameTrack`.** The ruler and the scrub are both a **frame track** — a 1-D `[lo, hi]` frame space laid over a DOM box — so the pixel↔frame mapping lives in exactly one place (`components/FrameTrack.tsx`), not re-derived per component. `FrameTrack` owns the `ref`, the `pct` (frame→%) and `frameAt` (pixel→frame, rounded + clamped) mapping, and the scrub gesture, exposing the mapping to descendants by context; the anticipated `× 60 / sourceFps` conversion would land in `frameAt` alone. Everything on a track is declared in **frame space**, never pixels: a `TrackMarker` is a point at a `frame` (draggable when given an `onDrag(frame)`, selectable-while-locked via `onSelect` without `onDrag`, so no lock flag leaks in) and a `TrackRegion` is an interval `[start, end]`. Boundaries, splits, hits, the rest-start divider, cut handles, and the playhead are all `TrackMarker`s; sections and the rest zone are `TrackRegion`s. The ruler/scrub become pure model→markup maps. (`TRACK_COLS` above is the unrelated CSS-grid sense of "track" — vertical alignment, not the frame axis.)

## Gotchas

- **Contiguity assumes tight execution.** `clipLength = Σ actionTimes` breaks if you dawdle between inputs; record clips at combo speed.
- **Marks are truth; timings are projections.** Never persist `actionTime`/`actionFrame` — always re-derive from absolute marks so an upstream refinement propagates. Variants store an ordinal target, not a frame, for the same reason.
- **Conflicts are a feature.** An over-determined inconsistency is a miscount signal, not an error to suppress.
- **One door for every clip mutation.** All edits flow through the closed `ClipEdit` set and the pure `applyClipEdit` reducer (in `types.ts`) — editors dispatch an edit and never reshape a `Clip` in place. That single door is where the structural invariants live: the boundary-count rule (`boundaries.length === max(0, stageRefs.length − 1)`). A structurally illegal edit (no room for a divider, a hit in the rest zone with no stage to own it) returns the clip unchanged rather than throwing, so callers may dispatch optimistically and check the returned clip. **Hit capacity is advisory, not enforced:** `addHit` places a hit past a stage's recorded `hitCount` and it surfaces as exceeding (`exceedingHitIds`, red in the ruler, table, and the `+ Hit` button's dot) rather than being blocked.
- **`variants` may be absent at runtime.** The optional field is dropped from enriched stages that author no variant; the export patch must `variants ??= {}` before writing.
- **The stage catalog must mirror the main app's visibility filter.** `stageGroups` drops hidden skills, hidden stages, and empty-named stages — the same predicate the main app's stage catalog (`focused-stage-catalog.ts`) applies. If the two drift, the frames tool and the real app disagree on which stages exist; keep them in lockstep. A previously-added stage that later becomes hidden stays in saved clips (no migration), so it can still show in the marks table while absent from the sidebar.

## Related

- [CHARACTERS.md](../../src/data/CHARACTERS.md) — the stage timing model these numbers feed (`actionTime`, `actionFrame`, variants).
- [enriched-model](../../docs/enriched-model.md) — why timing is a manual enrichment step over raw extraction.
- [ADR-0008](../../docs/adr/0008-stage-variants-as-actionframe-truncation.md) — the cancel/swap truncation contract the derived variants conform to.
- [ADR-0018](../../docs/adr/0018-swap-variant-as-trailing-window.md) — swap's trailing-window semantics and the `swapFrames` default.
