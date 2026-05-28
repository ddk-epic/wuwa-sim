# Stage Categories

Per-stage `SkillCategory` (player input/action).

Hidden stages (heals, utility) use whatever `damage[0].type` gives them — the value is never queried by triggers since these stages don't appear on the timeline. Marked `(fallback)` below.

## Encore

### Wooly Attack (Normal Attack)

| Stage                  | Category     | damage[0].type |
| ---------------------- | ------------ | -------------- |
| Stage 1                | Basic Attack | Basic Attack   |
| Stage 2                | Basic Attack | Basic Attack   |
| Stage 3                | Basic Attack | Basic Attack   |
| Stage 4                | Basic Attack | Basic Attack   |
| Stage 5 - Wooly Strike | Basic Attack | Basic Attack   |
| Heavy Attack           | Heavy Attack | Heavy Attack   |
| Mid-air Attack         | Basic Attack | Basic Attack   |
| Dodge Counter          | Basic Attack | Basic Attack   |

### Flaming Woolies (Resonance Skill)

| Stage             | Category        | damage[0].type  |
| ----------------- | --------------- | --------------- |
| Flaming Woolies   | Resonance Skill | Resonance Skill |
| Energetic Welcome | Resonance Skill | Resonance Skill |

### Cosmos Rave (Resonance Liberation)

| Stage                      | Category             | damage[0].type  |
| -------------------------- | -------------------- | --------------- |
| (opener)                   | Resonance Liberation | —               |
| Cosmos: Frolicking Stage 1 | Basic Attack         | Basic Attack    |
| Cosmos: Frolicking Stage 2 | Basic Attack         | Basic Attack    |
| Cosmos: Frolicking Stage 3 | Basic Attack         | Basic Attack    |
| Cosmos: Frolicking Stage 4 | Basic Attack         | Basic Attack    |
| Cosmos: Heavy Attack       | Heavy Attack         | Heavy Attack    |
| Cosmos Rampage             | Resonance Skill      | Resonance Skill |
| Cosmos: Dodge Counter      | Basic Attack         | Basic Attack    |

### Woolies Helpers (Intro Skill)

| Stage     | Category    | damage[0].type |
| --------- | ----------- | -------------- |
| (default) | Intro Skill | Intro Skill    |

### Black & White Woolies (Forte Circuit)

| Stage          | Category     | damage[0].type       |
| -------------- | ------------ | -------------------- |
| Cloudy Frenzy  | Heavy Attack | Resonance Liberation |
| Cosmos Rupture | Heavy Attack | Resonance Liberation |

### Thermal Field (Outro Skill)

| Stage     | Category    | damage[0].type |
| --------- | ----------- | -------------- |
| (default) | Outro Skill | Outro Skill    |

---

## Sanhua

### Frigid Light (Normal Attack)

| Stage          | Category     | damage[0].type |
| -------------- | ------------ | -------------- |
| Stage 1        | Basic Attack | Basic Attack   |
| Stage 2        | Basic Attack | Basic Attack   |
| Stage 3        | Basic Attack | Basic Attack   |
| Stage 4        | Basic Attack | Basic Attack   |
| Stage 5        | Basic Attack | Basic Attack   |
| Heavy Attack   | Heavy Attack | Heavy Attack   |
| Mid-air Attack | Basic Attack | Basic Attack   |
| Dodge Counter  | Basic Attack | Heavy Attack   |

### Eternal Frost (Resonance Skill)

| Stage     | Category        | damage[0].type  |
| --------- | --------------- | --------------- |
| (default) | Resonance Skill | Resonance Skill |

### Glacial Gaze (Resonance Liberation)

| Stage     | Category             | damage[0].type       |
| --------- | -------------------- | -------------------- |
| (default) | Resonance Liberation | Resonance Liberation |

### Freezing Thorns (Intro Skill)

| Stage     | Category    | damage[0].type |
| --------- | ----------- | -------------- |
| (default) | Intro Skill | Intro Skill    |

### Clarity of Mind (Forte Circuit)

| Stage    | Category     | damage[0].type |
| -------- | ------------ | -------------- |
| Detonate | Heavy Attack | Heavy Attack   |

### Silversnow (Outro Skill)

| Stage     | Category    | damage[0].type |
| --------- | ----------- | -------------- |
| (default) | Outro Skill | —              |

---

## Verina

### Cultivation (Normal Attack)

| Stage                  | Category     | damage[0].type |
| ---------------------- | ------------ | -------------- |
| Stage 1                | Basic Attack | Basic Attack   |
| Stage 2                | Basic Attack | Basic Attack   |
| Stage 3                | Basic Attack | Basic Attack   |
| Stage 4                | Basic Attack | Basic Attack   |
| Stage 5                | Basic Attack | Basic Attack   |
| Heavy Attack           | Heavy Attack | Heavy Attack   |
| Mid-air Attack Stage 1 | Basic Attack | Basic Attack   |
| Mid-air Attack Stage 2 | Basic Attack | Basic Attack   |
| Mid-air Attack Stage 3 | Basic Attack | Basic Attack   |
| Mid-air Heavy Attack   | Heavy Attack | Heavy Attack   |
| Dodge Counter          | Basic Attack | Basic Attack   |

### Botany Experiment (Resonance Skill)

| Stage     | Category        | damage[0].type  |
| --------- | --------------- | --------------- |
| (default) | Resonance Skill | Resonance Skill |

### Arboreal Flourish (Resonance Liberation)

| Stage                      | Category             | damage[0].type       |
| -------------------------- | -------------------- | -------------------- |
| (default)                  | Resonance Liberation | Resonance Liberation |
| Arboreal Flourish Healing  | (fallback)           | Basic Attack         |
| Coordinated Attack         | Resonance Liberation | Resonance Liberation |
| Coordinated Attack Healing | (fallback)           | Basic Attack         |

### Verdant Growth (Intro Skill)

| Stage     | Category    | damage[0].type |
| --------- | ----------- | -------------- |
| (default) | Intro Skill | Intro Skill    |

### Starflower Blooms (Forte Circuit)

| Stage                     | Category     | damage[0].type |
| ------------------------- | ------------ | -------------- |
| Heavy Attack              | Heavy Attack | Heavy Attack   |
| Starflower Blooms Healing | (fallback)   | Basic Attack   |
| Mid-air Attack: Stage 1   | Basic Attack | Basic Attack   |
| Mid-air Attack: Stage 2   | Basic Attack | Basic Attack   |
| Mid-air Attack: Stage 3   | Basic Attack | Basic Attack   |

### Blossom (Outro Skill)

| Stage     | Category    | damage[0].type |
| --------- | ----------- | -------------- |
| (default) | Outro Skill | —              |

---

## Shorekeeper

### Origin Calculus (Normal Attack)

| Stage           | Category     | damage[0].type |
| --------------- | ------------ | -------------- |
| Stage 1         | Basic Attack | Basic Attack   |
| Stage 2         | Basic Attack | Basic Attack   |
| Stage 3         | Basic Attack | Basic Attack   |
| Stage 4         | Basic Attack | Basic Attack   |
| Heavy Attack    | Heavy Attack | Heavy Attack   |
| Plunging Attack | Basic Attack | Basic Attack   |
| Dodge Counter   | Basic Attack | Basic Attack   |

### Chaos Theory (Resonance Skill)

| Stage     | Category        | damage[0].type  |
| --------- | --------------- | --------------- |
| (default) | Resonance Skill | Resonance Skill |
| Healing   | (fallback)      | Resonance Skill |

### End Loop (Resonance Liberation)

| Stage    | Category             | damage[0].type |
| -------- | -------------------- | -------------- |
| (opener) | Resonance Liberation | —              |
| Healing  | (fallback)           | Basic Attack   |

### Proof of Existence (Intro Skill)

| Stage                 | Category    | damage[0].type       |
| --------------------- | ----------- | -------------------- |
| Enlightenment         | Intro Skill | Resonance Skill      |
| Discernment           | Intro Skill | Resonance Liberation |
| Enlightenment Healing | (fallback)  | Intro Skill          |
| Discernment Healing   | (fallback)  | Intro Skill          |

### Astral Chord (Forte Circuit)

| Stage                | Category     | damage[0].type |
| -------------------- | ------------ | -------------- |
| Flare Star Butterfly | Basic Attack | Basic Attack   |
| Illation             | Heavy Attack | Heavy Attack   |
| Transmutation        | Basic Attack | Basic Attack   |

### Binary Butterfly (Outro Skill)

| Stage     | Category    | damage[0].type |
| --------- | ----------- | -------------- |
| (default) | Outro Skill | —              |

---

## Camellya

### Burgeoning (Normal Attack)

| Stage          | Category     | damage[0].type |
| -------------- | ------------ | -------------- |
| Basic Attack 1 | Basic Attack | Basic Attack   |
| Basic Attack 2 | Basic Attack | Basic Attack   |
| Basic Attack 3 | Basic Attack | Basic Attack   |
| Basic Attack 4 | Basic Attack | Basic Attack   |
| Basic Attack 5 | Basic Attack | Basic Attack   |
| Heavy Attack   | Heavy Attack | Heavy Attack   |
| Mid-air Attack | Basic Attack | Basic Attack   |
| Dodge Counter  | Basic Attack | Basic Attack   |
| Vining Waltz 1 | Basic Attack | Basic Attack   |
| Vining Waltz 2 | Basic Attack | Basic Attack   |
| Vining Waltz 3 | Basic Attack | Basic Attack   |
| Vining Waltz 4 | Basic Attack | Basic Attack   |
| Blazing Waltz  | Basic Attack | Basic Attack   |
| Vining Ronde   | Basic Attack | Basic Attack   |
| Atonement      | Basic Attack | Basic Attack   |

### Valse of Bloom and Blight (Resonance Skill)

| Stage           | Category        | damage[0].type |
| --------------- | --------------- | -------------- |
| Crimson Blossom | Resonance Skill | Basic Attack   |
| Floral Ravage   | Resonance Skill | Basic Attack   |

### Fervor Efflorescent (Resonance Liberation)

| Stage     | Category             | damage[0].type       |
| --------- | -------------------- | -------------------- |
| (default) | Resonance Liberation | Resonance Liberation |

### Everblooming (Intro Skill)

| Stage     | Category    | damage[0].type |
| --------- | ----------- | -------------- |
| (default) | Intro Skill | Intro Skill    |

### Vegetative Universe (Forte Circuit)

| Stage     | Category        | damage[0].type |
| --------- | --------------- | -------------- |
| Ephemeral | Resonance Skill | Basic Attack   |

### Twining (Outro Skill)

| Stage     | Category    | damage[0].type |
| --------- | ----------- | -------------- |
| (default) | Outro Skill | Outro Skill    |
