# Ubiquitous Language

## Characters

| Term            | Definition                                                                                                                                                   | Aliases to avoid    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| **Character**   | A playable unit with an element, weapon type, rarity, stats, and skills; called "Resonator" in-game but **Character** is the canonical term for this project | Resonator           |
| **Element**     | The damage attribute of a Character (Fusion, Glacio, Electro, Aero, Havoc, Spectro)                                                                          | Attribute, type     |
| **Weapon Type** | The category of weapon a Character can equip (Rectifier, Sword, Broadblade, Pistols, Gauntlets)                                                              | Class, weapon class |
| **Rarity**      | The quality tier of a Character or Weapon (SSR, SR)                                                                                                          | Grade, tier         |

## Skills

| Term                | Definition                                                                                                                                     | Aliases to avoid                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Skill**           | A single named ability belonging to a Character, identified by a Skill Type                                                                    | Ability, move                                             |
| **Skill Type**      | The category of a Skill (Normal Attack, Resonance Skill, Resonance Liberation, Forte Circuit, Intro Skill, Outro Skill, Tune Break)            | Skill category                                            |
| **Normal Attack**   | The Skill Type that groups all standard attack sub-types for a Character: Basic Attacks, Heavy Attacks, Mid-Air Attacks, and Dodge Counters    | Basic Attack (when used as a synonym for the whole group) |
| **Basic Attack**    | A combo attack Stage within the Normal Attack Skill                                                                                            | Ground attack                                             |
| **Heavy Attack**    | A charged, stamina-consuming attack Stage within the Normal Attack Skill                                                                       | Charged attack                                            |
| **Mid-Air Attack**  | An airborne, stamina-consuming attack Stage within the Normal Attack Skill                                                                     | Air attack, aerial attack                                 |
| **Dodge Counter**   | An attack Stage within the Normal Attack Skill triggered by dodging at the correct moment                                                      | Counter attack, parry attack                              |
| **Stage**           | A single named, selectable unit within a Skill that can be added to the Timeline, carrying its own damage values                               | Step, phase, hit                                          |
| **Damage Entry**    | A single line of damage data within a Stage, specifying type, scaling stat, and value                                                          | Hit, damage line                                          |
| **Attack Modifier** | A buff that targets a specific Normal Attack sub-type (e.g. Basic Attack DMG, Heavy Attack DMG) rather than the Normal Attack group as a whole | Damage bonus (when sub-type specific)                     |
| **Duration**        | The length of time (in seconds) a Skill's buff effect remains active; relevant only for Skills that apply buffs — not a timing concept         | Action time, animation lock                               |
| **Action Time**     | The number of frames (at 60 fps) a Stage occupies before the next Stage can be queued; defined per Stage, not per Skill                        | Animation lock, cast time, duration (when meaning timing) |
| **Hidden**          | A flag on a Skill that excludes it from the UI; the Skill still exists in the data but is never shown to the user                              | Blacklisted, disabled, invisible                          |

## Skill Metadata

| Term               | Definition                                                                                                                            | Aliases to avoid         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Raw Skill**      | A Skill exactly as it arrives from the external character API, before any maintainer overrides are applied                            | Source skill, API skill  |
| **Enriched Skill** | A Skill after the Skill Metadata merge; Stages gain Action Time (in frames) and the Hidden flag is available; Stamina Cost is removed | Merged skill             |
| **Skill Metadata** | A maintainer-authored map (keyed by Skill ID) of partial overrides that are merged on top of Raw Skills at application load           | Skill config, skill meta |
| **Maintainer**     | A developer who edits Skill Metadata to annotate or correct Skill data without modifying the generated character JSON files           | Admin, author            |
| **Character JSON** | A generated data file for a single Character, sourced from the external API; must not be hand-edited                                  | Character data, raw JSON |

## Simulation

| Term         | Definition                                                                                                                            | Aliases to avoid                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Timeline** | The ordered sequence of Stages the user has queued in the simulator table; the unit of work the tool currently models                 | Rotation (when meaning the same as Timeline) |
| **Rotation** | The looping sequence of Skills across all Characters in a full team cycle; a superset of the Timeline concept, currently out of scope | Timeline (when meaning the looping cycle)    |

## Equipment

| Term           | Definition                                                                      | Aliases to avoid |
| -------------- | ------------------------------------------------------------------------------- | ---------------- |
| **Weapon**     | An equippable item with a main stat, sub stat, and passive effect               | Gear             |
| **Echo**       | An equippable creature that provides an active skill and belongs to an Echo Set | Monster, entity  |
| **Echo Skill** | The active ability granted by an equipped Echo                                  | Echo ability     |
| **Echo Set**   | A named collection of Echoes that grants 2-piece and 5-piece set bonuses        | Set, echo group  |

## Team Building

| Term          | Definition                                                                                                                                     | Aliases to avoid                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Team**      | The group of up to 3 selected Characters                                                                                                       | Party, roster                                      |
| **Slot**      | A fixed position (1, 2, or 3) in the Team that holds one Character                                                                             | Position                                           |
| **Selection** | The act of toggling a Character into or out of a Slot; distinct from Focus                                                                     | Pick, choose                                       |
| **Focus**     | The state of a Character whose Skills are displayed in the sidebar; independent of Selection                                                   | Active, highlight, select (when meaning "inspect") |
| **Template**  | A curated default Loadout for a specific Character, specifying their signature Weapon, Echo, and Echo Set                                      | Preset, default build                              |
| **Loadout**   | The current Weapon, Echo, and Echo Set assigned to a Character in a Slot; initialized from the Template on Selection but independently mutable | Build, gear, equipment                             |

## Relationships

- A **Team** has exactly 3 **Slots**; each **Slot** holds at most one **Character**
- A **Slot** has exactly one **Loadout**; a **Loadout** is initialized from the Character's **Template** on **Selection**
- A **Character** has exactly one **Template** (if curated); a **Template** is not a **Loadout** — it is the source of truth for defaults, and never mutates at runtime
- A **Weapon** is compatible with a **Character** only if their **Weapon Type** matches
- An **Echo** belongs to exactly one **Echo Set**; selecting an Echo auto-selects its Echo Set, but the Echo Set may be overridden independently
- A **Normal Attack** Skill contains **Basic Attacks**, **Heavy Attacks**, **Mid-Air Attacks**, and **Dodge Counters** as Stages
- An **Attack Modifier** targets a specific Normal Attack sub-type, not the **Normal Attack** group as a whole
- A **Character** has one or more **Skills**; each **Skill** has zero or more **Stages**; each **Stage** has zero or more **Damage Entries**
- Every **Raw Skill** is merged with its **Skill Metadata** entry (if one exists) to produce an **Enriched Skill**; all downstream code operates on **Enriched Skills**
- **Duration** lives at the **Skill** level and describes how long a buff effect remains active; it is not an action-timing concept
- **Action Time** lives at the **Stage** level and is expressed in frames (60 fps); each Stage has its own independent Action Time
- A **Hidden** Skill is present in the data layer but absent from the sidebar UI
- A **Timeline** is composed of **Stages**; a **Rotation** is composed of **Timelines** across Characters and is not modelled by this tool

## Example dialogue

> **Dev:** "A weapon passive says '+15% Basic Attack DMG' — does that apply to the whole Normal Attack Skill?"
>
> **Domain expert:** "No. Normal Attack is the group. Basic Attack is a combo attack Stage within it. Heavy Attacks, Mid-Air Attacks, and Dodge Counters are separate sub-types. That modifier is a Basic Attack Attack Modifier — it does not touch the others."
>
> **Dev:** "The character API doesn't give us Action Time values per Stage. Can we add them without touching the Character JSON?"
>
> **Domain expert:** "Yes. Add an entry to the Skill Metadata keyed by Skill ID. At load time the Raw Skill is merged with that entry to produce the Enriched Skill. The Character JSON stays pristine and can be regenerated freely."
>
> **Dev:** "What unit is Action Time in?"
>
> **Domain expert:** "Frames — 60 per second. It lives on each Stage individually and represents how long that Stage occupies the action queue before the next can be added to the Timeline."
>
> **Dev:** "What about Duration — isn't that the same thing?"
>
> **Domain expert:** "No. Duration is how long a buff effect stays active on a Skill — it's relevant for buff skills only, not for timing. Action Time is the timing concept."
>
> **Dev:** "What if a Skill shouldn't appear in the UI at all?"
>
> **Domain expert:** "Set `hidden: true` in its Skill Metadata entry. The Enriched Skill stays in the data — it's just filtered out before it reaches the sidebar."

## Flagged ambiguities

None.
