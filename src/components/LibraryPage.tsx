/**
 * PROTOTYPE — throwaway. Question: does this split-pane library layout feel right?
 * Ported from tmp/library/design-library.jsx.
 * Delete or absorb once answered.
 */
import { useState, useMemo } from "react"
import { Link } from "@tanstack/react-router"

// ── Design tokens ─────────────────────────────────────────────────────────────

const G_FONT = '"Manrope", -apple-system, system-ui, sans-serif'
const G_MONO = '"JetBrains Mono", ui-monospace, monospace'
const G_SURFACE = {
  bg: "#0b0c10",
  bg2: "#10131a",
  bg3: "#090a0e",
  line: "#1c2029",
  fg: "#e4e7ef",
  muted: "#838899",
  dim: "#42475a",
  accent: "#9fb6ff",
  accentBg: "#131e35",
}

const ELEMENT: Record<string, { hex: string; letter: string }> = {
  Fusion: { hex: "#ff7a3d", letter: "F" },
  Glacio: { hex: "#5ad7f0", letter: "G" },
  Electro: { hex: "#b67cff", letter: "E" },
  Aero: { hex: "#5fd49a", letter: "A" },
  Havoc: { hex: "#9b6cf0", letter: "H" },
  Spectro: { hex: "#f5cf4d", letter: "S" },
}

const TYPE_COLORS: Record<string, string> = {
  Intro: "#a3bfff",
  Basic: "#838899",
  Heavy: "#c89b5f",
  Resonance: "#9b6cf0",
  Forte: "#ff7a3d",
  Liberation: "#f5cf4d",
  Echo: "#5ad7f0",
  Outro: "#5fd49a",
}

const PORTRAITS: Record<string, string> = {
  Camellya: "/portraits/camellya.png",
  Encore: "/portraits/encore.png",
  Sanhua: "/portraits/sanhua.png",
  Shorekeeper: "/portraits/shorekeeper.png",
  Verina: "/portraits/verina.png",
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  name: string
  element: string
  role: string
  seq: number
  weapon: string
}

interface TypeEntry {
  count: number
  dmg: number
}

interface LibTeam {
  id: string
  name: string
  tag: string
  updated: string
  pinned: boolean
  members: Member[]
  actions: number
  totalTime: number
  totalDmg: number
  dps: number
  concertoEnd: number
  resEnd: number
  dmgByChar: Record<string, number>
  typeMix: Record<string, TypeEntry>
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const LIB_TEAMS: LibTeam[] = [
  {
    id: "t-frostforge",
    name: "Frostforge",
    tag: "Encore fusion main",
    updated: "2h ago",
    pinned: true,
    members: [
      {
        name: "Verina",
        element: "Spectro",
        role: "Support",
        seq: 2,
        weapon: "Variation",
      },
      {
        name: "Sanhua",
        element: "Glacio",
        role: "Sub",
        seq: 1,
        weapon: "Emerald of Genesis",
      },
      {
        name: "Encore",
        element: "Fusion",
        role: "Main DPS",
        seq: 3,
        weapon: "Stringmaster",
      },
    ],
    actions: 13,
    totalTime: 11.3,
    totalDmg: 575817,
    dps: 50957,
    concertoEnd: 100,
    resEnd: 78,
    dmgByChar: { Verina: 40420, Sanhua: 114117, Encore: 421280 },
    typeMix: {
      Intro: { count: 3, dmg: 63125 },
      Basic: { count: 1, dmg: 44690 },
      Resonance: { count: 3, dmg: 143282 },
      Forte: { count: 1, dmg: 91340 },
      Liberation: { count: 1, dmg: 228580 },
      Echo: { count: 2, dmg: 4800 },
      Outro: { count: 2, dmg: 0 },
    },
  },
  {
    id: "t-crimson-bloom",
    name: "Crimson Bloom",
    tag: "Camellya havoc carry",
    updated: "1d ago",
    pinned: false,
    members: [
      {
        name: "Shorekeeper",
        element: "Spectro",
        role: "Support",
        seq: 1,
        weapon: "Variation",
      },
      {
        name: "Sanhua",
        element: "Glacio",
        role: "Sub",
        seq: 2,
        weapon: "Stringmaster",
      },
      {
        name: "Camellya",
        element: "Havoc",
        role: "Main DPS",
        seq: 4,
        weapon: "Red Spring",
      },
    ],
    actions: 16,
    totalTime: 13.55,
    totalDmg: 712340,
    dps: 52571,
    concertoEnd: 100,
    resEnd: 92,
    dmgByChar: { Shorekeeper: 52800, Sanhua: 198440, Camellya: 461100 },
    typeMix: {
      Intro: { count: 3, dmg: 71240 },
      Basic: { count: 2, dmg: 88210 },
      Heavy: { count: 1, dmg: 42580 },
      Resonance: { count: 3, dmg: 184320 },
      Forte: { count: 2, dmg: 96400 },
      Liberation: { count: 1, dmg: 198140 },
      Echo: { count: 2, dmg: 31450 },
      Outro: { count: 2, dmg: 0 },
    },
  },
  {
    id: "t-hearthsworn",
    name: "Hearthsworn",
    tag: "Encore + havoc flex",
    updated: "3d ago",
    pinned: false,
    members: [
      {
        name: "Shorekeeper",
        element: "Spectro",
        role: "Support",
        seq: 2,
        weapon: "Variation",
      },
      {
        name: "Camellya",
        element: "Havoc",
        role: "Sub",
        seq: 0,
        weapon: "Red Spring",
      },
      {
        name: "Encore",
        element: "Fusion",
        role: "Main DPS",
        seq: 2,
        weapon: "Stringmaster",
      },
    ],
    actions: 12,
    totalTime: 10.95,
    totalDmg: 488210,
    dps: 44585,
    concertoEnd: 100,
    resEnd: 64,
    dmgByChar: { Shorekeeper: 50800, Camellya: 124870, Encore: 312540 },
    typeMix: {
      Intro: { count: 2, dmg: 28480 },
      Basic: { count: 2, dmg: 64210 },
      Resonance: { count: 3, dmg: 142340 },
      Forte: { count: 1, dmg: 71200 },
      Liberation: { count: 1, dmg: 154520 },
      Echo: { count: 1, dmg: 27460 },
      Outro: { count: 2, dmg: 0 },
    },
  },
  {
    id: "t-twin-garden",
    name: "Twin Garden",
    tag: "Dual spectro · Encore main",
    updated: "4d ago",
    pinned: false,
    members: [
      {
        name: "Verina",
        element: "Spectro",
        role: "Support",
        seq: 2,
        weapon: "Variation",
      },
      {
        name: "Shorekeeper",
        element: "Spectro",
        role: "Sub-spt",
        seq: 1,
        weapon: "Cosmic Ripples",
      },
      {
        name: "Encore",
        element: "Fusion",
        role: "Main DPS",
        seq: 6,
        weapon: "Stringmaster",
      },
    ],
    actions: 14,
    totalTime: 12.1,
    totalDmg: 542080,
    dps: 44800,
    concertoEnd: 96,
    resEnd: 70,
    dmgByChar: { Verina: 65240, Shorekeeper: 168240, Encore: 308600 },
    typeMix: {
      Intro: { count: 2, dmg: 38420 },
      Basic: { count: 3, dmg: 112430 },
      Heavy: { count: 1, dmg: 38900 },
      Resonance: { count: 2, dmg: 96400 },
      Forte: { count: 2, dmg: 84520 },
      Liberation: { count: 1, dmg: 138480 },
      Echo: { count: 1, dmg: 32930 },
      Outro: { count: 2, dmg: 0 },
    },
  },
  {
    id: "t-tideglacier",
    name: "Tideglacier",
    tag: "Sanhua sub-DPS turned main",
    updated: "1w ago",
    pinned: false,
    members: [
      {
        name: "Verina",
        element: "Spectro",
        role: "Support",
        seq: 0,
        weapon: "Variation",
      },
      {
        name: "Shorekeeper",
        element: "Spectro",
        role: "Sub-spt",
        seq: 1,
        weapon: "Cosmic Ripples",
      },
      {
        name: "Sanhua",
        element: "Glacio",
        role: "Main DPS",
        seq: 1,
        weapon: "Lustrous Razor",
      },
    ],
    actions: 13,
    totalTime: 11.8,
    totalDmg: 498420,
    dps: 42239,
    concertoEnd: 100,
    resEnd: 72,
    dmgByChar: { Verina: 47200, Shorekeeper: 138420, Sanhua: 312800 },
    typeMix: {
      Intro: { count: 2, dmg: 28920 },
      Basic: { count: 2, dmg: 84620 },
      Resonance: { count: 3, dmg: 142400 },
      Forte: { count: 1, dmg: 78240 },
      Liberation: { count: 1, dmg: 132840 },
      Echo: { count: 2, dmg: 31400 },
      Outro: { count: 2, dmg: 0 },
    },
  },
  {
    id: "t-hollowmoon",
    name: "Hollowmoon",
    tag: "Spectro-flank Camellya",
    updated: "2w ago",
    pinned: false,
    members: [
      {
        name: "Verina",
        element: "Spectro",
        role: "Support",
        seq: 1,
        weapon: "Variation",
      },
      {
        name: "Shorekeeper",
        element: "Spectro",
        role: "Sub-spt",
        seq: 0,
        weapon: "Cosmic Ripples",
      },
      {
        name: "Camellya",
        element: "Havoc",
        role: "Main DPS",
        seq: 1,
        weapon: "Red Spring",
      },
    ],
    actions: 15,
    totalTime: 12.85,
    totalDmg: 668420,
    dps: 52017,
    concertoEnd: 100,
    resEnd: 88,
    dmgByChar: { Verina: 67000, Shorekeeper: 142800, Camellya: 458620 },
    typeMix: {
      Intro: { count: 3, dmg: 52120 },
      Basic: { count: 2, dmg: 64200 },
      Heavy: { count: 1, dmg: 38700 },
      Resonance: { count: 3, dmg: 168440 },
      Forte: { count: 2, dmg: 104620 },
      Liberation: { count: 1, dmg: 188340 },
      Echo: { count: 1, dmg: 52000 },
      Outro: { count: 2, dmg: 0 },
    },
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEXT_OVER_PORTRAIT =
  "0 1px 5px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.65)"

function getPortrait(name: string): string | null {
  return PORTRAITS[name] ?? null
}

function blendGradient(
  members: Member[],
  intensity: string,
  stops?: number[],
): string {
  const baseAlpha =
    intensity === "whisper"
      ? 0x14
      : intensity === "subtle"
        ? 0x24
        : intensity === "bold"
          ? 0x55
          : 0x3a
  const aHex = baseAlpha.toString(16).padStart(2, "0")
  const n = members.length
  const stopList = members.map((m, i) => {
    const hex = ELEMENT[m.element]?.hex ?? "#888"
    const pct = stops ? stops[i] : ((i + 0.5) / n) * 75
    return `${hex}${aHex} ${pct.toFixed(1)}%`
  })
  return `linear-gradient(90deg, ${stopList.join(", ")}, transparent 95%)`
}

// ── Radix icon paths ──────────────────────────────────────────────────────────

const RX = {
  plus: "M7.49991 0.876892C3.84222 0.876892 0.877075 3.84204 0.877075 7.49972C0.877075 11.1574 3.84222 14.1226 7.49991 14.1226C11.1576 14.1226 14.1227 11.1574 14.1227 7.49972C14.1227 3.84204 11.1576 0.876892 7.49991 0.876892ZM1.82707 7.49972C1.82707 4.36671 4.36689 1.82689 7.49991 1.82689C10.6329 1.82689 13.1727 4.36671 13.1727 7.49972C13.1727 10.6327 10.6329 13.1726 7.49991 13.1726C4.36689 13.1726 1.82707 10.6327 1.82707 7.49972ZM7.50003 4C7.77617 4 8.00003 4.22386 8.00003 4.5V7H10.5C10.7762 7 11 7.22386 11 7.5C11 7.77614 10.7762 8 10.5 8H8.00003V10.5C8.00003 10.7761 7.77617 11 7.50003 11C7.22389 11 7.00003 10.7761 7.00003 10.5V8H4.50003C4.22389 8 4.00003 7.77614 4.00003 7.5C4.00003 7.22386 4.22389 7 4.50003 7H7.00003V4.5C7.00003 4.22386 7.22389 4 7.50003 4Z",
  play: "M3.24182 2.32181C3.3919 2.23132 3.5784 2.22601 3.73338 2.30781L12.7334 7.05781C12.8974 7.14436 13 7.31457 13 7.5C13 7.68543 12.8974 7.85564 12.7334 7.94219L3.73338 12.6922C3.5784 12.774 3.3919 12.7687 3.24182 12.6782C3.09175 12.5877 3 12.4252 3 12.25V2.75C3 2.57476 3.09175 2.41228 3.24182 2.32181Z",
  upload:
    "M7.81825 1.18188C7.64251 1.00615 7.35759 1.00615 7.18185 1.18188L4.18185 4.18188C4.00611 4.35762 4.00611 4.64254 4.18185 4.81828C4.35759 4.99401 4.64251 4.99401 4.81825 4.81828L7.05005 2.58648V9.49998C7.05005 9.74851 7.25152 9.94998 7.50005 9.94998C7.74858 9.94998 7.95005 9.74851 7.95005 9.49998V2.58648L10.1819 4.81828C10.3576 4.99401 10.6425 4.99401 10.8182 4.81828C10.994 4.64254 10.994 4.35762 10.8182 4.18188L7.81825 1.18188ZM2.5 9.99998C2.77614 9.99998 3 10.2238 3 10.5V12C3 12.5539 3.44565 13 3.99635 13H11.0012C11.5529 13 12 12.5527 12 12V10.5C12 10.2238 12.2239 9.99998 12.5 9.99998C12.7761 9.99998 13 10.2238 13 10.5V12C13 13.104 12.1062 14 11.0012 14H3.99635C2.89019 14 2 13.103 2 12V10.5C2 10.2238 2.22386 9.99998 2.5 9.99998Z",
  download:
    "M7.50005 1.04999C7.74858 1.04999 7.95005 1.25146 7.95005 1.49999V8.41359L10.1819 6.18179C10.3576 6.00605 10.6425 6.00605 10.8182 6.18179C10.994 6.35753 10.994 6.64245 10.8182 6.81819L7.81825 9.81819C7.64251 9.99392 7.35759 9.99392 7.18185 9.81819L4.18185 6.81819C4.00611 6.64245 4.00611 6.35753 4.18185 6.18179C4.35759 6.00605 4.64251 6.00605 4.81825 6.18179L7.05005 8.41359V1.49999C7.05005 1.25146 7.25152 1.04999 7.50005 1.04999ZM2.5 10C2.77614 10 3 10.2239 3 10.5V12C3 12.5539 3.44565 13 3.99635 13H11.0012C11.5529 13 12 12.5528 12 12V10.5C12 10.2239 12.2239 10 12.5 10C12.7761 10 13 10.2239 13 10.5V12C13 13.1041 12.1062 14 11.0012 14H3.99635C2.89019 14 2 13.103 2 12V10.5C2 10.2239 2.22386 10 2.5 10Z",
  gear: "M7.07095 0.650238C6.67391 0.650238 6.32977 0.925096 6.24198 1.31231L6.0039 2.36247C5.6249 2.47269 5.26335 2.62363 4.92436 2.81013L4.01335 2.23585C3.68748 2.02905 3.26043 2.07686 2.98876 2.34853L2.34854 2.98875C2.07688 3.26041 2.02906 3.68746 2.23586 4.01333L2.80994 4.92418C2.62347 5.2632 2.47255 5.62474 2.36236 6.00372L1.31221 6.24181C0.924989 6.32959 0.650131 6.67373 0.650131 7.07077V7.97077C0.650131 8.36781 0.924992 8.71194 1.31221 8.79973L2.36237 9.03781C2.47256 9.41679 2.62347 9.77834 2.80994 10.1174L2.23586 11.0282C2.02906 11.354 2.07688 11.7811 2.34854 12.0527L2.98876 12.693C3.26043 12.9646 3.68748 13.0125 4.01335 12.8057L4.92421 12.2316C5.26323 12.418 5.62479 12.5689 6.0039 12.6791L6.24198 13.7293C6.32977 14.1165 6.67391 14.3913 7.07095 14.3913H7.97095C8.36799 14.3913 8.71212 14.1165 8.79991 13.7293L9.038 12.679C9.41697 12.5688 9.77843 12.4179 10.1174 12.2315L11.0283 12.8056C11.3542 13.0124 11.7813 12.9646 12.0529 12.6929L12.6932 12.0527C12.9648 11.7811 13.0126 11.354 12.8058 11.0281L12.2317 10.1174C12.4182 9.77836 12.5691 9.4168 12.6793 9.03781L13.7295 8.79973C14.1167 8.71194 14.3915 8.36781 14.3915 7.97077V7.07077C14.3915 6.67373 14.1167 6.32959 13.7295 6.24181L12.6793 6.00372C12.5691 5.62474 12.4182 5.2632 12.2317 4.92418L12.8058 4.01331C13.0126 3.68744 12.9648 3.26039 12.6932 2.98872L12.0529 2.34852C11.7813 2.07686 11.3542 2.02905 11.0283 2.23586L10.1174 2.80994C9.77833 2.62347 9.41685 2.47254 9.03791 2.36234L8.79991 1.31231C8.71212 0.925096 8.36799 0.650238 7.97095 0.650238H7.07095ZM4.92133 3.50494C5.4076 3.17995 5.95314 2.93072 6.53792 2.78199L6.95095 1.00024L7.97095 1.00024L8.38398 2.78199C8.96876 2.93072 9.5143 3.17995 10.0006 3.50494L11.5817 2.49955L12.2229 3.14077L11.2175 4.7219C11.5425 5.20817 11.7917 5.75369 11.9405 6.33847L13.7222 6.75151V7.97003L11.9406 8.38304C11.7918 8.96779 11.5427 9.5133 11.2178 9.99955L12.2233 11.5808L11.5817 12.2218L10.0007 11.2164C9.51439 11.5414 8.96877 11.7906 8.38388 11.9395L7.97095 13.7213H6.95095L6.53802 11.9395C5.95313 11.7907 5.40757 11.5414 4.92132 11.2165L3.34028 12.2218L2.69906 11.5806L3.70439 9.99964C3.37941 9.51339 3.13029 8.96776 2.98152 8.38304L1.20015 7.97003L1.20015 6.75151L2.98151 6.33845C3.13028 5.75366 3.37941 5.208 3.7044 4.7217L2.69903 3.14077L3.34014 2.49961L4.92133 3.50494ZM9.74995 7.50018C9.74995 8.74282 8.7426 9.75018 7.49995 9.75018C6.25731 9.75018 5.24995 8.74282 5.24995 7.50018C5.24995 6.25753 6.25731 5.25018 7.49995 5.25018C8.7426 5.25018 9.74995 6.25753 9.74995 7.50018ZM8.74995 7.50018C8.74995 8.19053 8.1903 8.75018 7.49995 8.75018C6.80959 8.75018 6.24995 8.19053 6.24995 7.50018C6.24995 6.80982 6.80959 6.25018 7.49995 6.25018C8.1903 6.25018 8.74995 6.80982 8.74995 7.50018Z",
  layers:
    "M7.81084 1.20323C7.65827 1.13225 7.48198 1.13225 7.32941 1.20323L0.829412 4.22823C0.626354 4.32271 0.500001 4.52568 0.500001 4.74982C0.500001 4.97396 0.626354 5.17693 0.829412 5.27141L7.32941 8.29641C7.48198 8.36739 7.65827 8.36739 7.81084 8.29641L14.3108 5.27141C14.5139 5.17693 14.6402 4.97396 14.6402 4.74982C14.6402 4.52568 14.5139 4.32271 14.3108 4.22823L7.81084 1.20323ZM7.57013 7.28739L2.10503 4.74982L7.57013 2.21225L13.0352 4.74982L7.57013 7.28739ZM0.5 7.49982C0.5 7.27568 0.626354 7.07271 0.829412 6.97823L2.5 6.20323L3.27013 6.56225L1.60503 7.49982L7.57013 10.2874L13.5352 7.49982L11.8701 6.56225L12.6402 6.20323L14.3108 6.97823C14.5139 7.07271 14.6402 7.27568 14.6402 7.49982C14.6402 7.72396 14.5139 7.92693 14.3108 8.02141L7.81084 11.0464C7.65827 11.1174 7.48198 11.1174 7.32941 11.0464L0.829412 8.02141C0.626354 7.92693 0.5 7.72396 0.5 7.49982ZM0.829412 9.72823C0.626354 9.82271 0.5 10.0257 0.5 10.2498C0.5 10.474 0.626354 10.6769 0.829412 10.7714L7.32941 13.7964C7.48198 13.8674 7.65827 13.8674 7.81084 13.7964L14.3108 10.7714C14.5139 10.6769 14.6402 10.474 14.6402 10.2498C14.6402 10.0257 14.5139 9.82271 14.3108 9.72823L12.6402 8.95323L11.8701 9.31225L13.5352 10.2498L7.57013 13.0374L1.60503 10.2498L3.27013 9.31225L2.5 8.95323L0.829412 9.72823Z",
  rows: "M1.5 5.25C1.22386 5.25 1 5.47386 1 5.75C1 6.02614 1.22386 6.25 1.5 6.25H13.5C13.7761 6.25 14 6.02614 14 5.75C14 5.47386 13.7761 5.25 13.5 5.25H1.5ZM1 8.75C1 8.47386 1.22386 8.25 1.5 8.25H13.5C13.7761 8.25 14 8.47386 14 8.75C14 9.02614 13.7761 9.25 13.5 9.25H1.5C1.22386 9.25 1 9.02614 1 8.75ZM1 11.75C1 11.4739 1.22386 11.25 1.5 11.25H13.5C13.7761 11.25 14 11.4739 14 11.75C14 12.0261 13.7761 12.25 13.5 12.25H1.5C1.22386 12.25 1 12.0261 1 11.75ZM1 2.75C1 2.47386 1.22386 2.25 1.5 2.25H13.5C13.7761 2.25 14 2.47386 14 2.75C14 3.02614 13.7761 3.25 13.5 3.25H1.5C1.22386 3.25 1 3.02614 1 2.75Z",
  clock:
    "M7.50009 0.877014C3.84241 0.877014 0.877258 3.84216 0.877258 7.49984C0.877258 11.1575 3.8424 14.1227 7.50009 14.1227C11.1578 14.1227 14.1229 11.1575 14.1229 7.49984C14.1229 3.84216 11.1577 0.877014 7.50009 0.877014ZM1.82726 7.49984C1.82726 4.36683 4.36707 1.82702 7.50009 1.82702C10.6331 1.82702 13.1729 4.36683 13.1729 7.49984C13.1729 10.6328 10.6331 13.1727 7.50009 13.1727C4.36707 13.1727 1.82726 10.6328 1.82726 7.49984ZM8 4.50001C8 4.22387 7.77614 4.00001 7.5 4.00001C7.22386 4.00001 7 4.22387 7 4.50001V7.50001C7 7.63262 7.05268 7.7598 7.14645 7.85357L9.14645 9.85357C9.34171 10.0488 9.65829 10.0488 9.85355 9.85357C10.0488 9.65831 10.0488 9.34172 9.85355 9.14646L8 7.29291V4.50001Z",
  pencil:
    "M11.8536 1.14645C11.6583 0.951184 11.3417 0.951184 11.1465 1.14645L3.71455 8.57836C3.62459 8.66832 3.55263 8.77461 3.50251 8.89155L2.04044 12.303C1.9599 12.491 2.00189 12.709 2.14646 12.8536C2.29103 12.9981 2.50905 13.0401 2.69697 12.9596L6.10847 11.4975C6.2254 11.4474 6.3317 11.3754 6.42166 11.2855L13.8536 3.85355C14.0488 3.65829 14.0488 3.34171 13.8536 3.14645L11.8536 1.14645ZM4.42166 9.28547L11.5 2.20711L12.7929 3.5L5.71455 10.5784L4.21924 11.2192L3.78081 10.7808L4.42166 9.28547Z",
  cross1:
    "M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z",
  copy: "M1 9.50006C1 10.3285 1.67157 11.0001 2.5 11.0001H4L4 10.0001H2.5C2.22386 10.0001 2 9.7762 2 9.50006L2 2.50006C2 2.22392 2.22386 2.00006 2.5 2.00006L9.5 2.00006C9.77614 2.00006 10 2.22392 10 2.50006V4.00002H5.5C4.67157 4.00002 4 4.67159 4 5.50002V12.5C4 13.3284 4.67157 14 5.5 14H12.5C13.3284 14 14 13.3284 14 12.5V5.50002C14 4.67159 13.3284 4.00002 12.5 4.00002H11V2.50006C11 1.67163 10.3284 1.00006 9.5 1.00006H2.5C1.67157 1.00006 1 1.67163 1 2.50006V9.50006ZM5 5.50002C5 5.22388 5.22386 5.00002 5.5 5.00002H12.5C12.7761 5.00002 13 5.22388 13 5.50002V12.5C13 12.7762 12.7761 13 12.5 13H5.5C5.22386 13 5 12.7762 5 12.5V5.50002Z",
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function Icon({
  d,
  size = 14,
  style,
}: {
  d: string
  size?: number
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 15 15"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <path d={d} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
  )
}

function IconBtn({
  d,
  label,
  color,
  hoverColor,
  onClick,
  size = 13,
  w = 22,
  h = 22,
}: {
  d: string
  label: string
  color?: string
  hoverColor?: string
  onClick?: () => void
  size?: number
  w?: number
  h?: number
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      title={label}
      aria-label={label}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      style={{
        width: w,
        height: h,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: 3,
        color: hov ? (hoverColor ?? G_SURFACE.fg) : (color ?? G_SURFACE.muted),
        cursor: "pointer",
      }}
    >
      <Icon d={d} size={size} />
    </button>
  )
}

function HBtn({
  icon,
  label,
  primary,
  kbd,
}: {
  icon?: string
  label: string
  primary?: boolean
  kbd?: string
}) {
  const [hov, setHov] = useState(false)
  const base: React.CSSProperties = {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "5px 10px 5px 8px",
    borderRadius: 3,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  }
  const style: React.CSSProperties = primary
    ? {
        ...base,
        background: "#1a2c4a",
        color: "#a3bfff",
        border: "1px solid #2a4575",
      }
    : {
        ...base,
        background: hov ? G_SURFACE.bg3 : "transparent",
        color: hov ? G_SURFACE.fg : G_SURFACE.muted,
        border: `1px solid ${G_SURFACE.line}`,
      }
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={style}
    >
      {icon && <Icon d={icon} size={12} />}
      <span>{label}</span>
      {kbd && (
        <kbd
          style={{
            fontSize: 9,
            color: "#a3bfff",
            marginLeft: 4,
            fontFamily: G_MONO,
          }}
        >
          {kbd}
        </kbd>
      )}
    </button>
  )
}

function Kpi({
  label,
  value,
  accent,
  big,
  suffix,
}: {
  label: string
  value: string | number
  accent?: string
  big?: boolean
  suffix?: string
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}
    >
      <span
        style={{
          fontSize: 9,
          color: G_SURFACE.muted,
          fontFamily: G_MONO,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: big ? 22 : 14,
          color: accent ?? G_SURFACE.fg,
          fontWeight: 600,
          fontFamily: G_MONO,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -0.4,
          lineHeight: 1,
        }}
      >
        {value}
        {suffix && (
          <span
            style={{
              fontSize: big ? 12 : 10,
              color: G_SURFACE.muted,
              marginLeft: 3,
              fontWeight: 500,
            }}
          >
            {suffix}
          </span>
        )}
      </span>
    </div>
  )
}

function ElementAvatar({
  member,
  size = 26,
  dim,
  grayscale,
}: {
  member: Member
  size?: number
  dim?: boolean
  grayscale?: boolean
}) {
  const el = ELEMENT[member.element] ?? { hex: "#888", letter: "?" }
  const src = getPortrait(member.name)
  const ring = `0 0 0 1px ${el.hex}88, 0 1px 3px rgba(0,0,0,.4)`
  if (!src) {
    return (
      <div
        title={`${member.name} · ${member.element}`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: `radial-gradient(circle at 35% 30%, ${el.hex}, ${el.hex}77 60%, ${G_SURFACE.bg})`,
          color: "#0a0b0d",
          fontWeight: 700,
          fontSize: size <= 20 ? 10 : 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: ring,
          opacity: dim ? 0.4 : 1,
          flexShrink: 0,
        }}
      >
        {member.name[0]}
      </div>
    )
  }
  return (
    <div
      title={`${member.name} · ${member.element}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `radial-gradient(circle, ${el.hex}33, ${G_SURFACE.bg2})`,
        boxShadow: ring,
        opacity: dim ? 0.4 : 1,
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <img
        src={src}
        alt={member.name}
        style={{
          position: "absolute",
          left: "-8%",
          top: "-4%",
          width: "116%",
          height: "116%",
          objectFit: "cover",
          objectPosition: "center 18%",
          filter: grayscale
            ? "grayscale(1) contrast(1.05) brightness(1.05)"
            : "none",
        }}
      />
    </div>
  )
}

function ElDot({ element, size = 6 }: { element: string; size?: number }) {
  const hex = ELEMENT[element]?.hex ?? "#888"
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: hex,
        display: "inline-block",
        flexShrink: 0,
        boxShadow: `0 0 6px ${hex}88`,
      }}
    />
  )
}

// ── Portrait strip ────────────────────────────────────────────────────────────

function PortraitStrip({
  members,
  fade = 0.4,
  portraitW = 150,
  portraitH = 150,
  gap = 24,
  leftOffset = 10,
  stripWidth = 540,
  maskStart = 62,
  maskEnd = 96,
  vOffset = 0,
}: {
  members: Member[]
  fade?: number
  portraitW?: number
  portraitH?: number
  gap?: number
  leftOffset?: number
  stripWidth?: number
  maskStart?: number
  maskEnd?: number
  vOffset?: number
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        height: "100%",
        width: stripWidth,
        overflow: "hidden",
        maskImage: `linear-gradient(to right, black 0%, black ${maskStart}%, transparent ${maskEnd}%)`,
        WebkitMaskImage: `linear-gradient(to right, black 0%, black ${maskStart}%, transparent ${maskEnd}%)`,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {members.map((m, i) => {
        const src = getPortrait(m.name)
        const hex = ELEMENT[m.element]?.hex ?? "#888"
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: leftOffset + i * (portraitW + gap),
              top: `calc(50% + ${vOffset}px)`,
              transform: "translateY(-50%)",
              width: portraitW,
              height: portraitH,
              opacity: fade,
            }}
          >
            {src ? (
              <img
                src={src}
                alt=""
                aria-hidden
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 22%",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `radial-gradient(circle at 50% 35%, ${hex}88, transparent 70%)`,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function BlendOverlay({
  members,
  intensity = "normal",
  stops,
}: {
  members: Member[]
  intensity?: string
  stops?: number[]
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: blendGradient(members, intensity, stops),
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  )
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function Donut({
  slices,
  total,
  centerLabel,
  centerValue,
  legend,
  size = 130,
}: {
  slices: { key: string; value: number; color: string }[]
  total: number
  centerLabel: string
  centerValue: string | number
  legend: React.ReactNode
  size?: number
}) {
  const r = Math.round(size * 0.38),
    stroke = Math.round(size * 0.12)
  const cx = size / 2,
    cy = size / 2
  const C = 2 * Math.PI * r
  let acc = 0
  const arcs = slices.map((s) => {
    const frac = total > 0 ? s.value / total : 0
    const len = frac * C
    const offset = -acc
    acc += len
    return { ...s, len, offset }
  })
  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        alignItems: "center",
        padding: "4px 2px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={G_SURFACE.bg}
            strokeWidth={stroke}
          />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 9,
              color: G_SURFACE.muted,
              fontFamily: G_MONO,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            {centerLabel}
          </span>
          <span
            style={{
              fontSize: 17,
              color: G_SURFACE.fg,
              fontWeight: 600,
              fontFamily: G_MONO,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: -0.4,
            }}
          >
            {centerValue}
          </span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {legend}
      </div>
    </div>
  )
}

function DmgDonut({ team }: { team: LibTeam }) {
  const slices = team.members.map((m) => ({
    key: m.name,
    value: team.dmgByChar[m.name] ?? 0,
    color: ELEMENT[m.element]?.hex ?? "#888",
  }))
  const total = team.totalDmg
  const legend = [...slices]
    .sort((a, b) => b.value - a.value)
    .map((s) => (
      <div
        key={s.key}
        style={{
          display: "grid",
          gridTemplateColumns: "10px 1fr auto auto",
          alignItems: "center",
          gap: 8,
          padding: "2px 0",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 1,
            background: s.color,
            display: "block",
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: G_SURFACE.fg,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {s.key}
        </span>
        <span
          style={{
            fontSize: 10,
            color: G_SURFACE.muted,
            fontFamily: G_MONO,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {(s.value / 1000).toFixed(1)}k
        </span>
        <span
          style={{
            fontSize: 10,
            color: G_SURFACE.fg,
            fontFamily: G_MONO,
            fontVariantNumeric: "tabular-nums",
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {((s.value / total) * 100).toFixed(1)}%
        </span>
      </div>
    ))
  return (
    <Donut
      slices={slices}
      total={total}
      centerLabel="dmg"
      centerValue={`${(total / 1000).toFixed(0)}k`}
      legend={legend}
    />
  )
}

function TypeDistribution({ team }: { team: LibTeam }) {
  const entries = Object.entries(team.typeMix).filter(([, v]) => v.count > 0)
  const slices = entries.map(([k, v]) => ({
    key: k,
    value: v.dmg,
    color: TYPE_COLORS[k] ?? G_SURFACE.muted,
  }))
  const total = slices.reduce((s, x) => s + x.value, 0)
  const withMeta = entries.map(([k, v]) => ({
    key: k,
    ...v,
    color: TYPE_COLORS[k] ?? G_SURFACE.muted,
  }))
  const legend = [...withMeta]
    .sort((a, b) => b.dmg - a.dmg)
    .map((s) => (
      <div
        key={s.key}
        style={{
          display: "grid",
          gridTemplateColumns: "10px 1fr auto auto",
          alignItems: "center",
          gap: 8,
          padding: "2px 0",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 1,
            background: s.color,
            display: "block",
          }}
        />
        <span
          style={{
            fontSize: 10.5,
            color: G_SURFACE.fg,
            fontFamily: G_MONO,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {s.key}
        </span>
        <span
          style={{
            fontSize: 10,
            color: G_SURFACE.muted,
            fontFamily: G_MONO,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {s.count}×
        </span>
        <span
          style={{
            fontSize: 10,
            color: G_SURFACE.fg,
            fontFamily: G_MONO,
            fontVariantNumeric: "tabular-nums",
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {total > 0 ? ((s.dmg / total) * 100).toFixed(1) : "0.0"}%
        </span>
      </div>
    ))
  return (
    <Donut
      slices={slices}
      total={total}
      centerLabel="dmg"
      centerValue={`${(total / 1000).toFixed(0)}k`}
      legend={legend}
    />
  )
}

// ── Detail hero (portrait collage + info plate) ───────────────────────────────

function DetailHero({ team }: { team: LibTeam }) {
  const E = ELEMENT
  const dominant =
    E[team.members[team.members.length - 1].element]?.hex ?? "#888"
  const STOPS = [16.7, 50, 83.3]

  return (
    <div
      style={{
        position: "relative",
        border: `1px solid ${G_SURFACE.line}`,
        borderTop: `1px solid ${dominant}66`,
        borderRadius: 4,
        background: G_SURFACE.bg2,
        overflow: "hidden",
        boxShadow: `0 8px 24px rgba(0,0,0,.35), inset 0 0 80px ${dominant}10`,
      }}
    >
      {/* Portrait region */}
      <div style={{ position: "relative", height: 200, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            maskImage: "linear-gradient(180deg, black 35%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, black 35%, transparent 100%)",
          }}
        >
          {team.members.map((m, i) => {
            const src = getPortrait(m.name)
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  position: "relative",
                  overflow: "hidden",
                  opacity: 0.85,
                }}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    aria-hidden
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center 14%",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: `radial-gradient(circle at 50% 30%, ${E[m.element]?.hex ?? "#888"}66, transparent 70%)`,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
        {/* Whisper blend overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: blendGradient(team.members, "whisper", STOPS),
            pointerEvents: "none",
          }}
        />

        {/* Top badges */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 18,
            right: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: 9,
              color: G_SURFACE.fg,
              fontFamily: G_MONO,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              padding: "3px 8px",
              background: "rgba(0,0,0,0.55)",
              border: `1px solid ${G_SURFACE.line}`,
              borderRadius: 2,
              backdropFilter: "blur(4px)",
            }}
          >
            team · {team.id.slice(-6).toUpperCase()}
          </span>
          <span
            style={{
              fontSize: 10,
              color: G_SURFACE.fg,
              fontFamily: G_MONO,
              letterSpacing: 0.4,
              background: "rgba(0,0,0,0.45)",
              padding: "3px 8px",
              borderRadius: 2,
              backdropFilter: "blur(4px)",
            }}
          >
            updated {team.updated}
          </span>
        </div>

        {/* Bottom roster line */}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 18,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 11,
            color: G_SURFACE.fg,
            fontFamily: G_MONO,
            letterSpacing: 0.5,
            textShadow: TEXT_OVER_PORTRAIT,
            zIndex: 2,
          }}
        >
          {team.members.map((m, i) => (
            <span
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 7,
                  background: E[m.element]?.hex ?? "#888",
                  boxShadow: `0 0 8px ${E[m.element]?.hex ?? "#888"}`,
                  display: "inline-block",
                }}
              />
              <span>{m.name}</span>
              {i < team.members.length - 1 && (
                <span style={{ color: "#888", marginLeft: 5 }}>·</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Info plate */}
      <div
        style={{
          padding: "18px 22px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: G_SURFACE.fg,
              letterSpacing: -0.5,
              lineHeight: 1,
            }}
          >
            {team.name}
          </span>
          <span
            style={{
              fontSize: 10,
              color: G_SURFACE.muted,
              fontFamily: G_MONO,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {team.tag}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
          <Kpi
            label="dmg"
            value={team.totalDmg.toLocaleString()}
            accent="#f5cf4d"
            big
          />
          <Kpi
            label="dps"
            value={team.dps.toLocaleString()}
            accent="#5ad7f0"
            big
          />
          <Kpi label="time" value={team.totalTime.toFixed(2)} suffix="s" />
          <Kpi label="actions" value={team.actions} />
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 6 }}>
            <HBtn icon={RX.play} label="Open in sim" primary />
            <HBtn icon={RX.copy} label="Duplicate" />
          </div>
        </div>
      </div>
    </div>
  )
}

function MemberCards({ team }: { team: LibTeam }) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}
    >
      {team.members.map((m, i) => {
        const el = ELEMENT[m.element] ?? { hex: "#888" }
        const share = (team.dmgByChar[m.name] ?? 0) / team.totalDmg
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${G_SURFACE.line}`,
              borderLeft: `2px solid ${el.hex}`,
              borderRadius: 3,
              background: G_SURFACE.bg2,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <ElementAvatar member={m} size={40} />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: G_SURFACE.fg }}
                >
                  {m.name}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 4px",
                    borderRadius: 2,
                    background: `${el.hex}15`,
                    color: el.hex,
                    border: `1px solid ${el.hex}44`,
                    fontFamily: G_MONO,
                    letterSpacing: 0.4,
                  }}
                >
                  S{m.seq}
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: G_SURFACE.muted,
                  fontFamily: G_MONO,
                  letterSpacing: 0.4,
                }}
              >
                {m.role}
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  color: G_SURFACE.dim,
                  fontFamily: G_FONT,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {m.weapon}
              </span>
            </div>
            <div
              style={{
                textAlign: "right",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "#f5cf4d",
                  fontWeight: 600,
                  fontFamily: G_MONO,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {(share * 100).toFixed(1)}
                <span
                  style={{ fontSize: 9, color: G_SURFACE.muted, marginLeft: 1 }}
                >
                  %
                </span>
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  color: G_SURFACE.muted,
                  fontFamily: G_MONO,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {((team.dmgByChar[m.name] ?? 0) / 1000).toFixed(1)}k
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Card({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: `1px solid ${G_SURFACE.line}`,
        borderRadius: 3,
        background: G_SURFACE.bg2,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${G_SURFACE.line}`,
          display: "flex",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: G_SURFACE.fg,
            letterSpacing: 0.2,
          }}
        >
          {title}
        </span>
        {sub && (
          <span
            style={{
              fontSize: 9.5,
              color: G_SURFACE.muted,
              fontFamily: G_MONO,
              letterSpacing: 0.4,
            }}
          >
            {sub}
          </span>
        )}
      </div>
      <div style={{ padding: "14px", minWidth: 0 }}>{children}</div>
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyMainPane() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        gap: 22,
        minHeight: 0,
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          border: `1px dashed ${G_SURFACE.line}`,
          background: G_SURFACE.bg2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: G_SURFACE.muted,
          position: "relative",
        }}
      >
        <Icon d={RX.layers} size={42} />
        <div
          style={{
            position: "absolute",
            bottom: -6,
            right: -6,
            width: 30,
            height: 30,
            borderRadius: 16,
            background: "#1a2c4a",
            border: "1px solid #2a4575",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#a3bfff",
            boxShadow: "0 4px 12px rgba(0,0,0,.4)",
          }}
        >
          <Icon d={RX.plus} size={16} />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          textAlign: "center",
          maxWidth: 440,
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: G_SURFACE.fg,
            letterSpacing: -0.2,
          }}
        >
          Your library is empty
        </span>
        <span
          style={{ fontSize: 12, color: G_SURFACE.muted, lineHeight: 1.55 }}
        >
          Build a team in the simulator and save it here. The library shows
          damage breakdowns, skill-type distributions, and per-character
          contribution for every saved comp.
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <HBtn icon={RX.plus} label="Create a team" primary />
        <HBtn icon={RX.upload} label="Import roster" />
      </div>
      <div
        style={{
          fontSize: 10,
          color: G_SURFACE.dim,
          fontFamily: G_MONO,
          letterSpacing: 1,
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>or press</span>
        <kbd
          style={{
            fontSize: 9,
            padding: "1px 5px",
            background: G_SURFACE.bg2,
            border: `1px solid ${G_SURFACE.line}`,
            borderRadius: 2,
            color: G_SURFACE.accent,
          }}
        >
          N
        </kbd>
        <span>to start</span>
      </div>
    </div>
  )
}

function LibraryEmptyList() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        gap: 12,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          border: `1px dashed ${G_SURFACE.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: G_SURFACE.dim,
        }}
      >
        <Icon d={RX.layers} size={20} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: G_SURFACE.fg }}>
        No teams yet
      </span>
      <span
        style={{
          fontSize: 11,
          color: G_SURFACE.muted,
          maxWidth: 240,
          lineHeight: 1.5,
        }}
      >
        Saved teams from the simulator will appear here.
      </span>
      <div style={{ marginTop: 4 }}>
        <HBtn icon={RX.plus} label="New team" primary />
      </div>
    </div>
  )
}

// ── Detail card (main pane) ───────────────────────────────────────────────────

function DetailCard({
  team,
  isEmpty,
}: {
  team: LibTeam | null
  isEmpty: boolean
}) {
  if (isEmpty) return <EmptyMainPane />
  if (!team)
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: G_SURFACE.muted,
          fontSize: 12,
          fontStyle: "italic",
        }}
      >
        Select a team from the library
      </div>
    )
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <DetailHero team={team} />
      <MemberCards team={team} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          minHeight: 0,
        }}
      >
        <Card
          title="Damage attribution"
          sub="Per character · contribution share"
        >
          <DmgDonut team={team} />
        </Card>
        <Card title="Skill type distribution" sub="Action count + damage share">
          <TypeDistribution team={team} />
        </Card>
      </div>
    </div>
  )
}

// ── Library list (right column) ───────────────────────────────────────────────

const LIBRARY_W = 692

function TeamTab({
  team,
  selected,
  onClick,
}: {
  team: LibTeam
  selected: boolean
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  const dominant =
    ELEMENT[team.members[team.members.length - 1].element]?.hex ?? "#888"
  const portraitGap = -6 // from TWEAK_DEFAULTS
  const fade = selected ? 0.45 : hov ? 0.36 : 0.3

  const PORTRAIT_W = 148
  const LEFT_OFFSET = 12
  const stops = team.members.map(
    (_, i) =>
      ((LEFT_OFFSET + i * (PORTRAIT_W + portraitGap) + PORTRAIT_W / 2) /
        LIBRARY_W) *
      100,
  )

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative",
        height: 128,
        cursor: "pointer",
        borderBottom: `1px solid ${G_SURFACE.line}`,
        background: selected
          ? `linear-gradient(135deg, ${dominant}14, transparent 60%), ${G_SURFACE.bg2}`
          : hov
            ? "#0e1118"
            : "transparent",
        transition: "background .12s",
        overflow: "hidden",
      }}
    >
      {/* Selected accent rail */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: selected ? dominant : "transparent",
          boxShadow: selected ? `0 0 12px ${dominant}88` : "none",
          zIndex: 3,
        }}
      />

      <PortraitStrip
        members={team.members}
        fade={fade}
        portraitW={PORTRAIT_W}
        portraitH={148}
        gap={portraitGap}
        leftOffset={LEFT_OFFSET}
        stripWidth={520}
        maskStart={58}
        maskEnd={94}
        vOffset={-6}
      />
      <BlendOverlay members={team.members} intensity="whisper" stops={stops} />

      {/* Foreground content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "14px 18px 14px 20px",
          display: "flex",
          alignItems: "stretch",
          zIndex: 2,
          gap: 18,
          textShadow: TEXT_OVER_PORTRAIT,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 7,
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 9,
                color: G_SURFACE.muted,
                fontFamily: G_MONO,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                padding: "2px 6px",
                border: `1px solid ${G_SURFACE.line}`,
                borderRadius: 2,
                background: G_SURFACE.bg3,
              }}
            >
              team · {team.id.slice(-6).toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 10,
                color: G_SURFACE.muted,
                fontFamily: G_MONO,
              }}
            >
              {team.updated}
            </span>
          </div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: G_SURFACE.fg,
              letterSpacing: -0.3,
              lineHeight: 1.1,
            }}
          >
            {team.name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 10.5,
              color: G_SURFACE.muted,
              fontFamily: G_MONO,
            }}
          >
            {team.members.map((m, i) => (
              <span
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ElDot element={m.element} size={5} />
                  <span>{m.element}</span>
                </span>
                {i < team.members.length - 1 && (
                  <span style={{ color: G_SURFACE.dim }}>›</span>
                )}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-end",
            gap: 10,
            minWidth: 150,
          }}
        >
          <Kpi
            label="dmg"
            value={team.totalDmg.toLocaleString()}
            accent="#f5cf4d"
            big
          />
          <div style={{ display: "flex", gap: 18, alignItems: "flex-end" }}>
            <Kpi
              label="dps"
              value={team.dps.toLocaleString()}
              accent="#5ad7f0"
            />
            <Kpi label="t" value={`${team.totalTime.toFixed(2)}`} suffix="s" />
          </div>
        </div>
      </div>
    </div>
  )
}

function LibraryList({
  teams,
  selectedId,
  onSelect,
  query,
  setQuery,
  sort,
  setSort,
}: {
  teams: LibTeam[]
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
  setQuery: (q: string) => void
  sort: string
  setSort: (s: string) => void
}) {
  const isEmpty = teams.length === 0
  const filtered = useMemo(
    () =>
      teams.filter(
        (t) =>
          !query ||
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.members.some((m) =>
            m.name.toLowerCase().includes(query.toLowerCase()),
          ),
      ),
    [teams, query],
  )
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (sort === "dmg") return b.totalDmg - a.totalDmg
        if (sort === "dps") return b.dps - a.dps
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
      }),
    [filtered, sort],
  )

  return (
    <div
      style={{
        width: LIBRARY_W,
        flexShrink: 0,
        borderLeft: `1px solid ${G_SURFACE.line}`,
        background: G_SURFACE.bg3,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${G_SURFACE.line}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Library</span>
          <span
            style={{ fontSize: 11, color: G_SURFACE.muted, fontFamily: G_MONO }}
          >
            {isEmpty ? "0" : `${sorted.length}/${teams.length}`}
          </span>
        </div>

        {isEmpty ? (
          <span
            style={{
              flex: 1,
              textAlign: "right",
              fontSize: 10,
              color: G_SURFACE.dim,
              fontFamily: G_MONO,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            empty
          </span>
        ) : (
          <>
            <label
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: G_SURFACE.bg,
                border: `1px solid ${G_SURFACE.line}`,
                borderRadius: 3,
                padding: "4px 8px",
              }}
            >
              <Icon d={RX.pencil} size={11} style={{ color: G_SURFACE.dim }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter teams or members…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  color: G_SURFACE.fg,
                  fontFamily: G_FONT,
                  fontSize: 11,
                  padding: 0,
                }}
              />
              {query && (
                <IconBtn
                  d={RX.cross1}
                  label="Clear"
                  w={16}
                  h={16}
                  size={10}
                  onClick={() => setQuery("")}
                />
              )}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  fontSize: 9,
                  color: G_SURFACE.muted,
                  fontFamily: G_MONO,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginRight: 4,
                }}
              >
                sort
              </span>
              {["recent", "dmg", "dps"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSort(opt)}
                  style={{
                    fontSize: 9,
                    padding: "3px 7px",
                    background: sort === opt ? G_SURFACE.bg2 : "transparent",
                    color: sort === opt ? G_SURFACE.fg : G_SURFACE.muted,
                    border:
                      "1px solid " +
                      (sort === opt ? G_SURFACE.line : "transparent"),
                    borderRadius: 2,
                    cursor: "pointer",
                    fontFamily: G_MONO,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {isEmpty ? (
        <LibraryEmptyList />
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {sorted.map((team) => (
            <TeamTab
              key={team.id}
              team={team}
              selected={team.id === selectedId}
              onClick={() => onSelect(team.id)}
            />
          ))}
          {sorted.length === 0 && (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: G_SURFACE.muted,
                fontSize: 11,
              }}
            >
              No teams match "{query}"
            </div>
          )}
        </div>
      )}

      <div
        style={{
          padding: "6px 12px",
          borderTop: `1px solid ${G_SURFACE.line}`,
          fontSize: 10,
          color: G_SURFACE.muted,
          fontFamily: G_MONO,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <kbd
          style={{
            fontSize: 9,
            padding: "1px 4px",
            background: G_SURFACE.bg2,
            border: `1px solid ${G_SURFACE.line}`,
            borderRadius: 2,
          }}
        >
          ↑↓
        </kbd>
        <span>navigate</span>
        <span style={{ color: G_SURFACE.dim }}>·</span>
        <kbd
          style={{
            fontSize: 9,
            padding: "1px 4px",
            background: G_SURFACE.bg2,
            border: `1px solid ${G_SURFACE.line}`,
            borderRadius: 2,
          }}
        >
          ⏎
        </kbd>
        <span>{isEmpty ? "create" : "load into sim"}</span>
      </div>
    </div>
  )
}

// ── Page frame ────────────────────────────────────────────────────────────────

export function LibraryPage() {
  const teams = LIB_TEAMS
  const [selectedId, setSelectedId] = useState<string | null>(
    teams[0]?.id ?? null,
  )
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("recent")
  const selectedTeam = teams.find((t) => t.id === selectedId) ?? null
  const isEmpty = teams.length === 0

  const leftRailItems = [
    { d: RX.rows, active: false },
    { d: RX.layers, active: true },
    { d: RX.clock, active: false },
    { d: RX.pencil, active: false },
  ]

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: G_SURFACE.bg,
        color: G_SURFACE.fg,
        fontFamily: G_FONT,
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          background: G_SURFACE.bg2,
          borderBottom: `1px solid ${G_SURFACE.line}`,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: "linear-gradient(135deg,#8fb4ff,#3b6fff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#0a0b0d",
            }}
          >
            S
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.4 }}>
            SIM/DECK
          </span>
          <span
            style={{
              fontSize: 9,
              color: G_SURFACE.muted,
              fontFamily: G_MONO,
              padding: "2px 7px",
              border: `1px solid ${G_SURFACE.line}`,
              borderRadius: 2,
              letterSpacing: 1.2,
            }}
          >
            LIBRARY
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <Link
          to="/"
          style={{
            color: G_SURFACE.muted,
            fontSize: 11,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Simulator
        </Link>
        <HBtn icon={RX.upload} label="import" />
        <HBtn icon={RX.download} label="export" />
        <HBtn icon={RX.plus} label="New team" primary />
        <IconBtn d={RX.gear} label="Settings" />
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Left rail */}
        <div
          style={{
            width: 56,
            flexShrink: 0,
            background: G_SURFACE.bg3,
            borderRight: `1px solid ${G_SURFACE.line}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "12px 0",
            gap: 8,
          }}
        >
          {leftRailItems.map((it, i) => (
            <div key={i} style={{ position: "relative" }}>
              {it.active && (
                <div
                  style={{
                    position: "absolute",
                    left: -16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 2,
                    height: 20,
                    background: G_SURFACE.accent,
                    borderRadius: 1,
                  }}
                />
              )}
              <IconBtn
                d={it.d}
                label=""
                w={32}
                h={32}
                size={15}
                color={it.active ? G_SURFACE.fg : G_SURFACE.muted}
                hoverColor={G_SURFACE.fg}
              />
            </div>
          ))}
        </div>

        {/* Main pane */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <DetailCard team={selectedTeam} isEmpty={isEmpty} />
        </div>

        {/* Library list */}
        <LibraryList
          teams={teams}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          setQuery={setQuery}
          sort={sort}
          setSort={setSort}
        />
      </div>
    </div>
  )
}
