# UI preferences live in a store separate from simulation Settings

The auto-run toggle — and any future app/UI behaviour preference — lives in a new `useUiPreferences` store keyed on `wuwa.preferences`, not in the `Settings` object. `Settings` holds only values that feed `runSimulation` (the frame knobs plus `startWithFullEnergy`); the dividing line is _engine input vs. UI preference_, not _number vs. boolean_ (see ADR-0040, which later moved `Settings` onto the team and added the boolean).

`Settings` is, deliberately, a bag of _simulation parameters_: every field is a frame count, clamped 0–60, and passed straight into `runSimulation`. The store has a matching shape — numeric `mergeWithDefaults`, a `clamp()` patch path — that only makes sense for sim knobs. `autoRun` is a different kind of thing: it changes how the _app_ responds to edits and never reaches the engine. Folding it into `Settings` would put a boolean through number-shaped plumbing and erode the "Settings = sim parameters" boundary that lets a reader trust the type at a glance.

So preferences get their own home. The `SettingsModal` still renders the toggle — the modal is a UI surface, free to present both groups behind a separator — but the data and its hook stay separate. This is the same separation already drawn between `Settings`, the timeline store (`wuwa.timeline.entries`), and the log store (`wuwa.simulation-log`): one `useLocalStorage`-backed hook per concern.

## Considered Options

- **Add `autoRun: boolean` to `Settings` (rejected).** Cheapest in lines — reuse `useSettings`, the modal plumbing, the persisted key. But it mixes a UI preference into the sim-parameter object, makes the boolean an outlier in number-shaped merge/clamp code, and blurs a boundary the codebase otherwise keeps clean.
- **A dedicated `useUiPreferences` store (chosen).** Slightly more code now; keeps `Settings` honest and gives UI preferences a first-class place to grow.

## Consequences

- `Settings` stays pure: every field still feeds the engine, so the existing numeric merge/clamp logic needs no special-casing.
- One more hook and `localStorage` key (`wuwa.preferences`) to maintain; future UI prefs (theme, density, …) have an obvious home rather than accreting onto `Settings`.
- The `SettingsModal` now sources two prop groups (sim settings + preferences); a separator communicates that they are different kinds of setting.
- Reversible only with a small migration if we ever merge the keys, which is why this is recorded.
