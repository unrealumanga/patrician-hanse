import { Clock, Descriptor, Random, Schema } from "@typeonce/ritmo"
import type {
  BusinessId,
  CaptainTraitId,
  CityId,
  GoodId,
  MerchantMarkId,
  RankId,
  SeasonId,
  ShipClassId,
  Waypoint
} from "./data.ts"

export const STEP = Clock.hz(30)
export type StepHz = 30
export const STEPS_PER_DAY = 120

// ── Component Data Types ─────────────────────────────────────────────────

export interface BusinessInstance {
  readonly id: number
  readonly type: BusinessId
  readonly plotIndex: number
  readonly efficiency: number
  readonly active: boolean
  /** 0 = finished & producing; >0 = under wooden scaffolding construction */
  readonly buildDaysLeft: number
  readonly totalBuildDays: number
}

export interface ShipyardOrder {
  readonly shipClass: ShipClassId
  readonly name: string
  readonly daysLeft: number
  readonly totalDays: number
}

export interface TavernCaptain {
  readonly name: string
  readonly trait: CaptainTraitId
  readonly hireCost: number
}

export interface CityData {
  readonly id: CityId
  readonly poorPop: number
  readonly wealthyPop: number
  readonly richPop: number
  readonly mood: number
  readonly playerReputation: number
  readonly stock: Readonly<Record<GoodId, number>>
  readonly kontorOwned: boolean
  readonly kontorManager: boolean
  readonly kontorStock: Readonly<Record<GoodId, number>>
  readonly kontorAvgCost: Readonly<Record<GoodId, number>>
  readonly businesses: ReadonlyArray<BusinessInstance>
  readonly shipyardOrder: ShipyardOrder | null
  readonly tavernCaptain: TavernCaptain | null
  readonly playerHouses: number
  readonly hasWell: boolean
  readonly hasHospital: boolean
  readonly wallLevel: number
  readonly isIced: boolean
  readonly famineDays: number
  readonly plagueDays: number
  readonly mayorName: string
  readonly playerIsMayor: boolean
}

export type ShipOwner = "player" | "pirate" | "hanse"
export type ShipNavState = "docked" | "sailing"

export interface AutoTradeConfig {
  readonly enabled: boolean
  readonly stops: ReadonlyArray<CityId>
  readonly stopIndex: number
}

export interface ShipCaptain {
  readonly name: string
  readonly trait: CaptainTraitId
}

export interface ShipData {
  readonly shipId: number
  readonly name: string
  readonly shipClass: ShipClassId
  readonly owner: ShipOwner
  readonly captain: ShipCaptain | null
  readonly x: number
  readonly z: number
  readonly heading: number
  readonly hull: number
  readonly maxHull: number
  readonly cannons: number
  readonly crew: number
  readonly cargo: Readonly<Record<GoodId, number>>
  readonly cargoAvgCost: Readonly<Record<GoodId, number>>
  readonly navState: ShipNavState
  readonly dockedCityId: CityId | null
  readonly targetCityId: CityId | null
  readonly waypoints: ReadonlyArray<Waypoint>
  readonly waypointIndex: number
  readonly autoTrade: AutoTradeConfig
  readonly bountyGold: number
  readonly combatCooldownDays: number
}

export type ContractKind = "supply" | "famine" | "pirateHunt"

export interface ContractData {
  readonly contractId: number
  readonly kind: ContractKind
  readonly cityId: CityId
  readonly goodId: GoodId | null
  readonly requiredAmount: number
  readonly deliveredAmount: number
  readonly rewardGold: number
  readonly rewardRep: number
  readonly expiresDay: number
  readonly accepted: boolean
  readonly completed: boolean
}

// ── Interactive Historical Hanseatic Events ──────────────────────────────

export type HanseEventKind =
  | "victualBrothers"
  | "soundBlockade"
  | "herringShift"
  | "plagueSeason"
  | "hanseaticDiet"

export interface ActiveEventData {
  readonly eventId: number
  readonly kind: HanseEventKind
  readonly cityId: CityId
  readonly expiresDay: number
}

export interface WeatherData {
  /** Wind angle in radians (0 = blowing +Z south, PI/2 = +X east) */
  readonly windAngle: number
  /** Wind strength 0.3..1.0 */
  readonly windStrength: number
  /** Active storm intensity 0..1 */
  readonly stormIntensity: number
}

// ── Resource Data Types ──────────────────────────────────────────────────

export interface CompanyData {
  readonly name: string
  readonly merchantMark: MerchantMarkId
  readonly gold: number
  readonly debt: number
  readonly rank: RankId
  readonly guildMember: boolean
  readonly homeCityId: CityId
  readonly totalTradeProfit: number
  readonly piratesDefeated: number
  readonly contractsCompleted: number
  readonly aldermanTasksDone: number
  readonly nextShipId: number
  readonly nextContractId: number
  readonly nextBusinessId: number
  readonly nextEventId: number
  readonly nextElectionDay: number
  readonly activeEvent: ActiveEventData | null
  readonly victoryAchieved: boolean
}

export type SimSpeed = 0 | 1 | 2 | 4

export interface CalendarData {
  readonly totalDays: number
  readonly dayOfMonth: number
  readonly month: number
  readonly year: number
  readonly season: SeasonId
  readonly speed: SimSpeed
  readonly dayStepAccum: number
  readonly lastWeeklyDay: number
  readonly lastMonthlyDay: number
  readonly lastDailyDay: number
}

export type ViewMode = "sea" | "town"
export type PanelTab = "market" | "shipyard" | "kontor" | "tavern" | "guild" | "townhall" | "fleet"

export interface SelectionData {
  readonly viewMode: ViewMode
  readonly selectedCityId: CityId
  readonly selectedShipId: number | null
  readonly activeTab: PanelTab
  readonly buildMode: boolean
}

export type ChronicleTag =
  | "founded"
  | "trade"
  | "arrived"
  | "builtKontor"
  | "builtBusiness"
  | "businessReady"
  | "builtHouse"
  | "commissionedShip"
  | "shipLaunched"
  | "hiredCaptain"
  | "pirateWin"
  | "pirateLoss"
  | "rankUp"
  | "joinedGuild"
  | "contractDone"
  | "electionWon"
  | "electionLost"
  | "seasonChange"
  | "portFrozen"
  | "famine"
  | "feast"
  | "eventResolved"
  | "victory"

export interface ChronicleEntry {
  readonly seq: number
  readonly day: number
  readonly month: number
  readonly year: number
  readonly tag: ChronicleTag
  readonly cityId: CityId | null
  readonly goodId: GoodId | null
  readonly shipName: string | null
  readonly amount: number
  readonly rankId: RankId | null
  readonly season: SeasonId | null
}

export interface ChronicleData {
  readonly nextSeq: number
  readonly entries: ReadonlyArray<ChronicleEntry>
}

export type CueKind =
  | "coin"
  | "sail"
  | "arrive"
  | "build"
  | "battle"
  | "rankUp"
  | "alert"
  | "select"
  | "crane"
  | "victory"

export interface FeedbackCue {
  readonly seq: number
  readonly kind: CueKind
  readonly cityId: CityId | null
  readonly goodId: GoodId | null
  readonly delta: number
}

export interface FeedbackData {
  readonly nextSeq: number
  readonly cues: ReadonlyArray<FeedbackCue>
}

// ── Player Intents ───────────────────────────────────────────────────────

export type HanseIntent =
  | { readonly _tag: "SetSpeed"; readonly speed: SimSpeed }
  | { readonly _tag: "SelectCity"; readonly cityId: CityId }
  | { readonly _tag: "SelectShip"; readonly shipId: number | null }
  | { readonly _tag: "SetViewMode"; readonly viewMode: ViewMode; readonly cityId?: CityId }
  | { readonly _tag: "SetActiveTab"; readonly tab: PanelTab }
  | { readonly _tag: "ToggleBuildMode"; readonly enabled: boolean }
  | { readonly _tag: "SetMerchantMark"; readonly mark: MerchantMarkId }
  | { readonly _tag: "SailShip"; readonly shipId: number; readonly targetCityId: CityId }
  | {
      readonly _tag: "TradeMarket"
      readonly cityId: CityId
      readonly shipId: number | null
      readonly goodId: GoodId
      readonly delta: number
    }
  | {
      readonly _tag: "TransferKontor"
      readonly cityId: CityId
      readonly shipId: number
      readonly goodId: GoodId
      readonly delta: number
    }
  | { readonly _tag: "BuildKontor"; readonly cityId: CityId }
  | { readonly _tag: "ToggleKontorManager"; readonly cityId: CityId }
  | {
      readonly _tag: "BuildBusiness"
      readonly cityId: CityId
      readonly businessId: BusinessId
      readonly plotIndex?: number
    }
  | { readonly _tag: "BuildHouse"; readonly cityId: CityId }
  | { readonly _tag: "BuildCivic"; readonly cityId: CityId; readonly civic: "well" | "hospital" }
  | { readonly _tag: "CommissionShip"; readonly cityId: CityId; readonly shipClass: ShipClassId }
  | { readonly _tag: "RepairShip"; readonly shipId: number }
  | { readonly _tag: "ArmShip"; readonly shipId: number; readonly cannonsToAdd: number }
  | { readonly _tag: "HireCaptain"; readonly cityId: CityId; readonly shipId: number }
  | {
      readonly _tag: "ConfigureAutoTrade"
      readonly shipId: number
      readonly enabled: boolean
      readonly stops?: ReadonlyArray<CityId>
    }
  | { readonly _tag: "JoinGuild" }
  | { readonly _tag: "AcceptContract"; readonly contractId: number }
  | { readonly _tag: "DeliverContract"; readonly contractId: number; readonly shipId: number | null }
  | { readonly _tag: "DonateCity"; readonly cityId: CityId }
  | { readonly _tag: "ThrowFeast"; readonly cityId: CityId }
  | { readonly _tag: "TakeLoan"; readonly amount: number }
  | { readonly _tag: "RepayLoan"; readonly amount: number }
  | { readonly _tag: "ResolveEvent"; readonly choice: "a" | "b" }
  | {
      readonly _tag: "RestoreCharter"
      readonly company: CompanyData
      readonly calendar: CalendarData
      readonly weather: WeatherData
      readonly selection: SelectionData
      readonly cities: ReadonlyArray<CityData>
      readonly ships: ReadonlyArray<ShipData>
      readonly contracts: ReadonlyArray<ContractData>
      readonly chronicle: ChronicleData
    }
  | { readonly _tag: "ContinueAfterVictory" }
  | { readonly _tag: "NewGame"; readonly seed: number }

// ── Descriptors & Schema ─────────────────────────────────────────────────

export const Time = Clock.resource("Hanse/Time", STEP)
export const Rng = Descriptor.ConstructedResource(Random.codec)("Hanse/Rng")

export const City = Descriptor.Component<CityData>()("Hanse/City")
export const Ship = Descriptor.Component<ShipData>()("Hanse/Ship")
export const Contract = Descriptor.Component<ContractData>()("Hanse/Contract")

export const Company = Descriptor.Resource<CompanyData>()("Hanse/Company")
export const Calendar = Descriptor.Resource<CalendarData>()("Hanse/Calendar")
export const Weather = Descriptor.Resource<WeatherData>()("Hanse/Weather")
export const Selection = Descriptor.Resource<SelectionData>()("Hanse/Selection")
export const Chronicle = Descriptor.Resource<ChronicleData>()("Hanse/Chronicle")
export const Feedback = Descriptor.Resource<FeedbackData>()("Hanse/Feedback")

export const Intent = Descriptor.Event<HanseIntent>()("Hanse/Intent")

const HanseFragment = Schema.fragment({
  components: { City, Ship, Contract },
  resources: { Time, Rng, Company, Calendar, Weather, Selection, Chronicle, Feedback },
  events: { Intent }
})

type HanseSchemaOf = typeof HanseFragment
export interface HanseSchema extends HanseSchemaOf {}

const namedSchema: HanseSchema = HanseFragment
const Root = Schema.defineRoot("Hanse")
export const Game = Schema.bind(namedSchema, Root)

export const GamePhase = Game.StateMachine(
  "Hanse/GamePhase",
  {
    Boot: {},
    Playing: {},
    Victory: {}
  },
  {
    transitions: {
      Boot: ["Playing"],
      Playing: ["Victory", "Boot"],
      Victory: ["Playing", "Boot"]
    }
  }
)
