import { createFileRoute } from "@tanstack/react-router"
import { SimulatorPage } from "#/components/SimulatorPage"

export const Route = createFileRoute("/sim")({ component: SimulatorPage })
