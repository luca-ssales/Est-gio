import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PARK_AVENUE_ANGLES, createParkTexture } from '../../lib/textures'
import { mulberry32 } from '../../lib/random'
import { bowlOutline } from '../utils/geometry'
import { lightingState, sampleLightingPreset } from '../StadiumLighting/lightingState'
import { PlazaCrowd } from './PlazaCrowd'
import { ParkTraffic } from './ParkTraffic'

function createCrownGeometry() {
  const g1 = new THREE.IcosahedronGeometry(1.55, 1)
  g1.translate(0, 1.5, 0)
  const g2 = new THREE.IcosahedronGeometry(1.2, 1)
  g2.translate(0.75, 0.95, 0.45)
  const g3 = new THREE.IcosahedronGeometry(1.15, 1)
  g3.translate(-0.7, 1.05, -0.4)
  const merged = mergeGeometries([g1, g2, g3])!
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
  return merged
}

function isOnRoadOrPlaza(x: number, z: number): boolean {
  // Inside stadium pedestrian plaza
  if ((x / 122) ** 2 + (z / 140) ** 2 <= 1) return true
  // On ring parkway road
  const ovalR = Math.hypot(x / 205, z / 225)
  if (Math.abs(ovalR - 1) < 0.082) return true

  // On any of the 6 curved radial boulevards
  const r = Math.hypot(x, z)
  const theta = Math.atan2(z, x)
  for (const a0 of PARK_AVENUE_ANGLES) {
    const roadAng = a0 + 0.14 * Math.sin(r / 120)
    const dAng = Math.atan2(Math.sin(theta - roadAng), Math.cos(theta - roadAng))
    if (Math.abs(dAng) * r < 14.5) return true
  }
  return false
}

const FOLIAGE_SHADES = [
  new THREE.Color('#2e5e1d'),
  new THREE.Color('#3f7825'),
  new THREE.Color('#528e2d'),
  new THREE.Color('#639e35'),
]

/** Sunlit green park around the stadium with stone plaza, curving avenues, 550+ instanced trees and lamp posts. */
export function StadiumPark() {
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const crownRef = useRef<THREE.InstancedMesh>(null)
  const lampRef = useRef<THREE.InstancedMesh>(null)
  const outerMeadowMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const lampMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const lightingScratch = useMemo(() => sampleLightingPreset(0), [])

  const parkTex = useMemo(() => createParkTexture(2048), [])

  const parkGroundGeo = useMemo(() => {
    const outer = new THREE.Shape()
    outer.absarc(0, 0, 498, 0, Math.PI * 2, false)
    const holePts = bowlOutline(2, 32).map(([x, z]) => new THREE.Vector2(x, -z))
    outer.holes.push(new THREE.Path(holePts))
    const g = new THREE.ShapeGeometry(outer, 48)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const uv = new Float32Array(pos.count * 2)
    const normal = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + 500) / 1000
      uv[i * 2 + 1] = (pos.getZ(i) + 500) / 1000
      normal[i * 3 + 1] = 1
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
    return g
  }, [])

  const outerMeadowGeo = useMemo(() => new THREE.RingGeometry(490, 1450, 64).rotateX(-Math.PI / 2), [])

  const crownGeo = useMemo(createCrownGeometry, [])

  const trees = useMemo(() => {
    const rand = mulberry32(777)
    const list: { x: number; z: number; scale: number; rotY: number; shadeIdx: number }[] = []
    let attempts = 0
    while (list.length < 560 && attempts < 8000) {
      attempts++
      const r = 135 + Math.sqrt(rand()) * 315
      const a = rand() * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (isOnRoadOrPlaza(x, z)) continue
      list.push({
        x,
        z,
        scale: 1.55 + rand() * 1.45,
        rotY: rand() * Math.PI * 2,
        shadeIdx: Math.floor(rand() * FOLIAGE_SHADES.length),
      })
    }
    return list
  }, [])

  const lamps = useMemo(() => {
    const pts: { x: number; z: number }[] = []
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2
      pts.push({ x: Math.cos(a) * 195, z: Math.sin(a) * 215 })
    }
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      pts.push({ x: Math.cos(a) * 109, z: Math.sin(a) * 127 })
    }
    return pts
  }, [])

  useLayoutEffect(() => {
    const trunk = trunkRef.current
    const crown = crownRef.current
    const lamp = lampRef.current
    if (!trunk || !crown || !lamp) return

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const p = new THREE.Vector3()
    const sc = new THREE.Vector3()

    trees.forEach((tr, i) => {
      q.setFromAxisAngle(up, tr.rotY)
      p.set(tr.x, 1.0 * tr.scale - 0.15, tr.z)
      sc.set(tr.scale, tr.scale, tr.scale)
      m.compose(p, q, sc)
      trunk.setMatrixAt(i, m)

      p.set(tr.x, 1.75 * tr.scale - 0.15, tr.z)
      m.compose(p, q, sc)
      crown.setMatrixAt(i, m)
      crown.setColorAt(i, FOLIAGE_SHADES[tr.shadeIdx])
    })

    trunk.instanceMatrix.needsUpdate = true
    crown.instanceMatrix.needsUpdate = true
    if (crown.instanceColor) crown.instanceColor.needsUpdate = true
    trunk.computeBoundingSphere()
    crown.computeBoundingSphere()

    sc.set(1, 1, 1)
    q.identity()
    lamps.forEach((lp, i) => {
      p.set(lp.x, 4.2, lp.z)
      m.compose(p, q, sc)
      lamp.setMatrixAt(i, m)
    })
    lamp.instanceMatrix.needsUpdate = true
    lamp.computeBoundingSphere()
  }, [trees, lamps])

  useFrame(() => {
    const p = sampleLightingPreset(lightingState.timeOfDay, lightingScratch)
    if (outerMeadowMatRef.current) {
      outerMeadowMatRef.current.color.copy(p.meadowColor)
    }
    if (lampRef.current && lampMatRef.current) {
      const f = lightingState.lampFactor
      lampRef.current.visible = f > 0.02
      lampMatRef.current.opacity = f
    }
  })

  return (
    <group>
      <mesh geometry={parkGroundGeo} position={[0, -0.15, 0]} receiveShadow>
        <meshStandardMaterial map={parkTex} roughness={0.94} metalness={0} />
      </mesh>
      <mesh geometry={outerMeadowGeo} position={[0, -0.17, 0]} receiveShadow>
        <meshStandardMaterial ref={outerMeadowMatRef} color="#4d8c28" roughness={0.96} metalness={0} />
      </mesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow receiveShadow raycast={() => null}>
        <cylinderGeometry args={[0.16, 0.28, 2.0, 6]} />
        <meshStandardMaterial color="#4a3423" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[crownGeo, undefined, trees.length]} castShadow receiveShadow raycast={() => null}>
        <meshStandardMaterial color="#ffffff" roughness={0.88} metalness={0.02} />
      </instancedMesh>
      <instancedMesh
        ref={lampRef}
        args={[undefined, undefined, lamps.length]}
        visible={false}
        raycast={() => null}
      >
        <sphereGeometry args={[0.55, 8, 8]} />
        <meshBasicMaterial ref={lampMatRef} color="#ffdca0" transparent opacity={0} toneMapped={false} />
      </instancedMesh>
      <ParkTraffic />
      <PlazaCrowd />
    </group>
  )
}
