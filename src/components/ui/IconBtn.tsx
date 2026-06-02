import type { LucideIcon } from "lucide-react"

/** A borderless square icon button; stops click propagation so it works inside rows. */
export function IconBtn({
  icon: Icon,
  label,
  onClick,
  size = 13,
  w = 22,
  h = 22,
  className = "",
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  size?: number
  w?: number
  h?: number
  className?: string
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      style={{ width: w, height: h }}
      className={`inline-flex items-center justify-center rounded-sm bg-transparent border-none p-0 cursor-pointer text-muted hover:text-foreground ${className}`}
    >
      <Icon size={size} strokeWidth={1.5} />
    </button>
  )
}
