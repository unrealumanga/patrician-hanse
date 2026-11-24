import {
  BUSINESSES,
  CITIES,
  CITY_IDS,
  computeMarketPrice,
  GOOD_IDS,
  GOODS,
  HOUSE_COST,
  KONTOR_COST,
  RANK_IDS,
  RANKS,
  SHIP_CLASSES,
  totalCargoUnits,
  weeklyCityDemand,
  type CityId,
  type CityLandmarkId,
  type GoodId,
  type RankDef
} from "./data.ts"
import {
  Calendar,
  Chronicle,
  City,
  Company,
  Contract,
  Feedback,
  Game,
  GamePhase,
  Selection,
  Ship,
  Weather,
  type CalendarData,
  type ChronicleEntry,
  type CompanyData,
  type ContractData,
  type FeedbackCue,
  type SelectionData,
  type ShipData,
  type WeatherData
} from "./schema.ts"

export interface MarketRowView {
  readonly goodId: GoodId
  readonly stock: number
  readonly kontorStock: number
  readonly kontorAvgCost: number
  readonly shipStock: number
  readonly shipAvgCost: number
  readonly buyPrice: number
  readonly sellPrice: number
  readonly basePrice: number
  readonly weeklyDemand: number
  readonly weeksOfStock: number
  readonly priceSignal: "cheap" | "fair" | "pricey" | "scarce"
  readonly productionTier: "primary" | "secondary" | "none"
}

export interface CityView {
  readonly id: CityId
  readonly name: string
  readonly subtitle: string
  readonly landmark: CityLandmarkId
  readonly landmarkLabel: string
  readonly poorPop: number
  readonly wealthyPop: number
  readonly richPop: number
  readonly totalPop: number
  readonly mood: number
  readonly playerReputation: number
  readonly stock: Readonly<Record<GoodId, number>>
  readonly kontorOwned: boolean
  readonly kontorManager: boolean
  readonly kontorStock: Readonly<Record<GoodId, number>>
  readonly kontorAvgCost: Readonly<Record<GoodId, number>>
  readonly businesses: ReadonlyArray<{
    readonly id: number
    readonly type: keyof typeof BUSINESSES
    readonly plotIndex: number
    readonly efficiency: number
    readonly active: boolean
    readonly buildDaysLeft: number
    readonly totalBuildDays: number
  }>
  readonly shipyardOrder: {
    readonly shipClass: keyof typeof SHIP_CLASSES
    readonly name: string
    readonly daysLeft: number
    readonly totalDays: number
  } | null
  readonly tavernCaptain: {
    readonly name: string
    readonly trait: "navigator" | "factor" | "gunner" | "careful"
    readonly hireCost: number
  } | null
  readonly playerHouses: number
  readonly hasWell: boolean
  readonly hasHospital: boolean
  readonly wallLevel: number
  readonly isIced: boolean
  readonly famineDays: number
  readonly plagueDays: number
  readonly mayorName: string
  readonly playerIsMayor: boolean
  readonly x: number
  readonly z: number
  readonly harborX: number
  readonly harborZ: number
  readonly market: ReadonlyArray<MarketRowView>
  readonly dockedPlayerShipIds: ReadonlyArray<number>
}

export interface ShipView extends ShipData {
  readonly className: string
  readonly capacity: number
  readonly usedCargo: number
  readonly maxCannons: number
  readonly repairCost: number
}

export interface WorldView {
  readonly phase: "Boot" | "Playing" | "Victory"
  readonly company: CompanyData
  readonly totalWealth: number
  readonly nextRank: RankDef | null
  readonly calendar: CalendarData
  readonly weather: WeatherData
  readonly selection: SelectionData
  readonly cities: ReadonlyArray<CityView>
  readonly ships: ReadonlyArray<ShipView>
  readonly contracts: ReadonlyArray<ContractData>
  readonly chronicle: ReadonlyArray<ChronicleEntry>
  readonly cues: ReadonlyArray<FeedbackCue>
}

export const ReadWorldView = Game.Inspector(
  "Hanse/ReadWorldView",
  {
    resources: {
      company: Game.System.readResource(Company),
      calendar: Game.System.readResource(Calendar),
      weather: Game.System.readResource(Weather),
      selection: Game.System.readResource(Selection),
      chronicle: Game.System.readResource(Chronicle),
      feedback: Game.System.readResource(Feedback)
    },
    machines: {
      phase: Game.System.machine(GamePhase)
    },
    queries: {
      cities: Game.Query({ selection: { city: Game.Query.read(City) } }),
      ships: Game.Query({ selection: { ship: Game.Query.read(Ship) } }),
      contracts: Game.Query({ selection: { contract: Game.Query.read(Contract) } })
    }
  },
  ({ resources, machines, queries }): WorldView => {
    const company = resources.company.get()
    const calendar = resources.calendar.get()
    const weather = resources.weather.get()
    const selection = resources.selection.get()
    const chronicle = resources.chronicle.get()
    const feedback = resources.feedback.get()
    const phase = machines.phase.get()._tag

    const rawShips = queries.ships.each().map((e) => queries.ships.data.ship.get(e))
    rawShips.sort((a, b) => a.shipId - b.shipId)

    const ships: Array<ShipView> = rawShips.map((s) => {
      const cls = SHIP_CLASSES[s.shipClass]
      return {
        ...s,
        className: cls.name,
        capacity: cls.capacity,
        usedCargo: totalCargoUnits(s.cargo),
        maxCannons: cls.maxCannons,
        repairCost: Math.max(0, s.maxHull - s.hull) * 28
      }
    })

    const selectedShip =
      selection.selectedShipId !== null
        ? ships.find((s) => s.shipId === selection.selectedShipId) ?? null
        : null

    const rawCities = queries.cities.each().map((e) => queries.cities.data.city.get(e))
    const canonicalOrder = new Map(CITY_IDS.map((id, idx) => [id, idx]))

    let totalWealth = company.gold - company.debt
    for (const s of ships) {
      if (s.owner !== "player") continue
      totalWealth += Math.round(SHIP_CLASSES[s.shipClass].goldCost * 0.72) + s.cannons * 450
      for (const g of GOOD_IDS) {
        totalWealth += s.cargo[g] * GOODS[g].basePrice
      }
    }

    const cities: Array<CityView> = []
    for (const c of rawCities) {
      const def = CITIES[c.id]
      const totalPop = c.poorPop + c.wealthyPop + c.richPop
      const dockedPlayerShipIds = ships
        .filter((s) => s.owner === "player" && s.dockedCityId === c.id)
        .map((s) => s.shipId)

      const activeDockedShip =
        selectedShip && selectedShip.owner === "player" && selectedShip.dockedCityId === c.id
          ? selectedShip
          : ships.find((s) => s.owner === "player" && s.dockedCityId === c.id) ?? null

      if (c.kontorOwned) {
        totalWealth += Math.round(KONTOR_COST * 0.68)
      }
      for (const b of c.businesses) {
        totalWealth += Math.round(BUSINESSES[b.type].goldCost * 0.7)
      }
      totalWealth += c.playerHouses * Math.round(HOUSE_COST * 0.75)

      const market: Array<MarketRowView> = GOOD_IDS.map((g) => {
        const gDef = GOODS[g]
        const p = computeMarketPrice(
          g,
          c.stock[g],
          c.poorPop,
          c.wealthyPop,
          c.richPop,
          calendar.season
        )
        const demand = weeklyCityDemand(g, c.poorPop, c.wealthyPop, c.richPop, calendar.season)
        if (c.kontorOwned && c.kontorStock[g] > 0) {
          totalWealth += c.kontorStock[g] * p.sellPrice
        }
        const ratio = p.midPrice / gDef.basePrice
        let priceSignal: MarketRowView["priceSignal"] = "fair"
        if (ratio <= 0.86) priceSignal = "cheap"
        else if (ratio >= 1.38) priceSignal = "scarce"
        else if (ratio >= 1.12) priceSignal = "pricey"

        const productionTier = def.primaryGoods.includes(g)
          ? "primary"
          : def.secondaryGoods.includes(g)
            ? "secondary"
            : "none"

        return {
          goodId: g,
          stock: c.stock[g],
          kontorStock: c.kontorStock[g],
          kontorAvgCost: c.kontorAvgCost[g],
          shipStock: activeDockedShip ? activeDockedShip.cargo[g] : 0,
          shipAvgCost: activeDockedShip ? activeDockedShip.cargoAvgCost[g] : 0,
          buyPrice: p.buyPrice,
          sellPrice: p.sellPrice,
          basePrice: gDef.basePrice,
          weeklyDemand: Math.round(demand * 10) / 10,
          weeksOfStock: Math.round(p.weeksOfStock * 10) / 10,
          priceSignal,
          productionTier
        }
      })

      cities.push({
        ...c,
        name: def.name,
        subtitle: def.subtitle,
        landmark: def.landmark,
        landmarkLabel: def.landmarkLabel,
        totalPop,
        x: def.x,
        z: def.z,
        harborX: def.harborX,
        harborZ: def.harborZ,
        market,
        dockedPlayerShipIds
      })
    }

    cities.sort((a, b) => (canonicalOrder.get(a.id) ?? 0) - (canonicalOrder.get(b.id) ?? 0))

    const contracts = queries.contracts
      .each()
      .map((e) => queries.contracts.data.contract.get(e))
      .sort((a, b) => a.contractId - b.contractId)

    const curRankIdx = RANK_IDS.indexOf(company.rank)
    const nextRankId =
      curRankIdx >= 0 && curRankIdx + 1 < RANK_IDS.length ? RANK_IDS[curRankIdx + 1] : null
    const nextRank = nextRankId ? RANKS[nextRankId] : null

    return {
      phase,
      company,
      totalWealth: Math.max(0, Math.round(totalWealth)),
      nextRank,
      calendar,
      weather,
      selection,
      cities,
      ships,
      contracts,
      chronicle: chronicle.entries,
      cues: feedback.cues
    }
  }
)
