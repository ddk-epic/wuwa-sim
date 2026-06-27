# Row Messages

The single catalog that turns structured timeline findings into English. The engine and validator emit structured findings (no wording); `renderMessage` is the only place that renders them, so every message obeys one consistent style.

**Source files:** `src/lib/timeline/row-messages.ts`, `src/types/simulation-log.ts`, `src/lib/timeline/validate-timeline.ts`, `src/lib/timeline/log-diagnostics.ts`, `src/lib/timeline/timeline-render-items.ts`

## How it works

Two finding sources feed the catalog:

- **Diagnostic** — engine runtime findings. The action ran, but the sim observed something a real play could not do (impossible entry footing) or would not allow (casting below a resource cost). Carried on the `ActionEvent`.
- **ValidatorMessage** — structural findings about the authored plan (intro needs outro, missing prereq, unknown character, …).

Both sources are **advisory** — neither blocks or reshapes anything. The sim runs the authored timeline as-is; `validateTimeline` feeds only the render boundary (`timeline-render-items.ts`), never the engine, so a row flagged invalid is still simulated and only styled red. A Diagnostic likewise lets the cast dispatch and its resource spend apply — `insufficientEnergy` zeroes energy, `insufficientOutroConcerto` drains concerto, `insufficientConcerto` (an availability gate) leaves the authored spend untouched, a footing violation runs the stage anyway. A cast failing a resource check is flagged, never blocked or reshaped: the spend still applies exactly as authored. Findings report what the rotation did wrong; they never silently correct it.

Two concerto diagnostics, distinct concerns:

- **`insufficientConcerto { actor, concerto, required }`** — the general availability gate. A Forte-replacement cast is only available at a required concerto level (Camellya's Ephemeral/Perennial require 100), declared by the stage's `requiresConcerto`. Below it, the gate fires but the cast resolves and its own concerto spend (subtract, floored at 0) applies as usual. Row text: "Requires {required} Concerto Energy".
- **`insufficientOutroConcerto { actor, concerto, cost }`** — Outro-specific, where concerto _is_ the cost. Below the cost the cast still drains concerto fully to 0. Row text: "Outro requires {cost} concerto".

**`skillOnCooldown { actor, remaining, severity: "invalid" }`** — a cast placed more than 1s (60 frames) before its skill is off cooldown. The sim does not pad it (a multi-second silent wait would distort the timeline); the cast fires at its authored start and the row turns red. Within 1s the cast is padded silently with no finding instead (Skill Cooldown). Row text: "Skill on cooldown for {remaining} more frames". The first runtime diagnostic to carry `severity: "invalid"`.

Every rendered message attaches to a **specific timeline row** that already shows the offending skill, the character, and the resource pools. The wording exploits that context instead of repeating it.

**Rendering happens at one boundary, not in the producers.** Both `validateTimeline` and `deriveRowDiagnostics` emit purely structured findings — no strings. `buildTimelineRenderItems` is the single place that calls `renderMessage`, turning validator findings and engine Diagnostics into the row's `errors`/`warnings` text through one path, splitting by **severity** (invalid → `errors`, warning → `warnings`). A Diagnostic's `severity` defaults to `"warning"`; the first runtime diagnostic to opt into `"invalid"` is `skillOnCooldown`. This keeps "how to word it" out of the validator and "what is wrong" out of the view: the view styles a row red from `invalidRowIds` membership **or** an invalid-severity runtime diagnostic, and renders whatever findings it is handed — it makes no domain judgment.

**Consequence-suppression is the validator's call, made before findings cross the boundary.** A row invalid only because an upstream prerequisite is broken stays in `invalidRowIds` (the cascade stays red), but the validator drops its message from `findings` so only the root row carries text. The `consequence` flag is internal to the validator's walk and never reaches the view — deciding which finding is independently worth reporting requires knowing the anchor→consequence causality, which is domain knowledge, not presentation.

## Wording rules

One template for all messages: an **impersonal declarative requirement statement** — state the rule or precondition that was violated. Readers know the domain, so the correct action is implied by the requirement.

- **State the requirement, not the fix.** "Intro Skill must immediately follow an Outro Skill" — never "Add an Outro…", never address the user as "you".
- **Omit anything the row already displays.** The character (CharCell) and the current resource value (energy/concerto cells) are visible on the row, so they never appear in the text. A diagnostic keeps only what the row does _not_ show — the required cost.
- **"Skill" is the user-facing noun**, used loosely; proper ability names (Intro Skill, Outro Skill, Liberation, Outro) stay capitalized. "Stage" and stage IDs are engine-facing and must never reach a rendered message (see the resolver seam below).
- **Sentence case, no trailing period, no em-dashes.** Use parallel construction for paired cases (e.g. the two footing cases share "… required before a … stage").

## The resolver seam

Stage-bearing validator findings (`missingChainPrereq`, `missingWindowedPrereq`, `stageNotFound`) carry **raw engine stage IDs** — the catalog does no name resolution itself. `renderMessage` takes a required `resolveStageName: (stageId) => string`; `buildTimelineRenderItems` builds it from `buildStageLabels(slots, loadouts)` (in `compile-character.ts`) at the render boundary, which maps every team-reachable character and echo stage ID to the same `stageLabel(skill.name, stage.newName)` the Timeline row shows. Messages quote the resolved label so the name stands out.

This is a hard seam: a raw stage ID must never reach a rendered message. A new stage-bearing finding must route every ID through the resolver. `stageNotFound` carries no ID into its text at all — the authored stage no longer resolves, so its slug is meaningless to a reader.

Engine Diagnostics never carry stage IDs, so the resolver is never consulted for them — `deriveRowDiagnostics` returns them structured and the render boundary renders both channels through the one `resolveStageName`. The `renderMessage` footing-case tests pass an identity resolver for the same reason.

## Gotchas

- The `insufficientEnergy` / `insufficientOutroConcerto` / `insufficientConcerto` Diagnostic types still carry `actor` and the current resource value, but `renderMessage` reads only the requirement (`cost`, or `required` for the availability gate). The unused fields are intentional — other consumers may use them; the wording deliberately drops them because the row shows them.

## Related

- [engine-overview](engine-overview.md)
- [loadout](loadout.md)
