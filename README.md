# wuwa-sim

A Wuthering Waves rotation planner and damage simulator.

### Timeline & Rotation Planner

Sequence character actions on a timeline to model a rotation's timing and damage. **Let users:**

- [x] build a rotation by placing character actions on a timeline and watch time and damage update live (#1–5)
- [x] clear the entire timeline (#7)
- [x] reorder timeline entries by drag-and-drop (#74, 145, 190–192)
- [x] group entries into units that behave like entries themselves (#137–145)
- [x] manually run the simulation / re-validate the rotation on demand (#78, 255)
- [x] auto-run the simulation as the rotation changes (#282–283)
- [x] see resource totals on the timeline (#235)
- [x] see total damage, DPS, and rotation time for the team (#35)
- [x] export or import a rotation via a compact share code (#246–247, 296)

### Team Builder & Loadout

Assemble a team and configure each slot's loadout before simulating. **Let users:**

- [x] assemble a team of characters from a picker (#3)
- [x] start each character from its recommended gear template (#38)
- [x] set each character's Resonance Chain sequence, S0–S6 (#71)
- [x] set each character's weapon rank, R1–R5 (#72)
- [x] equip an echo and echo sets to each character (#73, 131)

### Data Pipeline — Extraction & Generation

Turn raw wiki data extracts into character, weapon, and echo data files. **Let data authors:**

- [x] scaffold and generate a new character's data file from raw wiki page extracts (#12–21, 24)
- [x] generate weapon data files from raw wiki page extracts (#41–44)
- [x] generate human-readable reference from extracts (#132)

### Skill & Stage System

Model the timing and combo rules of real skills and stages so a rotation behaves like the game. **The simulator:**

- [x] supports stage variants (cancel, instant-cancel, swap) (#80–82, 176)
- [x] supports basic movement actions (#133–135)
- [x] accounts for footing changes (air and ground) (#232–245, 284)
- [x] enforces swap-back cooldown (#241)
- [x] cutscene animations bypass swap-back timing (#242)

### Echo System

Treat echoes as first-class gear and rotation actions. **Let users:**

- [x] place an echo's skills on the timeline as first-class entries, like character skills (#28–34)
- [x] equip one main echo per character (#73)
- [x] equip up to 2 echo sets per character (#131)
- [x] select each echo's main stat, with substats fixed to a default 16-roll spread (#107–110)

### Weapon System

Model weapons as gear that provides a rank-scaled passive. **The simulator:**

- [x] applies each weapon's passive buff, scaled by its rank R1–R5 (#92–93)

### Simulation Engine

A frame-accurate, per-hit damage-and-buff simulation. **The simulator:**

- [x] assembles each character's starting stats and buffs from every source (base stats, weapon, echo, echo sets, substats, skill-tree nodes, and resonance sequence) before the rotation runs (#46–48, 63, 104, 151)
- [x] resolves each action at frame-accurate cast and hit times, not just on cast (#45)
- [x] calculates damage independently for every individual hit of a skill (#45, 51)
- [x] snapshots the exact stats and active buffs at the moment of each hit (#54, 97)

### Buff System

Model character, weapon, and echo buffs as one unified, data-driven system. **Buffs can:**

- [x] be permanent, or trigger on an event and last a duration (#55–56)
- [x] trigger from hits landing, resources crossing thresholds, swaps, and on/off-field changes (#56–58, 88–90, 94)
- [x] stack (per-stack values, independent stacks, and consumable charges) (#59, 61)
- [x] be gated by conditions (on/off field, resource gates, target status) (#57–58, 111, 341–343)
- [x] emit additional hits as procs, with cooldowns and internal cooldowns (#60, 90)

### Combat Mechanics & Damage Model

Calculate damage with the game's scaling stats, resources, and status effects. **The simulator:**

- [x] scales each skill's damage off its scaling stat (ATK, HP, or DEF) (#69–70)
- [x] applies DEF shred and RES shred (#99)
- [x] tracks energy — gained per hit, scaled by Energy Recharge, spent on Liberation casts (#86, 98, 123)
- [x] tracks concerto — built by Skill damage, drained by Outro skills (#237, 323–324)
- [x] tracks forte as a per-character, hit-driven resource (#213, 225–226)
- [x] calculates healing (#136, 147, 218, 224)
- [x] models coordinated attacks (#219)
- [x] applies vulnerability and negative-status damage-over-time (#330–333)

### Character Implementations

Implement each playable character end-to-end.

- **Encore**
  - [x] signature gear: Stringmaster / Inferno Rider / Molten Rift (#95, 112)
  - [x] Cosmos Rave Liberation mode empowers her basic attacks (#25, 89)
  - [x] full Forte Circuit allows Cloudy Frenzy and Cosmos Rupture (#25)
  - [x] Resonance Chain sequences (S1, S2, S4, S6) (#87, 89–91)
  - [x] e2e tested
- **Sanhua**
  - [x] signature gear: Emerald of Genesis / Impermanence Heron / Moonlit Clouds (#122)
  - [x] create Ice Thorn / Prism / Glacier creations via Intro, Resonance Skill, and Liberation; a Heavy Attack detonates them for burst hits (#25, 118, 120)
  - [x] Outro grants the next resonator Basic Attack Amp (no forte gauge) (#118)
  - [x] Resonance Chain sequences (S1, S4-S6) (#119, 121)
  - [x] e2e tested
- **Verina**
  - [x] signature gear: Variation / Bell-Borne Geochelone / Rejuvenating Glow (#148–149)
  - [x] Liberation's Photosynthesis Mark drives coordinated attacks (#216)
  - [x] forte spent on Starflower Blooms heal the team and restore concerto (#214–215)
  - [x] team buffs (Outro allAmp, Gift of Nature ATK) (#150)
  - [x] Resonance Chain sequences (S1-S4, S6) (#150, 214)
  - [ ] e2e tested
- **Shorekeeper**
  - [x] signature gear: Stellar Symphony / Fallacy of No Return / Rejuvenating Glow (#275)
  - [x] Liberation creates an Outer/Inner/Supernal Stellarealm field granting the team Crit Rate then Crit DMG (scaling with her Energy Regen) (#259–260)
  - [x] Outro allAmp (#257–258)
  - [x] Resonance Chain sequences (S1-S4, S6) (#259)
  - [ ] e2e tested
- **Camellya**
  - [x] signature gear: Red Spring / Nightmare: Crownless / Havoc Eclipse
  - [x] spends a 100-point Crimson Pistil forte (one Crimson Bud per 10 spent, max 10) (#326)
  - [x] entering Budding Mode via Ephemeral consumes the buds to amplify Sweet Dream damage (#327–328)
  - [x] Resonance Chain sequences (S1-S6) (#325)
  - [ ] e2e tested
- **Cartethyia**
  - [x] signature gear: Defier's Thorn / Reminiscence: Fleurdelys / Windward Pilgrimage (#344)
  - [x] summons three Sword Shadows (Discord / Divinity / Virtue) that a plunge recall consumes for lasting powers (data only)
  - [x] Manifest forte lets her Liberation switch into the Fleurdelys second form and back (data only)
  - [x] applies Aero Erosion vulnerability (data only)
  - [x] Resonance Chain sequences (S2-S4, S6) (data only)
  - [ ] e2e tested
- **Ciaccona**
  - [ ] signature gear: Woodland Aria / Reminiscence: Fleurdelys / Gusts of Welkin
  - [ ] e2e tested
- **Changli**
  - [ ] signature gear: Blazing Brilliance / Nightmare: Inferno Rider / Molten Rift
  - [ ] e2e tested
- **Aemeath**
  - [ ] signature gear: Everbright Polestar / Sigillum / Trailblazing Star
  - [ ] e2e tested
- **Chisa**
  - [ ] signature gear: Kumokiri / Reminiscence: Threnodian - Leviathan / Thread of Severed Fate

_More to be implemented_

### Simulation Log & Buff-Timeline UI

Two complementary views of a simulated run.

- [x] **The damage log lets users:** read every action and hit on a time axis (#49–51)
- [x] drill into any hit for its live stat values and full damage-formula breakdown (#96, 100–101)
- [x] see which buffs were active and contributed to each hit (#97, 115)
- [x] **The buff timeline log lets users** read every buff's uptime across the whole rotation (#335, 340, 346, 351)

### Validation & Diagnostics

Validate a rotation and report any issues on the relevant timeline rows. **The validator:**

- [x] flags illegal swaps (Intro must follow Outro, swap-back cooldowns) (#75, 178)
- [x] flags unreachable stages (required prior stage/combo) (#76, 347–350)
- [x] validates footing transitions across launch and land stages (#240)
- [x] marks each finding as invalid or warning (#178, 363)
- [x] shows clear, structured messages with readable stage labels on the offending row (#77, 361–362, 365–366)

### Settings

Configure how the simulation models timing and resources. **Let users:**

- [x] set a reaction delay applied between actions (#79)
- [x] set swap-frame delays (#175)
- [x] set fall-frame delays (#233)
- [x] start characters with full energy (#356–357)
- [x] keep sim settings per team, saved into the share code (#358–359)

### Routes & Pages

The app is split into pages via file-based routing (TanStack Router, `src/routes/`).

- **Landing (`/`)**
  - [x] a landing page at the root (#290)
- **Simulator (`/sim`)**
  - [x] the main rotation-planner and damage-simulation page (#290)
- **Library (`/library`)**
  - [x] save, load, rename, and delete teams in a personal rotation library (#292–294, 297–303)
  - [x] view a team's skill-type breakdown and damage totals (#291, 303)
  - [x] persist the library and live team state (localStorage) (#11, 295)
  - [x] export a team build to a compact share code, and import one back (#246–247, 250, 296)
- **Dev: Frame authoring (`/dev/frames`)**
  - [x] a video-editor-like tool to time stage animation frames from clip recordings (#242)
