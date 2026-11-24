import { FixedLoop } from "@typeonce/ritmo"
import "./host/styles.css"
import { HanseAudio } from "./host/audio.ts"
import { HanseHud } from "./host/hud.ts"
import { Hanse3DScene } from "./render/hanseScene.ts"
import { applyThemeCssVars, INKLINE_THEMES, type InklineThemeId } from "./render/palette.ts"
import {
  Intent,
  makeSimulation,
  ReadWorldView,
  setupSchedule,
  STEP,
  updateSchedule,
  type CalendarData,
  type ChronicleData,
  type CityData,
  type CompanyData,
  type ContractData,
  type HanseIntent,
  type SelectionData,
  type ShipData,
  type WeatherData
} from "./sim/index.ts"

const SAVE_KEY = "patrician-hanse-inkline-save-v2"
const THEME_ORDER: ReadonlyArray<InklineThemeId> = ["sage", "vellum", "blueprint"]

interface SavedCharter {
  readonly company: CompanyData
  readonly calendar: CalendarData
  readonly weather: WeatherData
  readonly selection: SelectionData
  readonly cities: ReadonlyArray<CityData>
  readonly ships: ReadonlyArray<ShipData>
  readonly contracts: ReadonlyArray<ContractData>
  readonly chronicle: ChronicleData
}

function bootstrap() {
  const app = document.getElementById("app")
  if (!app) throw new Error("Missing #app container")

  const sceneRoot = document.createElement("div")
  sceneRoot.className = "scene-root"
  app.appendChild(sceneRoot)

  let themeIdx = 0
  applyThemeCssVars(INKLINE_THEMES.sage)

  const runtime = makeSimulation({ seed: 13700501 })
  const setupRes = runtime.tick(setupSchedule)
  if (!setupRes.ok) {
    throw new Error(`Simulation setup failed: ${String(setupRes.error)}`)
  }

  const audio = new HanseAudio()
  let lastCueSeq = 0

  const dispatch = (intent: HanseIntent) => {
    if (intent._tag === "NewGame" || intent._tag === "RestoreCharter") {
      lastCueSeq = 0
    }
    runtime.send(Intent, intent)
  }

  let hudRef: HanseHud | null = null

  const scene = new Hanse3DScene(sceneRoot, {
    onSelectCity: (cityId) => {
      dispatch({ _tag: "SelectCity", cityId })
      scene.focusCity(cityId)
    },
    onDoubleClickCity: (cityId) => {
      dispatch({ _tag: "SetViewMode", viewMode: "town", cityId })
    },
    onRightClickCity: (cityId) => {
      const view = runtime.inspect(ReadWorldView)
      const selShipId = view.selection.selectedShipId
      if (selShipId !== null) {
        dispatch({ _tag: "SailShip", shipId: selShipId, targetCityId: cityId })
        dispatch({ _tag: "SelectCity", cityId })
      }
    },
    onSelectShip: (shipId) => {
      dispatch({ _tag: "SelectShip", shipId })
      hudRef?.openLedgerTab("market")
    },
    onClickBuildPlot: (_plotIndex) => {
      hudRef?.openLedgerTab("kontor")
    },
    onClickLandmarkTab: (tab) => {
      hudRef?.openLedgerTab(tab)
    }
  })

  const hud = new HanseHud(app, {
    dispatch,
    onFocusCity: (cityId) => scene.focusCity(cityId),
    onCycleTheme: () => {
      themeIdx = (themeIdx + 1) % THEME_ORDER.length
      const next = THEME_ORDER[themeIdx] ?? "sage"
      applyThemeCssVars(INKLINE_THEMES[next])
      scene.setTheme(next)
      return next
    },
    onToggleMute: () => audio.toggleMute(),
    onSaveGame: () => {
      const v = runtime.inspect(ReadWorldView)
      const payload: SavedCharter = {
        company: v.company,
        calendar: v.calendar,
        weather: v.weather,
        selection: v.selection,
        cities: v.cities.map((c) => ({
          id: c.id,
          poorPop: c.poorPop,
          wealthyPop: c.wealthyPop,
          richPop: c.richPop,
          mood: c.mood,
          playerReputation: c.playerReputation,
          stock: c.stock,
          kontorOwned: c.kontorOwned,
          kontorManager: c.kontorManager,
          kontorStock: c.kontorStock,
          kontorAvgCost: c.kontorAvgCost,
          businesses: c.businesses,
          shipyardOrder: c.shipyardOrder,
          tavernCaptain: c.tavernCaptain,
          playerHouses: c.playerHouses,
          hasWell: c.hasWell,
          hasHospital: c.hasHospital,
          wallLevel: c.wallLevel,
          isIced: c.isIced,
          famineDays: c.famineDays,
          plagueDays: c.plagueDays,
          mayorName: c.mayorName,
          playerIsMayor: c.playerIsMayor
        })),
        ships: v.ships.map((s) => ({
          shipId: s.shipId,
          name: s.name,
          shipClass: s.shipClass,
          owner: s.owner,
          captain: s.captain,
          x: s.x,
          z: s.z,
          heading: s.heading,
          hull: s.hull,
          maxHull: s.maxHull,
          cannons: s.cannons,
          crew: s.crew,
          cargo: s.cargo,
          cargoAvgCost: s.cargoAvgCost,
          navState: s.navState,
          dockedCityId: s.dockedCityId,
          targetCityId: s.targetCityId,
          waypoints: s.waypoints,
          waypointIndex: s.waypointIndex,
          autoTrade: s.autoTrade,
          bountyGold: s.bountyGold,
          combatCooldownDays: s.combatCooldownDays
        })),
        contracts: v.contracts,
        chronicle: {
          nextSeq:
            v.chronicle.length > 0 ? v.chronicle[v.chronicle.length - 1]!.seq + 1 : 1,
          entries: v.chronicle
        }
      }
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
        return true
      } catch {
        return false
      }
    },
    onLoadGame: () => {
      try {
        const raw = window.localStorage.getItem(SAVE_KEY)
        if (!raw) return false
        const parsed = JSON.parse(raw) as Partial<SavedCharter>
        if (
          !parsed.company ||
          !parsed.calendar ||
          !parsed.weather ||
          !parsed.selection ||
          !parsed.cities ||
          !parsed.ships
        ) {
          return false
        }
        dispatch({
          _tag: "RestoreCharter",
          company: parsed.company,
          calendar: parsed.calendar,
          weather: parsed.weather,
          selection: parsed.selection,
          cities: parsed.cities,
          ships: parsed.ships,
          contracts: parsed.contracts ?? [],
          chronicle: parsed.chronicle ?? { nextSeq: 1, entries: [] }
        })
        return true
      } catch {
        return false
      }
    }
  })
  hudRef = hud

  // Keyboard shortcuts (Pause [P], Speed [1/2/3], Map/Town [M]) without hijacking button Space/Enter
  window.addEventListener("keydown", (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLButtonElement
    ) {
      return
    }
    const v = runtime.inspect(ReadWorldView)

    if (e.key === "p" || e.key === "P") {
      dispatch({ _tag: "SetSpeed", speed: v.calendar.speed === 0 ? 1 : 0 })
    } else if (e.key === "1") {
      dispatch({ _tag: "SetSpeed", speed: 1 })
    } else if (e.key === "2") {
      dispatch({ _tag: "SetSpeed", speed: 2 })
    } else if (e.key === "3") {
      dispatch({ _tag: "SetSpeed", speed: 4 })
    } else if (e.key === "m" || e.key === "M") {
      dispatch({ _tag: "SetViewMode", viewMode: v.selection.viewMode === "sea" ? "town" : "sea" })
    }
  })

  const rafSource = FixedLoop.source((onTick) => {
    let rafId = 0
    let last = performance.now()
    const frame = (now: number) => {
      const deltaMS = Math.max(0, now - last)
      last = now
      onTick({ deltaMS })
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return { stop: () => cancelAnimationFrame(rafId) }
  })

  let lastFrameNow = performance.now()
  const loopRes = FixedLoop.start({
    source: rafSource,
    step: STEP,
    maxFrameSeconds: 0.25,
    maxStepsPerFrame: 6,
    update: () => runtime.tick(updateSchedule),
    render: () => {
      const now = performance.now()
      const dtSec = Math.min(0.1, Math.max(0.001, (now - lastFrameNow) / 1000))
      lastFrameNow = now

      const view = runtime.inspect(ReadWorldView)
      const latestCue = view.cues.length > 0 ? view.cues[view.cues.length - 1]!.seq : 0
      if (latestCue < lastCueSeq) {
        lastCueSeq = 0
      }
      for (const cue of view.cues) {
        if (cue.seq > lastCueSeq) {
          lastCueSeq = cue.seq
          audio.play(cue.kind)
        }
      }
      scene.sync(view)
      hud.sync(view)
      scene.renderFrame(dtSec)
    },
    onFailure: (failure) => {
      console.error("Simulation loop error:", failure)
    }
  })
  if (!loopRes.ok) {
    throw new Error(`Failed to start FixedLoop: ${String(loopRes.error)}`)
  }

  const initialView = runtime.inspect(ReadWorldView)
  scene.sync(initialView)
  hud.sync(initialView)
  const loading = document.getElementById("loading")
  if (loading) loading.classList.add("done")
}

bootstrap()
