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

**Damage Entry**:
The pure-data description of a single hit within a Stage — its multiplier value, scaling stat, action frame offset, and resource-gain values. Heal entries may carry an optional `flat` addend (integer, base-stat units); total heal = `flat + value × scalingStat(...)`. Damage entries omit `flat`. The API does not expose flat heal values as structured data — they are extracted from the human-readable value string (e.g. `"950+23.80%"`).

**Stage Variant**:
An optional alternate execution of a Stage. Authored per-stage as a `{ actionTime }` override under one of the closed Variant Kinds. Resolution returns two numbers — **`advance`** (frames the timeline cursor moves before the next entry) and the surviving Damage Entry list. For `cancel`/`instantCancel` the two collapse: `advance = variant.actionTime + Reaction Delay`, and only Damage Entries with `actionFrame ≤ advance` resolve — except entries flagged **Independent**, which always land (the truncation contract from ADR-0008). For `swap` they decouple — see Swap and Trailing Window. Surviving Damage Entries are never scaled — energy, concerto, multiplier, toughness, and weakness pass through unchanged. Variants exist on a stage only when the character data declares them; they are not implicitly available.

**Variant Kind**:
The closed taxonomy of supported variants: `cancel` (animation cut after damage lands), `instantCancel` (animation cut before damage lands; the cast still counts for cooldown, resource gates, and `skillCast` triggers), and `swap` (see below). `fastCancel` is a reserved enum slot not yet implemented.

**Independent (Damage Entry flag)**:
A Damage Entry flagged `independent: true` is exempt from the cancel/instantCancel truncation filter — it lands at its authored `actionFrame` regardless of where the cursor has advanced. Models hits the game spawns as separate entities once the stage commits (summons, delayed AoE drops); the canonical example is Encore's Frolicking Stage 4 summon, where the cancel-eligible point is the summon spawn and the summon's hit then resolves on its own schedule. Acting Character is the original caster; buff state is snapshotted live at fire frame; energy / concerto / `skillCast` / cooldown semantics are unchanged. Truly uncancelable — no drop on subsequent cancel-capable re-entry, no padding on non-cancel-capable re-entry. Outside `cancel`/`instantCancel` the flag is inert (every hit lands at its authored frame anyway).
_Avoid_: confusing with **Trailing Window**, which is stage-wide, tied to `swap`, and follows drop/padding rules on same-character re-entry. See ADR-0008.

**Swap (Variant Kind)**:
A Variant Kind whose `advance` is decoupled from the damage-filter cutoff: the cursor advances by a short number of frames while every authored Damage Entry of the stage still resolves at its original `actionFrame` offset (the Trailing Window). Models the player switching characters mid-stage — the swapped-out character's animation and hits continue in the background while the timeline proceeds under whoever swapped in. `advance` follows a default-fallback rule: if the stage authors `variants.swap = { actionTime: N }`, advance is `N + Reaction Delay`; otherwise advance is the global Swap Frames setting. A swap-variant entry whose immediately following Timeline Entry has the same `characterId` raises a validation warning (swap exits the character from the field). See ADR-0018.

**Swap Frames**:
A global player-level simulator setting (frames; default 6 at 60fps) used as the default `advance` for Swap variants on stages that do not author their own `variants.swap.actionTime`. Stored in `wuwa.settings` alongside Reaction Delay. Not a floor — when a swap variant is authored with a specific `actionTime`, that value (plus Reaction Delay) is used instead.

**Trailing Window**:
The interval during which a swap-variant stage continues to emit hits after the timeline cursor has moved past its `advance` frame. Trailing hits land at their authored `actionFrame` offset from the swap stage's start, possibly overlapping later Timeline Entries on the same or other characters. The hit's Acting Character remains the swapped-out character. There is no on-field / off-field distinction in buff snapshotting — trailing hits read whatever buff state is active at their fire frame. On same-character re-entry while trailing hits are pending, the engine branches on the re-entry's Skill Type:

- **Cancel-capable** (`Resonance Skill`, `Resonance Liberation`, `Intro Skill`, `Outro Skill`, `Echo Skill`): trailing hits with `hitFrame ≥ newEntry.startFrame` are silently **dropped** (the new stage's animation cancels the residual).
- **Non-cancel-capable** (`Basic Attack`, `Movement`): the **immediately preceding** entry's `advance` is extended just enough to push the re-entry past the last trailing hit (Padding Delay). All trailing hits land.

See ADR-0018.

**Reaction Delay**:
A global player-level simulator setting (frames; default 6 at 60fps) that pads every variant's `advance`. For `cancel`/`instantCancel` it extends the damage-filter cutoff by the same amount; for `swap` it stacks onto the stage's authored `variants.swap.actionTime` (and is not used at all when the stage falls back to Swap Frames). Models human reaction time as real play frames, not dead padding — hits authored within the reaction window land. Stored in localStorage, not on the Loadout. Does **not** apply to Movement Stages — their authored `actionTime` is raw.

**Padding Delay**:
Frames added to an entry's `advance` by the engine, on top of any variant-authored cost. Two sources today: (1) Reaction Delay (applied automatically to variant-tagged entries), and (2) Trailing Window collisions where a non-cancel-capable same-character re-entry forces the **immediately preceding** entry's `advance` to extend so the re-entry can fit. Surfaced on the Timeline row and Simulation Log entry as a merged `+0.Xs` suffix in seconds; a tooltip splits the components (`react`, `pad`) for forensics.

**Movement Stage**:
A first-class Stage modeling a universal player movement action (`Dodge`, `Jump`) that exists on every character. Authored centrally in `src/data/movement.ts` and injected into every character's `skills` at enrichment time — never written in raw character JSON. Carries a hardcoded `actionTime` (Dodge 21 frames, Jump 18 frames at 60fps), empty `damage`, and `type: "Movement"`. Reaches the timeline as a normal Timeline Entry and emits an Action Event for log visibility, but **bypasses the Phase Pipeline** — no `skillCast` dispatch, no resource deltas, no cooldown roll, no `hitLanded` (no damage entries). The buff engine still `tickToFrame`s past the stage so duration-based expirations advance. Reaction Delay does not apply. See ADR-0015.

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
What a Buff Instance _does_ while active. One of three kinds: `stat` (patches a Stat Table field), `emitHit` (injects a synthetic hit), or `resource` (produces or consumes Energy/Concerto/Forte/Resonance).

**Trigger**:
The structured predicate `{ event, ...filters }` that promotes a Buff Def into a Buff Instance. The event is from a small closed taxonomy (`skillCast`, `hitLanded`, `swapIn`, `swapOut`, `simStart`, `resourceCrossed`, etc.).

**Condition**:
A predicate continuously evaluated to determine whether an active Buff Instance contributes its effects right now. Distinct from Trigger — Trigger fires the buff once, Condition gates whether it currently applies.

**Value Expr**:
A pure-data expression for the magnitude of a `stat` Effect's modifier. Either `const`, `perStack`, or (later) `fromStat`. Recomputes every resolution by default; `snapshot: true` freezes at apply time.

**Stat Table**:
The flat typed struct of all damage-formula inputs for one character at one moment: ATK, ATK%, crit rate/dmg, element bonuses, skill-type bonuses, deepens, shreds. Base-value contributions (character intrinsics, weapon main/sub stats, echo main stats and substat rolls) are accumulated directly into a base table at sim start; permanent unconditional buffs are folded into that same base table; temporary and conditional buffs are layered on top per hit. Skill-type-keyed maps (`deepens`, `skillTypeBonus`, `shreds`) are keyed by **Skill Type**, not by UI category.

**Skill Type**:
The closed engine taxonomy for "what kind of skill produced this": `Basic Attack | Heavy Attack | Resonance Skill | Resonance Liberation | Forte Circuit | Intro Skill | Outro Skill | Echo Skill | Movement`. Used as the type of `DamageEntry.type`, `Trigger.skillType` (both event branches), `EngineEvent.skillType` (both branches), and as keys on the Stat Table maps above. `Movement` is its own coarse bucket — no roll-up to Basic/Heavy — and is the type that drives the Phase Pipeline bypass for Dodge and Jump (see ADR-0015). See ADR-0012.
_Avoid_: confusing with `Skill.type`, which is a UI grouping label that includes the parent term `"Normal Attack"` and never reaches the engine. A stage's effective Skill Type is derived from its `damage[0].type`, falling back to `Skill.type` only for stages with no damage entries (e.g. Liberation openers, Movement Stages).

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
A hit injected by an `emitHit` Effect rather than authored in the Timeline. Carries `synthetic: true`. By default, `hitLanded` triggers ignore synthetic hits — buff authors must opt in to chain off them.

**ICD** (internal cooldown):
The minimum frame interval between successive firings of an `emitHit` Effect from a single Buff Instance. Required field on every `emitHit`. Caps coordinated-attack frequency and prevents feedback loops.

**Coordinated Attack**:
A hit produced by an off-field character in response to events on the on-field character's hits. Modeled as two buffs: a **presence flag** (self-applied on the coord-attack owner, marking that their reactive state is armed) plus a **reaction** (a `hitLanded`-triggered `emitHit` with `actor: "any" + source: "self"` so teammate non-synthetic hits qualify, gated by `Condition.buffActive(..., on: "source")` against the presence flag). In a single-target sim the self-flag stands in for what would conceptually be a flag on the enemy — see ADR-0019.

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
- **"Normal Attack" vs Skill Type** — `"Normal Attack"` is a UI grouping (parent of `"Basic Attack"` and `"Heavy Attack"`) and only appears as `Skill.type` for sidebar grouping. It is **not** a Skill Type and never appears on `EngineEvent.skillType` or in a Trigger filter. Authoring `Trigger.skillType: "Normal Attack"` is a TypeScript error (ADR-0012); use `["Basic Attack", "Heavy Attack"]` if you want to match either.
- **"Amplify" / "Amplified"** — the in-game UI term for **Deepen**. Deepen is our canonical term; do not introduce an `amplify` field. When game text says a character's DMG is "Amplified by X%", that is a Deepen effect (`stat: "deepen"`), not a DMG Bonus. Example: Sanhua's Outro (Silversnow) says "Basic Attack DMG Amplified by 38%" — modeled as `deepen["Basic Attack"] = 0.38`.
- **"DMG Bonus"** — at compute time, element bonus and skill-type bonus share one additive bucket. Stored separately on the Stat Table for trigger/condition specificity, but summed into a single `(1 + Σ)` factor in the damage formula.

## Example dialogue

> **Dev:** "When Verina's outro fires, do we apply the next-intro buff to whoever's on-field at that moment, or to the next swap-in?"
> **Domain expert:** "The next swap-in. The Outro Skill triggers, but the buff sits in a pending state — its target is `nextOnField`, which only resolves when the next swapIn event fires. Then the Buff Instance materializes on whichever character swapped in."

> **Dev:** "If Jinhsi is off-field and her coordinated attack fires while Verina is on-field, whose Stat Table is used to compute the hit?"
> **Domain expert:** "Jinhsi's. She's the Acting Character of the Synthetic Hit. The on-field character is Verina, but the hit scales off Jinhsi's ATK and uses her element bonuses. Verina's outro buffs would only apply if they targeted Jinhsi specifically — e.g. as a `nextOnField` buff that resolved to Jinhsi at swap-in earlier."
