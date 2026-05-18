import type { Slots, SlotLoadout } from "#/types/loadout"
import { CharacterGrid } from "#/components/CharacterGrid"
import { TeamPanel } from "#/components/TeamPanel"
import { Modal } from "#/components/Modal"

interface TeamModalProps {
  slots: Slots
  loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
  focusedId: number | null
  selectedCount: number
  onToggle: (characterId: number) => void
  onSlotChange: (slotIndex: number, patch: Partial<SlotLoadout>) => void
  onClose: () => void
}

export function TeamModal({
  slots,
  loadouts,
  focusedId,
  selectedCount,
  onToggle,
  onSlotChange,
  onClose,
}: TeamModalProps) {
  return (
    <Modal
      onClose={onClose}
      variant="fullscreen"
      title="Team Builder"
      subtitle={`${selectedCount}/3 selected`}
    >
      <div className="flex-1 overflow-y-auto p-6">
        <CharacterGrid
          slots={slots}
          focusedId={focusedId}
          onToggle={onToggle}
        />
      </div>
      <div className="border-t border-gray-700 p-4 shrink-0">
        <TeamPanel
          slots={slots}
          loadouts={loadouts}
          onSlotChange={onSlotChange}
        />
      </div>
    </Modal>
  )
}
