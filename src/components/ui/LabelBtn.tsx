import type { LucideIcon } from "lucide-react"

/** A button with a visible text label (plus optional icon, keyboard hint, and primary accent). The labeled counterpart to IconBtn. */
export function LabelBtn({
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
      className={`font-mono text-sm px-2.5 py-1.25 rounded-sm cursor-pointer whitespace-nowrap inline-flex items-center gap-1 border ${
        primary
          ? "bg-[#1a2c4a] text-ui-damage border-[#2a4575] hover:brightness-110"
          : "bg-transparent hover:bg-darkest text-muted-foreground hover:text-foreground border-border"
      }`}
    >
      {Icon && <Icon className="w-4 h-4" strokeWidth={1.5} />}
      <span>{label}</span>
      {kbd && (
        <kbd className="text-micro text-ui-damage ml-1 font-mono">{kbd}</kbd>
      )}
    </button>
  )
}
