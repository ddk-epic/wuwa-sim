interface SettingsModalProps {
  reactionDelay: number
  onReactionDelayChange: (value: number) => void
  onClose: () => void
}

export function SettingsModal({
  reactionDelay,
  onReactionDelayChange,
  onClose,
}: SettingsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg border border-gray-700 p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-lg font-semibold mb-4">Settings</h2>
        <div className="flex flex-col gap-1 mb-6">
          <label className="text-sm text-gray-400" htmlFor="reaction-delay">
            Reaction Delay (frames)
          </label>
          <input
            id="reaction-delay"
            type="number"
            min={0}
            max={60}
            value={reactionDelay}
            onChange={(e) => onReactionDelayChange(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
        <div className="flex justify-end">
          <button
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
