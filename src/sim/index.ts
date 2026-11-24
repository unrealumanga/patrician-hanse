import { Clock, type Debug, Random } from "@typeonce/ritmo"
import { Game, GamePhase, STEP } from "./schema.ts"
import {
  AdvanceCalendar,
  AdvanceClock,
  BootstrapWorld,
  HandleIntents,
  SimulateEconomy,
  SimulateShips
} from "./systems.ts"

export * from "./data.ts"
export * from "./schema.ts"
export * from "./systems.ts"
export * from "./inspectors.ts"

export const setupSchedule = Game.Schedule(
  BootstrapWorld,
  Game.Schedule.applyDeferred(),
  Game.Schedule.applyStateTransitions()
)

export const updateSchedule = Game.Schedule(
  AdvanceClock,
  AdvanceCalendar,
  HandleIntents,
  Game.Schedule.applyDeferred(),
  Game.Schedule.applyStateTransitions(),
  BootstrapWorld,
  Game.Schedule.applyDeferred(),
  Game.Schedule.applyStateTransitions(),
  SimulateShips,
  Game.Schedule.applyDeferred(),
  SimulateEconomy,
  Game.Schedule.applyDeferred(),
  Game.Schedule.applyStateTransitions()
)

export interface MakeSimulationOptions {
  readonly seed?: number
  readonly debug?: Debug.Option
}

export function makeSimulation(options: MakeSimulationOptions = {}) {
  const seed = options.seed ?? 13700501
  const made = Game.Runtime.make({
    services: Game.Runtime.services(),
    resources: {
      Time: Clock.start(STEP),
      Rng: Random.seed(seed),
      Company: {
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
        nextShipId: 1,
        nextContractId: 1,
        nextBusinessId: 1,
        nextEventId: 1,
        nextElectionDay: 60,
        activeEvent: null,
        victoryAchieved: false
      },
      Calendar: {
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
      },
      Weather: {
        windAngle: 0.65,
        windStrength: 0.62,
        stormIntensity: 0
      },
      Selection: {
        viewMode: "sea",
        selectedCityId: "lubeck",
        selectedShipId: null,
        activeTab: "market",
        buildMode: false
      },
      Chronicle: { nextSeq: 1, entries: [] },
      Feedback: { nextSeq: 1, cues: [] }
    },
    machines: Game.Runtime.machines(
      Game.Runtime.machine(GamePhase, { _tag: "Boot" })
    ),
    debug: options.debug
  })
  if (!made.ok) {
    throw new Error(`Failed to initialize Hanse simulation runtime: ${String(made.error)}`)
  }
  return made.value
}
