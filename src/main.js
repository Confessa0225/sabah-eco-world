
import * as THREE from 'three'
import './style.css'
import { createCatalogBook } from './catalogBook.js'
import { createInteractionOutline } from './interactionOutline.js'
import { createFluffyGrass } from './fluffyGrass.js'
import { applyPainterlyMaterial, updatePainterlyEnvironment } from './painterlyMaterials.js'
import { createStarField, overviewVisibility, overviewFog, starVisibility } from './environmentEffects.js'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import {
  initPlantTemplates,
  createTrees,
  createFerns,
  getSpeciesType,
  animatePlantColor,
  createShrubs,
  createStones,
  createFallenLogs,
  createMushrooms,
  createFallenLeaves,
  createStreams
} from './trees.js'
import {
  createAnimals,
  updateAnimalIdle
} from './animals.js'

let treeGroup = null
let animalGroup = null
// 当前玩家附近可发现的植物
let nearbyPlant = null
let interactionTarget = null
let discoveredSpecies = new Set()
const ecoSpecies = [
  {
    id: 'tree1', name: '婆罗洲榕树', icon: '🌳',
    desc: '婆罗洲热带雨林中有许多高大的榕树，树冠向四周伸展，像一把撑开的伞。宽阔的树冠能够争取阳光，也为鸟类、昆虫和其他树栖动物提供栖息空间。'
  },
  {
    id: 'tree2', name: '圆冠雨林树', icon: '🌲',
    desc: '圆润饱满的树冠是热带雨林常见的树形特征之一。茂密的枝叶可以遮挡阳光，形成明暗交错的林下环境，为喜阴植物和小型动物创造生存空间。'
  },
  {
    id: 'tree3', name: '尖塔龙脑香', icon: '🎄',
    desc: '龙脑香科树木是婆罗洲雨林的标志性树种，树冠较窄、向上延伸，外形像尖塔。这种形态有助于树木在复杂的森林群落中争取光照，也让森林呈现出丰富的垂直层次。'
  },
  {
    id: 'tree4', name: '层叠娑罗树', icon: '🌴',
    desc: '娑罗树的枝叶呈现出一层一层展开的形态。不同高度的枝叶构成了复杂的树冠结构，为昆虫、鸟类和其他动物提供多样的活动空间。'
  },
  {
    id: 'tree5', name: '雨林巨树', icon: '🌴',
    desc: '婆罗洲雨林中耸立着一些参天巨树，它们比周围林木高出许多，是森林的"骨架"。巨树为附生植物提供生长之地，也是猩猩、犀鸟等树栖动物重要的家园。'
  },
  {
    id: 'fern', name: '热带蕨类', icon: '🌿',
    desc: '蕨类植物通过孢子繁殖，不开花也不结种子。它们常生长在潮湿、阴凉的林下环境中，羽状叶片能够帮助它们充分利用有限的光照，是热带雨林地表的重要组成部分。'
  },
  {
    id: 'shrub', name: '雨林灌木', icon: '🌱',
    desc: '灌木通常植株较矮、分枝较多，生长在林下或林缘。它们的叶片、花朵和果实可以为昆虫及小型动物提供食物与藏身之处，也有助于维持森林下层的生物多样性。'
  },
  {
    id: 'stone', name: '苔藓岩石', icon: '🪨',
    desc: '婆罗洲气候温暖湿润，森林中的岩石表面常有苔藓生长。苔藓能够在岩石表面形成柔软的绿色覆盖层，为微小生物提供潮湿的微环境，也有助于岩石表面有机物的积累。'
  },
  {
    id: 'fallenlog', name: '倒木', icon: '🪵',
    desc: '树木倒下后并不会立即失去生态价值。倒木会逐渐被真菌、细菌和昆虫分解，释放养分回到土壤中，同时为甲虫、蚂蚁和其他小型生物提供食物与栖息场所，是森林物质循环的重要环节。'
  },
  {
    id: 'mushroom', name: '热带蘑菇', icon: '🍄',
    desc: '高温潮湿的环境适合许多真菌生长。蘑菇是真菌产生的繁殖结构，能够释放孢子；许多森林真菌会分解枯叶和腐木，将有机物转化为其他生物可以利用的养分。'
  },
  {
    id: 'fallenleaf', name: '落叶堆', icon: '🍂',
    desc: '热带雨林的树木会持续更新叶片，地面因此积累大量落叶。落叶在微生物、真菌和土壤动物的作用下逐渐分解，形成腐殖质，并将养分重新带回森林生态系统。'
  },
  {
    id: 'stream', name: '林间溪流', icon: '💧',
    desc: '婆罗洲降雨丰富，雨水沿着山坡汇集，形成穿过森林的溪流。溪流为蛙类、昆虫和其他水生生物提供栖息环境，也将水分和养分输送到森林不同区域。树木根系、落叶和岩石共同影响着溪流周围的生态环境。'
  }
]

// 由物种表派生统一的 id→名称 映射，供提示与发现信息复用
let speciesNames = Object.fromEntries(
  ecoSpecies.map(species => [species.id, species.name])
)

// ===== 第二阶段：雨林动物 =====
// 植物图鉴全部发现后进入；图鉴/进度/卡片切换为动物版本
const animalSpecies = [
  {
    id: 'orangutan', name: '婆罗洲猩猩', icon: '🦧',
    desc: '婆罗洲猩猩是亚洲现存最大的灵长类动物之一，长而灵活的手臂让它们能在树冠间从容攀爬。它们主要以果实为食，在森林中传播种子，被称为"雨林园丁"。'
  },
  {
    id: 'butterfly', name: '拉惹布鲁克鸟翼凤蝶', icon: '🦋',
    desc: '这是世界上体型最大的蝴蝶之一，黑色翅膀上的翠绿色斑纹在阳光下闪动，让它们成为雨林中最醒目的飞行者之一。成虫喜欢在林间空地和溪流附近活动。'
  },
  {
    id: 'hornbill', name: '犀鸟', icon: '🦜',
    desc: '犀鸟因头上巨大的喙和盔突而得名。它们在树洞中筑巢，以果实和小动物为食，飞行时翅膀拍动声洪亮，是热带雨林中重要的种子传播者。'
  },
  {
    id: 'flyingfrog', name: '华莱士飞蛙', icon: '🐸',
    desc: '这种树蛙的脚趾间长着宽大的蹼，展开后像小降落伞，能在树与树之间滑翔短距离。它们大多在夜间活动，栖息在雨林高层的叶片间。'
  },
  {
    id: 'ant', name: '大型森林蚂蚁', icon: '🐜',
    desc: '婆罗洲森林中的大型蚂蚁体长可观，是社会性昆虫。它们分工明确地维护蚁群，搬运食物、修筑巢穴，在土壤翻动和养分循环中扮演重要角色。'
  },
  {
    id: 'redleafmonkey', name: '红叶猴', icon: '🐒',
    desc: '红叶猴有着红褐色的毛发和细长的四肢，主要栖息在树冠层，以嫩叶为食。它们行动敏捷，常在清晨和黄昏成群活动。'
  },
  {
    id: 'snake', name: '婆罗洲网纹蟒', icon: '🐍',
    desc: '网纹蟒是世界上最长的蛇类之一，栖息在婆罗洲的低地雨林和湿地中。它们以伏击方式捕猎，凭借缠绕力制服猎物，是雨林中顶级的隐形猎手。'
  },
  {
    id: 'spider', name: '热带捕鸟蛛', icon: '🕷️',
    desc: '捕鸟蛛体型硕大、全身覆盖绒毛，多在夜间活动。它们不靠蛛网捕猎，而是守在洞穴口伏击路过的小型动物，是雨林地面的隐秘住客。'
  },
  {
    id: 'scorpion', name: '雨林蝎', icon: '🦂',
    desc: '雨林蝎栖息在湿热的地表与落叶层中，昼伏夜出。它们用尾刺麻痹猎物，白天常躲藏在石缝和朽木下，是森林食物链中重要的一环。'
  },
  {
    id: 'bee', name: '热带蜜蜂', icon: '🐝',
    desc: '婆罗洲的森林里生活着多种野生蜜蜂，它们为大量雨林植物传粉。蜂群筑巢于大树枝干上，蜂蜜也是当地生态系统和传统生活的重要组成部分。'
  }
]

// 游戏阶段：plants（植物图鉴）→ transition（过场）→ animals（动物图鉴）
let gamePhase = 'plants'

function currentSpeciesList() {
  return gamePhase === 'animals' ? animalSpecies : ecoSpecies
}

// 地图等比例缩放系数：1 = 原始网格间距，1.5 = 地图边长放大 1.5 倍
// （网格数不变，所有模型数量不变，仅世界坐标间距放大）
const MAP_SPACING = 1.5

let discoveryAnimating = false
// 植物非全景发现和动物发现：仅变色，不动镜头
let stationaryDiscovery = null
let discoveryMessageUntil = 0

// 发现动画的时间控制
let discoveryAnimation = {
  startTime: 0,
  duration: 6000,
  phase: 'idle',
  speciesId: null,
  startPosition: null,
  startQuaternion: null,
  overviewPosition: null,
  overviewQuaternion: null
}


const scene = new THREE.Scene()
scene.background = new THREE.Color(0xe8e8e8)

// 第一人称相机
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

// 相机高度暂时设为 2，后续再适配真实地形
camera.position.set(0, 0.5, 10)

// 渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
const interactionOutline = createInteractionOutline(renderer, scene, camera)

document.body.style.margin = '0'
document.body.style.overflow = 'hidden'

// 将 3D 画布挂载到地图容器
const worldContainer = document.getElementById('eco-world')
worldContainer.appendChild(renderer.domElement)

const discoveryHint = document.createElement('div')
discoveryHint.textContent = ''
discoveryHint.style.cssText = `
  position: fixed;
  left: 50%;
  bottom: 15%;
  transform: translateX(-50%);
  padding: 12px 20px;
  background: rgba(20, 25, 20, 0.85);
  color: white;
  font-size: 16px;
  border-radius: 8px;
  display: none;
  pointer-events: none;
  z-index: 1000;
`
document.body.appendChild(discoveryHint)

// ===== 序章 · 进入森林 =====
// 黑底极简文字引导：渐入 → 停留 → 淡出（参考"极简文字引导.html"序章）
const prologueFont =
  "'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif"

const prologueKeyframes = document.createElement('style')
prologueKeyframes.textContent = `
  @keyframes prologueIn { to { opacity: 1; } }
`
document.head.appendChild(prologueKeyframes)

const prologue = document.createElement('div')
prologue.style.cssText = `
  position: fixed; inset: 0; z-index: 3000;
  background: #171a17;
  display: flex; align-items: center; justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: opacity 1.6s ease;
`
prologue.innerHTML = `
  <div style="position: relative; z-index: 1;">
    <div style="color: #828c80; font-family: ${prologueFont}; font-size: 11px; letter-spacing: .24em; margin-bottom: 24px; opacity: 0; animation: prologueIn 1.8s ease .6s forwards;">森林深处</div>
    <div style="color: #edf0e8; font-family: ${prologueFont}; font-size: clamp(20px, 3vw, 28px); font-weight: 300; letter-spacing: .12em; opacity: 0; animation: prologueIn 1.8s ease 1.2s forwards;">有些生命，尚未被看见。</div>
  </div>
`
document.body.appendChild(prologue)

// 点击提示（序章淡出后显示，引导玩家点击锁定鼠标）
const enterHint = document.createElement('div')
enterHint.textContent = '点击画面 · 进入森林'
enterHint.style.cssText = `
  position: fixed; left: 50%; bottom: 18%; transform: translateX(-50%);
  color: #edf0e8; font-family: ${prologueFont};
  font-size: 15px; font-weight: 300; letter-spacing: .18em;
  text-shadow: 0 1px 10px rgba(0, 0, 0, .6);
  opacity: 0; transition: opacity 1.2s ease;
  display: none; pointer-events: none; z-index: 2500;
`
document.body.appendChild(enterHint)

// 新手指引：按下 E 键进行交互（首次进入森林后显示）
const eHint = document.createElement('div')
eHint.innerHTML = `
  <div style="font-size: 19px; font-weight: 300; letter-spacing: .14em;">按下 E 键 · 进行交互</div>
  <div style="margin-top: 12px; color: #b0b8ad; font-size: 12px; letter-spacing: .12em;">靠近黑白生物，发现新物种</div>
`
eHint.style.cssText = `
  position: fixed; left: 50%; bottom: 16%; transform: translateX(-50%);
  text-align: center; color: #edf0e8; font-family: ${prologueFont};
  text-shadow: 0 1px 10px rgba(0, 0, 0, .6);
  opacity: 0; transition: opacity 1.2s ease;
  display: none; pointer-events: none; z-index: 2500;
`
document.body.appendChild(eHint)

function showHint(el) {
  el.style.display = 'block'
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { el.style.opacity = '1' })
  })
}

function hideHint(el) {
  el.style.opacity = '0'
  setTimeout(() => { el.style.display = 'none' }, 1300)
}

let prologueDone = false
function endPrologue() {
  if (prologueDone) return
  prologueDone = true
  prologue.style.opacity = '0'
  prologue.style.pointerEvents = 'none'
  setTimeout(() => prologue.remove(), 1700)
  showHint(enterHint)
}
// 点击序章可跳过；否则文字渐入后停留片刻再淡出
prologue.addEventListener('click', endPrologue)
setTimeout(endPrologue, 5200)

// 地面颜色过渡：新手指引后从灰色渐变为随地形变化的草坪绿
// 顶点色插值让色斑之间衔接自然
const SOIL_GRAY = 0xb8 / 255
const soilTransition = { active: false, factor: 0 }
let terrainGrassTargets = null

const catalogBook = createCatalogBook({
  plants: ecoSpecies,
  animals: animalSpecies,
  discovered: discoveredSpecies,
  getWorld: () => treeGroup,
  onOpen: () => {
    if (controls.isLocked) controls.unlock()
    hideHint(enterHint)
    hideHint(eHint)
    Object.keys(moveState).forEach(key => { moveState[key] = false })
  },
  onSpecies: speciesId => showSpeciesCard(speciesId)
})

function renderEcoCatalog() {
  catalogBook.render()
}
// ===================== 科普卡片 =====================
// 发现物种时弹出，或在图鉴中点击已发现条目重新查看
const speciesCardOverlay = document.createElement('div')
speciesCardOverlay.style.cssText = `
  position: fixed; inset: 0; z-index: 1200;
  background: rgba(10, 14, 10, 0.55);
  display: none; align-items: center; justify-content: center;
`
speciesCardOverlay.innerHTML = `
  <div id="species-card" style="
    width: min(440px, 88vw);
    max-height: 76vh; overflow-y: auto;
    background: rgba(24, 30, 24, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 18px;
    padding: 26px 28px 22px;
    color: #f0f4ec;
    font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
    transform: translateY(14px); opacity: 0;
    transition: transform .25s ease, opacity .25s ease;
  ">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div id="species-card-icon" style="font-size: 34px; line-height: 1;"></div>
      <div>
        <div id="species-card-title" style="
          font-size: 20px; font-weight: bold; letter-spacing: .04em;"></div>
        <div style="font-size: 11px; color: #9fb39a; letter-spacing: .18em; margin-top: 2px;">
          ECHOES OF EARTH · 物种档案</div>
      </div>
    </div>
    <div style="
      height: 1px; margin: 16px 0;
      background: linear-gradient(90deg, rgba(255,255,255,0.25), transparent);"></div>
    <div id="species-card-desc" style="
      font-size: 14.5px; line-height: 1.9; color: #d8e0d2;
      text-align: justify;"></div>
    <div style="margin-top: 20px; text-align: right;">
      <button id="species-card-close" style="
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #fff; padding: 8px 22px; border-radius: 999px;
        font-size: 13px; letter-spacing: .1em; cursor: pointer;">
        继续探索
      </button>
    </div>
  </div>
`
document.body.appendChild(speciesCardOverlay)

let speciesCardOpen = false

function showSpeciesCard(speciesId, keepLock = false) {
  const species = ecoSpecies.concat(animalSpecies)
    .find(s => s.id === speciesId)
  if (!species) return

  document.getElementById('species-card-icon').textContent = species.icon
  document.getElementById('species-card-title').textContent = species.name
  document.getElementById('species-card-desc').textContent = species.desc

  // 保持锁定时（动物原地发现），提示用键盘关闭
  document.getElementById('species-card-close').textContent =
    catalogBook.isOpen ? '返回图鉴' : keepLock ? '按 E 键 · 继续探索' : '继续探索'

  speciesCardOverlay.style.display = 'flex'
  speciesCardOpen = true

  // 若正处于鼠标锁定（如图鉴查看时），先解锁让玩家能点按钮
  if (controls && controls.isLocked && !keepLock) {
    controls.unlock()
  }

  // 下一帧触发入场动画
  requestAnimationFrame(() => {
    const card = document.getElementById('species-card')
    if (card) {
      card.style.transform = 'translateY(0)'
      card.style.opacity = '1'
    }
  })
}

function hideSpeciesCard() {
  const card = document.getElementById('species-card')
  if (!speciesCardOpen) return

  speciesCardOpen = false
  if (!discoveryAnimating && !stationaryDiscovery) interactionTarget = null
  if (card) {
    card.style.transform = 'translateY(14px)'
    card.style.opacity = '0'
  }
  setTimeout(() => {
    speciesCardOverlay.style.display = 'none'
  }, 250)
}

document.getElementById('species-card-close')
  .addEventListener('click', hideSpeciesCard)

// 点击遮罩空白处关闭
speciesCardOverlay.addEventListener('click', (event) => {
  if (event.target === speciesCardOverlay) {
    hideSpeciesCard()
  }
})

// ===================== 第二阶段过场动画 =====================
// 植物图鉴全部发现后：黑底文字过场 → 动物在彩色地图上出现（初始灰色）
const phaseTwoOverlay = document.createElement('div')
phaseTwoOverlay.style.cssText = `
  position: fixed; inset: 0; z-index: 3000;
  background: #171a17;
  display: none; align-items: center; justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: opacity 1.6s ease;
`
phaseTwoOverlay.innerHTML = `
  <div style="position: relative; z-index: 1;">
    <div style="color: #828c80; font-family: ${prologueFont}; font-size: 11px; letter-spacing: .24em; margin-bottom: 24px; opacity: 0; animation: prologueIn 1.8s ease .6s forwards;">森林苏醒</div>
    <div style="color: #edf0e8; font-family: ${prologueFont}; font-size: clamp(20px, 3vw, 28px); font-weight: 300; letter-spacing: .12em; opacity: 0; animation: prologueIn 1.8s ease 1.2s forwards;">现在你看到了彩色的它</div>
  </div>
`
document.body.appendChild(phaseTwoOverlay)

let phaseTwoStarted = false

function startPhaseTwoTransition() {
  if (phaseTwoStarted) return
  phaseTwoStarted = true
  gamePhase = 'transition'

  // 隐藏发现提示，避免与过场文字重叠
  discoveryMessageUntil = 0
  discoveryHint.style.display = 'none'

  phaseTwoOverlay.style.display = 'flex'

  const finish = () => {
    phaseTwoOverlay.style.opacity = '0'
    phaseTwoOverlay.style.pointerEvents = 'none'
    setTimeout(() => {
      phaseTwoOverlay.remove()
      startPhaseTwo()
    }, 1700)
  }

  // 点击可跳过；否则约 5 秒后自动进入第二阶段
  phaseTwoOverlay.addEventListener('click', finish, { once: true })
  setTimeout(finish, 5000)
}

// ===================== 游戏完成过场动画 =====================
// 动物图鉴全部发现后：文字过场 → 回到游戏主页（ECHOES 落地页）
const gameEndOverlay = document.createElement('div')
gameEndOverlay.style.cssText = `
  position: fixed; inset: 0; z-index: 3000;
  background: #171a17;
  display: none; align-items: center; justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: opacity 1.6s ease;
`
gameEndOverlay.innerHTML = `
  <div style="position: relative; z-index: 1;">
    <div style="color: #828c80; font-family: ${prologueFont}; font-size: 11px; letter-spacing: .24em; margin-bottom: 24px; opacity: 0; animation: prologueIn 1.8s ease .6s forwards;">万物有回声</div>
    <div style="color: #edf0e8; font-family: ${prologueFont}; font-size: clamp(20px, 3vw, 28px); font-weight: 300; letter-spacing: .12em; opacity: 0; animation: prologueIn 1.8s ease 1.2s forwards;">现在你看到了鲜活的它</div>
  </div>
`
document.body.appendChild(gameEndOverlay)

let gameEndStarted = false

function startGameEndTransition() {
  if (gameEndStarted) return
  gameEndStarted = true
  gamePhase = 'transition'
  if (controls.isLocked) controls.unlock()

  // 隐藏发现提示，避免与过场文字重叠
  discoveryMessageUntil = 0
  discoveryHint.style.display = 'none'

  gameEndOverlay.style.display = 'flex'

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    clearTimeout(finishTimer)
    gameEndOverlay.style.opacity = '0'
    gameEndOverlay.style.pointerEvents = 'none'
    setTimeout(() => {
      // 动物图鉴完成并播放过场后，打开真实生态数据报告。
      location.href = new URL('ecology.html', location.href).href
    }, 1700)
  }

  // 点击可跳过；否则约 5 秒后自动进入报告。
  gameEndOverlay.addEventListener('click', finish, { once: true })
  const finishTimer = setTimeout(finish, 5000)
}

async function startPhaseTwo() {
  gamePhase = 'animals'

  // 名称映射切换为动物版本（提示、卡片、标记共用）
  speciesNames = Object.fromEntries(
    animalSpecies.map(species => [species.id, species.name])
  )

  // 动物随机出现（GLB 模型加载后入场，初始灰色，发现流程与植物一致）
  try {
    animalGroup = await createAnimals(scene, terrain, forest, water)
    treeGroup.add(animalGroup)
  } catch (err) {
    console.error('动物生成失败：', err)
  }

  // 图鉴与进度切换为动物版本
  catalogBook.setCategory('animals')
  renderEcoCatalog()

  // 重置发现提示计时，40 秒无发现会标记动物位置
  lastDiscoveryTime = performance.now()

  showHint(enterHint)
  enterHint.textContent = '新的生命出现了 · 继续探索'

  console.log('第二阶段开始：动物图鉴已启用')
}

const ecoProgress = document.createElement('div')
ecoProgress.style.cssText = `
  position: fixed;
  top: 20px;
  left: 20px;
  padding: 12px 16px;
  background: rgba(20, 25, 20, 0.85);
  color: white;
  font-size: 15px;
  line-height: 1.6;
  border-radius: 8px;
  z-index: 1000;
  pointer-events: none;
`
document.body.appendChild(ecoProgress)

// 二维小地图面板
const minimapPanel = document.createElement('div')

minimapPanel.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  width: 220px;
  height: 220px;
  padding: 12px;
  background: rgba(20, 25, 20, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  z-index: 1000;
  box-sizing: border-box;
`

minimapPanel.innerHTML = `
  <div style="font-size: 15px; margin-bottom: 10px;">
    🗺️ 森林地图
  </div>
  <div id="minimap-content"
       style="width: 100%; height: 170px; background: rgba(100, 130, 80, 0.25); border-radius: 4px;">
  </div>
`

document.body.appendChild(minimapPanel)

// ===================== 小地图：可爱童趣版 =====================
// 用数据直接绘制：森林覆盖率 → 地形基底，水域 fractions → 蓝色水网，
// 树木按物种画彩色散点自然聚成大片；box blur 把细碎边缘合并成大块，
// 整体色调整体提亮饱和，做成水彩绘本风格（不再 1:1 写实渲染）
function renderCuteMinimap(terrain, forest, water) {
  const mapContent = document.getElementById('minimap-content')
  if (!mapContent) return

  const W = 97
  const H = 97
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'

  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const pixels = img.data

  const heights = terrain.heights
  const forestData = forest.fractions
  const waterData = water.fractions

  // —— 1. 地形基底：森林覆盖率决定基础色相，叠加高度分层 + 坡面明暗 ——
  // 先算一遍坡面明暗（左上方向来光），后面直接套用
  const slopeShade = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const left  = heights[y][Math.max(0, x - 1)]
      const right = heights[y][Math.min(W - 1, x + 1)]
      const up    = heights[Math.max(0, y - 1)][x]
      const down  = heights[Math.min(H - 1, y + 1)][x]
      // 左上光线：右坡 + 下坡 背光变暗
      const s = (left - right + up - down) * 0.06
      slopeShade[y * W + x] = Math.max(0.7, Math.min(1.25, 1 + s))
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const f = forestData[y][x] || 0
      const h = heights[y][x]
      const hN = Math.max(0, Math.min(1, h / 12))
      const idx = (y * W + x) * 4

      let r, g, b
      if (f < 0.25) {
        const k = f / 0.25
        r = 180 - k * 30
        g = 170 - k * 15
        b = 110 + k * 30
      } else if (f < 0.55) {
        const k = (f - 0.25) / 0.3
        r = 140 - k * 55
        g = 175 - k * 25
        b = 100 + k * 25
      } else if (f < 0.85) {
        const k = (f - 0.55) / 0.3
        r = 85 - k * 15
        g = 160 + k * 20
        b = 115 - k * 20
      } else {
        const k = (f - 0.85) / 0.15
        r = 70 - k * 25
        g = 175 - k * 30
        b = 105 - k * 25
      }

      // 海拔分层：高处偏亮偏暖（晒过），低处偏暗偏冷（湿润）
      r += hN * 22
      g += (0.5 - hN) * 18
      b -= hN * 6

      // 坡面明暗（box blur 后会自然柔化成大块阴影）
      const sh = slopeShade[y * W + x]
      r *= sh; g *= sh; b *= sh

      pixels[idx] = Math.min(255, Math.max(0, Math.round(r)))
      pixels[idx + 1] = Math.min(255, Math.max(0, Math.round(g)))
      pixels[idx + 2] = Math.min(255, Math.max(0, Math.round(b)))
      pixels[idx + 3] = 255
    }
  }

  // —— 2. 水系：fractions > 0.05 画成清新蓝青色 ——
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((waterData[y][x] || 0) <= 0.05) continue
      const idx = (y * W + x) * 4
      const f = Math.min(1, waterData[y][x] || 0.35)
      // 中央深一点，边缘浅一点（fractions 越低越浅）
      const depth = 0.4 + f * 0.6
      pixels[idx] = Math.round(90 + depth * (-30))   // 60~90
      pixels[idx + 1] = Math.round(190 + depth * (-30))  // 160~190
      pixels[idx + 2] = Math.round(210 + depth * (-20))  // 190~210
    }
  }

  // —— 3. 多次 box blur：把细碎色块合并成大块 ——
  // 5 次迭代足够让分散但集中的色块融成一片大色块，
  // 边缘自然柔化，避免锯齿和噪点
  const blurTimes = 5
  for (let pass = 0; pass < blurTimes; pass++) {
    const src = pixels.slice()
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        let sr = 0, sg = 0, sb = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const si = ((y + dy) * W + (x + dx)) * 4
            sr += src[si]; sg += src[si + 1]; sb += src[si + 2]
          }
        }
        const di = (y * W + x) * 4
        pixels[di] = sr / 9
        pixels[di + 1] = sg / 9
        pixels[di + 2] = sb / 9
      }
    }
  }

  ctx.putImageData(img, 0, 0)

  // —— 4. 树木散点：把 treeGroup 里的树木按物种画彩色半透明圆点 ——
  // 散点自然聚在各自领地，视觉上就是"彩色大色块森林"
  const speciesColors = {
    tree1: [76, 153, 76],     // 婆罗洲榕树：标准绿
    tree2: [51, 161, 145],    // 圆冠雨林树：青绿
    tree3: [44, 96, 56],      // 尖塔龙脑香：深墨绿
    tree4: [163, 179, 74],    // 层叠娑罗树：橄榄黄绿
    tree5: [26, 92, 48],      // 雨林巨树：深翠绿
    fern:  [95, 174, 62],     // 亮草绿
    shrub: [163, 179, 74],    // 浅橄榄
  }

  if (treeGroup) {
    const half = (cols - 1) * MAP_SPACING / 2
    const worldToPx = wx => Math.round(wx / MAP_SPACING + half)

    treeGroup.traverse(obj => {
      if (!obj.userData || !obj.userData.isPlant) return
      const sid = obj.userData.speciesId
      if (!speciesColors[sid]) return

      // 跳过溪流代理、石头等非植物点（它们是 Object3D 而非 Mesh）
      if (!(obj instanceof THREE.Mesh)) return

      const wp = new THREE.Vector3()
      obj.getWorldPosition(wp)

      const px = worldToPx(wp.x)
      const py = worldToPx(wp.z)
      if (px < 0 || px >= W || py < 0 || py >= H) return

      const [r, g, b] = speciesColors[sid]
      ctx.fillStyle = `rgba(${r},${g},${b},0.55)`
      ctx.beginPath()
      ctx.arc(px, py, 1.6, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  ctx.putImageData(img, 0, 0)

  // —— 5. 玩家圆点与朝向箭头 ——
  mapContent.innerHTML = ''
  mapContent.appendChild(canvas)

  const playerDot = document.createElement('div')
  playerDot.id = 'minimap-player-dot'
  playerDot.style.cssText = `
    position: absolute; left: 50%; top: 50%;
    width: 18px; height: 18px;
    background: #ff6b81; border: 2px solid white; border-radius: 50%;
    box-shadow: 0 0 8px rgba(255, 107, 129, 0.8);
    transform: translate(-50%, -50%); z-index: 10;
    display: flex; align-items: center; justify-content: center;
  `

  const playerArrow = document.createElement('div')
  playerArrow.style.cssText = `
    position: absolute; left: 50%; top: -9px;
    width: 0; height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 9px solid white;
    transform: translateX(-50%);
    transform-origin: center 18px;
  `
  playerDot.appendChild(playerArrow)
  mapContent.style.position = 'relative'
  mapContent.appendChild(playerDot)

  window.minimapPlayerDot = playerDot
  window.minimapPlayerArrow = playerArrow

  console.log('小地图重绘完成：可爱童趣版色块地图')
}


// ===================== 40 秒未发现提示标记 =====================
// 玩家超过 40 秒未发现新物种时，在小地图上随机标记
// 一个未发现物种的位置，帮助玩家找到下一个目标
let lastDiscoveryTime = performance.now()
let hintMarker = null
let hintSpeciesId = null

const _hintStyle = document.createElement('style')
_hintStyle.textContent = `
  @keyframes hint-pulse {
    0% { box-shadow: 0 0 0 0 rgba(255, 217, 61, 0.8); }
    70% { box-shadow: 0 0 0 10px rgba(255, 217, 61, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 217, 61, 0); }
  }
  #minimap-hint-marker {
    position: absolute;
    width: 18px;
    height: 18px;
    background: #ffd93d;
    border: 2px solid white;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 9;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
    animation: hint-pulse 1.5s infinite;
    pointer-events: none;
  }
`
document.head.appendChild(_hintStyle)

function removeHintMarker() {
  if (hintMarker) {
    hintMarker.remove()
    hintMarker = null
    hintSpeciesId = null
  }
}

// 在小地图上随机标记一个未发现物种的位置
function spawnHintMarker() {
  const candidates = []

  if (treeGroup && cols && rows) {
    const worldPos = new THREE.Vector3()
    const halfWidth = (cols - 1) * MAP_SPACING * 0.5
    const halfDepth = (rows - 1) * MAP_SPACING * 0.5

    treeGroup.traverse((object) => {
      if (!object.userData || !object.userData.isPlant) return
      if (discoveredSpecies.has(object.userData.speciesId)) return

      object.getWorldPosition(worldPos)

      candidates.push({
        speciesId: object.userData.speciesId,
        mapX: (worldPos.x + halfWidth) / ((cols - 1) * MAP_SPACING),
        mapY: (worldPos.z + halfDepth) / ((rows - 1) * MAP_SPACING)
      })
    })
  }

  if (!candidates.length) return

  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  const mapContent = document.getElementById('minimap-content')
  if (!mapContent) return

  removeHintMarker()

  hintSpeciesId = pick.speciesId
  const species = currentSpeciesList()
    .find(s => s.id === pick.speciesId)

  hintMarker = document.createElement('div')
  hintMarker.id = 'minimap-hint-marker'
  hintMarker.textContent = species ? species.icon : '❓'
  hintMarker.style.left = `${pick.mapX * 100}%`
  hintMarker.style.top = `${pick.mapY * 100}%`

  mapContent.appendChild(hintMarker)

  const speciesName = species ? species.name : '未知物种'
  console.log(`⏳ 40 秒未发现新物种，已在小地图标记：${speciesName}`)
}



let terrainMesh
let fluffyGrass
let terrain
let cols
let rows
let heights
let forest
let water
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// 地形高度检测专用射线
const groundRaycaster = new THREE.Raycaster()
const groundDirection = new THREE.Vector3(0, -1, 0)
const groundOrigin = new THREE.Vector3()

// 灯光
const ambientLight = new THREE.AmbientLight(0xffffff, 1.8)
scene.add(ambientLight)

const sunlight = new THREE.DirectionalLight(0xffffff, 2.2)
sunlight.position.set(-15, 30, 20)
scene.add(sunlight)

// ===================== 梦幻环境：天空穹顶 + 昼夜 + 天气 =====================
// 天空穹顶：大球体内表面顶点色渐变（顶部天色 → 地平线暖色），
// 配合雾营造"与世隔绝"的柔和梦幻感
const SKY_RADIUS = 500
const skyGeometry = new THREE.SphereGeometry(SKY_RADIUS, 24, 16)

// 每个顶点按归一化高度预计算渐变权重（1 = 顶部，0 = 地平线以下）
const skyPositions = skyGeometry.attributes.position
const skyCount = skyPositions.count
const skyWeights = new Float32Array(skyCount)
for (let i = 0; i < skyCount; i++) {
  const y = skyPositions.getY(i) / SKY_RADIUS
  skyWeights[i] = Math.max(0, Math.min(1, y))
}
const skyColors = new Float32Array(skyCount * 3)
skyGeometry.setAttribute(
  'color',
  new THREE.BufferAttribute(skyColors, 3)
)

const skyMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  side: THREE.BackSide,
  fog: false,
  depthWrite: false
})
const skyDome = new THREE.Mesh(skyGeometry, skyMaterial)
applyPainterlyMaterial(skyMaterial, 'sky')
scene.add(skyDome)
const starField = createStarField(SKY_RADIUS * 0.9)
scene.add(starField)
const overviewMapBounds = new THREE.Sphere()
let overviewMapBoundsReady = false

// 雾：远处渐隐进地平线色，营造与世隔绝感
scene.fog = new THREE.Fog(0xffe5e0, 60, 240)

// —— 天气定义：白天基准的光照、天空配色与雾距 ——
// 热带雨林气候：晴 / 阴 / 雨 / 雷阵雨 / 晨雾
const WEATHER_TYPES = {
  sunny: {
    label: '晴天', icon: '☀️',
    sun: 2.2, ambient: 1.8,
    top: 0x9ad0ec, horizon: 0xffe5e0,
    fogNear: 60, fogFar: 240
  },
  cloudy: {
    label: '阴天', icon: '☁️',
    sun: 0.8, ambient: 1.4,
    top: 0xbcc8d8, horizon: 0xece4e4,
    fogNear: 50, fogFar: 200
  },
  rain: {
    label: '下雨', icon: '🌧️',
    sun: 0.5, ambient: 1.1,
    top: 0x8a98b0, horizon: 0xc4ccd8,
    fogNear: 35, fogFar: 150
  },
  storm: {
    label: '雷阵雨', icon: '⛈️',
    sun: 0.35, ambient: 0.9,
    top: 0x5a6478, horizon: 0x9aa4b4,
    fogNear: 28, fogFar: 120
  },
  misty: {
    label: '晨雾', icon: '🌫️',
    sun: 1.1, ambient: 1.5,
    top: 0xcfe0e8, horizon: 0xf0ece6,
    fogNear: 12, fogFar: 90
  }
}

// 夜晚基准（梦幻深蓝紫夜空）
const NIGHT = {
  sun: 0.15, ambient: 0.5,
  top: 0x101b36, horizon: 0x39435c
}

// —— 昼夜循环：白天与黑夜每 2 分钟轮换（完整周期 4 分钟），起始时段随机 ——
const DAY_CYCLE_SECONDS = 240
let elapsedSeconds = Math.random() * DAY_CYCLE_SECONDS

// —— 天气轮换：每 1 分钟切换一次（不与当前重复），初始天气随机 ——
const WEATHER_SWITCH_SECONDS = 60
const weatherKeys = Object.keys(WEATHER_TYPES)
let currentWeather =
  weatherKeys[Math.floor(Math.random() * weatherKeys.length)]
let weatherTimer = 0
let weatherDuration = WEATHER_SWITCH_SECONDS

function pickNextWeather() {
  const keys = Object.keys(WEATHER_TYPES)
    .filter(k => k !== currentWeather)
  const next = keys[Math.floor(Math.random() * keys.length)]
  currentWeather = next
  weatherTimer = 0
  console.log(`天气转变：${WEATHER_TYPES[next].label}`)
}

// —— 环境插值状态：每帧向目标平滑过渡 ——
const envState = {
  sun: 2.2,
  ambient: 1.8,
  top: new THREE.Color(0x9ad0ec),
  horizon: new THREE.Color(0xffe5e0),
  fogNear: 60,
  fogFar: 240,
  starClarity: 0
}

// —— 雨 / 雷雨粒子：围绕玩家的循环粒子系统 ——
function createPrecipitation(count, size, color, opacity, fallSpeed) {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 90
    positions[i * 3 + 1] = Math.random() * 40
    positions[i * 3 + 2] = (Math.random() - 0.5) * 90
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position', new THREE.BufferAttribute(positions, 3)
  )
  const material = new THREE.PointsMaterial({
    color, size, transparent: true, opacity: 0,
    depthWrite: false, sizeAttenuation: true
  })
  const points = new THREE.Points(geometry, material)
  points.visible = false
  points.userData.precipitation = {
    fallSpeed, baseOpacity: opacity, count
  }
  scene.add(points)
  return points
}

const rainParticles = createPrecipitation(
  4000, 0.14, 0xaac8e8, 0.55, 22
)
const stormParticles = createPrecipitation(
  6000, 0.16, 0x9ab4d8, 0.65, 30
)

const PRECIP_MAP = { rain: rainParticles, storm: stormParticles }

// —— 天气 / 时段 HUD ——
const envHud = document.createElement('div')
envHud.style.cssText = `
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  background: rgba(20, 25, 20, 0.72); color: #fff;
  padding: 7px 16px; border-radius: 20px;
  font-size: 13px; letter-spacing: .06em;
  border: 1px solid rgba(255, 255, 255, 0.18);
  z-index: 900; pointer-events: none;
  font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
`
document.body.appendChild(envHud)
let envHudTimer = 0

const _tmpTop = new THREE.Color()
const _tmpHorizon = new THREE.Color()
const _nightTop = new THREE.Color(NIGHT.top)
const _nightHorizon = new THREE.Color(NIGHT.horizon)

// 每帧更新：昼夜因子 + 天气目标 → 平滑过渡光照、天空、雾、粒子
function updateEnvironment(delta) {
  elapsedSeconds += delta

  // 昼夜因子：1 = 正午，0 = 午夜，余弦平滑
  const cycle = (elapsedSeconds % DAY_CYCLE_SECONDS) /
    DAY_CYCLE_SECONDS
  const dayFactor = 0.5 + 0.5 * Math.cos(cycle * Math.PI * 2)

  // 天气轮换计时
  weatherTimer += delta
  if (weatherTimer >= weatherDuration) {
    pickNextWeather()
  }

  // 目标参数 = 夜晚参数 与 天气白天参数 按 dayFactor 插值
  const w = WEATHER_TYPES[currentWeather]
  updatePainterlyEnvironment(delta, dayFactor, currentWeather)
  _tmpTop.set(w.top).lerp(_nightTop, 1 - dayFactor)
  _tmpHorizon.set(w.horizon).lerp(_nightHorizon, 1 - dayFactor)
  const targetSun = THREE.MathUtils.lerp(NIGHT.sun, w.sun, dayFactor)
  const targetAmbient =
    THREE.MathUtils.lerp(NIGHT.ambient, w.ambient, dayFactor)

  // 平滑过渡（约 2～3 秒到位）
  const k = Math.min(1, delta * 0.8)
  envState.sun += (targetSun - envState.sun) * k
  envState.ambient += (targetAmbient - envState.ambient) * k
  envState.top.lerp(_tmpTop, k)
  envState.horizon.lerp(_tmpHorizon, k)
  envState.fogNear += (w.fogNear - envState.fogNear) * k
  envState.fogFar += (w.fogFar - envState.fogFar) * k

  // Use actual camera altitude so weather also returns smoothly during descent.
  const overview = overviewVisibility(
    camera.position.y,
    discoveryAnimation.startPosition?.y ?? 0,
    discoveryAnimation.overviewPosition?.y ?? 0,
    discoveryAnimating
  )
  if (terrainMesh && !overviewMapBoundsReady) {
    new THREE.Box3().setFromObject(terrainMesh).getBoundingSphere(overviewMapBounds)
    overviewMapBounds.radius += 30 // Include treetops above the terrain.
    overviewMapBoundsReady = true
  }
  const mapDistance = overviewMapBoundsReady
    ? camera.position.distanceTo(overviewMapBounds.center) + overviewMapBounds.radius
    : 240
  const fog = overviewFog(envState.fogNear, envState.fogFar, mapDistance, overview)

  sunlight.intensity = THREE.MathUtils.lerp(envState.sun, Math.max(envState.sun, 0.65), overview)
  ambientLight.intensity = THREE.MathUtils.lerp(envState.ambient, Math.max(envState.ambient, 1.15), overview)

  // Clear nights reveal stars; daylight, clouds, precipitation and mist obscure them.
  const clarity = currentWeather === 'sunny' ? 1 : currentWeather === 'cloudy' ? 0.03 : 0
  envState.starClarity += (clarity - envState.starClarity) * k
  starField.material.uniforms.visibility.value = starVisibility(dayFactor, envState.starClarity)
  starField.material.uniforms.time.value = elapsedSeconds
  starField.material.uniforms.pixelRatio.value = renderer.getPixelRatio()
  starField.visible = starField.material.uniforms.visibility.value > 0.001
  skyDome.position.copy(camera.position)
  starField.position.copy(camera.position)
  starField.rotation.y = elapsedSeconds * 0.001

  // 写入天空穹顶顶点色 + 雾色 + 场景背景
  for (let i = 0; i < skyCount; i++) {
    const t = skyWeights[i]
    const idx = i * 3
    skyColors[idx] =
      envState.horizon.r + (envState.top.r - envState.horizon.r) * t
    skyColors[idx + 1] =
      envState.horizon.g + (envState.top.g - envState.horizon.g) * t
    skyColors[idx + 2] =
      envState.horizon.b + (envState.top.b - envState.horizon.b) * t
  }
  skyGeometry.attributes.color.needsUpdate = true
  scene.fog.color.copy(envState.horizon)
  scene.fog.near = fog.near
  scene.fog.far = fog.far
  scene.background.copy(envState.horizon)

  // 粒子：当前天气对应的粒子淡入，其他淡出；跟随玩家
  for (const [key, points] of Object.entries(PRECIP_MAP)) {
    const info = points.userData.precipitation
    const targetOpacity =
      key === currentWeather ? info.baseOpacity : 0

    const mat = points.material
    // Keep weather opacity separate from altitude to avoid a lagging rain curtain.
    info.weatherOpacity ??= 0
    info.weatherOpacity += (targetOpacity - info.weatherOpacity) * k
    mat.opacity = info.weatherOpacity * (1 - overview * 0.92)
    points.visible = mat.opacity > 0.02

    if (!points.visible) continue

    // 粒子区域中心跟随玩家（俯瞰镜头同样有效）
    points.position.set(
      camera.position.x, 0, camera.position.z
    )

    const pos = points.geometry.attributes.position
    const arr = pos.array
    const count = pos.count
    for (let i = 0; i < count; i++) {
      const iy = i * 3 + 1
      arr[iy] -= info.fallSpeed * delta

      // 落到底部后回到顶部循环
      if (arr[iy] < -2) {
        arr[iy] += 42
      }
    }
    pos.needsUpdate = true
  }

  // HUD 每 0.5 秒刷新一次文字
  envHudTimer += delta
  if (envHudTimer > 0.5) {
    envHudTimer = 0
    const phase = dayFactor > 0.5 ? '☀️ 白天' : '🌙 夜晚'
    envHud.textContent = `${w.icon} ${w.label} · ${phase}`
  }
}

// 第一人称控制器
const controls = new PointerLockControls(camera, renderer.domElement)

// 键盘移动状态
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false
}

const moveSpeed = 8

// 点击画面锁定鼠标，开始第一人称控制

 // 点击画面锁定鼠标，开始第一人称控制
renderer.domElement.addEventListener('click', () => {
  if (!controls.isLocked) {
    controls.lock()
  }

  // 发现动画结束后，恢复附近植物的提示
  if (!discoveryAnimating && nearbyPlant) {
    const speciesId = nearbyPlant.userData.speciesId

    const speciesName = speciesNames[speciesId]

    if (!speciesName) {
      // 第二阶段靠近第一阶段已发现的生态：不再显示提示
      discoveryHint.style.display = 'none'
    } else if (discoveredSpecies.has(speciesId)) {
      discoveryHint.textContent = `${speciesName}（已发现）`
      discoveryHint.style.display = 'block'
    } else {
      discoveryHint.textContent = `按 E 发现：${speciesName}`
      discoveryHint.style.display = 'block'
    }
  }
})

// 首次锁定鼠标进入森林：显示新手指引，稍后地面渐变为雨林土地色
let tutorialShown = false
controls.addEventListener('lock', () => {
  hideHint(enterHint)

  if (!tutorialShown) {
    tutorialShown = true
    showHint(eHint)
    // 指引出现后，地面从灰色渐变为热带雨林土地颜色
    setTimeout(() => { soilTransition.active = true }, 2000)
    // 超时兜底淡出（首次发现物种时也会立即淡出）
    setTimeout(() => hideHint(eHint), 12000)
  }
})


// 发现完成：记录图鉴、显示提示、重置计时（植物/动物共用）
function completeDiscovery(speciesId, suffix) {
  if (!speciesCardOpen) interactionTarget = null
  const speciesName = speciesNames[speciesId] || '未知物种'

  animatePlantColor(treeGroup, speciesId, 1)
  discoveredSpecies.add(speciesId)
  renderEcoCatalog()

  discoveryHint.textContent = `🌱 您已发现：${speciesName}${suffix}`
  discoveryHint.style.display = 'block'

  // 保留发现成功提示 4 秒
  discoveryMessageUntil = performance.now() + 4000

  // 重置 40 秒未发现计时；若提示标记的物种已被发现则移除标记
  lastDiscoveryTime = performance.now()
  if (hintSpeciesId && discoveredSpecies.has(hintSpeciesId)) {
    removeHintMarker()
  }

  console.log(`您已发现：${speciesName}`)

  // 当前阶段图鉴全部发现 → 触发对应过场
  const allDiscovered = currentSpeciesList().every(s =>
    discoveredSpecies.has(s.id)
  )
  if (gamePhase === 'plants' && allDiscovered) {
    setTimeout(startPhaseTwoTransition, 2000)
  }
  if (gamePhase === 'animals' && allDiscovered) {
    setTimeout(startGameEndTransition, 2000)
  }
}

// 每发现 4 种植物触发一次：升空全景 → 变色 → 回到第一人称
function startPlantDiscovery(speciesId) {
  discoveryAnimating = true

  discoveryAnimation.startTime = performance.now()
  discoveryAnimation.phase = 'starting'
  discoveryAnimation.speciesId = speciesId

  // 保存当前第一人称镜头的位置和朝向
  discoveryAnimation.startPosition = camera.position.clone()
  discoveryAnimation.startQuaternion = camera.quaternion.clone()

  // 计算俯视镜头的目标位置
  const mapWidth = (cols - 1) * MAP_SPACING
  const mapDepth = (rows - 1) * MAP_SPACING
  const overviewHeight = Math.max(mapWidth, mapDepth) * 0.8

  discoveryAnimation.overviewPosition = new THREE.Vector3(
    mapWidth * 0.3,
    overviewHeight * 0.9,
    mapDepth * 0.3
  )

  // 镜头从斜上方俯瞰地图中心：不再是正上方悬停，
  // 但高度足够看清地图全貌
  const overviewTarget = new THREE.Vector3(0, 0, 0)
  const overviewMatrix = new THREE.Matrix4()
  overviewMatrix.lookAt(
    discoveryAnimation.overviewPosition,
    overviewTarget,
    new THREE.Vector3(0, 1, 0)
  )

  discoveryAnimation.overviewQuaternion =
    new THREE.Quaternion().setFromRotationMatrix(overviewMatrix)


  // 暂时退出鼠标锁定，准备接管镜头
  if (controls.isLocked) {
    controls.unlock()
  }

  discoveryHint.textContent = '正在发现新物种……'
  discoveryHint.style.display = 'block'

  // 首次发现后淡出新手指引
  if (eHint.style.display === 'block') {
    hideHint(eHint)
  }

  // 弹出该物种的科普卡片（发现流程同时进行升空动画）
  showSpeciesCard(speciesId)

  console.log('开始发现动画：', speciesId)
}

document.addEventListener('keydown', (event) => {
  // 科普卡片打开时，E / Esc 优先关闭卡片
  if (speciesCardOpen) {
    if (event.code === 'KeyE' || event.code === 'Escape') {
      event.preventDefault()
      hideSpeciesCard()
    }
    return
  }

  if (catalogBook.isOpen) {
    if (event.code === 'Escape') catalogBook.close()
    return
  }

  switch (event.code) {
    case 'KeyW':
      moveState.forward = true
      break
    case 'KeyS':
      moveState.backward = true
      break
    case 'KeyA':
      moveState.left = true
      break
    case 'KeyD':
      moveState.right = true
      break
    
    case 'KeyE':
      if (
        nearbyPlant &&
        !discoveryAnimating &&
        !stationaryDiscovery
      ) {
        const speciesId = nearbyPlant.userData.speciesId

        if (!discoveredSpecies.has(speciesId)) {
          interactionTarget = nearbyPlant
          const speciesName = speciesNames[speciesId] || ''

          const plantDiscoveryCount = ecoSpecies.filter(species =>
            discoveredSpecies.has(species.id)
          ).length
          const showPlantOverview = gamePhase === 'plants' &&
            (plantDiscoveryCount + 1) % 4 === 0

          if (!showPlantOverview) {
            // 非第 4 的倍数次植物发现，以及动物发现：原地变色并弹出卡片
            stationaryDiscovery = {
              speciesId,
              startTime: performance.now()
            }

            discoveryHint.textContent = `正在发现：${speciesName}……`
            discoveryHint.style.display = 'block'

            if (eHint.style.display === 'block') {
              hideHint(eHint)
            }

            // 保持鼠标锁定，按 E 关闭卡片即可继续探索
            showSpeciesCard(speciesId, true)
          } else {
            startPlantDiscovery(speciesId)
          }
        }
      }
      break

  }
})

// 松开键盘
document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW':
      moveState.forward = false
      break
    case 'KeyS':
      moveState.backward = false
      break
    case 'KeyA':
      moveState.left = false
      break
    case 'KeyD':
      moveState.right = false
      break
  }
})

async function createTerrain() {
  // 同时加载地形和水体数据
  const [terrainResponse, waterResponse, forestResponse] =
    await Promise.all([
      fetch('/terrain.json'),
      fetch('/water.json'),
      fetch('/forest.json')
    ])

  if (!terrainResponse.ok) {
    throw new Error('无法加载 terrain.json')
  }

  if (!waterResponse.ok) {
    throw new Error('无法加载 water.json')
  }

  if (!forestResponse.ok) {
    throw new Error('无法加载 forest.json')
  }

  water = await waterResponse.json()
  forest = await forestResponse.json()
  terrain = await terrainResponse.json()

  cols = terrain.width
  rows = terrain.height
  const spacing = MAP_SPACING
  terrain.spacing = MAP_SPACING
  heights = terrain.heights

  // 拓宽并连通水系：
  // 1) 提取水域格子（fractions > 0.05），按 4 邻域找连通簇
  // 2) 从最大簇出发，其余簇用 L 形水路连接到最近的已连通簇，
  //    让整片水系连贯成一条水网
  // 3) 向外扩张两圈（8 邻域取最大 × 0.75 衰减），溪流更宽
  const srcF = water.fractions
  const isWater = []
  for (let z = 0; z < rows; z++) {
    isWater.push(new Array(cols).fill(false))
  }
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      if (srcF[z][x] > 0.05) isWater[z][x] = true
    }
  }

  // BFS 找连通簇
  const clusterId = []
  for (let z = 0; z < rows; z++) {
    clusterId.push(new Array(cols).fill(-1))
  }
  const clusters = []
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      if (!isWater[z][x] || clusterId[z][x] >= 0) continue

      const id = clusters.length
      const cells = []
      const queue = [[x, z]]
      clusterId[z][x] = id

      while (queue.length) {
        const [cx, cz] = queue.shift()
        cells.push([cx, cz])
        const neighbors = [
          [cx + 1, cz], [cx - 1, cz],
          [cx, cz + 1], [cx, cz - 1]
        ]
        for (const [nx, nz] of neighbors) {
          if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue
          if (!isWater[nz][nx] || clusterId[nz][nx] >= 0) continue
          clusterId[nz][nx] = id
          queue.push([nx, nz])
        }
      }

      clusters.push(cells)
    }
  }

  // 连通所有簇：按规模降序，每个未连通簇的质心用 L 形水路
  // （随机先走 x 或先走 z）连到最近的已连通簇质心
  let seedW = 20260
  const randW = () => {
    seedW = (seedW * 1664525 + 1013904223) >>> 0
    return seedW / 4294967296
  }

  const cellCentroid = cells => {
    let sx = 0
    let sz = 0
    for (const [x, z] of cells) {
      sx += x
      sz += z
    }
    return [sx / cells.length, sz / cells.length]
  }

  const carveCell = (x, z) => {
    if (x >= 0 && x < cols && z >= 0 && z < rows) isWater[z][x] = true
  }

  if (clusters.length > 1) {
    clusters.sort((a, b) => b.length - a.length)
    const connected = [cellCentroid(clusters[0])]

    for (let i = 1; i < clusters.length; i++) {
      const [ax, az] = cellCentroid(clusters[i])

      // 找最近的已连通质心
      let bx = connected[0][0]
      let bz = connected[0][1]
      let bestD = Infinity
      for (const [px, pz] of connected) {
        const d = (px - ax) ** 2 + (pz - az) ** 2
        if (d < bestD) {
          bestD = d
          bx = px
          bz = pz
        }
      }

      // 沿 L 形水路逐格雕刻
      let cx = Math.round(ax)
      let cz = Math.round(az)
      const tx = Math.round(bx)
      const tz = Math.round(bz)
      const xFirst = randW() > 0.5

      if (xFirst) {
        while (cx !== tx) {
          cx += Math.sign(tx - cx)
          carveCell(cx, cz)
        }
        while (cz !== tz) {
          cz += Math.sign(tz - cz)
          carveCell(cx, cz)
        }
      } else {
        while (cz !== tz) {
          cz += Math.sign(tz - cz)
          carveCell(cx, cz)
        }
        while (cx !== tx) {
          cx += Math.sign(tx - cx)
          carveCell(cx, cz)
        }
      }

      connected.push([ax, az])
    }
  }

  // 写回水系网格：原始水域保留原值，连通水路给固定比例
  const wGrid = []
  for (let z = 0; z < rows; z++) {
    const row = new Array(cols).fill(0)
    for (let x = 0; x < cols; x++) {
      if (srcF[z][x] > 0.05) row[x] = srcF[z][x]
      else if (isWater[z][x]) row[x] = 0.35
    }
    wGrid.push(row)
  }

  // 向外扩张一圈，河床深度与水面从中心到岸边平滑过渡
  for (let ring = 0; ring < 1; ring++) {
    const prev = wGrid.map(row => row.slice())
    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        if (prev[z][x] > 0) continue

        let maxNeighbor = 0
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nz = z + dz
            const nx = x + dx
            if (nz < 0 || nz >= rows || nx < 0 || nx >= cols) continue
            if (prev[nz][nx] > maxNeighbor) {
              maxNeighbor = prev[nz][nx]
            }
          }
        }

        if (maxNeighbor > 0.05) {
          wGrid[z][x] = Math.max(0.1, maxNeighbor * 0.75)
        }
      }
    }
  }

  water.fractions = wGrid

  // 河床下沉：水域格子的地面按水体比例下凹，形成溪流河床
  // heights 是树木、生物、玩家贴地共用的数据源，整体自洽：
  // 水面网格贴合下沉后的地面，树自动站在河岸边
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const f = water.fractions[z][x]
      if (f > 0.05) {
        heights[z][x] -= f * 0.4
      }
    }
  }

  // 创建地形网格
  const geometry = new THREE.PlaneGeometry(
    (cols - 1) * spacing,
    (rows - 1) * spacing,
    cols - 1,
    rows - 1
  )

  geometry.rotateX(-Math.PI / 2)

  const positions = geometry.attributes.position

  // 写入真实高程
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const index = z * cols + x
      positions.setY(index, heights[z][x])
    }
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()

  // 顶点色系统：
  // 初始全部为中性灰（视觉与原灰色地形完全一致），
  // 新手指引后逐顶点过渡为草坪绿——
  // 颜色随高度（低处湿润浓绿 / 高处干爽偏黄）、临水程度
  // 和低频噪声斑块变化，顶点插值让色块衔接自然
  const vertexCount = positions.count

  const colorArray = new Float32Array(vertexCount * 3)
  colorArray.fill(SOIL_GRAY)

  // 计算草坪绿目标色
  let minH = Infinity
  let maxH = -Infinity
  for (let i = 0; i < vertexCount; i++) {
    const h = positions.getY(i)
    if (h < minH) minH = h
    if (h > maxH) maxH = h
  }

  const grassTargets = new Float32Array(vertexCount * 3)
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const index = z * cols + x
      const h = heights[z][x]
      const dryness = (h - minH) / (maxH - minH || 1)

      // 临水程度：5×5 邻域最大水体比例
      let moisture = 0
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nz = Math.min(rows - 1, Math.max(0, z + dz))
          const nx = Math.min(cols - 1, Math.max(0, x + dx))
          if (water.fractions[nz][nx] > moisture) {
            moisture = water.fractions[nz][nx]
          }
        }
      }

      // 低频噪声斑块（大块自然色差）
      const n =
        Math.sin(x * 0.32 + z * 0.21) * 0.5 +
        Math.sin(x * 0.11 - z * 0.27 + 1.7) * 0.5

      // 基础草坪绿：高处偏干黄绿，低处偏浓绿
      let r = 0.38 + dryness * 0.12 + n * 0.035
      let g = 0.54 + dryness * 0.09 + n * 0.04
      let b = 0.30 + dryness * 0.01 + n * 0.025

      // 临水处更浓绿湿润
      r -= moisture * 0.04
      g += moisture * 0.045
      b += moisture * 0.02

      // 微小确定性抖动，避免完全均匀
      const jitter = ((x * 7 + z * 13) % 10) / 10 - 0.5
      r += jitter * 0.02
      g += jitter * 0.025
      b += jitter * 0.015

      grassTargets[index * 3] = Math.min(1, Math.max(0, r))
      grassTargets[index * 3 + 1] = Math.min(1, Math.max(0, g))
      grassTargets[index * 3 + 2] = Math.min(1, Math.max(0, b))
    }
  }
  terrainGrassTargets = grassTargets

  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(colorArray, 3)
  )

  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: false,
    side: THREE.DoubleSide
  })
  applyPainterlyMaterial(terrainMaterial, 'ground')

  terrainMesh = new THREE.Mesh(geometry, terrainMaterial)
  scene.add(terrainMesh)
  fluffyGrass = createFluffyGrass(terrain, water, terrainGrassTargets, SOIL_GRAY)
  scene.add(fluffyGrass.group)

  // 水面统一由 createStreams 按水系簇生成（贴合河床的溪流水面）

  // 地形底座
  const baseGeometry = new THREE.BoxGeometry(
    (cols - 1) * spacing,
    1,
    (rows - 1) * spacing
  )

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x777777,
    flatShading: true
  })

  const base = new THREE.Mesh(baseGeometry, baseMaterial)
  base.position.y = -0.5
  scene.add(base)

  camera.position.set(0, 0.5, 10)

  // 先加载全部植物模板（GLB/FBX），再生成各植物群组
  await initPlantTemplates()

  treeGroup = createTrees(scene, terrain, forest, water)

  const fernGroup = createFerns(scene, terrain, forest, water, treeGroup)

  // 将蕨类加入植物群组，供发现系统统一检测
  treeGroup.add(fernGroup)

  const shrubGroup = createShrubs(
  scene,
  terrain,
  forest,
  water
  )

  treeGroup.add(shrubGroup)

  // 地表细节：苔藓岩石、倒木、蘑菇、落叶、林间溪流
  // 均纳入发现系统，遵循与现有植物一致的黑白灰→变色流程
  treeGroup.add(createStones(scene, terrain, forest, water))
  treeGroup.add(createFallenLogs(scene, terrain, forest, water, treeGroup))
  treeGroup.add(createMushrooms(scene, terrain, forest, water, treeGroup))
  treeGroup.add(createFallenLeaves(scene, terrain, forest, water))
  treeGroup.add(createStreams(scene, terrain, forest, water))

  console.log('真实地形加载完成')
}

createTerrain()
  .then(() => {
    renderCuteMinimap(terrain, forest, water)
  })
  .catch(console.error)

// 第一人称移动
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)

  const delta = Math.min(clock.getDelta(), 0.05)

  // 第二阶段动物运动（走动/跳跃/低空飞行/蚁队行进）
  if (animalGroup) {
    updateAnimalIdle(animalGroup, elapsedSeconds, delta, terrain)
  }

  // 地面颜色渐变：新手指引后逐顶点从灰色过渡为草坪绿
  if (soilTransition.active && terrainMesh && terrainGrassTargets) {
    soilTransition.factor = Math.min(1, soilTransition.factor + delta * 0.28)
    const f = soilTransition.factor
    const eased = f * f * (3 - 2 * f) // smoothstep，起止更柔和

    const colorAttr = terrainMesh.geometry.attributes.color
    const arr = colorAttr.array
    for (let i = 0; i < arr.length; i++) {
      arr[i] = SOIL_GRAY + (terrainGrassTargets[i] - SOIL_GRAY) * eased
    }
    colorAttr.needsUpdate = true

    if (f >= 1) {
      soilTransition.active = false
    }
  }

 
  if (controls.isLocked) {
    // 记录移动前的位置
    const oldX = camera.position.x
    const oldZ = camera.position.z

    if (moveState.forward) {
      controls.moveForward(moveSpeed * delta)
    }

    if (moveState.backward) {
      controls.moveForward(-moveSpeed * delta)
    }

    if (moveState.left) {
      controls.moveRight(-moveSpeed * delta)
    }

    if (moveState.right) {
      controls.moveRight(moveSpeed * delta)
    }

    // 地图边界：根据地形网格尺寸计算
    if (terrainMesh) {
      const halfWidth = (cols - 1) * MAP_SPACING * 0.5
      const halfDepth = (rows - 1) * MAP_SPACING * 0.5
      const margin = 1.5

      const minX = -halfWidth + margin
      const maxX = halfWidth - margin
      const minZ = -halfDepth + margin
      const maxZ = halfDepth - margin

      camera.position.x = THREE.MathUtils.clamp(
        camera.position.x,
        minX,
        maxX
      )

      camera.position.z = THREE.MathUtils.clamp(
        camera.position.z,
        minZ,
        maxZ
      )
    }
  }


  
  // 根据相机当前位置，检测正下方的地形
  // 仅当地形已加载时，检测脚下高度
  if (terrainMesh) {
    groundOrigin.set(
      camera.position.x,
      camera.position.y + 100,
      camera.position.z
    )

    groundRaycaster.set(groundOrigin, groundDirection)

    const groundHits = groundRaycaster.intersectObject(terrainMesh, false)

    if (groundHits.length > 0) {
      camera.position.y = groundHits[0].point.y + 1.7
    }
  }
  
  // 寻找玩家附近最近的一棵植物
  // 优先未发现物种，避免新增的密集地表细节挡住其他物种的发现
  nearbyPlant = null
  let nearestUndiscoveredDist = 3
  let nearestDiscoveredDist = 3
  let nearestDiscovered = null

  if (treeGroup && controls.isLocked) {

    treeGroup.traverse((plant) => {
      if (!plant.userData.isPlant) return
      if (!speciesNames[plant.userData.speciesId]) return

      // 获取植物的世界坐标，兼容嵌套的蕨类和灌木
      const plantWorldPosition = new THREE.Vector3()
      plant.getWorldPosition(plantWorldPosition)

      const dx = plantWorldPosition.x - camera.position.x
      const dz = plantWorldPosition.z - camera.position.z
      const distance = Math.sqrt(dx * dx + dz * dz)

      const alreadyDiscovered = discoveredSpecies.has(
        plant.userData.speciesId
      )

      if (alreadyDiscovered) {
        if (distance < nearestDiscoveredDist) {
          nearestDiscoveredDist = distance
          nearestDiscovered = plant
        }
      } else if (distance < nearestUndiscoveredDist) {
        nearestUndiscoveredDist = distance
        nearbyPlant = plant
      }
    })

    // 附近没有未发现物种时，回退到最近已发现物种用于显示状态
    if (!nearbyPlant && nearestDiscovered) {
      nearbyPlant = nearestDiscovered
    }

  }



  // 显示交互提示
  if (discoveryAnimating) {
    discoveryHint.style.display = 'block'
  } else if (performance.now() < discoveryMessageUntil) {
    // 发现成功提示优先显示，不被普通提示覆盖
    discoveryHint.style.display = 'block'
  } else if (nearbyPlant && controls.isLocked) {
    const speciesId = nearbyPlant.userData.speciesId

    const speciesName = speciesNames[speciesId]

    if (!speciesName) {
      // 第二阶段靠近第一阶段已发现的生态：不再显示提示
      discoveryHint.style.display = 'none'
    } else if (discoveredSpecies.has(speciesId)) {
      discoveryHint.textContent = `${speciesName}（已发现）`
      discoveryHint.style.display = 'block'
    } else {
      discoveryHint.textContent = `按 E 发现：${speciesName}`
      discoveryHint.style.display = 'block'
    }
  } else {
    discoveryHint.style.display = 'none'
  }

  // 原地发现：生物平滑变色，镜头保持不动
  if (stationaryDiscovery) {
    const elapsed =
      performance.now() - stationaryDiscovery.startTime
    const progress = Math.min(elapsed / 1500, 1)
    const t = progress * progress * (3 - 2 * progress)

    animatePlantColor(
      treeGroup,
      stationaryDiscovery.speciesId,
      t
    )

    if (progress >= 1) {
      const speciesId = stationaryDiscovery.speciesId
      stationaryDiscovery = null
      completeDiscovery(speciesId, '！')
    }
  }

  // 发现新物种：升空 → 植物变色 → 回到第一人称
  if (
    discoveryAnimating &&
    discoveryAnimation.startPosition &&
    discoveryAnimation.overviewPosition
  ) {
    const elapsed =
      performance.now() - discoveryAnimation.startTime

    const progress = Math.min(elapsed / 6000, 1)

    // 平滑缓动
    const ease = (t) => t * t * (3 - 2 * t)

    const startPosition = discoveryAnimation.startPosition
    const overviewPosition = discoveryAnimation.overviewPosition
    const startQuaternion = discoveryAnimation.startQuaternion
    const overviewQuaternion = discoveryAnimation.overviewQuaternion

    if (progress < 0.35) {
      // 阶段一：镜头升空（0～2.1 秒）
      const t = ease(progress / 0.35)

      camera.position.lerpVectors(
        startPosition,
        overviewPosition,
        t
      )

      camera.quaternion.slerpQuaternions(
        startQuaternion,
        overviewQuaternion,
        t
      )

      discoveryAnimation.phase = 'rising'
    } else if (progress < 0.7) {
      // 阶段二：植物逐渐恢复颜色（2.1～4.2 秒）
      camera.position.copy(overviewPosition)
      camera.quaternion.copy(overviewQuaternion)

      const t = ease((progress - 0.35) / 0.35)

      animatePlantColor(
        treeGroup,
        discoveryAnimation.speciesId,
        t
      )

      discoveryAnimation.phase = 'coloring'
    } else {
      // 阶段三：镜头回到原来的第一人称位置（4.2～6 秒）
      const t = ease((progress - 0.7) / 0.3)

      camera.position.lerpVectors(
        overviewPosition,
        startPosition,
        t
      )

      camera.quaternion.slerpQuaternions(
        overviewQuaternion,
        startQuaternion,
        t
      )

      discoveryAnimation.phase = 'returning'
    }

    // 动画结束：记录发现结果
    if (progress >= 1) {
      const speciesId = discoveryAnimation.speciesId

      discoveryAnimating = false
      discoveryAnimation.phase = 'idle'

      completeDiscovery(speciesId, '！点击画面继续探索')
    }
  }

  // 发现进度：按当前阶段（植物/动物）统计
  const currentList = currentSpeciesList()
  const foundCount = currentList.filter(s =>
    discoveredSpecies.has(s.id)
  ).length
  const progressLabel = gamePhase === 'animals'
    ? '动物发现进度' : '生态发现进度'
  ecoProgress.textContent =
    `${progressLabel}：${foundCount} / ${currentList.length}`


  // 实时更新小地图上的玩家位置
  const playerDot = window.minimapPlayerDot

  if (playerDot && terrainMesh) {
    const halfWidth = (cols - 1) * MAP_SPACING * 0.5
    const halfDepth = (rows - 1) * MAP_SPACING * 0.5

    const mapX = (camera.position.x + halfWidth) /
      ((cols - 1) * MAP_SPACING)
    const mapY = (camera.position.z + halfDepth) /
      ((rows - 1) * MAP_SPACING)

    playerDot.style.left = `${mapX * 100}%`
    playerDot.style.top = `${mapY * 100}%`
    
    // 根据相机朝向旋转小地图箭头
    if (window.minimapPlayerArrow) {
      const direction = new THREE.Vector3()
      camera.getWorldDirection(direction)

      const angle = Math.atan2(direction.x, -direction.z)
      window.minimapPlayerArrow.style.transform =
        `translateX(-50%) rotate(${angle}rad)`
    }
  }

  // 40 秒未发现新物种时，在小地图随机标记一个未发现物种
  if (performance.now() - lastDiscoveryTime >= 40000) {
    spawnHintMarker()
    lastDiscoveryTime = performance.now()
  }

  const coordinatesElement = document.getElementById('eco-coordinates')

  if (coordinatesElement) {
    coordinatesElement.textContent =
      `X: ${camera.position.x.toFixed(1)} / Z: ${camera.position.z.toFixed(1)}`
  }

  // Update after camera animation so aerial visibility matches this frame's view.
  updateEnvironment(delta)
  fluffyGrass?.update(camera, delta, soilTransition.factor)
  const outlineTarget = catalogBook.isOpen ? null
    : interactionTarget || (controls.isLocked && !speciesCardOpen ? nearbyPlant : null)
  interactionOutline.render(outlineTarget, delta)
}

animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  interactionOutline.resize(window.innerWidth, window.innerHeight)
})

