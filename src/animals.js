import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { createDiscoveryMaterial } from './discoveryMaterial.js'
import { getModelBounds } from './modelBounds.js'
import { attachAnimalAnimation, updateAnimalAnimation } from './animalAnimation.js'

// ===================== 第二阶段：婆罗洲雨林动物（GLB 模型版） =====================
// 10 种动物使用 public/Animals.undefined-glb/ 下的 GLB 模型：
// 初始灰色（材质染灰），发现后按模型原始颜色变色
// 昆虫/节肢 39（凤蝶 7 / 蜜蜂 8 / 蚂蚁 3 群 × 8 / 捕鸟蛛 6 / 雨林蝎 6）、
// 红叶猴 5、猩猩 8 / 犀鸟 8 / 飞蛙 8 / 网纹蟒 6
// 动物带有简单运动：地面漫游走动、蛙类跳跃、昆虫低空飞行、蚁队行进
// 模型挂入 treeGroup 并标记 isPlant，完整复用植物的发现与变色系统

// 物种 → GLB 文件与目标尺寸（世界单位米）映射
// size 按模型包围盒最大维度归一化
const GLB_MAP = {
  orangutan:     { file: 'Baboon.glb',    size: 1.9 },
  butterfly:     { file: 'Butterfly.glb', size: 0.5 },
  hornbill:      { file: 'Hornbill.glb',  size: 0.7 },
  flyingfrog:    { file: 'Frog.glb',      size: 0.3 },
  ant:           { file: 'Ant.glb',       size: 0.18 },
  redleafmonkey: { file: 'monkey.glb',    size: 1.4 },
  snake:         { file: 'Snake.glb',     size: 1.2 },
  spider:        { file: 'Spider.glb',    size: 0.3 },
  scorpion:      { file: 'Scorpion.glb',  size: 0.25 },
  bee:           { file: 'Bee.glb',       size: 0.2 }
}

// 加载全部 GLB 模板：按包围盒归一化尺寸、底部落地、水平居中
async function loadAnimalModels() {
  const loader = new GLTFLoader()
  const templates = {}

  await Promise.all(
    Object.entries(GLB_MAP).map(([id, conf]) =>
      new Promise((resolve) => {
        loader.load(
          `/Animals.undefined-glb/${encodeURIComponent(conf.file)}`,
          (gltf) => {
            const model = gltf.scene

            // 归一化：包围盒 → 缩放到目标尺寸 → 底部落地 + 水平居中
            const box = getModelBounds(model)
            const dims = new THREE.Vector3()
            box.getSize(dims)
            const maxDim = Math.max(dims.x, dims.y, dims.z) || 1
            const scale = conf.size / maxDim
            model.scale.setScalar(scale)

            const scaledBox = getModelBounds(model)
            const center = new THREE.Vector3()
            scaledBox.getCenter(center)

            model.position.set(-center.x, -scaledBox.min.y, -center.z)

            const wrapper = new THREE.Group()
            wrapper.add(model)
            wrapper.animations = gltf.animations
            templates[id] = wrapper
            resolve()
          },
          undefined,
          (err) => {
            console.error(`动物模型加载失败：${conf.file}`, err)
            resolve()
          }
        )
      })
    )
  )

  return templates
}

// 从模板克隆一只动物个体：
// 骨骼网格（捕鸟蛛）必须用 SkeletonUtils 克隆，
// 普通 clone 会共享模板骨架导致蒙皮网格不渲染；
// 每个网格独立材质（发现变色互不影响），初始染灰并记录原始颜色
function cloneAnimal(template) {
  const animal = cloneSkeleton(template)

  animal.traverse((object) => {
    if (!object.isMesh) return

    object.material = Array.isArray(object.material)
      ? object.material.map(source => createDiscoveryMaterial(source, object.geometry))
      : createDiscoveryMaterial(object.material, object.geometry)
  })

  return animal
}

// ===================== 动物运动配置 =====================
// 有动画的模型播放骨骼动作，静态网格沿原有路径运动：
//   static   静止不动（两种猴子）
//   walk     地面漫游（随机转向，活动范围锚点半径 2.5m，蛇带 S 形摆动）
//   hop      蛙类周期跳跃（抛物线）
//   fly      昆虫低空绕锚点盘旋
//   antmarch 蚁队沿方向往返行进
const MOTION_CONFIG = {
  orangutan:     { type: 'static' },
  redleafmonkey: { type: 'static' },
  hornbill:      { type: 'walk', speed: 0.22 },
  snake:         { type: 'walk', speed: 0.45, wiggle: true },
  spider:        { type: 'walk', speed: 0.15, animated: true },
  scorpion:      { type: 'walk', speed: 0.12 },
  butterfly:     { type: 'fly', radius: 1.2, speed: 0.9 },
  bee:           { type: 'fly', radius: 0.8, speed: 1.5 },
  flyingfrog:    { type: 'hop' },
  ant:           { type: 'antmarch', speed: 0.12 }
}

// ===================== 动物群生成 =====================
export async function createAnimals(scene, terrain, forest, water) {
  const templates = await loadAnimalModels()

  const cols = terrain.width
  const rows = terrain.height
  const heights = terrain.heights
  const spacing = terrain.spacing || 1
  const forestData = forest.fractions
  const waterData = water.fractions

  const animalGroup = new THREE.Group()

  let seed = 20260
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  // 随机找一个满足条件的网格（带重试上限）
  function findCell(pred) {
    for (let i = 0; i < 200; i++) {
      const x = 2 + Math.floor(random() * (cols - 4))
      const z = 2 + Math.floor(random() * (rows - 4))
      if (pred(x, z)) return { x, z }
    }
    return null
  }

  const inForest = (x, z) =>
    (forestData[z][x] || 0) > 0.55 &&
    (waterData[z][x] || 0) <= 0.05

  const nearWater = (x, z) => {
    if ((waterData[z][x] || 0) > 0.05) return false
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx
        const nz = z + dz
        if (nx >= 0 && nx < cols && nz >= 0 && nz < rows &&
            (waterData[nz][nx] || 0) > 0.05) {
          return true
        }
      }
    }
    return false
  }

  // 生成一种动物的 N 只个体
  // spawnY：模型底部相对地形高度的额外抬升
  function spawnSpecies(id, count, cellPred, spawnY) {
    const template = templates[id]
    if (!template) return 0

    let placed = 0
    for (let i = 0; i < count; i++) {
      const cell = findCell(cellPred)
      if (!cell) break

      const animal = cloneAnimal(template)
      const spacing = terrain.spacing || 1
      const wx = (cell.x - (cols - 1) / 2) * spacing
      const wz = (cell.z - (rows - 1) / 2) * spacing
      const baseY = heights[cell.z][cell.x] + spawnY

      animal.position.set(wx, baseY, wz)
      animal.rotation.y = random() * Math.PI * 2

      animal.userData.isPlant = true
      animal.userData.speciesId = id
      animal.userData.animal = true
      animal.userData.baseY = baseY
      animal.userData.idlePhase = random() * Math.PI * 2
      // 飞行动物浮动更明显
      animal.userData.idleAmp = id === 'butterfly'
        ? 0.14 : id === 'hornbill' ? 0.08 : 0.02

      // 运动参数：锚点（活动中心）、朝向、跳跃计时
      animal.userData.motion = MOTION_CONFIG[id] || { type: 'walk', speed: 0.2 }
      animal.userData.anchor = new THREE.Vector2(wx, wz)
      animal.userData.heading = random() * Math.PI * 2
      animal.userData.hopTimer = 1 + random() * 2
      animal.userData.jumpT = -1
      // 飞行物种的离地高度（凤蝶 1.6 / 蜜蜂 1.0）
      animal.userData.flyHeight = spawnY

      if (animal.userData.motion.animated) {
        animal.userData.hasLocomotion = attachAnimalAnimation(animal, template.animations, random())
        animal.userData.walkTimer = 2 + random() * 3
        animal.userData.resting = false
        animal.userData.idleAmp = 0 // The authored action supplies the body motion.
      }

      animalGroup.add(animal)
      placed++
    }
    console.log(`动物生成：${id} × ${placed}`)
    return placed
  }

  // 蚁群：多条蚁队，每条排成一行进队列（选一个林地起点和方向，
  // 沿方向排开，带轻微蜿蜒模拟蚁群行进）
  function spawnAntColony(colonyCount, perColony) {
    const template = templates['ant']
    if (!template) return 0

    let placed = 0
    for (let c = 0; c < colonyCount; c++) {
      const start = findCell(inForest)
      if (!start) break

      const heading = random() * Math.PI * 2
      const dirX = Math.cos(heading)
      const dirZ = Math.sin(heading)

      for (let i = 0; i < perColony; i++) {
        // 队列：前后间距 0.45m，垂直方向正弦蜿蜒
        const along = i * 0.45
        const side = Math.sin(i * 1.3) * 0.3
        const wx = start.x * spacing - (cols - 1) / 2 * spacing +
          dirX * along - dirZ * side
        const wz = start.z * spacing - (rows - 1) / 2 * spacing +
          dirZ * along + dirX * side

        // 世界坐标反算网格取地面高度，并夹在地图范围内
        const cx = Math.min(cols - 3, Math.max(2,
          Math.round(wx / spacing + (cols - 1) / 2)))
        const cz = Math.min(rows - 3, Math.max(2,
          Math.round(wz / spacing + (rows - 1) / 2)))
        const baseY = heights[cz][cx]

        const animal = cloneAnimal(template)
        animal.position.set(wx, baseY, wz)
        // 蚂蚁朝向队列行进方向
        animal.rotation.y = -heading + Math.PI / 2

        animal.userData.isPlant = true
        animal.userData.speciesId = 'ant'
        animal.userData.animal = true
        animal.userData.baseY = baseY
        animal.userData.idlePhase = random() * Math.PI * 2
        animal.userData.idleAmp = 0.02

        // 蚁队行进参数
        animal.userData.motion = MOTION_CONFIG.ant
        animal.userData.anchor = new THREE.Vector2(wx, wz)
        animal.userData.heading = heading
        animal.userData.traveled = 0

        animalGroup.add(animal)
        placed++
      }
    }
    console.log(`动物生成：ant 蚁群 × ${placed}（${colonyCount} 群 × ${perColony}）`)
    return placed
  }

  const total =
    spawnSpecies('orangutan', 8, inForest, 0) +
    spawnSpecies('butterfly', 7, inForest, 1.6) +
    spawnSpecies('hornbill', 8, inForest, 0) +
    spawnSpecies('flyingfrog', 8, nearWater, 0) +
    spawnAntColony(3, 8) +
    spawnSpecies('redleafmonkey', 5, inForest, 0) +
    spawnSpecies('snake', 6, inForest, 0) +
    spawnSpecies('spider', 6, inForest, 0) +
    spawnSpecies('scorpion', 6, inForest, 0) +
    spawnSpecies('bee', 8, inForest, 1.0)

  scene.add(animalGroup)
  console.log(`第二阶段动物全部生成：${total} 只（GLB 模型）`)
  return animalGroup
}

// ===================== 动物运动系统 =====================
// 捕鸟蛛使用原生行走/待机动画，其他静态网格沿物种对应路径运动：
//   walk     地面漫游（随机转向，活动范围锚点半径 2.5m，蛇带 S 形摆动）
//   hop      蛙类周期跳跃（抛物线）
//   fly      昆虫低空绕锚点盘旋
//   antmarch 蚁队沿方向往返行进
// terrain 用于实时采样地面高度，保证贴地

function groundHeightAt(terrain, wx, wz) {
  const spacing = terrain.spacing || 1
  const cols = terrain.width
  const rows = terrain.height
  const cx = Math.min(cols - 3, Math.max(2,
    Math.round(wx / spacing + (cols - 1) / 2)))
  const cz = Math.min(rows - 3, Math.max(2,
    Math.round(wz / spacing + (rows - 1) / 2)))
  return terrain.heights[cz][cx]
}

export function updateAnimalIdle(animalGroup, elapsed, delta, terrain) {
  if (!animalGroup || !terrain) return

  animalGroup.traverse((animal) => {
    if (!animal.userData || !animal.userData.animal) return

    const u = animal.userData
    const motion = u.motion || { type: 'walk', speed: 0.2 }
    let gaitSpeed = 1
    if (u.hasLocomotion) {
      u.walkTimer -= delta
      if (u.walkTimer <= 0) {
        u.resting = !u.resting
        u.walkTimer = u.resting ? 1 + Math.random() * 2 : 3 + Math.random() * 3
      }
      gaitSpeed = updateAnimalAnimation(animal, delta, !u.resting, motion.speed / 0.15)
    }

    // 静态物种：保持原位不动
    if (motion.type === 'static') return

    if (motion.type === 'fly') {
      // 低空绕锚点盘旋
      const theta = elapsed * motion.speed + u.idlePhase
      const r = motion.radius
      const nx = u.anchor.x + Math.cos(theta) * r
      const nz = u.anchor.y + Math.sin(theta) * r

      animal.position.x = nx
      animal.position.z = nz
      animal.position.y =
        groundHeightAt(terrain, nx, nz) + (u.flyHeight || 1.5) +
        Math.abs(Math.sin(elapsed * 1.6 + u.idlePhase)) * u.idleAmp

      // 朝切线方向
      animal.rotation.y = -theta + Math.PI / 2
      return
    }

    if (motion.type === 'hop') {
      // 蛙类：待机若干秒后向前跳一段（抛物线）
      if (u.jumpT < 0) {
        u.hopTimer -= delta
        animal.position.y = groundHeightAt(terrain,
          animal.position.x, animal.position.z)

        if (u.hopTimer <= 0) {
          u.jumpT = 0
          u.hopHeading = animal.userData.heading
        }
      } else {
        u.jumpT += delta / 0.55
        if (u.jumpT >= 1) {
          // 落地：重置计时，随机转向
          u.jumpT = -1
          u.hopTimer = 1.2 + Math.random() * 2.2
          u.heading = Math.random() * Math.PI * 2
          animal.rotation.y = Math.atan2(
            Math.cos(u.heading), Math.sin(u.heading))
        } else {
          const dx = Math.cos(u.hopHeading)
          const dz = Math.sin(u.hopHeading)
          const step = 0.85 * delta / 0.55
          animal.position.x += dx * step
          animal.position.z += dz * step
          animal.position.y =
            groundHeightAt(terrain, animal.position.x, animal.position.z) +
            Math.sin(Math.PI * u.jumpT) * 0.35
        }
      }
      return
    }

    if (motion.type === 'antmarch') {
      // 蚁队：沿方向前进一段后折返
      const dx = Math.cos(u.heading)
      const dz = Math.sin(u.heading)
      const step = motion.speed * delta

      animal.position.x += dx * step
      animal.position.z += dz * step
      u.traveled += step

      if (u.traveled > 2.0) {
        u.traveled = 0
        u.heading += Math.PI
      }

      animal.position.y = groundHeightAt(terrain,
        animal.position.x, animal.position.z)
      animal.rotation.y = Math.atan2(dx, dz)
      return
    }

    // 默认：walk 地面漫游
    // 缓慢随机转向；偏离锚点超过 2.5m 则逐渐转回锚点
    let heading = u.heading
    if (motion.wiggle) {
      // 蛇：S 形行进
      heading += Math.sin(elapsed * 3 + u.idlePhase) * 0.5
    }

    const dxAnchor = u.anchor.x - animal.position.x
    const dzAnchor = u.anchor.y - animal.position.z
    const distToAnchor = Math.sqrt(dxAnchor * dxAnchor + dzAnchor * dzAnchor)

    if (distToAnchor > 2.5) {
      const targetHeading = Math.atan2(dzAnchor, dxAnchor)
      let diff = targetHeading - heading
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      heading += diff * Math.min(delta * 2, 1)
    } else {
      heading += Math.sin(elapsed * 0.4 + u.idlePhase) * 0.18 * delta * gaitSpeed
    }
    u.heading = heading

    const dx = Math.cos(heading)
    const dz = Math.sin(heading)
    const step = motion.speed * delta * gaitSpeed

    animal.position.x += dx * step
    animal.position.z += dz * step
    animal.position.y = groundHeightAt(terrain,
      animal.position.x, animal.position.z) +
      Math.abs(Math.sin(elapsed * 1.6 + u.idlePhase)) * u.idleAmp

    // 朝向行进方向（蛇额外叠加身体摆动）
    const faceWiggle = motion.wiggle
      ? Math.sin(elapsed * 3 + u.idlePhase) * 0.35 : 0
    animal.rotation.y = Math.atan2(dx, dz) + faceWiggle
  })
}
