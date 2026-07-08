import { uid } from "../frames/shared"
import type { StageRef } from "../frames/stage-ref"
import type { ForteClip } from "./clip"
import type { Calibration } from "./calibration"

const keyFor = (character: string) => `wuwa.dev.forte.${character}`
const SELECTED_KEY = "wuwa.dev.forte.selected"
const CALIBRATION_KEY = "wuwa.dev.forte.lastCalibration"

export function loadSelectedCharacter(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

export function saveSelectedCharacter(character: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SELECTED_KEY, character)
  } catch {
    // ignore write failures (quota, private mode)
  }
}

export function loadLastCalibration(): Calibration | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CALIBRATION_KEY)
    return raw ? (JSON.parse(raw) as Calibration) : null
  } catch {
    return null
  }
}

export function saveLastCalibration(cal: Calibration): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CALIBRATION_KEY, JSON.stringify(cal))
  } catch {
    // ignore write failures (quota, private mode)
  }
}

export function loadClips(character: string): ForteClip[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(keyFor(character))
    if (!raw) return []
    return (JSON.parse(raw) as unknown[]).map(normalizeClip)
  } catch {
    return []
  }
}

export function saveClips(character: string, clips: ForteClip[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(keyFor(character), JSON.stringify(clips))
  } catch {
    // ignore write failures (quota, private mode)
  }
}

// Clips saved under the retired frame model carried `stageRefs` + frame-keyed
// separators. The readings are meaningless without that timeline, so keep only
// the name, sequence, and calibration; drop the separators.
function normalizeClip(raw: unknown): ForteClip {
  const c = raw as Record<string, unknown>
  if (Array.isArray(c.slots)) return raw as ForteClip
  const stageRefs = (
    Array.isArray(c.stageRefs) ? c.stageRefs : []
  ) as StageRef[]
  return {
    id: String(c.id ?? uid()),
    name: typeof c.name === "string" ? c.name : "",
    slots: stageRefs.map((ref) => ({ id: uid(), ref })),
    calibration: c.calibration as Calibration | undefined,
    stagesLocked: c.stagesLocked === true ? true : undefined,
  }
}
