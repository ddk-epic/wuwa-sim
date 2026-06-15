# `/dev/frames` — Frame Tool

A dev-only authoring aid for measuring stage timing (`actionTime`, per-hit
`actionFrame`) **empirically from recorded gameplay** — the numbers
`gen:character` can't know and that are otherwise hand-counted by eye. You define
**clips** (action strings of known length), mark stage boundaries and hits inside
them, and read off the derived timings to paste into the character file.

## Files

- `types.ts` — the `Clip` model and the single mutation door, `applyClipEdit`.
  Marks are stored as absolute clip-frames; stage membership and per-hit
  `actionFrame` are derived projections, never stored.
- `stages.ts` — flattens the bundled character registry into pickable `StageRef`s.
- `storage.ts` — localStorage persistence, keyed per character.
- `FramesPage.tsx` — the editor (ruler, marks table, stage overview).

## Full design

See [`docs/dev/frames.md`](../../../docs/dev/frames.md) for the model, the solver,
the confidence/cue taxonomy, and the gotchas. This README is just the doorway.
