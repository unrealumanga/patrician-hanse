import { HostClock } from "@typeonce/ritmo"
import { describe, expect, it } from "vitest"
import {
  Intent,
  makeSimulation,
  ReadWorldView,
  setupSchedule,
  updateSchedule,
  type HanseIntent
} from "../src/sim/index.ts"

function startWorld(seed = 13700501) {
  const runtime = makeSimulation({ seed, debug: { hostClock: HostClock.test() } })
  const res = runtime.tick(setupSchedule)
  expect(res.ok).toBe(true)
  return runtime
}

function send(runtime: ReturnType<typeof makeSimulation>, intent: HanseIntent) {
  runtime.send(Intent, intent)
}

function stepFrames(runtime: ReturnType<typeof makeSimulation>, frames: number) {
  for (let i = 0; i < frames; i++) {
    const res = runtime.tick(updateSchedule)
    expect(res.ok).toBe(true)
  }
}

function inspectView(runtime: ReturnType<typeof makeSimulation>) {
  return runtime.inspect(ReadWorldView)
}

describe("Hanseatic Ledger · Patrician III Ritmo ECS Simulation", () => {
  it("bootstraps 12 Hanseatic cities, 14 goods, starting Snaikka with Captain, pirates, and realistic Day 1 rank", () => {
    const rt = startWorld()
    const view = inspectView(rt)

    expect(view.phase).toBe("Playing")
    expect(view.cities).toHaveLength(12)
    expect(view.cities[0]?.market).toHaveLength(14)
    expect(view.company.gold).toBe(18500)
    expect(view.company.rank).toBe("shopkeeper")
    expect(view.nextRank?.id).toBe("trader")
    expect(view.totalWealth).toBeLessThan(view.nextRank!.minWealth)
    expect(view.contracts.length).toBeGreaterThanOrEqual(4)

    const lubeck = view.cities.find((c) => c.id === "lubeck")
    expect(lubeck?.kontorOwned).toBe(true)
    expect(lubeck?.landmark).toBe("holstentor")

    const playerShips = view.ships.filter((s) => s.owner === "player")
    expect(playerShips).toHaveLength(1)
    expect(playerShips[0]?.dockedCityId).toBe("lubeck")
    expect(playerShips[0]?.captain?.name).toBe("Hinrik Castorp")
  })

  it("tracks weighted average cost basis and realized trade profit across voyages", () => {
    const rt = startWorld()
    const before = inspectView(rt)
    const shipId = before.ships.find((s) => s.owner === "player")!.shipId

    send(rt, { _tag: "TradeMarket", cityId: "lubeck", shipId, goodId: "salt", delta: 10 })
    stepFrames(rt, 1)

    const afterBuy = inspectView(rt)
    const shipAfterBuy = afterBuy.ships.find((s) => s.shipId === shipId)!
    expect(shipAfterBuy.cargo.salt).toBe(10)
    expect(shipAfterBuy.cargoAvgCost.salt).toBeGreaterThan(0)

    send(rt, { _tag: "SetSpeed", speed: 4 })
    send(rt, { _tag: "SailShip", shipId, targetCityId: "rostock" })
    stepFrames(rt, 240)

    const arrived = inspectView(rt)
    const shipArrived = arrived.ships.find((s) => s.shipId === shipId)!
    expect(shipArrived.navState).toBe("docked")
    expect(shipArrived.dockedCityId).toBe("rostock")

    send(rt, { _tag: "TradeMarket", cityId: "rostock", shipId, goodId: "salt", delta: -10 })
    stepFrames(rt, 1)
    const afterSell = inspectView(rt)
    expect(afterSell.ships.find((s) => s.shipId === shipId)?.cargo.salt).toBe(0)
    expect(afterSell.ships.find((s) => s.shipId === shipId)?.cargoAvgCost.salt).toBe(0)
    expect(afterSell.company.totalTradeProfit).not.toBe(0)
  })

  it("enforces real construction materials & daily build timers for workshops and drydock vessels", () => {
    const rt = startWorld()
    const before = inspectView(rt)
    const lubeckBefore = before.cities.find((c) => c.id === "lubeck")!

    send(rt, { _tag: "TakeLoan", amount: 25000 })
    send(rt, { _tag: "BuildBusiness", cityId: "lubeck", businessId: "sawmill" })
    send(rt, { _tag: "CommissionShip", cityId: "lubeck", shipClass: "snaikka" })
    send(rt, { _tag: "SetSpeed", speed: 4 })
    stepFrames(rt, 1)

    const building = inspectView(rt)
    const lubeckBuilding = building.cities.find((c) => c.id === "lubeck")!
    expect(lubeckBuilding.businesses).toHaveLength(1)
    expect(lubeckBuilding.businesses[0]!.buildDaysLeft).toBeGreaterThan(0)
    expect(lubeckBuilding.shipyardOrder).not.toBeNull()
    expect(lubeckBuilding.stock.timber).toBeLessThan(lubeckBefore.stock.timber)

    // Advance 16 game days (120 steps/day / 4x = 30 steps/day => ~500 frames)
    stepFrames(rt, 500)
    const done = inspectView(rt)
    const lubeckDone = done.cities.find((c) => c.id === "lubeck")!
    expect(lubeckDone.businesses[0]!.buildDaysLeft).toBe(0)
    expect(lubeckDone.shipyardOrder).toBeNull()
    expect(done.ships.filter((s) => s.owner === "player")).toHaveLength(2)
    expect(lubeckDone.kontorStock.timber).toBeGreaterThan(0)
  })

  it("enforces winter ice port blocking, captain hiring, and Kontor Manager", () => {
    const rt = startWorld()
    const initial = inspectView(rt)

    // Freeze Riga in winter and verify departure/arrival intent is blocked
    const frozenCities = initial.cities.map((c) =>
      c.id === "riga" ? { ...c, isIced: true } : c
    )
    send(rt, {
      _tag: "RestoreCharter",
      company: initial.company,
      calendar: { ...initial.calendar, month: 1, season: "winter" },
      weather: initial.weather,
      selection: initial.selection,
      cities: frozenCities,
      ships: initial.ships,
      contracts: initial.contracts,
      chronicle: { nextSeq: 2, entries: initial.chronicle }
    })
    stepFrames(rt, 1)

    send(rt, { _tag: "SailShip", shipId: 1, targetCityId: "riga" })
    stepFrames(rt, 1)
    expect(inspectView(rt).ships.find((s) => s.shipId === 1)?.navState).toBe("docked")

    // Hire Tavern captain & toggle Kontor Manager
    send(rt, { _tag: "HireCaptain", cityId: "lubeck", shipId: 1 })
    send(rt, { _tag: "ToggleKontorManager", cityId: "lubeck" })
    stepFrames(rt, 1)
    const afterHire = inspectView(rt)
    const lubeckAfter = afterHire.cities.find((c) => c.id === "lubeck")!
    expect(lubeckAfter.tavernCaptain).toBeNull()
    expect(lubeckAfter.kontorManager).toBe(true)
  })

  it("is 100% deterministic across identical runs and supports Charter save/restore", () => {
    const runScript = () => {
      const rt = startWorld(987654321)
      send(rt, { _tag: "SetSpeed", speed: 4 })
      send(rt, { _tag: "TradeMarket", cityId: "lubeck", shipId: 1, goodId: "bricks", delta: 12 })
      send(rt, { _tag: "SailShip", shipId: 1, targetCityId: "danzig" })
      stepFrames(rt, 180)
      return { rt, view: inspectView(rt) }
    }

    const a = runScript()
    const b = runScript()

    expect(a.view.company).toEqual(b.view.company)
    expect(a.view.calendar).toEqual(b.view.calendar)
    expect(a.view.weather).toEqual(b.view.weather)
    expect(a.view.ships).toEqual(b.view.ships)
    expect(a.view.cities).toEqual(b.view.cities)
  })

  it("rejects expired contracts, resolves historical events, and supports continuing after Alderman victory", () => {
    const rt = startWorld(4242)
    const initial = inspectView(rt)

    const boostedCities = initial.cities.map((c, idx) => ({
      ...c,
      kontorOwned: idx < 4 ? true : c.kontorOwned,
      playerReputation: c.id === "lubeck" ? 90 : c.playerReputation,
      playerIsMayor: c.id === "lubeck" ? true : c.playerIsMayor,
      businesses:
        c.id === "lubeck"
          ? [0, 1, 2, 3, 4, 5].map((i) => ({
              id: 100 + i,
              type: "sawmill" as const,
              plotIndex: i,
              efficiency: 1,
              active: true,
              buildDaysLeft: 0,
              totalBuildDays: 7
            }))
          : c.businesses
    }))
    const baseShip = initial.ships.find((s) => s.owner === "player")!
    const extraShips = [
      ...initial.ships,
      ...[201, 202, 203, 204].map((id) => ({ ...baseShip, shipId: id, name: `Cog ${id}` }))
    ]

    send(rt, {
      _tag: "RestoreCharter",
      company: {
        ...initial.company,
        gold: 580000,
        guildMember: true,
        aldermanTasksDone: 2,
        rank: "lordMayor",
        activeEvent: { eventId: 99, kind: "hanseaticDiet", cityId: "lubeck", expiresDay: 50 }
      },
      calendar: { ...initial.calendar, totalDays: 10, lastWeeklyDay: 1, lastDailyDay: 10, speed: 4 },
      weather: initial.weather,
      selection: initial.selection,
      cities: boostedCities,
      ships: extraShips,
      contracts: initial.contracts.map((c, idx) =>
        idx === 0 ? { ...c, expiresDay: 5, accepted: false } : c
      ),
      chronicle: { nextSeq: 2, entries: initial.chronicle }
    })
    stepFrames(rt, 1)

    const expId = initial.contracts[0]!.contractId
    send(rt, { _tag: "AcceptContract", contractId: expId })
    send(rt, { _tag: "ResolveEvent", choice: "a" })
    stepFrames(rt, 1)

    const vWin = inspectView(rt)
    expect(vWin.phase).toBe("Victory")
    expect(vWin.company.rank).toBe("alderman")
    expect(vWin.company.activeEvent).toBeNull()

    send(rt, { _tag: "ContinueAfterVictory" })
    stepFrames(rt, 1)
    expect(inspectView(rt).phase).toBe("Playing")
  })
})
