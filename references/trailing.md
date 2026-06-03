# Wuthering Waves — Deployment State & Trailing Window Reference

In-game truth for what happens to a character after you swap away from it. This is
the source of truth the simulator must emulate.

See also: [footing.md](./footing.md), which depends on these states.

---

# The Three Deployment States

At any moment a character is in exactly one of:

- **On-field** — deployed and controlled. The character you're playing.
- **In-trailing** — swapped out, but its last stage's animation is **still
  playing**. The character keeps finishing that stage in the background.
- **In-reserve** — off the field and inert. No animation, no presence.

---

# Swapping Out: In-trailing vs. straight to In-reserve

What happens when you swap away from a character depends on whether it has an
animation still running:

- **Swap out mid-stage** (you swap-cancel while a stage is still animating): the
  character goes **In-trailing** and **keeps performing that stage until its
  animation finishes**. The window during which it is In-trailing lasts exactly
  the **length of that stage's animation**. When the animation completes, the
  character transitions to **In-reserve**.

- **Swap out with no active animation** (the stage already finished): the
  character goes **straight to In-reserve**. There is no trailing window.

**Going In-reserve is instant.** The character **despawns / vanishes** — there is
**no fall animation**, no wind-down. Whatever it was doing simply stops being on
the field.

---

# What Happens During the Trailing Window

While a character is In-trailing, its stage is genuinely still resolving:

- **Trailing hits** — damage entries of that stage whose frames land after the
  swap still connect, attributed to the trailing character.
- **Footing commits** — if the stage's launch/land commit frame falls inside the
  window, the flip fires on the **trailing character** (its own footing evolves
  off-field; see [footing.md](./footing.md)). The field is unaffected — a
  different character is On-field now.
- **Window close** — when the animation finishes, the character **benches to
  In-reserve**: it leaves play instantly (see above). Nothing grounds it at this
  moment — an off-field character's footing is never read, so whatever footing it
  had evolved simply stops mattering. Grounding is not done _here_; it is just the
  **default a character takes when it next enters the field** (below).

---

# Entering the Field

A character takes the field by **using a stage** — an action on the timeline.
There are two ways in, and they differ in footing:

- **Swap-back within the trailing window** — the character is still In-trailing,
  so it **resumes its own evolved state**: if it had gone airborne, it re-enters
  airborne (and pays fall if its next stage is grounded); its still-pending trailing hits and
  footing events are reconciled against the re-entry.
- **Re-entry from In-reserve** — the window has passed (or there never was one).
  Entering the field from reserve **defaults to `ground`** — a benched character
  always comes in grounded, regardless of whatever footing it had before benching.

This is why a quick swap-back after a launch keeps you airborne, but coming back to
the same character several seconds later puts you on the ground: in the first case
you caught it In-trailing, in the second it had already benched to In-reserve.
