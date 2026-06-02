import { elementHex } from "#/components/library/theme"

/** A small glowing element-colored dot. */
export function ElDot({
  element,
  size = 6,
}: {
  element: string
  size?: number
}) {
  const hex = elementHex(element)
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: hex,
        boxShadow: `0 0 6px ${hex}88`,
      }}
      className="inline-block shrink-0"
    />
  )
}
