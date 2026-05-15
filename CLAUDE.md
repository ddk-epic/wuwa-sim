<docs>

# Project docs

`docs/index.md` — concept pages on the engine and codebase. Check it before answering engine questions or re-deriving how a subsystem works.

`docs/adr/` — architectural decisions, referenced by number (e.g. ADR-0007).

At end of turn, propose a docs update when the session produced (i) a new concept not yet covered, (ii) a correction to an existing page, or (iii) a non-obvious invariant or gotcha worth capturing.

Workflow: `docs/conventions.md`.

</docs>

<delegation-tools>

# Cheap-Worker Delegation Tools (Token Saving)

Three CLI tools delegate bulk I/O to a cheap worker model. Use them to save tokens.

## ask-deepseek — bulk reading

For reading files >400 lines, or when you'd otherwise read 3+ files:

```bash
.tools/ask-deepseek --paths <file1> <file2>... --question "<specific question>"
```

Returns a structured summary. Use that instead of reading files yourself.
Only read files directly when you need to make edits to specific lines.

## deepseek-write — boilerplate generation

For generating tests, config files, docstrings, or repetitive code patterns:

```bash
.tools/deepseek-write --spec "<what to write>" --context <existing-similar-file> --target <output-path>
```

Then review the output and edit only what needs fixing.

## extract-chat — chat transcript extraction

Extracts human-readable text from Claude Code JSONL transcripts:

```bash
.tools/extract-chat <session.jsonl> -o /tmp/chat.txt
```

## When NOT to delegate

- Tasks under ~2000 tokens of work (delegation overhead isn't worth it)
- Architectural decisions, debugging, safety-critical code
- Anything requiring careful reasoning
- When exact line numbers are needed for editing

</delegation-tools>
