import { Modal } from "#/components/ui/Modal"

interface SettingsModalProps {
  reactionDelay: number
  swapFrames: number
  variantFloor: number
  onReactionDelayChange: (value: number) => void
  onSwapFramesChange: (value: number) => void
  onVariantFloorChange: (value: number) => void
  onClose: () => void
}

export function SettingsModal({
  reactionDelay,
  swapFrames,
  variantFloor,
  onReactionDelayChange,
  onSwapFramesChange,
  onVariantFloorChange,
  onClose,
}: SettingsModalProps) {
  return (
    <Modal onClose={onClose}>
      <h2 className="text-white text-lg font-semibold mb-4">Settings</h2>
      <div className="grid grid-cols-2 gap-1 mb-4">
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
      <div className="grid grid-cols-2 gap-1 mb-4">
        <label className="text-sm text-gray-400" htmlFor="swap-frames">
          Swap Frames (frames)
        </label>
        <input
          id="swap-frames"
          type="number"
          min={0}
          max={60}
          value={swapFrames}
          onChange={(e) => onSwapFramesChange(Number(e.target.value))}
          className="w-full px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-gray-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-1 mb-6">
        <label className="text-sm text-gray-400" htmlFor="variant-floor">
          Variant Floor (frames)
        </label>
        <input
          id="variant-floor"
          type="number"
          min={0}
          max={60}
          value={variantFloor}
          onChange={(e) => onVariantFloorChange(Number(e.target.value))}
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
    </Modal>
  )
}
