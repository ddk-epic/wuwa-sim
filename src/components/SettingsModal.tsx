import { Modal } from "#/components/ui/Modal"
import { Stepper } from "#/components/ui/Stepper"
import { DEFAULT_SETTINGS } from "#/lib/settings"
import type { Settings } from "#/lib/settings"
import { useAtomValue, useSetAtom } from "jotai"
import { settingsAtom } from "#/state/team"
import { autoRunAtom, defaultLogVariantAtom } from "#/state/preferences"
import type { LogVariant } from "#/types/simulation-log"

/** Frame values step 3 at a time, 0–30 (≤0.5s). All defaults land on this grid. */
const FRAME_OPTIONS: number[] = Array.from({ length: 11 }, (_, i) => i * 3)

type FrameField = {
  [K in keyof Settings]: Settings[K] extends number ? K : never
}[keyof Settings]

const FRAME_FIELDS: { key: FrameField; label: string }[] = [
  { key: "reactionDelay", label: "Reaction Delay (frames)" },
  { key: "swapFrames", label: "Swap Frames (frames)" },
  { key: "variantFloor", label: "Variant Floor (frames)" },
  { key: "fallFrames", label: "Fall Frames (frames)" },
]

function SectionHeader({
  title,
  onReset,
}: {
  title: string
  onReset?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-[1px] text-muted-foreground/70">
        {title}
      </h3>
      {onReset && (
        <button
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={onReset}
        >
          Reset to defaults
        </button>
      )}
    </div>
  )
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm text-gray-400">{label}</span>
      <div
        className="flex h-7 rounded-sm border border-gray-700 overflow-hidden font-mono text-sm"
        role="group"
        aria-label={label}
      >
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              className={`px-3 transition-colors ${
                active
                  ? "bg-yellow-400 font-semibold text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useAtomValue(settingsAtom)
  const setSettings = useSetAtom(settingsAtom)
  const autoRun = useAtomValue(autoRunAtom)
  const setAutoRun = useSetAtom(autoRunAtom)
  const defaultLogVariant = useAtomValue(defaultLogVariantAtom)
  const setDefaultLogVariant = useSetAtom(defaultLogVariantAtom)

  return (
    <Modal onClose={onClose} title="Settings">
      <SectionHeader title="Interface" />
      <SegmentedControl
        label="Run mode"
        value={autoRun ? "auto" : "manual"}
        options={[
          { value: "manual", label: "Manual" },
          { value: "auto", label: "Auto" },
        ]}
        onChange={(v) => setAutoRun(v === "auto")}
      />
      <SegmentedControl<LogVariant>
        label="Default log"
        value={defaultLogVariant}
        options={[
          { value: "table", label: "Table" },
          { value: "timeline", label: "Timeline" },
        ]}
        onChange={(v) => setDefaultLogVariant(v)}
      />

      <div className="border-t border-border my-4" />

      <SectionHeader
        title="Simulation"
        onReset={() => setSettings(DEFAULT_SETTINGS)}
      />
      <label className="flex items-center gap-1 mb-4 cursor-pointer select-none">
        <span className="flex-1 text-sm text-gray-400">
          Start with full energy
        </span>
        <input
          type="checkbox"
          className="accent-yellow-400 w-5 h-5"
          checked={settings.startWithFullEnergy}
          onChange={(e) =>
            setSettings({ startWithFullEnergy: e.target.checked })
          }
        />
      </label>
      <label className="flex items-center gap-1 mb-4 cursor-pointer select-none">
        <span className="flex-1 text-sm text-gray-400">
          Start with full concerto
        </span>
        <input
          type="checkbox"
          className="accent-yellow-400 w-5 h-5"
          checked={settings.startWithFullConcerto}
          onChange={(e) =>
            setSettings({ startWithFullConcerto: e.target.checked })
          }
        />
      </label>
      {FRAME_FIELDS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1 mb-4">
          <label className="flex-1 text-sm text-gray-400">{label}</label>
          <div className="w-34">
            <Stepper
              options={FRAME_OPTIONS}
              value={settings[key]}
              onChange={(v) => setSettings({ [key]: v })}
              dense={true}
              wrap={false}
            />
          </div>
        </div>
      ))}
    </Modal>
  )
}
