import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { useFormationStore } from '../store/formationStore'
import { useSimulationStore } from '../store/simulationStore'

export function useThreeScene(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const params = useFormationStore((s) => s.params)
  const result = useSimulationStore((s) => s.result)

  const init = useCallback(() => {
    if (!canvasRef.current) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a)
    // Hook returns cleanup - viewers use R3F fiber instead for real usage
    return scene
  }, [])

  // R3F handles the heavy lifting; this hook is for imperative operations
  return { init }
}
