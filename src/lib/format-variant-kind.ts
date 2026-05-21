import type { VariantKind } from "#/types/character"

export function formatVariantKind(
  kind: VariantKind | undefined,
  style: "short" | "long",
): string | null {
  if (style === "short") {
    if (kind === "cancel") return "CNCL"
    if (kind === "instantCancel") return "INST"
    if (kind === "swap") return "SWAP"
    return "FULL"
  }
  if (kind === "cancel") return "(Cancel)"
  if (kind === "instantCancel") return "(Instant Cancel)"
  if (kind === "swap") return "(Swap)"
  return null
}
