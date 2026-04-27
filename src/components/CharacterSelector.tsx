import { useState } from 'react'
import type { Character, Skill, SkillAttribute } from '#/types/character'
import type { Weapon } from '#/types/weapon'
import type { Echo, EchoSet } from '#/types/echo'
import encoreData from '#/data/characters/encore.json'
import sanhuaData from '#/data/characters/sanhua.json'
import stringmasterData from '#/data/weapons/stringmaster.json'
import infernoRiderData from '#/data/echoes/inferno-rider.json'
import moltenRiftData from '#/data/echo-sets/molten-rift.json'
import { CHARACTER_TEMPLATES } from '#/data/templates'

const CHARACTERS = [encoreData, sanhuaData] as Character[]
const ALL_WEAPONS = [stringmasterData] as Weapon[]
const ALL_ECHOES = [infernoRiderData] as Echo[]
const ALL_ECHO_SETS = [moltenRiftData] as EchoSet[]

const RELEVANT_SKILL_TYPES = new Set([
  'Normal Attack',
  'Resonance Skill',
  'Resonance Liberation',
  'Forte Circuit',
  'Intro Skill',
  'Outro Skill',
  'Tune Break',
])

const ELEMENT_CLASSES: Record<string, string> = {
  Fusion: 'border-orange-500 bg-orange-500/10',
  Glacio: 'border-cyan-400 bg-cyan-400/10',
  Electro: 'border-purple-500 bg-purple-500/10',
  Aero: 'border-green-500 bg-green-500/10',
  Havoc: 'border-violet-700 bg-violet-700/10',
  Spectro: 'border-yellow-400 bg-yellow-400/10',
}

type Slots = [number | null, number | null, number | null]

interface SlotLoadout {
  weaponId: number | null
  echoId: number | null
  echoSetId: number | null
}

const emptyLoadout = (): SlotLoadout => ({
  weaponId: null,
  echoId: null,
  echoSetId: null,
})

export function CharacterSelector() {
  const [slots, setSlots] = useState<Slots>([null, null, null])
  const [loadouts, setLoadouts] = useState<
    [SlotLoadout, SlotLoadout, SlotLoadout]
  >([emptyLoadout(), emptyLoadout(), emptyLoadout()])
  const [focusedId, setFocusedId] = useState<number | null>(null)

  const focusedCharacter =
    focusedId !== null
      ? (CHARACTERS.find((c) => c.id === focusedId) ?? null)
      : null

  const selectedCount = slots.filter((s) => s !== null).length

  function handleCardClick(characterId: number) {
    const slotIndex = slots.indexOf(characterId)
    if (slotIndex !== -1) {
      const newSlots: Slots = [slots[0], slots[1], slots[2]]
      newSlots[slotIndex] = null
      setSlots(newSlots)
      setLoadouts((prev) => {
        const next: [SlotLoadout, SlotLoadout, SlotLoadout] = [
          prev[0],
          prev[1],
          prev[2],
        ]
        next[slotIndex] = emptyLoadout()
        return next
      })
      if (focusedId === characterId) {
        const others = newSlots.filter((id): id is number => id !== null)
        setFocusedId(others.length > 0 ? others[others.length - 1] : null)
      }
    } else {
      const nullSlot = slots.indexOf(null)
      if (nullSlot === -1) return
      const newSlots: Slots = [slots[0], slots[1], slots[2]]
      newSlots[nullSlot] = characterId
      setSlots(newSlots)
      const template = CHARACTER_TEMPLATES.find(
        (t) => t.characterId === characterId,
      )
      setLoadouts((prev) => {
        const next: [SlotLoadout, SlotLoadout, SlotLoadout] = [
          prev[0],
          prev[1],
          prev[2],
        ]
        next[nullSlot] = template
          ? {
              weaponId: template.weaponId,
              echoId: template.echoId,
              echoSetId: template.echoSetId,
            }
          : emptyLoadout()
        return next
      })
      setFocusedId(characterId)
    }
  }

  function handleWeaponChange(slotIndex: number, weaponId: number) {
    setLoadouts((prev) => {
      const next: [SlotLoadout, SlotLoadout, SlotLoadout] = [
        prev[0],
        prev[1],
        prev[2],
      ]
      next[slotIndex] = { ...next[slotIndex], weaponId }
      return next
    })
  }

  function handleEchoChange(slotIndex: number, echoId: number) {
    const echo = ALL_ECHOES.find((e) => e.id === echoId)
    const matchingSet = echo
      ? ALL_ECHO_SETS.find((s) => s.name === echo.set)
      : null
    setLoadouts((prev) => {
      const next: [SlotLoadout, SlotLoadout, SlotLoadout] = [
        prev[0],
        prev[1],
        prev[2],
      ]
      next[slotIndex] = {
        ...next[slotIndex],
        echoId,
        echoSetId: matchingSet?.id ?? next[slotIndex].echoSetId,
      }
      return next
    })
  }

  function handleEchoSetChange(slotIndex: number, echoSetId: number) {
    setLoadouts((prev) => {
      const next: [SlotLoadout, SlotLoadout, SlotLoadout] = [
        prev[0],
        prev[1],
        prev[2],
      ]
      next[slotIndex] = { ...next[slotIndex], echoSetId }
      return next
    })
  }

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
          <div className="grid grid-cols-4 gap-2">
            {CHARACTERS.map((character) => {
              const slotIndex = slots.indexOf(character.id)
              return (
                <CharacterCard
                  key={character.id}
                  character={character}
                  slotNumber={slotIndex !== -1 ? slotIndex + 1 : null}
                  isFocused={focusedId === character.id}
                  isBlocked={slotIndex === -1 && selectedCount === 3}
                  onClick={() => handleCardClick(character.id)}
                />
              )
            })}
          </div>
        </div>
        <div className="border-t border-gray-700 p-4 shrink-0">
          <TeamPanel
            slots={slots}
            loadouts={loadouts}
            onWeaponChange={handleWeaponChange}
            onEchoChange={handleEchoChange}
            onEchoSetChange={handleEchoSetChange}
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

interface CharacterCardProps {
  character: Character
  slotNumber: number | null
  isFocused: boolean
  isBlocked: boolean
  onClick: () => void
}

function CharacterCard({
  character,
  slotNumber,
  isFocused,
  isBlocked,
  onClick,
}: CharacterCardProps) {
  const elementBorder =
    ELEMENT_CLASSES[character.element] ?? 'border-gray-600 bg-gray-700/10'

  return (
    <div
      className={[
        'relative rounded border-2 px-2 py-1.5 transition-all select-none',
        elementBorder,
        isFocused ? 'ring-2 ring-white/60' : '',
        isBlocked
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-pointer hover:brightness-110',
      ].join(' ')}
      onClick={isBlocked ? undefined : onClick}
    >
      {slotNumber !== null && (
        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white text-gray-900 text-[10px] font-bold rounded-full flex items-center justify-center">
          {slotNumber}
        </div>
      )}
      <div className="text-xs font-medium text-white truncate">
        {character.name}
      </div>
    </div>
  )
}

interface TeamPanelProps {
  slots: Slots
  loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
  onWeaponChange: (slotIndex: number, weaponId: number) => void
  onEchoChange: (slotIndex: number, echoId: number) => void
  onEchoSetChange: (slotIndex: number, echoSetId: number) => void
}

function TeamPanel({
  slots,
  loadouts,
  onWeaponChange,
  onEchoChange,
  onEchoSetChange,
}: TeamPanelProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Team
      </p>
      <div className="flex gap-3">
        {slots.map((charId, i) => {
          const character =
            charId !== null
              ? (CHARACTERS.find((c) => c.id === charId) ?? null)
              : null
          return (
            <TeamSlot
              key={i}
              slotNumber={i + 1}
              character={character}
              loadout={loadouts[i]}
              onWeaponChange={(weaponId) => onWeaponChange(i, weaponId)}
              onEchoChange={(echoId) => onEchoChange(i, echoId)}
              onEchoSetChange={(echoSetId) => onEchoSetChange(i, echoSetId)}
            />
          )
        })}
      </div>
    </div>
  )
}

interface TeamSlotProps {
  slotNumber: number
  character: Character | null
  loadout: SlotLoadout
  onWeaponChange: (weaponId: number) => void
  onEchoChange: (echoId: number) => void
  onEchoSetChange: (echoSetId: number) => void
}

function TeamSlot({
  slotNumber,
  character,
  loadout,
  onWeaponChange,
  onEchoChange,
  onEchoSetChange,
}: TeamSlotProps) {
  if (character === null) {
    return (
      <div className="flex-1 border border-dashed border-gray-700 rounded p-3 flex items-center justify-center min-h-[88px]">
        <span className="text-gray-600 text-xs">Slot {slotNumber}</span>
      </div>
    )
  }

  const compatibleWeapons = ALL_WEAPONS.filter(
    (w) => w.weaponType === character.weaponType,
  )

  return (
    <div className="flex-1 bg-gray-800 border border-gray-700 rounded p-3 space-y-1.5">
      <div className="text-xs font-semibold text-white mb-2">
        {character.name}
      </div>
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.weaponId ?? ''}
        onChange={(e) => onWeaponChange(Number(e.target.value))}
      >
        <option value="">— Weapon —</option>
        {compatibleWeapons.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.echoId ?? ''}
        onChange={(e) => onEchoChange(Number(e.target.value))}
      >
        <option value="">— Echo —</option>
        {ALL_ECHOES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
        value={loadout.echoSetId ?? ''}
        onChange={(e) => onEchoSetChange(Number(e.target.value))}
      >
        <option value="">— Echo Set —</option>
        {ALL_ECHO_SETS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function SkillSidebar({ character }: { character: Character }) {
  const skills = character.skills.filter((s) =>
    RELEVANT_SKILL_TYPES.has(s.type),
  )
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-gray-700 shrink-0">
        <div className="font-bold text-lg">{character.name}</div>
        <div className="text-sm text-gray-400">
          {character.element} · {character.rarity}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {skills.map((skill) => (
          <SkillEntry key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  )
}

function SkillEntry({ skill }: { skill: Skill }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-700 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <div className="font-medium text-sm text-white">{skill.name}</div>
          <div className="text-xs text-gray-500">{skill.type}</div>
        </div>
        <span className="text-gray-400 text-xs ml-2 shrink-0">
          {expanded ? '▲' : '▼'}
        </span>
      </button>
      {expanded && <SkillDetail skill={skill} />}
    </div>
  )
}

function SkillDetail({ skill }: { skill: Skill }) {
  return (
    <div className="px-3 pb-3 border-t border-gray-700 space-y-2">
      {skill.cooldown !== undefined && (
        <div className="text-xs text-gray-400 pt-2">
          Cooldown: {skill.cooldown}s
        </div>
      )}
      {skill.stages.length > 0 ? (
        <div className="pt-2 space-y-2">
          {skill.stages.map((stage, i) => (
            <StageRow key={i} stage={stage} />
          ))}
        </div>
      ) : skill.damage.length > 0 ? (
        <div className="pt-2 space-y-1">
          {skill.damage.map((d, i) => (
            <div key={i} className="text-xs text-gray-400">
              {d.type}: {(d.value * 100).toFixed(2)}% {d.scalingStat}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-500 pt-2">No data available</div>
      )}
    </div>
  )
}

function StageRow({ stage }: { stage: SkillAttribute }) {
  return (
    <div>
      <div className="text-sm text-gray-200 font-medium">{stage.name}</div>
      <div className="text-xs text-gray-400">{stage.value}</div>
      {stage.staCost !== undefined && (
        <div className="text-xs text-gray-500">Stamina: {stage.staCost}</div>
      )}
    </div>
  )
}
