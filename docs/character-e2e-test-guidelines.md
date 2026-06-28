# Character e2e Test Guidelines

How to write a character's end-to-end rotation test (`src/data/characters/<name>.test.ts`).
These tests drive the **full `runSimulation` pipeline** over a character's most-used
rotation and assert on the resulting Simulation Log. They complement — not replace —
the engine-level tests under `src/lib/engine/`.

## What an e2e rotation test is

One authored Timeline of the character's canonical rotation, run through
`runSimulation(entries, slots, loadouts, config)`, with assertions read off the
returned `SimulationLogEntry[]`. The chain under test is the real one: Timeline →
stage resolution → frame scheduling → Buff Engine → damage formula → log.

Prefer this over poking `BuffEngine` directly. The engine tests already cover
mechanics in isolation; the e2e test covers them **in rotation flow**, where
ordering, gating, and refresh interactions actually happen.

## e2e-log-first

- **Default:** assert a mechanic by observing it in the rotation log — a buff in a
  hit's `activeBuffs`, a stack count, a lifecycle `BuffEvent`.
- **Exception:** keep an isolated engine poke **only** for a branch or edge-case the
  canonical rotation doesn't reach (an alternate combo path, a zero/max-stack
  boundary, a sequence the run doesn't take). Label why it can't be covered e2e.

## Harness

- **Mock-free catalog.** Use the real `loadout/catalog` — `bootstrapSlot` only reads
  the character (`compileCharacter` is `WeakMap`-cached and pure; runtime buff state
  lives on `BuffInstance`s, never on the character or its `BuffDef`s), so the shared
  `ALL_CHARACTERS` instance is safe to reuse.
- **Real default template.** Build the loadout with `loadoutFromTemplate(char.template)`
  so damage and gear buffs reflect the default build, not an empty one.
- **Solo by default.** One character in slot 0, the rest `emptyLoadout()`. Swap
  timing (intro-on-swap-in, outro-during-channel, swap-back cost) is out of scope
  unless the test specifically targets it — Intro/Outro buffs still fire on
  `skillCast`, and the timeline validator only _warns_ on an "illegal" sequence, so
  the rotation still runs.

## The rotation

- One shared timeline of the most-used skill combination — the rotation a player
  actually runs, including the Forte branch that fires in practice (and not the one
  that doesn't).
- `TimelineEntry` carries no frame; the sim places frames. Author **order** only;
  `requiresPriorStage` gates resolve as waits.
- StageId format: `char.<char>.<skill-category>.<skillKey>.<stageKey>::<skill-type>`.

## Sequences

For an SSR the realistic default is **S0**, but the Resonance Chain buffs still need
coverage. Parametrize the _same_ timeline over `it.each([0, 6])`:

- **S0** — base-kit buffs; **negative-assert** the chain buffs are absent.
- **S6** — chain buffs in rotation flow. Because chain buffs are cumulative
  `requiresSequence` gates, S6 subsumes S1–S5; a buff with an upper `maxSequence`
  bound or one that only matters at an intermediate sequence is the isolated-poke
  exception.

### Same timeline vs. two timelines

Pick by whether the chain only _adds buffs_ or _changes the rotation_:

- **Same timeline (`it.each([0, 6])`)** — default. Every S6 stage is castable at S0;
  the chain only layers buffs. Negative-assert chain buffs at S0. Model: Encore.
- **Two timelines (`ROTATION_S0` / `ROTATION_S6`)** — when a `requiresSequence` stage
  is `invalid` below its gate (can't sit in an S0 line), or the meta rotation diverges
  (drops/adds stages). Cache each by key; assert across the two logs (S6-stage hit vs.
  its S0 counterpart isolates the delta). Models: Verina (S6 Forte sheds opener),
  Camellya (S6 Perennial extends the loop).

## What to assert

Buff application and lifecycle are the core.

**Resource gauges (energy/concerto/forte) are case-by-case.** By default, leave
gauge arithmetic to the engine resource tests and let correctness ride along through
the buffs — a team buff that only triggers off one Forte branch confirms that branch
fired. When the resource _is_ the mechanic under test (a gated consume, a
gauge-driven ability whose correctness is the point), assert it directly, preferring
the gated observable over the raw gauge where one exists (count the consume's heal
emits, don't read the gauge). Verina's Starflower consume is the canonical case: the
3rd mid-air on 2 banked Forte must whiff, observed as exactly 2 consume heal-emits.

For each buff the rotation triggers:

1. **Presence** — in `activeBuffs` on the hits where it applies; absent where it
   shouldn't.
2. **Magnitude** — the boost actually folds into a hit's `statsSnapshot`, not just
   that the buff is present. Presence proves it's attached; magnitude proves it
   _does_ something. Read the affected stat off the hit it should buff and check the
   value: as a **delta** against a baseline hit that lacks the buff (an earlier hit,
   the parent stage's own taps vs. its emitted hits, or the same hit across two
   sequences), or as an **absolute** when nothing else in the build feeds that stat.
   Derive baselines from the log; never hardcode the absolute. A stat is recorded in
   the snapshot regardless of the hit's skill type, so for a skill-type-keyed
   bonus/amp also assert it lands on a hit of the matching `skillType`.
3. **Stacks** — reaches its expected max.
4. **Duration sanity** — read applied/expired frames from the `BuffEvent` lifecycle
   entries and assert the observed lifespan ≈ `duration_seconds × 60` (60 fps) within
   a tolerance band. Derive frames from the log; never hardcode absolutes. For a
   refreshing buff this is measured from the last trigger, which validates refresh
   for free.

**Out of scope:** golden total-damage numbers, action-order assertions, frame-exact
timing (owned by the `simulation.timing.*` tests), and resource accrual that isn't
the mechanic under test (gauge arithmetic is owned by the engine resource tests).

## Gotchas

- **Mock-free is a whole-file property.** A module-level `vi.mock("…/loadout/catalog")`
  poisons `loadoutFromTemplate`/`runSimulation`, which need the real catalog — so an
  e2e file can't carry one. The real catalog is also safe for direct `BuffEngine`
  pokes (bootstrap only reads the character), so if a character needs both styles,
  drop the mock and keep one mock-free file rather than splitting it.
- **A `HitEvent` has no `stageId`.** Match a hit to its timeline entry by
  `sourceEntryId` (give entries readable ids and key off those). A buff-emitted hit
  (e.g. a Forte burst) is told apart from its parent stage's own taps by
  `sourceBuffId` — both share the same `sourceEntryId`.
- **A `nextOnField` amp needs a real recipient of the matching skill type.** The buff
  shows up in `activeBuffs` on _any_ of the swap-in partner's hits, and its
  `statsSnapshot` carries the keyed amp regardless — so presence alone doesn't prove
  it does its job. Author a partner hit whose `skillType` matches the amp's key and
  assert the value there. The partner must be a real catalog resonator (mock-free →
  no fabricated teammates); a clean one with an ungated Basic Attack Stage 1 works.
