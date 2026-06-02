import type { ReactNode } from "react"

/** A titled bordered panel with an optional subtitle. */
export function Card({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children: ReactNode
}) {
  return (
    <div className="border border-border rounded-sm bg-card flex flex-col min-w-0">
      <div className="px-3.5 py-2.5 border-b border-border flex items-baseline gap-3">
        <span className="text-base font-semibold text-foreground tracking-[0.2px]">
          {title}
        </span>
        {sub && (
          <span className="text-detail text-muted font-mono tracking-[0.4px]">
            {sub}
          </span>
        )}
      </div>
      <div className="p-3.5 min-w-0">{children}</div>
    </div>
  )
}
