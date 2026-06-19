# Language

## Characters

| Term            | Definition                                                                                                                                                   | Aliases to avoid    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| **Character**   | A playable unit with an element, weapon type, rarity, stats, and skills; called "Resonator" in-game but **Character** is the canonical term for this project | Resonator           |
| **Element**     | The damage attribute of a Character (Fusion, Glacio, Electro, Aero, Havoc, Spectro)                                                                          | Attribute, type     |
| **Weapon Type** | The category of weapon a Character can equip (Rectifier, Sword, Broadblade, Pistols, Gauntlets)                                                              | Class, weapon class |
| **Rarity**      | The quality tier of a Character or Weapon (SSR, SR)                                                                                                          | Grade, tier         |

## Skills & Stages

| Term               | Definition                                                                                                                                                                                                                                   | Aliases to avoid                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Skill**          | A single named ability belonging to a Character                                                                                                                                                                                              | Ability, move                                 |
| **Skill Grouping** | The UI skill-tree section a Skill belongs to (Normal Attack, Forte Circuit, Inherent Skill, Resonance Skill, Resonance Liberation, Intro/Outro Skill, Tune Break, Echo Skill, Movement); used only for sidebar filtering, no engine presence | Skill Type (when meaning the sidebar section) |
| **Skill Category** | The player-input axis that produced a Stage (Basic Attack, Heavy Attack, Resonance Skill/Liberation, Intro/Outro, Tune Break, Echo Skill, Movement); a per-Stage tag used for buff trigger matching                                          | Skill Type (when meaning the trigger axis)    |
| **Skill Type**     | The damage-calculation axis derived from a Stage's first Damage Entry; drives `skillTypeBonus`, `skillTypeAmp`, and shred lookups; orthogonal to Skill Category                                                                              | DMG type, damage type                         |
| **Normal Attack**  | The Skill Grouping for standard attacks: Basic Attacks, Heavy Attacks, Mid-Air Attacks, and Dodge Counters                                                                                                                                   | Basic Attack (for the whole group)            |
| **Basic Attack**   | A combo attack Stage within the Normal Attack grouping                                                                                                                                                                                       | Ground attack                                 |
| **Heavy Attack**   | A charged, stamina-consuming attack Stage within the Normal Attack grouping                                                                                                                                                                  | Charged attack                                |
| **Mid-Air Attack** | An airborne, stamina-consuming attack Stage within the Normal Attack grouping                                                                                                                                                                | Air attack, aerial attack                     |
| **Dodge Counter**  | An attack Stage triggered by dodging at the correct moment                                                                                                                                                                                   | Counter attack, parry attack                  |
| **Movement**       | A Stage that advances the Timeline without dispatching a skill cast — no resource handling, no buff triggers, no cooldown roll                                                                                                               | Dash, walk                                    |
| **Stage**          | A single named, selectable unit within a Skill that can be added to the Timeline, carrying its own Damage Entries and timing                                                                                                                 | Step, phase, hit                              |
| **Variant**        | An alternate cut of a Stage (cancel, instant-cancel, swap) expressed by truncating its hits at an Action Frame; surviving hits keep their numbers                                                                                            | Version, mode                                 |
| **Damage Entry**   | A single line of damage data within a Stage: type, scaling stat, value, and optional resource grants                                                                                                                                         | Hit, damage line                              |
| **Action Time**    | The number of frames (at 60 fps) a Stage occupies before the next Stage can be queued; defined per Stage                                                                                                                                     | Animation lock, cast time                     |
| **Action Frame**   | The frame offset from the start of a Stage at which a Damage Entry's hit lands; defined per Damage Entry, always ≤ its Stage's Action Time                                                                                                   | Hit frame, impact frame                       |
| **Duration**       | The length of time (in seconds) a Skill's buff effect remains active; a buff concept, not a timing concept                                                                                                                                   | Action time, animation lock                   |
| **Hidden**         | A flag on a Skill that excludes it from the sidebar UI while keeping it in the data                                                                                                                                                          | Blacklisted, disabled, invisible              |

## Enriched Model

| Term                  | Definition                                                                                                                                        | Aliases to avoid         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Raw**               | Data as extracted from the external character API, before authoring                                                                               | Source, API data         |
| **Enriched**          | The engine-facing shape of a data object after manual authoring; the form all engine code operates on                                             | Merged, processed        |
| **EnrichedCharacter** | Engine-facing character data: per-Stage Action Time, Variants, Footing, stage identity and combo lineage, `buffs: BuffDef[]`, Forte Cap, Template | Character data           |
| **WeaponData**        | Engine-facing weapon data with hand-authored `WeaponBuffDef[]` indexed by rank                                                                    | Enriched weapon          |
| **EnrichedEcho**      | Engine-facing echo data with timed Stages in place of a raw hit array                                                                             | Echo data                |
| **Maintainer**        | A developer who hand-authors Enriched data (timing, buffs, overrides) without editing generated raw files                                         | Admin, author            |
| **Character JSON**    | A generated raw data file for one Character; must not be hand-edited                                                                              | Character data, raw JSON |

## Equipment & Loadout

| Term            | Definition                                                                                                                                                | Aliases to avoid                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Weapon**      | An equippable item with a main stat, sub stat, and a rank-indexed passive effect                                                                          | Gear                                 |
| **Weapon Rank** | The 1–5 refinement level of a Weapon that selects which rank-indexed passive values apply                                                                 | Refinement, dupe level               |
| **Echo**        | An equippable creature that provides an active Echo Skill and belongs to an Echo Set                                                                      | Monster, entity                      |
| **Echo Set**    | A named collection of Echoes granting set bonuses                                                                                                         | Set, echo group                      |
| **Sequence**    | A Character's resonance-chain level (0–6); higher levels unlock additional passive buffs                                                                  | Resonance chain, dupe, constellation |
| **Echo Build**  | A pattern of echo cost slots (e.g. 4-3-3-1-1) that, with the main-stat choices, expands into concrete main + substat rolls                                | Echo layout                          |
| **Main Stat**   | The headline stat of a Weapon or of a cost-4/cost-3 Echo slot, chosen by the user                                                                         | Primary stat                         |
| **Substat**     | A secondary rolled stat contributed by Echoes, expanded from the Echo Build                                                                               | Sub stat, roll                       |
| **Loadout**     | The full configuration assigned to one Slot: character id, weapon, echoes, echo set, Sequence, Echo Build, and main-stat choices; stores numeric IDs only | Build, gear, equipment               |
| **Template**    | A curated default Loadout shipped with a Character, naming a signature Weapon, Echo, and Echo Set; resolved into a Loadout on Selection                   | Preset, default build                |

## Team Building

| Term            | Definition                                                                                        | Aliases to avoid                                   |
| --------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Team**        | The group of up to 3 selected Characters                                                          | Party, roster                                      |
| **Active Team** | The single live working team: a name, three Slots, three Loadouts, plus Focus and origin pointers | Current team                                       |
| **Slot**        | A fixed position (1, 2, or 3) in the Team that holds one Character and its Loadout                | Position                                           |
| **Selection**   | The act of toggling a Character into or out of a Slot; distinct from Focus                        | Pick, choose                                       |
| **Focus**       | The state of a Character whose Skills are displayed in the sidebar; independent of Selection      | Active, highlight, select (when meaning "inspect") |

## Buffs

| Term                   | Definition                                                                                                                              | Aliases to avoid         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Buff**               | A modifier that alters stats, resources, or hit behavior; authored as a BuffDef, realized at runtime as a Buff Instance                 | Effect, modifier, status |
| **BuffDef**            | The authored definition of a Buff (Trigger, Condition, effects, stacking, duration) attached to a character, weapon, echo, or echo set  | Buff config              |
| **Buff Instance**      | An active occurrence of a BuffDef on a Character at runtime, carrying end time, stacks, and stacking policy                             | Active buff              |
| **Stat Effect**        | A BuffDef effect that writes a value into a Stat Table field, addressed by a Stat Path                                                  | Stat mod, stat buff      |
| **Value Expr**         | The expression a Stat Effect resolves to produce the number written into the Stat Table                                                 | Formula, value           |
| **Trigger**            | The event a BuffDef listens for (e.g. `skillCast`, `hitLanded`, `resourceCrossed`) to activate                                          | Event hook               |
| **Condition**          | A predicate over engine world state that gates whether a triggered BuffDef applies                                                      | Trigger (when gating)    |
| **Stacking Policy**    | How a re-applied BuffDef combines with its existing Instance: `ignore`, `refresh`, `addStack`, or `replace`                             | Stack mode               |
| **Permanent Instance** | A Buff injected at engine bootstrap (passive, weapon, echo-set bonus) with no apply/expire lifecycle; its Condition is evaluated lazily | Static buff, base buff   |
| **Attack Modifier**    | A Buff that targets a specific Skill Type bucket (e.g. Basic Attack DMG) rather than all damage                                         | Damage bonus             |

## Buff Engine & Pipeline

| Term                      | Definition                                                                                                                | Aliases to avoid      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Buff Engine**           | The coordinator that, per dispatched Event, updates resources, selects candidate Buffs, and runs the Phase Pipeline       | The engine, simulator |
| **Event**                 | The single input to the Buff Engine (e.g. `skillCast`, `hitLanded`, `swapIn`, `resourceCrossed`); the sole entry point    | Action, signal        |
| **Action Event**          | The engine-emitted record that a Stage executed and advanced the clock                                                    | Tick                  |
| **Phase Pipeline**        | The ordered six-phase processing of a dispatched Event; phase order is a data value, not control flow                     | Buff pipeline         |
| **Resource Phase**        | Phase 1: applies `resource`-kind effects and recursively fires `resourceCrossed` Events                                   | —                     |
| **Stat Phase**            | Phase 2: creates or refreshes Buff Instances (queues Pending-Next-On-Field, otherwise applies the Buff)                   | —                     |
| **Emit Phase**            | Phase 3: dispatches Synthetic Hits through ICD; deferred emits are scheduled, in-frame chain emits fire immediately       | emitHit               |
| **Coord Phase**           | Phase 4: like Emit, but the Coordinated Hit lands on the same frame and never chains                                      | coordHit              |
| **Consume Phase**         | Phase 5: decrements stacks on matching Instances; zero-stack Instances are removed                                        | —                     |
| **Remove Phase**          | Phase 6: removes Instances by buff id                                                                                     | removeBuffs           |
| **Synthetic Hit**         | A hit produced by the engine rather than authored in a Stage, flagged `synthetic`; excluded from triggers unless opted in | Emit, proc            |
| **Coordinated Hit**       | A Synthetic Hit that lands on the same frame as its source and never chains further emits                                 | Coord hit             |
| **ICD**                   | The internal cooldown capping how often Synthetic Hits of a given source may fire                                         | Internal cooldown     |
| **On-Field**              | The state of being the Character currently acting; swaps are inferred from the Timeline                                   | Active, fielded       |
| **Swap**                  | The transition of the On-Field role from one Character to another (`swapIn` / `swapOut` Events)                           | Switch, rotate        |
| **Pending-Next-On-Field** | A queue of Buff Instances destined for whichever Character swaps in next; drained on the next swap-in                     | Outro buff queue      |
| **Footing**               | Per-Character ground/air state carried across swaps                                                                       | Stance, grounding     |
| **Cooldown**              | The minimum interval between activations of a BuffDef, stamped only when it passes filtering into the pipeline            | CD                    |

## Resources

| Term         | Definition                                                                                                                                          | Aliases to avoid |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **Resource** | A per-Character counter with caps and consumption semantics, stored on the Buff Engine separately from the Stat Table                               | Gauge, meter     |
| **Energy**   | Short for **Resonance Energy** — the bar consumed to cast a Resonance Liberation; gains scaled by Energy Recharge, 50% shared to teammates          | Resonance        |
| **Concerto** | Short for **Concerto Energy** — the bar gating Outro casts; not recharge-scaled, not shared                                                         | —                |
| **Forte**    | Short for **Forte Energy** — a per-Character gauge gained scaled by Forte Recharge, capped per character, never shared, not surfaced in UI/substats | Forte gauge      |

## Stats & Damage

| Term                     | Definition                                                                                                                                  | Aliases to avoid         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Stat Table**           | The flattened, aggregated stat sheet for one Character at one moment; the single object Buffs write into and the damage formula reads       | Stat sheet, stats        |
| **Stat Path**            | The address a Stat Effect writes to — a scalar key, or a keyed map entry like `{ stat: "elementBonus", key: "Glacio" }`                     | Stat key, field          |
| **Scalar Stat Key**      | The set of non-map Stat Table fields (e.g. `atkPct`, `critRate`) a Stat Effect can target directly                                          | Scalar field             |
| **DMG Bonus**            | Additive damage-bonus contribution, summed at hit time across the per-element bucket, the per-Skill-Type bucket, and wildcard `allDmgBonus` | Damage bonus             |
| **Amplify**              | A multiplicative bonus bucket mirroring DMG Bonus (per-element, per-Skill-Type, and `allAmp`)                                               | Amp, amplification       |
| **Shred**                | A reduction of the target's resistance or defense (`defShred` scalar, plus per-Skill-Type `shreds`)                                         | Resistance shred, pen    |
| **Crit Rate / Crit DMG** | The probability and multiplier of a critical hit                                                                                            | Crit chance, crit damage |
| **Crit Floor**           | The intrinsic 5% Crit Rate / 150% Crit DMG every Character starts with, applied in the builder rather than stored on the Character          | Base crit                |
| **Bonus Multiplier**     | A catch-all multiplicative term in the damage formula                                                                                       | Final multiplier         |
| **Recharge**             | The Energy Recharge / Forte Recharge percentages that scale resource gains                                                                  | ER, regen                |
| **Hit Filter**           | A conjunction of axes (stage, source buff, Skill Type, Skill Category, element) scoping a Stat Buff to specific hits                        | Buff scope               |
| **Hit Context**          | The per-hit information passed when resolving hit-scoped Buffs                                                                              | Hit info                 |
| **Heal Target**          | The recipient scope of a heal effect: `self`, `team`, `currentOnField`, or `nextOnField` (defaults to `self`)                               | Heal recipient           |
| **Negative Status**      | A debuff held on the Target rather than on a Character                                                                                      | Debuff, enemy status     |
| **Target**               | The single enemy stub holding Target parameters and Negative Statuses                                                                       | Enemy, monster           |

## Simulation

| Term               | Definition                                                                                                            | Aliases to avoid                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Timeline**       | The ordered sequence of Timeline Entries the user has queued in the simulator table; the unit of work the tool models | Rotation (when meaning the same)          |
| **Timeline Entry** | A single authored row in the Timeline, referencing a Stage by stage id plus per-row data                              | Row, line, action                         |
| **Timeline Group** | A purely visual grouping node over Timeline Entries; the engine never sees groups                                     | Section, folder                           |
| **Simulation Log** | The flat, ordered output the engine produces from a Timeline — one row per resolved action                            | Sim output, results                       |
| **Diagnostic**     | A validator message attached to a log row (e.g. `insufficientEnergy`), worded to omit anything the row already shows  | Warning, error message                    |
| **Rotation**       | The looping sequence of Skills across a full team cycle; a superset of the Timeline, currently out of scope           | Timeline (when meaning the looping cycle) |
| **Share Code**     | A Base91 string packing a Team plus Timeline using registry indices; versioned with backward-compatible appends       | Export code, build code                   |

## Relationships

- An **Active Team** has exactly 3 **Slots**; each **Slot** holds one **Character** and one **Loadout**
- A **Loadout** stores numeric IDs only and is initialized from the Character's **Template** on **Selection**, then mutated independently
- A **Weapon** is compatible with a **Character** only if their **Weapon Type** matches
- An **Echo** belongs to exactly one **Echo Set**; an **Echo Build** pattern plus main-stat choices expands into **Main Stat** + **Substat** rolls
- A **Character** has one or more **Skills**; each **Skill** has zero or more **Stages**; each **Stage** has zero or more **Damage Entries**
- A **Stage** carries one **Skill Category** (trigger axis) and one **Skill Grouping** (UI axis); its **Skill Type** (damage axis) is derived from its first **Damage Entry**
- **Action Time** lives on the **Stage**; **Action Frame** lives on the **Damage Entry** and is always ≤ its Stage's Action Time
- **Raw** data is hand-authored into **Enriched** data; all engine code operates on Enriched shapes (**EnrichedCharacter**, **WeaponData**, **EnrichedEcho**)
- A **BuffDef** is authored on a Character/Weapon/Echo/Echo Set; at runtime it becomes one or more **Buff Instances** governed by a **Stacking Policy**
- A **Buff Instance** is created in the **Stat Phase**, may be decremented in the **Consume Phase**, and removed on expiry, swap-out, consume, or the **Remove Phase**
- The **Buff Engine** processes one **Event** at a time through the six-phase **Phase Pipeline**; phase order is data, not control flow
- **Resources** (Energy, Concerto, Forte) live on the **Buff Engine**, not in the **Stat Table**, but are queried through the same authoring vocabulary as stats; the Resonance Liberation cost is paid from **Energy**
- **Energy** gains are scaled by **Energy Recharge** and split 50% to teammates; **Forte** gains are scaled by **Forte Recharge**, capped by `forteCap`, and never shared
- A **Stat Effect** writes into a **Stat Table** field via a **Stat Path**; **DMG Bonus** and **Amplify** each sum a per-element bucket, a per-Skill-Type bucket, and a wildcard
- A **Synthetic Hit** is engine-produced and excluded from triggers unless opted in; a **Coordinated Hit** is a Synthetic Hit that lands same-frame and never chains
- A **Timeline** is composed of **Timeline Entries** (optionally grouped by visual-only **Timeline Groups**); the engine consumes the flat sequence and emits a **Simulation Log**

## Example dialogue

> **Dev:** "A weapon passive says '+15% Basic Attack DMG' — which axis does that key off, Skill Category or Skill Type?"
>
> **Domain expert:** "Skill Type — the damage-calc axis. The buff writes into `skillTypeBonus['Basic Attack']`, and at hit time the DMG Bonus is the element bucket plus the Skill-Type bucket plus `allDmgBonus`. Skill Category is the trigger axis; Skill Grouping is just the sidebar section."
>
> **Dev:** "An outro buff should land on whoever swaps in next. How does that flow through the engine?"
>
> **Domain expert:** "On the swap-out Event the BuffDef's Condition is gated at trigger time; if it passes, the Stat Phase queues a Buff Instance into Pending-Next-On-Field instead of applying it. The queue drains on the next swapIn Event, so the incoming Character gets the Instance."
>
> **Dev:** "Where does a hit's energy go — into the Stat Table?"
>
> **Domain expert:** "No. Energy, Concerto, and Forte are Resources on the Buff Engine, separate from the Stat Table — each the short form of Resonance/Concerto/Forte Energy. A Damage Entry's `energy` is read as a `resource`-kind effect on hitLanded, scaled by Energy Recharge, then 50% is shared to teammates. Concerto isn't scaled or shared; Forte is scaled by Forte Recharge, capped per character, and never shared."
>
> **Dev:** "If a buff procs an extra hit, why doesn't that re-trigger every other buff forever?"
>
> **Domain expert:** "Because that's a Synthetic Hit. `matchesTrigger` excludes synthetic hits unless a buff opts in with `source: 'synthetic'` or `'any'`, and the Emit Phase runs each emit through ICD with a chain-depth cap. A Coordinated Hit is the same idea but lands on the source frame and never chains."

## Flagged ambiguities

- **"Skill Type" is overloaded.** Three distinct axes exist: **Skill Grouping** (`SkillGrouping`) is the sidebar section; **Skill Category** (`SkillCategory`) is the trigger axis; **Skill Type** (`SkillType`) is the damage-calc axis. Never use bare "Skill Type" for the grouping or the trigger axis.
- **"Resonance" is only a prefix — never a standalone term.** It qualifies other terms (**Resonance Energy**, **Resonance Skill**, **Resonance Liberation**) and underlies "Resonator" (the **Character**) and "resonance chain" (the **Sequence**); on its own it names nothing. Shorten **Resonance Energy** to **Energy**, use **Sequence** for the upgrade level, **Character** for the unit. The Resonance Liberation cost is paid from **Energy** — there is no separate Resonance resource.
- **"Buff" spans definition and instance.** A **BuffDef** is the authored definition; a **Buff Instance** is its runtime occurrence. Reserve bare "Buff" for the general concept.
- **"Duration" vs "Action Time".** **Duration** is how long a buff effect stays active (seconds); **Action Time** is how long a Stage occupies the action queue (frames). Not interchangeable.
