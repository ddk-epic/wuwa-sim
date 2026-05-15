# Docs Conventions

How `docs/` is maintained.

## Purpose

`docs/` holds concept pages that document `src/` — synthesis the existing `CONTEXT.md`, `UBIQUITOUS_LANGUAGE.md`, and ADRs don't already cover.

## What goes here vs elsewhere

- **`docs/`** — project knowledge useful to any contributor; verifiable against source
- **`CONTEXT.md`** — narrative and language for the project as a whole
- **`UBIQUITOUS_LANGUAGE.md`** — canonical definitions of domain terms
- **`docs/adr/`** — append-only records of architectural decisions

Boundary test: _"Useful to a contributor who isn't the user?"_ Yes → docs.

**Anti-rule:** don't duplicate prose from `CONTEXT.md` or `UBIQUITOUS_LANGUAGE.md`. Link to the canonical definition, then add the implementation layer (which files, how it composes, gotchas).

## Page granularity

One page per **concept**, not per file. A concept may span multiple files. Names mirror the source path when a concept maps cleanly to a folder or file (`data.md` for `src/data/`); otherwise pick a descriptive name (`damage-pipeline.md`). Flat at `docs/` root.

## Page template

```markdown
# {Concept}

One-paragraph summary.

**Source files:** `src/lib/foo.ts`, `src/lib/bar.ts`

## How it works

Narrative. Subsections as needed.

## Gotchas (optional)

- Non-obvious things that would surprise a reader.

## Related

- [other-concept](other-concept.md)
- [ADR-NNNN: title](adr/NNNN-...md)
```

`Source files` and `Related` sections are required. `Gotchas` is optional — omit entirely if there's nothing surprising.

## Update workflow

At the end of a session, propose a docs update when the session produced any of:

1. A new concept not yet covered by an existing page
2. A correction to existing page contents (the page is wrong or stale)
3. A non-obvious invariant or gotcha worth capturing

Routine code edits, bug fixes that don't change the model, and exploratory questions do **not** trigger a doc update. The trigger is _synthesis worth saving_, not _activity_.

The exchange: end the turn with one line — e.g. "Worth adding to `damage-pipeline.md`?" — and only edit after the user confirms.

## `log.md` format

Per-decision entries. Append at top, newest first.

```markdown
## YYYY-MM-DD — Title

1–3 lines on what was agreed and why.

Pages touched: foo.md, bar.md.
```

## Index maintenance

`index.md` is the TOC. Every page must have an entry with a one-line description. Group by area: _Engine_, _Game model_, _Data_, _Decisions_. When adding a page, add its index entry in the same edit.
