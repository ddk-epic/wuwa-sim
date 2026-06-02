import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

interface StepperProps<T extends string | number> {
  options: T[]
  value: T
  onChange: (v: T) => void
  label?: (v: T) => string
  disabled?: boolean
  /** Accent color for the value readout. Omit for inherited foreground. */
  hex?: string
  dense?: boolean
  /**
   * Whether the ends cycle. `true` (default) makes "+" past the last option
   * wrap to the first (S0↔S6 pickers). `false` clamps at the ends — the right
   * behavior for a bounded setting, where "+" past max must not zero out.
   */
  wrap?: boolean
}

export function Stepper<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled,
  hex,
  dense,
  wrap = true,
}: StepperProps<T>) {
  const idx = options.findIndex((o) => o === value)
  function step(delta: number) {
    if (disabled || options.length === 0) return
    const len = options.length
    const nextIdx = wrap
      ? (((idx + delta) % len) + len) % len
      : Math.min(len - 1, Math.max(0, idx + delta))
    const next = options[nextIdx]
    if (next !== value) onChange(next)
  }
  return (
    <div
      className={[
        "flex items-stretch border border-border rounded-sm bg-darkest h-7",
        disabled ? "opacity-40" : "",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => step(-1)}
        className="px-1.5 text-muted-foreground enabled:hover:text-foreground disabled:opacity-30"
        aria-label="Decrement"
      >
        <ChevronLeftIcon className="w-3 h-3" />
      </button>
      <div
        className="flex-1 flex items-center justify-center font-mono text-[18px] -mb-px"
        style={{ color: disabled ? undefined : hex }}
      >
        {label ? label(value) : String(value)}
      </div>
      {!dense && (
        <div className="px-2 flex items-center font-mono text-xs uppercase tracking-[1px] text-muted-foreground/50">
          {idx + 1}/{options.length}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => step(1)}
        className="px-1.5 text-muted-foreground enabled:hover:text-foreground disabled:opacity-30"
        aria-label="Increment"
      >
        <ChevronRightIcon className="w-3 h-3" />
      </button>
    </div>
  )
}
