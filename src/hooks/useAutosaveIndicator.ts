import { useEffect, useRef, useState } from "react"

export type AutosaveStatus = "idle" | "saving" | "saved"

const SAVING_MS = 500
const SAVED_LINGER_MS = 1500

/**
 * A simulated autosave feedback machine driven by a watched snapshot. The edit
 * flow already persists synchronously, so this is purely reassuring: a change
 * shows "saving" at once; 500ms of quiet flips it to "saved", which lingers
 * 1.5s before hiding; any further change snaps back to "saving".
 *
 * The first snapshot is recorded without a transition, so the initial render
 * (including the `useLocalStorage` hydration tick) never flashes "saved".
 */
export function useAutosaveIndicator(snapshot: unknown): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>("idle")
  const key = JSON.stringify(snapshot)
  const prevKey = useRef<string | null>(null)

  useEffect(() => {
    if (prevKey.current === null || prevKey.current === key) {
      prevKey.current = key
      return
    }
    prevKey.current = key

    setStatus("saving")
    let hideTimer: ReturnType<typeof setTimeout> | undefined
    const savedTimer = setTimeout(() => {
      setStatus("saved")
      hideTimer = setTimeout(() => setStatus("idle"), SAVED_LINGER_MS)
    }, SAVING_MS)
    return () => {
      clearTimeout(savedTimer)
      clearTimeout(hideTimer)
    }
  }, [key])

  return status
}
