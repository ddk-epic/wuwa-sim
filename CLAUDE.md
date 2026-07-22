<preferences>

# Personal preferences

## Code style

- Always strive for clean, simple solutions.
- When suggesting solutions or implementations, always include an option that disregards blast radius (the "right" design). Don't default to the minimal-diff solution.
- Function and variable names must be plain and functional: say what the thing does or holds, so the function is self-explanatory without comments. No abstract jargon, no clever or shape-borrowed names.

## General Preferences

- After finding a solution after asked to look into a problem, stop and summarize clearly what the changes are about to be made first.

</preferences>

<docs>

# Project docs

`docs/index.md` — concept pages on the engine and codebase. Check it before answering engine questions or re-deriving how a subsystem works.

`docs/adr/` — architectural decisions, referenced by number (e.g. ADR-0007).

`references/` — canonical in-game source material.

At end of turn, propose a docs update when the session produced (i) a new concept not yet covered, (ii) a correction to an existing page, or (iii) a non-obvious invariant or gotcha worth capturing.

Workflow: `docs/conventions.md`.

</docs>

<code-comments>

# Code comments — STRICT, NON-NEGOTIABLE

Apply to every edit, in source AND test files.

- **Never use em-dashes.** Not in comments, not in test titles. Rewrite with a
  comma, colon, or separate clause.
- **Never reference issues, PRs, or ADRs in code** — no `#356`, no `ADR-0039`,
  no "see issue X" — not in comments, not in `describe(...)` / `it(...)` test
  titles. They belong only in Markdown docs (`docs/`, ADRs) and commit messages;
  code must read as if the issue tracker does not exist.
- **Make code self-explanatory; don't comment it.** Clear names over comments.
  Comment only what code can't say: a non-obvious _why_, invariant, gotcha, or
  magic value — never the _what_.
- **Terse, not prose.** A comment is a clause of fact, not a sentence explaining
  yourself. Cut "so it … ", "the X must be a real Y:", and any framing around the
  fact. If it reads like a sentence you'd say aloud, compress it.

  ```
  BAD:  // We cache this for 5 minutes because the upstream API is slow and we don't want to hammer it on every request.
  GOOD: // Cache 5 min: upstream API is rate-limited.
  ```

After finishing an edit, re-read every comment and test title you added and
delete or compress each one that breaks the above.

</code-comments>

<shell>

# Shell — prefer Bash, not PowerShell

Use the Bash tool for shell commands by default. Reach for PowerShell only when
a task genuinely requires a Windows-specific cmdlet that has no POSIX equivalent.

</shell>

<delegation-tools>

# Cheap-Worker Delegation Tools (Token Saving)

CLI tools to delegate bulk I/O to a cheap worker model. Use them to save tokens.

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

## When NOT to delegate

- Tasks under ~2000 tokens of work (delegation overhead isn't worth it)
- Architectural decisions, debugging, safety-critical code
- Anything requiring careful reasoning
- When exact line numbers are needed for editing

</delegation-tools>
