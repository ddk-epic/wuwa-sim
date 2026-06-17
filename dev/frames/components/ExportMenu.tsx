import { Fragment, useMemo, useState } from "react"
import { AlertTriangle, Check, Copy } from "lucide-react"
import type { EnrichedCharacter } from "#/types/character"
import { Modal } from "#/components/ui/Modal"
import { diffHunks } from "../diff"
import type { Cell } from "../diff"
import { buildExport, characterToTs } from "../export"
import { snapshotMarkdown } from "../snapshot"
import type { Clip } from "../types"

type Tab = "ts" | "md"

// Character-scoped export from the selected clip; the preview lives in a modal,
// not on the page. Disabled until a clip is selected.
export function ExportMenu({
  char,
  clip,
}: {
  char: EnrichedCharacter
  clip: Clip | null
}) {
  const [tab, setTab] = useState<Tab | null>(null)
  const disabled = !clip

  return (
    <div className="flex items-center gap-2">
      <span className="text-micro font-medium uppercase tracking-[1px] text-muted-foreground/70">
        Export
      </span>
      <div className="flex overflow-hidden rounded border border-border">
        {(["ts", "md"] as const).map((t) => (
          <button
            key={t}
            disabled={disabled}
            onClick={() => setTab(t)}
            title={disabled ? "select a clip" : `${t.toUpperCase()} export`}
            className="px-2.5 py-1 text-detail font-medium uppercase text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-40"
          >
            {t}
          </button>
        ))}
      </div>
      {tab && clip && (
        <ExportModal
          char={char}
          clip={clip}
          tab={tab}
          setTab={setTab}
          onClose={() => setTab(null)}
        />
      )}
    </div>
  )
}

function ExportModal({
  char,
  clip,
  tab,
  setTab,
  onClose,
}: {
  char: EnrichedCharacter
  clip: Clip
  tab: Tab
  setTab: (t: Tab) => void
  onClose: () => void
}) {
  const { ts, warnings } = useMemo(() => buildExport(char, clip), [char, clip])
  const before = useMemo(() => characterToTs(char), [char])
  const md = useMemo(() => snapshotMarkdown(char, clip), [char, clip])
  const text = tab === "ts" ? ts : md

  return (
    <Modal
      variant="fullscreen"
      title="Export"
      onClose={onClose}
      headerExtra={
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded border border-border">
            {(["ts", "md"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-detail font-medium uppercase ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <CopyButton text={text} />
        </div>
      }
    >
      {tab === "ts" ? (
        <>
          {warnings.length > 0 && (
            <ul className="mb-3 space-y-1">
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
          <DiffView before={before} after={ts} />
        </>
      ) : (
        <pre className="max-h-[70vh] overflow-auto rounded border border-border bg-background p-3 font-mono text-detail text-foreground">
          {md}
        </pre>
      )}
    </Modal>
  )
}

function DiffView({ before, after }: { before: string; after: string }) {
  const hunks = useMemo(() => diffHunks(before, after), [before, after])

  if (hunks.length === 0)
    return (
      <p className="text-detail text-muted-foreground/60">
        No changes from the registry.
      </p>
    )

  return (
    <div className="max-h-[70vh] overflow-auto rounded border border-border font-mono text-detail">
      {hunks.map((hunk, hi) => (
        <Fragment key={hi}>
          {hi > 0 && (
            <div className="border-y border-border bg-card px-2 py-0.5 text-center text-muted-foreground/40">
              ⋯
            </div>
          )}
          {hunk.rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-2">
              <DiffCell cell={row.left} changed={row.changed} side="del" />
              <DiffCell cell={row.right} changed={row.changed} side="add" />
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}

function DiffCell({
  cell,
  changed,
  side,
}: {
  cell?: Cell
  changed: boolean
  side: "del" | "add"
}) {
  const tint = !changed
    ? ""
    : side === "del"
      ? "bg-destructive/15"
      : "bg-ui-heal/15"
  return (
    <div
      className={`flex gap-2 border-r border-border px-2 ${cell ? tint : "bg-muted/10"}`}
    >
      <span className="w-8 shrink-0 select-none text-right tabular-nums text-muted-foreground/40">
        {cell?.n ?? ""}
      </span>
      <span className="whitespace-pre text-foreground">{cell?.text ?? ""}</span>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        })
      }}
      className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-detail text-muted-foreground hover:bg-card hover:text-foreground"
    >
      {copied ? (
        <Check className="size-3.5 text-ui-heal" />
      ) : (
        <Copy className="size-3.5" />
      )}
      Copy
    </button>
  )
}
