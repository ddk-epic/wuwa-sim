import { useState } from 'react'
import type { Character } from '#/types/character'
import type { Slots } from '#/types/loadout'
import { ConfirmModal } from './ConfirmModal'

interface TeamBarProps {
  slots: Slots
  characters: Character[]
  onEditTeam: () => void
  onResetTimeline: () => void
}

export function TeamBar({
  slots,
  characters,
  onEditTeam,
  onResetTimeline,
}: TeamBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const label = slots
    .map((charId) => {
      if (charId === null) return '—'
      return characters.find((c) => c.id === charId)?.name ?? '—'
    })
    .join(' / ')

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 shrink-0">
      <button
        className="px-3 py-1 rounded bg-gray-800 border border-gray-700 hover:border-gray-500 text-sm text-gray-300 transition-colors"
        onClick={onEditTeam}
      >
        {label}
      </button>
      <button
        className="ml-auto px-3 py-1 rounded bg-gray-700 hover:bg-red-600 text-sm text-white transition-colors"
        onClick={() => setConfirmOpen(true)}
      >
        Reset Timeline
      </button>
      {confirmOpen && (
        <ConfirmModal
          message="Reset timeline? This cannot be undone."
          onConfirm={() => {
            onResetTimeline()
            setConfirmOpen(false)
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
