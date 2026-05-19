export type Element =
  | "Fusion"
  | "Glacio"
  | "Electro"
  | "Aero"
  | "Havoc"
  | "Spectro"
  | "Physical"

export const ELEMENTS: readonly Element[] = [
  "Fusion",
  "Glacio",
  "Electro",
  "Aero",
  "Havoc",
  "Spectro",
  "Physical",
] as const

export const ELEMENT_CLASSES: Partial<Record<Element, string>> = {
  Fusion: "border-orange-500 bg-orange-500/10",
  Glacio: "border-cyan-400 bg-cyan-400/10",
  Electro: "border-purple-500 bg-purple-500/10",
  Aero: "border-green-500 bg-green-500/10",
  Havoc: "border-violet-700 bg-violet-700/10",
  Spectro: "border-yellow-400 bg-yellow-400/10",
}

export const ELEMENT_BORDER_CLASSES: Partial<Record<Element, string>> = {
  Fusion: "border-orange-500",
  Glacio: "border-cyan-400",
  Electro: "border-purple-500",
  Aero: "border-green-500",
  Havoc: "border-violet-700",
  Spectro: "border-yellow-400",
}

export const ELEMENT_HEX: Partial<Record<Element, string>> = {
  Fusion: "#ff7a3d",
  Glacio: "#5ad7f0",
  Electro: "#b67cff",
  Aero: "#5fd49a",
  Havoc: "#9b6cf0",
  Spectro: "#f5cf4d",
}
