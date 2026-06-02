import { useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { CirclePlus, Download, Settings, Upload } from "lucide-react"
import { HBtn } from "#/components/ui/HBtn"
import { DetailCard } from "#/components/library/DetailPane"
import { LibraryList } from "#/components/library/LibraryList"
import { savedTeamToLibTeam } from "#/components/library/savedTeamToLibTeam"
import type { RowActions } from "#/components/library/types"
import { CreateTeamModal } from "#/components/team/CreateTeamModal"
import { ImportModal } from "#/components/ImportExportModal"
import { ConfirmModal } from "#/components/ui/ConfirmModal"
import { useLibrary } from "#/hooks/useLibrary"
import { encodePayload } from "#/lib/import-export"

export function LibraryPage() {
  const {
    teams: savedTeams,
    load,
    rename,
    togglePin,
    duplicate,
    remove,
    importBundle,
  } = useLibrary()
  const navigate = useNavigate()

  const teams = useMemo(() => savedTeams.map(savedTeamToLibTeam), [savedTeams])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("recent")
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const selectedTeam =
    teams.find((t) => t.id === selectedId) ?? teams[0] ?? null
  const isEmpty = teams.length === 0

  function handleCreate() {
    setCreateOpen(true)
  }

  function handleImport() {
    setImportError(null)
    setImportOpen(true)
  }

  function closeImport() {
    setImportOpen(false)
    setImportError(null)
  }

  function submitImport(code: string) {
    if (importBundle(code)) {
      closeImport()
    } else {
      setImportError("That export code could not be read.")
    }
  }

  function handleExport(id: string) {
    const saved = savedTeams.find((t) => t.id === id)
    if (!saved) return
    try {
      navigator.clipboard.writeText(encodePayload(saved.payload))
    } catch {
      window.alert("Could not export this team.")
    }
  }

  const actions: RowActions = {
    onOpen: (id) => {
      load(id)
      navigate({ to: "/sim" })
    },
    onRename: rename,
    onTogglePin: togglePin,
    onDuplicate: duplicate,
    onExport: handleExport,
    onDelete: setPendingDeleteId,
  }

  const pendingDeleteName =
    savedTeams.find((t) => t.id === pendingDeleteId)?.name ?? "this team"

  return (
    <div className="w-full h-screen bg-background text-foreground font-sans text-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-12 shrink-0 bg-card border-b border-border flex items-center px-4 gap-4">
        <div className="flex items-center gap-2.5">
          <div className="leading-none">
            <span className="tracking-[0.5px] font-semibold text-2xl text-foreground">
              WUWA
            </span>
            <span className="pr-2 text-lg tracking-[0.5px] font-semibold text-yellow-400">
              Sim
            </span>
          </div>
          <span className="text-micro text-muted-foreground font-mono px-1.75 py-0.5 border border-border rounded-sm tracking-[1.2px]">
            LIBRARY
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <HBtn icon={Upload} label="import" onClick={handleImport} />
          <HBtn
            icon={Download}
            label="export"
            onClick={() => selectedTeam && handleExport(selectedTeam.id)}
          />
          <HBtn
            icon={CirclePlus}
            label="New team"
            primary
            onClick={handleCreate}
          />
          <button
            className="flex items-center gap-1 p-1.25 font-mono text-sm rounded-sm text-muted-foreground hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left rail */}
        <div className="w-10 shrink-0 bg-darkest border-r border-border flex flex-col items-center py-3 gap-2"></div>

        {/* Main pane */}
        <div className="flex-1 flex flex-col min-w-200">
          <DetailCard
            team={selectedTeam}
            isEmpty={isEmpty}
            actions={actions}
            onCreate={handleCreate}
            onImport={handleImport}
          />
        </div>

        <LibraryList
          teams={teams}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          setQuery={setQuery}
          sort={sort}
          setSort={setSort}
          actions={actions}
          onCreate={handleCreate}
        />
      </div>

      {createOpen && <CreateTeamModal onClose={() => setCreateOpen(false)} />}

      {importOpen && (
        <ImportModal
          onImport={submitImport}
          importError={importError}
          onChange={() => setImportError(null)}
          onClose={closeImport}
        />
      )}

      {pendingDeleteId !== null && (
        <ConfirmModal
          message={`Delete "${pendingDeleteName}"? This cannot be undone.`}
          onConfirm={() => {
            remove(pendingDeleteId)
            setPendingDeleteId(null)
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}
