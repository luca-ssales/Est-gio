import { Environment, Lightformer } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mulberry32 } from '../../lib/random'
import { useStadiumStore } from '../../store/useStadiumStore'
import { lightingState, modeToTimeOfDay, sampleLightingPreset } from './lightingState'

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SKY_FRAG = /* glsl */ `
uniform vec3 uSkyZenith;
uniform vec3 uSkyMid;
uniform vec3 uSkyHorizon;
uniform vec3 uFogColor;
uniform vec3 uCloudColor;
uniform float uCloudOpacity;
uniform vec3 uSunDir;
uniform float uDuskFactor;
uniform float uTime;

varying vec3 vDir;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  vec3 sunDir = normalize(uSunDir);
  float h = clamp(dir.y, 0.0, 1.0);

  vec3 sky = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.30, h));
  sky = mix(sky, uSkyZenith, smoothstep(0.24, 0.85, h));

  // Below horizon softly matches ground fog
  if (dir.y < 0.0) {
    sky = mix(uSkyHorizon, uFogColor * 0.72, smoothstep(0.0, -0.25, dir.y));
  }

  float sunDot = dot(dir, sunDir);
  float sunVis = smoothstep(-0.08, 0.06, sunDir.y);

  // Golden-hour horizon glow band around the sun azimuth
  float horizonBand = pow(clamp(1.0 - abs(dir.y), 0.0, 1.0), 6.0);
  float sunAzMask = pow(max(sunDot, 0.0), 2.5);
  sky += vec3(1.0, 0.42, 0.14) * horizonBand * sunAzMask * uDuskFactor * 0.75;

  // Mie scattering halo + crisp HDR solar disc
  vec3 haloCol = mix(vec3(1.0, 0.94, 0.82), vec3(1.0, 0.48, 0.18), uDuskFactor);
  sky += haloCol * pow(max(sunDot, 0.0), 10.0) * 0.55 * sunVis;
  float sunDisc = smoothstep(0.9985, 0.99965, sunDot) * sunVis;
  sky += haloCol * sunDisc * 1.65;

  // Procedural drifting atmospheric clouds on upper hemisphere
  if (dir.y > 0.025) {
    vec2 cloudUv = dir.xz / (max(dir.y, 0.05) + 0.14) * 0.85 + vec2(uTime * 0.006, uTime * 0.0025);
    float n = fbm(cloudUv * 1.35);
    float puff = smoothstep(0.47, 0.78, n);
    float horizonFade = smoothstep(0.025, 0.18, dir.y);
    vec3 cloudLit = mix(uCloudColor, haloCol * 1.15, pow(max(sunDot, 0.0), 4.0) * sunVis * 0.45);
    sky = mix(sky, cloudLit, puff * uCloudOpacity * horizonFade);
  }

  gl_FragColor = vec4(sky, 1.0);
}
`

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vColor = aColor;
  vTwinkle = 0.72 + 0.28 * sin(uTime * 1.45 + aPhase);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = aSize * uPixelRatio * vTwinkle;
}
`

const STAR_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float alpha = smoothstep(0.5, 0.08, d) * uOpacity * vTwinkle;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`

const StaticEnvironment = memo(function StaticEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={2.2} color="#ffd9b0" position={[-60, 18, -30]} scale={[60, 12, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.4} color="#bcd0ff" position={[50, 40, 30]} scale={[80, 20, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={3} color="#ffffff" position={[0, 60, 0]} scale={40} rotation-x={Math.PI / 2} />
      <Lightformer form="rect" intensity={0.6} color="#3a4a7a" position={[0, -20, 0]} scale={[200, 200, 1]} rotation-x={-Math.PI / 2} />
    </Environment>
  )
})

function buildStarGeometry(count = 1600, radius = 1680) {
  const rand = mulberry32(404)
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  const colors = new Float32Array(count * 3)
  const tmpColor = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2
    const u = 0.03 + rand() * 0.97 // upper hemisphere above horizon
    const sinPhi = Math.sqrt(Math.max(0, 1 - u * u))
    positions[i * 3] = radius * sinPhi * Math.cos(theta)
    positions[i * 3 + 1] = radius * u
    positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta)

    sizes[i] = 1.6 + Math.pow(rand(), 2) * 2.8
    phases[i] = rand() * Math.PI * 2

    const tint = rand()
    if (tint < 0.2) tmpColor.set('#ffd9b3')
    else if (tint < 0.55) tmpColor.set('#dbe8ff')
    else tmpColor.set('#ffffff')
    colors[i * 3] = tmpColor.r
    colors[i * 3 + 1] = tmpColor.g
    colors[i * 3 + 2] = tmpColor.b
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  g.computeBoundingSphere()
  return g
}

/**
 * Continuous atmospheric SkyDome, twinkling stars, and smooth Day / Dusk / Night transitions.
 */
export function StadiumLighting({ shadowSize = 2048 }: { shadowSize?: number }) {
  const sun = useRef<THREE.DirectionalLight>(null)
  const fill1 = useRef<THREE.DirectionalLight>(null)
  const fill2 = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const skyMesh = useRef<THREE.Mesh>(null)
  const starPoints = useRef<THREE.Points>(null)

  const lightingMode = useStadiumStore((s) => s.lightingMode)
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)

  const skyGeo = useMemo(() => new THREE.SphereGeometry(1800, 48, 32), [])
  const starGeo = useMemo(() => buildStarGeometry(1600, 1680), [])

  const initialSample = useMemo(() => sampleLightingPreset(lightingState.timeOfDay), [])
  const sampleScratch = useMemo(() => sampleLightingPreset(0), [])

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSkyZenith: { value: initialSample.skyZenith.clone() },
          uSkyMid: { value: initialSample.skyMid.clone() },
          uSkyHorizon: { value: initialSample.skyHorizon.clone() },
          uFogColor: { value: initialSample.fogColor.clone() },
          uCloudColor: { value: initialSample.cloudColor.clone() },
          uCloudOpacity: { value: initialSample.cloudOpacity },
          uSunDir: { value: initialSample.sunDir.clone() },
          uDuskFactor: { value: initialSample.duskFactor },
          uTime: { value: 0 },
        },
      }),
    [initialSample],
  )

  const starMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: gl.getPixelRatio() },
          uOpacity: { value: initialSample.nightFactor },
        },
      }),
    [gl, initialSample],
  )

  useEffect(() => {
    const l = sun.current
    if (!l) return
    const cam = l.shadow.camera as THREE.OrthographicCamera
    cam.left = -210
    cam.right = 210
    cam.top = 210
    cam.bottom = -210
    cam.near = 10
    cam.far = 620
    cam.updateProjectionMatrix()
    l.shadow.mapSize.set(shadowSize, shadowSize)
    l.shadow.bias = -0.0004
    l.shadow.normalBias = 0.04
    l.target.position.set(0, 0, 0)
    l.target.updateMatrixWorld()
  }, [shadowSize])

  useEffect(() => {
    lightingState.targetTimeOfDay = modeToTimeOfDay(lightingMode)
    lightingState.transitioning = Math.abs(lightingState.targetTimeOfDay - lightingState.timeOfDay) > 1e-4
    invalidate()
  }, [lightingMode, invalidate])

  useEffect(() => {
    return () => {
      skyGeo.dispose()
      starGeo.dispose()
      skyMat.dispose()
      starMat.dispose()
    }
  }, [skyGeo, starGeo, skyMat, starMat])

  useFrame(({ scene, camera, clock }, delta) => {
    const dt = Math.min(delta, 0.05)
    const target = lightingState.targetTimeOfDay
    const diff = target - lightingState.timeOfDay

    if (Math.abs(diff) > 1e-3) {
      // Smooth ease-out arc: ~1.25s between adjacent modes, ~2.1s full day->night glide
      const step = diff * (1 - Math.exp(-3.4 * dt)) + Math.sign(diff) * Math.min(Math.abs(diff), 0.35 * dt)
      if (Math.abs(step) >= Math.abs(diff)) {
        lightingState.timeOfDay = target
        lightingState.transitioning = false
      } else {
        lightingState.timeOfDay += step
        lightingState.transitioning = true
      }
    } else {
      lightingState.timeOfDay = target
      lightingState.transitioning = false
    }

    const p = sampleLightingPreset(lightingState.timeOfDay, sampleScratch)
    lightingState.lampFactor = p.lampFactor
    lightingState.nightFactor = p.nightFactor

    // Keep sky & stars centered on camera to eliminate parallax
    if (skyMesh.current) skyMesh.current.position.copy(camera.position)
    if (starPoints.current) {
      starPoints.current.position.copy(camera.position)
      starPoints.current.visible = p.nightFactor > 0.01
    }

    // Update shader uniforms
    const elapsed = clock.elapsedTime
    skyMat.uniforms.uSkyZenith.value.copy(p.skyZenith)
    skyMat.uniforms.uSkyMid.value.copy(p.skyMid)
    skyMat.uniforms.uSkyHorizon.value.copy(p.skyHorizon)
    skyMat.uniforms.uFogColor.value.copy(p.fogColor)
    skyMat.uniforms.uCloudColor.value.copy(p.cloudColor)
    skyMat.uniforms.uCloudOpacity.value = p.cloudOpacity
    skyMat.uniforms.uSunDir.value.copy(p.sunDir)
    skyMat.uniforms.uDuskFactor.value = p.duskFactor
    skyMat.uniforms.uTime.value = elapsed

    starMat.uniforms.uTime.value = elapsed
    starMat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    starMat.uniforms.uOpacity.value = p.nightFactor

    // Update scene background, fog, and environment intensity in-place
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(p.bg)
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(p.fogColor)
      scene.fog.near = p.fogNear
      scene.fog.far = p.fogFar
    }
    scene.environmentIntensity = p.envInt

    // Update lights in-place
    if (hemi.current) {
      hemi.current.color.copy(p.hemiSky)
      hemi.current.groundColor.copy(p.hemiGround)
      hemi.current.intensity = p.hemiInt
    }
    if (sun.current) {
      sun.current.position.copy(p.sunLightPos)
      sun.current.intensity = p.sunInt
      sun.current.color.copy(p.sunColor)
    }
    if (fill1.current) {
      fill1.current.position.copy(p.fill1Pos)
      fill1.current.intensity = p.fill1Int
      fill1.current.color.copy(p.fill1Color)
    }
    if (fill2.current) {
      fill2.current.position.copy(p.fill2Pos)
      fill2.current.intensity = p.fill2Int
      fill2.current.color.copy(p.fill2Color)
    }

    const st = useStadiumStore.getState()
    if (lightingState.transitioning || st.stage === 'view' || st.droneTour) {
      invalidate()
    }
  })

  return (
    <>
      <color attach="background" args={['#8cbce8']} />
      <fog attach="fog" args={['#b9d6ee', 520, 2400]} />

      <mesh ref={skyMesh} geometry={skyGeo} material={skyMat} renderOrder={-2} frustumCulled={false} raycast={() => null} />
      <points ref={starPoints} geometry={starGeo} material={starMat} visible={false} renderOrder={-1} frustumCulled={false} raycast={() => null} />

      <hemisphereLight ref={hemi} args={['#dff0ff', '#3d5e28', 0.95]} />
      <directionalLight ref={sun} position={[150, 210, -160]} intensity={3.3} color="#fff6e8" castShadow />
      <directionalLight ref={fill1} position={[30, 180, 40]} intensity={0.55} color="#ffffff" />
      <directionalLight ref={fill2} position={[40, 70, 150]} intensity={0.35} color="#dce8ff" />

      <StaticEnvironment />
    </>
  )
}
