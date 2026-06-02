import type { LucideIcon } from "lucide-react"

export type IconBtnVariant = "default" | "accent" | "destructive"

const VARIANT_CLASS: Record<IconBtnVariant, string> = {
  default: "text-muted enabled:hover:text-foreground",
  accent: "text-blue-400 enabled:hover:text-blue-300",
  destructive: "text-muted enabled:hover:text-red-400",
}

/**
 * The universal icon-only button: one visual skeleton (default stroke weight,
 * rounded-sm, color transition). Only the box (size/w/h/className), `variant`,
 * and `disabled` are meant to vary per call. Stops click propagation so it
 * works inside clickable rows.
 */
export function IconBtn({
  icon: Icon,
  label,
  title,
  onClick,
  variant = "default",
  disabled = false,
  size = 16,
  w = 22,
  h = 22,
  className = "",
}: {
  icon: LucideIcon
  label: string
  /** Tooltip text; falls back to `label` when omitted. */
  title?: string
  onClick?: () => void
  variant?: IconBtnVariant
  disabled?: boolean
  size?: number
  w?: number
  h?: number
  className?: string
}) {
  return (
    <button
      title={title ?? label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      style={{ width: w, height: h }}
      className={`inline-flex items-center justify-center rounded-sm bg-transparent border-none p-0 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-default ${VARIANT_CLASS[variant]} ${className}`}
    >
      <Icon size={size} />
    </button>
  )
}
