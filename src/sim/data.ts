import { Ops } from "@typeonce/ritmo"

// ── Closed Sets ──────────────────────────────────────────────────────────

export const GOOD_IDS = [
  "grain",
  "fish",
  "beer",
  "timber",
  "bricks",
  "salt",
  "ironGoods",
  "cloth",
  "wool",
  "pitch",
  "hemp",
  "spices",
  "wine",
  "furs"
] as const

export type GoodId = (typeof GOOD_IDS)[number]

export const CITY_IDS = [
  "lubeck",
  "hamburg",
  "bremen",
  "rostock",
  "stettin",
  "danzig",
  "riga",
  "stockholm",
  "visby",
  "malmo",
  "bergen",
  "london"
] as const

export type CityId = (typeof CITY_IDS)[number]

export const SHIP_CLASS_IDS = ["snaikka", "kraier", "cog", "hulk"] as const
export type ShipClassId = (typeof SHIP_CLASS_IDS)[number]

export const BUSINESS_IDS = [
  "grainFarm",
  "fishery",
  "brewery",
  "sawmill",
  "brickworks",
  "saltworks",
  "ironworks",
  "weavingMill",
  "pitchmaker",
  "hempFarm",
  "furTrapper",
  "vineyard"
] as const

export type BusinessId = (typeof BUSINESS_IDS)[number]

export const RANK_IDS = [
  "shopkeeper",
  "trader",
  "merchant",
  "travellingMerchant",
  "councillor",
  "patrician",
  "lordMayor",
  "alderman"
] as const

export type RankId = (typeof RANK_IDS)[number]

export const MERCHANT_MARK_IDS = ["cross", "anchor", "key", "gable"] as const
export type MerchantMarkId = (typeof MERCHANT_MARK_IDS)[number]

export const CAPTAIN_TRAIT_IDS = ["navigator", "factor", "gunner", "careful"] as const
export type CaptainTraitId = (typeof CAPTAIN_TRAIT_IDS)[number]

export type SeasonId = "spring" | "summer" | "autumn" | "winter"

export type CityLandmarkId =
  | "holstentor"
  | "speicherstadt"
  | "roland"
  | "granary"
  | "castle"
  | "krantor"
  | "blackheads"
  | "trekronor"
  | "ringmur"
  | "herringWharf"
  | "bryggen"
  | "towerBridge"

// ── Merchant Marks (Hausmarke) ───────────────────────────────────────────

export interface MerchantMarkDef {
  readonly id: MerchantMarkId
  readonly name: string
  readonly glyph: string
}

export const MERCHANT_MARKS: Record<MerchantMarkId, MerchantMarkDef> = {
  cross: { id: "cross", name: "Hanseatic Cross", glyph: "✠" },
  anchor: { id: "anchor", name: "Baltic Anchor", glyph: "⚓" },
  key: { id: "key", name: "Bremen Key", glyph: "⚷" },
  gable: { id: "gable", name: "Stepped Gable", glyph: "⌂" }
} satisfies Record<MerchantMarkId, MerchantMarkDef>

// ── Captain Traits ───────────────────────────────────────────────────────

export interface CaptainTraitDef {
  readonly id: CaptainTraitId
  readonly name: string
  readonly summary: string
  readonly speedMult: number
  readonly tradeBonus: number
  readonly combatBonus: number
}

export const CAPTAIN_TRAITS: Record<CaptainTraitId, CaptainTraitDef> = {
  navigator: {
    id: "navigator",
    name: "Swift Navigator",
    summary: "+18% sailing speed",
    speedMult: 1.18,
    tradeBonus: 0,
    combatBonus: 0
  },
  factor: {
    id: "factor",
    name: "Shrewd Factor",
    summary: "+6% better trade margins",
    speedMult: 1.0,
    tradeBonus: 0.06,
    combatBonus: 0
  },
  gunner: {
    id: "gunner",
    name: "Iron Gunner",
    summary: "+22 naval combat power",
    speedMult: 1.0,
    tradeBonus: 0,
    combatBonus: 22
  },
  careful: {
    id: "careful",
    name: "Careful Pilot",
    summary: "-40% storm & skirmish hull damage",
    speedMult: 1.04,
    tradeBonus: 0.02,
    combatBonus: 8
  }
} satisfies Record<CaptainTraitId, CaptainTraitDef>

export const CAPTAIN_NAMES: ReadonlyArray<string> = [
  "Klaus Witte",
  "Hinrik Castorp",
  "Bernd Pleskow",
  "Sven Lindholm",
  "Olaf Halvorsen",
  "Dietrich Krumme",
  "Gerd von Soest",
  "Willem van der Meer",
  "Tidemann Warendorp",
  "Magnus Skytte"
]

// ── Goods (14 Authentic Hanseatic Commodities with 3-Class Demand) ───────

export interface GoodDef {
  readonly id: GoodId
  readonly name: string
  readonly shortName: string
  readonly category: "essential" | "material" | "luxury"
  readonly basePrice: number
  readonly minPrice: number
  readonly maxPrice: number
  /** Weekly consumption per 1000 citizens of each social tier */
  readonly poorUse: number
  readonly wealthyUse: number
  readonly richUse: number
  readonly winterMultiplier: number
  readonly accentHex: string
}

export const GOODS: Record<GoodId, GoodDef> = {
  grain: {
    id: "grain",
    name: "Grain",
    shortName: "GRN",
    category: "essential",
    basePrice: 120,
    minPrice: 60,
    maxPrice: 270,
    poorUse: 16,
    wealthyUse: 10,
    richUse: 6,
    winterMultiplier: 1.38,
    accentHex: "#b8893a"
  },
  fish: {
    id: "fish",
    name: "Fish",
    shortName: "FSH",
    category: "essential",
    basePrice: 460,
    minPrice: 260,
    maxPrice: 780,
    poorUse: 6.5,
    wealthyUse: 5.5,
    richUse: 4,
    winterMultiplier: 1.18,
    accentHex: "#2f5a9c"
  },
  beer: {
    id: "beer",
    name: "Beer",
    shortName: "BER",
    category: "essential",
    basePrice: 48,
    minPrice: 28,
    maxPrice: 92,
    poorUse: 28,
    wealthyUse: 22,
    richUse: 12,
    winterMultiplier: 1.0,
    accentHex: "#c27d38"
  },
  timber: {
    id: "timber",
    name: "Timber",
    shortName: "TMB",
    category: "material",
    basePrice: 72,
    minPrice: 40,
    maxPrice: 145,
    poorUse: 13,
    wealthyUse: 10,
    richUse: 8,
    winterMultiplier: 1.55,
    accentHex: "#6f5a44"
  },
  bricks: {
    id: "bricks",
    name: "Bricks",
    shortName: "BRK",
    category: "material",
    basePrice: 98,
    minPrice: 55,
    maxPrice: 195,
    poorUse: 3.5,
    wealthyUse: 7.5,
    richUse: 9,
    winterMultiplier: 0.85,
    accentHex: "#b04a39"
  },
  salt: {
    id: "salt",
    name: "Salt",
    shortName: "SLT",
    category: "material",
    basePrice: 36,
    minPrice: 20,
    maxPrice: 72,
    poorUse: 14,
    wealthyUse: 14,
    richUse: 10,
    winterMultiplier: 1.0,
    accentHex: "#7b8a88"
  },
  ironGoods: {
    id: "ironGoods",
    name: "Iron Goods",
    shortName: "IRN",
    category: "material",
    basePrice: 340,
    minPrice: 210,
    maxPrice: 560,
    poorUse: 2.5,
    wealthyUse: 7.5,
    richUse: 8,
    winterMultiplier: 1.0,
    accentHex: "#495459"
  },
  cloth: {
    id: "cloth",
    name: "Cloth",
    shortName: "CLT",
    category: "luxury",
    basePrice: 260,
    minPrice: 155,
    maxPrice: 440,
    poorUse: 1.8,
    wealthyUse: 9.5,
    richUse: 14,
    winterMultiplier: 1.25,
    accentHex: "#7c4b6e"
  },
  wool: {
    id: "wool",
    name: "Wool",
    shortName: "WOL",
    category: "material",
    basePrice: 920,
    minPrice: 540,
    maxPrice: 1500,
    poorUse: 1.4,
    wealthyUse: 3.5,
    richUse: 3.0,
    winterMultiplier: 1.22,
    accentHex: "#9b8c76"
  },
  pitch: {
    id: "pitch",
    name: "Pitch",
    shortName: "PTC",
    category: "material",
    basePrice: 68,
    minPrice: 38,
    maxPrice: 130,
    poorUse: 3.5,
    wealthyUse: 5.5,
    richUse: 4,
    winterMultiplier: 1.0,
    accentHex: "#3a3f42"
  },
  hemp: {
    id: "hemp",
    name: "Hemp",
    shortName: "HMP",
    category: "material",
    basePrice: 460,
    minPrice: 260,
    maxPrice: 780,
    poorUse: 2.2,
    wealthyUse: 3.8,
    richUse: 2.5,
    winterMultiplier: 1.0,
    accentHex: "#4f8a3e"
  },
  spices: {
    id: "spices",
    name: "Spices",
    shortName: "SPC",
    category: "luxury",
    basePrice: 380,
    minPrice: 220,
    maxPrice: 690,
    poorUse: 0.4,
    wealthyUse: 3.5,
    richUse: 12,
    winterMultiplier: 1.15,
    accentHex: "#9e4f2e"
  },
  wine: {
    id: "wine",
    name: "Wine",
    shortName: "WIN",
    category: "luxury",
    basePrice: 320,
    minPrice: 185,
    maxPrice: 560,
    poorUse: 0.5,
    wealthyUse: 4.5,
    richUse: 14,
    winterMultiplier: 1.1,
    accentHex: "#8c3a44"
  },
  furs: {
    id: "furs",
    name: "Furs",
    shortName: "FUR",
    category: "luxury",
    basePrice: 840,
    minPrice: 510,
    maxPrice: 1420,
    poorUse: 0.2,
    wealthyUse: 2.0,
    richUse: 8.5,
    winterMultiplier: 1.45,
    accentHex: "#6e4e37"
  }
} satisfies Record<GoodId, GoodDef>

export function emptyCargo(): Record<GoodId, number> {
  return {
    grain: 0,
    fish: 0,
    beer: 0,
    timber: 0,
    bricks: 0,
    salt: 0,
    ironGoods: 0,
    cloth: 0,
    wool: 0,
    pitch: 0,
    hemp: 0,
    spices: 0,
    wine: 0,
    furs: 0
  }
}

export function totalCargoUnits(cargo: Readonly<Record<GoodId, number>>): number {
  let total = 0
  for (const id of GOOD_IDS) {
    total += cargo[id]
  }
  return total
}

// ── Cities & Distinct Silhouettes / Landmarks ────────────────────────────

export interface CityDef {
  readonly id: CityId
  readonly name: string
  readonly subtitle: string
  readonly region: "north" | "baltic"
  readonly landmark: CityLandmarkId
  readonly landmarkLabel: string
  readonly x: number
  readonly z: number
  readonly harborX: number
  readonly harborZ: number
  readonly initialPopulation: number
  readonly iceProne: boolean
  readonly primaryGoods: ReadonlyArray<GoodId>
  readonly secondaryGoods: ReadonlyArray<GoodId>
  readonly spireCount: number
  readonly roofAccent: string
  readonly mayorStart: string
}

export const CITIES: Record<CityId, CityDef> = {
  lubeck: {
    id: "lubeck",
    name: "Lübeck",
    subtitle: "Queen of the Hanse · Seven Spires",
    region: "baltic",
    landmark: "holstentor",
    landmarkLabel: "Holstentor Twin Gate",
    x: -4,
    z: 14,
    harborX: -3,
    harborZ: 10.2,
    initialPopulation: 3400,
    iceProne: false,
    primaryGoods: ["ironGoods", "bricks", "salt"],
    secondaryGoods: ["timber", "beer"],
    spireCount: 4,
    roofAccent: "#b04a39",
    mayorStart: "Hermann Warendorp"
  },
  hamburg: {
    id: "hamburg",
    name: "Hamburg",
    subtitle: "Elbe Brewery & Speicherstadt",
    region: "north",
    landmark: "speicherstadt",
    landmarkLabel: "Brick Canal Warehouses",
    x: -11,
    z: 15.5,
    harborX: -13.8,
    harborZ: 12.0,
    initialPopulation: 2900,
    iceProne: false,
    primaryGoods: ["beer", "grain"],
    secondaryGoods: ["bricks", "salt", "wine"],
    spireCount: 2,
    roofAccent: "#a45342",
    mayorStart: "Kersten Miles"
  },
  bremen: {
    id: "bremen",
    name: "Bremen",
    subtitle: "Weser Free Port & Wine Vault",
    region: "north",
    landmark: "roland",
    landmarkLabel: "Weser Wine Cellar",
    x: -17.5,
    z: 17.5,
    harborX: -18.8,
    harborZ: 13.5,
    initialPopulation: 2300,
    iceProne: false,
    primaryGoods: ["grain", "spices", "wine"],
    secondaryGoods: ["beer", "wool"],
    spireCount: 2,
    roofAccent: "#9c5644",
    mayorStart: "Johann Hemeling"
  },
  rostock: {
    id: "rostock",
    name: "Rostock",
    subtitle: "Baltic Granary Port",
    region: "baltic",
    landmark: "granary",
    landmarkLabel: "Great Brick Granary",
    x: 4.5,
    z: 13,
    harborX: 4.2,
    harborZ: 9.6,
    initialPopulation: 2100,
    iceProne: false,
    primaryGoods: ["grain", "bricks"],
    secondaryGoods: ["beer", "hemp"],
    spireCount: 2,
    roofAccent: "#b04a39",
    mayorStart: "Arnold Kröpelin"
  },
  stettin: {
    id: "stettin",
    name: "Stettin",
    subtitle: "Oder Ducal Estuary",
    region: "baltic",
    landmark: "castle",
    landmarkLabel: "Pomeranian Keep",
    x: 12.5,
    z: 14,
    harborX: 12.2,
    harborZ: 10.4,
    initialPopulation: 2200,
    iceProne: false,
    primaryGoods: ["grain", "beer", "hemp"],
    secondaryGoods: ["fish", "timber"],
    spireCount: 2,
    roofAccent: "#9a5b48",
    mayorStart: "Otto Jageteufel"
  },
  danzig: {
    id: "danzig",
    name: "Danzig",
    subtitle: "Vistula Timber & Krantor",
    region: "baltic",
    landmark: "krantor",
    landmarkLabel: "The Great Krantor Gate",
    x: 23,
    z: 11,
    harborX: 22.4,
    harborZ: 7.4,
    initialPopulation: 2800,
    iceProne: false,
    primaryGoods: ["timber", "grain", "wool"],
    secondaryGoods: ["beer", "pitch", "furs"],
    spireCount: 3,
    roofAccent: "#b04a39",
    mayorStart: "Konrad Letzkau"
  },
  riga: {
    id: "riga",
    name: "Riga",
    subtitle: "Livonian Furs, Pitch & Hemp",
    region: "baltic",
    landmark: "blackheads",
    landmarkLabel: "House of the Blackheads",
    x: 35,
    z: -4,
    harborX: 31.0,
    harborZ: -4.5,
    initialPopulation: 2000,
    iceProne: true,
    primaryGoods: ["hemp", "pitch", "furs"],
    secondaryGoods: ["timber", "fish"],
    spireCount: 2,
    roofAccent: "#8c4a3c",
    mayorStart: "Gottschalk Witte"
  },
  stockholm: {
    id: "stockholm",
    name: "Stockholm",
    subtitle: "Crown of Iron, Pine & Furs",
    region: "baltic",
    landmark: "trekronor",
    landmarkLabel: "Tre Kronor Fortress",
    x: 20,
    z: -16,
    harborX: 20.4,
    harborZ: -11.8,
    initialPopulation: 2400,
    iceProne: true,
    primaryGoods: ["ironGoods", "timber", "furs"],
    secondaryGoods: ["pitch", "fish"],
    spireCount: 2,
    roofAccent: "#8e4d3e",
    mayorStart: "Albrecht of Mecklenburg"
  },
  visby: {
    id: "visby",
    name: "Visby",
    subtitle: "Gotland Limestone Citadel",
    region: "baltic",
    landmark: "ringmur",
    landmarkLabel: "Visby Ringmur Wall",
    x: 19,
    z: -3.5,
    harborX: 16.0,
    harborZ: -2.2,
    initialPopulation: 1800,
    iceProne: false,
    primaryGoods: ["wool", "cloth"],
    secondaryGoods: ["fish", "bricks"],
    spireCount: 2,
    roofAccent: "#9c6348",
    mayorStart: "Niels Krummedige"
  },
  malmo: {
    id: "malmo",
    name: "Malmö",
    subtitle: "Sound Herring Fair",
    region: "baltic",
    landmark: "herringWharf",
    landmarkLabel: "Øresund Herring Quay",
    x: 3.5,
    z: 2.5,
    harborX: 0.4,
    harborZ: 3.6,
    initialPopulation: 2000,
    iceProne: false,
    primaryGoods: ["fish", "cloth"],
    secondaryGoods: ["grain", "wool"],
    spireCount: 2,
    roofAccent: "#a45341",
    mayorStart: "Mogens Munk"
  },
  bergen: {
    id: "bergen",
    name: "Bergen",
    subtitle: "Bryggen Stockfish Kontor",
    region: "north",
    landmark: "bryggen",
    landmarkLabel: "Bryggen Timber Row",
    x: -14,
    z: -19,
    harborX: -17.2,
    harborZ: -16.8,
    initialPopulation: 2200,
    iceProne: false,
    primaryGoods: ["fish", "timber", "pitch"],
    secondaryGoods: ["wool", "furs"],
    spireCount: 1,
    roofAccent: "#8f4e3c",
    mayorStart: "Einar Haakonsson"
  },
  london: {
    id: "london",
    name: "London",
    subtitle: "Steelyard Cloth & Wine Emporium",
    region: "north",
    landmark: "towerBridge",
    landmarkLabel: "White Tower & Thames Bridge",
    x: -38,
    z: 13,
    harborX: -34.0,
    harborZ: 11.4,
    initialPopulation: 3600,
    iceProne: false,
    primaryGoods: ["cloth", "spices", "wine"],
    secondaryGoods: ["beer", "ironGoods"],
    spireCount: 3,
    roofAccent: "#8f4e3e",
    mayorStart: "William Walworth"
  }
} satisfies Record<CityId, CityDef>

// ── Maritime Waypoint Graph ──────────────────────────────────────────────

export interface SeaNode {
  readonly id: string
  readonly x: number
  readonly z: number
  readonly cityId?: CityId
}

export const SEA_NODES: ReadonlyArray<SeaNode> = [
  ...CITY_IDS.map((id) => ({
    id,
    x: CITIES[id].harborX,
    z: CITIES[id].harborZ,
    cityId: id
  })),
  { id: "wp_north_sea", x: -24, z: 2 },
  { id: "wp_skagerrak", x: -11, z: -8 },
  { id: "wp_kattegat", x: -2.5, z: -3 },
  { id: "wp_sound", x: -0.5, z: 6.5 },
  { id: "wp_west_baltic", x: 6, z: 6.5 },
  { id: "wp_central_baltic", x: 14, z: 3 },
  { id: "wp_gotland_east", x: 24, z: -2 },
  { id: "wp_north_baltic", x: 24, z: -10 },
  { id: "wp_channel", x: -26, z: 10 },
  { id: "wp_helgoland", x: -17, z: 7 }
]

export const SEA_EDGES: ReadonlyArray<readonly [string, string]> = [
  ["london", "wp_channel"],
  ["wp_channel", "bremen"],
  ["wp_channel", "wp_helgoland"],
  ["wp_channel", "wp_north_sea"],
  ["bremen", "wp_helgoland"],
  ["hamburg", "wp_helgoland"],
  ["wp_helgoland", "wp_north_sea"],
  ["bergen", "wp_north_sea"],
  ["bergen", "wp_skagerrak"],
  ["wp_north_sea", "wp_skagerrak"],
  ["wp_skagerrak", "wp_kattegat"],
  ["wp_kattegat", "malmo"],
  ["wp_kattegat", "wp_sound"],
  ["malmo", "wp_sound"],
  ["lubeck", "wp_sound"],
  ["lubeck", "rostock"],
  ["rostock", "wp_west_baltic"],
  ["wp_sound", "wp_west_baltic"],
  ["malmo", "wp_west_baltic"],
  ["stettin", "wp_west_baltic"],
  ["stettin", "wp_central_baltic"],
  ["wp_west_baltic", "wp_central_baltic"],
  ["danzig", "wp_central_baltic"],
  ["visby", "wp_central_baltic"],
  ["visby", "wp_gotland_east"],
  ["danzig", "wp_gotland_east"],
  ["riga", "wp_gotland_east"],
  ["riga", "wp_north_baltic"],
  ["wp_gotland_east", "wp_north_baltic"],
  ["stockholm", "wp_north_baltic"],
  ["stockholm", "visby"]
]

export interface Waypoint {
  readonly x: number
  readonly z: number
}

const NODE_BY_ID: ReadonlyMap<string, SeaNode> = new Map(SEA_NODES.map((n) => [n.id, n]))

const ADJACENCY: ReadonlyMap<string, ReadonlyArray<{ readonly to: string; readonly dist: number }>> =
  (() => {
    const map = new Map<string, Array<{ readonly to: string; readonly dist: number }>>()
    for (const node of SEA_NODES) map.set(node.id, [])
    for (const [aId, bId] of SEA_EDGES) {
      const a = NODE_BY_ID.get(aId)
      const b = NODE_BY_ID.get(bId)
      if (!a || !b) continue
      const dist = Ops.hypot(b.x - a.x, b.z - a.z)
      map.get(aId)?.push({ to: bId, dist })
      map.get(bId)?.push({ to: aId, dist })
    }
    return map
  })()

export function computeSeaRoute(
  fromX: number,
  fromZ: number,
  fromCityId: CityId | null,
  toCityId: CityId
): ReadonlyArray<Waypoint> {
  let startId: string = fromCityId ?? "lubeck"
  if (!fromCityId) {
    let bestDist = 1e9
    for (const node of SEA_NODES) {
      const d = Ops.hypot(node.x - fromX, node.z - fromZ)
      if (d < bestDist) {
        bestDist = d
        startId = node.id
      }
    }
  }

  if (startId === toCityId) {
    const target = NODE_BY_ID.get(toCityId)
    return target ? [{ x: target.x, z: target.z }] : []
  }

  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const unvisited = new Set<string>()
  for (const node of SEA_NODES) {
    dist.set(node.id, 1e9)
    unvisited.add(node.id)
  }
  dist.set(startId, 0)

  while (unvisited.size > 0) {
    let current: string | null = null
    let best = 1e9
    for (const id of unvisited) {
      const d = dist.get(id) ?? 1e9
      if (d < best) {
        best = d
        current = id
      }
    }
    if (current === null || current === toCityId) break
    unvisited.delete(current)

    const neighbors = ADJACENCY.get(current) ?? []
    for (const edge of neighbors) {
      if (!unvisited.has(edge.to)) continue
      const alt = best + edge.dist
      if (alt < (dist.get(edge.to) ?? 1e9)) {
        dist.set(edge.to, alt)
        prev.set(edge.to, current)
      }
    }
  }

  const pathIds: Array<string> = []
  let cursor: string | undefined = toCityId
  while (cursor !== undefined) {
    pathIds.push(cursor)
    if (cursor === startId) break
    cursor = prev.get(cursor)
  }
  pathIds.reverse()

  const waypoints: Array<Waypoint> = []
  for (let i = 0; i < pathIds.length; i++) {
    const id = pathIds[i]
    if (!id) continue
    if (i === 0 && fromCityId === id) continue
    const node = NODE_BY_ID.get(id)
    if (node) waypoints.push({ x: node.x, z: node.z })
  }
  return waypoints
}

// ── Ships (with real material costs & build days) ────────────────────────

export interface ShipClassDef {
  readonly id: ShipClassId
  readonly name: string
  readonly capacity: number
  readonly speed: number
  readonly maxHull: number
  readonly maxCannons: number
  readonly minCrew: number
  readonly maxCrew: number
  readonly goldCost: number
  readonly buildDays: number
  readonly materials: ReadonlyArray<{ readonly good: GoodId; readonly amount: number }>
  readonly weeklyWage: number
  readonly description: string
}

export const SHIP_CLASSES: Record<ShipClassId, ShipClassDef> = {
  snaikka: {
    id: "snaikka",
    name: "Snaikka",
    capacity: 180,
    speed: 4.5,
    maxHull: 100,
    maxCannons: 4,
    minCrew: 6,
    maxCrew: 18,
    goldCost: 9500,
    buildDays: 7,
    materials: [
      { good: "timber", amount: 10 },
      { good: "cloth", amount: 4 },
      { good: "pitch", amount: 4 }
    ],
    weeklyWage: 140,
    description: "Swift shallow-draft Hanseatic courier."
  },
  kraier: {
    id: "kraier",
    name: "Kraier",
    capacity: 280,
    speed: 4.0,
    maxHull: 150,
    maxCannons: 8,
    minCrew: 8,
    maxCrew: 26,
    goldCost: 16500,
    buildDays: 10,
    materials: [
      { good: "timber", amount: 16 },
      { good: "cloth", amount: 6 },
      { good: "hemp", amount: 4 },
      { good: "pitch", amount: 6 }
    ],
    weeklyWage: 220,
    description: "Versatile armed merchantman and pirate hunter."
  },
  cog: {
    id: "cog",
    name: "Cog",
    capacity: 430,
    speed: 3.35,
    maxHull: 220,
    maxCannons: 12,
    minCrew: 12,
    maxCrew: 38,
    goldCost: 27000,
    buildDays: 14,
    materials: [
      { good: "timber", amount: 24 },
      { good: "cloth", amount: 10 },
      { good: "hemp", amount: 6 },
      { good: "pitch", amount: 10 }
    ],
    weeklyWage: 340,
    description: "Iconic high-sided workhorse of the Hanseatic League."
  },
  hulk: {
    id: "hulk",
    name: "Hulk",
    capacity: 640,
    speed: 2.95,
    maxHull: 320,
    maxCannons: 18,
    minCrew: 16,
    maxCrew: 55,
    goldCost: 46000,
    buildDays: 18,
    materials: [
      { good: "timber", amount: 34 },
      { good: "cloth", amount: 14 },
      { good: "hemp", amount: 10 },
      { good: "pitch", amount: 14 }
    ],
    weeklyWage: 520,
    description: "Colossal flagship freighter and heavy convoy escort."
  }
} satisfies Record<ShipClassId, ShipClassDef>

// ── Production Businesses (with real materials & construction days) ──────

export interface BusinessDef {
  readonly id: BusinessId
  readonly name: string
  readonly outputGood: GoodId
  readonly weeklyOutput: number
  readonly winterOutputMult: number
  readonly inputGoods: ReadonlyArray<{ readonly good: GoodId; readonly amount: number }>
  readonly goldCost: number
  readonly timberCost: number
  readonly bricksCost: number
  readonly buildDays: number
  readonly weeklyWage: number
  readonly workers: number
  readonly accentHex: string
}

export const BUSINESSES: Record<BusinessId, BusinessDef> = {
  grainFarm: {
    id: "grainFarm",
    name: "Grain Farm",
    outputGood: "grain",
    weeklyOutput: 15,
    winterOutputMult: 0.45,
    inputGoods: [],
    goldCost: 5800,
    timberCost: 8,
    bricksCost: 6,
    buildDays: 8,
    weeklyWage: 220,
    workers: 25,
    accentHex: "#b8893a"
  },
  fishery: {
    id: "fishery",
    name: "Fisherman's Hut",
    outputGood: "fish",
    weeklyOutput: 7,
    winterOutputMult: 0.7,
    inputGoods: [
      { good: "salt", amount: 3 },
      { good: "hemp", amount: 1 }
    ],
    goldCost: 6400,
    timberCost: 10,
    bricksCost: 5,
    buildDays: 8,
    weeklyWage: 250,
    workers: 25,
    accentHex: "#2f5a9c"
  },
  brewery: {
    id: "brewery",
    name: "Brewery",
    outputGood: "beer",
    weeklyOutput: 28,
    winterOutputMult: 1.0,
    inputGoods: [{ good: "grain", amount: 5 }],
    goldCost: 7500,
    timberCost: 8,
    bricksCost: 12,
    buildDays: 10,
    weeklyWage: 290,
    workers: 30,
    accentHex: "#c27d38"
  },
  sawmill: {
    id: "sawmill",
    name: "Sawmill",
    outputGood: "timber",
    weeklyOutput: 17,
    winterOutputMult: 0.85,
    inputGoods: [],
    goldCost: 5400,
    timberCost: 6,
    bricksCost: 5,
    buildDays: 7,
    weeklyWage: 210,
    workers: 25,
    accentHex: "#6f5a44"
  },
  brickworks: {
    id: "brickworks",
    name: "Brickworks",
    outputGood: "bricks",
    weeklyOutput: 15,
    winterOutputMult: 0.85,
    inputGoods: [{ good: "timber", amount: 4 }],
    goldCost: 6800,
    timberCost: 10,
    bricksCost: 8,
    buildDays: 9,
    weeklyWage: 240,
    workers: 30,
    accentHex: "#b04a39"
  },
  saltworks: {
    id: "saltworks",
    name: "Saltworks",
    outputGood: "salt",
    weeklyOutput: 22,
    winterOutputMult: 1.0,
    inputGoods: [{ good: "timber", amount: 4 }],
    goldCost: 7000,
    timberCost: 10,
    bricksCost: 10,
    buildDays: 9,
    weeklyWage: 260,
    workers: 28,
    accentHex: "#7b8a88"
  },
  ironworks: {
    id: "ironworks",
    name: "Iron Foundry",
    outputGood: "ironGoods",
    weeklyOutput: 8,
    winterOutputMult: 1.0,
    inputGoods: [{ good: "timber", amount: 5 }],
    goldCost: 11200,
    timberCost: 12,
    bricksCost: 16,
    buildDays: 12,
    weeklyWage: 420,
    workers: 35,
    accentHex: "#495459"
  },
  weavingMill: {
    id: "weavingMill",
    name: "Weaving Mill",
    outputGood: "cloth",
    weeklyOutput: 10,
    winterOutputMult: 1.0,
    inputGoods: [{ good: "wool", amount: 2 }],
    goldCost: 9800,
    timberCost: 10,
    bricksCost: 14,
    buildDays: 11,
    weeklyWage: 360,
    workers: 30,
    accentHex: "#7c4b6e"
  },
  pitchmaker: {
    id: "pitchmaker",
    name: "Pitchmaker",
    outputGood: "pitch",
    weeklyOutput: 14,
    winterOutputMult: 0.9,
    inputGoods: [{ good: "timber", amount: 5 }],
    goldCost: 6200,
    timberCost: 8,
    bricksCost: 8,
    buildDays: 8,
    weeklyWage: 230,
    workers: 25,
    accentHex: "#3a3f42"
  },
  hempFarm: {
    id: "hempFarm",
    name: "Ropewalk & Hemp",
    outputGood: "hemp",
    weeklyOutput: 6,
    winterOutputMult: 0.55,
    inputGoods: [],
    goldCost: 6800,
    timberCost: 8,
    bricksCost: 6,
    buildDays: 8,
    weeklyWage: 240,
    workers: 25,
    accentHex: "#4f8a3e"
  },
  furTrapper: {
    id: "furTrapper",
    name: "Hunting Lodge",
    outputGood: "furs",
    weeklyOutput: 5,
    winterOutputMult: 1.2,
    inputGoods: [{ good: "hemp", amount: 1 }],
    goldCost: 9200,
    timberCost: 12,
    bricksCost: 6,
    buildDays: 10,
    weeklyWage: 320,
    workers: 24,
    accentHex: "#6e4e37"
  },
  vineyard: {
    id: "vineyard",
    name: "Wine Press",
    outputGood: "wine",
    weeklyOutput: 8,
    winterOutputMult: 0.6,
    inputGoods: [{ good: "timber", amount: 2 }],
    goldCost: 10400,
    timberCost: 10,
    bricksCost: 12,
    buildDays: 11,
    weeklyWage: 340,
    workers: 26,
    accentHex: "#8c3a44"
  }
} satisfies Record<BusinessId, BusinessDef>

export const KONTOR_COST = 16000
export const HOUSE_COST = 4600
export const HOUSE_TIMBER_COST = 6
export const HOUSE_BRICKS_COST = 8
export const GUILD_ENTRY_COST = 14000
export const FEAST_COST = 4500
export const DONATE_COST = 3000
export const CANNON_COST = 650
export const CAPTAIN_HIRE_COST = 2400
export const KONTOR_MANAGER_WEEKLY_WAGE = 260
export const WELL_COST = 3800
export const HOSPITAL_COST = 6800

// ── Social & Political Ranks (calibrated so Day 1 is ~72% toward Trader) ─

export interface RankDef {
  readonly id: RankId
  readonly title: string
  readonly minWealth: number
  readonly minShips: number
  readonly requiresGuild: boolean
  readonly minKontors: number
  readonly minBusinesses: number
  readonly minHomeRep: number
  readonly requiresMayor: boolean
  readonly minAldermanTasks: number
}

export const RANKS: Record<RankId, RankDef> = {
  shopkeeper: {
    id: "shopkeeper",
    title: "Shopkeeper",
    minWealth: 0,
    minShips: 1,
    requiresGuild: false,
    minKontors: 1,
    minBusinesses: 0,
    minHomeRep: 0,
    requiresMayor: false,
    minAldermanTasks: 0
  },
  trader: {
    id: "trader",
    title: "Trader",
    minWealth: 54000,
    minShips: 1,
    requiresGuild: false,
    minKontors: 1,
    minBusinesses: 0,
    minHomeRep: 40,
    requiresMayor: false,
    minAldermanTasks: 0
  },
  merchant: {
    id: "merchant",
    title: "Merchant",
    minWealth: 86000,
    minShips: 2,
    requiresGuild: false,
    minKontors: 1,
    minBusinesses: 1,
    minHomeRep: 46,
    requiresMayor: false,
    minAldermanTasks: 0
  },
  travellingMerchant: {
    id: "travellingMerchant",
    title: "Travelling Merchant",
    minWealth: 135000,
    minShips: 2,
    requiresGuild: true,
    minKontors: 2,
    minBusinesses: 2,
    minHomeRep: 54,
    requiresMayor: false,
    minAldermanTasks: 0
  },
  councillor: {
    id: "councillor",
    title: "Councillor",
    minWealth: 210000,
    minShips: 3,
    requiresGuild: true,
    minKontors: 2,
    minBusinesses: 3,
    minHomeRep: 62,
    requiresMayor: false,
    minAldermanTasks: 0
  },
  patrician: {
    id: "patrician",
    title: "Patrician",
    minWealth: 300000,
    minShips: 4,
    requiresGuild: true,
    minKontors: 3,
    minBusinesses: 4,
    minHomeRep: 72,
    requiresMayor: false,
    minAldermanTasks: 0
  },
  lordMayor: {
    id: "lordMayor",
    title: "Lord Mayor",
    minWealth: 380000,
    minShips: 4,
    requiresGuild: true,
    minKontors: 3,
    minBusinesses: 5,
    minHomeRep: 78,
    requiresMayor: true,
    minAldermanTasks: 0
  },
  alderman: {
    id: "alderman",
    title: "Alderman of the Hanse",
    minWealth: 520000,
    minShips: 5,
    requiresGuild: true,
    minKontors: 4,
    minBusinesses: 6,
    minHomeRep: 82,
    requiresMayor: true,
    minAldermanTasks: 2
  }
} satisfies Record<RankId, RankDef>

export const SHIP_NAME_POOL: ReadonlyArray<string> = [
  "Hanseatic Dawn",
  "Lübeck Eagle",
  "Baltic Swallow",
  "Golden Herring",
  "Marienkrone",
  "Northern Star",
  "Vistula Merchant",
  "Amber Cog",
  "Steelyard Hawk",
  "Gotland Swan",
  "Elbe Pride",
  "Weser Lion",
  "Fjord Runner",
  "Hanseatic Seal"
]

export const PIRATE_NAME_POOL: ReadonlyArray<string> = [
  "Victual Brother",
  "Störtebeker's Fang",
  "Godeke Michels",
  "Baltic Wolf",
  "Iron Raven",
  "Red Corsair"
]

// ── 3-Class Dynamic Market Pricing Formula ───────────────────────────────

export function weeklyCityDemand(
  goodId: GoodId,
  poorPop: number,
  wealthyPop: number,
  richPop: number,
  season: SeasonId
): number {
  const def = GOODS[goodId]
  const seasonal = season === "winter" ? def.winterMultiplier : 1
  const raw =
    (poorPop / 1000) * def.poorUse +
    (wealthyPop / 1000) * def.wealthyUse +
    (richPop / 1000) * def.richUse
  return Math.max(0.8, raw * seasonal)
}

export function computeMarketPrice(
  goodId: GoodId,
  stock: number,
  poorPop: number,
  wealthyPop: number,
  richPop: number,
  season: SeasonId
): {
  readonly buyPrice: number
  readonly sellPrice: number
  readonly midPrice: number
  readonly weeksOfStock: number
} {
  const def = GOODS[goodId]
  const demand = weeklyCityDemand(goodId, poorPop, wealthyPop, richPop, season)
  const weeks = stock / demand
  const ratio = Ops.exp(-0.26 * (weeks - 3.5))
  const raw = def.basePrice * ratio
  const midPrice = Math.round(Math.max(def.minPrice, Math.min(def.maxPrice, raw)))
  const buyPrice = Math.max(def.minPrice, Math.round(midPrice * 1.02))
  const sellPrice = Math.max(Math.round(def.minPrice * 0.92), Math.round(midPrice * 0.98))
  return { buyPrice, sellPrice, midPrice, weeksOfStock: weeks }
}

export function seasonForMonth(month: number): SeasonId {
  if (month >= 3 && month <= 5) return "spring"
  if (month >= 6 && month <= 8) return "summer"
  if (month >= 9 && month <= 11) return "autumn"
  return "winter"
}

export function cityProducesGood(cityId: CityId, goodId: GoodId): "primary" | "secondary" | "none" {
  const def = CITIES[cityId]
  if (def.primaryGoods.includes(goodId)) return "primary"
  if (def.secondaryGoods.includes(goodId)) return "secondary"
  return "none"
}
