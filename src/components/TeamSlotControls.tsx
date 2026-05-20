import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

interface StepperProps<T extends string | number> {
  options: T[]
  value: T
  onChange: (v: T) => void
  label?: (v: T) => string
  disabled?: boolean
  hex: string
  dense?: boolean
}

export function Stepper<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled,
  hex,
  dense,
}: StepperProps<T>) {
  const idx = options.findIndex((o) => o === value)
  function step(delta: number) {
    if (disabled || options.length === 0) return
    const len = options.length
    const nextIdx = (((idx + delta) % len) + len) % len
    const next = options[nextIdx]
    if (next !== undefined && next !== value) onChange(next)
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
        className="flex-1 flex items-center justify-center font-mono text-[16px] -mb-px"
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

interface ComboboxProps {
  value: number | null
  displayValue: string | null
  placeholder: string
  options: { value: number; label: string }[]
  onChange: (v: number) => void
  hex: string
}

export function ComboboxSelect({
  value,
  placeholder,
  options,
  onChange,
  hex,
}: ComboboxProps) {
  return (
    <div className="relative h-7">
      <select
        className="w-full h-full appearance-none bg-darkest border border-border rounded-sm pl-2 pr-7 py-0 text-[16px] text-foreground cursor-pointer hover:border-foreground/40 transition-colors truncate"
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          borderLeftColor: value !== null ? hex : undefined,
          borderLeftWidth: value !== null ? 2 : 1,
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
    </div>
  )
}
