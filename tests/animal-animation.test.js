import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { attachAnimalAnimation, updateAnimalAnimation } from '../src/animalAnimation.js'
import { getModelBounds } from '../src/modelBounds.js'
import { updateAnimalIdle } from '../src/animals.js'

const bytes = await readFile(new URL('../public/Animals.undefined-glb/Spider.glb', import.meta.url))
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')

test('real spider clip moves leg joints without moving the root or another clone', () => {
  const animal = clone(gltf.scene)
  const other = clone(gltf.scene)
  const leg = animal.getObjectByName('FrontLegL')
  assert.ok(leg?.isBone)
  const rest = leg.quaternion.clone()
  const otherRest = other.getObjectByName('FrontLegL').quaternion.clone()
  assert.equal(attachAnimalAnimation(animal, gltf.animations), true)
  updateAnimalAnimation(animal, 0.2, true)
  assert.ok(leg.quaternion.angleTo(rest) > 0.01)
  assert.ok(other.getObjectByName('FrontLegL').quaternion.equals(otherRest))
  assert.deepEqual(animal.position.toArray(), [0, 0, 0])
  assert.doesNotThrow(() => clone(animal)) // Catalog cloning must remain safe.
  for (let i = 0; i < 120; i++) updateAnimalAnimation(animal, 1 / 60, false)
  assert.ok(updateAnimalAnimation(animal, 1 / 60, false) < 0.001)
})

test('animated spider transitions between actual travel and stationary idle', () => {
  const animal = clone(gltf.scene)
  const group = new THREE.Group()
  group.add(animal)
  const terrain = { width: 10, height: 10, heights: Array.from({ length: 10 }, () => Array(10).fill(0)) }
  animal.userData = { animal: true, motion: { type: 'walk', speed: 0.15 }, hasLocomotion: true, walkTimer: 100, resting: false, anchor: new THREE.Vector2(), heading: 0, idlePhase: 0, idleAmp: 0 }
  attachAnimalAnimation(animal, gltf.animations)
  updateAnimalIdle(group, 0, 0.1, terrain)
  assert.ok(animal.position.x > 0)
  animal.userData.resting = true
  for (let i = 0; i < 120; i++) updateAnimalIdle(group, 0, 1 / 60, terrain)
  const stopped = animal.position.clone()
  updateAnimalIdle(group, 0, 0.1, terrain)
  assert.ok(animal.position.distanceTo(stopped) < 0.00001)
  assert.equal(animal.position.y, 0)
})

test('spider normalization uses updated bone bounds at both scales', () => {
  const model = clone(gltf.scene)
  const bounds = getModelBounds(model)
  const size = bounds.getSize(new THREE.Vector3())
  model.scale.setScalar(0.3 / Math.max(size.x, size.y, size.z))
  const scaled = getModelBounds(model).getSize(new THREE.Vector3())
  assert.ok(Math.abs(Math.max(scaled.x, scaled.y, scaled.z) - 0.3) < 1e-6)
})

test('static files do not invent missing animation', () => {
  assert.equal(attachAnimalAnimation(new THREE.Group(), []), false)
})
