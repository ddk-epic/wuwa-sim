import { useState } from "react"
import { useTeam } from "#/hooks/useTeam"
import { useTimeline } from "#/hooks/useTimeline"
import { useSimulationLog } from "#/hooks/useSimulationLog"
import { useSettings } from "#/hooks/useSettings"
import { RenamingGroupProvider } from "#/hooks/useRenamingGroup"
import { SettingsProvider } from "#/hooks/useSettingsContext"
import { TeamProvider } from "#/hooks/useTeamContext"
import { SkillCatalog } from "#/components/skills/SkillCatalog"
import { Header } from "#/components/Header"
import { TableTopBar } from "#/components/timeline/TableTopBar"
import { TeamModal } from "#/components/team/TeamModal"
import { SimulationLogModal } from "#/components/log/SimulationLogModal"
import { TimelineView } from "#/components/timeline/TimelineView"
import { ConfirmModal } from "#/components/ui/ConfirmModal"
import { getTimelineSummary } from "#/lib/timeline/timeline-summary"
import { runSimulation } from "#/lib/simulation"
import { encodePayload, decodePayload } from "#/lib/import-export"
import type { ImportExportPayload } from "#/lib/import-export"

export function SimulatorPage() {
  const team = useTeam()
  const { slots, loadouts, focusedId, loadTeam } = team

  const { log, setLog, clearLog } = useSimulationLog()

  const {
    nodes,
    entries,
    renamingGroupId,
    startRename,
    endRename,
    addEntry,
    addGroupAndRename,
    removeEntry,
    reorderEntries,
    reorderNodes,
    reorderGroupEntries,
    updateEntry,
    updateGroupLabel,
    toggleGroupLock,
    deleteGroup,
    duplicateGroup,
    clearTimeline,
    loadNodes,
  } = useTimeline(clearLog)
  const [settings, setSettings] = useSettings()
  const [modalOpen, setModalOpen] = useState(false)
  const [simulationLogOpen, setSimulationLogOpen] = useState(false)
  const [pendingImport, setPendingImport] =
    useState<ImportExportPayload | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const exportString = encodePayload({
    team: { slots, loadouts, focusedId },
    timeline: nodes.length > 0 ? nodes : null,
  })

  const summary = getTimelineSummary(
    entries,
    slots,
    loadouts,
    settings.reactionDelay,
    settings.swapFrames,
    log.length > 0 ? log : undefined,
    settings.variantFloor,
  )

  function applyImport(payload: ImportExportPayload) {
    loadTeam(payload.team.slots, payload.team.loadouts, payload.team.focusedId)
    loadNodes(payload.timeline ?? [])
    clearLog()
  }

  function handleImport(value: string) {
    setImportError(null)
    let payload: ImportExportPayload
    try {
      payload = decodePayload(value)
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Invalid import string",
      )
      return
    }
    if (nodes.length > 0 && payload.timeline !== null) {
      setPendingImport(payload)
    } else {
      applyImport(payload)
    }
  }

  function handleResetTimeline() {
    clearTimeline()
  }

  function handleSimulate() {
    setLog(
      runSimulation(
        entries,
        slots,
        loadouts,
        settings.reactionDelay,
        settings.swapFrames,
        settings.variantFloor,
        settings.fallFrames,
      ),
    )
  }

  return (
    <TeamProvider value={team}>
      <SettingsProvider settings={settings} actions={{ setSettings }}>
        <RenamingGroupProvider
          value={{ renamingGroupId, startRename, endRename }}
        >
          <main className="flex flex-col min-w-345 h-screen">
            <Header
              onEditTeam={() => setModalOpen(true)}
              onResetTimeline={handleResetTimeline}
              onSimulate={handleSimulate}
              onOpenSimulationLog={() => setSimulationLogOpen(true)}
              timelineEmpty={entries.length === 0}
              logEmpty={log.length === 0}
              exportString={exportString}
              onImport={handleImport}
              importError={importError}
            />
            <div className="flex flex-1 min-h-0">
              {/* left rail */}
              <div className="flex w-10 shrink-0 flex-col items-center gap-2.5 border-r border-border bg-darkest py-3" />
              {/* center column */}
              <div className="flex-1 flex flex-col min-h-0">
                <TableTopBar
                  entriesNumber={entries.length}
                  totalDmg={summary.totalDamage}
                  dps={summary.dps}
                  totalTimeSec={summary.totalTimeFrames / 60}
                  onAddGroup={addGroupAndRename}
                />
                <TimelineView
                  nodes={nodes}
                  summary={summary}
                  onRemove={removeEntry}
                  onReorder={reorderEntries}
                  onReorderNodes={reorderNodes}
                  onUpdateEntry={updateEntry}
                  onGroupLabelCommit={updateGroupLabel}
                  onToggleGroupLock={toggleGroupLock}
                  onDuplicateGroup={duplicateGroup}
                  onDeleteGroup={deleteGroup}
                  onReorderGroupEntries={reorderGroupEntries}
                />
              </div>
              {/* right sidebar */}
              <div className="w-100 shrink-0 border-l border-border flex flex-col min-h-0">
                {slots.some((id) => id !== null) ? (
                  <SkillCatalog onStageClick={addEntry} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 text-lg">
                    Select a character to view skills
                  </div>
                )}
              </div>
            </div>
            {modalOpen && <TeamModal onClose={() => setModalOpen(false)} />}
            {simulationLogOpen && (
              <SimulationLogModal
                log={log}
                onClose={() => setSimulationLogOpen(false)}
              />
            )}
            {pendingImport !== null && (
              <ConfirmModal
                message="Import will overwrite your current timeline. Continue?"
                onConfirm={() => {
                  applyImport(pendingImport)
                  setPendingImport(null)
                }}
                onCancel={() => setPendingImport(null)}
              />
            )}
          </main>
        </RenamingGroupProvider>
      </SettingsProvider>
    </TeamProvider>
  )
}
