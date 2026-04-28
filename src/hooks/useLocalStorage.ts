import { useState } from 'react'

type SetValue<T> = T | ((prev: T) => T)

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: SetValue<T>) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item !== null ? (JSON.parse(item) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  function setValue(value: SetValue<T>) {
    setStoredValue((prev) => {
      const next =
        typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
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
