# Wuwa Sim

A Wuthering Waves damage simulator. Users author a **Timeline** of skill activations on a team **Loadout**, and the simulator produces a **Simulation Log** of every action and resolved hit, with damage computed from a unified **Stat Table** mutated by the **Buff System**.

## Language

### Core simulation

**Timeline**:
The user-authored sequence of skill activations a team performs. Walked once by the simulator to produce the Simulation Log.
_Avoid_: Rotation, sequence (overloaded with Resonance Chain Sequence)

**Timeline Entry**:
One authored action in the Timeline — a skill cast by a specific character at a specific position. Always represents an on-field action.

**Timeline Node**:
The persisted unit of the Timeline. A discriminated union of `{kind: "entry", ...TimelineEntry}` and `{kind: "group", ...TimelineGroup}`. The simulator, `validateTimeline`, and `TimelineSummary` operate on the flattened entry list (`nodes.flatMap(n => n.kind === "group" ? n.entries : [n])`); group nodes never reach the engine.

**Timeline Group**:
A purely organizational, single-row-height labeled header that owns a contiguous run of Timeline Entries inline (`entries: TimelineEntry[]`). Has an open/locked lifecycle: at most one group is open at a time, the open group captures every new sidebar-added entry as a member, and locking seals the boundary against drag-in / drag-out while permitting internal reorder and per-entry deletion. Does not increment row numbers, does not affect the engine, does not affect validation. Empty groups are valid. Flat-only — groups cannot contain other groups. No character restriction — a group may mix entries from any characters. See ADR-0016.
_Avoid_: "Phase", "Section", "Block" (overloaded with other meanings in the codebase).

**Simulation Log**:
The full ordered output of a simulation run — Action Events, Hit Events, and Buff Events interleaved by frame.

**Action Event**:
A log entry representing the start of a Timeline Entry's execution. No damage; carries cumulative resource state for display.

**Hit Event**:
A log entry representing a single damage instance. Carries the Stat Table snapshot used to compute its damage and the IDs of all buffs active at hit time.

**Stage**:
The named sub-phase of a skill that contains the actual Damage Entries (e.g. "Stage 1", "Stage 2", "Detonate"). One Timeline Entry resolves to exactly one Stage.

**Footing**:
Team-level vertical-position state, one of `ground | air`. A Stage optionally declares `footing: "ground" | "air" | { launch: number } | { land: number }` — sustained values are terse strings; transitions carry the in-stage **commit frame** (the action-frame at which the vertical-position change actually occurs in the animation, e.g. the frame the body leaves the ground for `launch`). `{ launch }` requires entry `ground`, exits `air`; `{ land }` requires entry `air`, exits `ground`. Omission means the stage is footing-transparent: no validity check, no state change (Dodge is the canonical case; Jump is `{ launch: ... }`). The engine validates the next stage's required entry footing against current team footing: `current=ground` against a stage requiring `air` is a hard error ("launch/jump required"); `current=air` against a stage requiring `ground` is soft and triggers [[Fall Frames]] as a new [[Padding Delay]] component. The hard cases `air→launch` and `ground→land` also error. Validation is timeline-authoring-only; the engine trusts valid timelines. Different-footing variants of the same conceptual move are authored as **separate fundamental Stages**, not as a single polymorphic stage. The commit frame on `{ launch }` / `{ land }` is a point-of-no-return: a swap-cancel whose `actionTime` lands before the commit frame does **not** complete the transition (the launch never happens); the [[Trailing Window]] dispatches the commit later (or drops it under cancel-capable re-entry), so commits are honest deferred events, never eager. See ADR-0022 and its Launch/Land amendment.

**FootingTracker**:
Low-level state holder for Footing. Sibling to [[On-Field Tracker]] — same shape (mutation-versioned) but entirely orthogonal: swap inference and footing inference do not read each other. Carries two pieces of state: (1) **team footing** — the on-field character's current vertical state, and (2) a per-character **trailing-window footing snapshot** dict — populated when a launch/land commit fires while the owning character is _off-field_, cleared on re-entry or expiry. Private collaborator of `FootingModule`; not accessed directly from `simulation.ts`. See ADR-0022 and its Launch/Land amendment.

**FootingModule**:
Orchestrates all four Footing dispatch points in `simulation.ts`, owning `FootingTracker` as a private collaborator. Exposed on `BuffEngine` as `engine.footing`. Four named operations: `snapshotTrailing(characterId, exitFooting)` — records an off-field trailing commit; `promoteOnSwapIn(characterId): "ground" | "air"` — consumes any pending snapshot, promotes it to team footing, and returns the effective footing (the on-field invariant); `applyStageFooting(characterId, footing, stageDuration)` — commits a launch/land event if its frame falls within the stage duration and clears any pending snapshot; `clearTrailingSnapshot(characterId)` — discards a pending snapshot at end-of-timeline without applying it. The [[Trailing Window]] is unchanged — it still schedules and drops pending footing events; `FootingModule` only consumes what the window delivers.

**Damage Entry**:
The pure-data description of a single hit within a Stage — its multiplier value, scaling stat, action frame offset, and resource-gain values. Heal entries may carry an optional `flat` addend (integer, base-stat units); total heal = `flat + value × scalingStat(...)`. Damage entries omit `flat`. The API does not expose flat heal values as structured data — they are extracted from the human-readable value string (e.g. `"950+23.80%"`).

**Stage Variant**:
An optional alternate execution of a Stage. Authored per-stage as a `{ actionTime }` override under one of the closed Variant Kinds. Resolution returns two numbers — **`advance`** (frames the timeline cursor moves before the next entry) and the surviving Damage Entry list. For `cancel`/`instantCancel` the two collapse: `advance = max(variant.actionTime + Reaction Delay, Variant Floor)`, and only Damage Entries with `actionFrame ≤ advance` resolve — except entries flagged **Independent**, which always land (the truncation contract from ADR-0008 + its Variant Floor amendment). For `swap` they decouple — see Swap and Trailing Window. Surviving Damage Entries are never scaled — energy, concerto, multiplier, toughness, and weakness pass through unchanged. Variants exist on a stage only when the character data declares them; they are not implicitly available.

**Variant Kind**:
The closed taxonomy of supported variants: `cancel` (animation cut after damage lands), `instantCancel` (animation cut before damage lands; the cast still counts for cooldown, resource gates, and `skillCast` triggers), and `swap` (see below). `fastCancel` is a reserved enum slot not yet implemented.

**Independent (Damage Entry flag)**:
A Damage Entry flagged `independent: true` is exempt from the cancel/instantCancel truncation filter — it lands at its authored `actionFrame` regardless of where the cursor has advanced. Models hits the game spawns as separate entities once the stage commits (summons, delayed AoE drops); the canonical example is Encore's Frolicking Stage 4 summon, where the cancel-eligible point is the summon spawn and the summon's hit then resolves on its own schedule. Acting Character is the original caster; buff state is snapshotted live at fire frame; energy / concerto / `skillCast` / cooldown semantics are unchanged. Truly uncancelable — no drop on subsequent cancel-capable re-entry, no padding on non-cancel-capable re-entry. Outside `cancel`/`instantCancel` the flag is inert (every hit lands at its authored frame anyway).
_Avoid_: confusing with **Trailing Window**, which is stage-wide, tied to `swap`, and follows drop/padding rules on same-character re-entry. See ADR-0008.

**Swap (Variant Kind)**:
A Variant Kind whose `advance` is decoupled from the damage-filter cutoff: the cursor advances by a short number of frames while every authored Damage Entry of the stage still resolves at its original `actionFrame` offset (the Trailing Window). Models the player switching characters mid-stage — the swapped-out character's animation and hits continue in the background while the timeline proceeds under whoever swapped in. `advance` follows a default-fallback rule: if the stage authors `variants.swap = { actionTime: N }`, advance is `max(N + Reaction Delay, Variant Floor)`; otherwise advance is the global Swap Frames setting (Variant Floor does not apply to the fallback path). A swap-variant entry whose immediately following Timeline Entry has the same `characterId` raises a validation warning (swap exits the character from the field). See ADR-0018 and the ADR-0008 Variant Floor amendment.

**Swap Frames**:
A global player-level simulator setting (frames; default 6 at 60fps) used as the default `advance` for Swap variants on stages that do not author their own `variants.swap.actionTime`. Stored in `wuwa.settings` alongside Reaction Delay. Not a floor — when a swap variant is authored with a specific `actionTime`, that value (plus Reaction Delay) is used instead.

**Trailing Window**:
The interval during which a swap-variant stage continues to emit hits after the timeline cursor has moved past its `advance` frame. Trailing hits land at their authored `actionFrame` offset from the swap stage's start, possibly overlapping later Timeline Entries on the same or other characters. The hit's Acting Character remains the swapped-out character. There is no on-field / off-field distinction in buff snapshotting — trailing hits read whatever buff state is active at their fire frame. On same-character re-entry while trailing hits are pending, the engine branches on the re-entry's Skill Type:

- **Cancel-capable** (`Resonance Skill`, `Resonance Liberation`, `Intro Skill`, `Outro Skill`, `Echo Skill`): trailing hits with `hitFrame ≥ newEntry.startFrame` are silently **dropped** (the new stage's animation cancels the residual).
- **Non-cancel-capable** (`Basic Attack`, `Movement`): the **immediately preceding** entry's `advance` is extended just enough to push the re-entry past the last trailing hit (Padding Delay). All trailing hits land.

A trailing window also schedules the swap stage's [[Footing]] commit (if the stage declares `{ launch: number }` or `{ land: number }`) as a per-entry **pending footing event** alongside its trailing hits. The event shape lives on the trailing-window state as `TrailingEntry { hits, pendingFooting? }` — at most one per in-flight stage (one launch/land frame per stage by construction). When the event's `atFrame` is reached, the engine routes by on-field check: owner is on-field → `setTeam(exitFooting)` + clear that character's stale snapshot; owner is off-field → `snapshotFor(ownerId, exitFooting)` only. Cancel-capable drop semantics apply to the footing event identically to hits: if a same-character cancel-capable re-entry drops events past `newEntry.startFrame` and `pendingFooting.atFrame ≥ newEntry.startFrame`, the commit drops (no team flip, no snapshot — the launch never happened). The non-cancel-capable pad target frame is `max(lastHitFrame, pendingFooting?.atFrame ?? -∞)`. The snapshot, when created, is cleared on re-entry (via the on-field invariant promotion) or trailing-window expiry.

See ADR-0018.

**Reaction Delay**:
A global player-level simulator setting (frames; default 6 at 60fps) that pads every variant's `advance`. For `cancel`/`instantCancel` it extends the damage-filter cutoff by the same amount; for `swap` it stacks onto the stage's authored `variants.swap.actionTime` (and is not used at all when the stage falls back to Swap Frames). Models human reaction time as real play frames, not dead padding — hits authored within the reaction window land. Stored in localStorage, not on the Loadout. Does **not** apply to Movement Stages — their authored `actionTime` is raw. Subordinate to [[Variant Floor]] — when `actionTime + Reaction Delay < Variant Floor`, the floor wins and Reaction Delay does not appear in the tooltip split.

**Variant Floor**:
A global player-level simulator setting (frames; default 15 ≈ 0.25s at 60fps) that imposes a minimum `advance` on every authored Stage Variant: `advance = max(variant.actionTime + Reaction Delay, Variant Floor)`. Applies uniformly to `cancel`, `instantCancel`, and authored `swap`; does **not** apply to the unauthored-swap fallback path (which uses Swap Frames raw) and never applies to Liberation in practice because Liberation stages don't author variants. Models the physical minimum input duration a player can actually execute. Stored in `wuwa.settings` localStorage alongside Reaction Delay and Swap Frames. Setting it to 0 disables the floor. See the ADR-0008 amendment.

**Fall Frames**:
A global player-level simulator setting (frames; default 21 ≈ 0.35s at 60fps) that pads a stage whose required entry [[Footing]] is `ground` while current team footing is `air` — modeling gravity-driven fall recovery before the stage can begin. Stored in `wuwa.settings` localStorage alongside Reaction Delay, Swap Frames, and Variant Floor. Surfaces as the `fall` component of [[Padding Delay]] — additive (does not compete with the `react`/`floor` max), not subject to Variant Floor (input-duration minimum is orthogonal to gravity), and attaches to **the current entry's startup delay**, not the previous entry's advance (the entry whose stage triggered the mismatch is the one whose row shows the `fall` line — diverging from `pad`'s "extend previous" convention to keep cross-character attribution legible).

**Swap-back Cooldown**:
A hardcoded 60-frame (1s at 60fps) per-character cooldown on swap-in. After a character goes off-field, the engine records the moment in an off-field clock map (owned by [[On-Field Tracker]], keyed by `characterId`). If a subsequent Timeline Entry swaps that character back in before the clock has elapsed 60 frames, the engine pads the entry's startup by `max(0, 60 − elapsed)` — surfaced as the [[Padding Delay]] `swapBack` component, attributed to the **current** (incoming) entry's row (the entry whose character is being held up is the one that shows the pad). The clock starts at the off-field-exit frame (= the successor's swap-in frame, identical to when `swapOut` fires) and is cleared on re-entry. Trailing Window hits do **not** advance the clock — they're off-field by definition and run independently of swap input timing. Not a setting — the cooldown is an in-game mechanic the player cannot influence in real play, and surfacing it as a tweakable would misrepresent the simulator's model of reality (compare [[Reaction Delay]] / [[Variant Floor]], which model player-controllable values).
_Avoid_: confusing with the trailing-window `pad` component, which extends the **immediately preceding** entry's `advance` to push a non-cancel-capable same-character re-entry past pending trailing hits. The two pads attach to different entries and respond to different conditions.

**`animationFrames`**:
An optional `Stage.animationFrames: number` field declaring the wall-clock duration (in frames at 60fps) of a stage's cutscene animation. Distinct from `actionTime`: the cutscene contributes 0 to the engine clock (`actionTime: 0`, simulator cursor doesn't advance), but `animationFrames` worth of wall-clock pseudo-elapses for every off-field character — every entry in the [[On-Field Tracker]] off-field clock map advances by `animationFrames` when the stage is processed, including the caster's own residual cooldown if any. Since real Liberation animations are always ≥60 frames, an animation-flagged Liberation cast naturally clears every off-field character's [[Swap-back Cooldown]], including its own caster's (matching in-game behavior: pressing Liberation is accepted regardless of swap CD). Discriminator is presence/positivity of the field — absent means non-cutscene stage. Authored on cutscene-cast stages (Liberation openers like Encore's `Skill DMG`, Camellya's `Skill DMG`, Shorekeeper's `Skill DMG`; future intro skill animations). Forward-compatible with an incoming off-field-damage mechanic that will read this field to project off-field damage instances continuing in the background during the animation.
_Avoid_: inferring cutscene-ness from `Skill.type === "Resonance Liberation"` — Encore's mode-change Liberation puts Basic/Heavy/Skill attacks under the Liberation skill umbrella, and a future character will have a Liberation whose damage entries are `Resonance Skill`-typed. The explicit field is the only reliable discriminator.

**Padding Delay**:
Frames added to an entry's `advance` (or its startup) by the engine, on top of any variant-authored cost. Five sources today: (1) Reaction Delay (applied automatically to variant-tagged entries), (2) [[Variant Floor]] (raises `advance` to the floor when `actionTime + Reaction Delay` is below it), (3) Trailing Window collisions where a non-cancel-capable same-character re-entry forces the **immediately preceding** entry's `advance` to extend so the re-entry can fit, (4) [[Fall Frames]] when a stage's required entry footing is `ground` while current team footing is `air`, and (5) [[Swap-back Cooldown]] when a character is swapped back in before their 60-frame off-field clock elapses. Surfaced on the Timeline row and Simulation Log entry as a merged `+0.Xs` suffix in seconds; a tooltip splits the components for forensics. The `react` and `floor` components are **mutually exclusive** (only whichever wins the `max` is shown); `pad`, `fall`, and `swapBack` are additive on top. Attribution placement differs: `react`, `floor`, `fall`, and `swapBack` attach to the current entry; `pad` attaches to the immediately preceding entry.

**Movement Stage**:
A first-class Stage modeling a universal player movement action (`Dodge`, `Jump`) that exists on every character. Authored centrally in `src/data/movement.ts` and injected into every character's `skills` at enrichment time — never written in raw character JSON. Carries a hardcoded `actionTime` (Dodge 21 frames, Jump 18 frames at 60fps), empty `damage`, and `type: "Movement"`. Reaches the timeline as a normal Timeline Entry and emits an Action Event for log visibility, but **bypasses the Phase Pipeline** — no `skillCast` dispatch, no resource deltas, no cooldown roll, no `hitLanded` (no damage entries). The buff engine still `tickToFrame`s past the stage so duration-based expirations advance. Reaction Delay does not apply. [[Footing]] assignments: `Jump = { launch: <action-frame> }` (ground→air at the launch commit frame, hard error in `air`); `Dodge` omits `footing` (transparent — valid in both footings, preserves current). See ADR-0015.

**`comboAllows`**:
An optional field on a Stage that declares a `requiresStageId` gate, listing which Movement skill names (`"Dodge"`, `"Jump"`) may sit between the stage and its prerequisite without breaking the chain. Type-locked through a discriminated union so the field is only legal in the presence of `requiresStageId`. Default (omitted) is opaque — any Movement entry between the stage and its prerequisite invalidates the gate. `validate-timeline`'s previous-stage walk skips backwards past entries whose stage's `skill.name` is in the listed set before comparing Stage IDs. A non-Movement entry (e.g. Resonance Skill) between the two always resets the chain regardless of `comboAllows`.

### The buff system

**Buff Def**:
The pure-data template of a buff: its trigger, condition, target, effects, duration, and stacking policy. Authored once per character/weapon/echo/echo-set.

**Buff Instance**:
A live, active occurrence of a Buff Def in the engine. Carries `endTime`, current stack count, source character, resolved target, and any snapshotted values.

**Passive Buff**:
A view-layer term for the subset of Buffs folded directly into `baseStats` at bootstrap — `trigger: simStart` + `duration: permanent` + no condition. Loses Buff Instance identity post-fold; surfaced separately in the Simulation Log Hit Drawer because it does not appear in `activeBuffs(characterId)`. Sources include weapon passives, echo-set bonuses, character intrinsic unconditional permanents, and compiled skill-tree nodes.
_Avoid_: confusing with the `passive.*` segment in some buff IDs, which is a naming convention not a category — `char.encore.passive.angry-cosmos` is a conditional permanent Buff Instance, not a Passive Buff.

**Effect**:
What a Buff Instance _does_ while active. One of four kinds: `stat` (patches a Stat Table field), `emitHit` (injects a synthetic hit or heal — routes on inner `dmgType`), `coordHit` (same shape as `emitHit` but the emitted event bypasses the trigger matcher entirely and carries a `coord` display flag — see Coordinated Attack), or `resource` (produces or consumes Energy/Concerto/Forte/Resonance).

**Trigger**:
The structured predicate `{ event, ...filters }` that promotes a Buff Def into a Buff Instance. The event is from a small closed taxonomy (`skillCast`, `hitLanded`, `swapIn`, `swapOut`, `simStart`, `resourceCrossed`, etc.). Skill-based filters match on `skillCategory` — the player action — **never** on the damage-calc `SkillType`. Trigger type and damage type are independent axes (see [[Skill Category]] / [[Skill Type]]): a trigger asks "what did the player do?", not "what damage type did the hit deal?".

**Condition**:
A predicate continuously evaluated to determine whether an active Buff Instance contributes its effects right now. Distinct from Trigger — Trigger fires the buff once, Condition gates whether it currently applies.

**Value Expr**:
A pure-data expression for the magnitude of a `stat` Effect's modifier. Either `const`, `perStack`, or (later) `fromStat`. Recomputes every resolution by default; `snapshot: true` freezes at apply time.

**Stat Table**:
The flat typed struct of all damage-formula inputs for one character at one moment: ATK, ATK%, crit rate/dmg, element bonuses, skill-type bonuses, deepens, shreds. Base-value contributions (character intrinsics, weapon main/sub stats, echo main stats and substat rolls) are accumulated directly into a base table at sim start; permanent unconditional buffs are folded into that same base table; temporary and conditional buffs are layered on top per hit. Skill-type-keyed maps (`deepens`, `skillTypeBonus`, `shreds`) are keyed by **Skill Type**, not by UI category.

**Skill Grouping**:
The typed union for the UI skill-tree section a skill belongs to: `Normal Attack | Forte Circuit | Inherent Skill | Resonance Skill | Resonance Liberation | Intro Skill | Outro Skill | Tune Break | Echo Skill | Movement`. Used on `Skill.type` (populated from game API) and for sidebar filtering. Purely UI — has no engine presence (not in stageIds, not in events, not in triggers). `"Normal Attack"`, `"Forte Circuit"`, and `"Inherent Skill"` are display groupings that contain stages of varying `SkillCategory`/`SkillType`. The remaining groupings map 1:1 to `SkillCategory`. See ADR-0024.
_Avoid_: confusing with `SkillCategory` (the player action) or `SkillType` (the damage type). A skill's grouping describes where it sits in the skill tree sidebar; it does not reach the engine.

**Skill Category**:
The player input/action that triggered a stage: `Basic Attack | Heavy Attack | Resonance Skill | Resonance Liberation | Intro Skill | Outro Skill | Tune Break | Echo Skill | Movement`. A mandatory field on every stage in character data (the game API does not expose it — must be manually tagged). Encoded as the lineage segment of the stageId (the part before `::`). Carried as an explicit field on `EngineEvent`. The **sole** axis for trigger matching ("when casting Heavy Attack") — triggers filter on `skillCategory`, never on the damage `SkillType`. Same members as `SkillType` but a **fully independent** concept: category is the player action, type is the damage classification. The two axes are orthogonal — where they differ (e.g. Encore Cloudy Frenzy: category `"Heavy Attack"`, type `"Resonance Liberation"`) the divergence is **by design**, not an inconsistency to reconcile. Reference data: `references/characters/categories.md`. See ADR-0024.
_Avoid_: confusing with `SkillGrouping` (UI sidebar section) or `SkillType` (damage-calc type).

**Skill Type**:
The closed engine taxonomy for "what damage type does this hit deal": `Basic Attack | Heavy Attack | Resonance Skill | Resonance Liberation | Intro Skill | Outro Skill | Tune Break | Echo Skill | Movement`. Used as the type of `DamageEntry.type`, as keys on `skillTypeBonus` / `skillTypeDeepen` / `shreds` in the Stat Table, and encoded after `::` in the stageId. `"Forte Circuit"` is **not** a `SkillType` — it is a `SkillGrouping` only. A stage's effective Skill Type is derived from its `damage[0].type`, falling back to the 1:1 `SkillCategory` mapping for stages with no damage entries (e.g. Liberation openers, Movement Stages). `Movement` is its own coarse bucket — no roll-up to Basic/Heavy — and is the type that drives the Phase Pipeline bypass for Dodge and Jump (see ADR-0015). See ADR-0012, ADR-0024.

**Echo Stat Roll**:
A flat stat contribution from an equipped Echo — a main stat (one variable + one fixed per echo, scale by COST tier) or one of up to 5 substats. Modeled as a base-value contribution, not a Buff: accumulated directly into the base Stat Table at bootstrap. Values live in a single constants file. The user controls _which_ variable main each cost-4 and cost-3 echo rolls via per-cost-tier toggles; cost-1 variable mains are forced to the character's `primaryScalingStat` (no choice available in-game) and render as a display-only count badge. Substats default to a fixed 16-roll block (5× Crit Rate, 5× Crit DMG, 2× ATK%, 2× ER, 2× Skill DMG Bonus routed to the character's `recommendedSkillDmgPriority`).

**Primary Scaling Stat**:
The character-level field (`'atk' | 'hp' | 'def'`) declaring which stat the character's damage primarily scales off. Drives the "Scaling" option label on cost-4 / cost-3 main toggles (`ATK% | CR | CD` for ATK scalers; `HP% | CR | CD` for HP scalers) and the cost-1 forced default. Defaults to `'atk'` when omitted on Character data.
_Avoid_: "Echo buff" (reserved for `Echo.buffs` and `EchoSet.buffs`, which are pipeline citizens)

**Echo Build Preset**:
The fixed cost layout of a character's 5 equipped Echoes. Closed set of two: `4-3-3-1-1` (standard, cost 12) and `4-4-1-1-1` (competitive, cost 11). Selected per character on the Loadout; determines how many variable main toggles appear in each cost tier.

**Resource State**:
Per-character mutable counters owned by the engine, separate from the Stat Table: Energy, Concerto, Forte, Resonance. Have caps and consumption semantics that don't fit the Stat Table model.

**Buff Engine**:
The extracted module that coordinates buff state for the simulator. State is split across collaborators it composes — **Instance Store** (active Buff Instances, base stats, target resolution, expiry), **Resource Ledger** (per-character Resource States), **On-Field Tracker** (current on-field character + swap inference), **EmitHit Dispatcher** (ICD bookkeeping for synthetic-hit emission), and **Stat Table Builder** (bootstrap base table + per-hit stat accumulation). The engine itself owns the **outro pending queue** — Buff Defs with `target.kind: "nextOnField"` that wait for the next `swapIn` to materialize against the incoming character (see ADR-0013). The simulation loop calls the deep seams `resolveHit(actor, frame)` and `recordHit(hitLandedEvent)`; lower-level entry points (`onEvent`, `resolveStats`, `tickToFrame`) remain for tests. The engine owns no globals.

**Phase Pipeline**:
The ordered list of phases — `resource` → `stat` → `emitHit` → `consume` — that each triggering event runs through after candidate Buff Defs are matched. Ordering is data, not inline control flow: changing it means editing the phase list. Within a phase, candidates are processed in `buffDef.id` lex order.

**Acting Character**:
The character whose ability produced a given action or hit. For authored Timeline Entries this is the entry's `characterId`; for Synthetic Hits this is the buff owner.

**On-Field Character**:
The character currently positioned to receive on-field-only effects. Inferred implicitly from successive authored Timeline Entries — when `characterId` changes, the engine fires `swapOut` for the old and `swapIn` for the new.

**Synthetic Hit**:
A damage hit or heal sustain injected by an `emitHit` or `coordHit` Effect rather than authored in the Timeline. Carries `synthetic: true`. Routing branches on the inner `DamageEntry.dmgType`: `"Heal"` produces a SustainEvent via `computeHealing` and `resolveHealTargets`; otherwise a HitEvent via `computeDamage`. By default, `hitLanded` triggers ignore synthetic hits — buff authors must opt in via `source: "synthetic"` to chain off them. `healLanded` triggers match synthetic heals freely (no `source` gating — the chain-loop concern that motivates hitLanded's default-off doesn't apply to heals). `coordHit`-sourced synthetic events bypass the matcher entirely and never fire any trigger regardless of opt-ins.

**ICD** (internal cooldown):
The minimum frame interval between successive firings of an `emitHit` Effect from a single Buff Instance. Required field on every `emitHit`. Caps coordinated-attack frequency and prevents feedback loops.

**Coordinated Attack**:
A hit or heal produced by an off-field character in response to events on the on-field character's hits. Modeled as two buffs: a **presence flag** (self-applied on the coord-attack owner, marking that their reactive state is armed) plus a **reaction** (a `hitLanded`-triggered BuffDef with `actor: "any" + source: "self"` so teammate non-synthetic hits qualify, gated by `Condition.buffActive(..., on: "source")` against the presence flag, whose effects are `coordHit` rather than `emitHit`). `coordHit` carries two policies beyond the shared dispatch: emitted events bypass the matcher entirely (hardcoded non-chainable — no `source: "synthetic"` opt-in escapes it), and the output carries `coord: true` which the log renderer surfaces as a `"Coord"` skill label. A coord pair (damage + heal) is two sibling `coordHit` effects on the same reaction buff, differentiated by inner `dmgType`. Resource generation on coord events follows the inner `DamageEntry.energy` / `concerto` — coord-doesn't-gen-resources is a data convention (`energy: 0, concerto: 0`), not an engine rule. In a single-target sim the self-flag stands in for what would conceptually be a flag on the enemy — see ADR-0019 and ADR-0020.

### WuWa game concepts (shared with all data files)

**Loadout**:
The five-slot team configuration: characters in slots, each with a Weapon, an Echo, and an Echo Set.

**Resonance Chain**:
A character's six progression nodes (S1–S6). The loadout's `sequence` field gates which nodes' Buff Defs are active.

**Forte Circuit**:
A character-specific resource and skill bound together. Filled by character-specific actions, consumed by activation. Modeled as the Forte resource plus character-authored buffs that produce/consume it.

**Concerto**:
The 0–100 swap-out resource. Hits add Concerto; reaching 100 enables Outro Skill.

**Resonance Energy** (commonly "Energy"):
The per-character resource that gates **Resonance Liberation**. Two gain channels with different scaling:

- **Damage Entry `energy`** — per-hit generation read from each `DamageEntry.energy`. Any hit may grant energy (including Forte Circuit, Outro Skill, Echo Skill); data authors set `energy: 0` when the in-game source grants none. Scaled by the actor's `energyRechargePct`: `actorGain = entryEnergy × (1 + actorER)`.
- **Buff `resource` Effect on energy** — flat grants from echoes (e.g. Impermanence Heron), weapons, Resonance Chain nodes, outros. Not ER-scaled.
  Sim deliberately does not cap energy — overflow is a useful optimization signal indicating the user has spare ER they could redirect to other stats.
  _Avoid_: confusing with the **Resonance** resource, a separate per-character counter on `ResourceState`.

**Shared Energy**:
Each non-synthetic Damage Entry distributes 50% of the actor's **post-ER** gain to every teammate: `teammateGain = entryEnergy × 0.5 × (1 + actorER)`. The teammate's own ER does not apply to the shared portion. Synthetic hits do not share energy. Buff-driven (flat) energy grants do not share.

**Resonance Cost**:
`Stage.resonanceCost` — the energy a Resonance Liberation Stage requires (default 100; Encore is 125). On Liberation cast, the engine sets the actor's energy to 0 (not subtract — overflow above the cost is forfeited on cast); if pre-cast energy was below the cost, a warning is logged but the cast still proceeds and the Stage resolves normally.

**Intro Skill / Outro Skill**:
The skills that fire on swap-in / swap-out respectively. Outros consume Concerto; intros are free.

## External references

- [`damage-calculation.md`](./damage-calculation.md) — authoritative damage formula reference (mirrors the Wuthering Waves Wiki). Use this as the source of truth for the formula in `computeDamage`, including ATK scaling, MV, Deepen, Damage Bonus, Crit (`totalCritDamage` used directly — do **not** add 1), defense, and resist multipliers.

## Relationships

- A **Timeline Entry** resolves to one **Stage**, which contains zero or more **Damage Entries**
- Each **Damage Entry** produces one **Hit Event** in the **Simulation Log**
- The **Buff Engine** owns active **Buff Instances** and **Resource States**, and is queried per Hit for a **Stat Table**
- A **Buff Def** can come from a **Character**, **Weapon**, **Echo**, or **Echo Set**, gated by `requiresSequence` / `requiresPieces`
- A **Buff Instance** is identified by `(buffDef.id, target.characterId)` — re-application refreshes — unless `perSource: true`, then `(id, target, sourceCharacterId)`
- A **Synthetic Hit** carries an **Acting Character** that may differ from the **On-Field Character**

## Flagged ambiguities

- **"Sequence"** — used in WuWa community for both Resonance Chain count (S0–S6) and a generic ordering. We use **Resonance Chain Sequence** when count is meant; "sequence" alone refers to ordering.
- **"Active character"** — was used to mean both Acting Character and On-Field Character. Resolved: these are distinct. The buff engine tracks both independently.
- **"Buff" vs "modifier"** — every damage modifier with a trigger, condition, duration, or stack count is a Buff in this system, including permanent ones from weapon passives, skill-tree nodes, and echo skill/set bonuses. There is no separate "permanent modifier" concept for those; permanent is just `duration: { kind: "permanent" }`. The narrow exception is pure base-value contributions — character intrinsics, weapon main/sub stats, and **Echo Stat Rolls** — which accumulate directly into the base Stat Table at bootstrap rather than flowing through the buff pipeline (see ADR-0010).
- **"Normal Attack" vs Skill Type / Skill Category** — `"Normal Attack"` is a `SkillGrouping` only (UI sidebar section). It is **not** a `SkillCategory` or `SkillType`. It does not appear in stageIds, engine events, or triggers. `"Forte Circuit"` and `"Inherent Skill"` follow the same rule — they are groupings, not engine types. Stages under these groupings have their own `SkillCategory` (the player action, e.g. `"Basic Attack"` or `"Heavy Attack"`) tagged per stage. Authoring `Trigger.skillCategory: "Normal Attack"` is a TypeScript error; use `["Basic Attack", "Heavy Attack"]` if you want to match either. See ADR-0024.
- **"Amplify" / "Amplified"** — the in-game UI term for **Deepen**. Deepen is our canonical term; do not introduce an `amplify` field. When game text says a character's DMG is "Amplified by X%", that is a Deepen effect (`stat: "deepen"`), not a DMG Bonus. Example: Sanhua's Outro (Silversnow) says "Basic Attack DMG Amplified by 38%" — modeled as `deepen["Basic Attack"] = 0.38`.
- **"DMG Bonus"** — at compute time, element bonus and skill-type bonus share one additive bucket. Stored separately on the Stat Table for trigger/condition specificity, but summed into a single `(1 + Σ)` factor in the damage formula.

## Example dialogue

> **Dev:** "When Verina's outro fires, do we apply the next-intro buff to whoever's on-field at that moment, or to the next swap-in?"
> **Domain expert:** "The next swap-in. The Outro Skill triggers, but the buff sits in a pending state — its target is `nextOnField`, which only resolves when the next swapIn event fires. Then the Buff Instance materializes on whichever character swapped in."

> **Dev:** "If Jinhsi is off-field and her coordinated attack fires while Verina is on-field, whose Stat Table is used to compute the hit?"
> **Domain expert:** "Jinhsi's. She's the Acting Character of the Synthetic Hit. The on-field character is Verina, but the hit scales off Jinhsi's ATK and uses her element bonuses. Verina's outro buffs would only apply if they targeted Jinhsi specifically — e.g. as a `nextOnField` buff that resolved to Jinhsi at swap-in earlier."
