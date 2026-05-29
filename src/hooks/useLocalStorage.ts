import { useState, useEffect } from "react"

type SetValue<T> = T | ((prev: T) => T)

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  transform?: (stored: unknown) => T,
): [T, (value: SetValue<T>) => void] {
  const [storedValue, setStoredValue] = useState<T>(defaultValue)

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item !== null) {
        const parsed: unknown = JSON.parse(item)
        // Boundary: parsed JSON is unknown; trusted as T unless a transform validates.
        setStoredValue(transform ? transform(parsed) : (parsed as T))
      }
    } catch {
      // silently ignore read errors
    }
  }, [key])

  function setValue(value: SetValue<T>) {
    setStoredValue((prev) => {
      const next =
        // T may itself be callable, so typeof can't narrow the updater branch.
        typeof value === "function" ? (value as (prev: T) => T)(prev) : value
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // silently ignore write errors
      }
      return next
    })
  }

  return [storedValue, setValue]
}
