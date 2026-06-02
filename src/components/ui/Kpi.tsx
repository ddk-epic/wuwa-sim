/** A label-over-value stat readout, optionally large with a unit suffix. */
export function Kpi({
  label,
  value,
  accent,
  big,
  suffix,
}: {
  label: string
  value: string | number
  accent?: string
  big?: boolean
  suffix?: string
}) {
  return (
    <div className="flex flex-col gap-0.75 min-w-0">
      <span className="text-[9px] text-muted font-mono tracking-px uppercase">
        {label}
      </span>
      <span
        style={{
          fontSize: big ? 22 : 14,
          color: accent ?? "var(--foreground)",
          letterSpacing: -0.4,
        }}
        className="font-semibold font-mono tabular-nums leading-none"
      >
        {value}
        {suffix && (
          <span
            style={{ fontSize: big ? 12 : 10 }}
            className="text-muted ml-0.75 font-medium"
          >
            {suffix}
          </span>
        )}
      </span>
    </div>
  )
}
