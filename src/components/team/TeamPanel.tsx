import { UsersRoundIcon, SwordsIcon } from "lucide-react"
import { listWeaponsByType } from "#/lib/loadout/catalog"
import { elementHex } from "#/components/ui/character-visual"
import { useSlot, useTeamContext } from "#/hooks/useTeamContext"
import { EchoBuildEditor } from "#/components/team/EchoBuildEditor"
import { TeamSlotPortrait } from "#/components/team/TeamSlotPortrait"
import { ComboboxSelect } from "#/components/team/TeamSlotControls"
import { Stepper } from "#/components/ui/Stepper"

const SEQUENCES: number[] = [0, 1, 2, 3, 4, 5, 6]
const RANKS: number[] = [1, 2, 3, 4, 5]

export function TeamPanel() {
  const { slots } = useTeamContext()
  return (
    <div className="flex gap-3">
      {slots.map((_, i) => (
        <div key={i} className="flex-1 min-w-0">
          <SlotCard slotIndex={i} />
        </div>
      ))}
    </div>
  )
}

function SlotCard({ slotIndex }: { slotIndex: number }) {
  const { character, loadout, setPatch } = useSlot(slotIndex)

  if (character === null) {
    return (
      <div className="space-y-2 font-mono uppercase tracking-[1.5px] text-muted">
        <div className="aspect-4/3 rounded-t-xl bg-darkest flex items-center justify-center">
          slot {slotIndex + 1}
        </div>
        <div className="h-82 rounded-b-xl bg-darkest flex flex-1 items-center justify-center">
          empty
        </div>
      </div>
    )
  }

  const hex = elementHex(character.element)
  const compatibleWeapons = listWeaponsByType(character.weaponType)
  const weapon =
    compatibleWeapons.find((w) => w.id === loadout.weaponId) ?? null

  return (
    <div className="overflow-hidden rounded-t-xl">
      <TeamSlotPortrait
        character={character}
        hex={hex}
        slotIndex={slotIndex}
        sequenceStepper={
          <Stepper
            options={SEQUENCES}
            value={loadout.sequence}
            onChange={(sequence) => setPatch({ sequence })}
            label={(v) => `S${v}`}
            hex={hex}
            dense
          />
        }
      />

      <DomainSection
        icon={<SwordsIcon className="w-3 h-3" />}
        label={character.weaponType}
      >
        <div className="flex items-stretch gap-1">
          <div className="flex-1 min-w-0">
            <ComboboxSelect
              value={loadout.weaponId}
              displayValue={weapon?.name ?? null}
              placeholder="— Weapon —"
              options={compatibleWeapons.map((w) => ({
                value: w.id,
                label: w.name,
              }))}
              onChange={(weaponId) => setPatch({ weaponId })}
              hex={hex}
            />
          </div>
          <div className="w-18 shrink-0">
            <Stepper
              options={RANKS}
              value={loadout.weaponRank}
              onChange={(weaponRank) => setPatch({ weaponRank })}
              label={(v) => `R${v}`}
              disabled={loadout.weaponId === null}
              hex={hex}
              dense
            />
          </div>
        </div>
      </DomainSection>

      <DomainSection icon={<UsersRoundIcon className="w-3 h-3" />} label="echo">
        <EchoBuildEditor slotIndex={slotIndex} />
      </DomainSection>
    </div>
  )
}

// "Melted" domain section
function DomainSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-2 mb-2 overflow-hidden bg-darkest">
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-muted-foreground">
        {icon}
        <span className="font-mono text-label uppercase tracking-[1.5px]">
          {label}
        </span>
      </div>
      <div
        className="px-3 pb-1 pt-1"
        style={{
          background:
            "linear-gradient(to bottom, var(--color-darkest, var(--color-bg-fallback)) 0px, var(--color-card, var(--color-bg-fallback-card)) 80%)",
        }}
      >
        {children}
      </div>
    </div>
  )
}
