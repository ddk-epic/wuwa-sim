# Wuthering Waves — Animation Cancellation Reference

In-game truth for how one action interrupts another's recovery. This is the
source of truth the simulator must emulate; the code conforms to this, not the
other way around.

See also: [footing.md](./footing.md) (swap-cancel and the launch/land commit
frame, a footing-specific cancel).

---

# What Cancelling Is

Every stage runs **startup → active (the hits) → recovery**. By default the next
action cannot begin until the current stage's recovery finishes. **Cancelling**
is a later action interrupting that recovery (sometimes the active frames too) to
start early, so the current action costs less time than its full animation.

For any ordered pair "A then B" two facts decide the timing:

- **Does B cancel A** — does B cut A's recovery short, or wait for it to finish?
- If B **waits**, B's first frame coincides with A's **true natural end**.

---

# Who Cancels What

By the action's `category`:

| Action (A)                                          | Does A cancel the action before it?                         | Can A's own recovery be cancelled by a follow-up?                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Basic / Heavy** (incl. forte-basic / forte-heavy) | **No** — never cancels; queues and runs its full animation  | **Yes** — a skill/liberation started during its recovery cuts it short                                                               |
| **Resonance Skill**                                 | **Yes** — activation interrupts the preceding action        | **Yes**                                                                                                                              |
| **Resonance Liberation**                            | **Yes** — head-cancels the preceding action                 | **No** — once cast it is **fully committed**; nothing cuts it short                                                                  |
| **Intro Skill**                                     | n/a — enters only on swap-in (no preceding on-field action) | **Varies** — some intros are tail-cancellable, some commit; per-character and unverified. Treat as committed unless known otherwise. |

Basics and heavies are the **patient** inputs: pressed during another action they
**queue** and fire only once that action's recovery has fully completed. Skills
and liberations are the **impatient** ones: their activation interrupts whatever
came before.

---

# The Wait Rule

A follow-up **B executes only after A fully finishes** — and so B's start marks
A's true natural end — exactly when **B does not cancel A**. That holds in two
cases:

- **B is patient** (a basic or heavy) — it never cancels, so it waits regardless
  of what A was; or
- **A is uncancellable** (a liberation, a committed intro) — nothing cuts A short,
  so even an impatient B waits.

The first case is why a **trailing basic reveals the full length of whatever
preceded it**: a basic can't cancel, so the queued swing begins precisely at the
prior action's recovery end. (The frame tool leans on this to measure action
lengths — see [dev/frames](../dev/frames/README.md).)

---

# Basic Chains Loop, They Don't Cancel

A basic combo (Stage 1 → Stage 2 → …) advances by re-pressing basic. The stages
are **sequential at full length** — each runs its whole animation before the next
appends; there is no cancel between basic stages. After the final stage, pressing
basic again **restarts the chain at Stage 1** (a loop, not a cancel).

---

# Natural Length vs Cancel Point

Two different numbers about one action:

- **Natural length** — the action's full startup-active-recovery span when nothing
  interrupts it. Observed by following A with a **patient** input (basic/heavy), or
  whenever A is uncancellable.
- **Cancel point** — the earliest frame a **cancelling** action (skill/liberation)
  can interrupt A. Observed by following A with such an action; always ≤ natural
  length.

A liberation may play a **clock-frozen cinematic** (its animation runs while the
engine clock does not advance) and is committed through it — both facts are
properties of the same "uncancellable" nature.
