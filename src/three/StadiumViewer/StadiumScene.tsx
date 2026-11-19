import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useStadiumStore } from '../../store/useStadiumStore'
import { CanvasErrorBoundary } from '../../components/StadiumViewer/CanvasErrorBoundary'
import { StadiumLighting } from '../StadiumLighting/StadiumLighting'
import { StadiumField } from '../StadiumField/StadiumField'
import { StadiumStructure } from '../StadiumModel/StadiumStructure'
import { StadiumPark } from '../StadiumEnvironment/StadiumPark'
import { StadiumSeats } from '../StadiumSeats/StadiumSeats'
import { SectorOverlay } from '../StadiumModel/SectorOverlay'
import { InteractiveSectorSeats } from '../StadiumSeats/InteractiveSectorSeats'
import { CameraRig } from '../StadiumCamera/CameraRig'

function SceneReadyNotifier() {
  const setLoadProgress = useStadiumStore((s) => s.setLoadProgress)
  const setSceneReady = useStadiumStore((s) => s.setSceneReady)

  useEffect(() => {
    setLoadProgress(0.65)
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      setLoadProgress(0.9)
      raf2 = requestAnimationFrame(() => {
        setSceneReady()
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [setLoadProgress, setSceneReady])

  return null
}

export function StadiumScene() {
  return (
    <CanvasErrorBoundary>
      <div className="h-full w-full touch-none select-none">
        <Canvas
          shadows
          dpr={[1, 2]}
          frameloop="demand"
          camera={{ fov: 30, near: 0.25, far: 3500 }}
          gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        >
          <StadiumLighting shadowSize={2048} />
          <StadiumField quality="high" />
          <StadiumStructure />
          <StadiumPark />
          <StadiumSeats />
          <SectorOverlay />
          <InteractiveSectorSeats />
          <CameraRig />
          <EffectComposer multisampling={4}>
            <Bloom mipmapBlur luminanceThreshold={1.25} intensity={0.32} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
          <SceneReadyNotifier />
        </Canvas>
      </div>
    </CanvasErrorBoundary>
  )
}
