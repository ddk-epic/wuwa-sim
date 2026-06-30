import { Fragment } from "react"
import type { CSSProperties } from "react"
import { CharacterPortrait } from "#/components/ui/CharacterPortrait"
import { characterVisual } from "#/components/ui/character-visual"
import { getCharacterById } from "#/lib/loadout/catalog"
import type { RotationCard, RotationCards } from "#/lib/share/rotation-cards"
import type { Slots } from "#/types/loadout"

export type ShareTheme = "dark" | "light"

interface ShareCardProps {
  cards: RotationCards
  slots: Slots
  /** Appended to the title as `{seconds}s` when set; omitted otherwise. */
  seconds?: number
  theme: ShareTheme
}

const CARD_WIDTH = 1152
const STINT_HEIGHT = 60
const ROW_GAP = 8
// Section bar floors at two stint-rows, then stretches as the section wraps.
const ROW_MIN_HEIGHT = 2 * STINT_HEIGHT + 1 * ROW_GAP
const TIP_DEPTH = 12

interface Palette {
  shellBg: string
  stintBg: string
  glyphColor: string
  arrowColor: string
  labelBarBg: string
  labelBarText: string
  dividerLine: string
  stintBorder?: string
}

const DARK: Palette = {
  shellBg: "#0a0d12",
  stintBg: "#222b39",
  glyphColor: "#f5f7fa",
  arrowColor: "#8b95a7",
  labelBarBg: "#222b39",
  labelBarText: "#8b95a7",
  dividerLine: "#3a4458",
}

const LIGHT: Palette = {
  shellBg: "#eef1f5",
  stintBg: "#ffffff",
  glyphColor: "#1b2430",
  arrowColor: "#5b6573",
  labelBarBg: "#181d26",
  labelBarText: "#eef1f5",
  dividerLine: "#c4cad3",
  stintBorder: "#c4cad3",
}

function cardHeading(slots: Slots, seconds?: number): string {
  const names = slots
    .filter((id): id is number => id !== null)
    .map((id) => getCharacterById(id)?.name ?? `#${id}`)
    .join(" / ")
  return seconds === undefined ? names : `${names} ${Math.round(seconds)}s`
}

// Element diamond with "IN" inlaid upright.
function IntroDiamond({ hex, size }: { hex: string; size: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-label="intro"
    >
      <span
        className="absolute inset-0 rotate-45 rounded-[3px]"
        style={{ background: hex }}
      />
      <span
        className="relative font-mono text-sm font-black leading-none"
        style={{ color: "#0a0b0d" }}
      >
        IN
      </span>
    </span>
  )
}

// Vertical strip tapered to a pen-nib point. Clip lives on the un-rotated
// wrapper so the inner text rotation doesn't flip the point's direction.
function SectionBar({
  children,
  tip,
  palette,
}: {
  children: React.ReactNode
  tip: "bottom" | "both"
  palette: Palette
}) {
  const clipPath =
    tip === "both"
      ? `polygon(50% 0, 100% ${TIP_DEPTH}px, 100% calc(100% - ${TIP_DEPTH}px), 50% 100%, 0 calc(100% - ${TIP_DEPTH}px), 0 ${TIP_DEPTH}px)`
      : `polygon(0 0, 100% 0, 100% calc(100% - ${TIP_DEPTH}px), 50% 100%, 0 calc(100% - ${TIP_DEPTH}px))`
  return (
    <div
      className="flex shrink-0 items-center justify-center px-1.5"
      style={{
        clipPath,
        background: palette.labelBarBg,
        paddingTop: tip === "both" ? TIP_DEPTH + 8 : 8,
        paddingBottom: TIP_DEPTH + 8,
      }}
    >
      <span
        className="font-semibold uppercase tracking-widest"
        style={{
          color: palette.labelBarText,
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
        }}
      >
        {children}
      </span>
    </div>
  )
}

function StintCard({
  card,
  palette,
}: {
  card: RotationCard
  palette: Palette
}) {
  const visual = characterVisual(card.characterId)
  return (
    <div
      className="flex items-center overflow-hidden rounded-lg"
      style={{
        height: STINT_HEIGHT,
        // Element hue holds across the portrait, then fades into the card.
        background: `linear-gradient(to right, ${visual.hex}1f ${STINT_HEIGHT - 2}px, transparent ${STINT_HEIGHT + 6}px), ${palette.stintBg}`,
        borderColor: palette.stintBorder
          ? `${palette.stintBorder} ${palette.stintBorder} ${palette.stintBorder} ${visual.hex}`
          : visual.hex,
        borderStyle: "solid",
        borderWidth: palette.stintBorder
          ? "1px 1px 1px 3px"
          : "0px 0px 0px 3px",
      }}
    >
      <div className="aspect-square h-full shrink-0">
        <CharacterPortrait
          src={visual.portraitSrc}
          alt={visual.name}
          initial={visual.initial}
          hex={visual.hex}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex items-center gap-2 px-3">
        {card.hasIntro && <IntroDiamond hex={visual.hex} size={28} />}
        <span
          className="font-mono text-lg tracking-wide"
          style={{ color: palette.glyphColor }}
        >
          {card.letters}
        </span>
      </div>
    </div>
  )
}

function RotationRow({
  section,
  cards,
  tip,
  palette,
}: {
  section: string
  cards: RotationCard[]
  tip: "bottom" | "both"
  palette: Palette
}) {
  return (
    <div className="flex gap-3" style={{ minHeight: ROW_MIN_HEIGHT }}>
      <SectionBar tip={tip} palette={palette}>
        {section}
      </SectionBar>
      <div className="flex flex-1 flex-wrap content-start items-center gap-x-4 gap-y-4">
        {cards.map((card, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span
                className="text-4xl leading-none"
                style={{ color: palette.arrowColor }}
              >
                »
              </span>
            )}
            <StintCard card={card} palette={palette} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export function ShareCard({ cards, slots, seconds, theme }: ShareCardProps) {
  const palette = theme === "light" ? LIGHT : DARK
  const style: CSSProperties = {
    width: CARD_WIDTH,
    background: palette.shellBg,
  }
  return (
    <div className="inline-block p-5" style={style}>
      <div
        className="mb-4 text-2xl font-semibold"
        style={{ color: palette.glyphColor }}
      >
        {cardHeading(slots, seconds)}
      </div>
      <div className="flex flex-col gap-3">
        {cards.opener.length > 0 && (
          <RotationRow
            section="Opener"
            cards={cards.opener}
            tip="bottom"
            palette={palette}
          />
        )}
        {cards.opener.length > 0 && cards.loop.length > 0 && (
          <div
            className="flex items-center"
            style={{ height: STINT_HEIGHT * 0.6 }}
          >
            <div
              className="h-0.5 w-full"
              style={{
                background: `repeating-linear-gradient(to right, ${palette.dividerLine} 0 20px, transparent 20px 32px)`,
              }}
            />
          </div>
        )}
        {cards.loop.length > 0 && (
          <RotationRow
            section="Loop"
            cards={cards.loop}
            tip="both"
            palette={palette}
          />
        )}
      </div>
    </div>
  )
}
