---
name: comments
description: Audit comments and test titles in changed files and fix them to match the project's comment style.
---

# Comment cleanup pass

Go over every code file you just changed and fix its comments and `describe`/`it`
titles to match the rules below. Only touch comments and test titles, never
behavior. The rules don't apply Markdown (`docs/`, ADRs, `*.md`).

## Rules

Comments are **terse clauses of fact**. Match the file's existing comment
density; default to none. Comment only what code can't say: a non-obvious _why_,
an invariant, a gotcha, or why a magic value is what it is — compressed, no
framing.

Cut or compress every comment that matches an anti-pattern:

- **Prose framing.** "so it … ", "the X must be a real Y:", any
  sentence explaining yourself around the fact.
  - BAD: `// The retry limit is tied to the upstream timeout — only a slow response exercises it.`
  - GOOD: `// Retry limit only applies on upstream timeout.`
- **Restating code.** `/** User IDs */` over `const USER = {…}` → cut.
- **Narrating the next line.** `// loop over items`, `// set the flag` → cut.
- **Per-field doc blocks.** `/** Cache key — unique per request… */` on a field
  whose name already says it → bare field. At most one terse note for a real
  constraint ("1-based"), never repeated across sibling types.
- **Design / decision rationale.** "we chose X because Y", alternatives
  considered, decision history → belongs in ADRs/docs, not source. Cut.
- **ADR / issue / PR references** in comments OR `describe`/`it` titles —
  `(ADR-0036)`, `#356`, "see issue X". Inline the substance or drop it.

## Report

Provide a summary of what changed. Don't commit unless asked.
