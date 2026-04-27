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
| **Normal Attack**   | The Skill Type that groups all standard attack sub-types for a Character: Basic Attacks, Heavy Attacks, and Mid-Air Attacks                    | Basic Attack (when used as a synonym for the whole group) |
| **Basic Attack**    | A sequential ground-combo attack Stage within the Normal Attack Skill                                                                          | Ground attack, combo attack                               |
| **Heavy Attack**    | A charged, stamina-consuming attack Stage within the Normal Attack Skill                                                                       | Charged attack                                            |
| **Mid-Air Attack**  | An airborne, stamina-consuming attack Stage within the Normal Attack Skill                                                                     | Air attack, aerial attack                                 |
| **Stage**           | A single named attack or phase within a Skill, carrying its own damage values                                                                  | Step, phase, hit                                          |
| **Damage Entry**    | A single line of damage data within a Stage, specifying type, scaling stat, and value                                                          | Hit, damage line                                          |
| **Attack Modifier** | A buff that targets a specific Normal Attack sub-type (e.g. Basic Attack DMG, Heavy Attack DMG) rather than the Normal Attack group as a whole | Damage bonus (when sub-type specific)                     |

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
- A **Normal Attack** Skill contains **Basic Attacks**, **Heavy Attacks**, and **Mid-Air Attacks** as Stages
- An **Attack Modifier** targets a specific Normal Attack sub-type, not the **Normal Attack** group as a whole
- A **Character** has one or more **Skills**; each **Skill** has zero or more **Stages**; each **Stage** has zero or more **Damage Entries**

## Example dialogue

> **Dev:** "A weapon passive says '+15% Basic Attack DMG' — does that apply to the whole Normal Attack Skill?"
>
> **Domain expert:** "No. Normal Attack is the group. Basic Attack is only the ground combo Stages. Heavy Attacks and Mid-Air Attacks are separate sub-types within the same Normal Attack Skill. That modifier is a Basic Attack Attack Modifier — it does not touch Heavy or Mid-Air."
>
> **Dev:** "So if I want to buff all Normal Attack Stages equally I'd need three separate Attack Modifiers?"
>
> **Domain expert:** "Or a modifier scoped to Normal Attack as a whole, if one exists. The distinction only matters when modifiers are sub-type specific."
>
> **Dev:** "Got it. Separately — if I click a Character who's already in the Team, does that Focus them?"
>
> **Domain expert:** "No, it deselects them — removes them from their Slot. Selection and Focus are separate. Clicking an unselected Character selects them and sets Focus. After that, clicking them again always deselects."

## Flagged ambiguities

None.
