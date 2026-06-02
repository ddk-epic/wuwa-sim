import { ChevronDownIcon } from "lucide-react"

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
        className="w-full h-full appearance-none bg-darkest border border-border rounded-sm pl-2 pr-7 py-0 text-sm text-foreground cursor-pointer hover:border-foreground/40 transition-colors truncate"
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
