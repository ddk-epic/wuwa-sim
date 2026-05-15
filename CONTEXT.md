# Wuwa Sim

A Wuthering Waves damage simulator. Users author a **Timeline** of skill activations on a team **Loadout**, and the simulator produces a **Simulation Log** of every action and resolved hit, with damage computed from a unified **Stat Table** mutated by the **Buff System**.

## Language

### Core simulation

**Timeline**:
The user-authored sequence of skill activations a team performs. Walked once by the simulator to produce the Simulation Log.
_Avoid_: Rotation, sequence (overloaded with Resonance Chain Sequence)

**Timeline Entry**:
One authored action in the Timeline — a skill cast by a specific character at a specific position. Always represents an on-field action.

**Simulation Log**:
The full ordered output of a simulation run — Action Events, Hit Events, and Buff Events interleaved by frame.

**Action Event**:
A log entry representing the start of a Timeline Entry's execution. No damage; carries cumulative resource state for display.

**Hit Event**:
A log entry representing a single damage instance. Carries the Stat Table snapshot used to compute its damage and the IDs of all buffs active at hit time.

**Stage**:
The named sub-phase of a skill that contains the actual Damage Entries (e.g. "Stage 1", "Stage 2", "Detonate"). One Timeline Entry resolves to exactly one Stage.

**Damage Entry**:
The pure-data description of a single hit within a Stage — its multiplier value, scaling stat, action frame offset, and resource-gain values.

**Stage Variant**:
An optional alternate execution of a Stage that ends the animation early. Authored per-stage as a `{ actionTime }` override under one of the closed Variant Kinds. The engine derives `effective = variant.actionTime + Reaction Delay` and uses that as both the action duration and the damage-filter cutoff: only Damage Entries with `actionFrame ≤ effective` resolve. Surviving Damage Entries are not scaled — energy, concerto, multiplier, toughness, and weakness pass through unchanged. Variants exist on a stage only when the character data declares them; they are not implicitly available.

**Variant Kind**:
The closed taxonomy of supported variants: `cancel` (animation cut after damage lands) and `instantCancel` (animation cut before damage lands; the cast still counts for cooldown, resource gates, and `skillCast` triggers). `swap` and `fastCancel` are reserved enum slots not yet implemented — `swap` requires the unimplemented Trailing Window because it does not truncate.

**Reaction Delay**:
A global player-level simulator setting (frames; default 9 at 60fps) that pads every variant's action time and extends the damage-filter cutoff by the same amount. Models human reaction time as real play frames, not dead padding — hits authored within the reaction window land. Stored in localStorage, not on the Loadout.

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
The flat typed struct of all damage-formula inputs for one character at one moment: ATK, ATK%, crit rate/dmg, element bonuses, skill-type bonuses, deepens, shreds. Base-value contributions (character intrinsics, weapon main/sub stats, echo main stats and substat rolls) are accumulated directly into a base table at sim start; permanent unconditional buffs are folded into that same base table; temporary and conditional buffs are layered on top per hit.

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
The extracted module that coordinates buff state for the simulator. State is split across collaborators it composes — **Instance Store** (active Buff Instances, base stats, target resolution, expiry), **Resource Ledger** (per-character Resource States), **On-Field Tracker** (current on-field character + swap inference), **EmitHit Dispatcher** (ICD bookkeeping for synthetic-hit emission), and **Stat Table Builder** (bootstrap base table + per-hit stat accumulation). The simulation loop calls the deep seams `resolveHit(actor, frame)` and `recordHit(hitLandedEvent)`; lower-level entry points (`onEvent`, `resolveStats`, `tickToFrame`) remain for tests. The engine owns no globals.

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
A hit produced by an off-field character in response to events on the on-field character's hits. Modeled as two buffs: a tag (presence buff on the enemy) plus a reaction (a `hitLanded`-triggered `emitHit` gated by the tag).

### WuWa game concepts (shared with all data files)

**Loadout**:
The five-slot team configuration: characters in slots, each with a Weapon, an Echo, and an Echo Set.

**Resonance Chain**:
A character's six progression nodes (S1–S6). The loadout's `sequence` field gates which nodes' Buff Defs are active.

**Forte Circuit**:
A character-specific resource and skill bound together. Filled by character-specific actions, consumed by activation. Modeled as the Forte resource plus character-authored buffs that produce/consume it.

**Concerto**:
The 0–100 swap-out resource. Hits add Concerto; reaching 100 enables Outro Skill.

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
- **"Amplify"** — an older WuWa term for **Deepen**. We use Deepen exclusively; do not introduce an `amplify` field.
- **"DMG Bonus"** — at compute time, element bonus and skill-type bonus share one additive bucket. Stored separately on the Stat Table for trigger/condition specificity, but summed into a single `(1 + Σ)` factor in the damage formula.

## Example dialogue

> **Dev:** "When Verina's outro fires, do we apply the next-intro buff to whoever's on-field at that moment, or to the next swap-in?"
> **Domain expert:** "The next swap-in. The Outro Skill triggers, but the buff sits in a pending state — its target is `nextOnField`, which only resolves when the next swapIn event fires. Then the Buff Instance materializes on whichever character swapped in."

> **Dev:** "If Jinhsi is off-field and her coordinated attack fires while Verina is on-field, whose Stat Table is used to compute the hit?"
> **Domain expert:** "Jinhsi's. She's the Acting Character of the Synthetic Hit. The on-field character is Verina, but the hit scales off Jinhsi's ATK and uses her element bonuses. Verina's outro buffs would only apply if they targeted Jinhsi specifically — e.g. as a `nextOnField` buff that resolved to Jinhsi at swap-in earlier."
