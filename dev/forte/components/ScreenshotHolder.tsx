import { useRef, useState } from "react"
import { ImageUp } from "lucide-react"

/**
 * Displays one slot's screenshot with the calibration/fill overlay on top,
 * sharing its box exactly. Empty slots show a paste/drop target. Images live
 * only in editor memory; the deliverable readings persist, the pixels don't.
 */
export function ScreenshotHolder({
  image,
  onImage,
  overlay,
}: {
  image: string | null
  onImage: (dataUrl: string) => void
  overlay?: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function readFile(file: File | null | undefined) {
    if (!file || !file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => onImage(String(reader.result))
    reader.readAsDataURL(file)
  }

  if (!image) {
    return (
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          readFile(e.dataTransfer.files[0])
        }}
        className={`flex aspect-video w-full flex-col items-center justify-center gap-2 rounded border border-dashed text-sm ${dragging ? "border-muted-foreground text-foreground" : "border-gray-700 text-muted-foreground hover:border-muted-foreground hover:text-foreground"}`}
      >
        <ImageUp className="size-5" />
        Paste (Ctrl+V), drop, or click to add a screenshot
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ""
            readFile(f)
          }}
        />
      </button>
    )
  }

  return (
    <div className="relative">
      <img
        src={image}
        alt="forte gauge screenshot"
        className="w-full rounded border border-border bg-black"
      />
      {overlay}
    </div>
  )
}
