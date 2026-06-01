import { Link } from "@tanstack/react-router"
import { Gauge, Library } from "lucide-react"

/**
 * Barebones landing scaffold at `/`. The simulator now lives at `/sim` and the
 * Library at `/library`; this page just routes between them. The full landing
 * experience is planned for a later slice.
 */
export function LandingPage() {
  return (
    <div className="w-full min-h-screen bg-background text-foreground font-sans flex flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-extrabold tracking-[0.4px]">SIM/DECK</h1>
        <p className="text-muted text-sm">Wuthering Waves rotation simulator</p>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/sim"
          className="flex items-center gap-2 px-5 py-3 rounded-md bg-card border border-border no-underline text-foreground hover:border-foreground transition-colors"
        >
          <Gauge size={18} />
          <span className="font-semibold">Simulator</span>
        </Link>
        <Link
          to="/library"
          className="flex items-center gap-2 px-5 py-3 rounded-md bg-card border border-border no-underline text-foreground hover:border-foreground transition-colors"
        >
          <Library size={18} />
          <span className="font-semibold">Library</span>
        </Link>
      </nav>
    </div>
  )
}
