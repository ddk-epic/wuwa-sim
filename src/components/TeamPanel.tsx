import { listWeaponsByType } from "#/lib/catalog"
import { useTeamContext, useSlot } from "#/hooks/useTeamContext"
import { SegmentedToggle } from "#/components/SegmentedToggle"
import { EchoBuildEditor } from "#/components/EchoBuildEditor"

const SEQUENCES: number[] = [0, 1, 2, 3, 4, 5, 6]
const RANKS: number[] = [1, 2, 3, 4, 5]

export function TeamPanel() {
  const { slots } = useTeamContext()
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Team
      </p>
      <div className="flex gap-3">
        {slots.map((_, i) => (
          <TeamSlot key={i} slotIndex={i} />
        ))}
      </div>
    </div>
  )
}

interface TeamSlotProps {
  slotIndex: number
}

function SectionDivider() {
  return <hr className="border-gray-700" />
}

function TeamSlot({ slotIndex }: TeamSlotProps) {
  const { character, loadout, setPatch } = useSlot(slotIndex)

  if (character === null) {
    return (
      <div className="flex-1 border border-dashed border-gray-700 rounded p-3 flex items-center justify-center min-h-22">
        <span className="text-gray-600 text-xs">Slot {slotIndex + 1}</span>
      </div>
    )
  }

  const compatibleWeapons = listWeaponsByType(character.weaponType)

  return (
    <div className="flex-1 bg-gray-800 border border-gray-700 rounded p-3 space-y-4">
      <div className="text-xs font-semibold text-white mb-2">
        {character.name}
      </div>

      {/* Sequence domain */}
      <SegmentedToggle
        options={SEQUENCES}
        value={loadout.sequence}
        onChange={(sequence) => setPatch({ sequence })}
        label={(v) => `S${v}`}
      />

      <SectionDivider />

      {/* Weapon domain */}
      <div className="space-y-1.5">
        <select
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
          value={loadout.weaponId ?? ""}
          onChange={(e) => setPatch({ weaponId: Number(e.target.value) })}
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
          onChange={(weaponRank) => setPatch({ weaponRank })}
          label={(v) => `R${v}`}
          disabled={loadout.weaponId === null}
        />
      </div>

      <SectionDivider />

      {/* Echo domain */}
      <EchoBuildEditor slotIndex={slotIndex} />
    </div>
  )
}
