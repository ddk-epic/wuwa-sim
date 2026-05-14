interface ToggleOption {
  value: string
  label: string
}

interface EchoMainsToggleProps {
  options: ToggleOption[]
  mains: string[]
  capacity: number
  onChange: (mains: string[]) => void
}

export function EchoMainsToggle({
  options,
  mains,
  capacity,
  onChange,
}: EchoMainsToggleProps) {
  function handleClick(value: string) {
    const next =
      mains.length < capacity ? [...mains, value] : [...mains.slice(1), value]
    onChange(next)
  }

  return (
    <div className="flex gap-0.5">
      {options.map((opt) => {
        const count = mains.filter((m) => m === opt.value).length
        const active = count > 0
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleClick(opt.value)}
            className={[
              "flex-1 py-0.5 text-xs rounded leading-none transition-colors flex items-center justify-center gap-0.5",
              active
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600",
            ].join(" ")}
          >
            {opt.label}
            {count > 1 && (
              <span className="text-[10px] opacity-80">×{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
