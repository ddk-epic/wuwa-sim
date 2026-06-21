// Converts a rotation expressed in code into the app's import/export share code,
// or decodes a share code back to readable JSON. Dev-only; never shipped.
//   pnpm -s gen:sharecode            encode tmp/sharecode.ts → print code
//   pnpm -s gen:sharecode decode <code>   print decoded payload as JSON
// Use `-s` so pnpm's banner stays off stdout and the code captures cleanly.
// The scratch file is input-only and gitignored; first run seeds a template.
import { existsSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { encodePayload, decodePayload } from "#/lib/import-export"
import type { ImportExportPayload } from "#/lib/import-export"
import { DEFAULT_SETTINGS } from "#/lib/settings"
import type { Settings } from "#/lib/settings"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineNode, TimelineEntry } from "#/types/timeline"

const SCRATCH = resolve(import.meta.dirname, "..", "tmp", "sharecode.ts")

type SpecEntry = Pick<TimelineEntry, "characterId" | "stageId" | "variantKind">

interface RotationSpec {
  slots: Slots
  loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
  entries: SpecEntry[]
  settings?: Partial<Settings>
  name?: string
  focusedId?: number | null
}

const SCAFFOLD = `// Fill in a team + rotation, then run \`pnpm -s gen:sharecode\` to print the code.
// Quickest start: paste a slots / loadouts / entries block out of a character's
// *.test.ts — use loadoutFromTemplate(<char>.template) for the lead and
// emptyLoadout() for empty slots. \`entries\` need only characterId + stageId
// (+ optional variantKind); the share code ignores entry ids.
// Stage-id grammar: char.<char>.<skill-category>.<skillKey>.<stageKey>::<skill-type>
import { emptyLoadout } from "#/lib/loadout/template"

// ────── Full reference: Encore S6 forte rotation ──────
// import { encore } from "#/data/characters/encore"
// import { emptyLoadout, loadoutFromTemplate } from "#/lib/loadout/template"
//
// const ENCORE = 1203
// const STAGE = {
//   intro: "char.encore.intro-skill.woolies-helpers.cast::intro-skill",
//   flamingWoolies: "char.encore.resonance-skill.flaming-woolies.flaming-woolies::resonance-skill",
//   energeticWelcome: "char.encore.resonance-skill.flaming-woolies.energetic-welcome::resonance-skill",
//   lib: "char.encore.resonance-liberation.cosmos-rave.cast::resonance-liberation",
//   frolicking1: "char.encore.basic-attack.cosmos-rave.cosmos-frolicking-stage-1::basic-attack",
//   frolicking2: "char.encore.basic-attack.cosmos-rave.cosmos-frolicking-stage-2::basic-attack",
//   frolicking3: "char.encore.basic-attack.cosmos-rave.cosmos-frolicking-stage-3::basic-attack",
//   frolicking4: "char.encore.basic-attack.cosmos-rave.stage-4::basic-attack",
//   rampage: "char.encore.resonance-skill.cosmos-rave.cosmos-rampage::resonance-skill",
//   cosmosRupture: "char.encore.heavy-attack.black-white-woolies.cosmos-rupture::resonance-liberation",
//   outro: "char.encore.outro-skill.thermal-field.cast::outro-skill",
// }
//
// export default {
//   slots: [ENCORE, null, null],
//   loadouts: [
//     { ...loadoutFromTemplate(encore.template), sequence: 6 },
//     emptyLoadout(),
//     emptyLoadout(),
//   ],
//   entries: [
//     { characterId: ENCORE, stageId: STAGE.intro },
//     { characterId: ENCORE, stageId: STAGE.flamingWoolies },
//     { characterId: ENCORE, stageId: STAGE.energeticWelcome },
//     { characterId: ENCORE, stageId: STAGE.lib },
//     { characterId: ENCORE, stageId: STAGE.frolicking1 },
//     { characterId: ENCORE, stageId: STAGE.frolicking2 },
//     { characterId: ENCORE, stageId: STAGE.frolicking3 },
//     { characterId: ENCORE, stageId: STAGE.frolicking4 },
//     { characterId: ENCORE, stageId: STAGE.rampage },
//     { characterId: ENCORE, stageId: STAGE.cosmosRupture },
//     { characterId: ENCORE, stageId: STAGE.outro },
//   ],
//   settings: { startWithFullEnergy: true },
// }

export default {
  slots: [0, null, null],
  loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
  entries: [{ characterId: 0, stageId: "char....::..." }],
  // settings: { startWithFullEnergy: true },
}
`

function assemble(spec: RotationSpec): ImportExportPayload {
  const timeline: TimelineNode[] = spec.entries.map((e) => ({
    kind: "entry",
    id: crypto.randomUUID(),
    ...e,
  }))
  return {
    team: {
      name: spec.name ?? "gen:sharecode",
      slots: spec.slots,
      loadouts: spec.loadouts,
      focusedId: spec.focusedId ?? null,
      settings: { ...DEFAULT_SETTINGS, ...spec.settings },
    },
    timeline,
  }
}

async function encode(): Promise<void> {
  if (!existsSync(SCRATCH)) {
    writeFileSync(SCRATCH, SCAFFOLD)
    console.error(
      `seeded ${SCRATCH} — edit it, then re-run \`pnpm -s gen:sharecode\``,
    )
    return
  }
  const mod = (await import(pathToFileURL(SCRATCH).href)) as {
    default?: unknown
  }
  const spec: Record<string, unknown> =
    typeof mod.default === "object" && mod.default !== null
      ? (mod.default as Record<string, unknown>)
      : {}
  if (
    !Array.isArray(spec.entries) ||
    !Array.isArray(spec.slots) ||
    spec.slots.length !== 3 ||
    !Array.isArray(spec.loadouts)
  ) {
    throw new Error(
      `${SCRATCH} must default-export { slots, loadouts, entries }`,
    )
  }
  console.log(encodePayload(assemble(spec as unknown as RotationSpec)))
}

function decode(code: string | undefined): void {
  if (!code) throw new Error("usage: pnpm gen:sharecode decode <code>")
  console.log(JSON.stringify(decodePayload(code), null, 2))
}

const [mode, arg] = process.argv.slice(2)
if (mode === "decode") {
  decode(arg)
} else {
  await encode()
}
