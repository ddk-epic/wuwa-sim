import type { CSSProperties } from "react"

interface CharacterPortraitProps {
  src: string
  alt: string
  initial: string
  hex: string
  className?: string
  style?: CSSProperties
}

function fallbackSrc(initial: string, hex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${hex}"/><text x="50" y="50" font-family="sans-serif" font-size="44" font-weight="600" fill="#0a0b0d" text-anchor="middle" dominant-baseline="central">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function CharacterPortrait({
  src,
  alt,
  initial,
  hex,
  className,
  style,
}: CharacterPortraitProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = fallbackSrc(initial, hex)
      }}
    />
  )
}
