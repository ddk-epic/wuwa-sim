import { createFileRoute } from "@tanstack/react-router"
import { FramesPage } from "#/dev/frames/FramesPage"

function DevFrames() {
  if (!import.meta.env.DEV) {
    return <p className="p-6 text-sm text-muted-foreground">Not available.</p>
  }
  return <FramesPage />
}

export const Route = createFileRoute("/dev/frames")({ component: DevFrames })
