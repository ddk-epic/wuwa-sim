import type { Cost3Main, Cost4Main, EchoBuild } from "#/types/loadout"
import type { VariantKind } from "#/types/character"

// Frozen wire tables for the share codec. The index into each table is the byte
// on the wire; the ALL_* display arrays may reorder freely because encode/decode
// look up by id through these tables, never by array position. The id lists are
// generated + append-only (see wire-tables.generated.ts); this module adds the
// enum wire orders and lookup helpers. Enforced by wire-tables.test.ts.

export {
  CHARACTER_WIRE,
  WEAPON_WIRE,
  ECHO_WIRE,
  ECHO_SET_WIRE,
  SKILL_WIRE,
} from "./wire-tables.generated"

// Closed-domain enum wire orders: index-into-tuple, append-only. No game ids, so
// no id-keyed table — guarded against reorder by wire-tables.test.ts.
export const BUILD_WIRE_ORDER: readonly EchoBuild[] = ["4-3-3-1-1", "4-4-1-1-1"]
export const COST4_MAINS: readonly Cost4Main[] = ["scaling", "cr", "cd"]
export const COST3_MAINS: readonly Cost3Main[] = ["scaling", "er", "elemDmg"]
export const VARIANT_KINDS: readonly VariantKind[] = [
  "cancel",
  "instantCancel",
  "swap",
]

export function toWire(
  table: readonly number[],
  id: number,
  label: string,
): number {
  const i = table.indexOf(id)
  if (i < 0) throw new Error(`Unknown ${label} id ${id}`)
  return i
}

export function fromWire(
  table: readonly number[],
  byte: number,
  label: string,
): number {
  if (byte < 0 || byte >= table.length)
    throw new Error(`Unknown ${label} wire index ${byte}`)
  return table[byte]
}
