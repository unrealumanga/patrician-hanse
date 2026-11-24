import * as THREE from "three"

// Shared wash bands live as long as their last toon material.
let gradientUsers = 0
let cachedGradientMap: THREE.DataTexture | null = null

function getInkGradientMap(): THREE.DataTexture {
  if (cachedGradientMap) return cachedGradientMap
  const data = new Uint8Array([
    152, 152, 152, 255,
    218, 218, 218, 255,
    255, 255, 255, 255
  ])
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  cachedGradientMap = tex
  return tex
}

export function createInkPaperMaterial(
  fillHex: string,
  inkHex: string,
  opts: { readonly hatchStrength?: number; readonly unlit?: boolean } = {}
): THREE.Material {
  const base = {
    color: new THREE.Color(fillHex),
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  }
  const mat = opts.unlit
    ? new THREE.MeshBasicMaterial(base)
    : new THREE.MeshToonMaterial({ ...base, gradientMap: getInkGradientMap() })

  if (mat instanceof THREE.MeshToonMaterial) {
    gradientUsers++
    const release = () => {
      mat.removeEventListener("dispose", release)
      if (--gradientUsers === 0) {
        cachedGradientMap?.dispose()
        cachedGradientMap = null
      }
    }
    mat.addEventListener("dispose", release)
  }

  const inkColor = new THREE.Color(inkHex)
  const hatchStrength = opts.hatchStrength ?? 0.24

  mat.onBeforeCompile = (shader) => {
    shader.uniforms["uInkColor"] = { value: inkColor }
    shader.uniforms["uHatchStrength"] = { value: hatchStrength }

    shader.vertexShader = "varying vec3 vSheet;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vSheet = position;`
    )
    shader.fragmentShader = `
      varying vec3 vSheet;
      uniform vec3 uInkColor;
      uniform float uHatchStrength;
      float grain(vec2 p) {
        vec3 q = fract(p.xyx * vec3(.1031,.1030,.0973));
        q += dot(q,q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float wash(vec2 p) {
        vec2 k = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(grain(k),grain(k+vec2(1,0)),f.x),
                   mix(grain(k+vec2(0,1)),grain(k+1.0),f.x),f.y);
      }
      float nib(float p) {
        float aa = max(.025, fwidth(p)*.5);
        return (1.0-smoothstep(.048-aa,.048+aa,abs(fract(p)-.5)))
          * (1.0-smoothstep(.32,.85,aa));
      }
    ` + shader.fragmentShader.replace("#include <colorspace_fragment>", `
      vec2 sheet = vec2(vSheet.x + vSheet.y*.43, vSheet.z + vSheet.y*.87);
      float pool = wash(sheet*1.2);
      vec2 tow = sheet*vec2(4.,30.);
      float fiber = (wash(tow)-.5)*(1.-smoothstep(.45,2.,length(fwidth(tow))));
      float shade = 1.-smoothstep(.30,.86,dot(gl_FragColor.rgb,vec3(.213,.715,.072)));
      float hatch = nib(dot(sheet,vec2(4.,6.)) + pool*.3)
        + .65*nib(dot(sheet,vec2(-6.,3.))) * shade;
      gl_FragColor.rgb *= vec3(1.,.992,.973) * (.974 + .038*pool + .082*fiber);
      gl_FragColor.rgb = mix(gl_FragColor.rgb,uInkColor,clamp(hatch*shade*uHatchStrength,0.,.7));
      #include <colorspace_fragment>
    `)
  }
  mat.customProgramCacheKey = () => "rag-paper-engraving"
  return mat
}

/** Inverted-hull outer silhouette outline for thicker hand-inked contours on key forms */
export function createSilhouetteShell(
  geometry: THREE.BufferGeometry,
  inkHex: string,
  thickness = 0.032
): THREE.Mesh {
  // Split vertices keep the wash flat-shaded. Join their normals only for the
  // outline, so adjacent faces meet at gable ridges and square corners.
  const positions = geometry.getAttribute("position")
  const normals = geometry.getAttribute("normal")
  const joined = new Map<string, THREE.Vector3>()
  const keys: string[] = []
  const normal = new THREE.Vector3()
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)]
      .map(value => Math.round(value * 10000)).join(",")
    keys.push(key)
    const sum = joined.get(key) ?? new THREE.Vector3()
    sum.add(normal.fromBufferAttribute(normals, i))
    joined.set(key, sum)
  }
  const shellNormals = keys.flatMap(key => joined.get(key)!.clone().normalize().toArray())
  geometry.setAttribute("shellNormal", new THREE.Float32BufferAttribute(shellNormals, 3))
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color(inkHex) },
      uThickness: { value: thickness }
    },
    vertexShader: `
      attribute vec3 shellNormal;
      uniform float uThickness;
      void main() {
        vec3 pos = position + shellNormal * uThickness * 1.4;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }
    `
  })
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.castShadow = false
  mesh.receiveShadow = false
  return mesh
}

export function createInkEdgeMaterial(
  inkHex: string,
  opacity = 0.88
): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: new THREE.Color(inkHex),
    transparent: opacity < 1,
    opacity
  })
}
