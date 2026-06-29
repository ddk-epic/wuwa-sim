import { useMemo, useRef, useState } from "react"
import { ImageIcon } from "lucide-react"
import { toPng } from "html-to-image"
import { useAtomValue } from "jotai"
import { Modal } from "#/components/ui/Modal"
import { slotsAtom } from "#/state/team"
import { rotationCards } from "#/lib/share/rotation-cards"
import { getCharacterById } from "#/lib/loadout/catalog"
import type { TimelineNode } from "#/types/timeline"
import type { Slots } from "#/types/loadout"
import { ShareCard } from "./ShareCard"

interface ShareImageModalProps {
  nodes: TimelineNode[]
  onClose: () => void
}

function fileName(slots: Slots) {
  const names = slots
    .filter((id): id is number => id !== null)
    .map((id) => getCharacterById(id)?.name.toLowerCase() ?? `${id}`)
  return names.length > 0 ? `${names.join("-")}-rotation` : "rotation"
}

export function ShareImageModal({ nodes, onClose }: ShareImageModalProps) {
  const slots = useAtomValue(slotsAtom)
  const cards = useMemo(() => rotationCards(nodes), [nodes])
  const previewRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleDownload() {
    if (!previewRef.current || busy) return
    setBusy(true)
    try {
      const dataUrl = await toPng(previewRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      })
      const link = document.createElement("a")
      link.download = `${fileName(slots)}.png`
      link.href = dataUrl
      link.click()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal variant="fullscreen" title="Share image" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <div ref={previewRef} className="w-max">
            <ShareCard cards={cards} slots={slots} />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-mono text-sm text-muted-foreground enabled:hover:text-foreground disabled:opacity-50"
            onClick={handleDownload}
            disabled={busy}
          >
            <ImageIcon className="h-4 w-4" />
            <span>Download PNG</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
