import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { createDiscoveryMaterial } from './discoveryMaterial.js'
import { getModelBounds } from './modelBounds.js'
import './catalogBook.css'

const animalFiles = { orangutan: 'Baboon', butterfly: 'Butterfly', hornbill: 'Hornbill', flyingfrog: 'Frog', ant: 'Ant', redleafmonkey: 'monkey', snake: 'Snake', spider: 'Spider', scorpion: 'Scorpion', bee: 'Bee' }

export function createCatalogBook({ plants, animals, discovered, getWorld, onOpen, onSpecies }) {
  let category = 'plants'
  let spread = 0
  let generation = 0
  let previewRenderer
  const cache = new Map()
  const templates = new Map()
  const launcher = document.createElement('button')
  launcher.id = 'eco-catalog'
  launcher.className = 'catalog-launcher'
  launcher.innerHTML = '<span>▤</span> 图鉴 <small>雨林手记</small>'
  launcher.setAttribute('aria-haspopup', 'dialog')
  document.body.appendChild(launcher)
  const overlay = document.createElement('div')
  overlay.className = 'catalog-overlay'
  overlay.hidden = true
  overlay.innerHTML = `<section class="catalog-dialog" role="dialog" aria-modal="true" aria-label="雨林生物图鉴">
    <header class="book-toolbar"><div><span class="book-eyebrow">ECHOES OF EARTH</span><h2>雨林手记</h2></div>
      <nav aria-label="图鉴分类"><button data-category="plants">植物图鉴</button><button data-category="animals">动物图鉴</button></nav>
      <button class="book-close" aria-label="关闭图鉴">×</button></header>
    <div class="book-spread"></div>
    <footer class="book-footer"><button class="book-prev">← 上一页</button><span class="book-pagination" aria-live="polite"></span><button class="book-next">下一页 →</button></footer>
    <p class="book-help">点击模型阅读简介 · 浅灰色为尚未发现 · Esc 合上图鉴</p>
  </section>`
  document.body.appendChild(overlay)

  async function thumbnail(species) {
    const isFound = discovered.has(species.id)
    const key = `${species.id}:${isFound}`
    if (cache.has(key)) return cache.get(key)
    let source
    getWorld()?.traverse(object => {
      if (!source && object.userData.isPlant && object.userData.speciesId === species.id) source = object
    })
    if (!source && animalFiles[species.id]) {
      if (!templates.has(species.id)) {
        templates.set(species.id, new GLTFLoader().loadAsync(`/Animals.undefined-glb/${animalFiles[species.id]}.glb`).then(gltf => gltf.scene))
      }
      source = await templates.get(species.id)
    }
    if (!source) return null
    previewRenderer ||= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    previewRenderer.setSize(360, 260)
    previewRenderer.setClearColor(0x000000, 0)
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a3, 2.5))
    const light = new THREE.DirectionalLight(0xffffff, 3)
    light.position.set(3, 5, 4)
    scene.add(light)
    const model = clone(source)
    model.position.set(0, 0, 0)
    model.rotation.set(0, 0, 0)
    const materials = []
    model.traverse(object => {
      if (!object.isMesh) return
      const prepare = original => {
        const mat = createDiscoveryMaterial(original, object.geometry)
        if (object.userData.targetColor) mat.color.copy(object.userData.targetColor)
        mat.userData.discoveryReveal.value = isFound ? 1 : 0
        materials.push(mat)
        return mat
      }
      object.material = Array.isArray(object.material) ? object.material.map(prepare) : prepare(object.material)
    })
    const box = getModelBounds(model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    model.position.sub(center)
    const holder = new THREE.Group()
    holder.add(model)
    holder.scale.setScalar(2.5 / (Math.max(size.x, size.y, size.z) || 1))
    scene.add(holder)
    const camera = new THREE.PerspectiveCamera(35, 360 / 260, 0.01, 100)
    camera.position.set(3.5, 2.3, 5)
    camera.lookAt(0, 0, 0)
    try {
      previewRenderer.render(scene, camera)
      const url = previewRenderer.domElement.toDataURL('image/png')
      cache.set(key, url)
      return url
    } finally {
      materials.forEach(material => material.dispose())
    }
  }

  function render() {
    if (overlay.hidden) return
    const token = ++generation
    const list = category === 'plants' ? plants : animals
    const totalPages = Math.ceil(list.length / 4)
    overlay.querySelectorAll('[data-category]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.category === category))
    })
    const pages = overlay.querySelector('.book-spread')
    pages.innerHTML = [0, 1].map(side => {
      const page = spread * 2 + side
      const entries = list.slice(page * 4, page * 4 + 4)
      return `<section class="book-page"><div class="page-heading"><span>${category === 'plants' ? '草木与山水' : '雨林众生'}</span><span>自然观察档案</span></div>
        <div class="book-grid">${entries.map(species => `<button class="book-entry" data-species="${species.id}" aria-label="查看${species.name}简介">
          <span class="specimen-preview"><span class="preview-status">模型载入中…</span></span>
          <strong>${species.name}</strong><small>${discovered.has(species.id) ? '已发现' : '尚未发现'}</small>
        </button>`).join('')}${entries.length ? '' : '<p class="book-end">每一次看见，都是新的相遇。<br>继续走进雨林，留下你的发现。</p>'}</div>
        <span class="page-number">${page < totalPages ? String(page + 1).padStart(2, '0') : '—'}</span></section>`
    }).join('')
    overlay.querySelector('.book-prev').disabled = spread === 0
    overlay.querySelector('.book-next').disabled = (spread + 1) * 8 >= list.length
    overlay.querySelector('.book-pagination').textContent = `${Math.min(spread * 2 + 1, totalPages)}–${Math.min(spread * 2 + 2, totalPages)} / ${totalPages} 页 · 已发现 ${list.filter(s => discovered.has(s.id)).length}/${list.length}`
    for (const species of list.slice(spread * 8, spread * 8 + 8)) {
      thumbnail(species).then(url => {
        if (token !== generation || overlay.hidden) return
        const target = pages.querySelector(`[data-species="${species.id}"] .specimen-preview`)
        if (url) {
          const img = new Image()
          img.src = url
          img.alt = species.name + '模型'
          target.replaceChildren(img)
        } else target.textContent = '模型准备中，请稍后重新打开'
      }).catch(error => {
        console.warn('图鉴模型预览失败', species.id, error)
        if (token === generation) pages.querySelector(`[data-species="${species.id}"] .specimen-preview`).textContent = '模型暂不可用'
      })
    }
  }
  function close() {
    overlay.hidden = true
    generation++
    launcher.focus()
  }
  launcher.addEventListener('click', () => {
    onOpen()
    overlay.hidden = false
    render()
    overlay.querySelector('.book-close').focus()
  })
  overlay.querySelector('.book-close').onclick = close
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close()
    const entry = event.target.closest('[data-species]')
    if (entry) onSpecies(entry.dataset.species)
    const tab = event.target.closest('[data-category]')
    if (tab) { category = tab.dataset.category; spread = 0; render() }
  })
  overlay.querySelector('.book-prev').onclick = () => { spread--; render() }
  overlay.querySelector('.book-next').onclick = () => { spread++; render() }
  overlay.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return
    const items = [...overlay.querySelectorAll('button:not(:disabled)')]
    const index = items.indexOf(document.activeElement)
    event.preventDefault()
    items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus()
  })
  return { render, close, get isOpen() { return !overlay.hidden }, setCategory(value) { category = value; spread = 0; render() } }
}
