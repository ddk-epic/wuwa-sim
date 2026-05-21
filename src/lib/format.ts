export function formatFrames(frames: number): string {
  return (frames / 60).toFixed(2) + "s"
}
