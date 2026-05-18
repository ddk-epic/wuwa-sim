import type {
  Cost3Main,
  Cost4Main,
  EchoBuild,
  SlotLoadout,
} from "#/types/loadout"
import { listEchoes, listEchoSets } from "#/lib/catalog"
import { ECHO_BUILD_LAYOUT } from "#/lib/echo-stat-constants"
import { COST3_MAINS_DEFAULT, COST4_MAINS_DEFAULT } from "#/lib/template"
import { SegmentedToggle } from "#/components/SegmentedToggle"
import { EchoMainsToggle } from "#/components/EchoMainsToggle"

const ECHO_BUILDS: EchoBuild[] = ["4-3-3-1-1", "4-4-1-1-1"]

const SCALING_STAT_LABEL: Record<"atk" | "hp" | "def", string> = {
  atk: "ATK%",
  hp: "HP%",
  def: "DEF%",
}

interface EchoBuildEditorProps {
  scalingStat: "atk" | "hp" | "def"
  loadout: SlotLoadout
  onChange: (patch: Partial<SlotLoadout>) => void
}

export function EchoBuildEditor({
  scalingStat,
  loadout,
  onChange,
}: EchoBuildEditorProps) {
  const echoes = listEchoes()
  const echoSets = listEchoSets()
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

  const cost1Options = [
    { value: "scaling", label: scalingLabel },
    { value: "hp", label: "HP%" },
    { value: "def", label: "DEF%" },
  ]

  function handleBuildChange(echoBuild: EchoBuild) {
    onChange({
      echoBuild,
      cost4Mains: COST4_MAINS_DEFAULT[echoBuild],
      cost3Mains: COST3_MAINS_DEFAULT[echoBuild],
    })
  }

  return (
    <div className="space-y-1.5">
      <SegmentedToggle
        options={ECHO_BUILDS}
        value={loadout.echoBuild}
        onChange={handleBuildChange}
      />
      <EchoMainsToggle
        options={cost4Options}
        mains={loadout.cost4Mains}
        capacity={layout.cost4}
        onChange={(mains) => onChange({ cost4Mains: mains as Cost4Main[] })}
      />
      {layout.cost3 > 0 && (
        <EchoMainsToggle
          options={cost3Options}
          mains={loadout.cost3Mains}
          capacity={layout.cost3}
          onChange={(mains) => onChange({ cost3Mains: mains as Cost3Main[] })}
        />
      )}
      <EchoMainsToggle
        options={cost1Options}
        mains={Array<string>(layout.cost1).fill("scaling")}
        capacity={layout.cost1}
        disabled
        onChange={() => {}}
      />
      <div>
        <select
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
          value={loadout.echoId ?? ""}
          onChange={(e) => onChange({ echoId: Number(e.target.value) })}
        >
          <option value="">— Echo —</option>
          {echoes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.echoSetSlot1Id ?? ""}
        onChange={(e) =>
          onChange({
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
          onChange({
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
