import * as THREE from 'three'

// Runtime mixers stay out of userData, which is serialized when the catalog clones a model.
const controllers = new WeakMap()

export function attachAnimalAnimation(animal, clips, phase = 0) {
  const walkClip = clips.find(clip => /(?:^|[_|])walk$/i.test(clip.name))
  const idleClip = clips.find(clip => /(?:^|[_|])idle$/i.test(clip.name))
  if (!walkClip || !idleClip) return false
  const mixer = new THREE.AnimationMixer(animal)
  const walk = mixer.clipAction(walkClip).play()
  const idle = mixer.clipAction(idleClip).play()
  walk.time = (phase % 1) * walkClip.duration
  idle.time = (phase % 1) * idleClip.duration
  idle.setEffectiveWeight(0)
  controllers.set(animal, { mixer, walk, idle, moving: 1 })
  // Animated legs can extend outside the bind-pose bounding sphere.
  animal.traverse(object => { if (object.isSkinnedMesh) object.frustumCulled = false })
  return true
}

export function updateAnimalAnimation(animal, delta, moving, speedRatio = 1) {
  const controller = controllers.get(animal)
  if (!controller) return 1
  controller.moving = THREE.MathUtils.damp(controller.moving, moving ? 1 : 0, 10, delta)
  controller.walk.setEffectiveWeight(controller.moving)
  controller.idle.setEffectiveWeight(1 - controller.moving)
  controller.walk.setEffectiveTimeScale(Math.max(0.05, speedRatio * controller.moving))
  controller.mixer.update(delta)
  return controller.moving
}
