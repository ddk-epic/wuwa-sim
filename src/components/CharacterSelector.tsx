import { useState } from 'react'
import { useTeam } from '#/hooks/useTeam'
import { useTimeline } from '#/hooks/useTimeline'
import { ALL_CHARACTERS } from '#/data/characters/index'
import { ALL_WEAPONS } from '#/data/weapons/index'
import { ALL_ECHOES } from '#/data/echoes/index'
import { ALL_ECHO_SETS } from '#/data/echo-sets/index'
import { SkillSidebar } from '#/components/SkillSidebar'
import { TeamBar } from '#/components/TeamBar'
import { TeamModal } from '#/components/TeamModal'
import { TimelineView } from '#/components/TimelineView'

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

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <TeamBar
        slots={slots}
        characters={ALL_CHARACTERS}
        onEditTeam={() => setModalOpen(true)}
        onResetTimeline={clearTimeline}
        timelineEmpty={entries.length === 0}
      />
      <div className="flex flex-1 min-h-0">
        <div className="flex-[70] flex flex-col min-h-0">
          <TimelineView
            entries={entries}
            characters={ALL_CHARACTERS}
            onRemove={removeEntry}
          />
        </div>
        <div className="flex-[30] border-l border-gray-700 flex flex-col min-h-0">
          {slots.some((id) => id !== null) ? (
            <SkillSidebar
              slots={slots}
              characters={ALL_CHARACTERS}
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
          characters={ALL_CHARACTERS}
          weapons={ALL_WEAPONS}
          echoes={ALL_ECHOES}
          echoSets={ALL_ECHO_SETS}
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
