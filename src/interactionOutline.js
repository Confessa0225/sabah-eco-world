import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export function resolveOutlineTarget(target, scene) {
  if (!target) return null
  return target.userData.outlineTargetUuid
    ? scene.getObjectByProperty('uuid', target.userData.outlineTargetUuid) || null
    : target
}

export function createInteractionOutline(renderer, scene, camera) {
  let composer, outline, selected
  function initialize() {
    const size = renderer.getSize(new THREE.Vector2())
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 2 })
    composer = new EffectComposer(renderer, target)
    composer.addPass(new RenderPass(scene, camera))
    outline = new OutlinePass(size, scene, camera)
    outline.visibleEdgeColor.set(0xffd58a)
    outline.hiddenEdgeColor.set(0x000000)
    outline.edgeStrength = 3
    outline.edgeThickness = 1.5
    outline.edgeGlow = 0.15
    composer.addPass(outline)
    composer.addPass(new OutputPass())
    composer.setSize(size.x, size.y)
  }
  return {
    render(target, delta) {
      const object = resolveOutlineTarget(target, scene)
      if (!object) { renderer.render(scene, camera); return }
      if (!composer) initialize()
      if (selected !== object) {
        selected = object
        outline.selectedObjects = [object]
      }
      composer.render(delta)
    },
    resize(width, height) { composer?.setSize(width, height) }
  }
}
