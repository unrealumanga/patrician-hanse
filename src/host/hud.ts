import {
  BUSINESS_IDS,
  BUSINESSES,
  CANNON_COST,
  CAPTAIN_TRAITS,
  CITIES,
  CITY_IDS,
  cityProducesGood,
  DONATE_COST,
  FEAST_COST,
  GOODS,
  GUILD_ENTRY_COST,
  HOSPITAL_COST,
  HOUSE_BRICKS_COST,
  HOUSE_COST,
  HOUSE_TIMBER_COST,
  KONTOR_COST,
  KONTOR_MANAGER_WEEKLY_WAGE,
  MERCHANT_MARK_IDS,
  MERCHANT_MARKS,
  RANKS,
  SHIP_CLASS_IDS,
  SHIP_CLASSES,
  WELL_COST,
  type ActiveEventData,
  type BusinessId,
  type ChronicleEntry,
  type CityId,
  type CityView,
  type HanseIntent,
  type PanelTab,
  type ShipView,
  type SimSpeed,
  type WorldView
} from "../sim/index.ts"
import type { InklineThemeId } from "../render/palette.ts"

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const

export interface HudCallbacks {
  readonly dispatch: (intent: HanseIntent) => void
  readonly onFocusCity: (cityId: CityId) => void
  readonly onCycleTheme: () => InklineThemeId
  readonly onToggleMute: () => boolean
  readonly onSaveGame: () => boolean
  readonly onLoadGame: () => boolean
}

function fmtGold(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")}g`
}

function windCompassLabel(rad: number): string {
  const deg = (((rad * 180) / Math.PI) % 360 + 360) % 360
  const dirs = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"] as const
  return dirs[Math.round(deg / 45) % 8] ?? "E"
}

function describeEvent(ev: ActiveEventData): {
  readonly title: string
  readonly body: string
  readonly choiceA: string
  readonly choiceB: string
} {
  const city = CITIES[ev.cityId].name
  switch (ev.kind) {
    case "victualBrothers":
      return {
        title: "☠ Victual Brothers Raid near Visby",
        body: `Corsairs flying the Likedeelers banner threaten ${city}'s shipping lanes.`,
        choiceA: "Fund Patrol Convoy (-3,500g · +10 rep · Alderman deed)",
        choiceB: "Leave lanes unguarded (extra pirate spawns)"
      }
    case "herringShift":
      return {
        title: "🐟 Baltic Herring Shoals Shift",
        body: `Shoals have drifted from ${city}'s Sound. Fish prices are poised to spike.`,
        choiceA: "Send Salt Relief Barges (-2,400g · +8 rep)",
        choiceB: "Let prices surge (arbitrage opportunity!)"
      }
    case "soundBlockade":
      return {
        title: "⚓ Danish Sound Toll Dispute",
        body: `Danish customs demand higher tolls on ${city} merchant convoys.`,
        choiceA: "Pay Diplomatic Rebate (-3,000g · +9 rep)",
        choiceB: "Defy Crown (Grain & Wine scarcity)"
      }
    case "plagueSeason":
      return {
        title: "⚠ Pestilence Reported in " + city,
        body: `Surgeons request quarantine alms to protect ${city}'s workers and guild halls.`,
        choiceA: "Fund Quarantine & Alms (-3,200g · +11 rep)",
        choiceB: "Withhold funds (plague hits town)"
      }
    case "hanseaticDiet":
      return {
        title: "⚑ Hanseatic Diet Summons in " + city,
        body: `Envoys gather in ${city} to charter Baltic naval defense and trade privileges.`,
        choiceA: "Sponsor Diet Charter (-4,000g · +12 rep · Alderman deed)",
        choiceB: "Collect Merchant Rebate (+2,500g)"
      }
  }
}

function formatChronicle(e: ChronicleEntry): string {
  const city = e.cityId ? CITIES[e.cityId].name : ""
  const good = e.goodId ? GOODS[e.goodId].name : ""
  switch (e.tag) {
    case "founded":
      return `Trading house chartered in ${city}. Buy low, sail high!`
    case "arrived":
      return `${e.shipName ?? "Ship"} anchored in ${city}.`
    case "builtKontor":
      return `Established Hanseatic Kontor in ${city}.`
    case "builtBusiness":
      return `Scaffolding raised for ${good} workshop in ${city}.`
    case "businessReady":
      return `${good} workshop in ${city} completed & producing!`
    case "builtHouse":
      return `Built merchant gables in ${city}.`
    case "commissionedShip":
      return `Keel laid for ${e.shipName ?? "vessel"} at ${city} Werft.`
    case "shipLaunched":
      return `${e.shipName ?? "Vessel"} launched into ${city} harbor!`
    case "hiredCaptain":
      return `Hired captain for ${e.shipName ?? "vessel"} in ${city}.`
    case "pirateWin":
      return `${e.shipName ?? "Vessel"} defeated pirates! Bounty +${fmtGold(e.amount)}.`
    case "pirateLoss":
      return `Pirates raided ${e.shipName ?? "vessel"}! Lost ~${fmtGold(e.amount)}.`
    case "rankUp":
      return `Promoted to ${e.rankId ? RANKS[e.rankId].title : "new rank"}!`
    case "joinedGuild":
      return `Inducted into the Hanseatic Merchants' Guild.`
    case "contractDone":
      return `Fulfilled ${city} ${good || "bounty"} charter (+${fmtGold(e.amount)}).`
    case "electionWon":
      return `Elected Lord Mayor of ${city}!`
    case "electionLost":
      return `Lost the Mayoral seat in ${city}.`
    case "seasonChange":
      return `Season turned to ${(e.season ?? "spring").toUpperCase()}.`
    case "portFrozen":
      return `Winter ice has sealed ${city} harbor!`
    case "famine":
      return `Famine struck ${city}! Urgent demand for Grain & Fish.`
    case "feast":
      return `Hosted a Grand Feast in ${city}.`
    case "eventResolved":
      return `Hanseatic council decree enacted for ${city}.`
    case "victory":
      return `Crowned ALDERMAN OF THE HANSE in ${city}!`
    case "trade":
      return `Completed trade in ${city}.`
  }
}

export class HanseHud {
  private readonly callbacks: HudCallbacks
  private readonly root: HTMLDivElement

  private readonly goldVal: HTMLElement
  private readonly wealthVal: HTMLElement
  private readonly profitVal: HTMLElement
  private readonly dateVal: HTMLElement
  private readonly windVal: HTMLElement
  private readonly rankTitleEl: HTMLElement
  private readonly rankFillEl: HTMLElement
  private readonly rankHintEl: HTMLElement
  private readonly speedButtons = new Map<SimSpeed, HTMLButtonElement>()

  private readonly viewToggleBtn: HTMLButtonElement
  private readonly buildModeBtn: HTMLButtonElement
  private readonly markBtn: HTMLButtonElement
  private readonly themeBtn: HTMLButtonElement
  private readonly muteBtn: HTMLButtonElement
  private readonly drawerReopenBtn: HTMLButtonElement

  private readonly drawerCityName: HTMLElement
  private readonly drawerCitySub: HTMLElement
  private readonly drawerPills: HTMLElement
  private readonly drawerEnterBtn: HTMLButtonElement
  private readonly tabButtons = new Map<PanelTab, HTMLButtonElement>()
  private readonly drawerBody: HTMLDivElement

  private readonly chronicleBox: HTMLDivElement
  private readonly shipDockBar: HTMLDivElement
  private readonly eventFolio: HTMLDivElement
  private readonly sealToast: HTMLDivElement
  private readonly helpDialog: HTMLDialogElement
  private readonly victoryDialog: HTMLDialogElement

  private lastView: WorldView | null = null
  private lastViewMode: "sea" | "town" = "sea"
  private lastDrawerSig = ""
  private lastChronicleSeq = -1
  private lastShipBarSig = ""
  private lastRankShown = ""
  private lastEventShownKey = ""
  private tradeSourceMode: "ship" | "kontor" = "ship"
  private sealTimer: number | null = null
  private victoryShown = false

  // Persistent Market DOM references (in-place updates preserve focus & rapid clicking!)
  private marketContextKey = ""
  private marketRowRefs = new Map<
    string,
    {
      priceSpan: HTMLSpanElement
      stockSpan: HTMLSpanElement
      tickDiv: HTMLDivElement
      holdVal: HTMLElement
      pnlSpan: HTMLElement
      btns: ReadonlyArray<{ delta: number; btn: HTMLButtonElement }>
    }
  >()
  private marketHeaderLabel: HTMLSpanElement | null = null
  private marketXferContainer: HTMLDivElement | null = null

  constructor(parent: HTMLElement, callbacks: HudCallbacks) {
    this.callbacks = callbacks
    this.root = document.createElement("div")
    this.root.className = "hanse-hud"
    parent.appendChild(this.root)

    // 1. Unified Non-Overlapping Top Bar
    const topBar = document.createElement("div")
    topBar.className = "hud-top-bar"

    const topRow = document.createElement("div")
    topRow.className = "top-primary-row"

    const ledgerCard = document.createElement("div")
    ledgerCard.className = "ink-card ledger-bar"

    const mkCell = (label: string) => {
      const cell = document.createElement("div")
      cell.className = "ledger-cell"
      const sm = document.createElement("small")
      sm.textContent = label
      const b = document.createElement("b")
      cell.append(sm, b)
      ledgerCard.appendChild(cell)
      return b
    }

    this.goldVal = mkCell("Treasury")
    this.wealthVal = mkCell("Net Assets")
    this.profitVal = mkCell("Trade P&L")
    this.dateVal = mkCell("Hanseatic Calendar")
    this.windVal = mkCell("Wind")

    const speedWrap = document.createElement("div")
    speedWrap.className = "speed-bar"
    for (const [sp, lbl] of [
      [0, "❚❚"],
      [1, "1×"],
      [2, "2×"],
      [4, "4×"]
    ] as const) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "ink-btn mini"
      btn.textContent = lbl
      btn.setAttribute("aria-label", sp === 0 ? "Pause" : `Speed ${sp}x`)
      btn.addEventListener("click", () => this.callbacks.dispatch({ _tag: "SetSpeed", speed: sp }))
      this.speedButtons.set(sp, btn)
      speedWrap.appendChild(btn)
    }
    ledgerCard.appendChild(speedWrap)

    const actions = document.createElement("div")
    actions.className = "top-actions-cluster"

    this.viewToggleBtn = document.createElement("button")
    this.viewToggleBtn.type = "button"
    this.viewToggleBtn.className = "ink-btn primary"
    this.viewToggleBtn.textContent = "Enter Town (M)"
    this.viewToggleBtn.addEventListener("click", () => {
      if (!this.lastView) return
      const next = this.lastView.selection.viewMode === "sea" ? "town" : "sea"
      this.callbacks.dispatch({ _tag: "SetViewMode", viewMode: next })
    })

    this.buildModeBtn = document.createElement("button")
    this.buildModeBtn.type = "button"
    this.buildModeBtn.className = "ink-btn"
    this.buildModeBtn.textContent = "Build Plots"
    this.buildModeBtn.style.display = "none"
    this.buildModeBtn.addEventListener("click", () => {
      if (!this.lastView) return
      const next = !this.lastView.selection.buildMode
      this.callbacks.dispatch({ _tag: "ToggleBuildMode", enabled: next })
      if (next) {
        this.setDrawerCollapsed(false)
        this.callbacks.dispatch({ _tag: "SetActiveTab", tab: "kontor" })
      }
    })

    this.markBtn = document.createElement("button")
    this.markBtn.type = "button"
    this.markBtn.className = "ink-btn"
    this.markBtn.textContent = "✠ Mark"
    this.markBtn.title = "Cycle your Merchant's Mark (Hausmarke)"
    this.markBtn.addEventListener("click", () => {
      if (!this.lastView) return
      const idx = MERCHANT_MARK_IDS.indexOf(this.lastView.company.merchantMark)
      const next = MERCHANT_MARK_IDS[(idx + 1) % MERCHANT_MARK_IDS.length] ?? "cross"
      this.callbacks.dispatch({ _tag: "SetMerchantMark", mark: next })
      this.showSeal(`Mark: ${MERCHANT_MARKS[next].glyph} ${MERCHANT_MARKS[next].name}`)
    })

    this.themeBtn = document.createElement("button")
    this.themeBtn.type = "button"
    this.themeBtn.className = "ink-btn"
    this.themeBtn.textContent = "Sage"
    this.themeBtn.addEventListener("click", () => {
      const next = this.callbacks.onCycleTheme()
      this.themeBtn.textContent = next === "sage" ? "Sage" : next === "vellum" ? "Vellum" : "Cyan"
    })

    const saveBtn = document.createElement("button")
    saveBtn.type = "button"
    saveBtn.className = "ink-btn"
    saveBtn.textContent = "Save"
    saveBtn.addEventListener("click", () => {
      const ok = this.callbacks.onSaveGame()
      this.showSeal(ok ? "Charter Saved" : "Save Failed")
    })

    const loadBtn = document.createElement("button")
    loadBtn.type = "button"
    loadBtn.className = "ink-btn"
    loadBtn.textContent = "Load"
    loadBtn.addEventListener("click", () => {
      const ok = this.callbacks.onLoadGame()
      this.showSeal(ok ? "Charter Restored" : "No Saved Charter")
    })

    this.muteBtn = document.createElement("button")
    this.muteBtn.type = "button"
    this.muteBtn.className = "ink-btn"
    this.muteBtn.textContent = "🔊"
    this.muteBtn.setAttribute("aria-label", "Toggle Sound")
    this.muteBtn.addEventListener("click", () => {
      const muted = this.callbacks.onToggleMute()
      this.muteBtn.textContent = muted ? "🔇" : "🔊"
    })

    const helpBtn = document.createElement("button")
    helpBtn.type = "button"
    helpBtn.className = "ink-btn"
    helpBtn.textContent = "?"
    helpBtn.setAttribute("aria-label", "How to Play")
    helpBtn.addEventListener("click", () => this.helpDialog.showModal())

    actions.append(
      this.viewToggleBtn,
      this.buildModeBtn,
      this.markBtn,
      this.themeBtn,
      saveBtn,
      loadBtn,
      this.muteBtn,
      helpBtn
    )

    topRow.append(ledgerCard, actions)

    const rankCard = document.createElement("div")
    rankCard.className = "ink-card rank-strip"
    this.rankTitleEl = document.createElement("span")
    this.rankTitleEl.className = "rank-title"
    const track = document.createElement("div")
    track.className = "rank-bar-track"
    this.rankFillEl = document.createElement("div")
    this.rankFillEl.className = "rank-bar-fill"
    track.appendChild(this.rankFillEl)
    this.rankHintEl = document.createElement("span")
    this.rankHintEl.className = "rank-next-hint"
    rankCard.append(this.rankTitleEl, track, this.rankHintEl)

    topBar.append(topRow, rankCard)
    this.root.appendChild(topBar)

    // 2. Collapsible Drawer Reopen Tab (shows when drawer is tucked in Town 3D!)
    this.drawerReopenBtn = document.createElement("button")
    this.drawerReopenBtn.type = "button"
    this.drawerReopenBtn.className = "ink-btn primary drawer-reopen-tab"
    this.drawerReopenBtn.textContent = "◀ Open Ledger"
    this.drawerReopenBtn.addEventListener("click", () => this.setDrawerCollapsed(false))
    topRow.appendChild(this.drawerReopenBtn)

    // 3. Right City & Guild Ledger Drawer
    const drawer = document.createElement("aside")
    drawer.className = "ink-card ledger-drawer"

    const dHeader = document.createElement("div")
    dHeader.className = "drawer-header"
    const dTitleWrap = document.createElement("div")
    dTitleWrap.className = "drawer-title"
    this.drawerCityName = document.createElement("h2")
    this.drawerCitySub = document.createElement("div")
    this.drawerCitySub.className = "sub"
    this.drawerPills = document.createElement("div")
    this.drawerPills.className = "city-pill-row"
    dTitleWrap.append(this.drawerCityName, this.drawerCitySub, this.drawerPills)

    const headBtns = document.createElement("div")
    headBtns.className = "drawer-head-btns"

    this.drawerEnterBtn = document.createElement("button")
    this.drawerEnterBtn.type = "button"
    this.drawerEnterBtn.className = "ink-btn primary mini"
    this.drawerEnterBtn.textContent = "Town 3D"
    this.drawerEnterBtn.addEventListener("click", () => {
      if (!this.lastView) return
      const next = this.lastView.selection.viewMode === "sea" ? "town" : "sea"
      this.callbacks.dispatch({ _tag: "SetViewMode", viewMode: next })
    })

    const collapseBtn = document.createElement("button")
    collapseBtn.type = "button"
    collapseBtn.className = "ink-btn mini"
    collapseBtn.textContent = "▶"
    collapseBtn.setAttribute("aria-label", "Collapse Ledger")
    collapseBtn.addEventListener("click", () => this.setDrawerCollapsed(true))

    headBtns.append(this.drawerEnterBtn, collapseBtn)
    dHeader.append(dTitleWrap, headBtns)

    const tabBar = document.createElement("div")
    tabBar.className = "drawer-tabs"
    const tabDefs: ReadonlyArray<readonly [PanelTab, string]> = [
      ["market", "Market"],
      ["shipyard", "Werft"],
      ["kontor", "Kontor"],
      ["tavern", "Tavern"],
      ["guild", "Guild"],
      ["townhall", "Hall"],
      ["fleet", "Fleet"]
    ]
    for (const [tid, label] of tabDefs) {
      const tb = document.createElement("button")
      tb.type = "button"
      tb.className = "drawer-tab"
      tb.textContent = label
      tb.addEventListener("click", () => this.callbacks.dispatch({ _tag: "SetActiveTab", tab: tid }))
      this.tabButtons.set(tid, tb)
      tabBar.appendChild(tb)
    }

    this.drawerBody = document.createElement("div")
    this.drawerBody.className = "drawer-body"

    drawer.append(dHeader, tabBar, this.drawerBody)
    this.root.appendChild(drawer)

    // 4. Bottom-Left Ship Command Bar + Chronicle Log
    const bottomLeft = document.createElement("div")
    bottomLeft.className = "hud-bottom-left"

    this.chronicleBox = document.createElement("div")
    this.chronicleBox.className = "ink-card chronicle-box"

    this.shipDockBar = document.createElement("div")
    this.shipDockBar.className = "ink-card ship-dock-bar"

    bottomLeft.append(this.chronicleBox, this.shipDockBar)
    this.root.appendChild(bottomLeft)

    // 5. Interactive Historical Event Folio
    this.eventFolio = document.createElement("div")
    this.eventFolio.className = "event-folio"
    bottomLeft.prepend(this.eventFolio)

    // 6. Wax-Seal Toast Banner
    this.sealToast = document.createElement("div")
    this.sealToast.className = "seal-toast"
    this.root.appendChild(this.sealToast)

    // 7. Help Modal
    this.helpDialog = document.createElement("dialog")
    this.helpDialog.className = "ink-modal"
    this.helpDialog.innerHTML = `
      <div class="modal-inner">
        <h2>✠ Hanseatic Ledger · Rise of the Hanse</h2>
        <p>Begin as a humble Shopkeeper in <b>Lübeck (1370)</b> with one Snaikka and Captain Hinrik Castorp, and build a maritime empire to be crowned <b>Alderman of the Hanse</b>.</p>
        <ul class="hint-list">
          <li><b>Buy Low (▼), Sell High (▲):</b> Every commodity displays a min–max ink price scale plus your <b>average cost basis &amp; live profit/barrel</b>!</li>
          <li><b>Living 3D Waterfronts:</b> Double-click any port (or press <b>M</b>) to enter its unique 3D waterfront. Click the <b>Market, Kontor, Tavern, Werft, or Rathaus</b> directly in 3D! Buying/selling swings the harbor crane &amp; loads cargo onto your deck.</li>
          <li><b>Real Materials &amp; Timers:</b> Workshops &amp; vessels draw real Timber/Bricks/Cloth/Pitch and construct over days with 3D wooden scaffolding &amp; drydock hulls.</li>
          <li><b>Captains, Wind &amp; Winter Ice:</b> Hire named Captains in Taverns to unlock Auto-Trade loops. Wind direction boosts/slows voyages, and winter ice seals Riga &amp; Stockholm!</li>
          <li><b>Controls:</b> Drag to pan · Scroll to zoom · Shift+Drag to orbit · Right-click port to sail · P pause · 1/2/3 speed · M sea/town.</li>
        </ul>
        <div class="row-between">
          <button type="button" class="ink-btn danger" data-action="newgame">New Charter</button>
          <button type="button" class="ink-btn primary" data-action="close">Back to Chart</button>
        </div>
      </div>
    `
    this.helpDialog.addEventListener("click", (e) => {
      const target = e.target as HTMLElement
      if (target.dataset["action"] === "close") this.helpDialog.close()
      if (target.dataset["action"] === "newgame") {
        this.helpDialog.close()
        this.callbacks.dispatch({ _tag: "NewGame", seed: (Date.now() & 0xffffff) >>> 0 })
      }
    })
    this.root.appendChild(this.helpDialog)

    // 8. Victory Modal
    this.victoryDialog = document.createElement("dialog")
    this.victoryDialog.className = "ink-modal"
    this.victoryDialog.innerHTML = `
      <div class="modal-inner">
        <h2>⚑ ALDERMAN OF THE HANSE</h2>
        <p>The Hanseatic Diet in Lübeck has proclaimed your house supreme leader of the North and Baltic trade! Merchants from London to Riga salute your flags.</p>
        <div class="row-between">
          <button type="button" class="ink-btn" data-action="continue">Keep Trading</button>
          <button type="button" class="ink-btn primary" data-action="newgame">Start New Charter</button>
        </div>
      </div>
    `
    this.victoryDialog.addEventListener("click", (e) => {
      const target = e.target as HTMLElement
      if (target.dataset["action"] === "continue") {
        this.victoryDialog.close()
        this.callbacks.dispatch({ _tag: "ContinueAfterVictory" })
      }
      if (target.dataset["action"] === "newgame") {
        this.victoryDialog.close()
        this.victoryShown = false
        this.callbacks.dispatch({ _tag: "NewGame", seed: (Date.now() & 0xffffff) >>> 0 })
      }
    })
    this.victoryDialog.addEventListener("cancel", () => {
      this.callbacks.dispatch({ _tag: "ContinueAfterVictory" })
    })
    this.root.appendChild(this.victoryDialog)
  }

  public setDrawerCollapsed(collapsed: boolean): void {
    this.root.classList.toggle("drawer-collapsed", collapsed)
  }

  public openLedgerTab(tab: PanelTab): void {
    this.setDrawerCollapsed(false)
    this.callbacks.dispatch({ _tag: "SetActiveTab", tab })
  }

  public showSeal(text: string): void {
    this.sealToast.textContent = `✦ ${text} ✦`
    this.sealToast.classList.add("show")
    if (this.sealTimer !== null) window.clearTimeout(this.sealTimer)
    this.sealTimer = window.setTimeout(() => {
      this.sealToast.classList.remove("show")
    }, 2600)
  }

  public sync(view: WorldView): void {
    this.lastView = view

    // Auto-collapse drawer when arriving in Town 3D so the waterfront gets full architectural framing!
    if (view.selection.viewMode !== this.lastViewMode) {
      this.lastViewMode = view.selection.viewMode
      if (view.selection.viewMode === "town") {
        this.setDrawerCollapsed(true)
      } else {
        this.setDrawerCollapsed(false)
      }
    }

    if (this.lastRankShown && this.lastRankShown !== view.company.rank) {
      this.showSeal(`Promoted: ${RANKS[view.company.rank].title}`)
    }
    this.lastRankShown = view.company.rank

    if (view.phase === "Victory") {
      if (!this.victoryShown) {
        this.victoryShown = true
        this.victoryDialog.showModal()
      }
    } else {
      this.victoryShown = false
    }

    const markDef = MERCHANT_MARKS[view.company.merchantMark]
    this.markBtn.textContent = `${markDef.glyph} Mark`

    // 1. Update Top Ledger Bar
    this.goldVal.textContent = fmtGold(view.company.gold)
    this.wealthVal.textContent = fmtGold(view.totalWealth)
    const pnl = view.company.totalTradeProfit
    this.profitVal.textContent = `${pnl >= 0 ? "+" : ""}${fmtGold(pnl)}`
    this.profitVal.className = pnl > 0 ? "pos" : pnl < 0 ? "neg" : ""

    const mStr = MONTHS[(view.calendar.month - 1) % 12] ?? "MAY"
    this.dateVal.textContent = `${String(view.calendar.dayOfMonth).padStart(2, "0")} ${mStr} ${view.calendar.year} · ${view.calendar.season.toUpperCase()}`
    this.windVal.textContent = `${windCompassLabel(view.weather.windAngle)} ${Math.round(view.weather.windStrength * 18)}kt${view.weather.stormIntensity > 0.35 ? " ⛈" : ""}`

    for (const [sp, btn] of this.speedButtons.entries()) {
      btn.classList.toggle("active", view.calendar.speed === sp)
    }

    // Rank Ledger Header
    const curRank = RANKS[view.company.rank]
    if (view.nextRank) {
      const pct = Math.min(
        100,
        Math.round((view.totalWealth / Math.max(1, view.nextRank.minWealth)) * 100)
      )
      this.rankTitleEl.textContent = `${markDef.glyph} ${curRank.title} → ${view.nextRank.title}`
      this.rankFillEl.style.width = `${pct}%`
      const reqs: Array<string> = [`${Math.round(view.nextRank.minWealth / 1000)}k assets`]
      if (view.nextRank.minHomeRep > 0) reqs.push(`${view.nextRank.minHomeRep}% rep`)
      if (view.nextRank.minShips > 1) reqs.push(`${view.nextRank.minShips} ships`)
      if (view.nextRank.requiresGuild && !view.company.guildMember) reqs.push("Guild")
      if (view.nextRank.minKontors > 1) reqs.push(`${view.nextRank.minKontors} kontors`)
      if (view.nextRank.minBusinesses > 0) reqs.push(`${view.nextRank.minBusinesses} biz`)
      if (view.nextRank.requiresMayor) reqs.push("Mayor")
      this.rankHintEl.textContent = `${pct}% · need: ${reqs.join(", ")} (Sunday review)`
    } else {
      this.rankTitleEl.textContent = `⚑ ${curRank.title}`
      this.rankFillEl.style.width = "100%"
      this.rankHintEl.textContent = "Supreme Leader of the Hanse"
    }

    const inTown = view.selection.viewMode === "town"
    this.viewToggleBtn.textContent = inTown ? "← Sea Chart (M)" : "Enter Town (M)"
    this.drawerEnterBtn.textContent = inTown ? "Sea Chart" : "Town 3D"
    this.buildModeBtn.style.display = inTown ? "inline-flex" : "none"
    this.buildModeBtn.classList.toggle("active", view.selection.buildMode)

    // 2. Selected City Header
    const city = view.cities.find((c) => c.id === view.selection.selectedCityId) ?? view.cities[0]
    if (!city) return

    this.drawerCityName.textContent = `${city.kontorOwned ? `${markDef.glyph} ` : ""}${city.name}`
    this.drawerCitySub.textContent = `${city.landmarkLabel} · Pop ${city.totalPop.toLocaleString("en-US")} · Rep ${Math.round(city.playerReputation)}%`
    this.drawerPills.innerHTML = [
      `<span class="pill ${city.mood >= 65 ? "green" : city.mood < 42 ? "red" : ""}">Mood ${Math.round(city.mood)}%</span>`,
      city.kontorOwned ? `<span class="pill blue">Kontor</span>` : `<span class="pill">No Kontor</span>`,
      city.isIced ? `<span class="pill blue">❄ Sealed by Ice</span>` : "",
      city.famineDays > 0 ? `<span class="pill red">⚠ Famine</span>` : "",
      city.plagueDays > 0 ? `<span class="pill red">⚠ Plague</span>` : "",
      city.playerIsMayor ? `<span class="pill green">★ Mayor</span>` : ""
    ].join("")

    for (const [tid, btn] of this.tabButtons.entries()) {
      btn.classList.toggle("active", view.selection.activeTab === tid)
    }

    // 3. Render Active Drawer Tab
    const selectedShip =
      view.selection.selectedShipId !== null
        ? view.ships.find((s) => s.shipId === view.selection.selectedShipId) ?? null
        : null
    const dockedShipInCity =
      selectedShip && selectedShip.owner === "player" && selectedShip.dockedCityId === city.id
        ? selectedShip
        : view.ships.find((s) => s.owner === "player" && s.dockedCityId === city.id) ?? null

    const drawerSig = this.computeDrawerSig(view, city, dockedShipInCity)
    if (drawerSig !== this.lastDrawerSig) {
      this.lastDrawerSig = drawerSig
      this.renderDrawerTab(view, city, dockedShipInCity)
    }

    // 4. Interactive Historical Event Folio
    const activeEv = view.company.activeEvent
    const eventCostMap: Record<ActiveEventData["kind"], number> = {
      victualBrothers: 3500,
      herringShift: 2400,
      soundBlockade: 3000,
      plagueSeason: 3200,
      hanseaticDiet: 4000
    }
    if (activeEv) {
      const canAffordA = view.company.gold >= eventCostMap[activeEv.kind]
      const evKey = `${activeEv.eventId}|${activeEv.kind}|${activeEv.cityId}|${canAffordA}`
      if (evKey !== this.lastEventShownKey) {
        this.lastEventShownKey = evKey
        const d = describeEvent(activeEv)
        this.eventFolio.innerHTML = ""
        const h = document.createElement("h3")
        h.textContent = d.title
        const p = document.createElement("p")
        p.textContent = d.body
        const row = document.createElement("div")
        row.className = "event-choices"

        const btnA = document.createElement("button")
        btnA.type = "button"
        btnA.className = "ink-btn primary"
        btnA.textContent = d.choiceA
        btnA.disabled = !canAffordA
        btnA.addEventListener("click", () =>
          this.callbacks.dispatch({ _tag: "ResolveEvent", choice: "a" })
        )

        const btnB = document.createElement("button")
        btnB.type = "button"
        btnB.className = "ink-btn"
        btnB.textContent = d.choiceB
        btnB.addEventListener("click", () =>
          this.callbacks.dispatch({ _tag: "ResolveEvent", choice: "b" })
        )

        row.append(btnA, btnB)
        this.eventFolio.append(h, p, row)
        this.eventFolio.classList.add("open")
      }
    } else {
      this.lastEventShownKey = ""
      this.eventFolio.classList.remove("open")
    }

    // 5. Chronicle Margin Log
    const latestSeq = view.chronicle.length > 0 ? view.chronicle[view.chronicle.length - 1]!.seq : 0
    if (latestSeq !== this.lastChronicleSeq) {
      this.lastChronicleSeq = latestSeq
      const recent = view.chronicle.slice(-5).reverse()
      this.chronicleBox.innerHTML = recent
        .map((e) => {
          const m = MONTHS[(e.month - 1) % 12] ?? "MAY"
          return `<div class="chronicle-line"><span class="chronicle-date">${String(e.day).padStart(2, "0")} ${m}</span><span>${formatChronicle(e)}</span></div>`
        })
        .join("")
    }

    // 6. Bottom-Left Ship Command Bar
    const shipSig = selectedShip
      ? `${selectedShip.shipId}|${selectedShip.navState}|${selectedShip.dockedCityId}|${selectedShip.targetCityId}|${selectedShip.usedCargo}|${selectedShip.hull}|${selectedShip.cannons}|${selectedShip.captain?.name ?? "none"}|${selectedShip.autoTrade.enabled}|${city.id}|${city.isIced}`
      : `none|${view.ships.filter((s) => s.owner === "player").length}`
    if (shipSig !== this.lastShipBarSig) {
      this.lastShipBarSig = shipSig
      this.renderShipBar(view, selectedShip, city)
    }
  }

  private computeDrawerSig(view: WorldView, city: CityView, dockedShip: ShipView | null): string {
    const tab = view.selection.activeTab
    const base = `${tab}|${city.id}|${view.selection.selectedShipId ?? "none"}|${dockedShip?.shipId ?? "none"}|${Math.floor(view.company.gold)}|${view.company.debt}|${view.company.guildMember}|${city.kontorOwned}|${city.kontorManager}|${city.businesses.map((b) => `${b.id}:${b.buildDaysLeft}`).join(",")}|${city.playerHouses}|${city.hasWell}|${city.hasHospital}|${city.shipyardOrder?.daysLeft ?? -1}|${city.tavernCaptain?.name ?? "none"}|${Math.round(city.playerReputation)}|${this.tradeSourceMode}`
    if (tab === "market") {
      const mSig = city.market
        .map((m) => `${m.stock}:${m.kontorStock}:${dockedShip ? dockedShip.cargo[m.goodId] : 0}:${dockedShip ? dockedShip.cargoAvgCost[m.goodId] : 0}:${m.buyPrice}`)
        .join(",")
      return `${base}|${dockedShip?.usedCargo ?? 0}|${mSig}`
    }
    if (tab === "fleet" || tab === "shipyard" || tab === "tavern") {
      const sSig = view.ships
        .filter((s) => s.owner === "player")
        .map((s) => `${s.shipId}:${s.dockedCityId}:${s.targetCityId}:${s.hull}:${s.cannons}:${s.usedCargo}:${s.captain?.name ?? "none"}:${s.autoTrade.enabled}:${s.autoTrade.stops.join("-")}`)
        .join("|")
      return `${base}|${sSig}`
    }
    if (tab === "guild") {
      const cSig = view.contracts.map((c) => `${c.contractId}:${c.accepted}:${c.deliveredAmount}:${c.completed}`).join(",")
      return `${base}|${cSig}|${dockedShip?.usedCargo ?? 0}`
    }
    return `${base}|${view.calendar.totalDays}`
  }

  private renderDrawerTab(view: WorldView, city: CityView, dockedShip: ShipView | null): void {
    const tab = view.selection.activeTab

    if (tab === "market") {
      this.renderMarketTab(city, dockedShip)
      return
    }

    this.marketContextKey = ""
    this.marketRowRefs.clear()
    this.marketHeaderLabel = null
    this.marketXferContainer = null
    this.drawerBody.innerHTML = ""

    if (tab === "shipyard") {
      this.renderShipyardTab(view, city, dockedShip)
    } else if (tab === "kontor") {
      this.renderKontorTab(view, city)
    } else if (tab === "tavern") {
      this.renderTavernTab(view, city, dockedShip)
    } else if (tab === "guild") {
      this.renderGuildTab(view, city, dockedShip)
    } else if (tab === "townhall") {
      this.renderTownHallTab(view, city)
    } else if (tab === "fleet") {
      this.renderFleetTab(view)
    }
  }

  private renderMarketTab(city: CityView, dockedShip: ShipView | null): void {
    const hasShip = dockedShip !== null
    const hasKontor = city.kontorOwned
    if (this.tradeSourceMode === "ship" && !hasShip && hasKontor) {
      this.tradeSourceMode = "kontor"
    } else if (this.tradeSourceMode === "kontor" && !hasKontor && hasShip) {
      this.tradeSourceMode = "ship"
    }

    const shipIdForTrade = this.tradeSourceMode === "ship" && dockedShip ? dockedShip.shipId : null
    const canTrade =
      (this.tradeSourceMode === "ship" && dockedShip !== null) ||
      (this.tradeSourceMode === "kontor" && city.kontorOwned)

    const ctxKey = `${city.id}|${dockedShip?.shipId ?? "none"}|${dockedShip?.name ?? ""}|${hasShip}|${hasKontor}|${this.tradeSourceMode}`
    if (ctxKey !== this.marketContextKey) {
      this.marketContextKey = ctxKey
      this.marketRowRefs.clear()
      this.drawerBody.innerHTML = ""

      const bar = document.createElement("div")
      bar.className = "trade-source-bar"
      const label = document.createElement("span")
      this.marketHeaderLabel = label
      bar.appendChild(label)

      if (hasShip && hasKontor) {
        const sw = document.createElement("button")
        sw.type = "button"
        sw.className = "ink-btn mini primary"
        sw.textContent = this.tradeSourceMode === "ship" ? "Use Kontor" : "Use Ship"
        sw.addEventListener("click", () => {
          this.tradeSourceMode = this.tradeSourceMode === "ship" ? "kontor" : "ship"
          this.lastDrawerSig = ""
          if (this.lastView) this.sync(this.lastView)
        })
        bar.appendChild(sw)
      }
      this.drawerBody.appendChild(bar)

      const list = document.createElement("div")
      list.className = "section-card"
      list.style.padding = "2px 5px"

      for (const row of city.market) {
        const def = GOODS[row.goodId]
        const el = document.createElement("div")
        el.className = "market-row"

        const prodMark =
          row.productionTier === "primary" ? "★★" : row.productionTier === "secondary" ? "★" : ""
        const goodDiv = document.createElement("div")
        goodDiv.className = "good-cell"
        goodDiv.innerHTML = `
          <span class="good-code"><span class="good-dot" style="background:${def.accentHex}"></span>${def.shortName}</span>
          <span class="good-sub">${def.name} ${prodMark}</span>
        `

        const span = Math.max(1, def.maxPrice - def.minPrice)
        const midPct = ((def.basePrice - def.minPrice) / span) * 100

        const priceDiv = document.createElement("div")
        priceDiv.className = "price-scale-cell"
        const priceNums = document.createElement("div")
        priceNums.className = "price-nums"
        const priceSpan = document.createElement("span")
        const stockSpan = document.createElement("span")
        stockSpan.style.color = "var(--ink-muted)"
        priceNums.append(priceSpan, stockSpan)

        const scaleBar = document.createElement("div")
        scaleBar.className = "price-scale-bar"
        scaleBar.title = `Min ${def.minPrice}g · Base ${def.basePrice}g · Max ${def.maxPrice}g`
        const midLine = document.createElement("div")
        midLine.className = "price-scale-mid"
        midLine.style.left = `${midPct}%`
        const tickDiv = document.createElement("div")
        tickDiv.className = "price-scale-tick"
        scaleBar.append(midLine, tickDiv)
        priceDiv.append(priceNums, scaleBar)

        const holdDiv = document.createElement("div")
        holdDiv.className = "hold-cell"
        const holdVal = document.createElement("b")
        const br = document.createElement("br")
        const pnlSpan = document.createElement("span")
        holdDiv.append(holdVal, br, pnlSpan)

        const btnDiv = document.createElement("div")
        btnDiv.className = "trade-btns"
        const btns: Array<{ delta: number; btn: HTMLButtonElement }> = []
        const tradeOps: ReadonlyArray<readonly [string, number]> = [
          ["-10", -10],
          ["-1", -1],
          ["+1", 1],
          ["+10", 10]
        ]
        for (const [lbl, delta] of tradeOps) {
          const b = document.createElement("button")
          b.type = "button"
          b.className = `ink-btn mini ${delta > 0 ? "primary" : ""}`
          b.textContent = lbl
          b.setAttribute("aria-label", `${delta > 0 ? "Buy" : "Sell"} ${Math.abs(delta)} ${def.name}`)
          b.addEventListener("click", () => {
            this.callbacks.dispatch({
              _tag: "TradeMarket",
              cityId: city.id,
              shipId: shipIdForTrade,
              goodId: row.goodId,
              delta
            })
          })
          btns.push({ delta, btn: b })
          btnDiv.appendChild(b)
        }

        this.marketRowRefs.set(row.goodId, {
          priceSpan,
          stockSpan,
          tickDiv,
          holdVal,
          pnlSpan,
          btns
        })
        el.append(goodDiv, priceDiv, holdDiv, btnDiv)
        list.appendChild(el)
      }

      this.drawerBody.appendChild(list)

      if (dockedShip && city.kontorOwned) {
        const xfer = document.createElement("div")
        xfer.className = "section-card"
        const title = document.createElement("h3")
        title.textContent = `Kontor ⇄ ${dockedShip.name}`
        const rowWrap = document.createElement("div")
        rowWrap.style.display = "flex"
        rowWrap.style.flexWrap = "wrap"
        rowWrap.style.gap = "4px"
        xfer.append(title, rowWrap)
        this.marketXferContainer = rowWrap
        this.drawerBody.appendChild(xfer)
      } else {
        this.marketXferContainer = null
      }
    }

    if (this.marketHeaderLabel) {
      if (!hasShip && !hasKontor) {
        this.marketHeaderLabel.textContent = `No ship or Kontor in ${city.name}.`
      } else if (this.tradeSourceMode === "ship" && dockedShip) {
        this.marketHeaderLabel.textContent = `Ship: ${dockedShip.name} (${dockedShip.usedCargo}/${dockedShip.capacity})`
      } else {
        this.marketHeaderLabel.textContent = `Kontor Warehouse (${city.name})`
      }
    }

    const capTradeBonus =
      this.tradeSourceMode === "ship" && dockedShip?.captain
        ? CAPTAIN_TRAITS[dockedShip.captain.trait].tradeBonus
        : 0

    for (const row of city.market) {
      const ref = this.marketRowRefs.get(row.goodId)
      if (!ref) continue
      const def = GOODS[row.goodId]
      const effBuy = Math.max(1, Math.round(row.buyPrice * (1 - capTradeBonus * 0.5)))
      const effSell = Math.round(row.sellPrice * (1 + capTradeBonus * 0.5))
      const span = Math.max(1, def.maxPrice - def.minPrice)
      const pct = Math.max(3, Math.min(97, ((effBuy - def.minPrice) / span) * 100))
      const sigClass =
        row.priceSignal === "cheap"
          ? "sig-cheap"
          : row.priceSignal === "scarce"
            ? "sig-scarce"
            : row.priceSignal === "pricey"
              ? "sig-pricey"
              : ""
      const sigArrow =
        row.priceSignal === "cheap"
          ? "▼"
          : row.priceSignal === "scarce"
            ? "▲▲"
            : row.priceSignal === "pricey"
              ? "▲"
              : ""

      ref.priceSpan.className = sigClass
      ref.priceSpan.textContent = `${effBuy}g${sigArrow}`
      ref.stockSpan.textContent = `${row.stock}u`
      ref.tickDiv.className = `price-scale-tick ${row.priceSignal}`
      ref.tickDiv.style.left = `${pct}%`

      const shipUnits = dockedShip ? dockedShip.cargo[row.goodId] : 0
      const shipAvg = dockedShip ? dockedShip.cargoAvgCost[row.goodId] : 0
      const myUnits = this.tradeSourceMode === "ship" ? shipUnits : row.kontorStock
      const myAvg = this.tradeSourceMode === "ship" ? shipAvg : row.kontorAvgCost

      ref.holdVal.textContent = `${myUnits}u`
      if (myUnits > 0 && myAvg > 0) {
        const diff = Math.round(effSell - myAvg)
        ref.pnlSpan.style.color = ""
        ref.pnlSpan.className = diff >= 0 ? "pnl-pos" : "pnl-neg"
        ref.pnlSpan.textContent = `${diff >= 0 ? "+" : ""}${diff}g`
        ref.pnlSpan.title = `Avg cost ${Math.round(myAvg)}g · Sell ${effSell}g`
      } else {
        ref.pnlSpan.className = ""
        ref.pnlSpan.style.color = "var(--ink-muted)"
        ref.pnlSpan.textContent = this.tradeSourceMode === "ship" ? "hold" : "wh"
      }

      for (const { delta, btn } of ref.btns) {
        btn.disabled = !canTrade || (delta < 0 && myUnits <= 0) || (delta > 0 && row.stock <= 0)
      }
    }

    if (this.marketXferContainer && dockedShip && city.kontorOwned) {
      const rowWrap = this.marketXferContainer
      rowWrap.innerHTML = ""
      let anyItems = false
      for (const row of city.market) {
        const shipUnits = dockedShip.cargo[row.goodId]
        if (row.kontorStock > 0) {
          anyItems = true
          const loadBtn = document.createElement("button")
          loadBtn.type = "button"
          loadBtn.className = "ink-btn mini primary"
          loadBtn.textContent = `Load ${GOODS[row.goodId].shortName} (${row.kontorStock})`
          loadBtn.addEventListener("click", () =>
            this.callbacks.dispatch({
              _tag: "TransferKontor",
              cityId: city.id,
              shipId: dockedShip.shipId,
              goodId: row.goodId,
              delta: 50
            })
          )
          rowWrap.appendChild(loadBtn)
        }
        if (shipUnits > 0) {
          anyItems = true
          const unloadBtn = document.createElement("button")
          unloadBtn.type = "button"
          unloadBtn.className = "ink-btn mini"
          unloadBtn.textContent = `Store ${GOODS[row.goodId].shortName} (${shipUnits})`
          unloadBtn.addEventListener("click", () =>
            this.callbacks.dispatch({
              _tag: "TransferKontor",
              cityId: city.id,
              shipId: dockedShip.shipId,
              goodId: row.goodId,
              delta: -50
            })
          )
          rowWrap.appendChild(unloadBtn)
        }
      }
      if (!anyItems) {
        rowWrap.textContent = "Stock goods in ship or Kontor to transfer."
      }
    }
  }

  private renderShipyardTab(view: WorldView, city: CityView, dockedShip: ShipView | null): void {
    if (dockedShip) {
      const svc = document.createElement("div")
      svc.className = "section-card"
      svc.innerHTML = `<h3>Docked: ${dockedShip.name} (${dockedShip.className})</h3>`
      const stats = document.createElement("div")
      stats.className = "row-between"
      stats.innerHTML = `<span>Hull ${dockedShip.hull}/${dockedShip.maxHull}</span><span>Cannons ${dockedShip.cannons}/${dockedShip.maxCannons}</span>`
      svc.appendChild(stats)

      const acts = document.createElement("div")
      acts.className = "row-between"
      const repBtn = document.createElement("button")
      repBtn.type = "button"
      repBtn.className = "ink-btn primary"
      repBtn.textContent =
        dockedShip.repairCost > 0 ? `Repair (${fmtGold(dockedShip.repairCost)})` : "Hull Sound"
      repBtn.disabled = dockedShip.repairCost <= 0 || view.company.gold < dockedShip.repairCost
      repBtn.addEventListener("click", () =>
        this.callbacks.dispatch({ _tag: "RepairShip", shipId: dockedShip.shipId })
      )

      const armBtn = document.createElement("button")
      armBtn.type = "button"
      armBtn.className = "ink-btn"
      armBtn.textContent = `+2 Cannons (${fmtGold(CANNON_COST * 2)})`
      armBtn.disabled =
        dockedShip.cannons >= dockedShip.maxCannons || view.company.gold < CANNON_COST * 2
      armBtn.addEventListener("click", () =>
        this.callbacks.dispatch({ _tag: "ArmShip", shipId: dockedShip.shipId, cannonsToAdd: 2 })
      )

      acts.append(repBtn, armBtn)
      svc.appendChild(acts)
      this.drawerBody.appendChild(svc)
    }

    if (city.shipyardOrder) {
      const ordCard = document.createElement("div")
      ordCard.className = "section-card"
      ordCard.innerHTML = `
        <h3>Drydock Active</h3>
        <div class="row-between">
          <b>${city.shipyardOrder.name} (${SHIP_CLASSES[city.shipyardOrder.shipClass].name})</b>
          <span class="pill blue">${city.shipyardOrder.daysLeft}d left</span>
        </div>
      `
      this.drawerBody.appendChild(ordCard)
    }

    const buildCard = document.createElement("div")
    buildCard.className = "section-card"
    buildCard.innerHTML = `<h3>Commission Vessel in ${city.name}</h3>`

    for (const cid of SHIP_CLASS_IDS) {
      const cls = SHIP_CLASSES[cid]
      const matText = cls.materials.map((m) => `${m.amount} ${GOODS[m.good].shortName}`).join(" · ")
      const row = document.createElement("div")
      row.className = "biz-row"
      row.innerHTML = `
        <div>
          <b>${cls.name}</b> <span style="color:var(--ink-muted)">${cls.capacity} cap · ${cls.buildDays}d</span>
          <div style="font-size:9.5px;color:var(--ink-muted)">Materials: ${matText}</div>
        </div>
      `
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "ink-btn primary mini"
      btn.textContent = `${fmtGold(cls.goldCost)}+`
      btn.disabled = city.shipyardOrder !== null || view.company.gold < cls.goldCost
      btn.addEventListener("click", () =>
        this.callbacks.dispatch({ _tag: "CommissionShip", cityId: city.id, shipClass: cid })
      )
      row.appendChild(btn)
      buildCard.appendChild(row)
    }
    this.drawerBody.appendChild(buildCard)
  }

  private renderKontorTab(view: WorldView, city: CityView): void {
    const kCard = document.createElement("div")
    kCard.className = "section-card"
    if (!city.kontorOwned) {
      kCard.innerHTML = `
        <h3>Establish Trading Office (Kontor)</h3>
        <p style="margin:0;font-size:10.5px;color:var(--ink-muted)">
          Owning a Kontor in ${city.name} unlocks local warehouse storage, a Kontor Administrator, private workshops, and merchant houses.
        </p>
      `
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "ink-btn primary"
      btn.textContent = `Build Kontor (${fmtGold(KONTOR_COST)})`
      btn.disabled = view.company.gold < KONTOR_COST
      btn.addEventListener("click", () =>
        this.callbacks.dispatch({ _tag: "BuildKontor", cityId: city.id })
      )
      kCard.appendChild(btn)
      this.drawerBody.appendChild(kCard)
      return
    }

    kCard.innerHTML = `
      <h3>${city.name} Kontor &amp; Housing <span>${city.businesses.length}/12 plots</span></h3>
      <div class="row-between">
        <span>Merchant Houses: <b>${city.playerHouses}/10</b> (+340g/wk)</span>
      </div>
    `
    const actRow = document.createElement("div")
    actRow.className = "row-between"

    const hBtn = document.createElement("button")
    hBtn.type = "button"
    hBtn.className = "ink-btn primary mini"
    hBtn.textContent = `House (${fmtGold(HOUSE_COST)} + ${HOUSE_TIMBER_COST}T/${HOUSE_BRICKS_COST}B)`
    hBtn.disabled = city.playerHouses >= 10 || view.company.gold < HOUSE_COST
    hBtn.addEventListener("click", () =>
      this.callbacks.dispatch({ _tag: "BuildHouse", cityId: city.id })
    )

    const mgrBtn = document.createElement("button")
    mgrBtn.type = "button"
    mgrBtn.className = `ink-btn mini ${city.kontorManager ? "active" : ""}`
    mgrBtn.textContent = city.kontorManager
      ? `Manager: ON (${KONTOR_MANAGER_WEEKLY_WAGE}g/wk)`
      : `Hire Manager (${KONTOR_MANAGER_WEEKLY_WAGE}g/wk)`
    mgrBtn.addEventListener("click", () =>
      this.callbacks.dispatch({ _tag: "ToggleKontorManager", cityId: city.id })
    )

    actRow.append(hBtn, mgrBtn)
    kCard.appendChild(actRow)
    this.drawerBody.appendChild(kCard)

    const bCard = document.createElement("div")
    bCard.className = "section-card"
    bCard.innerHTML = `<h3>Construct Production Workshop (uses Kontor/Market TMB &amp; BRK)</h3>`
    const grid = document.createElement("div")
    grid.className = "biz-grid"

    for (const bid of BUSINESS_IDS) {
      const def = BUSINESSES[bid]
      const tier = cityProducesGood(city.id, def.outputGood)
      const effPct = tier === "primary" ? 100 : tier === "secondary" ? 78 : 55
      const count = city.businesses.filter((b) => b.type === bid).length
      const building = city.businesses.filter((b) => b.type === bid && b.buildDaysLeft > 0).length
      const inputsStr =
        def.inputGoods.length > 0
          ? `uses ${def.inputGoods.map((i) => `${i.amount} ${GOODS[i.good].shortName}`).join("+")}`
          : "raw harvest"

      const row = document.createElement("div")
      row.className = "biz-row"
      row.innerHTML = `
        <div>
          <b>${def.name}</b> ${count > 0 ? `<span class="pill blue">×${count}${building > 0 ? ` (${building} bld)` : ""}</span>` : ""}
          <div style="font-size:9.5px;color:var(--ink-muted)">
            +${Math.round((def.weeklyOutput * effPct) / 100)} ${GOODS[def.outputGood].shortName}/wk (${effPct}%) · ${def.timberCost}T/${def.bricksCost}B · ${def.buildDays}d · ${inputsStr}
          </div>
        </div>
      `
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = `ink-btn mini ${tier === "primary" ? "primary" : ""}`
      btn.textContent = fmtGold(def.goldCost)
      btn.disabled = city.businesses.length >= 12 || view.company.gold < def.goldCost
      btn.addEventListener("click", () =>
        this.callbacks.dispatch({
          _tag: "BuildBusiness",
          cityId: city.id,
          businessId: bid as BusinessId
        })
      )
      row.appendChild(btn)
      grid.appendChild(row)
    }

    bCard.appendChild(grid)
    this.drawerBody.appendChild(bCard)
  }

  private renderTavernTab(view: WorldView, city: CityView, dockedShip: ShipView | null): void {
    const tCard = document.createElement("div")
    tCard.className = "section-card"
    tCard.innerHTML = `<h3>${city.name} Sailors' Tavern</h3>`

    if (!city.tavernCaptain) {
      tCard.innerHTML += `<p style="margin:0;font-size:11px;color:var(--ink-muted)">No captains seeking berth here today. Check back next week or visit another port.</p>`
    } else {
      const cap = city.tavernCaptain
      const tDef = CAPTAIN_TRAITS[cap.trait]
      const row = document.createElement("div")
      row.className = "biz-row"
      row.innerHTML = `
        <div>
          <b>Capt. ${cap.name}</b> <span class="pill blue">${tDef.name}</span>
          <div style="font-size:10px;color:var(--ink-muted)">${tDef.summary} · Required for Auto-Trade loops</div>
        </div>
      `
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "ink-btn primary mini"
      btn.textContent = dockedShip ? `Hire (${fmtGold(cap.hireCost)})` : "Dock Ship"
      btn.disabled = !dockedShip || view.company.gold < cap.hireCost
      btn.addEventListener("click", () => {
        if (!dockedShip) return
        this.callbacks.dispatch({
          _tag: "HireCaptain",
          cityId: city.id,
          shipId: dockedShip.shipId
        })
      })
      row.appendChild(btn)
      tCard.appendChild(row)
    }
    this.drawerBody.appendChild(tCard)
  }

  private renderGuildTab(view: WorldView, city: CityView, dockedShip: ShipView | null): void {
    const gCard = document.createElement("div")
    gCard.className = "section-card"
    if (!view.company.guildMember) {
      gCard.innerHTML = `
        <h3>Hanseatic Merchants' Guild</h3>
        <p style="margin:0;font-size:10.5px;color:var(--ink-muted)">
          Guild membership is required to rise above Merchant rank and stand for Lord Mayor &amp; Alderman.
        </p>
      `
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "ink-btn primary"
      btn.textContent = `Join Merchants' Guild (${fmtGold(GUILD_ENTRY_COST)})`
      btn.disabled = view.company.gold < GUILD_ENTRY_COST
      btn.addEventListener("click", () => this.callbacks.dispatch({ _tag: "JoinGuild" }))
      gCard.appendChild(btn)
    } else {
      gCard.innerHTML = `
        <h3>⚑ Guild Member Standing</h3>
        <div class="row-between"><span>Contracts Completed</span><b>${view.company.contractsCompleted}</b></div>
        <div class="row-between"><span>Pirates Defeated</span><b>${view.company.piratesDefeated}</b></div>
        <div class="row-between"><span>Alderman Deeds (need 2)</span><b>${view.company.aldermanTasksDone}</b></div>
      `
    }
    this.drawerBody.appendChild(gCard)

    const cCard = document.createElement("div")
    cCard.className = "section-card"
    cCard.innerHTML = `<h3>Guild &amp; Relief Charters</h3>`

    for (const c of view.contracts) {
      const targetCity = CITIES[c.cityId].name
      const title =
        c.kind === "pirateHunt"
          ? `Hunt Pirate Raider (Alderman Deed)`
          : `${c.kind === "famine" ? "⚠ Famine Relief" : "Supply"}: ${c.requiredAmount} ${c.goodId ? GOODS[c.goodId].name : ""} → ${targetCity}`
      const row = document.createElement("div")
      row.className = "biz-row"
      row.innerHTML = `
        <div>
          <b>${title}</b>
          <div style="font-size:10px;color:var(--ink-muted)">
            Reward: ${fmtGold(c.rewardGold)} · +${c.rewardRep} rep · ${c.deliveredAmount}/${c.requiredAmount}
          </div>
        </div>
      `
      if (!c.accepted) {
        const acc = document.createElement("button")
        acc.type = "button"
        acc.className = "ink-btn primary mini"
        acc.textContent = "Accept"
        acc.addEventListener("click", () =>
          this.callbacks.dispatch({ _tag: "AcceptContract", contractId: c.contractId })
        )
        row.appendChild(acc)
      } else if (c.kind !== "pirateHunt") {
        const canDeliverFromShip =
          dockedShip !== null &&
          dockedShip.dockedCityId === c.cityId &&
          c.goodId !== null &&
          dockedShip.cargo[c.goodId] > 0
        const canDeliverFromKontor =
          city.id === c.cityId &&
          city.kontorOwned &&
          c.goodId !== null &&
          city.kontorStock[c.goodId] > 0

        const del = document.createElement("button")
        del.type = "button"
        del.className = "ink-btn primary mini"
        del.textContent = "Deliver"
        del.disabled = !canDeliverFromShip && !canDeliverFromKontor
        del.addEventListener("click", () =>
          this.callbacks.dispatch({
            _tag: "DeliverContract",
            contractId: c.contractId,
            shipId: canDeliverFromShip && dockedShip ? dockedShip.shipId : null
          })
        )
        row.appendChild(del)
      } else {
        const tag = document.createElement("span")
        tag.className = "pill blue"
        tag.textContent = "Active"
        row.appendChild(tag)
      }
      cCard.appendChild(row)
    }

    this.drawerBody.appendChild(cCard)
  }

  private renderTownHallTab(view: WorldView, city: CityView): void {
    const hCard = document.createElement("div")
    hCard.className = "section-card"
    const daysToElection = Math.max(0, view.company.nextElectionDay - view.calendar.totalDays)
    hCard.innerHTML = `
      <h3>${city.name} Town Hall (Rathaus)</h3>
      <div class="row-between"><span>Lord Mayor</span><b>${city.mayorName}</b></div>
      <div class="row-between"><span>Your Standing</span><b>${Math.round(city.playerReputation)}%</b></div>
      <div class="row-between"><span>Poor / Wealthy / Rich</span><b>${city.poorPop} / ${city.wealthyPop} / ${city.richPop}</b></div>
      <div class="row-between"><span>Fortification Wall</span><b>Level ${city.wallLevel}</b></div>
      ${city.id === view.company.homeCityId ? `<div class="row-between"><span>Next Lübeck Election</span><b>in ${daysToElection} days</b></div>` : ""}
    `

    const actRow = document.createElement("div")
    actRow.className = "row-between"
    const donBtn = document.createElement("button")
    donBtn.type = "button"
    donBtn.className = "ink-btn mini"
    donBtn.textContent = `Donate (${fmtGold(DONATE_COST)})`
    donBtn.disabled = view.company.gold < DONATE_COST
    donBtn.addEventListener("click", () =>
      this.callbacks.dispatch({ _tag: "DonateCity", cityId: city.id })
    )

    const feastBtn = document.createElement("button")
    feastBtn.type = "button"
    feastBtn.className = "ink-btn primary mini"
    feastBtn.textContent = `Grand Feast (${fmtGold(FEAST_COST)})`
    feastBtn.disabled = view.company.gold < FEAST_COST
    feastBtn.addEventListener("click", () =>
      this.callbacks.dispatch({ _tag: "ThrowFeast", cityId: city.id })
    )
    actRow.append(donBtn, feastBtn)
    hCard.appendChild(actRow)

    // Civic Infrastructure (Well & Hospital — mitigates fire/plague!)
    const civRow = document.createElement("div")
    civRow.className = "row-between"
    const wellBtn = document.createElement("button")
    wellBtn.type = "button"
    wellBtn.className = "ink-btn mini"
    wellBtn.textContent = city.hasWell ? "Well Built ✓" : `Build Well (${fmtGold(WELL_COST)})`
    wellBtn.disabled = city.hasWell || view.company.gold < WELL_COST
    wellBtn.addEventListener("click", () =>
      this.callbacks.dispatch({ _tag: "BuildCivic", cityId: city.id, civic: "well" })
    )

    const hospBtn = document.createElement("button")
    hospBtn.type = "button"
    hospBtn.className = "ink-btn mini"
    hospBtn.textContent = city.hasHospital ? "Hospital ✓" : `Hospital (${fmtGold(HOSPITAL_COST)})`
    hospBtn.disabled = city.hasHospital || view.company.gold < HOSPITAL_COST
    hospBtn.addEventListener("click", () =>
      this.callbacks.dispatch({ _tag: "BuildCivic", cityId: city.id, civic: "hospital" })
    )
    civRow.append(wellBtn, hospBtn)
    hCard.appendChild(civRow)
    this.drawerBody.appendChild(hCard)

    const bank = document.createElement("div")
    bank.className = "section-card"
    bank.innerHTML = `
      <h3>Hanseatic Moneylender</h3>
      <div class="row-between"><span>Outstanding Debt (1.5%/wk)</span><b>${fmtGold(view.company.debt)}</b></div>
    `
    const bRow = document.createElement("div")
    bRow.className = "row-between"
    const borrow = document.createElement("button")
    borrow.type = "button"
    borrow.className = "ink-btn mini"
    borrow.textContent = "Borrow 10,000g"
    borrow.disabled = view.company.debt > 100000
    borrow.addEventListener("click", () =>
      this.callbacks.dispatch({ _tag: "TakeLoan", amount: 10000 })
    )
    const repay = document.createElement("button")
    repay.type = "button"
    repay.className = "ink-btn primary mini"
    repay.textContent = "Repay 10,000g"
    repay.disabled = view.company.debt <= 0 || view.company.gold < 1000
    repay.addEventListener("click", () =>
      this.callbacks.dispatch({ _tag: "RepayLoan", amount: 10000 })
    )
    bRow.append(borrow, repay)
    bank.appendChild(bRow)
    this.drawerBody.appendChild(bank)
  }

  private renderFleetTab(view: WorldView): void {
    const playerShips = view.ships.filter((s) => s.owner === "player")
    const card = document.createElement("div")
    card.className = "section-card"
    card.innerHTML = `<h3>Your Hanseatic Fleet (${playerShips.length})</h3>`

    for (const s of playerShips) {
      const row = document.createElement("div")
      row.className = "biz-row"
      row.style.flexDirection = "column"
      row.style.alignItems = "stretch"

      const top = document.createElement("div")
      top.className = "row-between"
      const status =
        s.navState === "docked" && s.dockedCityId
          ? `Docked: ${CITIES[s.dockedCityId].name}`
          : `Sailing → ${s.targetCityId ? CITIES[s.targetCityId].name : "Sea"}`
      top.innerHTML = `<b>${s.name} (${s.className})</b><span class="pill ${s.autoTrade.enabled ? "green" : ""}">${s.autoTrade.enabled ? "Auto-Route" : status}</span>`

      const sub = document.createElement("div")
      sub.className = "row-between"
      sub.style.fontSize = "10px"
      sub.style.color = "var(--ink-muted)"
      const capLabel = s.captain
        ? `Capt. ${s.captain.name} (${CAPTAIN_TRAITS[s.captain.trait].name})`
        : "No Captain (visit Tavern)"
      sub.innerHTML = `<span>${capLabel}</span><span>${s.usedCargo}/${s.capacity}u · ${s.cannons} guns</span>`

      // Custom 2-stop / 3-stop Auto-Trade selector!
      const routeRow = document.createElement("div")
      routeRow.className = "row-between"
      const selA = document.createElement("select")
      selA.className = "ink-select"
      const selB = document.createElement("select")
      selB.className = "ink-select"
      const curA = s.autoTrade.stops[0] ?? s.dockedCityId ?? "lubeck"
      const curB = s.autoTrade.stops[1] ?? (curA === "bergen" ? "lubeck" : "bergen")
      for (const cid of CITY_IDS) {
        const o1 = document.createElement("option")
        o1.value = cid
        o1.textContent = CITIES[cid].name
        if (cid === curA) o1.selected = true
        selA.appendChild(o1)
        const o2 = document.createElement("option")
        o2.value = cid
        o2.textContent = CITIES[cid].name
        if (cid === curB) o2.selected = true
        selB.appendChild(o2)
      }

      const controls = document.createElement("div")
      controls.className = "row-between"
      const selBtn = document.createElement("button")
      selBtn.type = "button"
      selBtn.className = `ink-btn mini ${view.selection.selectedShipId === s.shipId ? "active" : ""}`
      selBtn.textContent = "Select"
      selBtn.addEventListener("click", () => {
        this.callbacks.dispatch({ _tag: "SelectShip", shipId: s.shipId })
        if (s.dockedCityId) this.callbacks.onFocusCity(s.dockedCityId)
      })

      const autoBtn = document.createElement("button")
      autoBtn.type = "button"
      autoBtn.className = `ink-btn mini ${s.autoTrade.enabled ? "danger" : "primary"}`
      autoBtn.textContent = s.autoTrade.enabled ? "Stop Auto" : "Run Auto-Route"
      autoBtn.disabled = !s.captain && !s.autoTrade.enabled
      autoBtn.addEventListener("click", () => {
        const a = selA.value as CityId
        const b = selB.value as CityId
        const stops: ReadonlyArray<CityId> = a === b ? [a, a === "bergen" ? "lubeck" : "bergen"] : [a, b]
        this.callbacks.dispatch({
          _tag: "ConfigureAutoTrade",
          shipId: s.shipId,
          enabled: !s.autoTrade.enabled,
          stops
        })
      })

      routeRow.append(selA, selB)
      controls.append(selBtn, autoBtn)
      row.append(top, sub, routeRow, controls)
      card.appendChild(row)
    }

    this.drawerBody.appendChild(card)
  }

  private renderShipBar(view: WorldView, ship: ShipView | null, city: CityView): void {
    this.shipDockBar.innerHTML = ""
    const playerShips = view.ships.filter((s) => s.owner === "player")
    const active = ship && ship.owner === "player" ? ship : playerShips[0] ?? null
    if (!active) {
      this.shipDockBar.textContent = "No vessels in fleet."
      return
    }

    const head = document.createElement("div")
    head.className = "ship-header-row"
    const loc =
      active.navState === "docked" && active.dockedCityId
        ? `Anchored at ${CITIES[active.dockedCityId].name}`
        : `Sailing → ${active.targetCityId ? CITIES[active.targetCityId].name : "Open Sea"}`
    const capStr = active.captain ? ` · Capt. ${active.captain.name}` : " · No Captain"
    head.innerHTML = `
      <div>
        <b>⚓ ${active.name}</b> <span style="color:var(--ink-muted)">(${active.className} · ${active.usedCargo}/${active.capacity}u · ${active.cannons} guns)</span>
        <div style="font-size:10px;color:var(--ink-muted)">${loc}${capStr}</div>
      </div>
    `
    this.shipDockBar.appendChild(head)

    const sailRow = document.createElement("div")
    sailRow.className = "ship-sail-row"

    const select = document.createElement("select")
    select.className = "ink-select"
    select.setAttribute("aria-label", "Destination port")
    for (const cid of CITY_IDS) {
      const cView = view.cities.find((c) => c.id === cid)
      const opt = document.createElement("option")
      opt.value = cid
      opt.textContent = `${CITIES[cid].name}${cView?.isIced ? " (Iced)" : ""}`
      if (cid === (city.id !== active.dockedCityId ? city.id : "bergen")) {
        opt.selected = true
      }
      select.appendChild(opt)
    }

    const sailBtn = document.createElement("button")
    sailBtn.type = "button"
    sailBtn.className = "ink-btn primary"
    sailBtn.textContent = "Set Sail →"
    sailBtn.addEventListener("click", () => {
      const dest = select.value as CityId
      this.callbacks.dispatch({ _tag: "SailShip", shipId: active.shipId, targetCityId: dest })
      this.callbacks.onFocusCity(dest)
    })

    const autoToggle = document.createElement("button")
    autoToggle.type = "button"
    autoToggle.className = `ink-btn ${active.autoTrade.enabled ? "active" : ""}`
    autoToggle.textContent = active.autoTrade.enabled ? "Auto: ON" : "Auto-Trade"
    autoToggle.disabled = !active.captain && !active.autoTrade.enabled
    autoToggle.title = active.captain ? "Toggle Automated Captain Route" : "Hire a Captain in a Tavern first"
    autoToggle.addEventListener("click", () => {
      const start = active.dockedCityId ?? "lubeck"
      this.callbacks.dispatch({
        _tag: "ConfigureAutoTrade",
        shipId: active.shipId,
        enabled: !active.autoTrade.enabled,
        stops: start === "lubeck" ? ["lubeck", "bergen", "danzig"] : [start, "lubeck", "hamburg"]
      })
    })

    sailRow.append(select, sailBtn, autoToggle)
    this.shipDockBar.appendChild(sailRow)
  }
}
