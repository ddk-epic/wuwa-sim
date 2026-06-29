import { Fragment } from "react"
import { CharacterPortrait } from "#/components/ui/CharacterPortrait"
import { characterVisual } from "#/components/ui/character-visual"
import { getCharacterById } from "#/lib/loadout/catalog"
import type { RotationCard, RotationCards } from "#/lib/share/rotation-cards"
import type { Slots } from "#/types/loadout"

interface ShareCardProps {
  cards: RotationCards
  slots: Slots
}

const CARD_WIDTH = 720

function title(slots: Slots): string {
  return slots
    .filter((id): id is number => id !== null)
    .map((id) => getCharacterById(id)?.name ?? `#${id}`)
    .join(" / ")
}

function StintCard({ card }: { card: RotationCard }) {
  const visual = characterVisual(card.characterId)
  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-darkest px-2 py-1.5"
      style={{ borderColor: `${visual.hex}55` }}
    >
      <div
        className="h-9 w-9 shrink-0 overflow-hidden rounded-md"
        style={{ boxShadow: `0 0 0 1px ${visual.hex}88` }}
      >
        <CharacterPortrait
          src={visual.portraitSrc}
          alt={visual.name}
          initial={visual.initial}
          hex={visual.hex}
          className="h-full w-full object-cover"
        />
      </div>
      {card.hasIntro && (
        <span
          className="rounded-sm px-1 py-0.5 text-[10px] font-bold leading-none text-darkest"
          style={{ background: visual.hex }}
        >
          IN
        </span>
      )}
      <span className="font-mono text-lg font-semibold tracking-widest text-foreground">
        {card.letters}
      </span>
    </div>
  )
}

function RotationRow({
  label,
  cards,
}: {
  label: string
  cards: RotationCard[]
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 w-16 shrink-0 rounded-md bg-darkest py-1 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {cards.map((card, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="text-muted-foreground">»</span>}
            <StintCard card={card} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export function ShareCard({ cards, slots }: ShareCardProps) {
  return (
    <div
      className="inline-block rounded-xl bg-card p-5"
      style={{ width: CARD_WIDTH }}
    >
      <div className="mb-4 text-2xl font-semibold text-foreground">
        {title(slots)}
      </div>
      <div className="flex flex-col gap-3">
        <RotationRow label="Opener" cards={cards.opener} />
        {cards.loop.length > 0 && (
          <RotationRow label="Loop" cards={cards.loop} />
        )}
      </div>
    </div>
  )
}
