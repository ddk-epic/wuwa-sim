import { createFileRoute } from "@tanstack/react-router"
import { FortePage } from "../../dev/forte/FortePage"

function DevForte() {
  if (!import.meta.env.DEV) {
    return <p className="p-6 text-sm text-muted-foreground">Not available.</p>
  }
  return <FortePage />
}

export const Route = createFileRoute("/dev/forte")({ component: DevForte })
