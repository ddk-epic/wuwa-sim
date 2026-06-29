import { useState } from "react"
import { CopyIcon } from "lucide-react"
import { Modal } from "./ui/Modal"
import { AcknowledgeButton } from "./ui/AcknowledgeButton"

/**
 * Self-contained Import panel: a textarea (local value), an inline error, and an
 * Import button that fires `onImport` with the raw value. `onChange` lets a
 * parent react to edits (e.g. clear a stale error) without owning the value.
 */
export function ImportPanel({
  onImport,
  importError,
  onChange,
}: {
  onImport: (value: string) => void
  importError: string | null
  onChange?: () => void
}) {
  const [importValue, setImportValue] = useState("")

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-300">Import</h3>
      <textarea
        className="w-full h-42 bg-darkest border border-gray-700 rounded px-3 py-2 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-gray-500 placeholder:text-gray-600 break-all"
        placeholder="Paste build code here…"
        spellCheck={false}
        value={importValue}
        onChange={(e) => {
          setImportValue(e.target.value)
          onChange?.()
        }}
      />
      {importError !== null && (
        <p className="text-sm text-red-400">{importError}</p>
      )}
      <button
        className="self-end flex items-center gap-1 px-3 py-1.5 text-sm font-mono rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
        disabled={importValue.trim() === ""}
        onClick={() => onImport(importValue)}
      >
        Import
      </button>
    </section>
  )
}

/** Self-contained Export panel: a read-only code box + a Copy button. */
export function ExportPanel({ exportString }: { exportString: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-300">Export</h3>
      <textarea
        className="w-full h-42 bg-darkest border border-gray-700 rounded px-3 py-2 text-sm font-mono text-gray-300 resize-none focus:outline-none break-all"
        readOnly
        value={exportString}
        spellCheck={false}
      />
      <AcknowledgeButton
        className="self-end"
        icon={CopyIcon}
        label="Copy"
        onClick={() => {
          navigator.clipboard.writeText(exportString)
        }}
      />
    </section>
  )
}

interface ImportExportModalProps {
  onClose: () => void
  exportString: string
  onImport: (value: string) => void
  importError: string | null
}

/** Combined Import + Export modal (sim, via Header). Composed of both panels. */
export function ImportExportModal({
  onClose,
  exportString,
  onImport,
  importError,
}: ImportExportModalProps) {
  return (
    <Modal
      variant="centered"
      onClose={onClose}
      title="Import / Export"
      panelClassName="w-full min-w-xl max-w-3xl"
    >
      <div className="flex flex-col gap-6 pt-4">
        <ImportPanel onImport={onImport} importError={importError} />
        <ExportPanel exportString={exportString} />
      </div>
    </Modal>
  )
}

interface ImportModalProps {
  onClose: () => void
  onImport: (value: string) => void
  importError: string | null
  onChange?: () => void
}

/** Import-only modal (Library). Wraps `ImportPanel`. */
export function ImportModal({
  onClose,
  onImport,
  importError,
  onChange,
}: ImportModalProps) {
  return (
    <Modal
      variant="centered"
      onClose={onClose}
      title="Import team"
      panelClassName="w-full min-w-xl max-w-3xl"
    >
      <div className="pt-4">
        <ImportPanel
          onImport={onImport}
          importError={importError}
          onChange={onChange}
        />
      </div>
    </Modal>
  )
}
