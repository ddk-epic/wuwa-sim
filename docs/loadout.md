# Loadout

A loadout is the **configurable unit** a simulation runs against: a team of three
slots, each pairing a character with a weapon, echoes, an echo set, a resonance
sequence, and main-stat choices. The loadout types deliberately store only
**numeric IDs**, never references to the `Enriched*` game-model objects — this
keeps the working team a small, serializable struct that persists to
`localStorage` and is resolved to real data on demand.

**Source files:** `src/types/loadout.ts`, `src/lib/loadout/catalog.ts`, `src/lib/loadout/template.ts`, `src/lib/loadout/team-ops.ts`

## How it works

`ActiveTeam` is the one live working team (the `wuwa.team` store). It holds a
Library `name`, three `slots` (character ids, or `null`), three `loadouts`
(`SlotLoadout`), the `focusedId`, and an `originId` — the Saved Team it was loaded
from, or `null` when unsaved. The timeline and simulation log live in separate
stores with different lifecycles, so they are intentionally _not_ part of
`ActiveTeam`.

Each `SlotLoadout` configures one slot: `weaponId` + `weaponRank`, an `echoId`,
two echo-set slot ids, the `sequence` (resonance chain level), an `echoBuild`
pattern (`4-3-3-1-1` or `4-4-1-1-1`), and the main-stat choices `cost4Mains` /
`cost3Mains`. The echo build pattern and main-stat choices are what the stat
builder expands into concrete substat rolls (see [stat-table](stat-table.md)).

### ID decoupling and resolution

Because `SlotLoadout` references everything by id, it never imports a
game-model type. The bridge back to real data is `catalog.ts`:
`getCharacterById` / `getWeaponById` / `getEchoById` / `getEchoSetById` look the
id up in the `ALL_*` registries (see [data](data.md)) and return the
**enriched** entry (`EnrichedCharacter`, `WeaponData`, `EnrichedEcho`, `EchoSet`).
This is why a loadout can be serialized, shared, and reloaded without carrying
the data itself.

### Share codes

`import-export.ts` packs a team **plus its timeline** into a Base91 string for
sharing. To stay short it stores **array positions, not id values**: a character
is its index in `ALL_CHARACTERS`, a weapon its index in `ALL_WEAPONS`, and so on.
A timeline entry's stage is an ordinal into **its own character's** flattened
stage list (echo stages share one suffix after every character's stages), keyed
off the entry's character byte.

This makes the format **append-only**. Appending a character, echo, weapon, etc.
at the **end** of its registry — or a stage at the end of a character's stage
list — leaves every existing code decoding to the same things. But **inserting,
removing, or reordering** an entry mid-registry (or mid stage-list) renumbers the
positions after it and silently makes already-shared codes decode to the wrong
data. Such an edit is a breaking wire change: bump the `VERSION` byte (the decoder
rejects versions it doesn't recognise).

The current version is `4`. After the timeline it appends the team's
[[Settings]] as five trailing bytes — the four frame knobs followed by
`startWithFullEnergy` (`0`/`1`). This is a pure **append**: a `v3` code is a `v4`
code minus those five bytes, so the decoder still accepts `v3` and fills the
missing settings with `DEFAULT_SETTINGS` (back-compat). Versions outside `{3, 4}`
are rejected, not migrated — a stale code is simply re-exported. A future
trailing field should follow the same pattern (append + keep accepting the
shorter prior version); only a mid-stream renumber forces a hard version cut.

### Templates

A new slot is seeded from a `CharacterTemplate` — the recommended weapon / echo /
echo-set _names_ an author ships with a character. `template.ts` resolves those
names (`findWeaponByName`, etc.) into a populated `SlotLoadout`, applying the
per-build main-stat defaults (`COST4_MAINS_DEFAULT` / `COST3_MAINS_DEFAULT`).

## Gotchas

- `Slots` and `loadouts` are fixed-length 3-tuples; a missing slot is `null`, not
  a shorter array.
- `originId` is a string (Saved Team key), while every in-slot id is numeric —
  they index different stores.

## Related

- [enriched-model](enriched-model.md) — the shapes that ids resolve to
- [data](data.md) — the registries `catalog.ts` searches
- [stat-table](stat-table.md) — how a resolved loadout becomes computed stats
