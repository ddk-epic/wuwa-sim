import { useState, useRef } from "react"
import { CopyIcon, CheckIcon } from "lucide-react"
import { Modal } from "./ui/Modal"

interface ImportExportModalProps {
  onClose: () => void
  exportString: string
  onImport: (value: string) => void
  importError: string | null
}

export function ImportExportModal({
  onClose,
  exportString,
  onImport,
  importError,
}: ImportExportModalProps) {
  const [importValue, setImportValue] = useState("")
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCopy(e: React.MouseEvent<HTMLButtonElement>) {
    navigator.clipboard.writeText(exportString)
    const btn = e.currentTarget
    btn.dataset.copied = "true"
    btn.disabled = true
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => {
      btn.removeAttribute("data-copied")
      btn.disabled = false
    }, 1500)
  }

  return (
    <Modal
      variant="centered"
      onClose={onClose}
      title="Import / Export"
      panelClassName="w-full min-w-xl max-w-3xl"
    >
      <div className="flex flex-col gap-6 pt-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-300">Import</h3>
          <textarea
            className="w-full h-42 bg-darkest border border-gray-700 rounded px-3 py-2 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-gray-500 placeholder:text-gray-600"
            placeholder="Paste build code here…"
            spellCheck={false}
            value={importValue}
            onChange={(e) => setImportValue(e.target.value)}
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
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-300">Export</h3>
          <textarea
            className="w-full h-42 bg-darkest border border-gray-700 rounded px-3 py-2 text-sm font-mono text-gray-300 resize-none focus:outline-none"
            readOnly
            value={exportString}
            spellCheck={false}
          />
          <button
            className="self-end flex items-center gap-1 px-3 py-1.5 text-sm font-mono rounded border border-border text-muted-foreground enabled:hover:text-foreground disabled:text-muted-foreground/40"
            onClick={handleCopy}
          >
            <CopyIcon className="w-4 h-4 in-data-copied:hidden" />
            <CheckIcon className="w-4 h-4 hidden in-data-copied:block text-green-400" />
            <span>Copy</span>
          </button>
        </section>
      </div>
    </Modal>
  )
}
