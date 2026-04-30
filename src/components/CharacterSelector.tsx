import { useState } from "react"
import { useTeam } from "#/hooks/useTeam"
import { useTimeline } from "#/hooks/useTimeline"
import { getCharacterById } from "#/lib/catalog"
import { SkillSidebar } from "#/components/SkillSidebar"
import { TeamBar } from "#/components/TeamBar"
import { TeamModal } from "#/components/TeamModal"
import { TimelineView } from "#/components/TimelineView"
import { computeDamage } from "#/lib/timeline"

export function CharacterSelector() {
  const {
    slots,
    loadouts,
    focusedId,
    selectedCount,
    toggleCharacter,
    focusCharacter,
    setWeapon,
    setEcho,
    setEchoSet,
  } = useTeam()

  const { entries, addEntry, removeEntry, clearTimeline } = useTimeline()
  const [modalOpen, setModalOpen] = useState(false)

  const totalDmg = entries.reduce((sum, entry) => {
    if (entry.multiplier <= 0) return sum
    const char = getCharacterById(entry.characterId)
    const maxAtk = char?.stats.max.atk ?? 0
    return sum + computeDamage(entry.multiplier, maxAtk)
  }, 0)
  const totalFrames = entries.reduce((sum, entry) => sum + entry.actionTime, 0)
  const totalTimeSec = totalFrames / 60
  const dps = totalTimeSec > 0 ? Math.round(totalDmg / totalTimeSec) : 0

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <TeamBar
        slots={slots}
        onEditTeam={() => setModalOpen(true)}
        onResetTimeline={clearTimeline}
        timelineEmpty={entries.length === 0}
        totalDmg={totalDmg}
        dps={dps}
        totalTimeSec={totalTimeSec}
      />
      <div className="flex flex-1 min-h-0">
        <div className="flex-[70] flex flex-col min-h-0">
          <TimelineView entries={entries} onRemove={removeEntry} />
        </div>
        <div className="flex-[30] border-l border-gray-700 flex flex-col min-h-0">
          {slots.some((id) => id !== null) ? (
            <SkillSidebar
              slots={slots}
              loadouts={loadouts}
              focusedId={focusedId}
              onFocus={focusCharacter}
              onStageClick={addEntry}
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
          onWeaponChange={setWeapon}
          onEchoChange={setEcho}
          onEchoSetChange={setEchoSet}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
