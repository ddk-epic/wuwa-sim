import { useEffect, useMemo, useRef, useState } from "react"
import { ClipboardIcon, ImageIcon } from "lucide-react"
import { toBlob, toPng } from "html-to-image"
import { useAtomValue } from "jotai"
import { Modal } from "#/components/ui/Modal"
import { AcknowledgeButton } from "#/components/ui/AcknowledgeButton"
import { slotsAtom } from "#/state/team"
import { rotationCards } from "#/lib/share/rotation-cards"
import { getCharacterById } from "#/lib/loadout/catalog"
import type { TimelineNode } from "#/types/timeline"
import type { Slots } from "#/types/loadout"
import { ShareCard } from "./ShareCard"
import type { ShareTheme } from "./ShareCard"

interface ShareImageModalProps {
  nodes: TimelineNode[]
  rotationSeconds: number
  onClose: () => void
}

const WORK_MS = 6000 // watchdog: force re-enable if a rasterize overruns

function fileName(slots: Slots) {
  const names = slots
    .filter((id): id is number => id !== null)
    .map((id) => getCharacterById(id)?.name.toLowerCase() ?? `${id}`)
  return names.length > 0 ? `${names.join("-")}-rotation` : "rotation"
}

export function ShareImageModal({
  nodes,
  rotationSeconds,
  onClose,
}: ShareImageModalProps) {
  const slots = useAtomValue(slotsAtom)
  const cards = useMemo(() => rotationCards(nodes), [nodes])
  const previewRef = useRef<HTMLDivElement>(null)
  const [showDuration, setShowDuration] = useState(true)
  const [theme, setTheme] = useState<ShareTheme>("dark")
  const [downloadWorking, setDownloadWorking] = useState(false)
  const downloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (downloadTimer.current) clearTimeout(downloadTimer.current)
    },
    [],
  )

  async function handleDownload() {
    if (!previewRef.current || downloadWorking) return
    setDownloadWorking(true)
    // Watchdog: a hung rasterize can't leave the button disabled forever.
    downloadTimer.current = setTimeout(() => setDownloadWorking(false), WORK_MS)
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
      clearTimeout(downloadTimer.current)
      setDownloadWorking(false)
    }
  }

  async function handleCopy() {
    if (!previewRef.current) return
    try {
      const blob = await toBlob(previewRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      })
      if (!blob) throw new Error()
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ])
    } catch {
      throw new Error("Couldn't copy to clipboard — try again")
    }
  }

  return (
    <Modal variant="fullscreen" title="Share image" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 font-mono text-sm text-muted-foreground">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={showDuration}
                onChange={(e) => setShowDuration(e.target.checked)}
              />
              <span>Duration</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={theme === "light"}
                onChange={(e) => setTheme(e.target.checked ? "light" : "dark")}
              />
              <span>Light theme</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <AcknowledgeButton
              icon={ClipboardIcon}
              label="Copy"
              onClick={handleCopy}
              maxLock={WORK_MS}
            />
            <button
              className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-mono text-sm text-muted-foreground enabled:hover:text-foreground disabled:opacity-50"
              onClick={handleDownload}
              disabled={downloadWorking}
            >
              <ImageIcon className="h-4 w-4" />
              <span>Download PNG</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div ref={previewRef} className="mx-auto w-max">
            <ShareCard
              cards={cards}
              slots={slots}
              seconds={showDuration ? rotationSeconds : undefined}
              theme={theme}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
