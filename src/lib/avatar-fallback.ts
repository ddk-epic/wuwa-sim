export function avatarFallbackSrc(initial: string, hex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26"><circle cx="13" cy="13" r="13" fill="${hex}"/><text x="13" y="18" text-anchor="middle" font-size="13" font-weight="800" fill="#0a0b0d">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
