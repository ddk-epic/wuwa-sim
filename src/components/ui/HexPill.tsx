import type { ReactNode } from "react"

/**
 * An accent-tinted uppercase pill: faint hex background, a slightly stronger
 * hex border, and hex-colored text. Callers supply only the accent and label.
 */
export function HexPill({
  hex,
  children,
}: {
  hex: string
  children: ReactNode
}) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase"
      style={{
        background: `${hex}15`,
        border: `1px solid ${hex}33`,
        color: hex,
      }}
    >
      {children}
    </span>
  )
}
