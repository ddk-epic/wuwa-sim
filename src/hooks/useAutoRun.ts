import { useRef, useEffect, useCallback } from "react"

interface UseAutoRunOptions {
  autoRun: boolean
  needsRun: boolean
  runFn: () => void
  debounceMs?: number
}

interface UseAutoRunResult {
  scheduleRun: () => void
  onModalOpen: () => void
  onModalClose: () => void
}

export function useAutoRun({
  autoRun,
  needsRun,
  runFn,
  debounceMs = 300,
}: UseAutoRunOptions): UseAutoRunResult {
  const autoRunRef = useRef(autoRun)
  const needsRunRef = useRef(needsRun)
  const runFnRef = useRef(runFn)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  autoRunRef.current = autoRun
  needsRunRef.current = needsRun
  runFnRef.current = runFn

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  function safeRun() {
    try {
      runFnRef.current()
    } catch {
      // caller's runFn is responsible for side-effect safety; we prevent crashes
    }
  }

  // Mount: run once if autoRun && needsRun
  useEffect(() => {
    if (autoRunRef.current && needsRunRef.current) {
      safeRun()
    }
    return () => cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Toggle off→on: run immediately if needsRun
  const prevAutoRunRef = useRef(autoRun)
  useEffect(() => {
    if (autoRun && !prevAutoRunRef.current && needsRunRef.current) {
      safeRun()
    }
    prevAutoRunRef.current = autoRun
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun])

  const scheduleRun = useCallback(() => {
    if (!autoRunRef.current) return
    cancel()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      safeRun()
    }, debounceMs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancel, debounceMs])

  const onModalOpen = useCallback(() => {
    cancel()
  }, [cancel])

  const onModalClose = useCallback(() => {
    if (autoRunRef.current && needsRunRef.current) {
      safeRun()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { scheduleRun, onModalOpen, onModalClose }
}
