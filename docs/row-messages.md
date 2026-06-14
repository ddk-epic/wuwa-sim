# Row Messages

The single catalog that turns structured timeline findings into English. The engine and validator emit structured findings (no wording); `renderMessage` is the only place that renders them, so every message obeys one consistent style.

**Source files:** `src/lib/timeline/row-messages.ts`, `src/types/simulation-log.ts`, `src/lib/timeline/validate-timeline.ts`, `src/lib/timeline/log-diagnostics.ts`

## How it works

Two finding sources feed the catalog:

- **Diagnostic** — engine runtime findings. The action ran, but the sim observed something a real play could not do (impossible entry footing) or would not allow (casting below a resource cost). Carried on the `ActionEvent`.
- **ValidatorMessage** — structural findings about the authored plan (intro needs outro, missing prereq, unknown character, …).

Every rendered message attaches to a **specific timeline row** that already shows the offending skill, the character, and the resource pools. The wording exploits that context instead of repeating it.

## Wording rules

One template for all messages: an **impersonal declarative requirement statement** — state the rule or precondition that was violated. Readers know the domain, so the correct action is implied by the requirement.

- **State the requirement, not the fix.** "Intro Skill must immediately follow an Outro Skill" — never "Add an Outro…", never address the user as "you".
- **Omit anything the row already displays.** The character (CharCell) and the current resource value (energy/concerto cells) are visible on the row, so they never appear in the text. A diagnostic keeps only what the row does _not_ show — the required cost.
- **"Skill" is the user-facing noun**, used loosely; proper ability names (Intro Skill, Outro Skill, Liberation, Outro) stay capitalized. "Stage" and stage IDs are engine-facing and surface only where a raw ID is shown.
- **Sentence case, no trailing period, no em-dashes.** Use parallel construction for paired cases (e.g. the two footing cases share "… required before a … stage").

## Gotchas

- The `insufficientEnergy` / `insufficientConcerto` Diagnostic types still carry `actor` and the current resource value, but `renderMessage` reads only `cost`. The unused fields are intentional — other consumers may use them; the wording deliberately drops them because the row shows them.

## Related

- [engine-overview](engine-overview.md)
- [loadout](loadout.md)
