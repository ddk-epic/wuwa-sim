// A minimal LCS line diff for the export preview. Both sides share a serializer,
// so only patched values differ; trimming the common prefix/suffix keeps it cheap.

type Op = { t: "eq" | "del" | "add"; text: string }

export interface Cell {
  n: number
  text: string
}

export interface DiffRow {
  left?: Cell
  right?: Cell
  changed: boolean
}

export interface Hunk {
  rows: DiffRow[]
}

function lcs(a: string[], b: string[]): Op[] {
  const n = a.length
  const m = b.length
  if (n === 0) return b.map((text) => ({ t: "add", text }))
  if (m === 0) return a.map((text) => ({ t: "del", text }))

  const w = m + 1
  const dp = new Int32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] =
        a[i] === b[j]
          ? dp[(i + 1) * w + (j + 1)] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + (j + 1)])
    }
  }

  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: "eq", text: a[i] })
      i++
      j++
    } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
      ops.push({ t: "del", text: a[i] })
      i++
    } else {
      ops.push({ t: "add", text: b[j] })
      j++
    }
  }
  while (i < n) ops.push({ t: "del", text: a[i++] })
  while (j < m) ops.push({ t: "add", text: b[j++] })
  return ops
}

function lineOps(before: string, after: string): Op[] {
  const a = before.split("\n")
  const b = after.split("\n")
  let lo = 0
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++
  let aHi = a.length
  let bHi = b.length
  while (aHi > lo && bHi > lo && a[aHi - 1] === b[bHi - 1]) {
    aHi--
    bHi--
  }
  return [
    ...a.slice(0, lo).map((text) => ({ t: "eq" as const, text })),
    ...lcs(a.slice(lo, aHi), b.slice(lo, bHi)),
    ...a.slice(aHi).map((text) => ({ t: "eq" as const, text })),
  ]
}

/**
 * Split-view hunks: changed lines plus `context` unchanged lines on each side;
 * runs separated by more than the context window become distinct hunks (the
 * caller renders a `⋯` gap between them). Deletions pair with additions row-wise.
 */
export function diffHunks(before: string, after: string, context = 3): Hunk[] {
  const rows: DiffRow[] = []
  let ln = 0
  let rn = 0
  let dels: string[] = []
  let adds: string[] = []
  const flush = () => {
    const k = Math.max(dels.length, adds.length)
    for (let i = 0; i < k; i++) {
      rows.push({
        left: i < dels.length ? { n: ++ln, text: dels[i] } : undefined,
        right: i < adds.length ? { n: ++rn, text: adds[i] } : undefined,
        changed: true,
      })
    }
    dels = []
    adds = []
  }

  for (const op of lineOps(before, after)) {
    if (op.t === "del") dels.push(op.text)
    else if (op.t === "add") adds.push(op.text)
    else {
      flush()
      rows.push({
        left: { n: ++ln, text: op.text },
        right: { n: ++rn, text: op.text },
        changed: false,
      })
    }
  }
  flush()

  const keep: boolean[] = new Array<boolean>(rows.length).fill(false)
  rows.forEach((row, i) => {
    if (!row.changed) return
    for (
      let k = Math.max(0, i - context);
      k <= Math.min(rows.length - 1, i + context);
      k++
    )
      keep[k] = true
  })

  const hunks: Hunk[] = []
  let current: DiffRow[] | null = null
  for (let i = 0; i < rows.length; i++) {
    if (!keep[i]) {
      current = null
      continue
    }
    if (!current) {
      current = []
      hunks.push({ rows: current })
    }
    current.push(rows[i])
  }
  return hunks
}
