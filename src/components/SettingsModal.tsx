import { Modal } from "#/components/ui/Modal"
import { Stepper } from "#/components/ui/Stepper"
import type { Settings } from "#/hooks/useSettings"
import {
  useSettingsValue,
  useSettingsActions,
} from "#/hooks/useSettingsContext"
import {
  useAutoRunPreference,
  useUiPreferencesActions,
} from "#/hooks/useUiPreferencesContext"

/** Frame values step 3 at a time, 0–30 (≤0.5s). All defaults land on this grid. */
const FRAME_OPTIONS: number[] = Array.from({ length: 11 }, (_, i) => i * 3)

const FRAME_FIELDS: { key: keyof Settings; label: string }[] = [
  { key: "reactionDelay", label: "Reaction Delay (frames)" },
  { key: "swapFrames", label: "Swap Frames (frames)" },
  { key: "variantFloor", label: "Variant Floor (frames)" },
  { key: "fallFrames", label: "Fall Frames (frames)" },
]

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useSettingsValue()
  const { setSettings } = useSettingsActions()
  const autoRun = useAutoRunPreference()
  const { setPreferences } = useUiPreferencesActions()

  return (
    <Modal onClose={onClose} title="Settings">
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
      <div className="border-t border-border my-4" />
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Run mode</span>
        <div
          className="flex rounded-sm border border-gray-700 overflow-hidden font-mono text-sm"
          role="group"
          aria-label="Run mode"
        >
          <button
            className={`px-3 py-1 transition-colors ${
              !autoRun
                ? "bg-gray-700 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setPreferences({ autoRun: false })}
            aria-pressed={!autoRun}
          >
            Manual
          </button>
          <button
            className={`px-3 py-1 transition-colors ${
              autoRun
                ? "bg-gray-700 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setPreferences({ autoRun: true })}
            aria-pressed={autoRun}
          >
            Auto
          </button>
        </div>
      </div>
    </Modal>
  )
}
