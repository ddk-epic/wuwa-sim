import type { EnrichedCharacter } from "#/types/character"
import { CharacterPortrait } from "#/components/ui/CharacterPortrait"
import { portraitSrc, nameInitial } from "#/components/ui/character-visual"

interface TeamSlotPortraitProps {
  character: EnrichedCharacter
  hex: string
  slotIndex: number
  sequenceStepper?: React.ReactNode
}

export function TeamSlotPortrait({
  character,
  hex,
  slotIndex,
  sequenceStepper,
}: TeamSlotPortraitProps) {
  return (
    <div className="relative aspect-4/3 w-full bg-darkest overflow-hidden">
      <CharacterPortrait
        src={portraitSrc(character.name)}
        alt={character.name}
        initial={nameInitial(character.name)}
        hex={hex}
        className="absolute inset-0 w-full h-full object-contain pt-2"
        style={{ objectPosition: "center 50%" }}
      />
      <div className="absolute top-2 right-2 px-1.5 pb-0.5 bg-darkest/80 rounded-sm">
        <span className="font-mono uppercase tracking-[1.5px] text-muted-foreground/30">
          slot {slotIndex + 1}
        </span>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 px-3 pt-10 pb-2 flex items-end gap-2"
        style={{
          background:
            "linear-gradient(to top, rgba(9,10,14,0.98) 0%, rgba(9,10,14,0) 100%)",
        }}
      >
        <div className="flex-1 min-w-0">
          <div
            className="font-mono text-micro uppercase tracking-[2px] leading-tight"
            style={{ color: hex }}
          >
            {character.element}
          </div>
          <div className="font-semibold text-foreground leading-tight truncate tracking-tight mt-0.5">
            {character.name}
          </div>
        </div>
        {sequenceStepper && (
          <div className="w-18 shrink-0">{sequenceStepper}</div>
        )}
      </div>
    </div>
  )
}
