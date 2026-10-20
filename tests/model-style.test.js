import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createDiscoveryMaterial } from '../src/discoveryMaterial.js'
import { resolveOutlineTarget } from '../src/interactionOutline.js'

test('pastel finish preserves texture alpha and source materials, with independent reveal states', () => {
  const source = new THREE.MeshStandardMaterial({ color: 0x443311, map: new THREE.Texture(), alphaTest: 0.5, metalness: 0.8, roughness: 0.2 })
  const geometry = new THREE.BoxGeometry(2, 4, 1)
  const first = createDiscoveryMaterial(source, geometry)
  const second = createDiscoveryMaterial(source, geometry)
  assert.equal(first.map, source.map)
  assert.equal(first.alphaTest, source.alphaTest)
  assert.ok(first.color.equals(source.color))
  assert.equal(source.metalness, 0.8)
  assert.equal(first.metalness, 0.05)
  first.userData.discoveryReveal.value = 1
  assert.equal(second.userData.discoveryReveal.value, 0)
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader }
  first.onBeforeCompile(shader)
  assert.equal(shader.uniforms.modelBrushScale.value, 0.25)
  assert.ok(shader.vertexShader.includes('#include <skinning_vertex>'))
  assert.ok(shader.fragmentShader.includes('#include <alphatest_fragment>'))
})

test('outline selects an individual instance and maps river interaction proxies to visible water', () => {
  const scene = new THREE.Scene()
  const one = new THREE.Group(), two = new THREE.Group()
  one.userData.speciesId = two.userData.speciesId = 'tree1'
  scene.add(one, two)
  assert.equal(resolveOutlineTarget(one, scene), one)
  const river = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())
  scene.add(river)
  const proxy = new THREE.Object3D()
  proxy.userData.outlineTargetUuid = river.uuid
  assert.equal(resolveOutlineTarget(proxy, scene), river)
  assert.equal(resolveOutlineTarget(null, scene), null)
})
