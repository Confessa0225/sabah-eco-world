import * as THREE from 'three'

// Bone matrices and cached skinned bounds must match the clone's current pose
// before fitting it into the catalog camera.
export function getModelBounds(model) {
  model.updateWorldMatrix(true, false)
  model.updateMatrixWorld(true)
  model.traverse(object => {
    if (!object.isSkinnedMesh) return
    object.computeBoundingBox()
    object.computeBoundingSphere()
  })
  return new THREE.Box3().setFromObject(model, true)
}
