# The simulator is the sole editor of a Saved Team; the Library create modal is a launchpad and saves are update-or-create keyed on a live `originId`

A [[Saved Team]]'s composition is edited **only in the simulator**. The Library's "New team" opens the [[Team Builder]] over an in-memory draft whose single commit is **"Move to sim"** (`writeLive(draft)` with `originId = null`, then navigate to `/sim`) — it never writes to `wuwa.library`. A team enters the Library only via a simulator **Save**, which is **update-or-create**: it updates the entry named by the Active Team's `originId` when that entry still exists, and otherwise creates a fresh one and re-stamps `originId`.

The forcing constraint is that a Saved Team is not just a composition — it carries a [[Team Stats]] snapshot (`dmgByChar`, `typeMix`, ending concerto/energy) that only `runSimulation` can produce. An editor that changed characters or loadouts _without_ re-running would leave stats and timeline stale against the new composition — a silently incoherent entry. `runSimulation` lives in the simulator, so that is where composition editing has to happen. The Library is left as a shelf: browse, preview (`DetailPane`, richer than the modal — it has the stat charts), launch, and start-new.

That also explains why the create modal cannot save directly to the Library: a team built in the modal has no stats yet, so a direct save would mint an empty stub. Routing every new team _through_ the sim guarantees a Library entry is only ever born from a run. To make the round-trip work, the Active Team gains two pieces of identity it lacked — a `name` (so a build keeps its label across the route hop and into Save) and `originId` (so Save knows whether it is editing an existing shelf slot or creating one). Both ride the existing localStorage bus: the live `wuwa.team.*` keys are consolidated into one `wuwa.team` object carrying `{ name, slots, loadouts, focusedId, originId }`, and `originId` is dropped when building the portable `ImportExportPayload` because it names a Library slot, not a property of the composition.

## Considered Options

- **Let the Library modal edit Saved Teams in place (rejected).** Symmetric and obvious — open a team, change it, save. But the modal cannot refresh the stats it would invalidate, so it produces incoherent entries; and merely opening it would have to choose between clobbering the live Active Team or running on a draft anyway. The stats-coherence problem is intrinsic, not an implementation detail.
- **Keep "New team" as today's snapshot-the-live-team (rejected).** Preserves the current single save path, but conflates "author a new team" with "save what's live," and gives the create flow no place to set a name or pick a roster before committing.
- **`saveCurrent` always creates; no `originId` (rejected).** Upholds the old "no in-place update in v1" invariant with zero new state, but every open→edit→save spawns a duplicate, which makes the Library unusable as a stable shelf once you actually edit teams.
- **Simulator-as-sole-editor + create-launchpad + update-or-create (chosen).** More moving parts (`originId`, `useDraftTeam`, a sim-side Save, wire `VERSION 2` to carry the name), but it is the only option where the Library stays coherent, the create flow can name and seed a team, and the edit loop closes without duplicates.

## Consequences

- The live schema consolidates to a single `wuwa.team` object and gains `name` + `originId`; `wuwa.timeline.entries` and `wuwa.simulation-log` stay separate (different lifecycles). No migration — pre-production.
- A new `updateTeam(id, …)` joins `saveCurrent` in `useLibrary`; the "always creates / no in-place update in v1" comments on `SavedTeam` and `saveCurrent` are retired.
- The export bundle bumps to `VERSION 2` to carry `team.name`; `decode` stays back-compatible with v1 codes (name defaults to `""`), so existing export strings keep importing — and imported teams now restore their name instead of `"Imported team"`.
- `TeamModal` splits into a shared presentational body plus two thin wrappers; a `useDraftTeam`/`DraftTeamProvider` mirrors `useTeam`'s interface so `CharacterGrid`/`TeamPanel` are context-blind.
- "Save as new" is intentionally omitted; fork-after-edit is served by export-the-code, keeping the `Header` to a single Save. A dirty/unsaved indicator is deferred (needs a payload diff).
- A Save against a deleted origin falls back to create rather than no-op'ing, so a stale `originId` can never silently swallow work.
