import type { Character } from '#/types/character'
import type { Weapon } from '#/types/weapon'
import type { Echo, EchoSet } from '#/types/echo'
import type { Slots, SlotLoadout } from '#/types/loadout'
import { CharacterGrid } from '#/components/CharacterGrid'
import { TeamPanel } from '#/components/TeamPanel'

interface TeamModalProps {
  slots: Slots
  loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
  focusedId: number | null
  selectedCount: number
  characters: Character[]
  weapons: Weapon[]
  echoes: Echo[]
  echoSets: EchoSet[]
  onToggle: (characterId: number) => void
  onWeaponChange: (slotIndex: number, weaponId: number) => void
  onEchoChange: (slotIndex: number, echoId: number) => void
  onEchoSetChange: (slotIndex: number, echoSetId: number) => void
  onClose: () => void
}

export function TeamModal({
  slots,
  loadouts,
  focusedId,
  selectedCount,
  characters,
  weapons,
  echoes,
  echoSets,
  onToggle,
  onWeaponChange,
  onEchoChange,
  onEchoSetChange,
  onClose,
}: TeamModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-gray-900 rounded-lg border border-gray-700 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold">Team Builder</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              {selectedCount}/3 selected
            </p>
          </div>
          <button
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <CharacterGrid
            characters={characters}
            slots={slots}
            focusedId={focusedId}
            onToggle={onToggle}
          />
        </div>
        <div className="border-t border-gray-700 p-4 shrink-0">
          <TeamPanel
            slots={slots}
            loadouts={loadouts}
            characters={characters}
            weapons={weapons}
            echoes={echoes}
            echoSets={echoSets}
            onWeaponChange={onWeaponChange}
            onEchoChange={onEchoChange}
            onEchoSetChange={onEchoSetChange}
          />
        </div>
      </div>
    </div>
  )
}
