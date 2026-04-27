import type { Character } from '#/types/character'
import type { Weapon } from '#/types/weapon'
import type { Echo, EchoSet } from '#/types/echo'
import type { SlotLoadout } from '#/types/loadout'
import type { Slots } from '#/hooks/useTeam'

interface TeamPanelProps {
  slots: Slots
  loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
  characters: Character[]
  weapons: Weapon[]
  echoes: Echo[]
  echoSets: EchoSet[]
  onWeaponChange: (slotIndex: number, weaponId: number) => void
  onEchoChange: (slotIndex: number, echoId: number) => void
  onEchoSetChange: (slotIndex: number, echoSetId: number) => void
}

export function TeamPanel({
  slots,
  loadouts,
  characters,
  weapons,
  echoes,
  echoSets,
  onWeaponChange,
  onEchoChange,
  onEchoSetChange,
}: TeamPanelProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Team
      </p>
      <div className="flex gap-3">
        {slots.map((charId, i) => {
          const character =
            charId !== null
              ? (characters.find((c) => c.id === charId) ?? null)
              : null
          return (
            <TeamSlot
              key={i}
              slotNumber={i + 1}
              character={character}
              loadout={loadouts[i]}
              weapons={weapons}
              echoes={echoes}
              echoSets={echoSets}
              onWeaponChange={(weaponId) => onWeaponChange(i, weaponId)}
              onEchoChange={(echoId) => onEchoChange(i, echoId)}
              onEchoSetChange={(echoSetId) => onEchoSetChange(i, echoSetId)}
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
  weapons: Weapon[]
  echoes: Echo[]
  echoSets: EchoSet[]
  onWeaponChange: (weaponId: number) => void
  onEchoChange: (echoId: number) => void
  onEchoSetChange: (echoSetId: number) => void
}

function TeamSlot({
  slotNumber,
  character,
  loadout,
  weapons,
  echoes,
  echoSets,
  onWeaponChange,
  onEchoChange,
  onEchoSetChange,
}: TeamSlotProps) {
  if (character === null) {
    return (
      <div className="flex-1 border border-dashed border-gray-700 rounded p-3 flex items-center justify-center min-h-[88px]">
        <span className="text-gray-600 text-xs">Slot {slotNumber}</span>
      </div>
    )
  }

  const compatibleWeapons = weapons.filter(
    (w) => w.weaponType === character.weaponType,
  )

  return (
    <div className="flex-1 bg-gray-800 border border-gray-700 rounded p-3 space-y-1.5">
      <div className="text-xs font-semibold text-white mb-2">
        {character.name}
      </div>
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.weaponId ?? ''}
        onChange={(e) => onWeaponChange(Number(e.target.value))}
      >
        <option value="">— Weapon —</option>
        {compatibleWeapons.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.echoId ?? ''}
        onChange={(e) => onEchoChange(Number(e.target.value))}
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
        value={loadout.echoSetId ?? ''}
        onChange={(e) => onEchoSetChange(Number(e.target.value))}
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
