export function formatFrames(frames: number): string {
  return (frames / 60).toFixed(2) + "s"
}

/** Formats a value scaled into [1, 1000) to 3 significant figures, US `.` decimal. */
function sig3(x: number): string {
  const abs = Math.abs(x)
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  return x.toFixed(decimals)
}

/**
 * Formats a damage number to 3 significant figures with k/M unit scaling:
 * sub-1k as a plain rounded integer, otherwise scaled to `k`/`M`. Values that
 * round up across a unit boundary roll into the next unit (e.g. `999,999 → 1.00M`).
 */
export function compactDamage(n: number): string {
  const abs = Math.abs(n)
  if (abs < 1e3) return String(Math.round(n))
  if (abs < 1e6) {
    const formatted = sig3(n / 1e3)
    // Boundary guard: 3-sig-fig rounding can push the k value up to 1000.
    if (Math.abs(Number(formatted)) >= 1000) return sig3(n / 1e6) + "M"
    return formatted + "k"
  }
  return sig3(n / 1e6) + "M"
}
