import { useState } from 'react'
import type { Character, Skill, SkillAttribute } from '#/types/character'

const RELEVANT_SKILL_TYPES = new Set([
  'Normal Attack',
  'Resonance Skill',
  'Resonance Liberation',
  'Forte Circuit',
  'Intro Skill',
  'Outro Skill',
  'Tune Break',
])

interface SkillSidebarProps {
  character: Character
}

export function SkillSidebar({ character }: SkillSidebarProps) {
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
