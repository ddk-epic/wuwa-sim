export type ResourceValueKind = "concerto" | "energy"

/** Fixed pill fill (the resource's hue) and the contrasting text color over it. */
const RESOURCE_STYLES: Record<
  ResourceValueKind,
  { fill: string; text: string }
> = {
  concerto: { fill: "var(--ui-concerto)", text: "var(--darkest)" },
  energy: { fill: "var(--ui-resonance)", text: "var(--foreground)" },
}

interface ResourceValueProps {
  value: number | null
  resource: ResourceValueKind
  threshold: number
}

/**
 * Concerto/energy resource value: em-dash when null, muted 0, else the resource
 * hue. At or over `threshold` it renders as a solid resource-hued pill — the cue
 * that the acting character is outro-ready (concerto) or liberation-ready (energy).
 */
export function ResourceValue({
  value,
  resource,
  threshold,
}: ResourceValueProps) {
  if (value === null) return <span className="text-ui-zero">—</span>
  if (value === 0) return <span className="text-ui-zero">0</span>
  const { fill, text } = RESOURCE_STYLES[resource]
  if (value >= threshold) {
    return (
      <span
        className="font-medium rounded px-1"
        style={{ backgroundColor: fill, color: text }}
      >
        {value.toFixed(1)}
      </span>
    )
  }
  return (
    <span className="font-medium" style={{ color: fill }}>
      {value.toFixed(1)}
    </span>
  )
}
