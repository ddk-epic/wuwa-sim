import type { Clip } from "./types"

const keyFor = (character: string) => `wuwa.dev.frames.${character}`
const SELECTED_KEY = "wuwa.dev.frames.selected"

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

export function loadClips(character: string): Clip[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(keyFor(character))
    return raw ? (JSON.parse(raw) as Clip[]) : []
  } catch {
    return []
  }
}

export function saveClips(character: string, clips: Clip[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(keyFor(character), JSON.stringify(clips))
  } catch {
    // ignore write failures (quota, private mode)
  }
}
