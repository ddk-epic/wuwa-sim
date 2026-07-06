import { useEffect, useRef, useState } from "react"

// Transient value that auto-resets to `reset` after `ms`. Timer is cleared on
// unmount and re-armed on each flash, so no setState lands after unmount.
export function useFlashFlag<T>(reset: T, ms: number) {
  const [value, setValue] = useState<T>(reset)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function flash(next: T) {
    setValue(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setValue(reset), ms)
  }

  return [value, flash] as const
}
