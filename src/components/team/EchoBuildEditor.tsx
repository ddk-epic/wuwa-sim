import type { Cost3Main, Cost4Main, EchoBuild } from "#/types/loadout"
import { listEchoes, listEchoSets } from "#/lib/loadout/catalog"
import { ECHO_BUILD_LAYOUT } from "#/lib/loadout/echo-stat-constants"
import {
  COST3_MAINS_DEFAULT,
  COST4_MAINS_DEFAULT,
} from "#/lib/loadout/template"
import { ELEMENT_HEX } from "#/data/elements"
import { useSlot } from "#/hooks/useTeamContext"
import { ComboboxSelect } from "#/components/team/TeamSlotControls"

const ECHO_BUILDS: EchoBuild[] = ["4-3-3-1-1", "4-4-1-1-1"]

const SCALING_LABEL: Record<"atk" | "hp" | "def", string> = {
  atk: "ATK%",
  hp: "HP%",
  def: "DEF%",
}

interface EchoBuildEditorProps {
  slotIndex: number
}

export function EchoBuildEditor({ slotIndex }: EchoBuildEditorProps) {
  const { character, loadout, setPatch } = useSlot(slotIndex)
  const hex = character ? (ELEMENT_HEX[character.element] ?? "#888") : "#888"
  const scaling = character?.primaryScalingStat ?? "atk"
  const scalingLabel = SCALING_LABEL[scaling]
  const layout = ECHO_BUILD_LAYOUT[loadout.echoBuild]
  const echoes = listEchoes()
  const echoSets = listEchoSets()
  const echo = echoes.find((e) => e.id === loadout.echoId) ?? null
  const set1 = echoSets.find((s) => s.id === loadout.echoSetSlot1Id) ?? null
  const set2 = echoSets.find((s) => s.id === loadout.echoSetSlot2Id) ?? null

  const cost4Options = [
    { value: "scaling" as Cost4Main, label: scalingLabel },
    { value: "cr" as Cost4Main, label: "CR" },
    { value: "cd" as Cost4Main, label: "CD" },
  ]
  const cost3Options = [
    { value: "scaling" as Cost3Main, label: scalingLabel },
    { value: "er" as Cost3Main, label: "ER" },
    { value: "elemDmg" as Cost3Main, label: "Ele DMG" },
  ]
  const cost1Options = [
    { value: "scaling", label: scalingLabel },
    { value: "hp", label: "HP%" },
    { value: "def", label: "DEF%" },
  ]

  function setBuild(b: EchoBuild) {
    setPatch({
      echoBuild: b,
      cost4Mains: COST4_MAINS_DEFAULT[b],
      cost3Mains: COST3_MAINS_DEFAULT[b],
    })
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <ComboboxSelect
          value={loadout.echoId}
          displayValue={echo?.name ?? null}
          placeholder="— Echo —"
          options={echoes.map((e) => ({ value: e.id, label: e.name }))}
          onChange={(echoId) => setPatch({ echoId })}
          hex={hex}
        />
        <div className="flex gap-1">
          <div className="flex-1 min-w-0">
            <ComboboxSelect
              value={loadout.echoSetSlot1Id}
              displayValue={set1?.name ?? null}
              placeholder="— Set 1 —"
              options={echoSets.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(id) => setPatch({ echoSetSlot1Id: id })}
              hex={hex}
            />
          </div>
          <div className="flex-1 min-w-0">
            <ComboboxSelect
              value={loadout.echoSetSlot2Id}
              displayValue={set2?.name ?? null}
              placeholder="— Set 2 —"
              options={echoSets.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(id) => setPatch({ echoSetSlot2Id: id })}
              hex={hex}
            />
          </div>
        </div>
      </div>
      <BuildToggle value={loadout.echoBuild} onChange={setBuild} hex={hex} />
      <div className="border border-border rounded-sm overflow-hidden divide-y divide-border">
        <TabularHeader />
        <TabularRow
          cost={4}
          capacity={layout.cost4}
          options={cost4Options}
          mains={loadout.cost4Mains}
          onChange={(m) => setPatch({ cost4Mains: m as Cost4Main[] })}
          hex={hex}
        />
        {layout.cost3 > 0 && (
          <TabularRow
            cost={3}
            capacity={layout.cost3}
            options={cost3Options}
            mains={loadout.cost3Mains}
            onChange={(m) => setPatch({ cost3Mains: m as Cost3Main[] })}
            hex={hex}
          />
        )}
        <TabularRow
          cost={1}
          capacity={layout.cost1}
          options={cost1Options}
          mains={Array<string>(layout.cost1).fill("scaling")}
          onChange={() => {}}
          hex={hex}
          disabled
        />
      </div>
    </div>
  )
}

function BuildToggle({
  value,
  onChange,
  hex,
}: {
  value: EchoBuild
  onChange: (b: EchoBuild) => void
  hex: string
}) {
  return (
    <div className="flex border border-border rounded-sm overflow-hidden">
      {ECHO_BUILDS.map((b) => {
        const active = b === value
        return (
          <button
            key={b}
            type="button"
            onClick={() => onChange(b)}
            className={[
              "flex-1 py-1 text-xs transition-colors tracking-wide",
              active
                ? ""
                : "bg-darkest text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={active ? { background: `${hex}43`, color: hex } : undefined}
          >
            {b}
          </button>
        )
      })}
    </div>
  )
}

function TabularHeader() {
  return (
    <div className="flex bg-darkest px-2 py-1 font-mono text-label uppercase tracking-[1.5px] text-muted-foreground/70">
      <div className="w-14">cost</div>
      <div className="flex-1">mainstat</div>
    </div>
  )
}

function TabularRow({
  cost,
  capacity,
  options,
  mains,
  onChange,
  hex,
  disabled,
}: {
  cost: number
  capacity: number
  options: { value: string; label: string }[]
  mains: string[]
  onChange: (mains: string[]) => void
  hex: string
  disabled?: boolean
}) {
  function click(v: string) {
    if (disabled) return
    onChange(mains.length < capacity ? [...mains, v] : [...mains.slice(1), v])
  }
  return (
    <div className="flex items-center px-2 py-1.5 bg-background">
      <div className="w-14 flex items-center gap-1.5">
        <span
          className="pl-0.75 font-mono text-sm font-semibold"
          style={{ color: disabled ? undefined : hex }}
        >
          {cost}
        </span>
        <span className="font-mono text-label uppercase tracking-[1px] text-muted-foreground/50">
          ×{capacity}
        </span>
      </div>
      <div className="flex-1 flex gap-1 flex-wrap">
        {options.map((o) => {
          const count = mains.filter((m) => m === o.value).length
          const active = count > 0
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              onClick={() => click(o.value)}
              className={[
                "min-w-14 px-1.5 py-0.5 rounded-sm text-xs tracking-wide flex items-center justify-center gap-1 transition-colors",
                disabled
                  ? "bg-darkest text-muted-foreground/40 cursor-not-allowed"
                  : active
                    ? ""
                    : "border-border bg-darkest text-muted-foreground hover:text-foreground hover:border-foreground/40",
              ].join(" ")}
              style={
                active
                  ? {
                      background: `${hex}43`,
                      borderColor: `${hex}80`,
                      color: hex,
                    }
                  : undefined
              }
            >
              <span>{o.label}</span>
              {count > 1 && (
                <span className="font-mono text-xs opacity-80">×{count}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
