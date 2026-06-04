# Data

`src/data/` holds the game content the simulator runs on — characters, weapons,
echoes, and echo sets — plus the small shared vocabularies (elements, skill
types) and the movement pseudo-skills. Each content domain follows the same
**folder triad**, and every authored entry is the _enriched_ shape the engine
consumes (see [enriched-model](enriched-model.md)).

**Source files:** `src/data/characters/index.ts`, `src/data/weapons/index.ts`, `src/data/echoes/index.ts`, `src/data/echo-sets/index.ts`, `src/data/elements.ts`, `src/data/skill-types.ts`, `src/data/movement.ts`

## How it works

### The folder triad

Each domain (`characters/`, `weapons/`, `echoes/`, `echo-sets/`) contains:

1. **Authored entry files** — one per item (`camellya.ts`, `stringmaster.ts`),
   each `export const … satisfies` the enriched type. This is the source of
   truth.
2. **`index.ts`** — the registry. It imports every entry and exports an `ALL_*`
   array (`ALL_CHARACTERS`, `ALL_WEAPONS`, `ALL_ECHOES`, `ALL_ECHO_SETS`). The
   loadout catalog resolves numeric ids against these arrays (see
   [loadout](loadout.md)).
3. **`raw/`** — the extracted JSON the entry was authored _from_ (see below). Not
   loaded at runtime.

Items are identified by a stable numeric `id`; loadouts and the catalog reference
items by that id, never by import.

The character registry does one extra thing: `injectMovement` appends the shared
`DODGE_SKILL` / `JUMP_SKILL` to every character's skill list at load, so movement
need not be repeated per character.

### Extraction (`references/` → `raw/`)

The `raw/*.json` files are produced by extraction tooling that reads the canonical
in-game descriptions under `references/` (and the game API) and emits the raw
`Character` / `Weapon` / `Echo` shape. Extraction is the _input_ to authoring,
not a replacement for it: an author reads the raw JSON plus the reference text and
hand-writes the enriched `.ts` entry. Re-running extraction refreshes `raw/` but
never touches the authored entry — editing `raw/` alone changes nothing the engine
sees.

### Shared vocabularies

- **`elements.ts`** — the `Element` union (Fusion, Glacio, Electro, Aero, Havoc,
  Spectro, Physical), the `ELEMENTS` array, and `ELEMENT_CLASSES` (UI color
  classes). The element list also seeds the keyed maps in
  [stat-table](stat-table.md).
- **`skill-types.ts`** — display labels for `SkillType`/`SkillGrouping`
  (`STAGE_TYPE_LABELS`) and `formatSkillType` for arbitrary strings.
- **`movement.ts`** — `DODGE_SKILL` and `JUMP_SKILL` as standalone
  `EnrichedSkill`s with action times and footing. They have no raw source and no
  per-character authoring — the one place enrichment is done in code.

## Gotchas

- A new entry is invisible until it is also imported and added to the domain's
  `index.ts` — the `satisfies` check alone does not register it.

## Related

- [enriched-model](enriched-model.md) — raw vs authored shapes and what enrichment adds
- [loadout](loadout.md) — how the `ALL_*` registries are resolved by id
- [stat-table](stat-table.md) — consumes element/skill-type vocabularies
- `references/` — canonical in-game descriptions extraction reads from
