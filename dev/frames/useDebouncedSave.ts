import { useEffect, useRef } from "react"

// Trailing-debounced writer. `queue` records the latest payload and arms the
// timer; `flush` writes it immediately and cancels the timer. The pending write
// is flushed on unmount and on beforeunload so no edit is lost on reload.
export function useDebouncedSave<T>(write: (payload: T) => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<{ payload: T } | null>(null)
  const writeRef = useRef(write)
  writeRef.current = write

  const flush = useRef(() => {
    clearTimeout(timer.current)
    timer.current = undefined
    if (pending.current) {
      const { payload } = pending.current
      pending.current = null
      writeRef.current(payload)
    }
  }).current

  const queue = useRef((payload: T) => {
    pending.current = { payload }
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, ms)
  }).current

  useEffect(() => {
    window.addEventListener("beforeunload", flush)
    return () => {
      window.removeEventListener("beforeunload", flush)
      flush()
    }
  }, [flush])

  return { queue, flush }
}
