import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Low-poly but well-proportioned stadium seat, facing local +Z. */
export function createSeatGeometry() {
  const pan = new THREE.BoxGeometry(0.44, 0.06, 0.4)
  pan.translate(0, 0.44, 0.04)
  const back = new THREE.BoxGeometry(0.44, 0.44, 0.05)
  back.rotateX(-0.14)
  back.translate(0, 0.68, -0.17)
  const stem = new THREE.BoxGeometry(0.1, 0.42, 0.12)
  stem.translate(0, 0.21, -0.1)
  const g = mergeGeometries([pan, back, stem])!
  g.computeBoundingSphere()
  return g
}
