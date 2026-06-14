import type { Clip } from "./types"

const keyFor = (character: string) => `wuwa.dev.frames.${character}`

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
