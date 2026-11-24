import { Clock, Ops, Random } from "@typeonce/ritmo"
import {
  BUSINESSES,
  CANNON_COST,
  CAPTAIN_HIRE_COST,
  CAPTAIN_NAMES,
  CAPTAIN_TRAIT_IDS,
  CAPTAIN_TRAITS,
  CITIES,
  CITY_IDS,
  cityProducesGood,
  computeMarketPrice,
  computeSeaRoute,
  DONATE_COST,
  emptyCargo,
  FEAST_COST,
  GOOD_IDS,
  GOODS,
  GUILD_ENTRY_COST,
  HOSPITAL_COST,
  HOUSE_BRICKS_COST,
  HOUSE_COST,
  HOUSE_TIMBER_COST,
  KONTOR_COST,
  KONTOR_MANAGER_WEEKLY_WAGE,
  PIRATE_NAME_POOL,
  RANK_IDS,
  RANKS,
  seasonForMonth,
  SHIP_CLASSES,
  SHIP_NAME_POOL,
  totalCargoUnits,
  weeklyCityDemand,
  WELL_COST,
  type CityId,
  type GoodId,
  type RankId,
  type SeasonId,
  type ShipClassId
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
  Intent,
  Rng,
  Selection,
  Ship,
  STEPS_PER_DAY,
  Time,
  Weather,
  type BusinessInstance,
  type CalendarData,
  type ChronicleData,
  type ChronicleEntry,
  type ChronicleTag,
  type CityData,
  type CompanyData,
  type ContractData,
  type CueKind,
  type FeedbackData,
  type HanseEventKind,
  type ShipCaptain,
  type ShipData,
  type TavernCaptain
} from "./schema.ts"

// ── Helpers ──────────────────────────────────────────────────────────────

function pushChronicle(
  chronicle: ChronicleData,
  cal: CalendarData,
  tag: ChronicleTag,
  opts: {
    readonly cityId?: CityId | null
    readonly goodId?: GoodId | null
    readonly shipName?: string | null
    readonly amount?: number
    readonly rankId?: RankId | null
    readonly season?: SeasonId | null
  } = {}
): ChronicleData {
  const entry: ChronicleEntry = {
    seq: chronicle.nextSeq,
    day: cal.dayOfMonth,
    month: cal.month,
    year: cal.year,
    tag,
    cityId: opts.cityId ?? null,
    goodId: opts.goodId ?? null,
    shipName: opts.shipName ?? null,
    amount: opts.amount ?? 0,
    rankId: opts.rankId ?? null,
    season: opts.season ?? null
  }
  const list =
    chronicle.entries.length >= 45
      ? [...chronicle.entries.slice(chronicle.entries.length - 44), entry]
      : [...chronicle.entries, entry]
  return { nextSeq: chronicle.nextSeq + 1, entries: list }
}

function pushCue(
  feedback: FeedbackData,
  kind: CueKind,
  cityId: CityId | null = null,
  goodId: GoodId | null = null,
  delta = 0
): FeedbackData {
  const entry = { seq: feedback.nextSeq, kind, cityId, goodId, delta }
  const cues =
    feedback.cues.length >= 24
      ? [...feedback.cues.slice(feedback.cues.length - 23), entry]
      : [...feedback.cues, entry]
  return { nextSeq: feedback.nextSeq + 1, cues }
}

function withStock(
  stock: Readonly<Record<GoodId, number>>,
  goodId: GoodId,
  nextVal: number
): Record<GoodId, number> {
  const copy = { ...stock }
  copy[goodId] = Math.max(0, Math.round(nextVal))
  return copy
}

function updateWeightedCost(
  prevCostMap: Readonly<Record<GoodId, number>>,
  prevQty: number,
  goodId: GoodId,
  addedQty: number,
  unitPrice: number
): Record<GoodId, number> {
  const copy = { ...prevCostMap }
  const nextQty = prevQty + addedQty
  if (nextQty <= 0) {
    copy[goodId] = 0
  } else {
    const prevAvg = prevCostMap[goodId] > 0 ? prevCostMap[goodId] : unitPrice
    // Keep fractional precision so sequential purchases never drop/inflate cost basis
    copy[goodId] = (prevAvg * prevQty + unitPrice * addedQty) / nextQty
  }
  return copy
}

function cityPrice(city: CityData, goodId: GoodId, season: SeasonId) {
  return computeMarketPrice(
    goodId,
    city.stock[goodId],
    city.poorPop,
    city.wealthyPop,
    city.richPop,
    season
  )
}

/** Consume required materials from Kontor first, then local market (paying market buyPrice). Returns null if unavailable. */
function consumeConstructionMaterials(
  city: CityData,
  gold: number,
  goldBaseCost: number,
  materials: ReadonlyArray<{ readonly good: GoodId; readonly amount: number }>,
  season: SeasonId
): { readonly nextCity: CityData; readonly totalGoldSpent: number } | null {
  let totalGold = goldBaseCost
  const nextKontor = { ...city.kontorStock }
  const nextMarket = { ...city.stock }

  for (const mat of materials) {
    const fromKontor = city.kontorOwned ? Math.min(nextKontor[mat.good], mat.amount) : 0
    nextKontor[mat.good] -= fromKontor
    const rem = mat.amount - fromKontor
    if (rem > 0) {
      if (nextMarket[mat.good] < rem) return null
      const p = cityPrice(city, mat.good, season).buyPrice
      totalGold += rem * p
      nextMarket[mat.good] -= rem
    }
  }

  if (gold < totalGold) return null
  return {
    nextCity: { ...city, stock: nextMarket, kontorStock: nextKontor },
    totalGoldSpent: totalGold
  }
}

function computeCompanyWealth(
  company: CompanyData,
  cities: ReadonlyArray<CityData>,
  ships: ReadonlyArray<ShipData>,
  season: SeasonId
): number {
  let wealth = company.gold - company.debt
  for (const s of ships) {
    if (s.owner !== "player") continue
    const cls = SHIP_CLASSES[s.shipClass]
    wealth += Math.round(cls.goldCost * 0.72) + s.cannons * 450
    for (const g of GOOD_IDS) {
      wealth += s.cargo[g] * GOODS[g].basePrice
    }
  }
  for (const c of cities) {
    if (c.kontorOwned) {
      wealth += Math.round(KONTOR_COST * 0.68)
      for (const g of GOOD_IDS) {
        if (c.kontorStock[g] > 0) {
          const price = cityPrice(c, g, season).sellPrice
          wealth += c.kontorStock[g] * price
        }
      }
    }
    for (const b of c.businesses) {
      wealth += Math.round(BUSINESSES[b.type].goldCost * 0.7)
    }
    wealth += c.playerHouses * Math.round(HOUSE_COST * 0.75)
  }
  return Math.max(0, Math.round(wealth))
}

function makeTavernCaptain(random: Random.Random): TavernCaptain {
  const name = random.pick(CAPTAIN_NAMES) ?? "Klaus Witte"
  const trait = random.pick(CAPTAIN_TRAIT_IDS) ?? "navigator"
  return { name, trait, hireCost: CAPTAIN_HIRE_COST }
}

function createInitialCity(cityId: CityId, random: Random.Random): CityData {
  const def = CITIES[cityId]
  const pop = def.initialPopulation
  const poorPop = Math.round(pop * 0.64)
  const wealthyPop = Math.round(pop * 0.26)
  const richPop = pop - poorPop - wealthyPop
  const stock = emptyCargo()

  for (const g of GOOD_IDS) {
    const demand = weeklyCityDemand(g, poorPop, wealthyPop, richPop, "spring")
    const prod = cityProducesGood(cityId, g)
    const jitter = random.range(0.86, 1.14)
    let weeks = 2.6 * jitter
    if (prod === "primary") weeks = 6.2 * jitter
    else if (prod === "secondary") weeks = 4.2 * jitter
    else if ((g === "spices" || g === "wine") && cityId !== "london" && cityId !== "bremen") {
      weeks = 1.25 * jitter
    } else if (g === "furs" && cityId !== "riga" && cityId !== "stockholm") {
      weeks = 1.3 * jitter
    }
    stock[g] = Math.max(2, Math.round(demand * weeks))
  }

  return {
    id: cityId,
    poorPop,
    wealthyPop,
    richPop,
    mood: 66,
    playerReputation: cityId === "lubeck" ? 36 : 22,
    stock,
    kontorOwned: cityId === "lubeck",
    kontorManager: false,
    kontorStock: emptyCargo(),
    kontorAvgCost: emptyCargo(),
    businesses: [],
    shipyardOrder: null,
    tavernCaptain: makeTavernCaptain(random),
    playerHouses: cityId === "lubeck" ? 1 : 0,
    hasWell: cityId === "lubeck",
    hasHospital: false,
    wallLevel: cityId === "lubeck" || cityId === "london" || cityId === "danzig" ? 2 : 1,
    isIced: false,
    famineDays: 0,
    plagueDays: 0,
    mayorName: def.mayorStart,
    playerIsMayor: false
  }
}

function makeShip(
  shipId: number,
  name: string,
  shipClass: ShipClassId,
  owner: "player" | "pirate" | "hanse",
  cityId: CityId,
  cannons: number,
  captain: ShipCaptain | null = null
): ShipData {
  const cls = SHIP_CLASSES[shipClass]
  const cDef = CITIES[cityId]
  return {
    shipId,
    name,
    shipClass,
    owner,
    captain,
    x: cDef.harborX,
    z: cDef.harborZ,
    heading: 0,
    hull: cls.maxHull,
    maxHull: cls.maxHull,
    cannons: Math.min(cls.maxCannons, cannons),
    crew: cls.minCrew + cannons * 2,
    cargo: emptyCargo(),
    cargoAvgCost: emptyCargo(),
    navState: "docked",
    dockedCityId: cityId,
    targetCityId: null,
    waypoints: [],
    waypointIndex: 0,
    autoTrade: {
      enabled: false,
      stops: [],
      stopIndex: 0
    },
    bountyGold: owner === "pirate" ? 4800 + cannons * 450 : 0,
    combatCooldownDays: 0
  }
}

function generateContract(
  contractId: number,
  totalDays: number,
  cities: ReadonlyArray<CityData>,
  random: Random.Random
): ContractData {
  const roll = random.next()
  const city = random.pick(cities) ?? cities[0]
  const cityId: CityId = city ? city.id : "bergen"

  if (roll < 0.25) {
    return {
      contractId,
      kind: "pirateHunt",
      cityId,
      goodId: null,
      requiredAmount: 1,
      deliveredAmount: 0,
      rewardGold: Math.round(random.range(6500, 10500)),
      rewardRep: 12,
      expiresDay: totalDays + 45,
      accepted: false,
      completed: false
    }
  }

  const nonPrimary = GOOD_IDS.filter((g) => cityProducesGood(cityId, g) === "none")
  const pool = nonPrimary.length > 0 ? nonPrimary : GOOD_IDS
  const goodId = random.pick(pool) ?? "grain"
  const isFamine =
    (city?.famineDays ?? 0) > 0 || (roll > 0.72 && (goodId === "grain" || goodId === "fish"))
  const targetGood: GoodId = isFamine ? (random.next() < 0.6 ? "grain" : "fish") : goodId
  const amount =
    targetGood === "beer" || targetGood === "salt" || targetGood === "grain" ? 30 : 14
  const baseVal = amount * GOODS[targetGood].basePrice
  const rewardGold = Math.round(baseVal * (isFamine ? 1.55 : 1.35))

  return {
    contractId,
    kind: isFamine ? "famine" : "supply",
    cityId,
    goodId: targetGood,
    requiredAmount: amount,
    deliveredAmount: 0,
    rewardGold,
    rewardRep: isFamine ? 14 : 9,
    expiresDay: totalDays + 38,
    accepted: false,
    completed: false
  }
}

// ── System 1: AdvanceClock + AdvanceCalendar ─────────────────────────────

export const AdvanceClock = Clock.system(Game, {
  name: "Hanse/AdvanceClock",
  resource: Time
})

export const AdvanceCalendar = Game.System(
  "Hanse/AdvanceCalendar",
  {
    when: [Game.Condition.inState(GamePhase, "Playing")],
    resources: {
      calendar: Game.System.writeResource(Calendar),
      chronicle: Game.System.writeResource(Chronicle)
    }
  },
  ({ resources }) => {
    const cal = resources.calendar.get()
    if (cal.speed === 0) return

    let accum = cal.dayStepAccum + cal.speed
    let totalDays = cal.totalDays
    let dayOfMonth = cal.dayOfMonth
    let month = cal.month
    let year = cal.year
    let season = cal.season

    while (accum >= STEPS_PER_DAY) {
      accum -= STEPS_PER_DAY
      totalDays += 1
      dayOfMonth += 1
      if (dayOfMonth > 30) {
        dayOfMonth = 1
        month += 1
        if (month > 12) {
          month = 1
          year += 1
        }
        const nextSeason = seasonForMonth(month)
        if (nextSeason !== season) {
          season = nextSeason
          const snapCal: CalendarData = {
            ...cal,
            totalDays,
            dayOfMonth,
            month,
            year,
            season
          }
          resources.chronicle.update((ch) =>
            pushChronicle(ch, snapCal, "seasonChange", { season })
          )
        }
      }
    }

    resources.calendar.set({
      totalDays,
      dayOfMonth,
      month,
      year,
      season,
      speed: cal.speed,
      dayStepAccum: accum,
      lastWeeklyDay: cal.lastWeeklyDay,
      lastMonthlyDay: cal.lastMonthlyDay,
      lastDailyDay: cal.lastDailyDay
    })
  }
)

// ── System 2: BootstrapWorld ─────────────────────────────────────────────

export const BootstrapWorld = Game.System(
  "Hanse/BootstrapWorld",
  {
    when: [Game.Condition.inState(GamePhase, "Boot")],
    resources: {
      rng: Game.System.writeResource(Rng),
      company: Game.System.writeResource(Company),
      calendar: Game.System.writeResource(Calendar),
      weather: Game.System.writeResource(Weather),
      selection: Game.System.writeResource(Selection),
      chronicle: Game.System.writeResource(Chronicle),
      feedback: Game.System.writeResource(Feedback)
    },
    queries: {
      cities: Game.Query({ selection: { city: Game.Query.read(City) } }),
      ships: Game.Query({ selection: { ship: Game.Query.read(Ship) } }),
      contracts: Game.Query({ selection: { contract: Game.Query.read(Contract) } })
    },
    machines: { phase: Game.System.machine(GamePhase) },
    nextMachines: { phase: Game.System.nextState(GamePhase) },
    commands: Game.System.commands(
      Game.System.spawns(City, Ship, Contract),
      Game.System.despawns(City, Ship, Contract)
    )
  },
  ({ resources, queries, nextMachines, commands }) => {
    for (const e of queries.cities.each()) commands.despawn(e)
    for (const e of queries.ships.each()) commands.despawn(e)
    for (const e of queries.contracts.each()) commands.despawn(e)

    const random = Random.draw(resources.rng)
    const initialCities: Array<CityData> = []
    for (const id of CITY_IDS) {
      const cityData = createInitialCity(id, random)
      initialCities.push(cityData)
      commands.spawn(Game.Command.spawn([City, cityData]))
    }

    // Player starting ship: Hanseatic Dawn with veteran Captain Hinrik Castorp
    const playerShip = makeShip(1, "Hanseatic Dawn", "snaikka", "player", "lubeck", 2, {
      name: "Hinrik Castorp",
      trait: "factor"
    })
    commands.spawn(Game.Command.spawn([Ship, playerShip]))

    // 4 Ambient Hanseatic NPC traders
    const npcConfigs: ReadonlyArray<{
      readonly id: number
      readonly name: string
      readonly cls: ShipClassId
      readonly start: CityId
      readonly target: CityId
    }> = [
      { id: 2, name: "Danzig Trader", cls: "cog", start: "danzig", target: "lubeck" },
      { id: 3, name: "Bergen Fjord", cls: "kraier", start: "bergen", target: "hamburg" },
      { id: 4, name: "London Fleece", cls: "cog", start: "london", target: "bremen" },
      { id: 5, name: "Stockholm Ore", cls: "kraier", start: "stockholm", target: "rostock" }
    ]
    for (const cfg of npcConfigs) {
      const base = makeShip(cfg.id, cfg.name, cfg.cls, "hanse", cfg.start, 2)
      const waypoints = computeSeaRoute(base.x, base.z, cfg.start, cfg.target)
      commands.spawn(
        Game.Command.spawn([
          Ship,
          {
            ...base,
            navState: "sailing",
            dockedCityId: null,
            targetCityId: cfg.target,
            waypoints,
            waypointIndex: 0
          }
        ])
      )
    }

    // 2 Prowling Victual Brothers Pirate Raiders
    const pirate1Base = makeShip(6, "Victual Brother", "snaikka", "pirate", "visby", 3)
    const p1Route = computeSeaRoute(pirate1Base.x, pirate1Base.z, "visby", "malmo")
    commands.spawn(
      Game.Command.spawn([
        Ship,
        {
          ...pirate1Base,
          navState: "sailing",
          dockedCityId: null,
          targetCityId: "malmo",
          waypoints: p1Route,
          waypointIndex: 0
        }
      ])
    )

    const pirate2Base = makeShip(7, "Störtebeker's Fang", "kraier", "pirate", "bergen", 5)
    const p2Route = computeSeaRoute(pirate2Base.x, pirate2Base.z, "bergen", "london")
    commands.spawn(
      Game.Command.spawn([
        Ship,
        {
          ...pirate2Base,
          navState: "sailing",
          dockedCityId: null,
          targetCityId: "london",
          waypoints: p2Route,
          waypointIndex: 0
        }
      ])
    )

    // 4 Initial Guild Contracts
    let nextContractId = 1
    for (let i = 0; i < 4; i++) {
      const c = generateContract(nextContractId, 1, initialCities, random)
      nextContractId += 1
      commands.spawn(Game.Command.spawn([Contract, c]))
    }

    const cal: CalendarData = {
      totalDays: 1,
      dayOfMonth: 1,
      month: 5,
      year: 1370,
      season: "spring",
      speed: 1,
      dayStepAccum: 0,
      lastWeeklyDay: 1,
      lastMonthlyDay: 1,
      lastDailyDay: 1
    }

    resources.calendar.set(cal)
    resources.weather.set({
      windAngle: 0.65,
      windStrength: 0.62,
      stormIntensity: 0
    })
    resources.company.set({
      name: "House of the Inkline",
      merchantMark: "cross",
      gold: 18500,
      debt: 0,
      rank: "shopkeeper",
      guildMember: false,
      homeCityId: "lubeck",
      totalTradeProfit: 0,
      piratesDefeated: 0,
      contractsCompleted: 0,
      aldermanTasksDone: 0,
      nextShipId: 8,
      nextContractId,
      nextBusinessId: 1,
      nextEventId: 1,
      nextElectionDay: 60,
      activeEvent: null,
      victoryAchieved: false
    })
    resources.selection.set({
      viewMode: "sea",
      selectedCityId: "lubeck",
      selectedShipId: 1,
      activeTab: "market",
      buildMode: false
    })
    resources.chronicle.set(
      pushChronicle({ nextSeq: 1, entries: [] }, cal, "founded", { cityId: "lubeck" })
    )
    resources.feedback.set({ nextSeq: 1, cues: [] })

    nextMachines.phase.transition({ from: "Boot", to: "Playing" })
  }
)

// ── System 3: HandleIntents ──────────────────────────────────────────────

export const HandleIntents = Game.System(
  "Hanse/HandleIntents",
  {
    events: {
      intents: Game.System.readEvent(Intent)
    },
    resources: {
      rng: Game.System.writeResource(Rng),
      company: Game.System.writeResource(Company),
      calendar: Game.System.writeResource(Calendar),
      weather: Game.System.writeResource(Weather),
      selection: Game.System.writeResource(Selection),
      chronicle: Game.System.writeResource(Chronicle),
      feedback: Game.System.writeResource(Feedback)
    },
    queries: {
      cities: Game.Query({ selection: { city: Game.Query.write(City) } }),
      ships: Game.Query({ selection: { ship: Game.Query.write(Ship) } }),
      contracts: Game.Query({ selection: { contract: Game.Query.write(Contract) } })
    },
    machines: { phase: Game.System.machine(GamePhase) },
    nextMachines: { phase: Game.System.nextState(GamePhase) },
    commands: Game.System.commands(
      Game.System.spawns(City, Ship, Contract),
      Game.System.despawns(City, Ship, Contract)
    )
  },
  ({ events, resources, queries, machines, nextMachines, commands }) => {
    const incoming = events.intents.all()
    if (incoming.length === 0) return

    const findCityEntity = (cityId: CityId) => {
      for (const e of queries.cities.each()) {
        if (queries.cities.data.city.get(e).id === cityId) return e
      }
      return null
    }

    const findShipEntity = (shipId: number) => {
      for (const e of queries.ships.each()) {
        if (queries.ships.data.ship.get(e).shipId === shipId) return e
      }
      return null
    }

    for (const intent of incoming) {
      const company = resources.company.get()
      const cal = resources.calendar.get()
      const sel = resources.selection.get()

      switch (intent._tag) {
        case "SetSpeed": {
          resources.calendar.set({ ...cal, speed: intent.speed })
          break
        }
        case "SelectCity": {
          resources.selection.set({ ...sel, selectedCityId: intent.cityId })
          resources.feedback.update((fb) => pushCue(fb, "select", intent.cityId))
          break
        }
        case "SelectShip": {
          const nextSel = { ...sel, selectedShipId: intent.shipId }
          if (intent.shipId !== null) {
            const se = findShipEntity(intent.shipId)
            if (se) {
              const s = queries.ships.data.ship.get(se)
              if (s.dockedCityId) {
                resources.selection.set({ ...nextSel, selectedCityId: s.dockedCityId })
                resources.feedback.update((fb) => pushCue(fb, "select", s.dockedCityId))
                break
              }
            }
          }
          resources.selection.set(nextSel)
          resources.feedback.update((fb) => pushCue(fb, "select"))
          break
        }
        case "SetViewMode": {
          const cityId = intent.cityId ?? sel.selectedCityId
          resources.selection.set({
            ...sel,
            viewMode: intent.viewMode,
            selectedCityId: cityId,
            buildMode: intent.viewMode === "sea" ? false : sel.buildMode
          })
          resources.feedback.update((fb) => pushCue(fb, "select", cityId))
          break
        }
        case "SetActiveTab": {
          resources.selection.set({
            ...sel,
            activeTab: intent.tab,
            buildMode: intent.tab === "kontor" ? sel.buildMode : false
          })
          break
        }
        case "ToggleBuildMode": {
          resources.selection.set({ ...sel, buildMode: intent.enabled })
          break
        }
        case "SetMerchantMark": {
          resources.company.set({ ...company, merchantMark: intent.mark })
          resources.feedback.update((fb) => pushCue(fb, "select"))
          break
        }
        case "SailShip": {
          const se = findShipEntity(intent.shipId)
          if (!se) break
          const s = queries.ships.data.ship.get(se)
          if (s.owner !== "player") break
          if (s.dockedCityId === intent.targetCityId) break

          // Enforce real winter sea-ice! Iced ports cannot depart or accept ships.
          if (s.dockedCityId) {
            const originE = findCityEntity(s.dockedCityId)
            if (originE && queries.cities.data.city.get(originE).isIced) {
              resources.feedback.update((fb) => pushCue(fb, "alert", s.dockedCityId))
              break
            }
          }
          const destE = findCityEntity(intent.targetCityId)
          if (destE && queries.cities.data.city.get(destE).isIced) {
            resources.feedback.update((fb) => pushCue(fb, "alert", intent.targetCityId))
            break
          }

          const waypoints = computeSeaRoute(s.x, s.z, s.dockedCityId, intent.targetCityId)
          if (waypoints.length === 0) break
          const first = waypoints[0]
          const heading = first ? Ops.atan2(first.x - s.x, first.z - s.z) : s.heading
          queries.ships.data.ship.set(se, {
            ...s,
            navState: "sailing",
            dockedCityId: null,
            targetCityId: intent.targetCityId,
            waypoints,
            waypointIndex: 0,
            heading
          })
          resources.feedback.update((fb) => pushCue(fb, "sail", intent.targetCityId))
          break
        }
        case "TradeMarket": {
          const ce = findCityEntity(intent.cityId)
          if (!ce || intent.delta === 0) break
          const city = queries.cities.data.city.get(ce)
          const priceInfo = cityPrice(city, intent.goodId, cal.season)

          if (intent.shipId !== null) {
            const se = findShipEntity(intent.shipId)
            if (!se) break
            const ship = queries.ships.data.ship.get(se)
            if (ship.owner !== "player" || ship.dockedCityId !== intent.cityId) break
            const cls = SHIP_CLASSES[ship.shipClass]
            const used = totalCargoUnits(ship.cargo)
            const tradeBonus = ship.captain ? CAPTAIN_TRAITS[ship.captain.trait].tradeBonus : 0
            const buyUnit = Math.max(1, Math.round(priceInfo.buyPrice * (1 - tradeBonus * 0.5)))
            const sellUnit = Math.round(priceInfo.sellPrice * (1 + tradeBonus * 0.5))

            if (intent.delta > 0) {
              const maxBySpace = cls.capacity - used
              const maxByStock = city.stock[intent.goodId]
              const maxByGold = Math.floor(company.gold / buyUnit)
              const qty = Math.max(0, Math.min(intent.delta, maxBySpace, maxByStock, maxByGold))
              if (qty <= 0) break
              const cost = qty * buyUnit
              const prevQty = ship.cargo[intent.goodId]
              resources.company.set({ ...company, gold: company.gold - cost })
              queries.cities.data.city.set(ce, {
                ...city,
                stock: withStock(city.stock, intent.goodId, city.stock[intent.goodId] - qty)
              })
              queries.ships.data.ship.set(se, {
                ...ship,
                cargo: withStock(ship.cargo, intent.goodId, prevQty + qty),
                cargoAvgCost: updateWeightedCost(
                  ship.cargoAvgCost,
                  prevQty,
                  intent.goodId,
                  qty,
                  buyUnit
                )
              })
              resources.feedback.update((fb) => pushCue(fb, "crane", city.id, intent.goodId, qty))
            } else {
              const want = -intent.delta
              const qty = Math.max(0, Math.min(want, ship.cargo[intent.goodId]))
              if (qty <= 0) break
              const revenue = qty * sellUnit
              const costBasis =
                ship.cargoAvgCost[intent.goodId] > 0
                  ? ship.cargoAvgCost[intent.goodId]
                  : GOODS[intent.goodId].basePrice
              const realizedProfit = (sellUnit - costBasis) * qty
              const scarcityBonus =
                priceInfo.weeksOfStock < 2.2 ? Math.min(2.5, qty * 0.08) : qty * 0.015
              const nextQty = ship.cargo[intent.goodId] - qty
              resources.company.set({
                ...company,
                gold: company.gold + revenue,
                totalTradeProfit: company.totalTradeProfit + realizedProfit
              })
              queries.cities.data.city.set(ce, {
                ...city,
                stock: withStock(city.stock, intent.goodId, city.stock[intent.goodId] + qty),
                playerReputation: Math.min(100, city.playerReputation + scarcityBonus)
              })
              queries.ships.data.ship.set(se, {
                ...ship,
                cargo: withStock(ship.cargo, intent.goodId, nextQty),
                cargoAvgCost:
                  nextQty <= 0 ? withStock(ship.cargoAvgCost, intent.goodId, 0) : ship.cargoAvgCost
              })
              resources.feedback.update((fb) => pushCue(fb, "crane", city.id, intent.goodId, -qty))
            }
          } else {
            if (!city.kontorOwned) break
            if (intent.delta > 0) {
              const maxByStock = city.stock[intent.goodId]
              const maxByGold = Math.floor(company.gold / priceInfo.buyPrice)
              const qty = Math.max(0, Math.min(intent.delta, maxByStock, maxByGold))
              if (qty <= 0) break
              const cost = qty * priceInfo.buyPrice
              const prevQty = city.kontorStock[intent.goodId]
              resources.company.set({ ...company, gold: company.gold - cost })
              queries.cities.data.city.set(ce, {
                ...city,
                stock: withStock(city.stock, intent.goodId, city.stock[intent.goodId] - qty),
                kontorStock: withStock(city.kontorStock, intent.goodId, prevQty + qty),
                kontorAvgCost: updateWeightedCost(
                  city.kontorAvgCost,
                  prevQty,
                  intent.goodId,
                  qty,
                  priceInfo.buyPrice
                )
              })
              resources.feedback.update((fb) => pushCue(fb, "coin", city.id, intent.goodId, qty))
            } else {
              const qty = Math.max(0, Math.min(-intent.delta, city.kontorStock[intent.goodId]))
              if (qty <= 0) break
              const revenue = qty * priceInfo.sellPrice
              const costBasis =
                city.kontorAvgCost[intent.goodId] > 0
                  ? city.kontorAvgCost[intent.goodId]
                  : Math.round(GOODS[intent.goodId].basePrice * 0.72)
              const realizedProfit = (priceInfo.sellPrice - costBasis) * qty
              const scarcityBonus =
                priceInfo.weeksOfStock < 2.2 ? Math.min(2.0, qty * 0.06) : qty * 0.01
              const nextQty = city.kontorStock[intent.goodId] - qty
              resources.company.set({
                ...company,
                gold: company.gold + revenue,
                totalTradeProfit: company.totalTradeProfit + realizedProfit
              })
              queries.cities.data.city.set(ce, {
                ...city,
                stock: withStock(city.stock, intent.goodId, city.stock[intent.goodId] + qty),
                kontorStock: withStock(city.kontorStock, intent.goodId, nextQty),
                kontorAvgCost:
                  nextQty <= 0
                    ? withStock(city.kontorAvgCost, intent.goodId, 0)
                    : city.kontorAvgCost,
                playerReputation: Math.min(100, city.playerReputation + scarcityBonus)
              })
              resources.feedback.update((fb) => pushCue(fb, "coin", city.id, intent.goodId, -qty))
            }
          }
          break
        }
        case "TransferKontor": {
          const ce = findCityEntity(intent.cityId)
          const se = findShipEntity(intent.shipId)
          if (!ce || !se || intent.delta === 0) break
          const city = queries.cities.data.city.get(ce)
          const ship = queries.ships.data.ship.get(se)
          if (!city.kontorOwned || ship.owner !== "player" || ship.dockedCityId !== intent.cityId) {
            break
          }
          const cls = SHIP_CLASSES[ship.shipClass]
          const used = totalCargoUnits(ship.cargo)
          if (intent.delta > 0) {
            const qty = Math.max(
              0,
              Math.min(intent.delta, city.kontorStock[intent.goodId], cls.capacity - used)
            )
            if (qty <= 0) break
            const unitCost =
              city.kontorAvgCost[intent.goodId] > 0
                ? city.kontorAvgCost[intent.goodId]
                : Math.round(GOODS[intent.goodId].basePrice * 0.75)
            const nextK = city.kontorStock[intent.goodId] - qty
            queries.cities.data.city.set(ce, {
              ...city,
              kontorStock: withStock(city.kontorStock, intent.goodId, nextK),
              kontorAvgCost:
                nextK <= 0 ? withStock(city.kontorAvgCost, intent.goodId, 0) : city.kontorAvgCost
            })
            queries.ships.data.ship.set(se, {
              ...ship,
              cargo: withStock(ship.cargo, intent.goodId, ship.cargo[intent.goodId] + qty),
              cargoAvgCost: updateWeightedCost(
                ship.cargoAvgCost,
                ship.cargo[intent.goodId],
                intent.goodId,
                qty,
                unitCost
              )
            })
            resources.feedback.update((fb) => pushCue(fb, "crane", city.id, intent.goodId, qty))
          } else {
            const qty = Math.max(0, Math.min(-intent.delta, ship.cargo[intent.goodId]))
            if (qty <= 0) break
            const unitCost =
              ship.cargoAvgCost[intent.goodId] > 0
                ? ship.cargoAvgCost[intent.goodId]
                : GOODS[intent.goodId].basePrice
            const nextS = ship.cargo[intent.goodId] - qty
            queries.cities.data.city.set(ce, {
              ...city,
              kontorStock: withStock(
                city.kontorStock,
                intent.goodId,
                city.kontorStock[intent.goodId] + qty
              ),
              kontorAvgCost: updateWeightedCost(
                city.kontorAvgCost,
                city.kontorStock[intent.goodId],
                intent.goodId,
                qty,
                unitCost
              )
            })
            queries.ships.data.ship.set(se, {
              ...ship,
              cargo: withStock(ship.cargo, intent.goodId, nextS),
              cargoAvgCost:
                nextS <= 0 ? withStock(ship.cargoAvgCost, intent.goodId, 0) : ship.cargoAvgCost
            })
            resources.feedback.update((fb) => pushCue(fb, "crane", city.id, intent.goodId, -qty))
          }
          break
        }
        case "BuildKontor": {
          const ce = findCityEntity(intent.cityId)
          if (!ce) break
          const city = queries.cities.data.city.get(ce)
          if (city.kontorOwned || company.gold < KONTOR_COST) break
          resources.company.set({ ...company, gold: company.gold - KONTOR_COST })
          queries.cities.data.city.set(ce, {
            ...city,
            kontorOwned: true,
            playerReputation: Math.min(100, city.playerReputation + 8)
          })
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "builtKontor", { cityId: city.id, amount: KONTOR_COST })
          )
          resources.feedback.update((fb) => pushCue(fb, "build", city.id))
          break
        }
        case "ToggleKontorManager": {
          const ce = findCityEntity(intent.cityId)
          if (!ce) break
          const city = queries.cities.data.city.get(ce)
          if (!city.kontorOwned) break
          queries.cities.data.city.set(ce, { ...city, kontorManager: !city.kontorManager })
          resources.feedback.update((fb) => pushCue(fb, "select", city.id))
          break
        }
        case "BuildBusiness": {
          const ce = findCityEntity(intent.cityId)
          if (!ce) break
          const city = queries.cities.data.city.get(ce)
          if (!city.kontorOwned || city.businesses.length >= 12) break
          const def = BUSINESSES[intent.businessId]

          const matRes = consumeConstructionMaterials(
            city,
            company.gold,
            def.goldCost,
            [
              { good: "timber", amount: def.timberCost },
              { good: "bricks", amount: def.bricksCost }
            ],
            cal.season
          )
          if (!matRes) {
            resources.feedback.update((fb) => pushCue(fb, "alert", city.id))
            break
          }

          const taken = new Set(city.businesses.map((b) => b.plotIndex))
          let plotIndex = intent.plotIndex ?? 0
          if (taken.has(plotIndex) || plotIndex < 0 || plotIndex >= 12) {
            plotIndex = 0
            while (taken.has(plotIndex) && plotIndex < 12) plotIndex += 1
          }
          if (plotIndex >= 12) break

          const prod = cityProducesGood(city.id, def.outputGood)
          const efficiency = prod === "primary" ? 1.0 : prod === "secondary" ? 0.78 : 0.55

          const nextBiz: BusinessInstance = {
            id: company.nextBusinessId,
            type: intent.businessId,
            plotIndex,
            efficiency,
            active: true,
            buildDaysLeft: def.buildDays,
            totalBuildDays: def.buildDays
          }
          resources.company.set({
            ...company,
            gold: company.gold - matRes.totalGoldSpent,
            nextBusinessId: company.nextBusinessId + 1
          })
          queries.cities.data.city.set(ce, {
            ...matRes.nextCity,
            businesses: [...matRes.nextCity.businesses, nextBiz],
            playerReputation: Math.min(100, matRes.nextCity.playerReputation + 4)
          })
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "builtBusiness", {
              cityId: city.id,
              goodId: def.outputGood,
              amount: matRes.totalGoldSpent
            })
          )
          resources.feedback.update((fb) => pushCue(fb, "build", city.id))
          break
        }
        case "BuildHouse": {
          const ce = findCityEntity(intent.cityId)
          if (!ce) break
          const city = queries.cities.data.city.get(ce)
          if (!city.kontorOwned || city.playerHouses >= 10) break
          const matRes = consumeConstructionMaterials(
            city,
            company.gold,
            HOUSE_COST,
            [
              { good: "timber", amount: HOUSE_TIMBER_COST },
              { good: "bricks", amount: HOUSE_BRICKS_COST }
            ],
            cal.season
          )
          if (!matRes) {
            resources.feedback.update((fb) => pushCue(fb, "alert", city.id))
            break
          }
          resources.company.set({ ...company, gold: company.gold - matRes.totalGoldSpent })
          queries.cities.data.city.set(ce, {
            ...matRes.nextCity,
            playerHouses: matRes.nextCity.playerHouses + 1,
            poorPop: matRes.nextCity.poorPop + 35,
            wealthyPop: matRes.nextCity.wealthyPop + 15,
            mood: Math.min(100, matRes.nextCity.mood + 2),
            playerReputation: Math.min(100, matRes.nextCity.playerReputation + 3)
          })
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "builtHouse", {
              cityId: city.id,
              amount: matRes.totalGoldSpent
            })
          )
          resources.feedback.update((fb) => pushCue(fb, "build", city.id))
          break
        }
        case "BuildCivic": {
          const ce = findCityEntity(intent.cityId)
          if (!ce) break
          const city = queries.cities.data.city.get(ce)
          const cost = intent.civic === "well" ? WELL_COST : HOSPITAL_COST
          if (intent.civic === "well" && city.hasWell) break
          if (intent.civic === "hospital" && city.hasHospital) break
          if (company.gold < cost) break
          resources.company.set({ ...company, gold: company.gold - cost })
          queries.cities.data.city.set(ce, {
            ...city,
            hasWell: intent.civic === "well" ? true : city.hasWell,
            hasHospital: intent.civic === "hospital" ? true : city.hasHospital,
            mood: Math.min(100, city.mood + 5),
            playerReputation: Math.min(100, city.playerReputation + 7)
          })
          resources.feedback.update((fb) => pushCue(fb, "build", city.id))
          break
        }
        case "CommissionShip": {
          const ce = findCityEntity(intent.cityId)
          if (!ce) break
          const city = queries.cities.data.city.get(ce)
          if (city.shipyardOrder !== null) break
          const cls = SHIP_CLASSES[intent.shipClass]
          const matRes = consumeConstructionMaterials(
            city,
            company.gold,
            cls.goldCost,
            cls.materials,
            cal.season
          )
          if (!matRes) {
            resources.feedback.update((fb) => pushCue(fb, "alert", city.id))
            break
          }
          const name =
            SHIP_NAME_POOL[(company.nextShipId - 1) % SHIP_NAME_POOL.length] ??
            `Vessel #${company.nextShipId}`
          resources.company.set({
            ...company,
            gold: company.gold - matRes.totalGoldSpent,
            nextShipId: company.nextShipId + 1
          })
          queries.cities.data.city.set(ce, {
            ...matRes.nextCity,
            shipyardOrder: {
              shipClass: intent.shipClass,
              name,
              daysLeft: cls.buildDays,
              totalDays: cls.buildDays
            }
          })
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "commissionedShip", {
              cityId: intent.cityId,
              shipName: name,
              amount: matRes.totalGoldSpent
            })
          )
          resources.feedback.update((fb) => pushCue(fb, "build", intent.cityId))
          break
        }
        case "HireCaptain": {
          const ce = findCityEntity(intent.cityId)
          const se = findShipEntity(intent.shipId)
          if (!ce || !se) break
          const city = queries.cities.data.city.get(ce)
          const ship = queries.ships.data.ship.get(se)
          if (!city.tavernCaptain || ship.owner !== "player" || ship.dockedCityId !== intent.cityId) {
            break
          }
          if (company.gold < city.tavernCaptain.hireCost) break
          const hired = city.tavernCaptain
          resources.company.set({ ...company, gold: company.gold - hired.hireCost })
          queries.ships.data.ship.set(se, {
            ...ship,
            captain: { name: hired.name, trait: hired.trait }
          })
          queries.cities.data.city.set(ce, { ...city, tavernCaptain: null })
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "hiredCaptain", {
              cityId: city.id,
              shipName: ship.name,
              amount: hired.hireCost
            })
          )
          resources.feedback.update((fb) => pushCue(fb, "rankUp", city.id))
          break
        }
        case "RepairShip": {
          const se = findShipEntity(intent.shipId)
          if (!se) break
          const ship = queries.ships.data.ship.get(se)
          if (ship.owner !== "player" || ship.dockedCityId === null) break
          const missing = ship.maxHull - ship.hull
          if (missing <= 0) break
          const cost = missing * 28
          if (company.gold < cost) break
          resources.company.set({ ...company, gold: company.gold - cost })
          queries.ships.data.ship.set(se, { ...ship, hull: ship.maxHull })
          resources.feedback.update((fb) => pushCue(fb, "build", ship.dockedCityId))
          break
        }
        case "ArmShip": {
          const se = findShipEntity(intent.shipId)
          if (!se) break
          const ship = queries.ships.data.ship.get(se)
          if (ship.owner !== "player" || ship.dockedCityId === null) break
          const cls = SHIP_CLASSES[ship.shipClass]
          const add = Math.max(0, Math.min(intent.cannonsToAdd, cls.maxCannons - ship.cannons))
          if (add <= 0) break
          const cost = add * CANNON_COST
          if (company.gold < cost) break
          resources.company.set({ ...company, gold: company.gold - cost })
          queries.ships.data.ship.set(se, {
            ...ship,
            cannons: ship.cannons + add,
            crew: Math.min(cls.maxCrew, ship.crew + add * 2)
          })
          resources.feedback.update((fb) => pushCue(fb, "build", ship.dockedCityId))
          break
        }
        case "ConfigureAutoTrade": {
          const se = findShipEntity(intent.shipId)
          if (!se) break
          const ship = queries.ships.data.ship.get(se)
          if (ship.owner !== "player") break
          // Captain is required to enable Auto-Trade (just like classic Patrician III!)
          if (intent.enabled && !ship.captain) {
            resources.feedback.update((fb) => pushCue(fb, "alert", ship.dockedCityId))
            break
          }
          const stops =
            intent.stops && intent.stops.length >= 2
              ? intent.stops
              : ship.autoTrade.stops.length >= 2
                ? ship.autoTrade.stops
                : ([
                    ship.dockedCityId ?? "lubeck",
                    ship.dockedCityId === "bergen" ? "lubeck" : "bergen"
                  ] as const)
          const curIdx = ship.dockedCityId ? stops.indexOf(ship.dockedCityId) : -1
          const stopIndex = curIdx >= 0 ? curIdx : stops.length - 1
          queries.ships.data.ship.set(se, {
            ...ship,
            autoTrade: {
              enabled: intent.enabled,
              stops,
              stopIndex
            }
          })
          resources.feedback.update((fb) => pushCue(fb, "select", ship.dockedCityId))
          break
        }
        case "JoinGuild": {
          if (company.guildMember || company.gold < GUILD_ENTRY_COST) break
          resources.company.set({
            ...company,
            gold: company.gold - GUILD_ENTRY_COST,
            guildMember: true
          })
          const homeE = findCityEntity(company.homeCityId)
          if (homeE) {
            const c = queries.cities.data.city.get(homeE)
            queries.cities.data.city.set(homeE, {
              ...c,
              playerReputation: Math.min(100, c.playerReputation + 10)
            })
          }
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "joinedGuild", {
              cityId: company.homeCityId,
              amount: GUILD_ENTRY_COST
            })
          )
          resources.feedback.update((fb) => pushCue(fb, "rankUp", company.homeCityId))
          break
        }
        case "AcceptContract": {
          for (const e of queries.contracts.each()) {
            const c = queries.contracts.data.contract.get(e)
            if (
              c.contractId === intent.contractId &&
              !c.accepted &&
              !c.completed &&
              cal.totalDays <= c.expiresDay
            ) {
              queries.contracts.data.contract.set(e, { ...c, accepted: true })
              resources.feedback.update((fb) => pushCue(fb, "select", c.cityId))
              break
            }
          }
          break
        }
        case "DeliverContract": {
          for (const e of queries.contracts.each()) {
            const c = queries.contracts.data.contract.get(e)
            if (
              c.contractId !== intent.contractId ||
              !c.accepted ||
              c.completed ||
              !c.goodId ||
              cal.totalDays > c.expiresDay
            ) {
              continue
            }
            const ce = findCityEntity(c.cityId)
            if (!ce) break
            const city = queries.cities.data.city.get(ce)
            const need = c.requiredAmount - c.deliveredAmount
            let delivered = 0

            if (intent.shipId !== null) {
              const se = findShipEntity(intent.shipId)
              if (se) {
                const ship = queries.ships.data.ship.get(se)
                if (ship.owner === "player" && ship.dockedCityId === c.cityId) {
                  delivered = Math.min(need, ship.cargo[c.goodId])
                  if (delivered > 0) {
                    queries.ships.data.ship.set(se, {
                      ...ship,
                      cargo: withStock(ship.cargo, c.goodId, ship.cargo[c.goodId] - delivered)
                    })
                  }
                }
              }
            } else if (city.kontorOwned) {
              delivered = Math.min(need, city.kontorStock[c.goodId])
              if (delivered > 0) {
                queries.cities.data.city.set(ce, {
                  ...city,
                  kontorStock: withStock(
                    city.kontorStock,
                    c.goodId,
                    city.kontorStock[c.goodId] - delivered
                  )
                })
              }
            }

            if (delivered <= 0) break
            const nextDelivered = c.deliveredAmount + delivered
            const done = nextDelivered >= c.requiredAmount
            queries.contracts.data.contract.set(e, {
              ...c,
              deliveredAmount: nextDelivered,
              completed: done
            })
            const freshCity = queries.cities.data.city.get(ce)
            queries.cities.data.city.set(ce, {
              ...freshCity,
              stock: withStock(freshCity.stock, c.goodId, freshCity.stock[c.goodId] + delivered),
              famineDays: c.kind === "famine" && done ? 0 : freshCity.famineDays,
              playerReputation: Math.min(100, freshCity.playerReputation + (done ? c.rewardRep : 2))
            })
            if (done) {
              resources.company.set({
                ...company,
                gold: company.gold + c.rewardGold,
                contractsCompleted: company.contractsCompleted + 1,
                aldermanTasksDone:
                  company.aldermanTasksDone + (c.kind === "famine" ? 1 : 0)
              })
              resources.chronicle.update((ch) =>
                pushChronicle(ch, cal, "contractDone", {
                  cityId: c.cityId,
                  goodId: c.goodId,
                  amount: c.rewardGold
                })
              )
              resources.feedback.update((fb) => pushCue(fb, "rankUp", c.cityId))
            }
            break
          }
          break
        }
        case "DonateCity": {
          const ce = findCityEntity(intent.cityId)
          if (!ce || company.gold < DONATE_COST) break
          const city = queries.cities.data.city.get(ce)
          resources.company.set({ ...company, gold: company.gold - DONATE_COST })
          queries.cities.data.city.set(ce, {
            ...city,
            mood: Math.min(100, city.mood + 5),
            playerReputation: Math.min(100, city.playerReputation + 7)
          })
          resources.feedback.update((fb) => pushCue(fb, "coin", city.id))
          break
        }
        case "ThrowFeast": {
          const ce = findCityEntity(intent.cityId)
          if (!ce || company.gold < FEAST_COST) break
          const city = queries.cities.data.city.get(ce)
          resources.company.set({ ...company, gold: company.gold - FEAST_COST })
          queries.cities.data.city.set(ce, {
            ...city,
            mood: Math.min(100, city.mood + 9),
            playerReputation: Math.min(100, city.playerReputation + 11)
          })
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "feast", { cityId: city.id, amount: FEAST_COST })
          )
          resources.feedback.update((fb) => pushCue(fb, "rankUp", city.id))
          break
        }
        case "TakeLoan": {
          const amt = Math.max(0, Math.min(50000, Math.round(intent.amount)))
          if (amt <= 0 || company.debt + amt > 120000) break
          resources.company.set({
            ...company,
            gold: company.gold + amt,
            debt: company.debt + Math.round(amt * 1.12)
          })
          resources.feedback.update((fb) => pushCue(fb, "coin"))
          break
        }
        case "RepayLoan": {
          const pay = Math.max(0, Math.min(intent.amount, company.debt, company.gold))
          if (pay <= 0) break
          resources.company.set({
            ...company,
            gold: company.gold - pay,
            debt: company.debt - pay
          })
          resources.feedback.update((fb) => pushCue(fb, "coin"))
          break
        }
        case "ResolveEvent": {
          const ev = company.activeEvent
          if (!ev) break
          const ce = findCityEntity(ev.cityId)

          // Verify advertised Choice A cost before resolving; leave event pending if unaffordable!
          const choiceACost: Record<HanseEventKind, number> = {
            victualBrothers: 3500,
            herringShift: 2400,
            soundBlockade: 3000,
            plagueSeason: 3200,
            hanseaticDiet: 4000
          }
          if (intent.choice === "a" && company.gold < choiceACost[ev.kind]) {
            resources.feedback.update((fb) => pushCue(fb, "alert", ev.cityId))
            break
          }

          let nextCompany = { ...company, activeEvent: null }

          if (ev.kind === "victualBrothers") {
            if (intent.choice === "a") {
              nextCompany = {
                ...nextCompany,
                gold: nextCompany.gold - 3500,
                aldermanTasksDone: nextCompany.aldermanTasksDone + 1
              }
              if (ce) {
                const c = queries.cities.data.city.get(ce)
                queries.cities.data.city.set(ce, {
                  ...c,
                  playerReputation: Math.min(100, c.playerReputation + 10)
                })
              }
            } else {
              const pid = nextCompany.nextShipId
              const base = makeShip(pid, "Godeke Michels", "kraier", "pirate", "visby", 6)
              const wp = computeSeaRoute(base.x, base.z, "visby", "lubeck")
              commands.spawn(
                Game.Command.spawn([
                  Ship,
                  { ...base, navState: "sailing", dockedCityId: null, targetCityId: "lubeck", waypoints: wp }
                ])
              )
              nextCompany = { ...nextCompany, nextShipId: pid + 1 }
            }
          } else if (ev.kind === "herringShift" && ce) {
            const c = queries.cities.data.city.get(ce)
            if (intent.choice === "a") {
              nextCompany = { ...nextCompany, gold: nextCompany.gold - 2400 }
              queries.cities.data.city.set(ce, {
                ...c,
                stock: withStock(c.stock, "fish", c.stock.fish + 25),
                playerReputation: Math.min(100, c.playerReputation + 8)
              })
            } else {
              queries.cities.data.city.set(ce, {
                ...c,
                stock: withStock(c.stock, "fish", Math.max(2, Math.floor(c.stock.fish * 0.35)))
              })
            }
          } else if (ev.kind === "soundBlockade" && ce) {
            const c = queries.cities.data.city.get(ce)
            if (intent.choice === "a") {
              nextCompany = { ...nextCompany, gold: nextCompany.gold - 3000 }
              queries.cities.data.city.set(ce, {
                ...c,
                playerReputation: Math.min(100, c.playerReputation + 9)
              })
            } else {
              queries.cities.data.city.set(ce, {
                ...c,
                stock: withStock(
                  withStock(c.stock, "grain", Math.max(4, Math.floor(c.stock.grain * 0.45))),
                  "wine",
                  Math.max(2, Math.floor(c.stock.wine * 0.4))
                )
              })
            }
          } else if (ev.kind === "plagueSeason" && ce) {
            const c = queries.cities.data.city.get(ce)
            if (intent.choice === "a") {
              nextCompany = { ...nextCompany, gold: nextCompany.gold - 3200 }
              queries.cities.data.city.set(ce, {
                ...c,
                plagueDays: 0,
                mood: Math.min(100, c.mood + 6),
                playerReputation: Math.min(100, c.playerReputation + 11)
              })
            } else {
              queries.cities.data.city.set(ce, {
                ...c,
                plagueDays: c.hasHospital ? 7 : 21,
                mood: Math.max(20, c.mood - 8)
              })
            }
          } else if (ev.kind === "hanseaticDiet" && ce) {
            const c = queries.cities.data.city.get(ce)
            if (intent.choice === "a") {
              nextCompany = {
                ...nextCompany,
                gold: nextCompany.gold - 4000,
                aldermanTasksDone: nextCompany.aldermanTasksDone + 1
              }
              queries.cities.data.city.set(ce, {
                ...c,
                playerReputation: Math.min(100, c.playerReputation + 12)
              })
            } else {
              nextCompany = { ...nextCompany, gold: nextCompany.gold + 2500 }
            }
          }

          resources.company.set(nextCompany)
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "eventResolved", { cityId: ev.cityId })
          )
          resources.feedback.update((fb) => pushCue(fb, "rankUp", ev.cityId))
          break
        }
        case "RestoreCharter": {
          for (const e of queries.cities.each()) commands.despawn(e)
          for (const e of queries.ships.each()) commands.despawn(e)
          for (const e of queries.contracts.each()) commands.despawn(e)
          for (const c of intent.cities) commands.spawn(Game.Command.spawn([City, c]))
          for (const s of intent.ships) commands.spawn(Game.Command.spawn([Ship, s]))
          for (const ct of intent.contracts) commands.spawn(Game.Command.spawn([Contract, ct]))
          resources.company.set(intent.company)
          resources.calendar.set(intent.calendar)
          resources.weather.set(intent.weather)
          resources.selection.set(intent.selection)
          resources.chronicle.set(intent.chronicle)
          resources.feedback.set(pushCue({ nextSeq: 1, cues: [] }, "select"))
          if (machines.phase.get()._tag === "Victory" && !intent.company.victoryAchieved) {
            nextMachines.phase.transition({ from: "Victory", to: "Playing" })
          }
          break
        }
        case "ContinueAfterVictory": {
          if (machines.phase.get()._tag === "Victory") {
            nextMachines.phase.transition({ from: "Victory", to: "Playing" })
          }
          break
        }
        case "NewGame": {
          resources.rng.set(Random.seed(intent.seed))
          const currentTag = machines.phase.get()._tag
          if (currentTag === "Playing") {
            nextMachines.phase.transition({ from: "Playing", to: "Boot" })
          } else if (currentTag === "Victory") {
            nextMachines.phase.transition({ from: "Victory", to: "Boot" })
          }
          break
        }
      }
    }
  }
)

// ── System 4: SimulateShips ──────────────────────────────────────────────

export const SimulateShips = Game.System(
  "Hanse/SimulateShips",
  {
    when: [Game.Condition.inState(GamePhase, "Playing")],
    resources: {
      rng: Game.System.writeResource(Rng),
      company: Game.System.writeResource(Company),
      calendar: Game.System.readResource(Calendar),
      weather: Game.System.readResource(Weather),
      chronicle: Game.System.writeResource(Chronicle),
      feedback: Game.System.writeResource(Feedback)
    },
    queries: {
      cities: Game.Query({ selection: { city: Game.Query.write(City) } }),
      ships: Game.Query({ selection: { ship: Game.Query.write(Ship) } }),
      contracts: Game.Query({ selection: { contract: Game.Query.write(Contract) } })
    },
    commands: Game.System.commands(Game.System.despawns(Ship))
  },
  ({ resources, queries, commands }) => {
    const cal = resources.calendar.get()
    if (cal.speed === 0) return
    const dt = (1 / 30) * cal.speed
    const random = Random.draw(resources.rng)
    const weather = resources.weather.get()

    const cityEntities = queries.cities.each()
    const cityEntityById = new Map<CityId, (typeof cityEntities)[number]>()
    for (const ce of cityEntities) {
      cityEntityById.set(queries.cities.data.city.get(ce).id, ce)
    }

    const shipEntities = queries.ships.each()

    for (const se of shipEntities) {
      let ship = queries.ships.data.ship.get(se)

      if (ship.navState === "sailing") {
        const targetWp = ship.waypoints[ship.waypointIndex]
        const destId = ship.targetCityId ?? "lubeck"
        const destCe = cityEntityById.get(destId)
        const destIced = destCe ? queries.cities.data.city.get(destCe).isIced : false

        if (!targetWp) {
          if (destIced && ship.owner === "player") {
            // Hold offshore while port is iced over
            continue
          }
          const destDef = CITIES[destId]
          ship = {
            ...ship,
            x: destDef.harborX,
            z: destDef.harborZ,
            navState: "docked",
            dockedCityId: destId,
            targetCityId: null,
            waypoints: [],
            waypointIndex: 0
          }
          queries.ships.data.ship.set(se, ship)
          if (ship.owner === "player") {
            resources.chronicle.update((ch) =>
              pushChronicle(ch, cal, "arrived", { cityId: destId, shipName: ship.name })
            )
            resources.feedback.update((fb) => pushCue(fb, "arrive", destId))
          }
        } else {
          const cls = SHIP_CLASSES[ship.shipClass]
          const hullFactor = 0.55 + 0.45 * (ship.hull / ship.maxHull)
          const captainSpeed = ship.captain ? CAPTAIN_TRAITS[ship.captain.trait].speedMult : 1.0
          const dx = targetWp.x - ship.x
          const dz = targetWp.z - ship.z
          const dist = Ops.hypot(dx, dz)
          const heading = dist > 0.001 ? Ops.atan2(dx, dz) : ship.heading

          // Real wind alignment factor (+22% tailwind, -18% headwind)
          const windAlign = Ops.cos(heading - weather.windAngle)
          const windFactor = 1 + windAlign * weather.windStrength * 0.22
          const winterFactor = cal.season === "winter" ? 0.84 : 1.0
          const stormFactor = 1 - weather.stormIntensity * 0.22
          const stepDist =
            cls.speed * hullFactor * captainSpeed * windFactor * winterFactor * stormFactor * dt

          if (dist <= stepDist) {
            const nextIdx = ship.waypointIndex + 1
            if (nextIdx >= ship.waypoints.length) {
              if (destIced && ship.owner === "player") {
                continue
              }
              const destDef = CITIES[destId]
              ship = {
                ...ship,
                x: destDef.harborX,
                z: destDef.harborZ,
                navState: "docked",
                dockedCityId: destId,
                targetCityId: null,
                waypoints: [],
                waypointIndex: 0
              }
              queries.ships.data.ship.set(se, ship)
              if (ship.owner === "player") {
                resources.chronicle.update((ch) =>
                  pushChronicle(ch, cal, "arrived", { cityId: destId, shipName: ship.name })
                )
                resources.feedback.update((fb) => pushCue(fb, "arrive", destId))
              }
            } else {
              const afterWp = ship.waypoints[nextIdx]
              const nextHeading = afterWp
                ? Ops.atan2(afterWp.x - targetWp.x, afterWp.z - targetWp.z)
                : heading
              queries.ships.data.ship.set(se, {
                ...ship,
                x: targetWp.x,
                z: targetWp.z,
                waypointIndex: nextIdx,
                heading: nextHeading
              })
            }
          } else {
            const nx = ship.x + (dx / dist) * stepDist
            const nz = ship.z + (dz / dist) * stepDist
            queries.ships.data.ship.set(se, { ...ship, x: nx, z: nz, heading })
          }
        }
      } else if (ship.navState === "docked" && ship.dockedCityId !== null) {
        if (
          ship.owner === "player" &&
          ship.captain !== null &&
          ship.autoTrade.enabled &&
          ship.autoTrade.stops.length >= 2
        ) {
          const ce = cityEntityById.get(ship.dockedCityId)
          if (ce) {
            let city = queries.cities.data.city.get(ce)
            if (city.isIced) continue

            // Find an unfrozen, non-current destination BEFORE trading so cargo is never duplicated!
            let nextStopIdx = -1
            let nextCityId: CityId | null = null
            for (let offset = 1; offset <= ship.autoTrade.stops.length; offset++) {
              const candIdx = (ship.autoTrade.stopIndex + offset) % ship.autoTrade.stops.length
              const candId = ship.autoTrade.stops[candIdx]
              if (!candId || candId === ship.dockedCityId) continue
              const candCe = cityEntityById.get(candId)
              if (candCe && !queries.cities.data.city.get(candCe).isIced) {
                nextStopIdx = candIdx
                nextCityId = candId
                break
              }
            }
            if (!nextCityId) continue

            const cargo = { ...ship.cargo }
            let avgCost = { ...ship.cargoAvgCost }
            const comp = resources.company.get()
            let gold = comp.gold
            let profitAdded = 0
            let repGain = 0
            const tradeBonus = CAPTAIN_TRAITS[ship.captain.trait].tradeBonus

            for (const g of GOOD_IDS) {
              if (cargo[g] <= 0) continue
              const price = cityPrice(city, g, cal.season)
              const sellUnit = Math.round(price.sellPrice * (1 + tradeBonus * 0.5))
              const basis = avgCost[g] > 0 ? avgCost[g] : GOODS[g].basePrice
              if (sellUnit >= Math.round(basis * 1.06)) {
                const qty = cargo[g]
                gold += qty * sellUnit
                profitAdded += Math.round((sellUnit - basis) * qty)
                city = { ...city, stock: withStock(city.stock, g, city.stock[g] + qty) }
                cargo[g] = 0
                avgCost[g] = 0
                repGain += Math.min(1.5, qty * 0.04)
              }
            }

            const cls = SHIP_CLASSES[ship.shipClass]
            let used = totalCargoUnits(cargo)
            for (const g of GOOD_IDS) {
              if (used >= cls.capacity) break
              const price = cityPrice(city, g, cal.season)
              const buyUnit = Math.max(1, Math.round(price.buyPrice * (1 - tradeBonus * 0.5)))
              if (buyUnit <= GOODS[g].basePrice * 0.9 && city.stock[g] > 10) {
                const reserveGold = Math.max(0, gold - 2500)
                const maxBuy = Math.min(
                  cls.capacity - used,
                  Math.floor(city.stock[g] * 0.45),
                  Math.floor(reserveGold / buyUnit)
                )
                if (maxBuy > 0) {
                  gold -= maxBuy * buyUnit
                  city = { ...city, stock: withStock(city.stock, g, city.stock[g] - maxBuy) }
                  avgCost = updateWeightedCost(avgCost, cargo[g], g, maxBuy, buyUnit)
                  cargo[g] += maxBuy
                  used += maxBuy
                }
              }
            }

            resources.company.set({
              ...comp,
              gold,
              totalTradeProfit: comp.totalTradeProfit + profitAdded
            })
            queries.cities.data.city.set(ce, {
              ...city,
              playerReputation: Math.min(100, city.playerReputation + repGain)
            })

            const waypoints = computeSeaRoute(ship.x, ship.z, ship.dockedCityId, nextCityId)
            queries.ships.data.ship.set(se, {
              ...ship,
              cargo,
              cargoAvgCost: avgCost,
              navState: "sailing",
              dockedCityId: null,
              targetCityId: nextCityId,
              waypoints,
              waypointIndex: 0,
              autoTrade: { ...ship.autoTrade, stopIndex: nextStopIdx }
            })
          }
        } else if (ship.owner === "hanse" || ship.owner === "pirate") {
          const targetIdx = Math.floor(random.next() * CITY_IDS.length)
          let nextCity = CITY_IDS[targetIdx] ?? "lubeck"
          if (nextCity === ship.dockedCityId) {
            nextCity = CITY_IDS[(targetIdx + 3) % CITY_IDS.length] ?? "danzig"
          }
          if (ship.owner === "hanse") {
            const ce = cityEntityById.get(ship.dockedCityId)
            if (ce) {
              const c = queries.cities.data.city.get(ce)
              const nextStock = { ...c.stock }
              for (const g of GOOD_IDS) {
                const demand = weeklyCityDemand(g, c.poorPop, c.wealthyPop, c.richPop, cal.season)
                if (nextStock[g] < demand * 1.4) {
                  nextStock[g] += Math.max(1, Math.round(demand * 0.35))
                } else if (nextStock[g] > demand * 7.5) {
                  nextStock[g] = Math.max(2, Math.round(nextStock[g] - demand * 0.4))
                }
              }
              queries.cities.data.city.set(ce, { ...c, stock: nextStock })
            }
          }
          const waypoints = computeSeaRoute(ship.x, ship.z, ship.dockedCityId, nextCity)
          queries.ships.data.ship.set(se, {
            ...ship,
            navState: "sailing",
            dockedCityId: null,
            targetCityId: nextCity,
            waypoints,
            waypointIndex: 0
          })
        }
      }
    }

    // Pirate encounters at open sea
    const despawned = new Set<number>()
    for (const pe of shipEntities) {
      const pirate = queries.ships.data.ship.get(pe)
      if (pirate.owner !== "pirate" || pirate.navState !== "sailing" || despawned.has(pirate.shipId)) {
        continue
      }
      for (const me of shipEntities) {
        const merchant = queries.ships.data.ship.get(me)
        if (
          merchant.owner !== "player" ||
          merchant.navState !== "sailing" ||
          merchant.combatCooldownDays > 0
        ) {
          continue
        }
        const dist = Ops.hypot(pirate.x - merchant.x, pirate.z - merchant.z)
        if (dist > 2.3) continue

        const capCombat = merchant.captain ? CAPTAIN_TRAITS[merchant.captain.trait].combatBonus : 0
        const carefulFactor = merchant.captain?.trait === "careful" ? 0.6 : 1.0
        const playerPower =
          merchant.cannons * 14 +
          merchant.crew * 1.6 +
          merchant.hull * 0.35 +
          capCombat +
          random.range(0, 35)
        const piratePower =
          pirate.cannons * 12 + pirate.crew * 1.4 + pirate.hull * 0.3 + random.range(0, 30)

        if (playerPower >= piratePower) {
          const hullDamage = Math.min(
            merchant.hull - 10,
            Math.round(random.range(12, 26) * carefulFactor)
          )
          queries.ships.data.ship.set(me, {
            ...merchant,
            hull: Math.max(15, merchant.hull - Math.max(0, hullDamage)),
            combatCooldownDays: 6
          })
          commands.despawn(pe)
          despawned.add(pirate.shipId)

          let contractBonus = 0
          for (const cte of queries.contracts.each()) {
            const c = queries.contracts.data.contract.get(cte)
            if (
              c.kind === "pirateHunt" &&
              c.accepted &&
              !c.completed &&
              cal.totalDays <= c.expiresDay
            ) {
              queries.contracts.data.contract.set(cte, {
                ...c,
                deliveredAmount: 1,
                completed: true
              })
              contractBonus += c.rewardGold
              break
            }
          }

          const totalGold = pirate.bountyGold + contractBonus
          const comp = resources.company.get()
          resources.company.set({
            ...comp,
            gold: comp.gold + totalGold,
            piratesDefeated: comp.piratesDefeated + 1,
            contractsCompleted: comp.contractsCompleted + (contractBonus > 0 ? 1 : 0),
            aldermanTasksDone: comp.aldermanTasksDone + 1
          })
          const homeE = cityEntityById.get(comp.homeCityId)
          if (homeE) {
            const hc = queries.cities.data.city.get(homeE)
            queries.cities.data.city.set(homeE, {
              ...hc,
              playerReputation: Math.min(100, hc.playerReputation + 8)
            })
          }
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "pirateWin", { shipName: merchant.name, amount: totalGold })
          )
          resources.feedback.update((fb) => pushCue(fb, "battle"))
        } else {
          const nextCargo = { ...merchant.cargo }
          let lootedValue = 0
          for (const g of GOOD_IDS) {
            if (nextCargo[g] > 0) {
              const stolen = Math.ceil(nextCargo[g] * 0.35)
              nextCargo[g] -= stolen
              lootedValue += stolen * GOODS[g].basePrice
            }
          }
          const comp = resources.company.get()
          const tribute = Math.min(comp.gold, 800)
          resources.company.set({ ...comp, gold: comp.gold - tribute })
          queries.ships.data.ship.set(me, {
            ...merchant,
            cargo: nextCargo,
            hull: Math.max(20, merchant.hull - Math.round(28 * carefulFactor)),
            combatCooldownDays: 10
          })
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "pirateLoss", {
              shipName: merchant.name,
              amount: lootedValue + tribute
            })
          )
          resources.feedback.update((fb) => pushCue(fb, "alert"))
        }
        break
      }
    }
  }
)

// ── System 5: SimulateEconomy (Daily Build Timers + Wind + Weekly Economy) ──

export const SimulateEconomy = Game.System(
  "Hanse/SimulateEconomy",
  {
    when: [Game.Condition.inState(GamePhase, "Playing")],
    resources: {
      rng: Game.System.writeResource(Rng),
      company: Game.System.writeResource(Company),
      calendar: Game.System.writeResource(Calendar),
      weather: Game.System.writeResource(Weather),
      chronicle: Game.System.writeResource(Chronicle),
      feedback: Game.System.writeResource(Feedback)
    },
    queries: {
      cities: Game.Query({ selection: { city: Game.Query.write(City) } }),
      ships: Game.Query({ selection: { ship: Game.Query.write(Ship) } }),
      contracts: Game.Query({ selection: { contract: Game.Query.write(Contract) } })
    },
    machines: { phase: Game.System.machine(GamePhase) },
    nextMachines: { phase: Game.System.nextState(GamePhase) },
    commands: Game.System.commands(
      Game.System.spawns(Ship, Contract),
      Game.System.despawns(Contract)
    )
  },
  ({ resources, queries, nextMachines, commands }) => {
    const cal = resources.calendar.get()
    const doDaily = cal.totalDays > cal.lastDailyDay
    const doWeekly = cal.totalDays - cal.lastWeeklyDay >= 7
    const doMonthly = cal.totalDays - cal.lastMonthlyDay >= 30
    if (!doDaily && !doWeekly && !doMonthly) return

    const random = Random.draw(resources.rng)
    let company = resources.company.get()

    // ── Daily Step: Wind drift, construction scaffolding & drydock ship launches ──
    if (doDaily) {
      const daysElapsed = cal.totalDays - cal.lastDailyDay
      const w = resources.weather.get()
      const nextAngle = w.windAngle + random.range(-0.22, 0.22)
      const stormChance = cal.season === "autumn" || cal.season === "winter" ? 0.14 : 0.05
      const nextStorm =
        w.stormIntensity > 0
          ? Math.max(0, w.stormIntensity - 0.34)
          : random.next() < stormChance
            ? random.range(0.45, 0.95)
            : 0
      resources.weather.set({
        windAngle: nextAngle,
        windStrength: Math.max(0.3, Math.min(1.0, w.windStrength + random.range(-0.08, 0.08))),
        stormIntensity: nextStorm
      })

      for (const ce of queries.cities.each()) {
        let city = queries.cities.data.city.get(ce)
        let changed = false

        // Advance business construction timers
        if (city.businesses.some((b) => b.buildDaysLeft > 0)) {
          const updatedBiz = city.businesses.map((b) => {
            if (b.buildDaysLeft <= 0) return b
            const left = Math.max(0, b.buildDaysLeft - daysElapsed)
            if (left === 0) {
              resources.chronicle.update((ch) =>
                pushChronicle(ch, cal, "businessReady", {
                  cityId: city.id,
                  goodId: BUSINESSES[b.type].outputGood
                })
              )
              resources.feedback.update((fb) => pushCue(fb, "build", city.id))
            }
            return { ...b, buildDaysLeft: left }
          })
          city = { ...city, businesses: updatedBiz }
          changed = true
        }

        // Advance shipyard drydock vessel construction
        if (city.shipyardOrder) {
          const left = Math.max(0, city.shipyardOrder.daysLeft - daysElapsed)
          if (left === 0) {
            const ord = city.shipyardOrder
            const shipId = company.nextShipId
            company = { ...company, nextShipId: shipId + 1 }
            const launched = makeShip(shipId, ord.name, ord.shipClass, "player", city.id, 2, null)
            commands.spawn(Game.Command.spawn([Ship, launched]))
            city = { ...city, shipyardOrder: null }
            resources.chronicle.update((ch) =>
              pushChronicle(ch, cal, "shipLaunched", { cityId: city.id, shipName: ord.name })
            )
            resources.feedback.update((fb) => pushCue(fb, "arrive", city.id))
          } else {
            city = { ...city, shipyardOrder: { ...city.shipyardOrder, daysLeft: left } }
          }
          changed = true
        }

        // Update winter sea ice immediately on season day change!
        const def = CITIES[city.id]
        const nextIced = cal.season === "winter" && def.iceProne
        if (nextIced !== city.isIced) {
          city = { ...city, isIced: nextIced }
          changed = true
          if (nextIced) {
            resources.chronicle.update((ch) =>
              pushChronicle(ch, cal, "portFrozen", { cityId: city.id })
            )
          }
        }

        if (changed) {
          queries.cities.data.city.set(ce, city)
        }
      }
    }

    // ── Weekly Step: Economy, 3-class demand, Kontor Managers, Events, Elections, Rank ──
    if (doWeekly) {
      let weeklyExpenses = 0
      let weeklyRent = 0
      let pirateCount = 0

      for (const se of queries.ships.each()) {
        const s = queries.ships.data.ship.get(se)
        if (s.owner === "pirate") pirateCount += 1
        if (s.owner === "player") {
          weeklyExpenses += SHIP_CLASSES[s.shipClass].weeklyWage + (s.captain ? 85 : 0)
        }
        if (s.combatCooldownDays > 0) {
          queries.ships.data.ship.set(se, {
            ...s,
            combatCooldownDays: Math.max(0, s.combatCooldownDays - 7)
          })
        }
      }

      const allCityData: Array<CityData> = []
      for (const ce of queries.cities.each()) {
        let city = queries.cities.data.city.get(ce)
        const def = CITIES[city.id]
        const nextStock = { ...city.stock }
        const nextKontor = { ...city.kontorStock }
        let nextKontorAvg = { ...city.kontorAvgCost }

        // Local town guilds production
        for (const g of GOOD_IDS) {
          const demand = weeklyCityDemand(g, city.poorPop, city.wealthyPop, city.richPop, cal.season)
          const prod = cityProducesGood(city.id, g)
          if (prod === "primary") {
            nextStock[g] = Math.min(950, nextStock[g] + Math.round(demand * 1.45 + 6))
          } else if (prod === "secondary") {
            nextStock[g] = Math.min(750, nextStock[g] + Math.round(demand * 0.95 + 2))
          } else if ((g === "spices" || g === "wine") && (city.id === "london" || city.id === "bremen")) {
            nextStock[g] = Math.min(420, nextStock[g] + 10)
          }
        }

        // Player finished businesses production (with winter output drop!)
        for (const biz of city.businesses) {
          if (biz.buildDaysLeft > 0) continue
          const bDef = BUSINESSES[biz.type]
          weeklyExpenses += bDef.weeklyWage
          let canProduce = true
          for (const inp of bDef.inputGoods) {
            if (nextKontor[inp.good] + nextStock[inp.good] < inp.amount) {
              canProduce = false
              break
            }
          }
          if (canProduce) {
            let inputCost = bDef.weeklyWage
            for (const inp of bDef.inputGoods) {
              const useKontor = Math.min(nextKontor[inp.good], inp.amount)
              if (useKontor > 0) {
                const kBasis =
                  nextKontorAvg[inp.good] > 0
                    ? nextKontorAvg[inp.good]
                    : GOODS[inp.good].basePrice * 0.8
                inputCost += useKontor * kBasis
                nextKontor[inp.good] -= useKontor
              }
              const rem = inp.amount - useKontor
              if (rem > 0) {
                const p = computeMarketPrice(
                  inp.good,
                  nextStock[inp.good],
                  city.poorPop,
                  city.wealthyPop,
                  city.richPop,
                  cal.season
                ).buyPrice
                weeklyExpenses += rem * p
                inputCost += rem * p
                nextStock[inp.good] = Math.max(0, nextStock[inp.good] - rem)
              }
            }
            const winterMult = cal.season === "winter" ? bDef.winterOutputMult : 1.0
            const outAmt = Math.max(1, Math.round(bDef.weeklyOutput * biz.efficiency * winterMult))
            const unitProdCost = inputCost / outAmt
            nextKontorAvg = updateWeightedCost(
              nextKontorAvg,
              nextKontor[bDef.outputGood],
              bDef.outputGood,
              outAmt,
              unitProdCost
            )
            nextKontor[bDef.outputGood] += outAmt
          }
        }

        // Kontor upkeep, house rent & Kontor Administrator automation
        if (city.kontorOwned) {
          weeklyExpenses += 180 + (city.kontorManager ? KONTOR_MANAGER_WEEKLY_WAGE : 0)
          weeklyRent += city.playerHouses * 340

          if (city.kontorManager) {
            for (const g of GOOD_IDS) {
              const p = computeMarketPrice(
                g,
                nextStock[g],
                city.poorPop,
                city.wealthyPop,
                city.richPop,
                cal.season
              )
              // Sell Kontor stock when local price is strong
              if (nextKontor[g] > 8 && p.sellPrice >= GOODS[g].basePrice * 1.1) {
                const sellQty = Math.min(12, nextKontor[g] - 4)
                const basis = nextKontorAvg[g] > 0 ? nextKontorAvg[g] : Math.round(GOODS[g].basePrice * 0.75)
                nextKontor[g] -= sellQty
                nextStock[g] += sellQty
                weeklyRent += sellQty * p.sellPrice
                company = {
                  ...company,
                  totalTradeProfit: company.totalTradeProfit + (p.sellPrice - basis) * sellQty
                }
              } else if (
                nextStock[g] > 18 &&
                p.buyPrice <= GOODS[g].basePrice * 0.82 &&
                company.gold > 6000
              ) {
                const buyQty = Math.min(10, Math.floor(nextStock[g] * 0.25))
                if (buyQty > 0) {
                  nextStock[g] -= buyQty
                  nextKontorAvg = updateWeightedCost(nextKontorAvg, nextKontor[g], g, buyQty, p.buyPrice)
                  nextKontor[g] += buyQty
                  weeklyExpenses += buyQty * p.buyPrice
                }
              }
            }
          }
        }

        // 3-class weekly city consumption
        let foodShortage = false
        let essentialMet = 0
        let luxuryMet = 0
        for (const g of GOOD_IDS) {
          const demand = Math.round(
            weeklyCityDemand(g, city.poorPop, city.wealthyPop, city.richPop, cal.season)
          )
          if (nextStock[g] < demand) {
            if (g === "grain" || g === "fish") foodShortage = true
            nextStock[g] = 0
          } else {
            nextStock[g] -= demand
            if (GOODS[g].category === "essential") essentialMet += 1
            if (GOODS[g].category === "luxury") luxuryMet += 1
          }
        }

        let mood = city.mood
        if (foodShortage) mood = Math.max(15, mood - 6)
        else if (essentialMet >= 3) mood = Math.min(96, mood + 3 + (luxuryMet >= 2 ? 1 : 0))
        if (city.plagueDays > 0) mood = Math.max(15, mood - 4)

        const famineDays = foodShortage ? city.famineDays + 7 : Math.max(0, city.famineDays - 7)
        if (famineDays === 14) {
          resources.chronicle.update((ch) => pushChronicle(ch, cal, "famine", { cityId: city.id }))
        }
        const plagueDays = Math.max(0, city.plagueDays - 7)

        let poorPop = city.poorPop
        let wealthyPop = city.wealthyPop
        let richPop = city.richPop
        if (plagueDays > 0) {
          poorPop = Math.max(600, poorPop - (city.hasHospital ? 8 : 22))
        } else if (mood >= 68) {
          poorPop += 14 + city.playerHouses * 3
          wealthyPop += 6 + city.playerHouses + (luxuryMet >= 1 ? 2 : 0)
          richPop += 2 + (luxuryMet >= 3 ? 2 : 0)
        } else if (mood < 38) {
          poorPop = Math.max(600, poorPop - 18)
          wealthyPop = Math.max(200, wealthyPop - 6)
        }

        const totalPop = poorPop + wealthyPop + richPop
        const wallLevel = totalPop >= 4600 ? 3 : totalPop >= 3000 ? 2 : 1
        const wasIced = city.isIced
        const isIced = cal.season === "winter" && def.iceProne
        if (isIced && !wasIced) {
          resources.chronicle.update((ch) => pushChronicle(ch, cal, "portFrozen", { cityId: city.id }))
        }

        // Refresh Tavern captain if slot empty
        const tavernCaptain =
          city.tavernCaptain ?? (random.next() < 0.45 ? makeTavernCaptain(random) : null)

        city = {
          ...city,
          poorPop,
          wealthyPop,
          richPop,
          mood,
          stock: nextStock,
          kontorStock: nextKontor,
          kontorAvgCost: nextKontorAvg,
          tavernCaptain,
          wallLevel,
          isIced,
          famineDays,
          plagueDays
        }
        queries.cities.data.city.set(ce, city)
        allCityData.push(city)
      }

      const loanInterest = company.debt > 0 ? Math.round(company.debt * 0.015) : 0
      company = {
        ...company,
        gold: Math.max(0, company.gold + weeklyRent - weeklyExpenses),
        debt: company.debt + loanInterest
      }

      // Periodically trigger interactive historical Hanseatic Events with choices
      if (company.activeEvent && cal.totalDays > company.activeEvent.expiresDay) {
        company = { ...company, activeEvent: null }
      }
      if (!company.activeEvent && cal.totalDays >= 28 && random.next() < 0.22) {
        const kinds: ReadonlyArray<HanseEventKind> = [
          "victualBrothers",
          "herringShift",
          "soundBlockade",
          "plagueSeason",
          "hanseaticDiet"
        ]
        const kind = random.pick(kinds) ?? "herringShift"
        const evCityId: CityId =
          kind === "herringShift"
            ? "malmo"
            : kind === "soundBlockade"
              ? "lubeck"
              : kind === "victualBrothers"
                ? "visby"
                : random.pick(CITY_IDS) ?? "lubeck"
        company = {
          ...company,
          activeEvent: {
            eventId: company.nextEventId,
            kind,
            cityId: evCityId,
            expiresDay: cal.totalDays + 35
          },
          nextEventId: company.nextEventId + 1
        }
        resources.feedback.update((fb) => pushCue(fb, "alert", evCityId))
      }

      if (pirateCount < 2 && random.next() < 0.35) {
        const pid = company.nextShipId
        const pname = PIRATE_NAME_POOL[pid % PIRATE_NAME_POOL.length] ?? "Victual Brother"
        const spawnCity: CityId = random.next() < 0.5 ? "visby" : "bergen"
        const targetCity: CityId = spawnCity === "visby" ? "danzig" : "hamburg"
        const cls: ShipClassId = cal.totalDays > 120 ? "cog" : "kraier"
        const base = makeShip(pid, pname, cls, "pirate", spawnCity, cls === "cog" ? 7 : 4)
        const waypoints = computeSeaRoute(base.x, base.z, spawnCity, targetCity)
        commands.spawn(
          Game.Command.spawn([
            Ship,
            {
              ...base,
              navState: "sailing",
              dockedCityId: null,
              targetCityId: targetCity,
              waypoints,
              waypointIndex: 0
            }
          ])
        )
        company = { ...company, nextShipId: pid + 1 }
      }

      let activeContracts = 0
      for (const cte of queries.contracts.each()) {
        const c = queries.contracts.data.contract.get(cte)
        if (c.completed || cal.totalDays > c.expiresDay) {
          commands.despawn(cte)
        } else {
          activeContracts += 1
        }
      }
      while (activeContracts < 4 && allCityData.length > 0) {
        const nc = generateContract(company.nextContractId, cal.totalDays, allCityData, random)
        commands.spawn(Game.Command.spawn([Contract, nc]))
        company = { ...company, nextContractId: company.nextContractId + 1 }
        activeContracts += 1
      }

      if (cal.totalDays >= company.nextElectionDay) {
        for (const ce of queries.cities.each()) {
          const c = queries.cities.data.city.get(ce)
          if (c.id !== company.homeCityId) continue
          const rankIdx = RANK_IDS.indexOf(company.rank)
          const eligible =
            rankIdx >= RANK_IDS.indexOf("patrician") ||
            (rankIdx >= RANK_IDS.indexOf("councillor") && c.playerReputation >= 78)
          if (eligible && c.playerReputation >= 75) {
            queries.cities.data.city.set(ce, {
              ...c,
              playerIsMayor: true,
              mayorName: company.name
            })
            resources.chronicle.update((ch) =>
              pushChronicle(ch, cal, "electionWon", { cityId: c.id })
            )
            resources.feedback.update((fb) => pushCue(fb, "rankUp", c.id))
          } else if (c.playerIsMayor && c.playerReputation < 50) {
            queries.cities.data.city.set(ce, {
              ...c,
              playerIsMayor: false,
              mayorName: CITIES[c.id].mayorStart
            })
            resources.chronicle.update((ch) =>
              pushChronicle(ch, cal, "electionLost", { cityId: c.id })
            )
          }
          break
        }
        company = { ...company, nextElectionDay: cal.totalDays + 90 }
      }

      const shipsList = queries.ships.each().map((e) => queries.ships.data.ship.get(e))
      const citiesList = queries.cities.each().map((e) => queries.cities.data.city.get(e))
      const wealth = computeCompanyWealth(company, citiesList, shipsList, cal.season)
      const playerShipCount = shipsList.filter((s) => s.owner === "player").length
      const kontorCount = citiesList.filter((c) => c.kontorOwned).length
      const bizCount = citiesList.reduce((acc, c) => acc + c.businesses.length, 0)
      const homeCity = citiesList.find((c) => c.id === company.homeCityId)
      const homeRep = homeCity?.playerReputation ?? 0
      const isMayor = homeCity?.playerIsMayor ?? false

      const curIdx = RANK_IDS.indexOf(company.rank)
      let nextRank = company.rank
      for (let i = curIdx + 1; i < RANK_IDS.length; i++) {
        const rId = RANK_IDS[i]
        if (!rId) continue
        const req = RANKS[rId]
        const meets =
          wealth >= req.minWealth &&
          playerShipCount >= req.minShips &&
          (!req.requiresGuild || company.guildMember) &&
          kontorCount >= req.minKontors &&
          bizCount >= req.minBusinesses &&
          homeRep >= req.minHomeRep &&
          (!req.requiresMayor || isMayor) &&
          company.aldermanTasksDone >= req.minAldermanTasks
        if (meets) {
          nextRank = rId
        } else {
          break
        }
      }

      if (nextRank !== company.rank) {
        company = {
          ...company,
          rank: nextRank,
          victoryAchieved: nextRank === "alderman" ? true : company.victoryAchieved
        }
        resources.chronicle.update((ch) =>
          pushChronicle(ch, cal, "rankUp", { rankId: nextRank })
        )
        resources.feedback.update((fb) =>
          pushCue(fb, nextRank === "alderman" ? "victory" : "rankUp", company.homeCityId)
        )
        if (nextRank === "alderman") {
          resources.chronicle.update((ch) =>
            pushChronicle(ch, cal, "victory", { cityId: company.homeCityId })
          )
          nextMachines.phase.transition({ from: "Playing", to: "Victory" })
        }
      }
    }

    resources.company.set(company)
    resources.calendar.set({
      ...cal,
      lastDailyDay: doDaily ? cal.totalDays : cal.lastDailyDay,
      lastWeeklyDay: doWeekly ? cal.totalDays : cal.lastWeeklyDay,
      lastMonthlyDay: doMonthly ? cal.totalDays : cal.lastMonthlyDay
    })
  }
)
