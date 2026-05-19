import { useState } from "react"
import { useTeam } from "#/hooks/useTeam"
import { useTimeline } from "#/hooks/useTimeline"
import { useSimulationLog } from "#/hooks/useSimulationLog"
import { useSettings } from "#/hooks/useSettings"
import { RenamingGroupProvider } from "#/hooks/useRenamingGroup"
import { SettingsProvider } from "#/hooks/useSettingsContext"
import { TeamProvider } from "#/hooks/useTeamContext"
import { SkillCatalog } from "#/components/SkillCatalog"
import { Header } from "#/components/Header"
import { TableTopBar } from "#/components/TableTopBar"
import { TeamModal } from "#/components/TeamModal"
import { SimulationLogModal } from "#/components/SimulationLogModal"
import { TimelineView } from "#/components/TimelineView"
import { getTimelineSummary } from "#/lib/timeline-summary"
import { runSimulation } from "#/lib/simulation"

export function SimulatorPage() {
  const team = useTeam()
  const { slots, loadouts } = team

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
  } = useTimeline(clearLog)
  const [settings, setSettings] = useSettings()
  const [modalOpen, setModalOpen] = useState(false)
  const [simulationLogOpen, setSimulationLogOpen] = useState(false)

  const summary = getTimelineSummary(
    entries,
    slots,
    loadouts,
    settings.reactionDelay,
  )

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
                  totalTimeSec={summary.totalTimeSec}
                  onAddGroup={addGroupAndRename}
                />
                <TimelineView
                  nodes={nodes}
                  summary={summary}
                  log={log}
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
          </main>
        </RenamingGroupProvider>
      </SettingsProvider>
    </TeamProvider>
  )
}
