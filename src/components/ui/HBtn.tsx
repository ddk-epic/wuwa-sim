import type { LucideIcon } from "lucide-react"

/** A header/toolbar button with optional leading icon, keyboard hint, and primary accent. */
export function HBtn({
  icon: Icon,
  label,
  primary,
  kbd,
  onClick,
}: {
  icon?: LucideIcon
  label: string
  primary?: boolean
  kbd?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`font-[inherit] text-[11px] px-2.5 py-1.25 pl-2 rounded-sm cursor-pointer whitespace-nowrap inline-flex items-center gap-1.25 border ${
        primary
          ? "bg-[#1a2c4a] text-ui-damage border-[#2a4575]"
          : "bg-transparent hover:bg-darkest text-muted hover:text-foreground border-border"
      }`}
    >
      {Icon && <Icon size={12} strokeWidth={1.5} />}
      <span>{label}</span>
      {kbd && (
        <kbd className="text-[9px] text-ui-damage ml-1 font-mono">{kbd}</kbd>
      )}
    </button>
  )
}
