# wuwa-sim

A Wuthering Waves rotation planner and damage simulator.

### Timeline & Rotation Planner

Sequence character actions on a timeline to model a rotation's timing and damage. **Let users:**

- [ ] build a rotation by placing character actions on a timeline and watch time and damage update live (#1–5)
- [ ] clear the entire timeline (#7)
- [ ] reorder timeline entries by drag-and-drop (#74, 145, 190–192)
- [ ] group entries into units that behave like entries themselves (#137–145)
- [ ] manually run the simulation / re-validate the rotation on demand (#78, 255)
- [ ] auto-run the simulation as the rotation changes (#282–283)
- [ ] see resource totals on the timeline (#235)
- [ ] see total damage, DPS, and rotation time for the team (#35)
- [ ] export or import a rotation via a compact share code (#246–247, 296)

### Team Builder & Loadout

Assemble a team and configure each slot's loadout before simulating. **Let users:**

- [ ] assemble a team of characters from a picker (#3)
- [ ] start each character from its recommended gear template (#38)
- [ ] set each character's Resonance Chain sequence, S0–S6 (#71)
- [ ] set each character's weapon rank, R1–R5 (#72)
- [ ] equip an echo and echo sets to each character (#73, 131)

### Data Pipeline — Extraction & Generation

Turn raw wiki data extracts into character, weapon, and echo data files. **Let data authors:**

- [ ] scaffold and generate a new character's data file from raw wiki page extracts (#12–21, 24)
- [ ] generate weapon data files from raw wiki page extracts (#41–44)
- [ ] generate human-readable reference from extracts (#132)

### Skill & Stage System

Model the timing and combo rules of real skills and stages so a rotation behaves like the game. **The simulator:**

- [ ] supports stage variants — cancel, instant-cancel, and swap (#80–82, 176)
- [ ] supports basic movement actions (#133–135)
- [ ] accounts for footing changes (air and ground) (#232–245, 284)
- [ ] enforces swap-back cooldown (#241)
- [ ] cutscene animations bypass swap-back timing (#242)

### Echo System

Treat echoes as first-class gear and rotation actions. **Let users:**

- [ ] place an echo's skills on the timeline as first-class entries, like character skills (#28–34)
- [ ] equip one main echo per character (#73)
- [ ] equip up to 2 echo sets per character (#131)
- [ ] select each echo's main stat, with substats fixed to a default 16-roll spread (#107–110)

### Weapon System

Model weapons as gear that provides a rank-scaled passive. **The simulator:**

- [ ] applies each weapon's passive buff, scaled by its rank R1–R5 (#92–93)

### Simulation Engine

A frame-accurate, per-hit damage-and-buff simulation — the core of the tool. Buff and resource mechanics live in their own categories below. **The simulator:**

- [ ] assembles each character's starting stats and buffs from every source — base stats, weapon, echo, echo sets, substats, skill-tree nodes, and resonance sequence — before the rotation runs (#46–48, 63, 104, 151)
- [ ] resolves each action at frame-accurate cast and hit times, not just on cast (#45)
- [ ] calculates damage independently for every individual hit of a skill (#45, 51)
- [ ] snapshots the exact stats and active buffs at the moment of each hit (#54, 97)

### Buff System

Model character, weapon, and echo buffs as one unified, data-driven system. **Buffs can:**

- [ ] be permanent, or trigger on an event and last a duration (#55–56)
- [ ] trigger from hits landing, resources crossing thresholds, swaps, and on/off-field changes (#56–58, 88–90, 94)
- [ ] stack — with per-stack values, non-stacking groups, and consumable charges (#59, 61)
- [ ] be gated by conditions — on/off field, resource levels, target status, and the wielder's identity (#57–58, 111, 341–343)
- [ ] emit additional hits as procs, with cooldowns and internal cooldowns (#60, 90)

### Combat Mechanics & Damage Model

Calculate damage faithfully — with the game's scaling stats, resources, and status effects. **The simulator:**

- [ ] scales each skill's damage off its scaling stat (ATK, HP, or DEF) (#69–70)
- [ ] applies DEF shred and RES shred (#99)
- [ ] tracks energy — gained per hit, scaled by Energy Recharge, spent on Liberation casts (#86, 98, 123)
- [ ] tracks concerto — built by Skill damage, drained by Outro skills (#237, 323–324)
- [ ] tracks forte as a per-character, hit-driven resource (#213, 225–226)
- [ ] calculates healing (#136, 147, 218, 224)
- [ ] models coordinated attacks (#219)
- [ ] applies vulnerability and negative-status damage-over-time (#330–333)

### Character Implementations

Implement each playable character end-to-end — core mechanic, forte, full kit, and signature gear. **Implemented:**

- **Sanhua**
  - [ ] signature gear — Emerald of Genesis · Impermanence Heron · Moonlit Clouds (#122)
  - [ ] create Ice Thorn / Prism / Glacier creations via Intro, Resonance Skill, and Liberation; a Heavy Attack detonates them for burst hits (#25, 118, 120)
  - [ ] Outro grants the next resonator Basic Attack Amp (no forte gauge) (#118)
  - [ ] Resonance Chain sequences (S1, S4-S6) (#119, 121)
- **Encore**
  - [ ] signature gear — Stringmaster · Inferno Rider · Molten Rift (#95, 112)
  - [ ] Cosmos Rave Liberation mode empowers her basic attacks (#25, 89)
  - [ ] full Forte Circuit allows Cloudy Frenzy and Cosmos Rupture (#25)
  - [ ] Resonance Chain sequences (S1, S2, S4, S6) (#87, 89–91)
- **Verina**
  - [ ] signature gear — Variation · Bell-Borne Geochelone · Rejuvenating Glow (#148–149)
  - [ ] Liberation's Photosynthesis Mark drives coordinated attacks (#216)
  - [ ] forte spent on Starflower Blooms heal the team and restore concerto (#214–215)
  - [ ] team buffs (Outro allAmp, Gift of Nature ATK) (#150)
  - [ ] Resonance Chain sequences (S1-S4, S6) (#150, 214)
- **Shorekeeper**
  - [ ] signature gear — Stellar Symphony · Fallacy of No Return · Rejuvenating Glow (#275)
  - [ ] Liberation creates an Outer/Inner/Supernal Stellarealm field granting the team Crit Rate then Crit DMG (scaling with her Energy Regen) (#259–260)
  - [ ] Outro allAmp (#257–258)
  - [ ] Resonance Chain sequences (S1-S4, S6) (#259)
- **Camellya**
  - [ ] signature gear — Red Spring · Nightmare: Crownless · Havoc Eclipse (data only)
  - [ ] spends a 100-point Crimson Pistil forte (one Crimson Bud per 10 spent, max 10) (#326)
  - [ ] entering Budding Mode via Ephemeral consumes the buds to amplify Sweet Dream damage (#327–328)
  - [ ] Resonance Chain sequences (S1-S6) (#325)
- **Cartethyia**
  - [ ] signature gear — Defier's Thorn · Reminiscence: Fleurdelys · Windward Pilgrimage (#344)
  - [ ] summons three Sword Shadows (Discord / Divinity / Virtue) that a plunge recall consumes for lasting powers (data only)
  - [ ] Manifest forte lets her Liberation switch into the Fleurdelys second form and back (data only)
  - [ ] applies Aero Erosion vulnerability (data only)
  - [ ] Resonance Chain sequences (S2-S4, S6) (data only)

### Simulation Log & Buff-Timeline UI

Two complementary views of a simulated run.

- [ ] **The damage log lets users:** read every action and hit on a time axis (#49–51)
- [ ] drill into any hit for its live stat values and full damage-formula breakdown (#96, 100–101)
- [ ] see which buffs were active and contributed to each hit (#97, 115)
- [ ] **The buff timeline log lets users** read every buff's uptime across the whole rotation (#335, 340, 346, 351)

### Validation & Diagnostics

Validate a rotation and report any issues on the relevant timeline rows. **The validator:**

- [ ] flags illegal swaps — an Intro must follow an Outro, and a character can't immediately re-enter after swapping out (#75, 178)
- [ ] flags unreachable stages — required prior stage/combo missing or outside its timing window (#76, 347–350)
- [ ] validates footing transitions across launch and land stages (#240)
- [ ] marks each finding as invalid or warning (#178, 363)
- [ ] shows clear, structured messages with readable stage labels on the offending row (#77, 361–362, 365–366)

### Settings

Configure how the simulation models timing and resources. **Let users:**

- [ ] set a reaction delay applied between actions (#79)
- [ ] set swap-frame delays (#175)
- [ ] set fall-frame delays (#233)
- [ ] start characters with full energy (#356–357)
- [ ] keep sim settings per team, saved into the share code (#358–359)

### Routes & Pages

The app is split into pages via file-based routing (TanStack Router, `src/routes/`).

- **Landing (`/`)**
  - [ ] a landing page at the root (#290)
- **Simulator (`/sim`)**
  - [ ] the main rotation-planner and damage-simulation page (#290)
- **Library (`/library`)**
  - [ ] save, load, rename, and delete teams in a personal rotation library (#292–294, 297–303)
  - [ ] view a team's skill-type breakdown and damage totals (#291, 303)
  - [ ] persist the library and live team state (localStorage) (#11, 295)
  - [ ] export a team build to a compact share code, and import one back (#246–247, 250, 296)
- **Dev — Frame authoring (`/dev/frames`)**
  - [ ] a video-editor-like tool to time stage animation frames from clip recordings (#242)
