import { useEffect, useRef, useState } from "react"
import { CheckIcon, TriangleAlert } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const CONFIRM_FOR = 1500 // ms — green-check dwell
const FAIL_FOR = 3000 // ms — amber dwell, longer so it isn't missed

type AckState = "idle" | "working" | "done" | "failed"

/**
 * Runs its action, then flashes a green check (or amber warning on a rejected
 * async action) and locks for a moment before reverting. The action may be sync
 * or async: a returned promise locks the button until it settles. A thrown/
 * rejected error drives the failure flash, its message shown as the tooltip.
 */
export function AcknowledgeButton({
  icon: Icon,
  label,
  onClick,
  maxLock,
  disabled = false,
  className = "",
}: {
  icon: LucideIcon
  label: string
  onClick: () => void | Promise<void>
  maxLock?: number // ms; abandon a never-settling action and re-enable
  disabled?: boolean
  className?: string
}) {
  const [state, setState] = useState<AckState>("idle")
  const [failTitle, setFailTitle] = useState<string>()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runId = useRef(0)

  function clearTimers() {
    if (timer.current) clearTimeout(timer.current)
    if (watchdog.current) clearTimeout(watchdog.current)
    timer.current = null
    watchdog.current = null
  }
  useEffect(() => clearTimers, [])

  function flash(next: "done" | "failed", ms: number) {
    setState(next)
    timer.current = setTimeout(() => setState("idle"), ms)
  }

  function handleClick() {
    if (state === "working" || state === "done") return
    clearTimers()
    const result = onClick()
    if (!(result instanceof Promise)) {
      flash("done", CONFIRM_FOR)
      return
    }
    const id = ++runId.current
    setState("working")
    if (maxLock !== undefined) {
      watchdog.current = setTimeout(() => {
        runId.current++ // abandon: a later settle no longer matches
        setState("idle")
      }, maxLock)
    }
    result.then(
      () => {
        if (runId.current !== id) return
        clearTimers()
        flash("done", CONFIRM_FOR)
      },
      (err: unknown) => {
        if (runId.current !== id) return
        clearTimers()
        setFailTitle(err instanceof Error ? err.message : undefined)
        flash("failed", FAIL_FOR)
      },
    )
  }

  const locked = state === "working" || state === "done"
  const DisplayIcon =
    state === "done" ? CheckIcon : state === "failed" ? TriangleAlert : Icon
  const tint =
    state === "done"
      ? "text-green-400"
      : state === "failed"
        ? "text-amber-400"
        : ""

  return (
    <button
      className={`flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground disabled:text-muted-foreground/40 enabled:hover:text-foreground ${className}`}
      disabled={disabled || locked}
      onClick={handleClick}
      title={state === "failed" ? failTitle : undefined}
    >
      <DisplayIcon className={`w-4 h-4 ${tint}`} />
      <span>{label}</span>
    </button>
  )
}
