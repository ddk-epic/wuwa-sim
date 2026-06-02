import { useEffect } from "react"
import type { ReactNode } from "react"
import { XIcon } from "lucide-react"

interface ModalProps {
  onClose: () => void
  variant?: "centered" | "fullscreen"
  panelClassName?: string
  title?: string
  subtitle?: string
  /** Status text rendered baseline-aligned beside the title (left side). */
  titleAside?: ReactNode
  /** Controls rendered on the right of the header, next to the close button. */
  headerExtra?: ReactNode
  children: ReactNode
}

const BASE_PANEL = "bg-card rounded-2xl p-5"

const DEFAULT_LAYOUT = {
  centered: "max-w-sm w-full mx-4",
  fullscreen: "w-full max-w-5xl flex flex-col",
} as const

const OVERLAY = {
  centered: "fixed inset-0 z-50 bg-black/80 flex items-center justify-center",
  fullscreen:
    "fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-6",
} as const

export function Modal({
  onClose,
  variant = "centered",
  panelClassName,
  title,
  subtitle,
  titleAside,
  headerExtra,
  children,
}: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const panel = `${BASE_PANEL} ${panelClassName ?? DEFAULT_LAYOUT[variant]}`

  return (
    <div className={OVERLAY[variant]} onClick={onClose}>
      <div className={panel} onClick={(e) => e.stopPropagation()}>
        {title !== undefined && (
          <div className="flex items-center justify-between pb-5 shrink-0">
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  {title}
                </h2>
                {titleAside}
              </div>
              {subtitle !== undefined && (
                <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {headerExtra}
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={onClose}
                aria-label="Close"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
