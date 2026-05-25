import { Modal } from "#/components/ui/Modal"

interface SettingsModalProps {
  reactionDelay: number
  swapFrames: number
  variantFloor: number
  fallFrames: number
  onReactionDelayChange: (value: number) => void
  onSwapFramesChange: (value: number) => void
  onVariantFloorChange: (value: number) => void
  onFallFramesChange: (value: number) => void
  onClose: () => void
}

export function SettingsModal({
  reactionDelay,
  swapFrames,
  variantFloor,
  fallFrames,
  onReactionDelayChange,
  onSwapFramesChange,
  onVariantFloorChange,
  onFallFramesChange,
  onClose,
}: SettingsModalProps) {
  return (
    <Modal onClose={onClose} title="Settings">
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
      <div className="grid grid-cols-2 gap-1 mb-4">
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
      <div className="grid grid-cols-2 gap-1 mb-6">
        <label className="text-sm text-gray-400" htmlFor="fall-frames">
          Fall Frames (frames)
        </label>
        <input
          id="fall-frames"
          type="number"
          min={0}
          max={60}
          value={fallFrames}
          onChange={(e) => onFallFramesChange(Number(e.target.value))}
          className="w-full px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-gray-500"
        />
      </div>
    </Modal>
  )
}
