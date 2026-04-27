import { useTeam } from '#/hooks/useTeam'
import { ALL_CHARACTERS } from '#/data/characters/index'
import { ALL_WEAPONS } from '#/data/weapons/index'
import { ALL_ECHOES } from '#/data/echoes/index'
import { ALL_ECHO_SETS } from '#/data/echo-sets/index'
import { CharacterGrid } from '#/components/CharacterGrid'
import { TeamPanel } from '#/components/TeamPanel'
import { SkillSidebar } from '#/components/SkillSidebar'

export function CharacterSelector() {
  const {
    slots,
    loadouts,
    focusedId,
    selectedCount,
    toggleCharacter,
    setWeapon,
    setEcho,
    setEchoSet,
  } = useTeam()

  const focusedCharacter =
    focusedId !== null
      ? (ALL_CHARACTERS.find((c) => c.id === focusedId) ?? null)
      : null

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="flex-[65] flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Team Builder</h1>
            <p className="text-gray-400 text-sm mt-1">
              {selectedCount}/3 selected
            </p>
          </div>
          <CharacterGrid
            characters={ALL_CHARACTERS}
            slots={slots}
            focusedId={focusedId}
            onToggle={toggleCharacter}
          />
        </div>
        <div className="border-t border-gray-700 p-4 shrink-0">
          <TeamPanel
            slots={slots}
            loadouts={loadouts}
            characters={ALL_CHARACTERS}
            weapons={ALL_WEAPONS}
            echoes={ALL_ECHOES}
            echoSets={ALL_ECHO_SETS}
            onWeaponChange={setWeapon}
            onEchoChange={setEcho}
            onEchoSetChange={setEchoSet}
          />
        </div>
      </div>
      <div className="flex-[35] border-l border-gray-700 flex flex-col min-h-0">
        {focusedCharacter !== null ? (
          <SkillSidebar character={focusedCharacter} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Select a character to view skills
          </div>
        )}
      </div>
    </div>
  )
}
