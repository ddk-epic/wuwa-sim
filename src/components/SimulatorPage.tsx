import { useState, useEffect, useRef } from "react"
import { useTeam } from "#/hooks/useTeam"
import { useLibrary } from "#/hooks/useLibrary"
import { useTimeline } from "#/hooks/useTimeline"
import { useSimulationLog, computeSignature } from "#/hooks/useSimulationLog"
import { useSettings } from "#/hooks/useSettings"
import { useUiPreferences } from "#/hooks/useUiPreferences"
import { useAutoRun } from "#/hooks/useAutoRun"
import { useModalToggle } from "#/hooks/useModalToggle"
import { RenamingGroupProvider } from "#/hooks/useRenamingGroup"
import { SettingsProvider } from "#/hooks/useSettingsContext"
import { TeamProvider } from "#/hooks/useTeamContext"
import { UiPreferencesProvider } from "#/hooks/useUiPreferencesContext"
import { SkillCatalog } from "#/components/skills/SkillCatalog"
import { Header } from "#/components/Header"
import { TableTopBar } from "#/components/timeline/TableTopBar"
import { EditTeamModal } from "#/components/team/EditTeamModal"
import { SimulationLogModal } from "#/components/log/SimulationLogModal"
import { SettingsModal } from "#/components/SettingsModal"
import { TimelineView } from "#/components/timeline/TimelineView"
import { ConfirmModal } from "#/components/ui/ConfirmModal"
import { EmptyStatement } from "#/components/ui/EmptyStatement"
import { getTimelineSummary } from "#/lib/timeline/timeline-summary"
import { runSimulation } from "#/lib/simulation"
import { encodePayload, decodePayload } from "#/lib/import-export"
import type { ImportExportPayload } from "#/lib/import-export"

export function SimulatorPage() {
  const team = useTeam()
  const { name, slots, loadouts, focusedId, originId, setOriginId, loadTeam } =
    team
  const { saveCurrent } = useLibrary()

  const { log, storedSignature, setLog, clearLog } = useSimulationLog()

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
  } = useTimeline()

  const [settings, setSettings] = useSettings()
  const [preferences, setPreferences] = useUiPreferences()
  const autoRun = preferences.autoRun

  const currentSignature = computeSignature(entries, slots, loadouts, settings)
  const stale = log.length > 0 && storedSignature !== currentSignature
  const needsRun = entries.length > 0 && (log.length === 0 || stale)

  // Refs for fresh inputs — debounce callback reads these at fire time, not stale closures
  const entriesRef = useRef(entries)
  const slotsRef = useRef(slots)
  const loadoutsRef = useRef(loadouts)
  const settingsRef = useRef(settings)
  entriesRef.current = entries
  slotsRef.current = slots
  loadoutsRef.current = loadouts
  settingsRef.current = settings

  useEffect(() => {
    if (entries.length === 0) clearLog()
  }, [entries.length])

  function tryRunSimulation() {
    const sig = computeSignature(
      entriesRef.current,
      slotsRef.current,
      loadoutsRef.current,
      settingsRef.current,
    )
    try {
      setLog(
        runSimulation(
          entriesRef.current,
          slotsRef.current,
          loadoutsRef.current,
          settingsRef.current.reactionDelay,
          settingsRef.current.swapFrames,
          settingsRef.current.variantFloor,
          settingsRef.current.fallFrames,
        ),
        sig,
      )
    } catch {
      // keep prior log
    }
  }

  const { scheduleRun, onModalOpen, onModalClose } = useAutoRun({
    autoRun,
    needsRun,
    runFn: tryRunSimulation,
  })

  // Timeline shape changes → schedule a debounced auto-run
  const afterMountRef = useRef(false)
  useEffect(() => {
    if (!afterMountRef.current) {
      afterMountRef.current = true
      return
    }
    scheduleRun()
  }, [entries])

  const teamModal = useModalToggle({
    onOpen: onModalOpen,
    onClose: onModalClose,
  })
  const settingsModal = useModalToggle({
    onOpen: onModalOpen,
    onClose: onModalClose,
  })
  const simulationLogModal = useModalToggle({
    onOpen: onModalOpen,
    onClose: onModalClose,
  })
  const [pendingImport, setPendingImport] =
    useState<ImportExportPayload | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const exportString = encodePayload({
    team: { name, slots, loadouts, focusedId },
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

  function handleSaveTeam() {
    // Update-or-create against the live Origin; re-stamp it after a create so a
    // subsequent Save updates the same entry in place.
    const savedId = saveCurrent(originId)
    if (savedId !== originId) setOriginId(savedId)
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
      currentSignature,
    )
  }

  return (
    <TeamProvider value={team}>
      <SettingsProvider settings={settings} actions={{ setSettings }}>
        <UiPreferencesProvider
          preferences={preferences}
          actions={{ setPreferences }}
        >
          <RenamingGroupProvider
            value={{ renamingGroupId, startRename, endRename }}
          >
            <main className="flex flex-col min-w-345 h-screen">
              <Header
                onEditTeam={teamModal.open}
                onResetTimeline={handleResetTimeline}
                onSimulate={handleSimulate}
                onSaveTeam={handleSaveTeam}
                onOpenSimulationLog={simulationLogModal.open}
                onOpenSettings={settingsModal.open}
                timelineEmpty={entries.length === 0}
                logEmpty={log.length === 0}
                saveDisabled={slots.every((id) => id === null)}
                autoRun={autoRun}
                needsRun={needsRun}
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
                    stale={stale}
                    onAddGroup={addGroupAndRename}
                  />
                  <TimelineView
                    nodes={nodes}
                    summary={summary}
                    log={log}
                    stale={stale}
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
                    <EmptyStatement
                      statement="No characters yet"
                      description="Add a character to your team to browse their skills."
                    />
                  )}
                </div>
              </div>
              {teamModal.isOpen && <EditTeamModal onClose={teamModal.close} />}
              {simulationLogModal.isOpen && (
                <SimulationLogModal
                  log={log}
                  rosterIds={slots.filter((id): id is number => id !== null)}
                  totalDamage={summary.totalDamage}
                  dps={summary.dps}
                  totalTimeFrames={summary.totalTimeFrames}
                  onClose={simulationLogModal.close}
                />
              )}
              {settingsModal.isOpen && (
                <SettingsModal onClose={settingsModal.close} />
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
        </UiPreferencesProvider>
      </SettingsProvider>
    </TeamProvider>
  )
}
