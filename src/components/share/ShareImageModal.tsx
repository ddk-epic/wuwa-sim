import { useEffect, useMemo, useRef, useState } from "react"
import {
  CheckIcon,
  ClipboardIcon,
  ImageIcon,
  TriangleAlert,
} from "lucide-react"
import { toBlob, toPng } from "html-to-image"
import { useAtomValue } from "jotai"
import { Modal } from "#/components/ui/Modal"
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
const CONFIRM_MS = 1500 // success check dwell, matching Save/Export
const WARN_MS = 3000 // failure warning dwell, longer so it isn't missed

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
  const [copyState, setCopyState] = useState<
    "idle" | "working" | "done" | "failed"
  >("idle")
  const [downloadWorking, setDownloadWorking] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const downloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clear(timer: typeof copyTimer) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(
    () => () => {
      clear(copyTimer)
      clear(downloadTimer)
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
      clear(downloadTimer)
      setDownloadWorking(false)
    }
  }

  async function handleCopy() {
    if (!previewRef.current || copyState === "working" || copyState === "done")
      return
    setCopyState("working")
    copyTimer.current = setTimeout(() => setCopyState("idle"), WORK_MS)
    try {
      const blob = await toBlob(previewRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      })
      if (!blob) throw new Error("rasterization produced no image")
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ])
      clear(copyTimer)
      setCopyState("done")
      copyTimer.current = setTimeout(() => setCopyState("idle"), CONFIRM_MS)
    } catch {
      clear(copyTimer)
      setCopyState("failed")
      copyTimer.current = setTimeout(() => setCopyState("idle"), WARN_MS)
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
            <button
              className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-mono text-sm text-muted-foreground enabled:hover:text-foreground disabled:opacity-50"
              onClick={handleCopy}
              disabled={copyState === "working" || copyState === "done"}
              title={
                copyState === "failed"
                  ? "Couldn't copy to clipboard — try again"
                  : undefined
              }
            >
              {copyState === "done" ? (
                <CheckIcon className="h-4 w-4 text-green-400" />
              ) : copyState === "failed" ? (
                <TriangleAlert className="h-4 w-4 text-amber-400" />
              ) : (
                <ClipboardIcon className="h-4 w-4" />
              )}
              <span>Copy</span>
            </button>
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
          <div ref={previewRef} className="w-max">
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
