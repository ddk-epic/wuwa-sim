import { useCallback, useState } from "react"

interface UseModalToggleOptions {
  onOpen?: () => void
  onClose?: () => void
}

interface ModalToggle {
  isOpen: boolean
  open: () => void
  close: () => void
}

/**
 * A boolean modal toggle that pairs the open/close transition with side effects.
 * `open` fires `onOpen` then opens; `close` closes then fires `onClose`. This
 * concentrates the "opening a modal pauses auto-run, closing resumes it"
 * protocol so a modal cannot be opened without running its `onOpen`.
 */
export function useModalToggle({
  onOpen,
  onClose,
}: UseModalToggleOptions = {}): ModalToggle {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => {
    onOpen?.()
    setIsOpen(true)
  }, [onOpen])

  const close = useCallback(() => {
    setIsOpen(false)
    onClose?.()
  }, [onClose])

  return { isOpen, open, close }
}
