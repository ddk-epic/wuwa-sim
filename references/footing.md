# Wuthering Waves — Footing Reference

In-game truth for how vertical position (grounded vs airborne) behaves. This is
the source of truth the simulator must emulate; the code conforms to this, not
the other way around.

See also: [trailing.md](./trailing.md) (Deployment State — On-field / In-trailing
/ In-reserve), which footing depends on.

---

# What Footing Is

**Footing** is a character's vertical position: `ground` or `air`. It is binary —
there is no in-between transitional state and no easing. Every character has its
own footing.

**Field footing** (a.k.a. team footing) is simply the footing of the character
currently **On-field**. It is what the game reads for the things that care about
vertical position: which stage you're allowed to do next, fall recovery, and any
buff conditioned on being airborne.

---

# Stages and Footing

A stage may declare its footing relationship:

- **Sustained** — the stage happens entirely on `ground` or entirely in `air`.
- **Transition** — the stage _changes_ footing partway through:
  - **launch**: `ground → air` (e.g. Jump, a character's launch move).
  - **land**: `air → ground`.

A stage with no footing declaration is **footing-transparent**: it neither
requires nor changes footing (Dodge is the canonical case — one button that
preserves whatever state you were in).

## The commit frame (point of no return)

A launch/land does not happen when you _press_ the button — it happens at a
specific **commit frame** inside the animation (the frame the body actually
leaves the ground for a launch). The commit frame is a **point of no return**:

- If you **swap-cancel before** the commit frame, the transition **never
  happens** — you were still grounded (or still airborne) when you left.
- If the commit frame is **reached**, the flip happens — **instantly**, a single-
  frame boolean flip of that character's footing.

---

# How Footing Moves Between Characters

Two independent things happen when a character X commits a launch/land. They are
facets of the same event but answer different questions:

## 1. What the _next, different_ character inherits

**A fresh swap-in inherits the field footing as of the instant of the swap.**

- If X is **still On-field** when its launch frame hits (it launched, _then_ you
  swapped), the field is already `air` at the hand-off, so the incoming character
  Y **arrives airborne**.
- If X **swapped out before** its launch frame (you swapped, _then_ X's launch
  fires in the background), the field was `ground` at the hand-off, so Y
  **arrives grounded**.

So the few frames of timing between "launch" and "swap" decide what Y inherits —
because Y inherits the field as it was the moment Y took it.

## 2. What X itself resumes on a swap-back

**The committing character carries its own evolved footing into its trailing
window.** X launched → X is airborne, and that air rides **on X**, regardless of
what the field does afterward. So:

- **Swap back to X within its trailing window** → X resumes `air` (the air combo
  continues), _even if_ the teammate who was on the field meanwhile grounded the
  field.
- When X's trailing window closes and X benches to **In-reserve**, X returns to
  `ground` — the **window-end reset**. A later re-entry from In-reserve is a fresh,
  grounded entry. (See [trailing.md](./trailing.md).)

These two facets only diverge once the swapped-in teammate starts changing the
field. Facet 1 is the field's state; facet 2 is X's personal bookkeeping. Both are
always in effect — a launch flips the field _and_ is carried on its owner.

**Land is symmetric.** A stage that lands X carries `ground` on X: after a teammate
goes airborne, a swap-back to X resumes X **grounded** (X landed), not airborne.

---

# Falling

In-game, an airborne character with no air action queued falls back to `ground`
under gravity — going airborne always costs an explicit launch/jump, but coming
back down is free.

The simulator has **no notion of "idle"**: a timeline is a back-to-back sequence
of stages, with no gap in which a character simply hangs and falls. So a fall is
never a standalone event — it is detected **only at a stage boundary**, by
comparing the character's current footing against the next stage's **entry
footing** (the footing it begins on):

| stage              | entry footing                              |
| ------------------ | ------------------------------------------ |
| sustained `ground` | ground                                     |
| sustained `air`    | air                                        |
| `{ launch }`       | **ground** — it launches _from_ the ground |
| `{ land }`         | **air** — it lands _from_ the air          |
| transparent        | inherits current (no requirement)          |

When a character takes the field **airborne** and the next stage's entry footing
is **ground**, the engine inserts **fall padding**: a startup delay of
`fallFrames` before the stage, modeling the time spent falling before the action
can begin.

Crucially this **includes a `{ launch }` stage entered from the air**: the
character first falls (`air → ground`), then the launch fires at its commit frame
(`ground → air`). The footing is evaluated _as the stage resolves_, by which point
the fall has grounded the character — so launching from the air is legal, it just
pays a fall first. Fall padding does **not** apply to a `{ land }` stage (entry is
air — landing is its own animation), a footing-transparent stage (it preserves the
airborne state), or an `air` stage (no mismatch).

Going airborne is never padded: nothing lifts you off the ground without an
explicit launch.

Note the contrast with benching: a character sent to **In-reserve** does **not**
fall at all — it despawns instantly (see [trailing.md](./trailing.md)). Fall
padding is an On-field, stage-boundary phenomenon only.

---

# Validity Rules (timeline authoring)

A stage's **entry footing** (the table under _Falling_) is checked against current
field footing. Only two outcomes are non-trivial:

| current  | stage entry is… | result                                                |
| -------- | --------------- | ----------------------------------------------------- |
| `air`    | `ground`        | **soft** — fall padding inserted, then the stage runs |
| `ground` | `air`           | **hard error** — nothing put you in the air           |

Spelled out across the stage kinds:

- `air → sustained ground` and **`air → { launch }`** — soft; pay a fall (for
  `{ launch }`, the fall lands you, then the launch re-launches you).
- `ground → sustained air` and `ground → { land }` — hard errors; you can't
  sustain air or land from it without a launch first.
- `ground → { launch }` and `air → { land }` — the valid footing changes
  themselves; no error, no fall.
- transparent stage — always valid, never falls.

The asymmetry is physical: gravity recovers you from the air for free (so any
ground-entry stage, including a launch, is reachable from the air via a fall), but
nothing lifts you off the ground without an explicit launch.
