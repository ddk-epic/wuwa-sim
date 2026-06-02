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
      <span className="text-micro text-muted font-mono tracking-[1px] uppercase">
        {label}
      </span>
      <span
        style={{
          color: accent ?? "var(--foreground)",
          letterSpacing: -0.4,
        }}
        className={`font-semibold font-mono tabular-nums leading-none ${
          big ? "text-title" : "text-base"
        }`}
      >
        {value}
        {suffix && (
          <span
            className={`text-muted ml-0.75 font-medium ${
              big ? "text-sm" : "text-detail"
            }`}
          >
            {suffix}
          </span>
        )}
      </span>
    </div>
  )
}
