# Footing transitions become an explicit `{ entry, exit, commit }` object, decoupling entry footing from exit footing

A footing transition is now authored as `{ entry: "ground" | "air" | "any"; exit: "ground" | "air"; commit: number }`. The three sustained values stay terse strings; only the transitions change shape:

```ts
type Footing =
  | "ground"
  | "air"
  | "either"
  | { entry: "ground" | "air" | "any"; exit: "ground" | "air"; commit: number }
```

`{ launch: N }` becomes `{ entry: "ground", exit: "air", commit: N }` and `{ land: N }` becomes `{ entry: "air", exit: "ground", commit: N }`. The new, previously-inexpressible case is `entry: "any"` — **no entry requirement** (castable from ground or air, no fall, no violation) paired with a definite `exit`. Camellya's `Fervor Efflorescent` Liberation (`{ entry: "any", exit: "ground", commit: 0 }`) and her `Ephemeral` / `Perennial` forte stages (`commit` = the last hit frame, the dunk's touchdown) are the motivating moves: cast freely from either footing, always grounding.

The three fields are orthogonal, matching three code paths that already existed: `entry` drives only the entry gates (`computeFall`, `footingDiagnostics`, both via `stageEntryFooting`); `exit` drives only the footing writes (`applyStageFooting` on-field, `buildFootingChanges`' carried commit off-field); `commit` is the shared point-of-no-return. `entry: "any"` maps to "no requirement" in `stageEntryFooting` — `undefined`, the same value `"either"` already produces — so both gates fall through to a no-op with no further change. Exit is never `"any"`: a transition always commits to a definite footing, and "preserve" is what the sustained `"either"` string means.

## Why the closed union no longer holds

ADR-0022 rejected "separate `startsIn` and `endsIn` fields" because "the cross-product is only four valid cells (gg, aa, ga, ag), and the two-field form invites nonsense combos at the type level that the closed union prevents by construction." That premise was load-bearing and is now false. The entry axis has a third value — `any` (no requirement) — which the closed `launch`/`land` union cannot express. Camellya's Liberation is the existence proof of a fifth cell (any→ground), so the union's "completeness" was an illusion that held only until a move needed a cell outside the 2×2 — the same way 0022's own implicit-footing predecessor collapsed "once the field had to scale to the full roster."

The change is also smaller than it looks because the engine has read entry and exit **separately** since 0022, through `stageEntryFooting` / `stageExitFooting`. The two axes were already independent internally; the closed union merely fused them at the type level. Per-entry footing tracking (0022) is what made the fused tag actively misfit: with footing computed independently on every timeline entry, the tag that welds the two axes is the thing fighting the engine. This ADR promotes the already-internal split into the type.

## Considered Options

- **Keep the closed `launch`/`land` union (status quo, ADR-0022).** Rejected: cannot express entry-`any`. The only paths that preserve it require per-move special-casing — making a whole skill category (Resonance Liberation) ignore entry footing the way Intro Skills do, which over-broadly suppresses real `footingViolation`s for ground-only ults and still fails to cover the two forte stages (not Liberations).
- **A new sustained string, e.g. `"landAny"` (Option A).** Enter on anything, exit ground, grounding at stage exit. Simplest type, zero migration, but **loses the commit frame** — it grounds at the stage's end rather than a mid-animation point-of-no-return, so a cancellable stage can't model "bailed the dunk before touchdown." Does not generalize: the mirror needs yet another string (`"launchAny"`).
- **An `entry?` field on the `{ land }` variant only (Option B).** `{ land: N, entry?: "any" }`. Keeps the commit frame with a tiny change, but the override key exists on one variant and not the other — an inconsistent authoring surface — and the mirror later means bolting the same field onto `{ launch }` too.
- **A single object with a `kind` discriminant.** `{ kind: "launch" | "land" | "landAny" | "launchAny"; commit }`. Consistent keys, keeps the commit frame, but the `kind` enum grows one entry per entry/exit combination — it flattens two orthogonal axes (entry, exit) into one enumerated cross-product, the less principled encoding of the same information.
- **Always-object form for sustained values too (`{ state: "ground" }`).** Rejected for the same reason 0022 rejected it: ceremony around what `"ground"` already says, noisier for every untagged stage with no behavioral gain. Sustained values carry no commit frame, so they stay strings.
- **Forbid degenerate `entry === exit` transitions at the type level.** Rejected. A guard that bans `{ entry: "ground", exit: "ground", … }` costs type gymnastics for a combo that is harmless (it writes back the footing it entered — a no-op flip). The expressiveness 0022's "nonsense combos" objection warned about is a cost we accept; the orthogonality the three fields buy is worth more than the few meaningless combinations they admit.

## Consequences

- **Supersedes only the `footing` type encoding of ADR-0022** — the closed `launch`/`land` union and the "separate entry/exit fields" rejection. The team/carried-footing model, the trailing-window commit stream, fall padding, and validity-as-runtime-Diagnostic all stand. ADR-0022 gains a one-line pointer to this ADR; its body is unchanged.
- `Footing` (`src/types/character.ts`) changes shape. Migration surface: four engine consumers that pattern-match `"launch" in` / `"land" in` (`stageEntryFooting` / `stageExitFooting` in `src/lib/stage.ts`, `footingDiagnostics`' `isLand` flag in `src/lib/simulation.ts`, `buildFootingChanges` in `src/lib/trailing-window.ts`, `applyStageFooting` in `src/lib/engine/footing.ts`), ~16 data sites across six character files plus `src/data/movement.ts` and one echo, and `src/data/CHARACTERS.md` authoring docs. The TypeScript checker enumerates the full list.
- `buildFootingChanges` becomes uniform: a transition emits a commit to `exit` at `stageStart + commit`, plus the existing window-end reset to `ground` only when `exit === "air"` (the launch case). The `entry` value is irrelevant to carried footing — only `exit` and `commit` matter — which is what makes the migration mechanical.
- **No wire-format break.** `footing` is not serialized into share codes or saved teams (`src/lib/import-export.ts` does not reference it), so this is a pure in-repo refactor.
- The mirror `{ entry: "any", exit: "air", commit: N }` (enter anything, launch to air) is expressible for free under this shape. No stage authors it today; it is deferred, not added speculatively.
- Other characters' Liberations remain untagged (grounded, soft fall when cast from air). Adopting `{ entry: "any", exit: "ground", … }` for them is a low-priority accuracy pass, not part of this change — most are cast from ground in practice.
