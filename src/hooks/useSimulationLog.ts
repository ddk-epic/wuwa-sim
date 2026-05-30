import type { SimulationLogEntry } from "#/types/simulation-log"
import { useLocalStorage } from "./useLocalStorage"

interface StoredLog {
  log: SimulationLogEntry[]
  signature: string
}

function normalize(raw: unknown): StoredLog {
  if (Array.isArray(raw))
    return { log: raw as SimulationLogEntry[], signature: "" }
  if (
    raw !== null &&
    typeof raw === "object" &&
    "log" in raw &&
    "signature" in raw
  ) {
    return raw as StoredLog
  }
  return { log: [], signature: "" }
}

// FNV-1a 32-bit over the JSON representation of simulation inputs.
export function computeSignature(...args: unknown[]): string {
  const str = JSON.stringify(args)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16)
}

export function useSimulationLog() {
  const [stored, setStored] = useLocalStorage<StoredLog>(
    "wuwa.simulation-log",
    { log: [], signature: "" },
    normalize,
  )

  function setLog(log: SimulationLogEntry[], signature: string) {
    setStored({ log, signature })
  }

  function clearLog() {
    setStored({ log: [], signature: "" })
  }

  return {
    log: stored.log,
    storedSignature: stored.signature,
    setLog,
    clearLog,
  }
}
