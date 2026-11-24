import * as THREE from "three"
import {
  CITIES,
  CITY_IDS,
  GOODS,
  SEA_EDGES,
  SEA_NODES,
  type CityId,
  type CityView,
  type PanelTab,
  type ShipView,
  type ViewMode,
  type WorldView
} from "../sim/index.ts"
import {
  createBusinessModel,
  createCathedral,
  createChartFurniture,
  createQuayEngraving,
  createCityLandmark,
  createConstructionScaffolding,
  createDrydockHull,
  createHanseaticLandmasses,
  createHarborCrane,
  createInkCart,
  createInkPorter,
  createInkSolid,
  createInkTree,
  createQuayCommodityYard,
  createSeaMapCityCluster,
  createShipModel,
  createSteppedGableBuilding
} from "./inkGeometry.ts"
import { createInkEdgeMaterial, createInkPaperMaterial } from "./inkShader.ts"
import { INKLINE_THEMES, type InklineTheme, type InklineThemeId } from "./palette.ts"

export interface SceneCallbacks {
  readonly onSelectCity: (cityId: CityId) => void
  readonly onDoubleClickCity: (cityId: CityId) => void
  readonly onRightClickCity: (cityId: CityId) => void
  readonly onSelectShip: (shipId: number) => void
  readonly onClickBuildPlot: (plotIndex: number) => void
  readonly onClickLandmarkTab: (tab: PanelTab) => void
}

interface ScreenBadge {
  readonly el: HTMLDivElement
  readonly cityId: CityId
}

interface WalkerAgent {
  readonly mesh: THREE.Object3D
  readonly ax: number
  readonly az: number
  readonly bx: number
  readonly bz: number
  readonly speed: number
  readonly phase: number
}

const TOWN_PLOT_COORDS: ReadonlyArray<readonly [number, number]> = [
  [-11.2, -8.2],
  [-6.8, -8.2],
  [6.8, -8.2],
  [11.2, -8.2],
  [-11.6, -3.2],
  [-7.2, -3.2],
  [7.2, -3.2],
  [11.6, -3.2],
  [-10.8, 1.8],
  [-6.5, 1.8],
  [6.5, 1.8],
  [10.8, 1.8]
]

export class Hanse3DScene {
  private readonly container: HTMLElement
  private readonly callbacks: SceneCallbacks
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.OrthographicCamera
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()

  private theme: InklineTheme = INKLINE_THEMES.sage
  private currentViewMode: ViewMode = "sea"
  private currentTownCityId: CityId | null = null
  private currentTownSignature = ""
  private lastRoutesSignature = ""

  // World groups
  private readonly seaGroup = new THREE.Group()
  private readonly townGroup = new THREE.Group()
  private readonly shipsGroup = new THREE.Group()
  private readonly routesGroup = new THREE.Group()
  private readonly waveGroup = new THREE.Group()
  private readonly windGroup = new THREE.Group()
  private readonly iceGroup = new THREE.Group()

  // City & Ship caches on Sea Map
  private readonly cityMeshes = new Map<
    CityId,
    { group: THREE.Group; wallLevel: number; kontor: boolean; winter: boolean }
  >()
  private readonly cityRings = new Map<CityId, THREE.Mesh>()
  private readonly shipMeshes = new Map<number, { group: THREE.Group; sig: string }>()
  private readonly pirateCircles = new Map<number, THREE.LineLoop>()

  // Town animation handles (living waterfront!)
  private smoke: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>[] = []
  private townWalkers: Array<WalkerAgent> = []
  private townGulls: Array<{ mesh: THREE.Object3D; radius: number; height: number; speed: number; offset: number }> = []
  private townSnow: THREE.Points | null = null
  private townCrane: THREE.Object3D | null = null
  private craneSwingTimer = 0
  private lastCraneSeq = 0

  // Projected DOM ink badges over Sea Map cities
  private readonly labelLayer: HTMLDivElement
  private readonly cityBadges = new Map<CityId, ScreenBadge>()

  // Orthographic Architectural Camera state (crisp parallel Inkline drafting!)
  private camTarget = new THREE.Vector3(2, 0, 5)
  private desiredTarget = new THREE.Vector3(2, 0, 5)
  private camZoom = 22 // frustum half-height in world units (smaller = zoomed in)
  private desiredZoom = 22
  private camYaw = 0.06
  private desiredYaw = 0.06
  private camPitch = 0.68 // ~39° architectural Inkline pitch
  private desiredPitch = 0.68

  private dragging = false
  private dragMoved = false
  private lastX = 0
  private lastY = 0
  private lastClickTime = 0
  private lastClickCity: CityId | null = null

  private latestView: WorldView | null = null
  private animTime = 0
  private disposed = false
  private readonly eventsAbort = new AbortController()

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container
    this.callbacks = callbacks

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this.theme.seaSurface)

    const aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight)
    this.camera = new THREE.OrthographicCamera(
      -this.camZoom * aspect,
      this.camZoom * aspect,
      this.camZoom,
      -this.camZoom,
      -120,
      300
    )

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.domElement.className = "hanse-canvas"
    container.appendChild(this.renderer.domElement)

    this.labelLayer = document.createElement("div")
    this.labelLayer.className = "map-label-layer"
    container.appendChild(this.labelLayer)

    this.setupLighting()
    this.scene.add(this.seaGroup)
    this.scene.add(this.townGroup)
    this.townGroup.visible = false

    this.buildSeaWorld()
    this.createCityBadges()
    this.bindEvents()
    this.updateCameraTransform(1)
  }

  private setupLighting(): void {
    // High-key bright paper illumination so Inkline surfaces read crisp ivory-white, never muddy grey!
    const ambient = new THREE.AmbientLight(0xffffff, 1.35)
    this.scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0xffffff, 0xe8ece5, 0.85)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xfffef8, 1.15)
    sun.position.set(32, 58, 26)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 5
    sun.shadow.camera.far = 160
    const d = 52
    sun.shadow.camera.left = -d
    sun.shadow.camera.right = d
    sun.shadow.camera.top = d
    sun.shadow.camera.bottom = -d
    sun.shadow.bias = -0.00012
    sun.shadow.normalBias = .018
    this.scene.add(sun)
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      const geo = (child as THREE.Mesh).geometry
      if (geo) geo.dispose()
      const mat = (child as THREE.Mesh).material
      if (Array.isArray(mat)) {
        for (const m of mat) m.dispose()
      } else if (mat) {
        mat.dispose()
      }
    })
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0]
      if (!child) break
      group.remove(child)
      this.disposeObject(child)
    }
  }

  public setTheme(themeId: InklineThemeId): void {
    this.theme = INKLINE_THEMES[themeId]
    this.scene.background = new THREE.Color(this.theme.seaSurface)
    this.cityMeshes.clear()
    this.cityRings.clear()
    this.shipMeshes.clear()
    this.pirateCircles.clear()
    this.currentTownSignature = ""
    this.lastRoutesSignature = ""
    this.buildSeaWorld()
    if (this.latestView) {
      this.sync(this.latestView)
    }
  }

  private addWaterShadows(water: THREE.Mesh): void {
    const shadow = new THREE.Mesh(water.geometry, new THREE.ShadowMaterial({
      color: this.theme.inkPrimary, opacity: .24, depthWrite: false
    }))
    shadow.position.y = .008
    shadow.receiveShadow = true
    water.add(shadow)
  }

  private buildSeaWorld(): void {
    this.clearGroup(this.seaGroup)
    this.clearGroup(this.shipsGroup)
    this.clearGroup(this.routesGroup)
    this.clearGroup(this.waveGroup)
    this.clearGroup(this.windGroup)
    this.clearGroup(this.iceGroup)

    // Paper sea plane that receives crisp architectural shadows
    const seaGeo = new THREE.PlaneGeometry(260, 200)
    seaGeo.rotateX(-Math.PI / 2)
    const seaPlane = new THREE.Mesh(
      seaGeo,
      createInkPaperMaterial(this.theme.seaSurface, this.theme.inkPrimary, { unlit: true, hatchStrength: 0 })
    )
    seaPlane.position.y = 0
    this.addWaterShadows(seaPlane)
    this.seaGroup.add(seaPlane)

    // 16-Point Nautical Compass Rose + Cartographic Rhumb Lines radiating across the sea chart!
    const compassCenter = new THREE.Vector3(-27, 0.03, -8)
    const compassGroup = new THREE.Group()
    compassGroup.position.copy(compassCenter)

    for (const [rIn, rOut, op] of [
      [4.5, 4.72, 0.55],
      [3.2, 3.3, 0.35],
      [0.45, 0.55, 0.65]
    ] as const) {
      const ringGeo = new THREE.RingGeometry(rIn, rOut, 48)
      ringGeo.rotateX(-Math.PI / 2)
      compassGroup.add(
        new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(this.theme.seaWaveInk),
            transparent: true,
            opacity: op,
            side: THREE.DoubleSide
          })
        )
      )
    }

    const rhumbPts: Array<THREE.Vector3> = []
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8
      const inner = i % 4 === 0 ? 0.5 : 1.4
      const outer = i % 4 === 0 ? 6.2 : i % 2 === 0 ? 4.8 : 3.6
      rhumbPts.push(
        new THREE.Vector3(Math.cos(a) * inner, 0, Math.sin(a) * inner),
        new THREE.Vector3(Math.cos(a) * outer, 0, Math.sin(a) * outer)
      )
      // Long faint rhumb bearing rays across the nautical chart (like portolan charts!)
      if (i % 2 === 0) {
        rhumbPts.push(
          new THREE.Vector3(Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5),
          new THREE.Vector3(Math.cos(a) * 82, 0, Math.sin(a) * 82)
        )
      }
    }
    compassGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(rhumbPts),
        createInkEdgeMaterial(this.theme.seaWaveInk, 0.32)
      )
    )
    this.seaGroup.add(compassGroup, createChartFurniture(this.theme))

    // Subtle sparse open-water ink wave hatches
    const wavePts: Array<THREE.Vector3> = []
    for (let i = 0; i < 120; i++) {
      const wx = ((i * 37.3) % 98) - 49
      const wz = ((i * 23.7) % 64) - 32
      const len = 1.4 + (i % 4) * 0.55
      wavePts.push(new THREE.Vector3(wx - len / 2, 0.04, wz), new THREE.Vector3(wx + len / 2, 0.04, wz))
    }
    this.waveGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(wavePts),
        createInkEdgeMaterial(this.theme.seaWaveInk, 0.36)
      )
    )
    this.seaGroup.add(this.waveGroup)

    // Live Wind Direction Feather Strokes drifting across the sea!
    const windPts: Array<THREE.Vector3> = []
    for (let i = 0; i < 18; i++) {
      const wx = ((i * 19.7) % 72) - 36
      const wz = ((i * 13.3) % 44) - 22
      windPts.push(
        new THREE.Vector3(wx, 0.06, wz - 1.1),
        new THREE.Vector3(wx, 0.06, wz + 1.1),
        new THREE.Vector3(wx, 0.06, wz + 1.1),
        new THREE.Vector3(wx - 0.32, 0.06, wz + 0.55),
        new THREE.Vector3(wx, 0.06, wz + 1.1),
        new THREE.Vector3(wx + 0.32, 0.06, wz + 0.55)
      )
    }
    this.windGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(windPts),
        createInkEdgeMaterial(this.theme.accentBlue, 0.34)
      )
    )
    this.seaGroup.add(this.windGroup)

    // Delicate bearing sea-lanes connecting ports
    const nodeMap = new Map(SEA_NODES.map((n) => [n.id, n]))
    const lanePts: Array<THREE.Vector3> = []
    for (const [aId, bId] of SEA_EDGES) {
      const a = nodeMap.get(aId)
      const b = nodeMap.get(bId)
      if (!a || !b) continue
      lanePts.push(new THREE.Vector3(a.x, 0.05, a.z), new THREE.Vector3(b.x, 0.05, b.z))
    }
    const laneMat = new THREE.LineDashedMaterial({
      color: new THREE.Color(this.theme.seaWaveInk),
      dashSize: 0.75,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.34
    })
    const laneLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lanePts), laneMat)
    laneLines.computeLineDistances()
    this.seaGroup.add(laneLines)

    // Subdivided Organic Cartographic Landmasses + Concentric Shoreline Ripples
    this.seaGroup.add(createHanseaticLandmasses(this.theme))

    // Winter ice cross-hatching around northern Baltic ports (Riga, Stockholm)
    for (const id of CITY_IDS) {
      const def = CITIES[id]
      if (!def.iceProne) continue
      const hatchPts: Array<THREE.Vector3> = []
      for (let r = -4.6; r <= 4.6; r += 0.78) {
        hatchPts.push(
          new THREE.Vector3(def.harborX - 4.2, 0.09, def.harborZ + r),
          new THREE.Vector3(def.harborX + 4.2, 0.09, def.harborZ + r - 1.5),
          new THREE.Vector3(def.harborX - 4.2, 0.09, def.harborZ + r - 1.5),
          new THREE.Vector3(def.harborX + 4.2, 0.09, def.harborZ + r)
        )
      }
      this.iceGroup.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(hatchPts),
          createInkEdgeMaterial(this.theme.accentBlue, 0.5)
        )
      )
    }
    this.iceGroup.visible = false
    this.seaGroup.add(this.iceGroup)

    // City highlight / famine rings
    for (const id of CITY_IDS) {
      const def = CITIES[id]
      const rGeo = new THREE.RingGeometry(2.3, 2.6, 32)
      rGeo.rotateX(-Math.PI / 2)
      const rMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(this.theme.accentBlue),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      })
      const ring = new THREE.Mesh(rGeo, rMat)
      ring.position.set(def.x, 0.62, def.z)
      this.seaGroup.add(ring)
      this.cityRings.set(id, ring)
    }

    this.seaGroup.add(this.routesGroup)
    this.seaGroup.add(this.shipsGroup)
  }

  private createCityBadges(): void {
    for (const id of CITY_IDS) {
      const el = document.createElement("div")
      el.className = "city-map-badge"
      el.dataset["cityId"] = id
      el.addEventListener("click", (e) => {
        e.stopPropagation()
        this.callbacks.onSelectCity(id)
      })
      el.addEventListener("dblclick", (e) => {
        e.stopPropagation()
        this.callbacks.onDoubleClickCity(id)
      })
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.callbacks.onRightClickCity(id)
      })
      this.labelLayer.appendChild(el)
      this.cityBadges.set(id, { el, cityId: id })
    }
  }

  // ── Authored 3D Town Waterfront Diorama (Recognizable & Alive!) ──────────

  private buildTownDiorama(
    city: CityView,
    dockedShips: ReadonlyArray<ShipView>,
    season: WorldView["calendar"]["season"],
    buildMode: boolean,
    merchantMark: WorldView["company"]["merchantMark"]
  ): void {
    this.clearGroup(this.townGroup)
    this.smoke = []
    this.townWalkers = []
    this.townGulls = []
    this.townSnow = null
    this.townCrane = null

    const def = CITIES[city.id]
    const snow = season === "winter"

    const markClickable = (obj: THREE.Object3D, tab: PanelTab) => {
      obj.traverse((o) => {
        o.userData = { pickKind: "landmark", tab }
      })
    }

    // 1. Harbor Water + Coastal Ripple Lines
    const waterGeo = new THREE.PlaneGeometry(110, 62)
    waterGeo.rotateX(-Math.PI / 2)
    const water = new THREE.Mesh(
      waterGeo,
      createInkPaperMaterial(this.theme.seaSurface, this.theme.inkPrimary, { unlit: true, hatchStrength: 0 })
    )
    water.position.set(0, 0, 26)
    this.addWaterShadows(water)
    this.townGroup.add(water)

    const hWaves: Array<THREE.Vector3> = []
    for (let i = 0; i < 44; i++) {
      const wx = ((i * 11.7) % 48) - 24
      const wz = 8.4 + ((i * 5.3) % 18)
      hWaves.push(new THREE.Vector3(wx - 1.2, 0.04, wz), new THREE.Vector3(wx + 1.2, 0.04, wz))
    }
    this.townGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(hWaves),
        createInkEdgeMaterial(this.theme.seaWaveInk, 0.45)
      )
    )

    // 2. Town Ground & Quay Embankment (Bergen gets rising fjord terraces; Lübeck gets river quay!)
    const ground = createInkSolid(
      new THREE.BoxGeometry(34, 0.9, 24),
      snow ? "#f8faf6" : this.theme.landTop,
      this.theme.inkPrimary,
      { castShadow: false, hatchStrength: 0.08 }
    )
    ground.position.set(0, 0.45, -4)
    this.townGroup.add(ground)

    if (def.landmark === "bryggen") {
      // Rising Norwegian fjord hillside backing Bergen's wooden Bryggen row!
      const ridge = createInkSolid(
        new THREE.BoxGeometry(36, 3.2, 6.5),
        snow ? "#f6f8f4" : this.theme.landSide,
        this.theme.inkPrimary,
        { hatchStrength: 0.2 }
      )
      ridge.position.set(0, 2.2, -16.2)
      this.townGroup.add(ridge)
    }

    // Cobbled Quay Promenade + Market Square + Cross Streets
    const quayWalk = createInkSolid(
      new THREE.BoxGeometry(31, 0.07, 3.4),
      this.theme.paperRecessed,
      this.theme.borderLine,
      { castShadow: false }
    )
    quayWalk.position.set(0, 0.935, 6.0)
    this.townGroup.add(quayWalk, createQuayEngraving(this.theme))

    const marketSq = createInkSolid(
      new THREE.BoxGeometry(9.2, 0.08, 6.4),
      this.theme.paperCard,
      this.theme.inkPrimary,
      { castShadow: false }
    )
    marketSq.position.set(0, 0.94, -0.8)
    markClickable(marketSq, "market")
    this.townGroup.add(marketSq)

    // Market Stalls with striped ink awnings on the square (clickable → Market!)
    for (const [sx, sz, tint] of [
      [-2.2, -0.6, this.theme.accentRed],
      [0, -1.6, this.theme.accentBlue],
      [2.2, -0.6, this.theme.accentOchre]
    ] as const) {
      const stall = new THREE.Group()
      const counter = createInkSolid(new THREE.BoxGeometry(1.3, 0.48, 0.72), this.theme.paperCard, this.theme.inkPrimary)
      counter.position.y = 0.24
      stall.add(counter)
      const awning = createInkSolid(new THREE.BoxGeometry(1.45, 0.12, 0.95), tint, this.theme.inkDeep)
      awning.position.set(0, 0.92, 0)
      awning.rotation.x = 0.14
      stall.add(awning)
      stall.position.set(sx, 0.94, sz)
      markClickable(stall, "market")
      this.townGroup.add(stall)
    }

    // 3. Defensive Ring Wall & Corner Towers (heavier per wallLevel)
    const wallH = city.wallLevel === 3 ? 2.25 : city.wallLevel === 2 ? 1.55 : 0.95
    const northWall = createInkSolid(
      new THREE.BoxGeometry(32, wallH, 0.72),
      this.theme.paperRecessed,
      this.theme.inkPrimary,
      { silhouette: 0.025 }
    )
    northWall.position.set(0, 0.9 + wallH / 2, -15.2)
    this.townGroup.add(northWall)

    for (const side of [-16.0, 16.0]) {
      const sw = createInkSolid(
        new THREE.BoxGeometry(0.7, wallH, 22.8),
        this.theme.paperRecessed,
        this.theme.inkPrimary
      )
      sw.position.set(side, 0.9 + wallH / 2, -4)
      this.townGroup.add(sw)
      const tw = createInkSolid(
        new THREE.CylinderGeometry(0.88, 0.98, wallH + 1.35, 8),
        this.theme.paperCard,
        this.theme.inkPrimary,
        { silhouette: 0.03 }
      )
      tw.position.set(side, 0.9 + (wallH + 1.35) / 2, -15.2)
      this.townGroup.add(tw)
    }

    // 4. City's Unique Signature Landmark framed right along the waterfront / main axis!
    const landmark = createCityLandmark(def.landmark, 1.55, this.theme, def.roofAccent, snow)
    if (def.landmark === "krantor") {
      landmark.position.set(-5.2, 0.9, 6.4)
    } else if (def.landmark === "bryggen") {
      landmark.position.set(-4.5, 0.9, 4.4)
    } else {
      landmark.position.set(-5.8, 0.9, 3.8)
    }
    markClickable(landmark, "townhall")
    this.townGroup.add(landmark)

    // 5. Cathedral (Marienkirche — clickable → Town Hall / Charity)
    const cathedral = createCathedral(1.55, this.theme, def.roofAccent, def.spireCount, snow)
    cathedral.position.set(0, 0.9, -10.8)
    markClickable(cathedral, "townhall")
    this.townGroup.add(cathedral)

    // 6. Town Hall / Rathaus (west of square — clickable → Town Hall)
    const rathaus = createSteppedGableBuilding(
      3.0,
      2.2,
      2.1,
      this.theme.paperCard,
      def.roofAccent,
      this.theme.inkPrimary,
      { detailedFacade: true, snowRoof: snow, silhouette: 0.03 }
    )
    rathaus.position.set(-3.4, 0.9, -5.6)
    markClickable(rathaus, "townhall")
    this.townGroup.add(rathaus)

    // 7. Player Kontor Warehouse (east of square, Guild Blue roof & hoist beam! — clickable → Kontor)
    const kontor = createSteppedGableBuilding(
      3.0,
      2.1,
      2.2,
      this.theme.paperCard,
      city.kontorOwned ? this.theme.accentBlue : this.theme.borderLine,
      this.theme.inkPrimary,
      { detailedFacade: true, hoistBeam: true, snowRoof: snow, silhouette: 0.03 }
    )
    kontor.position.set(3.4, 0.9, -5.6)
    markClickable(kontor, "kontor")
    this.townGroup.add(kontor)

    // 8. Hanseatic Tavern (south-east corner near quay — clickable → Tavern to hire Captains!)
    const tavern = createSteppedGableBuilding(
      2.2,
      1.55,
      1.8,
      this.theme.accentOchreWash,
      def.roofAccent,
      this.theme.inkPrimary,
      { detailedFacade: true, snowRoof: snow }
    )
    tavern.position.set(6.4, 0.9, 4.4)
    markClickable(tavern, "tavern")
    this.townGroup.add(tavern)

    // 9. Civic Well & Hospital when constructed
    if (city.hasWell) {
      const well = createInkSolid(new THREE.CylinderGeometry(0.42, 0.48, 0.55, 8), this.theme.paperCard, this.theme.inkPrimary)
      well.position.set(0, 1.22, 1.45)
      this.townGroup.add(well)
    }

    // 10. Live Economy on the Quay: Visible Brick Yard, Salt Covered Bay, Timber Stack & Barrels!
    const stockTier = (amount: number): 0 | 1 | 2 | 3 =>
      amount >= 65 ? 3 : amount >= 28 ? 2 : amount >= 6 ? 1 : 0

    const brickYard = createQuayCommodityYard("bricks", stockTier(city.stock.bricks), this.theme)
    brickYard.position.set(-1.9, 0.9, 5.8)
    markClickable(brickYard, "market")
    this.townGroup.add(brickYard)

    const saltBay = createQuayCommodityYard("salt", stockTier(city.stock.salt), this.theme)
    saltBay.position.set(2.8, 0.9, 5.8)
    markClickable(saltBay, "market")
    this.townGroup.add(saltBay)

    const timberYard = createQuayCommodityYard("timber", stockTier(city.stock.timber), this.theme)
    timberYard.position.set(-10.5, 0.9, 5.8)
    markClickable(timberYard, "market")
    this.townGroup.add(timberYard)

    // 11. Wooden Harbor Piers, Pilings & Interactive Crane
    for (const px of [-6.4, 0, 6.4]) {
      const pier = createInkSolid(
        new THREE.BoxGeometry(2.3, 0.32, 5.4),
        this.theme.paperRecessed,
        this.theme.inkPrimary
      )
      pier.position.set(px, 0.56, 10.2)
      this.townGroup.add(pier)
    }

    const crane = createHarborCrane(1.45, this.theme)
    crane.position.set(0, 0.9, 7.6)
    markClickable(crane, "market")
    this.townCrane = crane
    this.townGroup.add(crane)

    // 12. Shipyard (Werft) + Live Ribbed Drydock Hull when building a ship!
    const shipyard = createSteppedGableBuilding(
      2.6,
      1.4,
      2.8,
      this.theme.paperRecessed,
      this.theme.accentOchre,
      this.theme.inkPrimary,
      { detailedFacade: true, snowRoof: snow }
    )
    shipyard.position.set(11.8, 0.9, 5.8)
    markClickable(shipyard, "shipyard")
    this.townGroup.add(shipyard)

    if (city.shipyardOrder) {
      const drydockHull = createDrydockHull(this.theme)
      drydockHull.position.set(11.6, 0.72, 10.2)
      markClickable(drydockHull, "shipyard")
      this.townGroup.add(drydockHull)
    }

    // 13. Merchant Houses (grows visibly with city.playerHouses!)
    const houseCount = Math.min(10, 3 + city.playerHouses)
    for (let i = 0; i < houseCount; i++) {
      const isPlayer = i >= 3
      const side = i % 2 === 0 ? -1 : 1
      const idx = Math.floor(i / 2)
      const hx = side * (13.4 - (idx % 2) * 1.9)
      const hz = -11.8 + idx * 3.1
      const house = createSteppedGableBuilding(
        1.45,
        1.25 + (i % 3) * 0.25,
        1.35,
        this.theme.paperCard,
        isPlayer ? this.theme.accentBlue : def.roofAccent,
        this.theme.inkPrimary,
        { detailedFacade: true, snowRoof: snow }
      )
      house.position.set(hx, 0.9, hz)
      this.townGroup.add(house)
    }

    // Pine trees framing town perimeter
    for (const [tx, tz] of [
      [-14.2, -13.2],
      [14.2, -13.2],
      [-14.5, 4.2],
      [14.5, -1.5],
      [-3.8, -12.8],
      [3.8, -12.8]
    ] as const) {
      const tree = createInkTree(this.theme, season)
      tree.position.set(tx, 0.9, tz)
      this.townGroup.add(tree)
    }

    // 14. 12 Production Plots (Finished workshops, 3D Wooden Scaffolding while building, OR clickable pads ONLY in Build Mode!)
    const bizByPlot = new Map(city.businesses.map((b) => [b.plotIndex, b]))
    TOWN_PLOT_COORDS.forEach(([px, pz], plotIdx) => {
      const biz = bizByPlot.get(plotIdx)
      if (biz) {
        const model =
          biz.buildDaysLeft > 0
            ? createConstructionScaffolding(this.theme)
            : createBusinessModel(biz.type, this.theme, snow)
        const chimney = model.getObjectByName("smokeEmitter")
        if (biz.active && chimney) {
          const outlet = new THREE.Group()
          outlet.position.copy(chimney.position)
          outlet.position.y = new THREE.Box3().setFromObject(chimney).max.y
          model.add(outlet)
          for (let i = 0; i < 4; i++) {
            const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(.23,1),
              new THREE.MeshBasicMaterial({ color: this.theme.inkMuted, transparent: true, depthWrite: false }))
            puff.userData.phase = i/4 + plotIdx*.17
            this.smoke.push(puff)
            outlet.add(puff)
          }
        }
        model.position.set(px, 0.9, pz)
        this.townGroup.add(model)
      } else if (buildMode && city.kontorOwned) {
        const pad = createInkSolid(
          new THREE.BoxGeometry(2.6, 0.08, 2.2),
          this.theme.accentBlueWash,
          this.theme.accentBlue,
          { castShadow: false }
        )
        pad.position.set(px, 0.94, pz)
        pad.traverse((obj) => {
          obj.userData = { pickKind: "plot", plotIndex: plotIdx }
        })
        this.townGroup.add(pad)
      }
    })

    // 15. Docked Ships at Harbor Piers (with visible deck cargo!)
    dockedShips.slice(0, 4).forEach((s, idx) => {
      const model = createShipModel(
        s.shipClass,
        s.owner,
        this.theme,
        s.capacity > 0 ? s.usedCargo / s.capacity : 0,
        merchantMark
      )
      model.scale.setScalar(1.48)
      const berthX = idx === 0 ? -1.4 : idx === 1 ? -6.4 : idx === 2 ? 5.2 : 8.8
      model.position.set(berthX, 0.14, 12.2)
      model.rotation.y = Math.PI * 0.12
      model.traverse((obj) => {
        obj.userData = { pickKind: "ship", shipId: s.shipId }
      })
      this.townGroup.add(model)
    })

    // 16. Living Waterfront: Porters, Horse Carts & Circling Ink Gulls (tied to city mood/famine!)
    if (city.famineDays === 0) {
      const porterCount = city.mood >= 65 ? 5 : 3
      const routes: ReadonlyArray<readonly [number, number, number, number]> = [
        [-2.2, 6.2, 3.2, -3.5],
        [-0.4, 7.2, -1.8, 5.4],
        [2.4, 6.2, 0.2, 0.2],
        [-5.2, 5.6, 5.4, 5.6],
        [3.4, -3.5, -3.2, -3.5]
      ]
      for (let i = 0; i < porterCount; i++) {
        const r = routes[i % routes.length]!
        const porter = createInkPorter(this.theme, i % 2 === 0)
        porter.position.set(r[0], 0.94, r[1])
        this.townGroup.add(porter)
        this.townWalkers.push({
          mesh: porter,
          ax: r[0],
          az: r[1],
          bx: r[2],
          bz: r[3],
          speed: 0.22 + (i % 3) * 0.05,
          phase: i * 1.15
        })
      }

      const cartCount = Math.min(3, 1 + Math.floor(city.businesses.length / 2))
      for (let i = 0; i < cartCount; i++) {
        const cart = createInkCart(this.theme)
        const cz = i === 0 ? 5.9 : i === 1 ? -2.2 : 1.5
        cart.position.set(-7, 0.94, cz)
        this.townGroup.add(cart)
        this.townWalkers.push({
          mesh: cart,
          ax: -9.5,
          az: cz,
          bx: 9.5,
          bz: cz,
          speed: 0.14 + i * 0.03,
          phase: i * 2.1
        })
      }
    }

    // Circling ink gulls over the harbor
    for (let i = 0; i < 4; i++) {
      const gullPts = [
        new THREE.Vector3(-0.35, 0.08, 0),
        new THREE.Vector3(0, 0, 0.08),
        new THREE.Vector3(0, 0, 0.08),
        new THREE.Vector3(0.35, 0.08, 0)
      ]
      const gull = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(gullPts),
        createInkEdgeMaterial(this.theme.inkDeep, 0.85)
      )
      this.townGroup.add(gull)
      this.townGulls.push({
        mesh: gull,
        radius: 5.5 + i * 2.1,
        height: 5.6 + i * 0.65,
        speed: 0.45 + i * 0.08,
        offset: i * 1.6
      })
    }

    // Falling ink snowflakes in winter!
    if (snow) {
      const count = 140
      const positions = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        positions[i * 3] = ((i * 29.3) % 36) - 18
        positions[i * 3 + 1] = ((i * 7.7) % 12) + 1
        positions[i * 3 + 2] = ((i * 17.9) % 32) - 14
      }
      const pGeo = new THREE.BufferGeometry()
      pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
      const pMat = new THREE.PointsMaterial({
        color: new THREE.Color(this.theme.inkPrimary),
        size: 0.16,
        transparent: true,
        opacity: 0.45
      })
      this.townSnow = new THREE.Points(pGeo, pMat)
      this.townGroup.add(this.townSnow)
    }
  }

  // ── Sync with Ritmo WorldView ────────────────────────────────────────────

  public sync(view: WorldView): void {
    this.latestView = view

    // Trigger harbor crane loading animation on trade cues!
    for (const cue of view.cues) {
      if (cue.kind === "crane" && cue.seq > this.lastCraneSeq) {
        this.lastCraneSeq = cue.seq
        this.craneSwingTimer = 1.4
      }
    }

    const modeChanged = view.selection.viewMode !== this.currentViewMode
    const cityChanged = view.selection.selectedCityId !== this.currentTownCityId
    this.currentViewMode = view.selection.viewMode

    this.seaGroup.visible = this.currentViewMode === "sea"
    this.townGroup.visible = this.currentViewMode === "town"
    this.labelLayer.style.display = this.currentViewMode === "sea" ? "block" : "none"

    if (this.currentViewMode === "town") {
      const city = view.cities.find((c) => c.id === view.selection.selectedCityId)
      if (city) {
        const docked = view.ships.filter((s) => s.dockedCityId === city.id)
        const bizSig = city.businesses.map((b) => `${b.id}:${b.buildDaysLeft}:${b.active}`).join(",")
        const shipSig = docked.map((d) => `${d.shipId}:${Math.ceil(d.usedCargo / 30)}`).join(",")
        const stockSig = `${Math.floor(city.stock.bricks / 25)}-${Math.floor(city.stock.salt / 25)}-${Math.floor(city.stock.timber / 25)}`
        const sig = `${city.id}|${city.wallLevel}|${city.kontorOwned}|${city.playerHouses}|${city.hasWell}|${city.shipyardOrder?.daysLeft ?? -1}|${bizSig}|${shipSig}|${stockSig}|${view.calendar.season}|${view.selection.buildMode}|${view.company.merchantMark}`
        if (sig !== this.currentTownSignature) {
          this.currentTownSignature = sig
          this.currentTownCityId = city.id
          this.buildTownDiorama(
            city,
            docked,
            view.calendar.season,
            view.selection.buildMode,
            view.company.merchantMark
          )
        }
        if (modeChanged || cityChanged) {
          // Hand-crafted arrival composition framing docked ship, crane, brick/salt yards, Rathaus & Cathedral!
          this.desiredTarget.set(0, 0.6, 1.4)
          this.desiredZoom = 14.5
          this.desiredPitch = 0.64
          this.desiredYaw = 0.36
        }
      }
      return
    }

    if (modeChanged) {
      const selCity = view.cities.find((c) => c.id === view.selection.selectedCityId)
      this.desiredTarget.set(selCity ? selCity.x * 0.45 : 2, 0, selCity ? selCity.z * 0.45 : 4)
      this.desiredZoom = 22
      this.desiredPitch = 0.68
      this.desiredYaw = 0.06
    }

    // Wind feather orientation + winter sea ice visibility
    this.windGroup.rotation.y = view.weather.windAngle
    this.iceGroup.visible = view.calendar.season === "winter"
    const isWinter = view.calendar.season === "winter"

    // 1. Update Sea Map city silhouettes, rings & floating ink badges
    for (const city of view.cities) {
      const existing = this.cityMeshes.get(city.id)
      if (
        !existing ||
        existing.wallLevel !== city.wallLevel ||
        existing.kontor !== city.kontorOwned ||
        existing.winter !== isWinter
      ) {
        if (existing) {
          this.seaGroup.remove(existing.group)
          this.disposeObject(existing.group)
        }
        const cluster = createSeaMapCityCluster(
          CITIES[city.id],
          this.theme,
          city.wallLevel,
          city.kontorOwned,
          isWinter
        )
        cluster.position.set(city.x, 0.45, city.z)
        cluster.traverse((o) => {
          o.userData = { pickKind: "city", cityId: city.id }
        })
        this.seaGroup.add(cluster)
        this.cityMeshes.set(city.id, {
          group: cluster,
          wallLevel: city.wallLevel,
          kontor: city.kontorOwned,
          winter: isWinter
        })
      }

      const ring = this.cityRings.get(city.id)
      if (ring) {
        const mat = ring.material as THREE.MeshBasicMaterial
        if (city.famineDays > 0) {
          mat.color.set(this.theme.accentRed)
          mat.opacity = 0.78
        } else if (city.id === view.selection.selectedCityId) {
          mat.color.set(this.theme.accentBlue)
          mat.opacity = 0.85
        } else if (city.kontorOwned) {
          mat.color.set(this.theme.accentGreen)
          mat.opacity = 0.35
        } else {
          mat.opacity = 0
        }
      }

      const badge = this.cityBadges.get(city.id)
      if (badge) {
        const scarce = city.market.filter((m) => m.priceSignal === "scarce").slice(0, 2)
        const cheap = city.market.filter((m) => m.priceSignal === "cheap").slice(0, 2)
        badge.el.classList.toggle("selected", city.id === view.selection.selectedCityId)
        badge.el.classList.toggle("famine", city.famineDays > 0)
        badge.el.classList.toggle("kontor", city.kontorOwned)
        const iceTag = city.isIced ? " ❄" : ""
        const shipTag =
          city.dockedPlayerShipIds.length > 0 ? ` · ⚓${city.dockedPlayerShipIds.length}` : ""
        const signalsHtml = [
          ...scarce.map((m) => `<span class="sig scarce">${GOODS[m.goodId].shortName}▲</span>`),
          ...cheap.map((m) => `<span class="sig cheap">${GOODS[m.goodId].shortName}▼</span>`)
        ].join("")
        const nextHtml = `<div class="badge-name">${city.kontorOwned ? "⚑ " : ""}${city.name}${iceTag}${shipTag}</div>${signalsHtml ? `<div class="badge-sigs">${signalsHtml}</div>` : ""}`
        if (badge.el.dataset["html"] !== nextHtml) {
          badge.el.innerHTML = nextHtml
          badge.el.dataset["html"] = nextHtml
        }
      }
    }

    // 2. Sync Ships on Sea Map (offset docked ships slightly offshore so they never overlap city labels!)
    const aliveShipIds = new Set<number>()
    for (const ship of view.ships) {
      aliveShipIds.add(ship.shipId)
      const cargoBucket = Math.ceil((ship.usedCargo / Math.max(1, ship.capacity)) * 4)
      const sig = `${ship.shipClass}|${ship.owner}|${cargoBucket}|${view.company.merchantMark}`
      let rec = this.shipMeshes.get(ship.shipId)
      if (!rec || rec.sig !== sig) {
        if (rec) {
          this.shipsGroup.remove(rec.group)
          this.disposeObject(rec.group)
        }
        const model = createShipModel(
          ship.shipClass,
          ship.owner,
          this.theme,
          ship.capacity > 0 ? ship.usedCargo / ship.capacity : 0,
          view.company.merchantMark
        )
        model.traverse((o) => {
          o.userData = { pickKind: "ship", shipId: ship.shipId }
        })
        this.shipsGroup.add(model)
        rec = { group: model, sig }
        this.shipMeshes.set(ship.shipId, rec)
      }

      // Offset docked ships cleanly away from city label center
      let drawX = ship.x
      let drawZ = ship.z
      if (ship.navState === "docked" && ship.dockedCityId) {
        const cDef = CITIES[ship.dockedCityId]
        const dx = cDef.harborX - cDef.x
        const dz = cDef.harborZ - cDef.z
        const len = Math.max(0.1, Math.hypot(dx, dz))
        drawX = cDef.harborX + (dx / len) * 0.9
        drawZ = cDef.harborZ + (dz / len) * 0.9
      }

      rec.group.position.set(drawX, 0.06, drawZ)
      rec.group.rotation.y = ship.heading
      rec.group.scale.setScalar(ship.shipId === view.selection.selectedShipId ? 1.2 : 1.0)

      const wakeObj = rec.group.getObjectByName("vWake")
      if (wakeObj) {
        wakeObj.visible = ship.navState === "sailing"
      }

      if (ship.owner === "pirate") {
        let loop = this.pirateCircles.get(ship.shipId)
        if (!loop) {
          const pts: Array<THREE.Vector3> = []
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2
            const r = 2.15 + ((i * 7) % 3) * 0.08
            pts.push(new THREE.Vector3(Math.cos(a) * r, 0.07, Math.sin(a) * r))
          }
          loop = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(pts),
            createInkEdgeMaterial(this.theme.accentRed, 0.68)
          )
          this.shipsGroup.add(loop)
          this.pirateCircles.set(ship.shipId, loop)
        }
        loop.position.set(drawX, 0.07, drawZ)
      }
    }

    for (const [id, rec] of this.shipMeshes.entries()) {
      if (!aliveShipIds.has(id)) {
        this.shipsGroup.remove(rec.group)
        this.disposeObject(rec.group)
        this.shipMeshes.delete(id)
        const loop = this.pirateCircles.get(id)
        if (loop) {
          this.shipsGroup.remove(loop)
          this.disposeObject(loop)
          this.pirateCircles.delete(id)
        }
      }
    }

    // 3. Plotted Dashed Courses & Auto-Trade Loops (rebuilt only on change!)
    const selectedShip =
      view.selection.selectedShipId !== null
        ? view.ships.find((s) => s.shipId === view.selection.selectedShipId) ?? null
        : null

    const activeCourseSig =
      selectedShip && selectedShip.navState === "sailing"
        ? `${selectedShip.shipId}:${Math.round(selectedShip.x * 4)},${Math.round(selectedShip.z * 4)}:${selectedShip.waypointIndex}:${selectedShip.targetCityId}`
        : "none"
    const autoSig = view.ships
      .filter((s) => s.owner === "player" && s.autoTrade.enabled)
      .map((s) => `${s.shipId}:${s.autoTrade.stops.join("-")}`)
      .join("|")
    const routesSig = `${activeCourseSig}||${autoSig}`

    if (routesSig !== this.lastRoutesSignature) {
      this.lastRoutesSignature = routesSig
      this.clearGroup(this.routesGroup)

      if (selectedShip && selectedShip.navState === "sailing" && selectedShip.waypoints.length > 0) {
        const pts: Array<THREE.Vector3> = [new THREE.Vector3(selectedShip.x, 0.14, selectedShip.z)]
        for (let i = selectedShip.waypointIndex; i < selectedShip.waypoints.length; i++) {
          const wp = selectedShip.waypoints[i]
          if (wp) pts.push(new THREE.Vector3(wp.x, 0.14, wp.z))
        }
        const courseMat = new THREE.LineDashedMaterial({
          color: new THREE.Color(this.theme.accentBlue),
          dashSize: 0.7,
          gapSize: 0.45
        })
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), courseMat)
        line.computeLineDistances()
        this.routesGroup.add(line)
      }

      for (const ship of view.ships) {
        if (ship.owner !== "player" || !ship.autoTrade.enabled || ship.autoTrade.stops.length < 2) {
          continue
        }
        const pts: Array<THREE.Vector3> = []
        for (const cid of ship.autoTrade.stops) {
          const c = CITIES[cid]
          pts.push(new THREE.Vector3(c.harborX, 0.11, c.harborZ))
        }
        const first = CITIES[ship.autoTrade.stops[0]!]
        pts.push(new THREE.Vector3(first.harborX, 0.11, first.harborZ))
        const mat = new THREE.LineDashedMaterial({
          color: new THREE.Color(this.theme.accentGreen),
          dashSize: 0.9,
          gapSize: 0.6,
          transparent: true,
          opacity: 0.68
        })
        const loop = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)
        loop.computeLineDistances()
        this.routesGroup.add(loop)
      }
    }
  }

  public focusCity(cityId: CityId): void {
    const def = CITIES[cityId]
    if (this.currentViewMode === "sea") {
      this.desiredTarget.set(def.x * 0.7, 0, def.z * 0.7)
    }
  }

  // ── Render Frame & Living Animations ─────────────────────────────────────

  public renderFrame(dtSeconds: number): void {
    if (this.disposed) return
    this.animTime += dtSeconds

    const alpha = Math.min(1, dtSeconds * 7.2)
    this.updateCameraTransform(alpha)

    this.waveGroup.position.x = Math.sin(this.animTime * 0.35) * 0.65

    const flutter = (obj: THREE.Object3D) => {
      if (obj.name !== "mastheadPennant") return
      const pos = (obj as THREE.Mesh).geometry.getAttribute("position")
      for (let i=0; i<pos.count; i++) {
        const z = pos.getZ(i)
        pos.setX(i, z*.24*Math.sin(this.animTime*4.3 + z*10 + obj.id))
      }
      pos.needsUpdate = true
    }
    for (const [id, rec] of this.shipMeshes.entries()) {
      const flag = rec.group.getObjectByName("mastheadPennant")
      if (flag && this.seaGroup.visible) flutter(flag)
      rec.group.position.y = 0.06 + Math.sin(this.animTime * 2.4 + id * 1.3) * 0.045
      rec.group.rotation.z = Math.sin(this.animTime * 1.8 + id) * 0.04
    }

    if (this.townGroup.visible) {
      for (const puff of this.smoke) {
        const t = (this.animTime*.41 + puff.userData.phase) % 1
        puff.position.set(.72*t*t, .09+1.48*t, .11*Math.sin(t*6))
        puff.scale.setScalar(.48+t*.95)
        puff.material.opacity = .31*(1-t)*Math.min(1,t*9)
      }
      // Windmill rotation
      this.townGroup.traverse((obj) => {
        flutter(obj)
        if (obj.name === "windmillBlades") {
          obj.rotation.z -= dtSeconds * 1.15
        }
      })

      // Living porters & carts strolling the waterfront!
      for (const w of this.townWalkers) {
        const t = (Math.sin(this.animTime * w.speed + w.phase) + 1) * 0.5
        const nx = w.ax + (w.bx - w.ax) * t
        const nz = w.az + (w.bz - w.az) * t
        const dir = Math.cos(this.animTime * w.speed + w.phase) >= 0 ? 1 : -1
        w.mesh.position.x = nx
        w.mesh.position.z = nz
        w.mesh.rotation.y = Math.atan2((w.bx - w.ax) * dir, (w.bz - w.az) * dir)
      }

      // Circling ink gulls
      for (const gull of this.townGulls) {
        const a = this.animTime * gull.speed + gull.offset
        gull.mesh.position.set(
          Math.cos(a) * gull.radius,
          gull.height + Math.sin(a * 2.2) * 0.35,
          6 + Math.sin(a) * gull.radius * 0.55
        )
        gull.mesh.rotation.y = -a
      }

      // Harbor Crane cargo sling swing on live trades!
      if (this.townCrane) {
        const jib = this.townCrane.getObjectByName("craneJib")
        const crate = this.townCrane.getObjectByName("craneCrate")
        if (jib && crate) {
          if (this.craneSwingTimer > 0) {
            this.craneSwingTimer = Math.max(0, this.craneSwingTimer - dtSeconds)
            const p = 1 - this.craneSwingTimer / 1.4
            jib.rotation.y = Math.sin(p * Math.PI) * 1.15
            crate.visible = true
            crate.position.y = -1.15 + Math.sin(p * Math.PI) * 0.45
          } else {
            jib.rotation.y *= 0.9
            crate.visible = false
          }
        }
      }

      // Falling winter ink snowflakes
      if (this.townSnow) {
        const pos = this.townSnow.geometry.attributes["position"] as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - dtSeconds * 1.4
          if (y < 0.8) y = 12.5
          pos.setY(i, y)
        }
        pos.needsUpdate = true
      }
    }

    if (this.latestView && this.currentViewMode === "sea") {
      for (const city of this.latestView.cities) {
        if (city.famineDays > 0) {
          const ring = this.cityRings.get(city.id)
          if (ring) {
            const mat = ring.material as THREE.MeshBasicMaterial
            mat.opacity = 0.42 + 0.45 * Math.abs(Math.sin(this.animTime * 3.2))
          }
        }
      }
    }

    this.renderer.render(this.scene, this.camera)
    if (this.currentViewMode === "sea") {
      this.updateCityBadgePositions()
    }
  }

  private updateCameraTransform(alpha: number): void {
    this.camTarget.lerp(this.desiredTarget, alpha)
    this.camZoom += (this.desiredZoom - this.camZoom) * alpha
    this.camYaw += (this.desiredYaw - this.camYaw) * alpha
    this.camPitch += (this.desiredPitch - this.camPitch) * alpha

    const aspect = Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight)
    this.camera.left = -this.camZoom * aspect
    this.camera.right = this.camZoom * aspect
    this.camera.top = this.camZoom
    this.camera.bottom = -this.camZoom
    this.camera.updateProjectionMatrix()

    const dist = 75
    const horiz = Math.cos(this.camPitch) * dist
    const vert = Math.sin(this.camPitch) * dist
    this.camera.position.set(
      this.camTarget.x + Math.sin(this.camYaw) * horiz,
      this.camTarget.y + vert,
      this.camTarget.z + Math.cos(this.camYaw) * horiz
    )
    this.camera.lookAt(this.camTarget)
  }

  private updateCityBadgePositions(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    const v = new THREE.Vector3()
    const occupied = Array.from(document.querySelectorAll<HTMLElement>(
      ".hud-top-bar .ink-card, .hud-top-bar .ink-btn, .ledger-drawer, .hud-bottom-left"
    ), el => el.getBoundingClientRect()).filter(rect => rect.width && rect.height)
    const selected = this.latestView?.selection.selectedCityId
    const ordered = Array.from(this.cityBadges.entries()).sort(([a],[b]) =>
      Number(b === selected) - Number(a === selected))
    for (const [id, badge] of ordered) {
      const def = CITIES[id]
      // Position badge cleanly above the city spires (away from harbor ship berth!)
      v.set(def.x, 3.2, def.z + 0.65)
      v.project(this.camera)
      if (v.z > 1) {
        badge.el.style.display = "none"
        continue
      }
      const sx = (v.x * 0.5 + 0.5) * w
      const sy = (-v.y * 0.5 + 0.5) * h
      badge.el.style.display = "flex"
      const width = badge.el.offsetWidth
      const height = badge.el.offsetHeight
      const rect = new DOMRect(sx-width/2, sy-height, width, height)
      const blocked = occupied.some(other => rect.left < other.right+2 && rect.right > other.left-2
        && rect.top < other.bottom+2 && rect.bottom > other.top-2)
      badge.el.style.visibility = blocked ? "hidden" : "visible"
      if (!blocked) occupied.push(rect)
      badge.el.style.transform = `translate(-50%, -100%) translate(${Math.round(sx)}px, ${Math.round(sy)}px)`
    }
  }

  // ── Pointer Controls (Pan, Zoom, Rotate, Pick Landmarks/Ships/Plots) ────

  private bindEvents(): void {
    const dom = this.renderer.domElement

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 1) {
        this.dragging = true
        this.dragMoved = false
        this.lastX = e.clientX
        this.lastY = e.clientY
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!this.dragging) return
      const dx = e.clientX - this.lastX
      const dy = e.clientY - this.lastY
      if (Math.abs(dx) + Math.abs(dy) > 4) this.dragMoved = true
      this.lastX = e.clientX
      this.lastY = e.clientY

      if (e.shiftKey || e.buttons === 4) {
        this.desiredYaw -= dx * 0.006
        this.desiredPitch = Math.max(0.38, Math.min(1.18, this.desiredPitch + dy * 0.005))
      } else {
        const panSpeed = this.camZoom * 0.0024
        const sinY = Math.sin(this.camYaw)
        const cosY = Math.cos(this.camYaw)
        this.desiredTarget.x -= (dx * cosY + dy * sinY) * panSpeed
        this.desiredTarget.z -= (-dx * sinY + dy * cosY) * panSpeed
        const limit = this.currentViewMode === "sea" ? 42 : 14
        this.desiredTarget.x = Math.max(-limit, Math.min(limit, this.desiredTarget.x))
        this.desiredTarget.z = Math.max(-limit * 0.75, Math.min(limit * 0.75, this.desiredTarget.z))
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!this.dragging) return
      this.dragging = false
      if (!this.dragMoved && e.button === 0) {
        this.pickAt(e.clientX, e.clientY, false)
      }
    }

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      this.pickAt(e.clientX, e.clientY, true)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const minZ = this.currentViewMode === "sea" ? 9 : 7.5
      const maxZ = this.currentViewMode === "sea" ? 36 : 24
      this.desiredZoom = Math.max(minZ, Math.min(maxZ, this.desiredZoom + e.deltaY * 0.015))
    }

    const onResize = () => {
      const w = Math.max(1, this.container.clientWidth)
      const h = Math.max(1, this.container.clientHeight)
      this.renderer.setSize(w, h)
      this.updateCameraTransform(1)
    }

    const sig = this.eventsAbort.signal
    dom.addEventListener("pointerdown", onPointerDown, { signal: sig })
    window.addEventListener("pointermove", onPointerMove, { signal: sig })
    window.addEventListener("pointerup", onPointerUp, { signal: sig })
    dom.addEventListener("contextmenu", onContextMenu, { signal: sig })
    dom.addEventListener("wheel", onWheel, { passive: false, signal: sig })
    window.addEventListener("resize", onResize, { signal: sig })
  }

  private pickAt(clientX: number, clientY: number, isRightClick: boolean): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const targetRoot = this.currentViewMode === "sea" ? this.seaGroup : this.townGroup
    const hits = this.raycaster.intersectObjects(targetRoot.children, true)
    for (const hit of hits) {
      const data = hit.object.userData
      if (data["pickKind"] === "ship" && typeof data["shipId"] === "number") {
        if (!isRightClick) this.callbacks.onSelectShip(data["shipId"])
        return
      }
      if (data["pickKind"] === "city" && typeof data["cityId"] === "string") {
        const cid = data["cityId"] as CityId
        if (isRightClick) {
          this.callbacks.onRightClickCity(cid)
          return
        }
        const now = performance.now()
        if (this.lastClickCity === cid && now - this.lastClickTime < 340) {
          this.callbacks.onDoubleClickCity(cid)
        } else {
          this.callbacks.onSelectCity(cid)
        }
        this.lastClickCity = cid
        this.lastClickTime = now
        return
      }
      if (data["pickKind"] === "plot" && typeof data["plotIndex"] === "number") {
        if (!isRightClick) this.callbacks.onClickBuildPlot(data["plotIndex"])
        return
      }
      if (data["pickKind"] === "landmark" && typeof data["tab"] === "string") {
        if (!isRightClick) this.callbacks.onClickLandmarkTab(data["tab"] as PanelTab)
        return
      }
    }
  }

  public dispose(): void {
    this.disposed = true
    this.eventsAbort.abort()
    this.clearGroup(this.seaGroup)
    this.clearGroup(this.townGroup)
    this.scene.traverse(obj => {
      if (obj instanceof THREE.DirectionalLight) obj.shadow.dispose()
    })
    this.labelLayer.remove()
    this.renderer.domElement.remove()
    this.renderer.dispose()
  }
}
