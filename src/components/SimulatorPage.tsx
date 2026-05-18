import { useState } from "react"
import { useTeam } from "#/hooks/useTeam"
import { useTimeline } from "#/hooks/useTimeline"
import { useSimulationLog } from "#/hooks/useSimulationLog"
import { useSettings } from "#/hooks/useSettings"
import { SkillCatalog } from "#/components/SkillCatalog"
import { Header } from "#/components/Header"
import { TableTopBar } from "#/components/TableTopBar"
import { TeamModal } from "#/components/TeamModal"
import { SimulationLogModal } from "#/components/SimulationLogModal"
import { TimelineView } from "#/components/TimelineView"
import { getTimelineSummary } from "#/lib/timeline-summary"
import { runSimulation } from "#/lib/simulation"

export function SimulatorPage() {
  const {
    slots,
    loadouts,
    focusedId,
    selectedCount,
    toggleCharacter,
    focusCharacter,
    setSlotPatch,
  } = useTeam()

  const { log, setLog, clearLog } = useSimulationLog()

  const {
    nodes,
    entries,
    addEntry,
    addGroup,
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
  const [settings, setReactionDelay] = useSettings()
  const [modalOpen, setModalOpen] = useState(false)
  const [simulationLogOpen, setSimulationLogOpen] = useState(false)
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)

  const summary = getTimelineSummary(
    entries,
    slots,
    loadouts,
    settings.reactionDelay,
  )

  function handleResetTimeline() {
    clearTimeline()
  }

  function handleAddGroup() {
    const id = addGroup()
    setRenamingGroupId(id)
  }

  function handleSimulate() {
    setLog(runSimulation(entries, slots, loadouts, settings.reactionDelay))
  }

  return (
    <main className="flex flex-col h-screen">
      <Header
        slots={slots}
        onEditTeam={() => setModalOpen(true)}
        onResetTimeline={handleResetTimeline}
        onSimulate={handleSimulate}
        onOpenSimulationLog={() => setSimulationLogOpen(true)}
        timelineEmpty={entries.length === 0}
        reactionDelay={settings.reactionDelay}
        onReactionDelayChange={setReactionDelay}
      />
      <TableTopBar
        entriesNumber={entries.length}
        totalDmg={summary.totalDamage}
        dps={summary.dps}
        totalTimeSec={summary.totalTimeSec}
        onAddGroup={handleAddGroup}
      />
      <div className="flex flex-1 min-h-0">
        {/* left rail spacer */}
        <div className="flex w-10 shrink-0 flex-col items-center gap-2.5 border-r border-border bg-darkest py-3" />
        <div className="flex-75 flex flex-col min-h-0">
          <TimelineView
            nodes={nodes}
            summary={summary}
            slots={slots}
            loadouts={loadouts}
            reactionDelay={settings.reactionDelay}
            renamingGroupId={renamingGroupId}
            log={log}
            onRemove={removeEntry}
            onReorder={reorderEntries}
            onReorderNodes={reorderNodes}
            onUpdateEntry={updateEntry}
            onGroupLabelCommit={updateGroupLabel}
            onGroupLabelRenameEnd={() => setRenamingGroupId(null)}
            onToggleGroupLock={toggleGroupLock}
            onStartRename={setRenamingGroupId}
            onDuplicateGroup={duplicateGroup}
            onDeleteGroup={deleteGroup}
            onReorderGroupEntries={reorderGroupEntries}
          />
        </div>
        <div className="flex-25 border-l border-gray-700 flex flex-col min-h-0">
          {slots.some((id) => id !== null) ? (
            <SkillCatalog
              slots={slots}
              loadouts={loadouts}
              focusedId={focusedId}
              onFocus={focusCharacter}
              onStageClick={addEntry}
              reactionDelay={settings.reactionDelay}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Select a character to view skills
            </div>
          )}
        </div>
      </div>
      {modalOpen && (
        <TeamModal
          slots={slots}
          loadouts={loadouts}
          focusedId={focusedId}
          selectedCount={selectedCount}
          onToggle={toggleCharacter}
          onSlotChange={setSlotPatch}
          onClose={() => setModalOpen(false)}
        />
      )}
      {simulationLogOpen && (
        <SimulationLogModal
          log={log}
          onClose={() => setSimulationLogOpen(false)}
        />
      )}
    </main>
  )
}
