import type { SimulationLogEntry } from "#/types/simulation-log"
import { useLocalStorage } from "./useLocalStorage"

export function useSimulationLog() {
  const [log, setLog] = useLocalStorage<SimulationLogEntry[]>(
    "wuwa.simulation-log",
    [],
  )

  function clearLog() {
    setLog([])
  }

  return { log, setLog, clearLog }
}
