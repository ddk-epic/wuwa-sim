import { useMemo, useState } from "react"
import { AlertTriangle, Check, Copy, Download } from "lucide-react"
import type { EnrichedCharacter } from "#/types/character"
import { patchCharacter } from "../emit"
import type { Clip } from "../types"

function render(value: unknown): string {
  if (value === undefined) return "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function download(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Emit projects the selected clip's measurements onto a clone of the registry
// character. Per the MVP, only this one clip feeds the patch; the solver will
// later reconcile across clips without reshaping this output.
export function EmitPanel({
  char,
  clip,
}: {
  char: EnrichedCharacter
  clip: Clip
}) {
  const { json, ts, changes, warnings } = useMemo(
    () => patchCharacter(char, clip),
    [char, clip],
  )
  const slug = char.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <p className="text-micro font-medium uppercase tracking-[1px] text-muted-foreground/70">
          Export
        </p>
        <Artifact
          label="JSON"
          text={json}
          filename={`${slug}.json`}
          mime="application/json"
        />
        <Artifact
          label="TS"
          text={ts}
          filename={`${slug}.ts`}
          mime="text/plain"
        />
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w, i) => (
            <li
              key={i}
              className="flex items-center gap-1.5 text-detail text-amber-500"
            >
              <AlertTriangle className="size-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {changes.length === 0 ? (
        <p className="text-detail text-muted-foreground/60">
          No changes from the registry.
        </p>
      ) : (
        <div className="overflow-hidden rounded border border-border text-detail">
          {changes.map((c) => (
            <div
              key={c.path}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-border/60 px-2 py-1 last:border-b-0"
            >
              <span className="truncate font-mono text-foreground">
                {c.path}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground/60">
                {render(c.before)}
              </span>
              <span className="text-muted-foreground/40">→</span>
              <span className="font-mono tabular-nums text-ui-heal">
                {render(c.after)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Artifact({
  label,
  text,
  filename,
  mime,
}: {
  label: string
  text: string
  filename: string
  mime: string
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <span className="flex items-center gap-1 text-detail text-muted-foreground">
      <span className="font-mono">{label}</span>
      <button
        onClick={copy}
        title={`Copy ${label}`}
        className="rounded p-1 hover:bg-border hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3.5 text-ui-heal" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      <button
        onClick={() => download(filename, text, mime)}
        title={`Download ${filename}`}
        className="rounded p-1 hover:bg-border hover:text-foreground"
      >
        <Download className="size-3.5" />
      </button>
    </span>
  )
}
