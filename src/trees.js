
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { createDiscoveryMaterial } from './discoveryMaterial.js'
import { applyPainterlyMaterial } from './painterlyMaterials.js'

let speciesNoiseData

// ===================== 植物模型资源（GLB/FBX） =====================
// 第一阶段全部植物使用 public/plants/ 下的模型；
// 初始染灰，发现后按模型原色变色（复用 animatePlantColor）
const PLANT_MODELS = {
  trees: ['tree1.glb', 'tree2.glb', 'tree3.glb', 'tree4.glb', 'tree5.glb'],
  ferns: ['Fiddlehead.glb', 'Fern.fbx'],
  shrubs: ['Shrub1.glb', 'Shrub2.glb'],
  stones: ['stone1.glb', 'stone2.glb'],
  fallenlogs: ['fallenlog1.glb', 'fallenlog2.glb', 'fallenlog3.glb'],
  mushrooms: ['mushroom1.glb', 'mushroom2.glb', 'mushroom3.glb'],
  fallenleaves: ['fallenleaf1.glb']
}

const plantTemplates = {}

// 加载全部植物模板（每个文件一次，生成时 clone 复用）
export async function initPlantTemplates() {
  const gltfLoader = new GLTFLoader()
  const fbxLoader = new FBXLoader()

  const tasks = []
  for (const [key, files] of Object.entries(PLANT_MODELS)) {
    plantTemplates[key] = []
    for (const file of files) {
      const url = '/plants/' + file
      const loader = file.toLowerCase().endsWith('.fbx')
        ? fbxLoader : gltfLoader

      tasks.push(
        loader.loadAsync(url)
          .then(result => {
            const scene = result.scene || result
            plantTemplates[key].push(scene)
          })
          .catch(err => {
            console.warn(`植物模型加载失败：${file}`, err)
          })
      )
    }
  }

  await Promise.all(tasks)

  for (const key of Object.keys(plantTemplates)) {
    console.log(
      `植物模板 ${key}: ${plantTemplates[key].length} 个`
    )
  }
}

// 克隆植物模板并归一化：缩放到目标尺寸、底部落地、水平居中，
// 材质独立克隆并染灰（原色存入 userData.targetColor 供发现变色）
function clonePlant(template, targetSize) {
  const clone = template.clone(true)
  const wrapper = new THREE.Group()

  // 按模型包围盒最大维度归一化到目标尺寸
  const box = new THREE.Box3().setFromObject(clone)
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  clone.scale.setScalar(targetSize / maxDim)

  // 缩放后重算包围盒：底部落地、水平居中
  const box2 = new THREE.Box3().setFromObject(clone)
  const center = box2.getCenter(new THREE.Vector3())
  clone.position.x = -center.x
  clone.position.z = -center.z
  clone.position.y = -box2.min.y

  wrapper.add(clone)

  wrapper.traverse((object) => {
    if (!object.isMesh) return

    // 克隆并染灰；保持单材质/材质数组的原有形态
    // （数组材质依赖 geometry.groups 渲染，单材质包成数组会导致不渲染）
    object.material = Array.isArray(object.material)
      ? object.material.map(source => createDiscoveryMaterial(source, object.geometry))
      : createDiscoveryMaterial(object.material, object.geometry)
  })

  return wrapper
}

// 为共享几何体设置带渐变的顶点颜色
// 作为 material.color 的乘法因子叠加自然渐变，
// 不影响 animatePlantColor 对 material.color 的 lerp 逻辑。
// variations: { top:[r,g,b], bottom:[r,g,b], jitter:0~0.1 }
function applyGradient(geometry, variations) {
  geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  const sizeY = bbox.max.y - bbox.min.y || 1

  const top = variations.top || [1, 1, 1]
  const bottom = variations.bottom || [1, 1, 1]
  const jitter = variations.jitter ?? 0.0

  const positions = geometry.attributes.position
  const count = positions.count
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const y = positions.getY(i)
    const t = (y - bbox.min.y) / sizeY // 0 底部 → 1 顶部

    let r = bottom[0] + (top[0] - bottom[0]) * t
    let g = bottom[1] + (top[1] - bottom[1]) * t
    let b = bottom[2] + (top[2] - bottom[2]) * t

    if (jitter > 0) {
      r += (Math.random() - 0.5) * jitter
      g += (Math.random() - 0.5) * jitter
      b += (Math.random() - 0.5) * jitter
      r = Math.max(0.7, Math.min(1.2, r))
      g = Math.max(0.7, Math.min(1.2, g))
      b = Math.max(0.7, Math.min(1.2, b))
    }

    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }

  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  )
}

function smoothSpeciesNoise(x, z, cols, rows, speciesNoise, speciesNoiseSize) {
  const gx = (x / (cols - 1)) * speciesNoiseSize
  const gz = (z / (rows - 1)) * speciesNoiseSize

  const x0 = Math.floor(gx)
  const z0 = Math.floor(gz)
  const x1 = Math.min(x0 + 1, speciesNoiseSize)
  const z1 = Math.min(z0 + 1, speciesNoiseSize)

  const tx = gx - x0
  const tz = gz - z0

  const sx = tx * tx * (3 - 2 * tx)
  const sz = tz * tz * (3 - 2 * tz)

  const top = THREE.MathUtils.lerp(
    speciesNoise[z0][x0],
    speciesNoise[z0][x1],
    sx
  )

  const bottom = THREE.MathUtils.lerp(
    speciesNoise[z1][x0],
    speciesNoise[z1][x1],
    sx
  )

  return THREE.MathUtils.lerp(top, bottom, sz)
}
// 根据真实森林覆盖率生成黑白灰低多边形树木群落
export function createTrees(scene, terrain, forest, water) {
  const cols = terrain.width
  const rows = terrain.height
  const heights = terrain.heights
  const forestData = forest.fractions
  const waterData = water.fractions

  // 固定随机种子，保证刷新后布局一致
  let seed = 2026
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  // 平滑空间噪声：让邻近区域具有相似的树木密度
  const noiseSize = 12
  const noise = Array.from({ length: noiseSize + 1 }, () =>
    Array.from({ length: noiseSize + 1 }, () => random())
  )
  // 专门控制两种树的群落分布
  const speciesNoiseSize = 6
  const speciesNoise = Array.from(
    { length: speciesNoiseSize + 1 },
    () => Array.from(
      { length: speciesNoiseSize + 1 },
      () => random()
    )
  )
  speciesNoiseData = {
  cols,
  rows,
  speciesNoiseSize,
  speciesNoise
}

  function smoothNoise(x, z) {
    const nx = (x / (cols - 1)) * noiseSize
    const nz = (z / (rows - 1)) * noiseSize

    const x0 = Math.floor(nx)
    const z0 = Math.floor(nz)
    const x1 = Math.min(x0 + 1, noiseSize)
    const z1 = Math.min(z0 + 1, noiseSize)

    const tx = nx - x0
    const tz = nz - z0

    // 平滑插值，避免密度突然跳变
    const sx = tx * tx * (3 - 2 * tx)
    const sz = tz * tz * (3 - 2 * tz)

    const a = THREE.MathUtils.lerp(noise[z0][x0], noise[z0][x1], sx)
    const b = THREE.MathUtils.lerp(noise[z1][x0], noise[z1][x1], sx)

    return THREE.MathUtils.lerp(a, b, sz)
  }

  const spacing = terrain.spacing || 1.0
  const forestThreshold = 0.65
  const waterThreshold = 0.05
  const treeGroup = new THREE.Group()

  let treeCount = 0
  const speciesCounts = [0, 0, 0, 0, 0]

  // 使用单一随机源，避免树木呈现规则棋盘式排列
  for (let z = 2; z < rows - 2; z++) {
    for (let x = 2; x < cols - 2; x++) {
      if (forestData[z][x] < forestThreshold) continue
      if (waterData[z][x] > waterThreshold) continue

      // 根据平滑噪声控制局部密度：
      // 有些区域密集，有些区域稀疏
      const localDensity = smoothNoise(x, z)
      const probability = 0.03 + localDensity * 0.3

      if (random() > probability) continue

      // 按平滑噪声五等分划分树种领地，五种树各自聚集
      // （树种选择在位置筛选之后，不影响树木数量与位置）
      const speciesValue = smoothSpeciesNoise(
        x, z, cols, rows, speciesNoise, speciesNoiseSize
      )

      const speciesIndex = Math.min(
        4, Math.floor(speciesValue * 5)
      )
      const speciesId = 'tree' + (speciesIndex + 1)

      // 固定抽取 7 个随机数存入池中：保持与旧版随机流一致，
      // 树木数量、位置与旧版布局完全一致（槽位 0-4 造型，5 缩放，6 朝向）
      const rnd = []
      for (let i = 0; i < 7; i++) {
        rnd.push(random())
      }

      // 从该树种的模板中克隆模型（每个物种一个专属 GLB）
      const templates = plantTemplates.trees || []
      const tree = templates.length
        ? clonePlant(
            templates[speciesIndex],
            (2.8 + rnd[5] * 0.9) *
              (speciesIndex === 4 ? 1.25 : 1)
          )
        : new THREE.Group()

      // 将网格坐标转换为 Three.js 世界坐标
      const worldX = (x - (cols - 1) / 2) * spacing
      const worldZ = (z - (rows - 1) / 2) * spacing

      tree.position.set(worldX, heights[z][x], worldZ)

      // 朝向随机，让森林看起来自然（固定槽位，保持布局稳定）
      tree.rotation.y = rnd[6] * Math.PI * 2

      tree.userData.isPlant = true
      tree.userData.speciesId = speciesId
      treeGroup.add(tree)
      treeCount++
      speciesCounts[speciesIndex]++
    }
  }

  scene.add(treeGroup)

  console.log(`树木群落生成完成：${treeCount} 棵`)
  console.log(
    `tree1: ${speciesCounts[0]}，tree2: ${speciesCounts[1]}，` +
    `tree3: ${speciesCounts[2]}，tree4: ${speciesCounts[3]}，` +
    `tree5: ${speciesCounts[4]}`
  )
  return treeGroup
}

export function getSpeciesType(x, z) {
  if (!speciesNoiseData) {
    return '群落数据尚未生成'
  }

  const {
    cols,
    rows,
    speciesNoiseSize,
    speciesNoise
  } = speciesNoiseData

  const value = smoothSpeciesNoise(
    x,
    z,
    cols,
    rows,
    speciesNoise,
    speciesNoiseSize
  )

  if (value < 0.2) return '婆罗洲榕树群落'
  if (value < 0.4) return '圆冠雨林树群落'
  if (value < 0.6) return '尖塔龙脑香群落'
  if (value < 0.8) return '层叠娑罗树群落'
  return '雨林巨树群落'
}


// 各物种回退配色：GLB 网格未记录目标色时使用（正常情况不会走到）
const _speciesPalettes = {
  tree1:      { leaf: 0x4f9b58 },                  // 婆罗洲榕树
  tree2:      { leaf: 0x3a8a6b },                  // 圆冠雨林树
  tree3:      { leaf: 0x2c6e49 },                  // 尖塔龙脑香
  tree4:      { leaf: 0x86a834 },                  // 层叠娑罗树
  tree5:      { leaf: 0x2f5d3a },                  // 雨林巨树
  fern:       { leaf: 0x5fae3e },                  // 亮草绿
  shrub:      { leaf: 0xa3b34a },                  // 浅橄榄绿
  stone:      { leaf: 0x5c6e5b },                  // 苔藓灰绿
  fallenlog:  { leaf: 0x4a3020 },                  // 深褐
  mushroom:   { leaf: 0xc0392b },                  // 红菌盖（菌柄有专属色）
  fallenleaf: { leaf: 0x8a5a2b },                  // 枯黄褐
  stream:     { leaf: 0x4a90c2, gray: 0xd4d4d4 }   // 溪水蓝（初始为浅灰）
}

export function animatePlantColor(treeGroup, speciesId, progress) {
  if (!treeGroup) return

  const palette = _speciesPalettes[speciesId] || _speciesPalettes.tree1
  const grayColor = new THREE.Color(palette.gray ?? 0x777777)
  const leafColor = new THREE.Color(palette.leaf)

  // 遍历整个植物群组，包括嵌套的蕨类、灌木、地表细节群组
  treeGroup.traverse((plant) => {
    if (!plant.userData.isPlant) return
    if (plant.userData.speciesId !== speciesId) return

    plant.traverse((object) => {
      if (!object.isMesh) return

      // 目标色优先级：网格记录（溪流等程序化网格）>
      // 材质记录（GLB 模型）> 物种回退色
      const meshTarget = object.userData.targetColor
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]

      materials.forEach((mat) => {
        if (mat.userData.discoveryReveal) {
          mat.userData.discoveryReveal.value = THREE.MathUtils.clamp(progress, 0, 1)
          return
        }
        const targetColor = meshTarget || mat.userData.targetColor || leafColor
        mat.color.copy(grayColor).lerp(targetColor, progress)
      })
    })
  })
}


/**
 * 生成热带蕨类植物群
 * terrain: 现有地形数据
 * treeGroup: 现有树木群组
 */
export function createFerns(scene, terrain, forest, water, treeGroup) {
  const cols = terrain.width
  const rows = terrain.height
  const heights = terrain.heights
  const forestData = forest.fractions
  const waterData = water.fractions

  const forestThreshold = 0.65
  const waterThreshold = 0.05

  const fernGroup = new THREE.Group()

  // 蕨类模板：卷芽与蕨叶混合克隆（初始灰、发现后恢复原色）
  const fernTemplates = plantTemplates.ferns || []

  // 读取已有树木的位置，避免蕨类完全随机散布
  const treePositions = []
  if (treeGroup) {
    treeGroup.children.forEach(tree => {
      if (tree.userData.isPlant) {
        treePositions.push(tree.position)
      }
    })
  }

  // 固定随机数，保证每次刷新布局一致
  let seed = 5271
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  
  // 自然斑块式分布：先生成群落中心，再在周围散布小蕨类
  const spacing = terrain.spacing || 1
  let fernCount = 0

  // 群落数量随地图大小变化，保持较高密度
  const patchCount = Math.max(6, Math.floor(cols * rows / 60))

  // 记录群落中心，避免群落彼此过于靠近
  const patches = []
  let attempts = 0

  while (patches.length < patchCount && attempts < patchCount * 10) {
    attempts++

    const x = 4 + Math.floor(random() * (cols - 8))
    const z = 4 + Math.floor(random() * (rows - 8))

    if (forestData[z][x] < forestThreshold) continue
    if (waterData[z][x] > waterThreshold) continue

    const worldX = (x - (cols - 1) / 2) * spacing
    const worldZ = (z - (rows - 1) / 2) * spacing

    // 群落之间保留一定空隙
    const tooClose = patches.some(patch => {
      const dx = patch.x - worldX
      const dz = patch.z - worldZ
      return Math.sqrt(dx * dx + dz * dz) < 4
    })

    if (tooClose) continue

    patches.push({ x: worldX, z: worldZ })
  }

  // 每个群落生成多株蕨类，中心较密，边缘较疏
  for (const patch of patches) {
    const plantsInPatch = 10 + Math.floor(random() * 8)

    for (let i = 0; i < plantsInPatch; i++) {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random()) * 1.6

      const worldX = patch.x + Math.cos(angle) * distance
      const worldZ = patch.z + Math.sin(angle) * distance

      // 将世界坐标转换回地形网格坐标
      const x = Math.round(worldX / spacing + (cols - 1) / 2)
      const z = Math.round(worldZ / spacing + (rows - 1) / 2)

      if (x < 2 || x >= cols - 2 || z < 2 || z >= rows - 2) {
        continue
      }

      // 避免蕨类长在树干中心
      let nearestTreeDistance = Infinity

      for (const pos of treePositions) {
        const dx = pos.x - worldX
        const dz = pos.z - worldZ
        nearestTreeDistance = Math.min(
          nearestTreeDistance,
          Math.sqrt(dx * dx + dz * dz)
        )
      }

      if (nearestTreeDistance < 0.5) continue

      // 从蕨类模板克隆一株（卷芽/蕨叶随机，尺寸自然变化）
      const fern = fernTemplates.length
        ? clonePlant(
            fernTemplates[Math.floor(random() * fernTemplates.length)],
            0.6 + random() * 0.5
          )
        : new THREE.Group()

      fern.position.set(worldX, heights[z][x], worldZ)
      fern.rotation.y = random() * Math.PI * 2

      fern.userData.isPlant = true
      fern.userData.speciesId = 'fern'

      fernGroup.add(fern)
      fernCount++
    }
  }

  scene.add(fernGroup)


  console.log(`热带蕨类生成完成：${fernCount} 簇`)
  return fernGroup
}

// 生成低多边形灌木群落
export function createShrubs(scene, terrain, forest, water) {
  const cols = terrain.width
  const rows = terrain.height
  const heights = terrain.heights
  const forestData = forest.fractions
  const waterData = water.fractions

  const shrubGroup = new THREE.Group()

  // 灌木模板：两种灌木模型随机克隆（初始灰、发现后恢复原色）
  const shrubTemplates = plantTemplates.shrubs || []

  const spacing = terrain.spacing || 1
  const forestThreshold = 0.65
  const waterThreshold = 0.05

  let seed = 8361

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  // 灌木聚集区域
  const patchCount = Math.max(10, Math.floor(cols * rows / 500))
  const patches = []
  let attempts = 0

  while (patches.length < patchCount && attempts < patchCount * 20) {
    attempts++

    const x = 4 + Math.floor(random() * (cols - 8))
    const z = 4 + Math.floor(random() * (rows - 8))

    if (forestData[z][x] < forestThreshold) continue
    if (waterData[z][x] > waterThreshold) continue

    const worldX = (x - (cols - 1) / 2) * spacing
    const worldZ = (z - (rows - 1) / 2) * spacing

    const tooClose = patches.some(patch => {
      const dx = patch.x - worldX
      const dz = patch.z - worldZ
      return Math.sqrt(dx * dx + dz * dz) < 4
    })

    if (tooClose) continue

    patches.push({ x: worldX, z: worldZ })
  }

  let shrubCount = 0

  for (const patch of patches) {
    // 每个区域生成 4～7 簇灌木
    const plantsInPatch = 4 + Math.floor(random() * 4)

    for (let i = 0; i < plantsInPatch; i++) {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random()) * 1.5

      const worldX = patch.x + Math.cos(angle) * distance
      const worldZ = patch.z + Math.sin(angle) * distance

      const x = Math.round(worldX / spacing + (cols - 1) / 2)
      const z = Math.round(worldZ / spacing + (rows - 1) / 2)

      if (x < 2 || x >= cols - 2 || z < 2 || z >= rows - 2) continue
      if (forestData[z][x] < forestThreshold) continue
      if (waterData[z][x] > waterThreshold) continue

      // 从灌木模板克隆一簇
      const shrub = shrubTemplates.length
        ? clonePlant(
            shrubTemplates[Math.floor(random() * shrubTemplates.length)],
            1.0 + random() * 0.5
          )
        : new THREE.Group()

      shrub.position.set(worldX, heights[z][x], worldZ)
      shrub.rotation.y = random() * Math.PI * 2

      shrub.userData.isPlant = true
      shrub.userData.speciesId = 'shrub'

      shrubGroup.add(shrub)
      shrubCount++
    }
  }

  scene.add(shrubGroup)

  console.log(`灌木生成完成：${shrubCount} 簇`)
  return shrubGroup
}


// 生成低多边形苔藓岩石群落
export function createStones(scene, terrain, forest, water) {
  const cols = terrain.width
  const rows = terrain.height
  const heights = terrain.heights
  const waterData = water.fractions

  const stoneGroup = new THREE.Group()

  // 岩石模板：两种岩石模型随机克隆（初始灰、发现后恢复原色）
  const stoneTemplates = plantTemplates.stones || []

  let seed = 3091
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const spacing = terrain.spacing || 1
  const waterThreshold = 0.05

  const patchCount = Math.max(10, Math.floor(cols * rows / 350))
  const patches = []
  let attempts = 0

  while (patches.length < patchCount && attempts < patchCount * 20) {
    attempts++
    const x = 4 + Math.floor(random() * (cols - 8))
    const z = 4 + Math.floor(random() * (rows - 8))
    if (waterData[z][x] > waterThreshold) continue

    const worldX = (x - (cols - 1) / 2) * spacing
    const worldZ = (z - (rows - 1) / 2) * spacing

    const tooClose = patches.some(p => {
      const dx = p.x - worldX
      const dz = p.z - worldZ
      return Math.sqrt(dx * dx + dz * dz) < 6
    })
    if (tooClose) continue

    patches.push({ x: worldX, z: worldZ, gridX: x, gridZ: z })
  }

  let stoneCount = 0

  for (const patch of patches) {
    const stonesInPatch = 3 + Math.floor(random() * 4)

    for (let i = 0; i < stonesInPatch; i++) {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random()) * 1.8

      const worldX = patch.x + Math.cos(angle) * distance
      const worldZ = patch.z + Math.sin(angle) * distance

      const x = Math.round(worldX / spacing + (cols - 1) / 2)
      const z = Math.round(worldZ / spacing + (rows - 1) / 2)

      if (x < 2 || x >= cols - 2 || z < 2 || z >= rows - 2) continue
      if (waterData[z][x] > waterThreshold) continue

      // 从岩石模板克隆一块，略微嵌入地面更自然
      const stone = stoneTemplates.length
        ? clonePlant(
            stoneTemplates[Math.floor(random() * stoneTemplates.length)],
            0.8 + random() * 0.7
          )
        : new THREE.Group()

      stone.position.set(
        worldX,
        heights[z][x] - 0.08,
        worldZ
      )
      stone.rotation.y = random() * Math.PI * 2

      stone.userData.isPlant = true
      stone.userData.speciesId = 'stone'

      stoneGroup.add(stone)
      stoneCount++
    }
  }

  scene.add(stoneGroup)

  console.log(`苔藓岩石生成完成：${stoneCount} 块`)
  return stoneGroup
}


// 生成横卧地表的倒木
export function createFallenLogs(scene, terrain, forest, water, treeGroup) {
  const cols = terrain.width
  const rows = terrain.height
  const heights = terrain.heights
  const forestData = forest.fractions
  const waterData = water.fractions

  const logGroup = new THREE.Group()

  // 倒木模板：三种倒木模型随机克隆（初始灰、发现后恢复原色）
  const logTemplates = plantTemplates.fallenlogs || []

  // 收集树木位置，让倒木靠近林木
  const treePositions = []
  if (treeGroup) {
    treeGroup.children.forEach(tree => {
      if (tree.userData.isPlant &&
          ['tree1', 'tree2', 'tree3', 'tree4', 'tree5']
            .includes(tree.userData.speciesId)) {
        treePositions.push(tree.position)
      }
    })
  }

  let seed = 7223
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const spacing = terrain.spacing || 1
  const forestThreshold = 0.65
  const waterThreshold = 0.05

  const targetCount = Math.max(14, Math.floor(cols * rows / 500))
  let logCount = 0
  let attempts = 0

  while (logCount < targetCount && attempts < targetCount * 12) {
    attempts++

    // 倾向落在森林覆盖较好、且有树的位置附近
    let baseX, baseZ
    if (treePositions.length && random() < 0.7) {
      const base = treePositions[
        Math.floor(random() * treePositions.length)
      ]
      baseX = base.x + (random() - 0.5) * 3
      baseZ = base.z + (random() - 0.5) * 3
    } else {
      const x = 4 + Math.floor(random() * (cols - 8))
      const z = 4 + Math.floor(random() * (rows - 8))
      baseX = (x - (cols - 1) / 2) * spacing
      baseZ = (z - (rows - 1) / 2) * spacing
    }

    const x = Math.round(baseX / spacing + (cols - 1) / 2)
    const z = Math.round(baseZ / spacing + (rows - 1) / 2)

    if (x < 2 || x >= cols - 2 || z < 2 || z >= rows - 2) continue
    if (forestData[z][x] < forestThreshold) continue
    if (waterData[z][x] > waterThreshold) continue

    // 从倒木模板克隆一根，随机水平朝向横卧地表
    const log = logTemplates.length
      ? clonePlant(
          logTemplates[Math.floor(random() * logTemplates.length)],
          2.2 + random() * 1.0
        )
      : new THREE.Group()

    log.position.set(baseX, heights[z][x], baseZ)
    log.rotation.y = random() * Math.PI * 2

    log.userData.isPlant = true
    log.userData.speciesId = 'fallenlog'

    logGroup.add(log)
    logCount++
  }

  scene.add(logGroup)

  console.log(`倒木生成完成：${logCount} 根`)
  return logGroup
}


// 生成热带蘑菇群落
export function createMushrooms(scene, terrain, forest, water, treeGroup) {
  const cols = terrain.width
  const rows = terrain.height
  const heights = terrain.heights
  const forestData = forest.fractions
  const waterData = water.fractions

  const mushroomGroup = new THREE.Group()

  // 蘑菇模板：三种蘑菇模型随机克隆（初始灰、发现后恢复原色）
  const mushroomTemplates = plantTemplates.mushrooms || []

  // 蘑菇倾向出现在倒木与树木根部
  const basePositions = []
  if (treeGroup) {
    treeGroup.children.forEach(item => {
      if (item.userData.isPlant &&
          ['tree1', 'tree2', 'tree3', 'tree4', 'tree5', 'fallenlog']
            .includes(item.userData.speciesId)) {
        basePositions.push(item.position)
      }
    })
  }

  let seed = 5512
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const spacing = terrain.spacing || 1
  const forestThreshold = 0.55
  const waterThreshold = 0.05

  const patchCount = Math.max(12, Math.floor(cols * rows / 420))
  let mushroomCount = 0

  let attempts = 0
  const patches = []

  while (patches.length < patchCount && attempts < patchCount * 15) {
    attempts++

    let worldX, worldZ
    if (basePositions.length && random() < 0.8) {
      const base = basePositions[
        Math.floor(random() * basePositions.length)
      ]
      worldX = base.x + (random() - 0.5) * 1.6
      worldZ = base.z + (random() - 0.5) * 1.6
    } else {
      const x = 4 + Math.floor(random() * (cols - 8))
      const z = 4 + Math.floor(random() * (rows - 8))
      worldX = (x - (cols - 1) / 2) * spacing
      worldZ = (z - (rows - 1) / 2) * spacing
    }

    const x = Math.round(worldX / spacing + (cols - 1) / 2)
    const z = Math.round(worldZ / spacing + (rows - 1) / 2)

    if (x < 2 || x >= cols - 2 || z < 2 || z >= rows - 2) continue
    if (forestData[z][x] < forestThreshold) continue
    if (waterData[z][x] > waterThreshold) continue

    const tooClose = patches.some(p => {
      const dx = p.x - worldX
      const dz = p.z - worldZ
      return Math.sqrt(dx * dx + dz * dz) < 2.5
    })
    if (tooClose) continue

    patches.push({ x: worldX, z: worldZ, gridX: x, gridZ: z })
  }

  for (const patch of patches) {
    const count = 3 + Math.floor(random() * 4)

    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random()) * 0.5

      const worldX = patch.x + Math.cos(angle) * distance
      const worldZ = patch.z + Math.sin(angle) * distance

      const x = Math.round(worldX / spacing + (cols - 1) / 2)
      const z = Math.round(worldZ / spacing + (rows - 1) / 2)

      if (x < 2 || x >= cols - 2 || z < 2 || z >= rows - 2) continue
      if (waterData[z][x] > waterThreshold) continue

      // 从蘑菇模板克隆一朵
      const mushroom = mushroomTemplates.length
        ? clonePlant(
            mushroomTemplates[Math.floor(random() * mushroomTemplates.length)],
            0.22 + random() * 0.16
          )
        : new THREE.Group()

      mushroom.position.set(worldX, heights[z][x], worldZ)
      mushroom.rotation.y = random() * Math.PI * 2

      mushroom.userData.isPlant = true
      mushroom.userData.speciesId = 'mushroom'

      mushroomGroup.add(mushroom)
      mushroomCount++
    }
  }

  scene.add(mushroomGroup)

  console.log(`热带蘑菇生成完成：${mushroomCount} 朵`)
  return mushroomGroup
}


// 生成地表落叶堆
export function createFallenLeaves(scene, terrain, forest, water) {
  const cols = terrain.width
  const rows = terrain.height
  const heights = terrain.heights
  const forestData = forest.fractions
  const waterData = water.fractions

  const leafGroup = new THREE.Group()

  // 落叶模板：贴地叶片模型（初始灰、发现后恢复原色）
  const leafTemplates = plantTemplates.fallenleaves || []

  let seed = 9043
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const spacing = terrain.spacing || 1
  const forestThreshold = 0.55
  const waterThreshold = 0.05

  const patchCount = Math.max(20, Math.floor(cols * rows / 240))
  let leafCount = 0

  for (let p = 0; p < patchCount; p++) {
    const x = 3 + Math.floor(random() * (cols - 6))
    const z = 3 + Math.floor(random() * (rows - 6))

    if (forestData[z][x] < forestThreshold) continue
    if (waterData[z][x] > waterThreshold) continue

    const worldX = (x - (cols - 1) / 2) * spacing
    const worldZ = (z - (rows - 1) / 2) * spacing

    // 每堆落叶由几片叶片模型组成，散落贴地
    const pieces = 2 + Math.floor(random() * 2)
    for (let i = 0; i < pieces; i++) {
      const offsetAngle = random() * Math.PI * 2
      const offsetDist = random() * 0.45

      const leaf = leafTemplates.length
        ? clonePlant(leafTemplates[0], 0.4 + random() * 0.3)
        : new THREE.Group()

      leaf.position.set(
        worldX + Math.cos(offsetAngle) * offsetDist,
        heights[z][x] + 0.02,
        worldZ + Math.sin(offsetAngle) * offsetDist
      )

      leaf.rotation.y = random() * Math.PI * 2

      leaf.userData.isPlant = true
      leaf.userData.speciesId = 'fallenleaf'

      leafGroup.add(leaf)
      leafCount++
    }
  }

  scene.add(leafGroup)

  console.log(`落叶堆生成完成：${leafCount} 片`)
  return leafGroup
}


// 生成林间溪流 —— 贴合河床的水面网格
// 地形已在 main.js 中按 water.fractions 下沉为河床，
// 这里只需为每片连通水系生成覆盖其上的水面（发现后变溪水蓝）
export function createStreams(scene, terrain, forest, water) {
  const cols = terrain.width
  const rows = terrain.height
  const heights = terrain.heights
  const waterData = water.fractions

  const streamGroup = new THREE.Group()

  const streamMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4d4d4, // 未发现时为浅灰水面
    flatShading: false,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    vertexColors: true
  })

  // 发现后：溪水蓝
  const streamColor = new THREE.Color(0x73b9bb)

  const spacing = terrain.spacing || 1

  // —— 提取水域格子（fractions > 阈值），用 4 邻域连通分量分组
  const WATER_THRESHOLD = 0.05
  const visited = new Array(rows)
  for (let z = 0; z < rows; z++) {
    visited[z] = new Array(cols).fill(false)
  }

  const clusters = []
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      if (visited[z][x]) continue
      if (waterData[z][x] < WATER_THRESHOLD) continue

      // BFS 找连通簇
      const cluster = []
      const queue = [[x, z]]
      visited[z][x] = true
      while (queue.length) {
        const [cx, cz] = queue.shift()
        cluster.push([cx, cz])
        const neighbors = [
          [cx + 1, cz], [cx - 1, cz],
          [cx, cz + 1], [cx, cz - 1]
        ]
        for (const [nx, nz] of neighbors) {
          if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue
          if (visited[nz][nx]) continue
          if (waterData[nz][nx] < WATER_THRESHOLD) continue
          visited[nz][nx] = true
          queue.push([nx, nz])
        }
      }

      clusters.push(cluster)
    }
  }

  // 按簇规模降序，优先处理大簇
  clusters.sort((a, b) => b.length - a.length)

  const streamTargets = new Map()
  let created = 0
  for (const cluster of clusters) {
    // —— 圆润边界的水面网格 ——
    // 相比逐格拼接正方形：网格节点去重共享，边界节点按暴露程度
    // 向内收缩，再用拉普拉斯平滑圆化拐角，消除方块感
    const nodeMap = new Map()
    const nodeKey = (gx, gz) => gx * 1000 + gz

    const nodeWorldX = gx => (gx - (cols - 1) / 2) * spacing
    const nodeWorldZ = gz => (gz - (rows - 1) / 2) * spacing

    function getNode(gx, gz) {
      const key = nodeKey(gx, gz)
      let node = nodeMap.get(key)
      if (!node) {
        node = {
          gx, gz,
          cellDx: 0,   // 指向相邻簇内格子中心的累计方向（网格坐标系）
          cellDz: 0,
          cellCount: 0,
          boundary: false,
          px: nodeWorldX(gx), // 内缩 + 平滑后的最终位置
          pz: nodeWorldZ(gz)
        }
        nodeMap.set(key, node)
      }
      return node
    }

    const cellNodes = []

    for (const [x, z] of cluster) {
      const n00 = getNode(x, z)
      const n10 = getNode(x + 1, z)
      const n01 = getNode(x, z + 1)
      const n11 = getNode(x + 1, z + 1)
      cellNodes.push([n00, n10, n01, n11])

      const cx = x + 0.5
      const cz = z + 0.5
      for (const n of [n00, n10, n01, n11]) {
        const dx = cx - n.gx
        const dz = cz - n.gz
        const len = Math.hypot(dx, dz) || 1
        n.cellDx += dx / len
        n.cellDz += dz / len
        n.cellCount++
      }
    }

    // 边界判定 + 向内收缩：
    // 1 格相邻 = 外凸角（收最多），2 格 = 直边，3 格 = 内凹角（收最少）
    const shrink = [0, 0.38, 0.26, 0.1]
    for (const node of nodeMap.values()) {
      if (node.cellCount >= 4) continue
      node.boundary = true
      const amount = spacing * shrink[node.cellCount]
      const len = Math.hypot(node.cellDx, node.cellDz) || 1
      node.px += (node.cellDx / len) * amount
      node.pz += (node.cellDz / len) * amount
    }

    // 节点邻接（同格四边），边界节点做拉普拉斯平滑圆化拐角
    const adjacency = new Map()
    for (const [n00, n10, n01, n11] of cellNodes) {
      for (const [a, b] of [
        [n00, n10], [n00, n01], [n10, n11], [n01, n11]
      ]) {
        if (!adjacency.has(a)) adjacency.set(a, new Set())
        if (!adjacency.has(b)) adjacency.set(b, new Set())
        adjacency.get(a).add(b)
        adjacency.get(b).add(a)
      }
    }

    for (let iter = 0; iter < 2; iter++) {
      const updates = []
      for (const node of nodeMap.values()) {
        if (!node.boundary) continue
        const neighbors = adjacency.get(node)
        if (!neighbors || neighbors.size < 2) continue

        let ax = 0
        let az = 0
        for (const other of neighbors) {
          ax += other.px
          az += other.pz
        }
        ax /= neighbors.size
        az /= neighbors.size

        updates.push([
          node,
          node.px + (ax - node.px) * 0.5,
          node.pz + (az - node.pz) * 0.5
        ])
      }
      for (const [node, x, z] of updates) {
        node.px = x
        node.pz = z
      }
    }

    // 节点 → 顶点：高度按最终位置双线性采样河床，
    // 边界略低于中部，形成圆滑过渡的岸线
    function sampleBed(wx, wz) {
      const fx = wx / spacing + (cols - 1) / 2
      const fz = wz / spacing + (rows - 1) / 2
      const x0 = Math.min(cols - 2, Math.max(0, Math.floor(fx)))
      const z0 = Math.min(rows - 2, Math.max(0, Math.floor(fz)))
      const tx = Math.min(1, Math.max(0, fx - x0))
      const tz = Math.min(1, Math.max(0, fz - z0))
      const h00 = heights[z0][x0]
      const h10 = heights[z0][x0 + 1]
      const h01 = heights[z0 + 1][x0]
      const h11 = heights[z0 + 1][x0 + 1]
      return (h00 * (1 - tx) + h10 * tx) * (1 - tz) +
        (h01 * (1 - tx) + h11 * tx) * tz
    }

    const nodeIndex = new Map()
    const positions = []
    for (const node of nodeMap.values()) {
      nodeIndex.set(nodeKey(node.gx, node.gz), positions.length / 3)
      const lift = node.boundary ? 0.02 : 0.05
      positions.push(
        node.px,
        sampleBed(node.px, node.pz) + lift,
        node.pz
      )
    }

    const indices = []
    for (const [n00, n10, n01, n11] of cellNodes) {
      indices.push(
        nodeIndex.get(nodeKey(n00.gx, n00.gz)),
        nodeIndex.get(nodeKey(n01.gx, n01.gz)),
        nodeIndex.get(nodeKey(n10.gx, n10.gz)),
        nodeIndex.get(nodeKey(n10.gx, n10.gz)),
        nodeIndex.get(nodeKey(n01.gx, n01.gz)),
        nodeIndex.get(nodeKey(n11.gx, n11.gz))
      )
    }

    const streamGeometry = new THREE.BufferGeometry()
    streamGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    )
    streamGeometry.setIndex(indices)
    streamGeometry.computeVertexNormals()

    // 顶点色：轻微明暗变化，模拟低多边形水面的水光
    applyGradient(streamGeometry, {
      top: [1.04, 1.04, 1.04],
      bottom: [0.92, 0.92, 0.92],
      jitter: 0.025
    })

    const stream = new THREE.Mesh(streamGeometry, streamMaterial.clone())
    applyPainterlyMaterial(stream.material, 'water')

    // 把几何体平移为以簇中心为原点，mesh 定位到中心：
    // 渲染位置不变，但 getWorldPosition 能返回真实位置
    // （供小地图标记等功能使用）
    streamGeometry.computeBoundingBox()
    const streamCenter = new THREE.Vector3()
    streamGeometry.boundingBox.getCenter(streamCenter)
    streamGeometry.translate(
      -streamCenter.x, -streamCenter.y, -streamCenter.z
    )
    stream.position.copy(streamCenter)

    stream.userData.targetColor = streamColor
    stream.userData.isPlant = true
    stream.userData.speciesId = 'stream'
    for (const [x, z] of cluster) streamTargets.set(`${x},${z}`, stream.uuid)

    streamGroup.add(stream)
    created++
  }

  // 交互代理：溪流是一整片连通水面，单个 mesh 的位置无法代表
  // 各处；按对角网格（(x+z)%3）布置不可见标记，覆盖模拟显示
  // 水面任意位置到最近代理不超过 2.3 米，小于 3 米交互半径
  let proxyCount = 0
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      if (!visited[z][x]) continue
      if ((x + z) % 3 !== 0) continue

      const proxy = new THREE.Object3D()
      proxy.position.set(
        (x - (cols - 1) / 2) * spacing,
        heights[z][x] + 0.03,
        (z - (rows - 1) / 2) * spacing
      )
      proxy.userData.isPlant = true
      proxy.userData.speciesId = 'stream'
      proxy.userData.outlineTargetUuid = streamTargets.get(`${x},${z}`)
      streamGroup.add(proxy)
      proxyCount++
    }
  }

  scene.add(streamGroup)

  console.log(
    `林间溪流生成完成：${created} 片水面，` +
    `${proxyCount} 个交互代理（基于 water.json ` +
    `${clusters.length} 个水系簇，贴合河床）`
  )
  return streamGroup
}
