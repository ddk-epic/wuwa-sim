import { Modal } from "#/components/ui/Modal"

interface ConfirmModalProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal onClose={onCancel}>
      <p className="text-white mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 bg-gray-700 hover:bg-red-600 text-white rounded transition-colors"
          onClick={onConfirm}
        >
          Confirm
        </button>
      </div>
    </Modal>
  )
}
