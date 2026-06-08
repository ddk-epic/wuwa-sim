import { CharacterPortrait } from "#/components/ui/CharacterPortrait"
import {
  elementHex,
  portraitSrc,
  nameInitial,
} from "#/components/ui/character-visual"
import type { Member } from "./types"

export function ElementAvatar({
  member,
  size = 26,
  dim,
  grayscale,
}: {
  member: Member
  size?: number
  dim?: boolean
  grayscale?: boolean
}) {
  const hex = elementHex(member.element)
  const ring = `0 0 0 1px ${hex}88, 0 1px 3px rgba(0,0,0,.4)`
  return (
    <div
      title={`${member.name} · ${member.element}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `radial-gradient(circle, ${hex}33, var(--card))`,
        boxShadow: ring,
        opacity: dim ? 0.4 : 1,
      }}
      className="shrink-0 overflow-hidden relative"
    >
      <CharacterPortrait
        src={portraitSrc(member.name)}
        alt={member.name}
        initial={nameInitial(member.name)}
        hex={hex}
        style={{
          filter: grayscale
            ? "grayscale(1) contrast(1.05) brightness(1.05)"
            : "none",
        }}
        className="absolute left-[4%] top-[-4%] w-[116%] h-[116%] object-cover object-center"
      />
    </div>
  )
}

export function PortraitStrip({
  members,
  fade = 0.4,
  portraitW = 150,
  portraitH = 150,
  gap = 24,
  leftOffset = 10,
  stripWidth = 540,
  maskStart = 62,
  maskEnd = 96,
  vOffset = 0,
}: {
  members: Member[]
  fade?: number
  portraitW?: number
  portraitH?: number
  gap?: number
  leftOffset?: number
  stripWidth?: number
  maskStart?: number
  maskEnd?: number
  vOffset?: number
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        height: "100%",
        width: stripWidth,
        overflow: "hidden",
        maskImage: `linear-gradient(to right, black 0%, black ${maskStart}%, transparent ${maskEnd}%)`,
        WebkitMaskImage: `linear-gradient(to right, black 0%, black ${maskStart}%, transparent ${maskEnd}%)`,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {members.map((m, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: leftOffset + i * (portraitW + gap),
            top: `calc(50% + ${vOffset}px)`,
            transform: "translateY(-50%)",
            width: portraitW,
            height: portraitH,
            opacity: fade,
          }}
        >
          <CharacterPortrait
            src={portraitSrc(m.name)}
            alt=""
            initial={nameInitial(m.name)}
            hex={elementHex(m.element)}
            className="w-full h-full object-cover object-[center_22%] block"
          />
        </div>
      ))}
    </div>
  )
}
