import * as THREE from "three"
import type { BusinessId, CityDef, MerchantMarkId, SeasonId, ShipClassId, ShipOwner } from "../sim/index.ts"
import { createInkEdgeMaterial, createInkPaperMaterial, createSilhouetteShell } from "./inkShader.ts"
import type { InklineTheme } from "./palette.ts"

// ── Core Inkline 3D Solid with Multi-Weight Line Hierarchy ───────────────

export function createInkSolid(
  geometry: THREE.BufferGeometry,
  fillColor: string,
  inkColor: string,
  opts: {
    readonly edgeThreshold?: number
    readonly edgeOpacity?: number
    readonly silhouette?: number
    readonly hatchStrength?: number
    readonly castShadow?: boolean
    readonly receiveShadow?: boolean
  } = {}
): THREE.Group {
  const group = new THREE.Group()
  const mat = createInkPaperMaterial(fillColor, inkColor, {
    hatchStrength: opts.hatchStrength ?? 0.22
  })
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.castShadow = opts.castShadow ?? true
  mesh.receiveShadow = opts.receiveShadow ?? true
  group.add(mesh)

  if (opts.silhouette && opts.silhouette > 0) {
    group.add(createSilhouetteShell(geometry, inkColor, opts.silhouette))
  }

  const edges = new THREE.EdgesGeometry(geometry, opts.edgeThreshold ?? 22)
  const lines = new THREE.LineSegments(
    edges,
    createInkEdgeMaterial(inkColor, opts.edgeOpacity ?? 0.62)
  )
  group.add(lines)
  return group
}

// ── Human-Scale Hanseatic Brick-Gothic Stepped Gable House / Warehouse ───

export function createSteppedGableBuilding(
  width: number,
  height: number,
  depth: number,
  wallColor: string,
  roofColor: string,
  inkColor: string,
  opts: {
    readonly detailedFacade?: boolean
    readonly hoistBeam?: boolean
    readonly snowRoof?: boolean
    readonly silhouette?: number
  } = {}
): THREE.Group {
  const g = new THREE.Group()
  const effectiveRoof = opts.snowRoof ? "#f8faf6" : roofColor

  // Main plaster/brick body
  const body = createInkSolid(
    new THREE.BoxGeometry(width, height, depth),
    wallColor,
    inkColor,
    { silhouette: opts.silhouette ?? 0.025, hatchStrength: 0.24 }
  )
  body.position.y = height / 2
  g.add(body)

  // Pitched roof prism
  const roofH = width * 0.54
  const roofShape = new THREE.Shape()
  roofShape.moveTo(-width / 2, 0)
  roofShape.lineTo(0, roofH)
  roofShape.lineTo(width / 2, 0)
  roofShape.closePath()
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: depth * 0.94,
    bevelEnabled: false
  })
  roofGeo.translate(0, height, -depth * 0.47)
  const roof = createInkSolid(roofGeo, effectiveRoof, inkColor, {
    edgeThreshold: 18,
    silhouette: opts.silhouette ?? 0.024,
    hatchStrength: 0.26
  })
  g.add(roof)

  // Stepped Gothic gable parapet (4 crisp tiers front & back)
  for (let tier = 0; tier < 4; tier++) {
    const tW = width * (0.9 - tier * 0.21)
    const tH = roofH * 0.28
    const step = createInkSolid(
      new THREE.BoxGeometry(tW, tH, 0.14),
      roofColor,
      inkColor,
      { hatchStrength: 0.2 }
    )
    step.position.set(0, height + tH * 0.5 + tier * (tH * 0.8), depth / 2 - 0.03)
    g.add(step)
  }

  // Human-scale architectural facade details (dark arched loading door, rows of narrow windows, loft hatch, hoist beam!)
  if (opts.detailedFacade) {
    const frontZ = depth / 2 + 0.025
    const darkInkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(inkColor) })

    // Ground-floor arched loading door
    const doorW = Math.min(0.42, width * 0.3)
    const doorH = Math.min(0.62, height * 0.42)
    const radius = doorW / 2
    const opening = new THREE.Shape()
    opening.moveTo(-radius, 0)
    opening.lineTo(radius, 0)
    opening.absarc(0, doorH-radius, radius, 0, Math.PI, false)
    opening.closePath()
    const door = new THREE.Mesh(new THREE.ShapeGeometry(opening), darkInkMat)
    door.position.set(0, .02, frontZ)
    g.add(door)

    // Two rows of narrow merchant windows
    const winW = Math.min(0.16, width * 0.12)
    const winH = Math.min(0.28, height * 0.19)
    const cols = width >= 2.2 ? [-0.32, -0.11, 0.11, 0.32] : [-0.26, 0.26]
    const rows = height >= 1.5 ? [0.48, 0.78] : [0.68]
    for (const ry of rows) {
      for (const cx of cols) {
        // Leave center clear on lower row above loading arch
        const win = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), darkInkMat)
        win.position.set(cx * width, ry * height, frontZ)
        g.add(win)
      }
    }

    // Gable loft hatch under the stepped apex
    const loft = new THREE.Mesh(
      new THREE.PlaneGeometry(winW * 1.4, winH * 1.15),
      darkInkMat
    )
    loft.position.set(0, height + roofH * 0.36, depth / 2 + 0.06)
    g.add(loft)

    // Projecting timber hoist beam (classic Hanseatic warehouse crane beam!)
    if (opts.hoistBeam) {
      const beam = createInkSolid(
        new THREE.BoxGeometry(0.08, 0.08, 0.65),
        inkColor,
        inkColor,
        { castShadow: false }
      )
      beam.position.set(0, height + roofH * 0.66, depth / 2 + 0.28)
      g.add(beam)
    }

    // Subtle light horizontal cornice & timber framing ink lines
    const cornicePts = [
      new THREE.Vector3(-width / 2, height * 0.36, frontZ + 0.01),
      new THREE.Vector3(width / 2, height * 0.36, frontZ + 0.01),
      new THREE.Vector3(-width / 2, height * 0.96, frontZ + 0.01),
      new THREE.Vector3(width / 2, height * 0.96, frontZ + 0.01)
    ]
    // Radial brick joints above the opening and braced panels on both long walls.
    for (let i = 0; i <= 10; i++) {
      const angle = i * Math.PI / 10
      for (const r of [radius, radius * 1.38]) {
        cornicePts.push(new THREE.Vector3(Math.cos(angle)*r, .02+doorH-radius+Math.sin(angle)*r, frontZ))
      }
    }
    for (const side of [-1, 1]) {
      const x = side * (width/2 + .012)
      for (let bay = 0; bay < 4; bay++) {
        const z = depth*(bay/4-.5)
        const end = z + depth/4
        const post = (y: number, at: number) => new THREE.Vector3(x,height*y,at)
        cornicePts.push(post(.07,z),post(.95,z),post(.48,z),post(.48,end),
          post(.48,z),post(.92,end),post(.92,z),post(.48,end))
      }
    }
    g.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(cornicePts),
        createInkEdgeMaterial(inkColor, 0.45)
      )
    )
  }

  return g
}

// ── Iconic Hanseatic Cathedral (restrained ink/paper spire tones!) ───────

export function createCathedral(
  scale: number,
  theme: InklineTheme,
  roofAccent: string,
  spireCount = 2,
  snowRoof = false
): THREE.Group {
  const g = new THREE.Group()

  const nave = createSteppedGableBuilding(
    1.15 * scale,
    1.1 * scale,
    2.25 * scale,
    theme.paperCard,
    roofAccent,
    theme.inkPrimary,
    { detailedFacade: true, snowRoof, silhouette: 0.03 }
  )
  g.add(nave)

  // Muted architectural slate/ink-wash copper spires (keeps Inkline palette restrained!)
  const spireColor = snowRoof ? "#f4f7f2" : theme.paperRecessed
  for (const side of [-0.36, 0.36]) {
    const tower = createInkSolid(
      new THREE.BoxGeometry(0.44 * scale, 2.0 * scale, 0.44 * scale),
      theme.paperCard,
      theme.inkPrimary,
      { silhouette: 0.028 }
    )
    tower.position.set(side * scale, 1.0 * scale, 0.9 * scale)
    g.add(tower)

    const spire = createInkSolid(
      new THREE.ConeGeometry(0.25 * scale, 1.55 * scale, 4),
      spireColor,
      theme.inkPrimary,
      { edgeThreshold: 14, silhouette: 0.025 }
    )
    spire.rotation.y = Math.PI / 4
    spire.position.set(side * scale, (2.0 + 0.775) * scale, 0.9 * scale)
    g.add(spire)
  }

  // Extra crossing ridge turrets for Lübeck's famous Seven Spires silhouette!
  if (spireCount >= 3) {
    const turret = createInkSolid(
      new THREE.ConeGeometry(0.16 * scale, 1.2 * scale, 4),
      spireColor,
      theme.inkPrimary,
      { edgeThreshold: 14 }
    )
    turret.position.set(0, 2.35 * scale, -0.45 * scale)
    g.add(turret)
  }

  return g
}

// ── Signature Hanseatic City Landmarks (Recognizable without labels!) ────

export function createCityLandmark(
  landmark: CityDef["landmark"],
  scale: number,
  theme: InklineTheme,
  roofAccent: string,
  snowRoof = false
): THREE.Group {
  const g = new THREE.Group()
  const roof = snowRoof ? "#f6f8f4" : roofAccent

  switch (landmark) {
    case "holstentor": {
      // Lübeck's iconic twin round brick towers with conical caps & central arched gatehouse!
      const center = createSteppedGableBuilding(
        1.4 * scale,
        1.35 * scale,
        1.1 * scale,
        theme.paperCard,
        roof,
        theme.inkPrimary,
        { detailedFacade: true, snowRoof, silhouette: 0.03 }
      )
      g.add(center)

      for (const side of [-0.92, 0.92]) {
        const cyl = createInkSolid(
          new THREE.CylinderGeometry(0.54 * scale, 0.58 * scale, 1.85 * scale, 10),
          theme.paperCard,
          theme.inkPrimary,
          { silhouette: 0.032 }
        )
        cyl.position.set(side * scale, 0.925 * scale, 0.08 * scale)
        g.add(cyl)

        const cap = createInkSolid(
          new THREE.ConeGeometry(0.58 * scale, 1.15 * scale, 10),
          roof,
          theme.inkPrimary,
          { silhouette: 0.028 }
        )
        cap.position.set(side * scale, (1.85 + 0.575) * scale, 0.08 * scale)
        g.add(cap)
      }
      break
    }
    case "bryggen": {
      // Bergen's iconic Bryggen: tight row of 5 tall narrow wooden waterfront gables!
      const shades = [theme.paperCard, roof, theme.paperRecessed, theme.accentOchreWash, theme.paperCard]
      for (let i = 0; i < 5; i++) {
        const h = (1.35 + (i % 2) * 0.25) * scale
        const house = createSteppedGableBuilding(
          0.74 * scale,
          h,
          1.7 * scale,
          shades[i] ?? theme.paperCard,
          i % 2 === 0 ? roof : theme.paperRecessed,
          theme.inkPrimary,
          { detailedFacade: true, hoistBeam: i % 2 === 1, snowRoof }
        )
        house.position.set((-1.56 + i * 0.78) * scale, 0, 0)
        g.add(house)
      }
      break
    }
    case "krantor": {
      // Danzig's legendary twin brick towers bridged by a dark overhanging wooden crane house!
      for (const side of [-0.75, 0.75]) {
        const t = createInkSolid(
          new THREE.CylinderGeometry(0.48 * scale, 0.52 * scale, 1.9 * scale, 8),
          theme.paperCard,
          theme.inkPrimary,
          { silhouette: 0.03 }
        )
        t.position.set(side * scale, 0.95 * scale, 0)
        g.add(t)
      }
      const craneHouse = createInkSolid(
        new THREE.BoxGeometry(1.55 * scale, 1.5 * scale, 1.55 * scale),
        theme.inkPrimary,
        theme.inkDeep,
        { silhouette: 0.035 }
      )
      craneHouse.position.set(0, 1.75 * scale, 0.35 * scale)
      g.add(craneHouse)
      const cap = createInkSolid(
        new THREE.ConeGeometry(1.05 * scale, 0.85 * scale, 4),
        roof,
        theme.inkPrimary
      )
      cap.rotation.y = Math.PI / 4
      cap.position.set(0, 2.92 * scale, 0.35 * scale)
      g.add(cap)
      break
    }
    case "ringmur": {
      // Visby's tall pale limestone medieval Ringmur gate & watchtowers
      const wall = createInkSolid(
        new THREE.BoxGeometry(3.4 * scale, 1.55 * scale, 0.55 * scale),
        theme.paperCard,
        theme.inkPrimary,
        { silhouette: 0.03 }
      )
      wall.position.set(0, 0.78 * scale, 0)
      g.add(wall)
      for (const side of [-1.45, 0, 1.45]) {
        const tw = createInkSolid(
          new THREE.BoxGeometry(0.75 * scale, 2.55 * scale, 0.82 * scale),
          theme.paperCard,
          theme.inkPrimary,
          { silhouette: 0.03 }
        )
        tw.position.set(side * scale, 1.28 * scale, 0)
        g.add(tw)
      }
      break
    }
    case "towerBridge": {
      // London's White Tower keep with 4 corner turrets
      const keep = createInkSolid(
        new THREE.BoxGeometry(1.9 * scale, 1.9 * scale, 1.6 * scale),
        theme.paperCard,
        theme.inkPrimary,
        { silhouette: 0.035 }
      )
      keep.position.set(0, 0.95 * scale, 0)
      g.add(keep)
      for (const sx of [-0.9, 0.9]) {
        for (const sz of [-0.75, 0.75]) {
          const turret = createInkSolid(
            new THREE.CylinderGeometry(0.24 * scale, 0.26 * scale, 2.55 * scale, 6),
            theme.paperCard,
            theme.inkPrimary
          )
          turret.position.set(sx * scale, 1.28 * scale, sz * scale)
          g.add(turret)
        }
      }
      break
    }
    case "speicherstadt": {
      // Hamburg's long brick canal warehouse frontage
      for (let i = 0; i < 3; i++) {
        const w = createSteppedGableBuilding(
          1.15 * scale,
          1.5 * scale,
          1.35 * scale,
          theme.paperCard,
          roof,
          theme.inkPrimary,
          { detailedFacade: true, hoistBeam: true, snowRoof }
        )
        w.position.set((-1.2 + i * 1.2) * scale, 0, 0)
        g.add(w)
      }
      break
    }
    default: {
      // Distinctive civic granary / guildhall landmark
      const hall = createSteppedGableBuilding(
        2.1 * scale,
        1.55 * scale,
        1.5 * scale,
        theme.paperCard,
        roof,
        theme.inkPrimary,
        { detailedFacade: true, hoistBeam: true, snowRoof, silhouette: 0.03 }
      )
      g.add(hall)
      break
    }
  }

  return g
}

// ── Medieval Wooden Harbour Crane (with animated boom & cargo sling!) ────

export function createHarborCrane(scale: number, theme: InklineTheme): THREE.Group {
  const g = new THREE.Group()
  const base = createInkSolid(
    new THREE.CylinderGeometry(0.32 * scale, 0.44 * scale, 0.98 * scale, 6),
    theme.paperCard,
    theme.inkPrimary,
    { silhouette: 0.025 }
  )
  base.position.y = 0.49 * scale
  g.add(base)

  const cap = createInkSolid(
    new THREE.ConeGeometry(0.46 * scale, 0.46 * scale, 6),
    theme.paperRecessed,
    theme.inkPrimary
  )
  cap.position.y = 1.2 * scale
  g.add(cap)

  const jibPivot = new THREE.Group()
  jibPivot.name = "craneJib"
  jibPivot.position.set(0, 1.08 * scale, 0)

  const boom = createInkSolid(
    new THREE.BoxGeometry(0.11 * scale, 0.11 * scale, 1.55 * scale),
    theme.inkPrimary,
    theme.inkDeep
  )
  boom.position.set(0, 0.25 * scale, 0.65 * scale)
  boom.rotation.x = -0.35
  jibPivot.add(boom)

  // Rope + hanging cargo sling (animated during trades!)
  const slingGroup = new THREE.Group()
  slingGroup.name = "craneSling"
  slingGroup.position.set(0, 0.42 * scale, 1.28 * scale)

  const rope = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.95 * scale, 0)
    ]),
    createInkEdgeMaterial(theme.inkDeep, 0.9)
  )
  slingGroup.add(rope)

  const crate = createInkSolid(
    new THREE.BoxGeometry(0.32 * scale, 0.26 * scale, 0.32 * scale),
    theme.accentRed,
    theme.inkDeep
  )
  crate.position.set(0, -1.05 * scale, 0)
  crate.name = "craneCrate"
  slingGroup.add(crate)

  jibPivot.add(slingGroup)
  g.add(jibPivot)
  return g
}

// ── Sea Map City Silhouette Cluster (Unique per City!) ───────────────────

export function createSeaMapCityCluster(
  def: CityDef,
  theme: InklineTheme,
  wallLevel: number,
  kontorOwned: boolean,
  snowRoof = false
): THREE.Group {
  const root = new THREE.Group()
  root.userData = { pickKind: "city", cityId: def.id }

  // Low clean ink plinth (no heavy grey polygon!)
  const plinth = createInkSolid(
    new THREE.CylinderGeometry(1.95, 2.08, 0.2, 10),
    theme.paperCard,
    theme.inkPrimary,
    { edgeOpacity: 0.65, castShadow: false }
  )
  plinth.position.y = 0.1
  root.add(plinth)

  // Defensive ring wall (weight & height scales with wallLevel)
  const wallH = wallLevel === 3 ? 0.52 : wallLevel === 2 ? 0.36 : 0.22
  const wallRing = createInkSolid(
    new THREE.CylinderGeometry(1.82, 1.86, wallH, 10, 1, true),
    theme.paperCard,
    theme.inkPrimary,
    { edgeOpacity: wallLevel >= 2 ? 0.85 : 0.55 }
  )
  wallRing.position.y = 0.2 + wallH / 2
  root.add(wallRing)

  // Signature landmark so each port reads by silhouette even without labels!
  const landmark = createCityLandmark(def.landmark, 0.68, theme, def.roofAccent, snowRoof)
  landmark.position.set(-0.35, 0.2, 0.15)
  root.add(landmark)

  // Cathedral spires behind landmark
  const church = createCathedral(0.56, theme, def.roofAccent, def.spireCount, snowRoof)
  church.position.set(0.45, 0.2, -0.45)
  root.add(church)

  // Harbor Crane pointing toward open water
  const crane = createHarborCrane(0.55, theme)
  const harborAngle = Math.atan2(def.harborX - def.x, def.harborZ - def.z)
  crane.position.set(Math.sin(harborAngle) * 1.55, 0.2, Math.cos(harborAngle) * 1.55)
  crane.rotation.y = harborAngle
  root.add(crane)

  // Kontor Pennant (crisp Guild Blue flag when owned)
  if (kontorOwned) {
    const pole = createInkSolid(
      new THREE.CylinderGeometry(0.032, 0.032, 2.35, 4),
      theme.inkDeep,
      theme.inkDeep
    )
    pole.position.set(1.22, 1.38, 0.95)
    root.add(pole)

    const banner = createInkSolid(
      new THREE.BoxGeometry(0.75, 0.38, 0.05),
      theme.accentBlue,
      theme.inkDeep
    )
    banner.position.set(1.6, 2.32, 0.95)
    root.add(banner)
  }

  return root
}

// ── Curved Billowing Sail Helper ─────────────────────────────────────────

function createBillowingSail(
  width: number,
  height: number,
  fillColor: string,
  trimColor: string,
  inkColor: string
): THREE.Group {
  const g = new THREE.Group()
  const geo = new THREE.PlaneGeometry(width, height, 6, 4)
  const pos = geo.attributes["position"]
  if (pos) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const nx = x / (width * 0.5)
      const ny = y / (height * 0.5)
      // Parabolic wind-filled belly pushing forward (+Z)
      const bulge = (1 - nx * nx * 0.65) * (1 - ny * ny * 0.8) * width * 0.22
      pos.setZ(i, bulge)
    }
    geo.computeVertexNormals()
  }

  const mat = createInkPaperMaterial(fillColor, inkColor, { hatchStrength: 0.16 })
  ;(mat as THREE.MeshToonMaterial).side = THREE.DoubleSide
  const sailMesh = new THREE.Mesh(geo, mat)
  sailMesh.castShadow = true
  g.add(sailMesh)

  const edges = new THREE.EdgesGeometry(geo, 18)
  g.add(new THREE.LineSegments(edges, createInkEdgeMaterial(inkColor, 0.85)))

  // Heraldic Merchant's Mark stripe across the sail belly
  const band = createInkSolid(
    new THREE.BoxGeometry(width * 0.88, height * 0.18, 0.04),
    trimColor,
    inkColor,
    { castShadow: false }
  )
  band.position.z = width * 0.21
  g.add(band)

  return g
}

// ── 3D Inkline Hanseatic Ships (Billowing Sails, Bowsprit, Deck Cargo, V-Wake) ──

export function createShipModel(
  shipClass: ShipClassId,
  owner: ShipOwner,
  theme: InklineTheme,
  cargoRatio = 0,
  _merchantMark: MerchantMarkId = "cross"
): THREE.Group {
  const root = new THREE.Group()

  const scale =
    shipClass === "hulk" ? 1.28 : shipClass === "cog" ? 1.1 : shipClass === "kraier" ? 0.94 : 0.78

  const hullColor =
    owner === "pirate"
      ? theme.pirateFill
      : owner === "player"
        ? theme.paperCard
        : theme.paperRecessed
  const sailColor =
    owner === "pirate"
      ? theme.pirateFill
      : owner === "player"
        ? "#ffffff"
        : theme.landTop
  const trimColor =
    owner === "pirate"
      ? theme.accentRed
      : owner === "player"
        ? theme.accentBlue
        : theme.accentOchre

  // Tapered hull with inverted-hull silhouette
  const hullShape = new THREE.Shape()
  hullShape.moveTo(0, 1.2 * scale)
  hullShape.quadraticCurveTo(0.48 * scale, 0.45 * scale, 0.42 * scale, -0.86 * scale)
  hullShape.lineTo(-0.42 * scale, -0.86 * scale)
  hullShape.quadraticCurveTo(-0.48 * scale, 0.45 * scale, 0, 1.2 * scale)

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.42 * scale,
    bevelEnabled: false
  })
  hullGeo.rotateX(Math.PI / 2)
  hullGeo.translate(0, 0.42 * scale, 0)
  const hull = createInkSolid(hullGeo, hullColor, theme.inkDeep, {
    edgeThreshold: 18,
    silhouette: 0.025
  })
  root.add(hull)

  // Bowsprit spar projecting forward
  const sprit = createInkSolid(
    new THREE.CylinderGeometry(0.024 * scale, 0.036 * scale, 0.75 * scale, 5),
    theme.inkPrimary,
    theme.inkDeep
  )
  sprit.rotation.x = Math.PI / 2 - 0.35
  sprit.position.set(0, 0.56 * scale, 1.28 * scale)
  root.add(sprit)

  // Stern castle on Kraier, Cog & Hulk
  if (shipClass !== "snaikka") {
    const castleH = shipClass === "hulk" ? 0.46 * scale : 0.34 * scale
    const castle = createInkSolid(
      new THREE.BoxGeometry(0.76 * scale, castleH, 0.58 * scale),
      trimColor,
      theme.inkDeep
    )
    castle.position.set(0, 0.42 * scale + castleH / 2, -0.58 * scale)
    root.add(castle)
  }

  // Visible Deck Cargo Crates when carrying goods!
  if (cargoRatio > 0.02) {
    const crateCount = Math.min(4, Math.ceil(cargoRatio * 4))
    for (let i = 0; i < crateCount; i++) {
      const crate = createInkSolid(
        new THREE.BoxGeometry(0.24 * scale, 0.2 * scale, 0.24 * scale),
        i % 2 === 0 ? theme.accentRed : theme.accentOchre,
        theme.inkDeep
      )
      crate.position.set((i % 2 === 0 ? -0.15 : 0.15) * scale, 0.52 * scale, (0.32 - Math.floor(i / 2) * 0.28) * scale)
      root.add(crate)
    }
  }

  // Masts, curved billowing sails & rigging lines
  const mastZPositions =
    shipClass === "hulk"
      ? [0.42 * scale, -0.08 * scale, -0.55 * scale]
      : shipClass === "kraier"
        ? [0.22 * scale, -0.35 * scale]
        : [0.08 * scale]

  mastZPositions.forEach((mz, idx) => {
    const isMain = idx === 0 || (shipClass === "hulk" && idx === 1)
    const mastH = (isMain ? 1.92 : 1.4) * scale
    const mast = createInkSolid(
      new THREE.CylinderGeometry(0.03 * scale, 0.042 * scale, mastH, 5),
      theme.inkPrimary,
      theme.inkDeep
    )
    mast.position.set(0, 0.4 * scale + mastH / 2, mz)
    root.add(mast)

    // Yardarm
    const sailW = (isMain ? 1.24 : 0.86) * scale
    const sailH = (isMain ? 0.98 : 0.7) * scale
    const yard = createInkSolid(
      new THREE.CylinderGeometry(0.022 * scale, 0.022 * scale, sailW * 1.12, 5),
      theme.inkDeep,
      theme.inkDeep
    )
    yard.rotation.z = Math.PI / 2
    yard.position.set(0, 0.42 * scale + mastH * 0.82, mz + 0.04 * scale)
    root.add(yard)

    // Curved billowing sail
    const sail = createBillowingSail(sailW, sailH, sailColor, trimColor, theme.inkDeep)
    sail.position.set(0, 0.42 * scale + mastH * 0.56, mz + 0.06 * scale)
    root.add(sail)

    // Fine ink rigging shroud lines
    const rigPts = [
      new THREE.Vector3(0, 0.4 * scale + mastH * 0.9, mz),
      new THREE.Vector3(-0.4 * scale, 0.42 * scale, mz - 0.2 * scale),
      new THREE.Vector3(0, 0.4 * scale + mastH * 0.9, mz),
      new THREE.Vector3(0.4 * scale, 0.42 * scale, mz - 0.2 * scale)
    ]
    root.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(rigPts),
        createInkEdgeMaterial(theme.inkPrimary, 0.55)
      )
    )
  })

  // Masthead pennant
  const cloth = new THREE.BufferGeometry()
  const vertices: number[] = []
  const faces: number[] = []
  for (let i = 0; i <= 6; i++) {
    const t = i / 6
    vertices.push(0, .09*scale*(1-t), -.54*scale*t, 0, -.10*scale*(1-t), -.54*scale*t)
    if (i < 6) faces.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2)
  }
  cloth.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
  cloth.setIndex(faces)
  const pennant = new THREE.Mesh(cloth,new THREE.MeshBasicMaterial({ color: trimColor, side: THREE.DoubleSide }))
  pennant.name = "mastheadPennant"
  pennant.position.set(0, 2.34 * scale, 0)
  root.add(pennant)

  // Trailing V-shaped ink wake behind ship (shown/stretched while sailing!)
  const wakePts = [
    new THREE.Vector3(0, 0.04, -0.82 * scale),
    new THREE.Vector3(-0.75 * scale, 0.04, -2.15 * scale),
    new THREE.Vector3(0, 0.04, -0.82 * scale),
    new THREE.Vector3(0.75 * scale, 0.04, -2.15 * scale),
    new THREE.Vector3(-0.35 * scale, 0.04, -1.35 * scale),
    new THREE.Vector3(0.35 * scale, 0.04, -1.35 * scale)
  ]
  const wake = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(wakePts),
    createInkEdgeMaterial(owner === "player" ? theme.accentBlue : theme.seaWaveInk, 0.6)
  )
  wake.name = "vWake"
  root.add(wake)

  return root
}

// ── 3D Wooden Construction Scaffolding & Ribbed Drydock Hull ─────────────

export function createConstructionScaffolding(theme: InklineTheme): THREE.Group {
  const g = new THREE.Group()
  // Half-built masonry foundation
  const wall = createInkSolid(
    new THREE.BoxGeometry(1.85, 0.68, 1.45),
    theme.paperRecessed,
    theme.inkPrimary
  )
  wall.position.y = 0.34
  g.add(wall)

  // Timber scaffold posts & crossbeams
  for (const sx of [-1.02, 1.02]) {
    for (const sz of [-0.82, 0.82]) {
      const post = createInkSolid(
        new THREE.BoxGeometry(0.09, 1.85, 0.09),
        theme.accentOchre,
        theme.inkDeep
      )
      post.position.set(sx, 0.92, sz)
      g.add(post)
    }
  }
  for (const py of [0.85, 1.55]) {
    const plank = createInkSolid(
      new THREE.BoxGeometry(2.18, 0.07, 0.32),
      theme.paperCard,
      theme.inkPrimary
    )
    plank.position.set(0, py, 0.82)
    g.add(plank)
  }
  return g
}

export function createDrydockHull(theme: InklineTheme): THREE.Group {
  const g = new THREE.Group()
  // Keel timber
  const keel = createInkSolid(
    new THREE.BoxGeometry(0.22, 0.22, 2.8),
    theme.accentOchre,
    theme.inkDeep
  )
  keel.position.y = 0.2
  g.add(keel)

  // Ribbed frames rising along the keel
  for (let i = -3; i <= 3; i++) {
    const w = 1.15 - Math.abs(i) * 0.22
    const rib = createInkSolid(
      new THREE.BoxGeometry(w, 0.82, 0.08),
      theme.paperRecessed,
      theme.inkPrimary
    )
    rib.position.set(0, 0.58, i * 0.36)
    g.add(rib)
  }
  return g
}

// ── Town View 3D Production Business Models (12 types) ───────────────────

export function createBusinessModel(
  type: BusinessId,
  theme: InklineTheme,
  snowRoof = false
): THREE.Group {
  const g = new THREE.Group()

  switch (type) {
    case "grainFarm": {
      const barn = createSteppedGableBuilding(1.65, 1.1, 1.35, theme.paperCard, theme.accentOchre, theme.inkPrimary, {
        detailedFacade: true,
        snowRoof
      })
      barn.position.set(-0.5, 0, 0)
      g.add(barn)

      const mill = createInkSolid(new THREE.CylinderGeometry(0.32, 0.52, 1.9, 6), theme.paperCard, theme.inkPrimary, {
        silhouette: 0.025
      })
      mill.position.set(0.75, 0.95, 0)
      g.add(mill)

      const blades = new THREE.Group()
      blades.name = "windmillBlades"
      blades.position.set(0.75, 1.62, 0.42)
      for (let i = 0; i < 4; i++) {
        const blade = createInkSolid(new THREE.BoxGeometry(0.16, 0.95, 0.04), theme.paperCard, theme.inkDeep)
        blade.position.set(0, 0.47, 0)
        const arm = new THREE.Group()
        arm.rotation.z = (i * Math.PI) / 2
        arm.add(blade)
        blades.add(arm)
      }
      g.add(blades)
      break
    }
    case "fishery": {
      const hut = createSteppedGableBuilding(1.55, 1.05, 1.5, theme.paperCard, theme.accentBlue, theme.inkPrimary, {
        detailedFacade: true,
        snowRoof
      })
      g.add(hut)
      const rack = createInkSolid(new THREE.BoxGeometry(1.45, 0.58, 0.14), theme.paperRecessed, theme.inkPrimary)
      rack.position.set(0, 0.29, 1.08)
      g.add(rack)
      break
    }
    case "brewery": {
      const hall = createSteppedGableBuilding(1.95, 1.35, 1.6, theme.paperCard, theme.accentOchre, theme.inkPrimary, {
        detailedFacade: true,
        hoistBeam: true,
        snowRoof
      })
      g.add(hall)
      const chimney = createInkSolid(new THREE.BoxGeometry(0.34, 2.45, 0.34), theme.accentRed, theme.inkPrimary)
      chimney.position.set(0.68, 1.22, -0.52)
      chimney.name = "smokeEmitter"
      g.add(chimney)
      break
    }
    case "sawmill": {
      const shed = createSteppedGableBuilding(1.8, 1.08, 1.35, theme.paperCard, "#6f5a44", theme.inkPrimary, {
        detailedFacade: true,
        snowRoof
      })
      g.add(shed)
      for (let i = 0; i < 3; i++) {
        const log = createInkSolid(new THREE.CylinderGeometry(0.16, 0.16, 1.45, 6), "#8c7358", theme.inkPrimary)
        log.rotation.z = Math.PI / 2
        log.position.set(0, 0.18 + (i === 2 ? 0.24 : 0), 0.98 + (i === 1 ? 0.32 : i === 2 ? 0.16 : 0))
        g.add(log)
      }
      break
    }
    case "brickworks": {
      const kiln = createInkSolid(new THREE.CylinderGeometry(0.65, 0.85, 1.38, 8), theme.accentRed, theme.inkPrimary, {
        silhouette: 0.025
      })
      kiln.position.set(-0.4, 0.69, 0)
      g.add(kiln)
      const stack = createInkSolid(new THREE.CylinderGeometry(0.18, 0.26, 2.55, 6), theme.accentRed, theme.inkPrimary)
      stack.position.set(0.65, 1.28, -0.25)
      stack.name = "smokeEmitter"
      g.add(stack)
      break
    }
    case "saltworks": {
      const hall = createSteppedGableBuilding(1.6, 1.05, 1.4, theme.paperCard, "#7b8a88", theme.inkPrimary, {
        detailedFacade: true,
        snowRoof
      })
      hall.position.set(-0.35, 0, 0)
      g.add(hall)
      const pan = createInkSolid(new THREE.BoxGeometry(0.95, 0.24, 1.3), "#ffffff", theme.inkPrimary)
      pan.position.set(0.85, 0.12, 0)
      g.add(pan)
      break
    }
    case "ironworks": {
      const forge = createSteppedGableBuilding(1.9, 1.35, 1.65, theme.paperRecessed, "#495459", theme.inkPrimary, {
        detailedFacade: true,
        snowRoof
      })
      g.add(forge)
      const furnace = createInkSolid(new THREE.CylinderGeometry(0.24, 0.42, 2.75, 6), "#495459", theme.inkDeep)
      furnace.position.set(-0.65, 1.38, -0.5)
      furnace.name = "smokeEmitter"
      g.add(furnace)
      break
    }
    case "weavingMill": {
      const mill = createSteppedGableBuilding(2.05, 1.42, 1.5, theme.paperCard, "#7c4b6e", theme.inkPrimary, {
        detailedFacade: true,
        hoistBeam: true,
        snowRoof
      })
      g.add(mill)
      break
    }
    case "pitchmaker": {
      const hut = createSteppedGableBuilding(1.4, 1.02, 1.3, theme.paperRecessed, "#3a3f42", theme.inkPrimary, {
        detailedFacade: true,
        snowRoof
      })
      hut.position.set(-0.4, 0, 0)
      g.add(hut)
      const vat = createInkSolid(new THREE.CylinderGeometry(0.45, 0.42, 0.72, 8), "#3a3f42", theme.inkDeep)
      vat.position.set(0.7, 0.36, 0.2)
      g.add(vat)
      break
    }
    case "hempFarm": {
      // Classic long Hanseatic Ropewalk!
      const ropewalk = createSteppedGableBuilding(2.3, 0.9, 0.82, theme.paperCard, theme.accentGreen, theme.inkPrimary, {
        detailedFacade: true,
        snowRoof
      })
      ropewalk.position.set(0, 0, -0.35)
      g.add(ropewalk)
      const field = createInkSolid(new THREE.BoxGeometry(2.1, 0.1, 0.82), theme.accentGreenWash, theme.accentGreen)
      field.position.set(0, 0.05, 0.78)
      g.add(field)
      break
    }
    case "furTrapper": {
      const lodge = createSteppedGableBuilding(1.65, 1.15, 1.4, theme.paperCard, "#6e4e37", theme.inkPrimary, {
        detailedFacade: true,
        snowRoof
      })
      g.add(lodge)
      break
    }
    case "vineyard": {
      const press = createSteppedGableBuilding(1.7, 1.18, 1.45, theme.paperCard, "#8c3a44", theme.inkPrimary, {
        detailedFacade: true,
        snowRoof
      })
      g.add(press)
      break
    }
  }

  return g
}

// ── Live Quay Cargo Yards (Bricks, Salt, Timber, Barrels) ────────────────

export function createQuayCommodityYard(
  kind: "bricks" | "salt" | "timber" | "barrels",
  tier: 0 | 1 | 2 | 3,
  theme: InklineTheme
): THREE.Group {
  const g = new THREE.Group()
  // Base cobbled pad
  const pad = createInkSolid(
    new THREE.BoxGeometry(2.6, 0.06, 2.0),
    theme.paperRecessed,
    theme.borderLine,
    { castShadow: false }
  )
  pad.position.y = 0.03
  g.add(pad)

  if (tier === 0) return g

  if (kind === "bricks") {
    for (let t = 0; t < tier; t++) {
      for (let i = 0; i < 3; i++) {
        const stack = createInkSolid(
          new THREE.BoxGeometry(0.62, 0.32, 0.56),
          theme.accentRed,
          theme.inkDeep
        )
        stack.position.set(-0.75 + i * 0.75, 0.22 + t * 0.33, (t % 2) * 0.12 - 0.1)
        g.add(stack)
      }
    }
  } else if (kind === "salt") {
    // Covered salt shed roof + white salt sacks inside
    const canopy = createInkSolid(
      new THREE.BoxGeometry(2.3, 0.12, 1.65),
      theme.paperCard,
      theme.inkPrimary
    )
    canopy.position.set(0, 1.15, 0)
    g.add(canopy)
    for (const sx of [-1.0, 1.0]) {
      for (const sz of [-0.68, 0.68]) {
        const p = createInkSolid(new THREE.BoxGeometry(0.08, 1.1, 0.08), theme.inkPrimary, theme.inkDeep)
        p.position.set(sx, 0.55, sz)
        g.add(p)
      }
    }
    for (let i = 0; i < tier * 2; i++) {
      const sack = createInkSolid(new THREE.BoxGeometry(0.45, 0.34, 0.45), "#ffffff", theme.inkPrimary)
      sack.position.set(-0.7 + (i % 3) * 0.68, 0.22 + Math.floor(i / 3) * 0.35, 0)
      g.add(sack)
    }
  } else if (kind === "timber") {
    for (let i = 0; i < tier * 2; i++) {
      const log = createInkSolid(new THREE.CylinderGeometry(0.14, 0.14, 1.95, 6), "#8c7358", theme.inkPrimary)
      log.rotation.z = Math.PI / 2
      log.position.set(0, 0.2 + Math.floor(i / 3) * 0.24, -0.5 + (i % 3) * 0.44)
      g.add(log)
    }
  } else {
    for (let i = 0; i < tier * 2; i++) {
      const barrel = createInkSolid(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 7), theme.accentOchre, theme.inkDeep)
      barrel.position.set(-0.7 + (i % 3) * 0.65, 0.26, -0.3 + Math.floor(i / 3) * 0.55)
      g.add(barrel)
    }
  }
  return g
}

// ── Miniature Inkline Porters, Carts & Pine Trees ────────────────────────

export function createInkPorter(theme: InklineTheme, carryingCrate = false): THREE.Group {
  const g = new THREE.Group()
  const body = createInkSolid(new THREE.CylinderGeometry(0.09, 0.12, 0.44, 5), theme.inkPrimary, theme.inkDeep, {
    castShadow: false
  })
  body.position.y = 0.22
  g.add(body)
  const head = createInkSolid(new THREE.SphereGeometry(0.085, 6, 5), theme.paperCard, theme.inkDeep, {
    castShadow: false
  })
  head.position.y = 0.52
  g.add(head)
  if (carryingCrate) {
    const c = createInkSolid(new THREE.BoxGeometry(0.2, 0.18, 0.2), theme.accentRed, theme.inkDeep, {
      castShadow: false
    })
    c.position.set(0, 0.34, 0.18)
    g.add(c)
  }
  return g
}

export function createInkCart(theme: InklineTheme): THREE.Group {
  const g = new THREE.Group()
  const bed = createInkSolid(new THREE.BoxGeometry(0.58, 0.22, 0.92), theme.paperCard, theme.inkDeep, {
    castShadow: false
  })
  bed.position.y = 0.28
  g.add(bed)
  const load = createInkSolid(new THREE.BoxGeometry(0.44, 0.26, 0.56), theme.accentOchre, theme.inkDeep, {
    castShadow: false
  })
  load.position.y = 0.52
  g.add(load)
  for (const sx of [-0.32, 0.32]) {
    const wheel = createInkSolid(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 8), theme.inkPrimary, theme.inkDeep, {
      castShadow: false
    })
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(sx, 0.18, 0)
    g.add(wheel)
  }
  return g
}

export function createInkTree(theme: InklineTheme, season: SeasonId): THREE.Group {
  const g = new THREE.Group()
  const trunk = createInkSolid(new THREE.CylinderGeometry(0.06, 0.09, 0.45, 5), theme.inkPrimary, theme.inkDeep)
  trunk.position.y = 0.22
  g.add(trunk)
  const foliageColor =
    season === "winter"
      ? "#f6f8f4"
      : season === "autumn"
        ? theme.accentOchreWash
        : theme.paperRecessed
  const crown = createInkSolid(new THREE.ConeGeometry(0.42, 1.15, 6), foliageColor, theme.inkPrimary)
  crown.position.y = 0.95
  g.add(crown)
  return g
}

// ── Subdivided Organic Cartographic Coastlines + Concentric Shoreline Ripples ──

function subdivideClosedLoop(
  pts: ReadonlyArray<readonly [number, number]>,
  iterations = 2
): Array<readonly [number, number]> {
  let cur: Array<readonly [number, number]> = pts.slice()
  for (let it = 0; it < iterations; it++) {
    const next: Array<readonly [number, number]> = []
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i]!
      const b = cur[(i + 1) % cur.length]!
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    cur = next
  }
  return cur
}

function makeCartographicLandmass(
  rawPoints: ReadonlyArray<readonly [number, number]>,
  height: number,
  theme: InklineTheme
): THREE.Group {
  const points = subdivideClosedLoop(rawPoints, 2)
  const shape = new THREE.Shape()
  const first = points[0]
  if (!first) return new THREE.Group()
  shape.moveTo(first[0], -first[1])
  for (let i = 1; i < points.length; i++) {
    const pt = points[i]
    if (pt) shape.lineTo(pt[0], -pt[1])
  }
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.12,
    bevelSegments: 1
  })
  geo.rotateX(-Math.PI / 2)

  const group = new THREE.Group()
  const matTop = createInkPaperMaterial(theme.landTop, theme.inkPrimary, { hatchStrength: 0.08 })
  const matSide = createInkPaperMaterial(theme.landSide, theme.inkPrimary, { hatchStrength: 0.28 })
  const mesh = new THREE.Mesh(geo, [matTop, matSide])
  mesh.receiveShadow = true
  group.add(mesh)

  const edges = new THREE.EdgesGeometry(geo, 22)
  group.add(new THREE.LineSegments(edges, createInkEdgeMaterial(theme.inkPrimary, 0.72)))

  // 2 Concentric old-chart coastal ripple rings radiating into the sea!
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length
  const cz = points.reduce((s, p) => s + p[1], 0) / points.length
  for (const [offset, opacity] of [
    [0.55, 0.42],
    [1.05, 0.30],
    [1.7, 0.17]
  ] as const) {
    const ripplePts: Array<THREE.Vector3> = []
    for (const [px, pz] of points) {
      const dx = px - cx
      const dz = pz - cz
      const len = Math.max(0.01, Math.hypot(dx, dz))
      ripplePts.push(new THREE.Vector3(px + (dx / len) * offset, 0.035, pz + (dz / len) * offset))
    }
    const loop = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ripplePts),
      createInkEdgeMaterial(theme.seaWaveInk, opacity)
    )
    group.add(loop)
  }

  return group
}

export function createHanseaticLandmasses(theme: InklineTheme): THREE.Group {
  const root = new THREE.Group()

  // 1. Continental Europe + Jutland Peninsula (smooth subdivided organic coast, lightened height!)
  const continent: ReadonlyArray<readonly [number, number]> = [
    [-28, 32],
    [-25, 22],
    [-19.5, 17.5],
    [-15, 16],
    [-11.2, 14.5],
    [-10.2, 9],
    [-9.2, 3.5],
    [-7.8, -0.4],
    [-5.6, 1.5],
    [-6.2, 9.5],
    [-4.8, 13.8],
    [1.5, 12.8],
    [6.5, 12.2],
    [12.5, 13.4],
    [18.5, 12.4],
    [24.2, 10.4],
    [29.5, 7.2],
    [33.4, 2.2],
    [34.6, -4.8],
    [37.5, -11.5],
    [46, -15],
    [54, -14],
    [54, 32]
  ]
  root.add(makeCartographicLandmass(continent, 0.48, theme))

  // Distributaries thin to hairlines where the river fans into the Baltic.
  for (const mouth of [4, 17]) {
    for (const [branch, reach] of [[0,5],[-.78,1.7],[.66,1.3]] as const) {
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(mouth+.5,.576,13+reach),
        new THREE.Vector3(mouth+.15,.576,14.1),
        new THREE.Vector3(mouth+branch,.576,13.15),
        new THREE.Vector3(mouth+branch*1.6,.576,12.6)
      ])
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(16)),
        createInkEdgeMaterial(theme.seaWaveInk,.8)))
    }
  }

  // 2. Scandinavia (Norway fjords + Sweden Baltic coast)
  const scandinavia: ReadonlyArray<readonly [number, number]> = [
    [-18, -32],
    [-15.2, -23.5],
    [-13.5, -18.2],
    [-11.4, -13.2],
    [-5.5, -12.4],
    [-0.5, -9.2],
    [2.8, -4.2],
    [5.2, 2.6],
    [10.2, 0.2],
    [14.2, -5.8],
    [19.4, -15.2],
    [23.2, -24],
    [28, -32]
  ]
  root.add(makeCartographicLandmass(scandinavia, 0.56, theme))

  // 3. Great Britain (Thames Estuary + East Anglia)
  const britain: ReadonlyArray<readonly [number, number]> = [
    [-54, 24],
    [-38.5, 17.5],
    [-36.5, 12.5],
    [-36.2, 6.2],
    [-39.2, -4.5],
    [-43.5, -17.5],
    [-54, -22]
  ]
  root.add(makeCartographicLandmass(britain, 0.52, theme))

  // 4. Gotland Island (Visby)
  const gotland: ReadonlyArray<readonly [number, number]> = [
    [18.2, -7.2],
    [20.6, -5.6],
    [20.8, -2.0],
    [19.2, -0.4],
    [17.6, -3.5]
  ]
  root.add(makeCartographicLandmass(gotland, 0.44, theme))

  // 5. Zealand & Funen (organic Danish archipelago, no longer a 4-sided block!)
  const zealand: ReadonlyArray<readonly [number, number]> = [
    [-4.2, 3.0],
    [-2.4, 2.1],
    [-1.1, 3.4],
    [-1.4, 5.1],
    [-3.1, 5.6],
    [-4.3, 4.4]
  ]
  root.add(makeCartographicLandmass(zealand, 0.4, theme))

  // 6. Inland Cartographic River Lines (Elbe, Weser, Oder, Vistula) & Subtle Hill Hatches
  const riverPts = [
    // Elbe into Hamburg
    new THREE.Vector3(-11, 0.53, 15.5),
    new THREE.Vector3(-9.2, 0.53, 21),
    new THREE.Vector3(-6.5, 0.53, 27),
    // Weser into Bremen
    new THREE.Vector3(-17.5, 0.53, 17.5),
    new THREE.Vector3(-17.2, 0.53, 24),
    // Oder into Stettin
    new THREE.Vector3(12.5, 0.53, 14),
    new THREE.Vector3(13.8, 0.53, 22),
    // Vistula into Danzig
    new THREE.Vector3(23, 0.53, 11),
    new THREE.Vector3(24.5, 0.53, 19),
    new THREE.Vector3(27, 0.53, 27)
  ]
  root.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(riverPts),
      createInkEdgeMaterial(theme.seaWaveInk, 0.65)
    )
  )

  // Subtle hand-inked inland mountain/pine chevrons in Scandinavia & Baltic hinterland
  const hills: Array<THREE.Vector3> = []
  const hillCoords: ReadonlyArray<readonly [number, number]> = [
    [-8, -22],
    [-4, -19],
    [4, -18],
    [10, -21],
    [14, -14],
    [32, 16],
    [39, 9],
    [42, -2],
    [-46, 2],
    [-45, -8],
    [6, 20],
    [18, 22]
  ]
  for (const [hx, hz] of hillCoords) {
    hills.push(
      new THREE.Vector3(hx - 1.1, 0.6, hz + 0.4),
      new THREE.Vector3(hx, 0.6, hz - 0.6),
      new THREE.Vector3(hx, 0.6, hz - 0.6),
      new THREE.Vector3(hx + 1.1, 0.6, hz + 0.4)
    )
  }
  root.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(hills),
      createInkEdgeMaterial(theme.inkMuted, 0.45)
    )
  )

  return root
}

/** Painted on separate small sheets so the rose and ship retain their engraved detail at close zoom. */
function chartPlate(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.Mesh {
  const canvas = document.createElement("canvas")
  canvas.width = 768
  canvas.height = Math.round(768 * height / width)
  const ctx = canvas.getContext("2d")!
  ctx.scale(canvas.width / width, canvas.height / height)
  paint(ctx)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
  material.addEventListener("dispose", () => map.dispose())
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
  plate.rotation.x = -Math.PI / 2
  return plate
}

export function createChartFurniture(theme: InklineTheme): THREE.Group {
  const group = new THREE.Group()
  const rose = chartPlate(14, 14, ctx => {
    ctx.translate(7, 7)
    ctx.strokeStyle = theme.inkMuted
    ctx.lineWidth = .04
    for (let i = 0; i < 64; i++) {
      ctx.save()
      ctx.rotate(i * Math.PI / 32)
      ctx.stroke(new Path2D(i % 4 === 0 ? "M0 -4.1V-4.65" : "M0 -4.4V-4.6"))
      ctx.restore()
    }
    for (let i = 0; i < 16; i++) {
      ctx.save()
      ctx.rotate(i * Math.PI / 8)
      const length = i % 4 === 0 ? 5 : i % 2 === 0 ? 3.8 : 2.8
      const tip = new Path2D(`M0 0L-.36 -1L0 ${-length}L.36 -1Z`)
      ctx.fillStyle = theme.paperCard
      ctx.fill(tip)
      ctx.stroke(tip)
      ctx.fillStyle = i % 4 === 0 ? theme.accentRed : theme.inkPrimary
      ctx.fill(new Path2D(`M0 0L-.36 -1L0 ${-length}Z`))
      ctx.restore()
    }
    ctx.fillStyle = theme.inkPrimary
    ctx.font = "bold 1.35px Georgia"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    for (const [i, letter] of Array.from("NESW").entries()) {
      ctx.fillText(letter, Math.sin(i*Math.PI/2)*5.9, -Math.cos(i*Math.PI/2)*5.9)
    }
  })
  rose.position.set(-27,.08,-8)
  group.add(rose)

  const crest = chartPlate(11, 7, ctx => {
    ctx.translate(.4,.2)
    ctx.lineJoin = "round"
    ctx.strokeStyle = theme.inkMuted
    ctx.lineWidth = .06
    // Clinker hull, raised castles, square sail and standing rigging.
    ctx.stroke(new Path2D("M1 3.5Q4 4.5 8.9 3.15L8.1 4.4Q5 5.45 2.2 4.55ZM1.65 3.8Q5 4.9 8.6 3.65M2 4.18Q5 5.15 8.35 4 M4.9 .4V4 M2.8 1.1L7.3 1.45Q6.85 2.5 7.45 3.2Q5.1 2.85 2.7 3.2Q3.5 2.1 2.8 1.1ZM1.35 3.6L4.9 .68L8.65 3.3M4.9 .45Q5.55 .1 6.2 .55L4.9 .78"))
    for (let i = 0; i < 6; i++) {
      const x = 3.2+i*.68
      ctx.stroke(new Path2D(`M${x} 1.52q.28 .66 -.04 1.38`))
    }
    ctx.stroke(new Path2D("M.7 5q1 -.32 2.2 0m.55 .14q1.5 .42 3 -.04m.55 -.12q1.25 -.4 2.35 -.15"))
    ctx.fillStyle = theme.inkMuted
    ctx.textAlign = "center"
    ctx.font = "italic .86px Georgia"
    ctx.fillText("Navis mercatorum", 5, 6.42)
  })
  crest.position.set(-22,.09,5)
  group.add(crest)

  const cartouche = chartPlate(17, 4, ctx => {
    const scroll = new Path2D("M.4 .65L2 .85Q8 .18 15 .85L16.6 .65L16.1 1.95L16.65 3.1L14.9 2.96Q8 3.7 2.1 2.96L.35 3.1L.92 1.95Z")
    ctx.fillStyle = theme.paperCard
    ctx.fill(scroll)
    ctx.strokeStyle = theme.inkMuted
    ctx.lineWidth = .05
    ctx.stroke(scroll)
    ctx.stroke(new Path2D("M1.7 .88L2.05 2.94M15.3 .88L14.94 2.94M2.4 1.04Q8.5 .5 14.6 1.04"))
    ctx.textAlign = "center"
    ctx.fillStyle = theme.inkPrimary
    ctx.font = "small-caps 1.12px Georgia"
    ctx.fillText("Carta Maris Baltici", 8.5, 2.14)
    ctx.fillStyle = theme.accentRed
    ctx.font = ".52px Georgia"
    ctx.fillText("✦   M C C C L X X   ✦", 8.5, 2.81)
  })
  cartouche.position.set(1,.74,23)
  group.add(cartouche)

  const frame: THREE.Vector3[] = []
  function rule(x: number, z: number, dx: number, dz: number) {
    frame.push(new THREE.Vector3(x,.72,z),new THREE.Vector3(x+dx,.72,z+dz))
  }
  for (const side of [-1,1]) {
    for (const inset of [0,.32]) {
      rule(-55+inset,side*(33-inset),110-2*inset,0)
      rule(side*(55-inset),-33+inset,0,66-2*inset)
    }
    for (let x=-54;x<=54;x+=2) rule(x,33*side,0,-side*(x%10===0 ? 1.05 : .55))
    for (let z=-32;z<=32;z+=2) rule(55*side,z,-side*(z%10===0 ? 1.05 : .55),0)
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(frame),createInkEdgeMaterial(theme.inkMuted,.6)))
  return group
}

export function createQuayEngraving(theme: InklineTheme): THREE.Group {
  const group = new THREE.Group()
  const joints: THREE.Vector3[] = []
  const foam: THREE.Vector3[] = []
  function stroke(points: THREE.Vector3[], x: number, y: number, z: number, dx: number, dy: number, dz: number) {
    points.push(new THREE.Vector3(x,y,z),new THREE.Vector3(x+dx,y+dy,z+dz))
  }
  for (let course=0;course<3;course++) {
    const y = course*.3
    stroke(joints,-17,y,8.012,34,0,0)
    for (let x=-16.9+course%2*.52;x<17;x+=1.05) stroke(joints,x,y,8.012,.025,.30,0)
  }
  for (let x=-16.5;x<17;x+=.94) {
    stroke(joints,x,.908,7.71,.02,0,.29)
    const z = 8.19+.065*Math.sin(x*3)
    stroke(foam,x,.042,z,.77,0,.044*Math.cos(x))
    stroke(foam,x+.22,.042,z+.23,.48,0,-.034)
  }
  for (let row=0;row<18;row++) {
    for (let col=0;col<15;col++) {
      const x=-4.5+(col+(row%2)*.5)*.59
      const z=-3.9+row*.35
      stroke(joints,x,.987,z,.42,0,.015)
      stroke(joints,x,.987,z,-.028,0,.18)
    }
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(joints),createInkEdgeMaterial(theme.inkMuted,.39)))
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(foam),createInkEdgeMaterial(theme.paperCard,.94)))
  for (let x=-15;x<=15;x+=5) {
    const post = createInkSolid(new THREE.LatheGeometry([
      new THREE.Vector2(.18,0),new THREE.Vector2(.12,.13),new THREE.Vector2(.12,.38),
      new THREE.Vector2(.18,.41),new THREE.Vector2(.16,.49),new THREE.Vector2(0,.50)
    ],8),theme.inkPrimary,theme.inkDeep)
    post.position.set(x,.91,7.73)
    group.add(post)
  }
  return group
}
