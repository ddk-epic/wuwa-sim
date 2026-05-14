import type { Character } from "#/types/character"
import type {
  Cost3Main,
  Cost4Main,
  EchoBuild,
  Slots,
  SlotLoadout,
} from "#/types/loadout"
import {
  getCharacterById,
  listEchoes,
  listEchoSets,
  listWeaponsByType,
} from "#/lib/catalog"
import { ECHO_BUILD_LAYOUT } from "#/lib/echo-stat-constants"
import { COST3_MAINS_DEFAULT, COST4_MAINS_DEFAULT } from "#/lib/template"
import { SegmentedToggle } from "#/components/SegmentedToggle"
import { EchoMainsToggle } from "#/components/EchoMainsToggle"

const SEQUENCES: number[] = [0, 1, 2, 3, 4, 5, 6]
const RANKS: number[] = [1, 2, 3, 4, 5]
const ECHO_BUILDS: EchoBuild[] = ["4-3-3-1-1", "4-4-1-1-1"]

const SCALING_STAT_LABEL: Record<"atk" | "hp" | "def", string> = {
  atk: "ATK%",
  hp: "HP%",
  def: "DEF%",
}

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

function SectionDivider() {
  return <hr className="border-gray-700 my-1" />
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
  const scalingStat = character.primaryScalingStat ?? "atk"
  const layout = ECHO_BUILD_LAYOUT[loadout.echoBuild]
  const scalingLabel = SCALING_STAT_LABEL[scalingStat]

  const cost4Options = [
    { value: "scaling", label: scalingLabel },
    { value: "cr", label: "CR" },
    { value: "cd", label: "CD" },
  ]

  const cost3Options = [
    { value: "scaling", label: scalingLabel },
    { value: "er", label: "ER" },
    { value: "elemDmg", label: "Elem DMG" },
  ]

  function handleBuildChange(echoBuild: EchoBuild) {
    onSlotChange({
      echoBuild,
      cost4Mains: COST4_MAINS_DEFAULT[echoBuild],
      cost3Mains: COST3_MAINS_DEFAULT[echoBuild],
    })
  }

  return (
    <div className="flex-1 bg-gray-800 border border-gray-700 rounded p-3 space-y-1.5">
      <div className="text-xs font-semibold text-white mb-2">
        {character.name}
      </div>

      {/* Sequence domain */}
      <SegmentedToggle
        options={SEQUENCES}
        value={loadout.sequence}
        onChange={(sequence) => onSlotChange({ sequence })}
        label={(v) => `S${v}`}
      />

      <SectionDivider />

      {/* Weapon domain */}
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

      <SectionDivider />

      {/* Echo domain */}
      <SegmentedToggle
        options={ECHO_BUILDS}
        value={loadout.echoBuild}
        onChange={handleBuildChange}
      />
      <EchoMainsToggle
        options={cost4Options}
        mains={loadout.cost4Mains}
        capacity={layout.cost4}
        onChange={(mains) => onSlotChange({ cost4Mains: mains as Cost4Main[] })}
      />
      {layout.cost3 > 0 && (
        <EchoMainsToggle
          options={cost3Options}
          mains={loadout.cost3Mains}
          capacity={layout.cost3}
          onChange={(mains) =>
            onSlotChange({ cost3Mains: mains as Cost3Main[] })
          }
        />
      )}
      <div className="text-xs text-gray-400 text-center">
        {scalingLabel} ×{layout.cost1}
      </div>
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
        value={loadout.echoSetSlot1Id ?? ""}
        onChange={(e) =>
          onSlotChange({
            echoSetSlot1Id:
              e.target.value === "" ? null : Number(e.target.value),
          })
        }
      >
        <option value="">— Echo Set 1 —</option>
        {echoSets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.echoSetSlot2Id ?? ""}
        onChange={(e) =>
          onSlotChange({
            echoSetSlot2Id:
              e.target.value === "" ? null : Number(e.target.value),
          })
        }
      >
        <option value="">— Echo Set 2 —</option>
        {echoSets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )
}
