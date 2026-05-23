export class FootingTracker {
  private current_: "ground" | "air" = "ground"
  private version_ = 0

  clear(): void {
    this.current_ = "ground"
    this.version_++
  }

  current(): "ground" | "air" {
    return this.current_
  }

  setCurrent(footing: "ground" | "air"): void {
    if (this.current_ === footing) return
    this.current_ = footing
    this.version_++
  }

  mutationVersion(): number {
    return this.version_
  }
}
