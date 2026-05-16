# Buff Authoring Guide

How to write `BuffDef` entries on characters, weapons, echoes, and echo sets. Start with **Anatomy** for the mental model, jump to the **Cookbook** to find a pattern close to what you're authoring, drop into **Reference** to look up specific fields and unions.

The authoritative type is `src/types/buff.ts`. This doc explains semantics that the type can't.

---

## Anatomy of a buff

Every `BuffDef` answers the same five questions: when does it fire, who does it land on, what does it do, how long does it last, and how does it stack? Here's Sanhua's Silversnow with each field labeled:

```ts
{
  // Unique key. Used for dedupe, condition refs, logs. See "Naming id".
  id: "char.sanhua.outro.silversnow",

  // Human-readable label, shown in logs / UI.
  name: "Silversnow",

  // Optional in-game flavor / tooltip text.
  description: "After Sanhua uses Outro, the next on-field Resonator's Glacio DMG is increased by 22.5% for 14s.",

  // WHEN: a Trigger union variant. This one fires whenever character 1102
  // (Sanhua) casts a skill of type "Outro Skill".
  trigger: {
    event: "skillCast",
    characterId: 1102,
    skillType: "Outro Skill",
  },

  // WHO: a BuffTarget. "nextOnField" arms the buff and lands it on whoever
  // swaps in next.
  target: { kind: "nextOnField" },

  // HOW LONG: 14 seconds. Other kinds: "permanent", { kind: "frames", v: N }.
  duration: { kind: "seconds", v: 14 },

  // WHAT: an array of Effect entries. Most buffs have one.
  effects: [
    {
      kind: "stat",
      path: { stat: "elementBonus", key: "Glacio" },
      value: { kind: "const", v: 0.225 },
    },
  ],

  // Omitted: stacking (defaults to { max: 1, onRetrigger: "refresh" }),
  // condition, consumedBy, requiresSequence, requiresPieces, perSource,
  // expiresOnSourceSwapOut, nonStackingGroup.
}
```

The required fields are `id`, `name`, `trigger`, `target`, `effects`, `duration`. Everything else has a sensible default.

---

## Cookbook

Each recipe shows the smallest complete buff for the pattern. Copy, rename, tweak.

### 1. Permanent self stat passive

**When to use**: a flat always-on stat boost — weapon main stats, echo sub-stats, skill-tree nodes, "while equipped" passives.

**Key fields**: `trigger: { event: "simStart" }`, `target: { kind: "self" }`, `duration: { kind: "permanent" }`, no `condition`. The bootstrap pre-folds these directly into the base stat table at sim start, so they cost nothing per frame.

**Gotchas**: if you add a `condition`, the buff stops being pre-folded and becomes a permanent instance that's evaluated each frame — that's fine, but know what you're opting into.

```ts
{
  id: "weapon.emerald-of-genesis.atk-passive",
  name: "Emerald of Genesis (ATK)",
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: [
    { kind: "stat", path: { stat: "atkPct" }, value: { kind: "const", v: 0.12 } },
  ],
}
```

See: skill-tree compilation in `src/lib/engine-bootstrap.ts` (`compileSkillTreeNode`).

### 2. Outro → next on-field buff

**When to use**: an Outro that buffs whoever swaps in next.

**Key fields**: `trigger.event = "skillCast"` with `skillType: "Outro Skill"` and the source character's `characterId`; `target: { kind: "nextOnField" }`; timed `duration`.

**Gotchas**: `nextOnField` arms the buff at trigger time and only lands it when the next swap-in actually happens. The buff sits dormant until then.

```ts
{
  id: "char.sanhua.outro.silversnow",
  name: "Silversnow",
  trigger: { event: "skillCast", characterId: 1102, skillType: "Outro Skill" },
  target: { kind: "nextOnField" },
  duration: { kind: "seconds", v: 14 },
  effects: [
    {
      kind: "stat",
      path: { stat: "elementBonus", key: "Glacio" },
      value: { kind: "const", v: 0.225 },
    },
  ],
}
```

See: `src/data/characters/sanhua.ts` — Silversnow.

### 3. Self buff on skill cast

**When to use**: "after casting X, your next Y deals more" patterns where the buff lands on the caster.

**Key fields**: `trigger.event = "skillCast"` filtered by `characterId` and `skillType`; `target: { kind: "self" }`; timed `duration`.

**Gotchas**: `target: { kind: "self" }` here means the trigger's source character — i.e. the caster — not the on-field character at trigger time. They're usually the same, but not always (synthetic casts, off-field triggers).

```ts
{
  id: "char.sanhua.intro.freezing-thorns",
  name: "Freezing Thorns",
  trigger: { event: "skillCast", characterId: 1102, skillType: "Intro Skill" },
  target: { kind: "self" },
  duration: { kind: "seconds", v: 14 },
  effects: [
    {
      kind: "stat",
      path: { stat: "skillTypeBonus", key: "Resonance Skill" },
      value: { kind: "const", v: 0.38 },
    },
  ],
}
```

See: `src/data/characters/sanhua.ts` — Freezing Thorns.

### 4. Team buff on event

**When to use**: an Intro/Outro/Liberation that buffs the entire team.

**Key fields**: `target: { kind: "team" }`. Otherwise identical to recipes 2/3.

**Gotchas**: `team` includes the source character. If you only want allies, use a `condition` to exclude self, or model it as a `nextOnField` instead.

```ts
{
  id: "char.example.lib.warcry",
  name: "Warcry",
  trigger: { event: "skillCast", characterId: 9999, skillType: "Resonance Liberation" },
  target: { kind: "team" },
  duration: { kind: "seconds", v: 20 },
  effects: [
    { kind: "stat", path: { stat: "atkPct" }, value: { kind: "const", v: 0.15 } },
  ],
}
```

### 5. Stacking on hit

**When to use**: "each hit grants a stack of X, up to N, lasts T seconds, refreshes/extends on retrigger".

**Key fields**: `trigger.event = "hitLanded"` (filter by `actor`/`skillType`/`dmgType`/`source` as needed); `stacking: { max: N, onRetrigger: "addStack" | "addStackKeepTimer" | "refresh" }`; `value: { kind: "perStack", v: ... }` so the effect scales with stack count.

**Gotchas**: pick `onRetrigger` deliberately — `addStack` resets the timer each hit, `addStackKeepTimer` doesn't. Use `perStack` not `const` for the value, otherwise stacks do nothing. Set `snapshot: true` on the value if it should freeze the underlying stat at apply time (e.g. for snapshotted ATK scaling).

```ts
{
  id: "char.example.passive.fervor",
  name: "Fervor",
  trigger: { event: "hitLanded", actor: "self", skillType: "Basic Attack" },
  target: { kind: "self" },
  duration: { kind: "seconds", v: 8 },
  stacking: { max: 5, onRetrigger: "addStack" },
  effects: [
    { kind: "stat", path: { stat: "atkPct" }, value: { kind: "perStack", v: 0.04 } },
  ],
}
```

### 6. Conditional / gated buff

**When to use**: a buff that only contributes its effects while some predicate holds — "while on field", "while target has X", "while energy ≥ N".

**Key fields**: `condition` — re-evaluated continuously, gates contribution without removing the instance.

**Gotchas**: a `condition` on a permanent simStart buff prevents it from being pre-folded into base stats; it becomes a permanent _instance_. That's fine and expected. The four kinds are `buffActive`, `onField`, `actorIsOnField`, `resourceAtLeast`.

```ts
{
  id: "char.example.passive.vanguard",
  name: "Vanguard",
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  condition: { kind: "onField" },
  effects: [
    { kind: "stat", path: { stat: "critRate" }, value: { kind: "const", v: 0.10 } },
  ],
}
```

### 7. Consumed-on-use buff

**When to use**: a charge that vanishes after one use — "your next Heavy Attack is enhanced", crit-guarantee on next hit, etc.

**Key fields**: `consumedBy` — a Trigger filter. After each event, instances whose `consumedBy` matches lose a stack; at 0 stacks they're removed and a `buffConsumed` lifecycle event fires.

**Gotchas**: `consumedBy` matches the _just-fired event_, not the trigger that applied the buff. Filter it tightly (`skillType`, `actor`) or you'll consume on the wrong event.

```ts
{
  id: "char.example.passive.loaded-shot",
  name: "Loaded Shot",
  trigger: { event: "skillCast", characterId: 9999, skillType: "Resonance Skill" },
  target: { kind: "self" },
  duration: { kind: "seconds", v: 30 },
  consumedBy: { event: "hitLanded", actor: "self", skillType: "Heavy Attack" },
  effects: [
    {
      kind: "stat",
      path: { stat: "skillTypeBonus", key: "Heavy Attack" },
      value: { kind: "const", v: 0.50 },
    },
  ],
}
```

### 8. Resource threshold buff

**When to use**: a buff that fires when a resource crosses a threshold ("at 100 concerto, gain X"), or one that's gated by current resource level.

**Key fields**: trigger via `resourceCrossed` (one-shot fire when crossing), or condition via `resourceAtLeast` (continuous gate).

**Gotchas**: `resourceCrossed` fires on the crossing transition, not while above the threshold — pair with a `duration` if you want a window. `direction: "up"` and `direction: "down"` are separate triggers.

```ts
{
  id: "char.example.passive.overflow",
  name: "Overflow",
  trigger: {
    event: "resourceCrossed",
    resource: "concerto",
    threshold: 100,
    direction: "up",
    actor: "self",
  },
  target: { kind: "self" },
  duration: { kind: "seconds", v: 10 },
  effects: [
    { kind: "stat", path: { stat: "atkPct" }, value: { kind: "const", v: 0.20 } },
  ],
}
```

### 9. Sequence-gated character buff

**When to use**: a character buff that only exists at a given resonance chain sequence (S1–S6).

**Key fields**: `requiresSequence: N` on the BuffDef. Filtered out at bootstrap if the slot's sequence is below N.

**Gotchas**: only meaningful on character buffs; weapons/echoes ignore it. Filtering happens once at bootstrap, so changing sequence mid-sim won't re-evaluate.

```ts
{
  id: "char.example.s2.ascendance",
  name: "S2: Ascendance",
  requiresSequence: 2,
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: [
    { kind: "stat", path: { stat: "critDmg" }, value: { kind: "const", v: 0.20 } },
  ],
}
```

### 10. Echo-set 2pc / 5pc

**When to use**: an echo-set bonus that activates at a piece count.

**Key fields**: `requiresPieces: 2` or `5`. Filtered at bootstrap based on the slot's equipped piece count.

**Gotchas**: defaults to 2 if omitted, so 2pc bonuses can leave it off — but be explicit. 5pc bonuses must set it, otherwise they'll activate at 2.

```ts
{
  id: "echo-set.moonlit-clouds.5pc.tailwind",
  name: "Moonlit Clouds 5pc",
  requiresPieces: 5,
  trigger: { event: "swapIn", actor: "self" },
  target: { kind: "self" },
  duration: { kind: "seconds", v: 15 },
  effects: [
    { kind: "stat", path: { stat: "atkPct" }, value: { kind: "const", v: 0.225 } },
  ],
}
```

---

## Reference

Concept-grouped lookup. Tables first, prose only where the type doesn't tell the full story.

### Naming `id`

`id` is a freeform string but used as a dedupe key, condition reference (`buffActive.buffId`), and log label. Pick something stable, kebab-case, and namespaced by source.

| Source     | Pattern                                    | Example                                        |
| ---------- | ------------------------------------------ | ---------------------------------------------- |
| Character  | `char.<name>.<slot>.<short-kebab>`         | `char.sanhua.outro.silversnow`                 |
| Weapon     | `weapon.<name>.<short-kebab>`              | `weapon.emerald-of-genesis.atk-passive`        |
| Echo       | `echo.<name>.<short-kebab>`                | `echo.impermanence-heron.flux`                 |
| Echo set   | `echo-set.<name>.<2pc\|5pc>.<short-kebab>` | `echo-set.moonlit-clouds.5pc.tailwind`         |
| Skill tree | `skill-tree.<characterId>.<nodeName>`      | `skill-tree.1102.Glacio DMG Bonus` (generated) |

Slot for character buffs is one of: `intro`, `outro`, `passive`, `forte`, `liberation`, `skill`, `s1`–`s6` for sequence buffs.

Don't include version numbers, balance patches, or character IDs (in human-authored ids) — they go stale. Don't reuse an id across sources.

### Naming `name`

`name` is the human-readable label shown in logs and UI. Two conventions:

**Sequence buffs** — prefix with the sequence tag: `"S2: Ascendance"`, not `"Ascendance (S2)"`.

**Multi-effect buffs** — append a parenthetical listing short labels for each effect, comma-separated: `"Woolies Cheer Dance (Fusion, Basic)"`. Short labels by stat path:

| Stat path                    | Label                                |
| ---------------------------- | ------------------------------------ |
| `elementBonus/<Element>`     | element name (`Fusion`, `Glacio`, …) |
| `skillTypeBonus/<SkillType>` | short skill name (see table below)   |
| `deepen/<SkillType>`         | `<short> Deepen`                     |
| `shred/<SkillType>`          | `<short> Shred`                      |
| `atkPct`                     | `ATK`                                |
| `hpPct`                      | `HP`                                 |
| `defPct`                     | `DEF`                                |
| `critRate`                   | `CRIT Rate`                          |
| `critDmg`                    | `CRIT DMG`                           |
| `defShred`                   | `DEF Shred`                          |
| `allDmgBonus`                | `All`                                |
| `energyRechargePct`          | `ER`                                 |
| flat stats (rare)            | `ATK Flat`, `HP Flat`, `DEF Flat`    |

SkillType short forms:

| SkillType              | Short        |
| ---------------------- | ------------ |
| `Basic Attack`         | `Basic`      |
| `Heavy Attack`         | `Heavy`      |
| `Resonance Skill`      | `Skill`      |
| `Resonance Liberation` | `Liberation` |
| `Forte Circuit`        | `Forte`      |
| `Intro Skill`          | `Intro`      |
| `Outro Skill`          | `Outro`      |
| `Echo Skill`           | `Echo`       |

### Triggers

| `event`           | When it fires                                                                    |
| ----------------- | -------------------------------------------------------------------------------- |
| `simStart`        | Once at sim start. Used for permanent passives.                                  |
| `skillCast`       | A skill is cast. Filter by `actor`, `characterId`, `skillType`.                  |
| `hitLanded`       | A hit lands. Filter by `actor`, `characterId`, `skillType`, `dmgType`, `source`. |
| `swapIn`          | A character swaps to on-field.                                                   |
| `swapOut`         | A character swaps off-field.                                                     |
| `resourceCrossed` | A resource crosses `threshold` in `direction`. One-shot per crossing.            |

`skillType` on `skillCast` and `hitLanded` must be one of the eight engine values — see **SkillType values** below. `"Normal Attack"` is not a valid value (TypeScript will catch it).

`actor`: `"self"` matches the _receiver_ of the buff (`target.kind: "self"`); `"any"` matches any character. Default behavior when omitted is type-defined.

`source` on `hitLanded`: `"self"` = real hits the character performed, `"synthetic"` = injected via `emitHit`, `"any"` = both. Use `"self"` to avoid feedback loops where a buff-triggered synthetic hit re-triggers the same buff.

### Targets

| `kind`        | Who receives the buff                                  |
| ------------- | ------------------------------------------------------ |
| `self`        | The trigger's source character (usually the caster).   |
| `team`        | All three slots, including source.                     |
| `nextOnField` | Armed at trigger time; lands on whoever swaps in next. |

There is no built-in "team excluding self" — model it with a `condition` or use `nextOnField`.

### Effects

A buff's `effects` is an array; entries can mix kinds.

| `kind`     | What it does                                                              |
| ---------- | ------------------------------------------------------------------------- |
| `stat`     | Adds to a stat path while active. Most common.                            |
| `resource` | Mutates a resource (`add`/`sub`/`set`) on self/target/source.             |
| `emitHit`  | Injects a synthetic hit attributed to the source character. See appendix. |

**Stat paths** (`StatPath`):

- Flat: `atkPct`, `atkFlat`, `hpPct`, `hpFlat`, `defPct`, `defFlat`, `critRate`, `critDmg`, `defShred`
- Keyed: `elementBonus` (key = element name), `skillTypeBonus` (key = `SkillType`), `deepen` (key = `SkillType`), `shred` (key = `SkillType`) — see **SkillType values** for valid keys

**Value expressions** (`ValueExpr`):

- `{ kind: "const", v: N }` — fixed contribution.
- `{ kind: "perStack", v: N }` — multiplied by current stack count.
- `snapshot?: true` on either — see "Snapshot vs. dynamic value" appendix.

### Duration & stacking

| `Duration.kind` | Meaning                                                            |
| --------------- | ------------------------------------------------------------------ |
| `permanent`     | No expiry. Sim-start permanents are pre-folded unless conditional. |
| `frames`        | Expires after `v` engine frames.                                   |
| `seconds`       | Expires after `v` seconds (converted to frames internally).        |

`stacking` defaults to `{ max: 1, onRetrigger: "refresh" }`.

| `onRetrigger`       | Behavior on re-application                        |
| ------------------- | ------------------------------------------------- |
| `refresh`           | Reset duration to full. Stacks unchanged.         |
| `addStack`          | +1 stack (clamped to `max`), reset duration.      |
| `addStackKeepTimer` | +1 stack (clamped to `max`), keep existing timer. |
| `ignore`            | Re-application does nothing.                      |
| `replace`           | Remove existing instance and apply fresh.         |

### Conditions & gating

`condition` is re-evaluated continuously. While false, the instance is present but contributes no effects. While true again, contributions resume.

| `condition.kind`  | Predicate                                                     |
| ----------------- | ------------------------------------------------------------- |
| `onField`         | The buff's _target_ is currently on field.                    |
| `actorIsOnField`  | The buff's _source_ is currently on field.                    |
| `actorIsOffField` | The buff's _source_ is currently off field.                   |
| `buffActive`      | A specific buff (`buffId`) is active on `target` or `source`. |
| `resourceAtLeast` | A resource is ≥ `n` on `target` or `source`.                  |

A simStart-permanent buff with a `condition` becomes a permanent instance instead of being pre-folded — that's the intended way to model "always there but only contributes when X".

### Source-specific fields

| Field                    | Where it applies     | Behavior                                                                                                                                                                          |
| ------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requiresSequence`       | Character buffs only | Filtered out at bootstrap if slot sequence < N. No mid-sim re-evaluation.                                                                                                         |
| `requiresPieces`         | Echo-set buffs only  | Filtered at bootstrap. Defaults to `2` if omitted.                                                                                                                                |
| `nonStackingGroup`       | Any                  | When multiple active buffs share the group, engine logs `console.info` but applies them all.                                                                                      |
| `perSource`              | Any                  | When true, dedupe key includes `sourceCharacterId` so distinct sources produce parallel instances. Default false: re-application from any source refreshes the existing instance. |
| `expiresOnSourceSwapOut` | Any                  | When true, instance is removed when its source character swaps off field.                                                                                                         |
| `cooldown`               | Any                  | Minimum seconds between successive fires from the same source. Re-triggers within the window are suppressed.                                                                      |
| `consumedBy`             | Any                  | After each event, instances whose `consumedBy` matches lose a stack; at 0 they're removed and `buffConsumed` fires.                                                               |

### SkillType values

`SkillType` is a closed union. These are the only valid values for `Trigger.skillType`, `DamageEntry.type`, and `skillTypeBonus` / `deepens` / `shreds` keys:

| Value                    |
| ------------------------ |
| `"Basic Attack"`         |
| `"Heavy Attack"`         |
| `"Resonance Skill"`      |
| `"Resonance Liberation"` |
| `"Forte Circuit"`        |
| `"Intro Skill"`          |
| `"Outro Skill"`          |
| `"Echo Skill"`           |

`"Normal Attack"` is **not** a `SkillType`. It is a UI grouping label (covering Basic Attack and Heavy Attack together) used only in the skill sidebar. A trigger with `skillType: "Normal Attack"` will never fire and TypeScript will surface the error at compile time. (ADR-0012)

### Less common

**`emitHit` effect** — injects a synthetic hit attributed to the source character. Carries a `DamageEntry` (multiplier, dmgType, energy, concerto), a per-instance `icdFrames` cooldown (no default — set deliberately), and optional `skillType`/`element` overrides. Use for "deal additional damage when X" passives. To prevent feedback loops, downstream `hitLanded` triggers should set `source: "self"` if they don't want to react to synthetic hits.

**`resource` effect** — `op: "add" | "sub" | "set"` against a `ResourceKind` (`energy`, `concerto`, `forte`, `resonance`). `target` defaults to the buff's target but can be overridden to `"self"` / `"target"` / `"source"`.

**Snapshot vs. dynamic value** — without `snapshot`, a `ValueExpr` recomputes against current stats every frame; with `snapshot: true`, the value is frozen at apply time using the source's stats then. Use snapshot for "X% of caster's ATK at cast time" patterns, dynamic for "while you have N stacks of buff Y, gain Z%".
