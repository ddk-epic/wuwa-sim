# Simulation Settings belong to the team, not to a global tier

The four frame-delay knobs (`reactionDelay`, `swapFrames`, `variantFloor`, `fallFrames`) plus `startWithFullEnergy` live on the `ActiveTeam` (`wuwa.team.settings`) and travel with it through Save/Load. There is no `wuwa.settings` localStorage tier and no user-editable global default — "default" is the built-in `DEFAULT_SETTINGS` constant, which a new or blank team starts from.

A team's simulated numbers must be a property of the team, not of whoever happens to be viewing it. Under the old global tier, two users with different delay knobs got different DPS for the "same" shared build, with nothing on screen explaining the divergence. Folding the knobs into the team closes that gap: the inputs that produced a result are now part of the thing being shared, which is also what lets the share code reproduce them (the encoding itself is a later slice).

`startWithFullEnergy` joins the same bag. It already feeds `runSimulation`; keeping it as an ad-hoc `useState` in `SimulatorPage` while the other sim inputs became per-team would have left one engine input out of the team and out of staleness tracking. Now `computeSignature` sees it like any other setting, so toggling it marks the log stale and re-runs through the normal path — the dedicated effect it used to need is gone.

The `SettingsModal` edits the current team's settings and offers **Reset to defaults** (a patch with the full `DEFAULT_SETTINGS`). UI preferences (auto-run, default log) stay in their own `wuwa.preferences` store and remain global — that separation is unchanged.

## Considered Options

- **Keep a global `useSettings` tier (rejected).** Simplest diff, but it is the source of the reproducibility bug: results depend on the viewer, not the team, and a shared build can never carry its own inputs.
- **Per-team frame knobs, but leave `startWithFullEnergy` a session `useState` (rejected).** Splits the engine's inputs across two homes — most on the team, one transient — so staleness and Save/Load have to special-case the odd one out.
- **Settings on the team, `startWithFullEnergy` included (chosen).** One home for every input that reaches the engine; the team is the unit of reproducibility.

## Consequences

- `Settings` is no longer a pure bag of frame counts. It now carries one boolean, which relaxes the "every field is a 0–60 frame count" framing that motivated keeping `autoRun` out of it (ADR-0027). The frame knobs are still clamped; `startWithFullEnergy` is passed through. The ADR-0027 boundary that still holds is the one that matters: engine inputs vs. UI preferences — the boolean is an engine input, `autoRun` is not.
- Settings ride in the in-memory `ImportExportPayload.team` so Save/Load round-trips them. The field is optional there for now: the share-code **wire format** does not yet encode it, so a decoded payload leaves it undefined and consumers fall back to `DEFAULT_SETTINGS`. Encoding it (with a VERSION bump and back-compat for old codes) is a separate slice.
- One fewer localStorage key (`wuwa.settings` is gone) and one fewer bespoke effect in `SimulatorPage`.
- Loading a legacy Saved Team (saved before settings existed) revives to `DEFAULT_SETTINGS`.
