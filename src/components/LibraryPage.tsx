import { useMemo, useState } from "react"
import { CirclePlus, Download, Settings, Upload } from "lucide-react"
import { HBtn } from "#/components/ui/HBtn"
import { IconBtn } from "#/components/ui/IconBtn"
import { DetailCard } from "#/components/library/DetailPane"
import { LibraryList } from "#/components/library/LibraryList"
import { savedTeamToLibTeam } from "#/components/library/savedTeamToLibTeam"
import { useLibrary } from "#/hooks/useLibrary"

export function LibraryPage() {
  const { teams: savedTeams } = useLibrary()
  const teams = useMemo(() => savedTeams.map(savedTeamToLibTeam), [savedTeams])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("recent")

  const selectedTeam =
    teams.find((t) => t.id === selectedId) ?? teams[0] ?? null
  const isEmpty = teams.length === 0

  return (
    <div className="w-full h-screen bg-background text-foreground font-sans text-[12px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-13 shrink-0 bg-card border-b border-border flex items-center px-4 gap-4.5">
        <div className="flex items-center gap-2.5">
          <div className="w-5.5 h-5.5 rounded-1.25 bg-[linear-gradient(135deg,#8fb4ff,#3b6fff)] flex items-center justify-center text-[12px] font-extrabold text-[#0a0b0d]">
            S
          </div>
          <span className="text-3.5 font-semibold tracking-[0.4px]">
            SIM/DECK
          </span>
          <span className="text-[9px] text-muted font-mono px-1.75 py-0.5 border border-border rounded-0.5 tracking-[1.2px]">
            LIBRARY
          </span>
        </div>
        <div className="flex-1" />
        <HBtn icon={Upload} label="import" />
        <HBtn icon={Download} label="export" />
        <HBtn icon={CirclePlus} label="New team" primary />
        <IconBtn icon={Settings} label="Settings" />
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left rail */}
        <div className="w-14 shrink-0 bg-darkest border-r border-border flex flex-col items-center py-3 gap-2"></div>

        {/* Main pane */}
        <div className="flex-1 flex flex-col min-w-0">
          <DetailCard team={selectedTeam} isEmpty={isEmpty} />
        </div>

        {/* Library list */}
        <LibraryList
          teams={teams}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          setQuery={setQuery}
          sort={sort}
          setSort={setSort}
        />
      </div>
    </div>
  )
}
