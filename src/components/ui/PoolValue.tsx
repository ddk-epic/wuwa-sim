interface PoolValueProps {
  value: number | null
  color: string
}

/** Concerto/energy pool value: em-dash when null, muted 0, bold at/over 100, else medium. */
export function PoolValue({ value, color }: PoolValueProps) {
  if (value === null) return <span className="text-ui-zero">—</span>
  if (value === 0) return <span className="text-ui-zero">0</span>
  return (
    <span
      className={value >= 100 ? "font-bold" : "font-medium"}
      style={{ color }}
    >
      {value.toFixed(1)}
    </span>
  )
}
