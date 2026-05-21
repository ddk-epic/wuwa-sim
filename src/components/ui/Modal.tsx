import { useEffect } from "react"
import type { ReactNode } from "react"

interface ModalProps {
  onClose: () => void
  variant?: "centered" | "fullscreen"
  panelClassName?: string
  title?: string
  subtitle?: string
  headerExtra?: ReactNode
  children: ReactNode
}

const DEFAULT_PANEL = {
  centered:
    "bg-gray-900 rounded-lg border border-gray-700 p-6 max-w-sm w-full mx-4",
  fullscreen:
    "w-full max-w-5xl bg-gray-900 rounded-lg border border-gray-700 flex flex-col",
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

  const panel = panelClassName ?? DEFAULT_PANEL[variant]

  return (
    <div className={OVERLAY[variant]} onClick={onClose}>
      <div className={panel} onClick={(e) => e.stopPropagation()}>
        {title !== undefined && (
          <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              {subtitle !== undefined && (
                <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {headerExtra}
              <button
                className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
