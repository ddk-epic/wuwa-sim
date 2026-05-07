import type { Character } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import {
  getCharacterById,
  listEchoes,
  listEchoSets,
  listWeaponsByType,
} from "#/lib/catalog"
import { SegmentedToggle } from "#/components/SegmentedToggle"

const SEQUENCES: number[] = [0, 1, 2, 3, 4, 5, 6]
const RANKS: number[] = [1, 2, 3, 4, 5]

interface TeamPanelProps {
  slots: Slots
  loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
  onSlotChange: (slotIndex: number, patch: Partial<SlotLoadout>) => void
}

export function TeamPanel({ slots, loadouts, onSlotChange }: TeamPanelProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Team
      </p>
      <div className="flex gap-3">
        {slots.map((charId, i) => {
          const character = charId !== null ? getCharacterById(charId) : null
          return (
            <TeamSlot
              key={i}
              slotNumber={i + 1}
              character={character}
              loadout={loadouts[i]}
              onSlotChange={(patch) => onSlotChange(i, patch)}
            />
          )
        })}
      </div>
    </div>
  )
}

interface TeamSlotProps {
  slotNumber: number
  character: Character | null
  loadout: SlotLoadout
  onSlotChange: (patch: Partial<SlotLoadout>) => void
}

function TeamSlot({
  slotNumber,
  character,
  loadout,
  onSlotChange,
}: TeamSlotProps) {
  if (character === null) {
    return (
      <div className="flex-1 border border-dashed border-gray-700 rounded p-3 flex items-center justify-center min-h-[88px]">
        <span className="text-gray-600 text-xs">Slot {slotNumber}</span>
      </div>
    )
  }

  const compatibleWeapons = listWeaponsByType(character.weaponType)
  const echoes = listEchoes()
  const echoSets = listEchoSets()

  return (
    <div className="flex-1 bg-gray-800 border border-gray-700 rounded p-3 space-y-1.5">
      <div className="text-xs font-semibold text-white mb-2">
        {character.name}
      </div>
      <SegmentedToggle
        options={SEQUENCES}
        value={loadout.sequence}
        onChange={(sequence) => onSlotChange({ sequence })}
        label={(v) => `S${v}`}
      />
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.weaponId ?? ""}
        onChange={(e) => onSlotChange({ weaponId: Number(e.target.value) })}
      >
        <option value="">— Weapon —</option>
        {compatibleWeapons.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <SegmentedToggle
        options={RANKS}
        value={loadout.weaponRank}
        onChange={(weaponRank) => onSlotChange({ weaponRank })}
        label={(v) => `R${v}`}
        disabled={loadout.weaponId === null}
      />
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.echoId ?? ""}
        onChange={(e) => onSlotChange({ echoId: Number(e.target.value) })}
      >
        <option value="">— Echo —</option>
        {echoes.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.echoSetId ?? ""}
        onChange={(e) => onSlotChange({ echoSetId: Number(e.target.value) })}
      >
        <option value="">— Echo Set —</option>
        {echoSets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )
}
