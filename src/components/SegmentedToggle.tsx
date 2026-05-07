interface SegmentedToggleProps<T extends string | number> {
  options: T[]
  value: T
  onChange: (v: T) => void
  label?: (v: T) => string
  disabled?: boolean
}

export function SegmentedToggle<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled = false,
}: SegmentedToggleProps<T>) {
  return (
    <div className="flex gap-0.5">
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={[
              "flex-1 py-0.5 text-xs rounded leading-none transition-colors",
              disabled
                ? "opacity-40 cursor-not-allowed bg-gray-700 text-gray-400"
                : active
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600",
            ].join(" ")}
          >
            {label ? label(opt) : String(opt)}
          </button>
        )
      })}
    </div>
  )
}
