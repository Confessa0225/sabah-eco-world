import * as THREE from 'three'

const CHUNK_SIZE = 8
const GRID = 36
const hash = (x, z) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return n - Math.floor(n)
}

// Match the two triangles in the terrain plane rather than floating on a bilinear surface.
export function sampleGrassGround(terrain, water, colors, x, z) {
  const spacing = terrain.spacing || 1
  const gx = x / spacing + (terrain.width - 1) / 2
  const gz = z / spacing + (terrain.height - 1) / 2
  const ix = Math.floor(gx), iz = Math.floor(gz)
  if (ix < 0 || iz < 0 || ix >= terrain.width - 1 || iz >= terrain.height - 1) return null
  // Keep a full cell clear along the shoreline.
  if ([water.fractions[iz][ix], water.fractions[iz][ix + 1], water.fractions[iz + 1][ix], water.fractions[iz + 1][ix + 1]].some(v => v > 0.05)) return null
  const tx = gx - ix, tz = gz - iz
  const vertices = tx + tz <= 1
    ? [[ix, iz, 1 - tx - tz], [ix + 1, iz, tx], [ix, iz + 1, tz]]
    : [[ix + 1, iz + 1, tx + tz - 1], [ix, iz + 1, 1 - tx], [ix + 1, iz, 1 - tz]]
  let height = 0
  const color = new THREE.Color(0, 0, 0)
  for (const [cx, cz, weight] of vertices) {
    height += terrain.heights[cz][cx] * weight
    const index = (cz * terrain.width + cx) * 3
    color.r += colors[index] * weight
    color.g += colors[index + 1] * weight
    color.b += colors[index + 2] * weight
  }
  return { height, color }
}

function tuftGeometry() {
  const positions = [], indices = []
  // Short, curled blades with rounded tips make a low, plush lawn.
  for (let blade = 0; blade < 3; blade++) {
    const angle = blade * Math.PI * 2 / 3
    const height = 0.085 + blade * 0.018
    const offset = positions.length / 3
    for (const [side, y, bend] of [[-.022, 0, 0], [.022, 0, 0], [-.025, height * .65, .032], [.025, height * .65, .032], [-.009, height * .95, .065], [.009, height * .95, .065], [0, height, .074]]) {
      positions.push(Math.cos(angle) * side + Math.sin(angle) * bend, y, -Math.sin(angle) * side + Math.cos(angle) * bend)
    }
    indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2, offset + 2, offset + 3, offset + 4, offset + 3, offset + 5, offset + 4, offset + 4, offset + 5, offset + 6)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createFluffyGrass(terrain, water, colors, gray) {
  const group = new THREE.Group()
  group.name = 'soft-grass'
  const geometry = tuftGeometry()
  const time = { value: 0 }, reveal = { value: 0 }, viewer = { value: new THREE.Vector3() }
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide })
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { grassTime: time, grassReveal: reveal, grassViewer: viewer })
    shader.vertexShader = `uniform float grassTime; uniform vec3 grassViewer; varying float grassTip;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 grassRoot = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        float fade = 1.0 - smoothstep(18.0, 26.0, distance(grassRoot, grassViewer));
        grassTip = clamp(position.y / 0.12, 0.0, 1.0);
        transformed.y *= fade;
        transformed.x += sin(grassTime * 1.6 + grassRoot.x * .55 + grassRoot.z * .38) * .018 * grassTip * grassTip * fade;
      `)
    shader.fragmentShader = `uniform float grassReveal; varying float grassTip;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(vec3(${gray.toFixed(6)}), diffuseColor.rgb, grassReveal);
        diffuseColor.rgb *= mix(0.78, 1.12, grassTip);
      `)
  }
  material.customProgramCacheKey = () => 'fluffy-grass-v1'
  const chunks = new Map()
  let lastX = Infinity, lastZ = Infinity
  const dummy = new THREE.Object3D()

  function makeChunk(cx, cz) {
    const mesh = new THREE.InstancedMesh(geometry, material, GRID * GRID)
    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE)
    let count = 0
    for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
      const seedX = cx * GRID + x, seedZ = cz * GRID + z
      const px = (x + .15 + hash(seedX, seedZ) * .7) * CHUNK_SIZE / GRID
      const pz = (z + .15 + hash(seedX + 13, seedZ - 9) * .7) * CHUNK_SIZE / GRID
      const sample = sampleGrassGround(terrain, water, colors, mesh.position.x + px, mesh.position.z + pz)
      if (!sample) continue
      dummy.position.set(px, sample.height - .008, pz)
      dummy.rotation.y = hash(seedX + 37, seedZ) * Math.PI * 2
      dummy.scale.setScalar(.8 + hash(seedX - 7, seedZ + 3) * .45)
      dummy.updateMatrix()
      mesh.setMatrixAt(count, dummy.matrix)
      mesh.setColorAt(count, sample.color.multiplyScalar(.94 + hash(seedX + 9, seedZ) * .12))
      count++
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.raycast = () => {}
    group.add(mesh)
    return mesh
  }

  return {
    group,
    update(camera, delta, colorProgress) {
      time.value += delta
      viewer.value.copy(camera.position)
      reveal.value = THREE.MathUtils.smoothstep(colorProgress, 0, 1)
      const cx = Math.floor(camera.position.x / CHUNK_SIZE), cz = Math.floor(camera.position.z / CHUNK_SIZE)
      if (cx === lastX && cz === lastZ) return
      lastX = cx; lastZ = cz
      // A fixed 7×7 neighborhood bounds memory and draw calls even on large maps.
      for (const [key, mesh] of chunks) {
        const [x, z] = key.split(',').map(Number)
        if (Math.abs(x - cx) > 3 || Math.abs(z - cz) > 3) {
          group.remove(mesh)
          mesh.dispose()
          chunks.delete(key)
        }
      }
      for (let z = cz - 3; z <= cz + 3; z++) for (let x = cx - 3; x <= cx + 3; x++) {
        const key = `${x},${z}`
        if (!chunks.has(key)) chunks.set(key, makeChunk(x, z))
      }
    }
  }
}
