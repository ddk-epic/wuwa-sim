const COMBINING_MARKS = /[\u0300-\u036f]/g

// Slug is the on-disk primary key: raw JSON filename, module filename, catalog key.
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    // Decompose first: stripping an accented letter outright would drop the vowel.
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")

  // Empty slug would write a dotfile and collide with every other empty one.
  if (!slug) throw new Error(`Name "${name}" has no sluggable characters`)
  return slug
}

// Module export name for a slug; must match what the generators emit so index
// wiring references the right binding.
export function toVarName(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}
