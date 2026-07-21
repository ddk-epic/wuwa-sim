const COMBINING_MARKS = /[\u0300-\u036f]/g

// Slug is the on-disk primary key: raw JSON filename, module filename, catalog key.
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      // Decompose first: stripping an accented letter outright would drop the vowel.
      .normalize("NFD")
      .replace(COMBINING_MARKS, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
  )
}
