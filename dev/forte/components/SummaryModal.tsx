import { useMemo } from "react"
import { Check, Copy } from "lucide-react"
import { Modal } from "#/components/ui/Modal"
import { useFlashFlag } from "../../frames/useFlashFlag"
import { forteSummaryRows, summaryToText } from "../summary"
import type { ForteSummaryRow } from "../summary"
import type { ForteClip } from "../clip"

// Read-only holder: every clip's per-repeat forte in one table, all values
// calibration-normalized (%/forte), never raw pixels. Differencing is by hand.
export function SummaryModal({
  clips,
  forteCap,
  onClose,
}: {
  clips: ForteClip[]
  forteCap: number
  onClose: () => void
}) {
  const rows = useMemo(
    () => forteSummaryRows(clips, forteCap),
    [clips, forteCap],
  )
  const text = useMemo(() => summaryToText(rows, forteCap), [rows, forteCap])
  const width = Math.max(0, ...rows.map((r) => r.readings.length))

  return (
    <Modal
      variant="fullscreen"
      title="Forte summary"
      subtitle={`forteCap ${forteCap} · one row per clip, calibration-normalized`}
      onClose={onClose}
      headerExtra={<CopyButton text={text} />}
    >
      <div className="max-h-[70vh] overflow-auto rounded border border-border text-detail">
        <table className="w-full border-collapse font-mono tabular-nums">
          <thead className="sticky top-0 bg-card text-muted-foreground/70">
            <tr>
              <Th className="text-left">Action</Th>
              {Array.from({ length: width }, (_, i) => (
                <Th key={i}>{i + 1}</Th>
              ))}
              <Th>avg %</Th>
              <Th>forte</Th>
              <Th>± err</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={width + 4}
                  className="px-3 py-2 text-muted-foreground/60"
                >
                  No clips yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <Row
                key={row.clipId}
                row={row}
                width={width}
                forteCap={forteCap}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function Row({
  row,
  width,
  forteCap,
}: {
  row: ForteSummaryRow
  width: number
  forteCap: number
}) {
  if (!row.measured)
    return (
      <tr className="border-t border-border/60">
        <Td className="text-left text-foreground">{row.name}</Td>
        <td
          colSpan={width + 3}
          className="px-3 py-1.5 text-muted-foreground/50"
        >
          unmeasured
        </td>
      </tr>
    )
  return (
    <tr className="border-t border-border/60 hover:bg-card">
      <Td className="text-left text-foreground">{row.name}</Td>
      {Array.from({ length: width }, (_, i) => (
        <Td key={i} className="text-muted-foreground">
          {i < row.readings.length
            ? ((row.readings[i] / forteCap) * 100).toFixed(2)
            : ""}
        </Td>
      ))}
      <Td className="font-semibold text-foreground">
        {row.percent.toFixed(2)}
      </Td>
      <Td className="text-foreground">{row.average.toFixed(2)}</Td>
      <Td className="text-muted-foreground/70">{row.spread.toFixed(2)}</Td>
    </tr>
  )
}

function Th({
  children,
  className = "text-right",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <th className={`px-3 py-1.5 font-medium ${className}`}>{children}</th>
}

function Td({
  children,
  className = "text-right",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`px-3 py-1.5 ${className}`}>{children}</td>
}

function CopyButton({ text }: { text: string }) {
  const [copied, flashCopied] = useFlashFlag(false, 1200)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => flashCopied(true))
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
