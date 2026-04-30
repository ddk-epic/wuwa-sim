import type { Weapon } from "#/types/weapon"
import stringmasterData from "./raw/stringmaster.json"
import emeraldOfGenesisData from "./raw/emerald-of-genesis.json"

export const ALL_WEAPONS: Weapon[] = [
  emeraldOfGenesisData,
  stringmasterData,
] as Weapon[]
