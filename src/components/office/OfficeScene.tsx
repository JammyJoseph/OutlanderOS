"use client"

import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera, MapControls, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import { AgentAvatar } from './AgentAvatar'
import { TaskBoard3D } from './TaskBoard3D'
import { useAgentStore } from '@/lib/agent-store'
import type { Agent } from '@/lib/agents'

// ToonModel: load a GLB and replace all materials with flat MeshLambertMaterial
function ToonModel({
  path,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  path: string
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
}) {
  const { scene } = useGLTF(path)
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        const newMats = mats.map((m) => {
          const std = m as THREE.MeshStandardMaterial
          return new THREE.MeshLambertMaterial({
            color: std.color ?? new THREE.Color('#A09070'),
          })
        })
        child.material = newMats.length === 1 ? newMats[0] : newMats
      }
    })
    return clone
  }, [scene])
  return (
    <primitive
      object={clonedScene}
      position={position}
      rotation={rotation}
      scale={typeof scale === 'number' ? [scale, scale, scale] : scale}
    />
  )
}

// Agent desk station with toon-style materials
function AgentStation({
  agent,
  isSelected,
  isActive,
  onSelect,
}: {
  agent: Agent
  isSelected: boolean
  isActive: boolean
  onSelect: () => void
}) {
  const statusColor =
    isActive ? '#4ADE80' :
    agent.status === 'active' ? '#4ADE80' :
    agent.status === 'thinking' ? '#D4A853' :
    '#6B7280'

  return (
    <group
      position={[agent.position.x, 0, agent.position.z]}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerEnter={() => { document.body.style.cursor = 'pointer' }}
      onPointerLeave={() => { document.body.style.cursor = 'auto' }}
    >
      {/* Per-desk glow in agent color */}
      <pointLight
        position={[0, 1.2, 0]}
        color={agent.color}
        intensity={isSelected || isActive ? 0.6 : 0.18}
        distance={3.5}
        decay={2}
      />

      {/* Desk from GLB with toon material */}
      <ToonModel path="/office-assets/models/furniture/desk.glb" position={[0, 0, 0]} scale={1} />

      {/* Chair */}
      <ToonModel
        path="/office-assets/models/furniture/chairDesk.glb"
        position={[0, 0, 0.9]}
        rotation={[0, Math.PI, 0]}
        scale={1}
      />

      {/* Computer screen */}
      <ToonModel
        path="/office-assets/models/furniture/computerScreen.glb"
        position={[0, 0.75, -0.25]}
        scale={0.85}
      />

      {/* Colored monitor screen in agent color */}
      <mesh position={[0, 0.78, -0.22]}>
        <boxGeometry args={[0.55, 0.35, 0.01]} />
        <meshLambertMaterial color={agent.color} />
      </mesh>

      {/* Status strip at front desk edge */}
      <mesh position={[0, 0.42, 0.46]}>
        <boxGeometry args={[1.3, 0.025, 0.018]} />
        <meshLambertMaterial color={statusColor} />
      </mesh>

      {/* Agent avatar */}
      <AgentAvatar
        agentId={agent.id}
        color={agent.color}
        status={isActive ? 'active' : agent.status}
        selected={isSelected || isActive}
        position={[0, 0.95, 0.1]}
      />

      {/* Name label */}
      <Html position={[0, 2.15, 0.1]} center>
        <div style={{
          background: 'rgba(0,0,0,0.72)',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          letterSpacing: '0.02em',
        }}>
          {agent.name} <span style={{ color: agent.color }}>●</span>
        </div>
      </Html>
      <Html position={[0, 1.95, 0.1]} center>
        <div style={{
          color: '#bbb',
          fontSize: '9px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {agent.role}
        </div>
      </Html>

      {/* Selection ring */}
      {(isSelected || isActive) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.45, 1.7, 32]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  )
}

function OfficeLighting() {
  return (
    <>
      {/* Warm ambient — main source of the cozy tone */}
      <ambientLight color="#FFF5E6" intensity={0.75} />
      {/* Main directional from upper-left, soft shadows */}
      <directionalLight
        position={[-10, 14, 6]}
        intensity={0.85}
        color="#FFF8E7"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.001}
      />
      {/* Warm fill from opposite side */}
      <directionalLight position={[8, 6, -4]} intensity={0.25} color="#FFE4B5" />
      {/* Ceiling pendant effect — center of room */}
      <pointLight position={[0, 4.5, -1]} color="#FFF0D0" intensity={0.7} distance={14} decay={2} />
      {/* Lounge corner lamp */}
      <pointLight position={[-5.8, 2.5, -4]} color="#FFE4B5" intensity={0.5} distance={5} decay={2} />
    </>
  )
}

function OfficeFloor() {
  // Warm beige checkerboard — two close tones for subtle pixel grid
  const tiles: React.ReactNode[] = []
  for (let xi = 0; xi < 7; xi++) {
    for (let zi = 0; zi < 7; zi++) {
      const isAlt = (xi + zi) % 2 === 0
      tiles.push(
        <mesh
          key={`t${xi}-${zi}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-6 + xi * 2 + 1, 0, -6 + zi * 2 + 1]}
          receiveShadow
        >
          <planeGeometry args={[2, 2]} />
          <meshLambertMaterial color={isAlt ? '#D4B896' : '#C8AC84'} />
        </mesh>
      )
    }
  }
  return <group>{tiles}</group>
}

function OfficeWalls() {
  // U-shape: back wall + two side walls; front is open (dollhouse view)
  const wallH = 3.2
  const wallColor = '#8B8178'
  const skirtColor = '#7A6855'

  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, wallH / 2, -7]} receiveShadow castShadow>
        <boxGeometry args={[14.5, wallH, 0.22]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-7, wallH / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[14.5, wallH, 0.22]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Right wall */}
      <mesh position={[7, wallH / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[14.5, wallH, 0.22]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>

      {/* Baseboard — back */}
      <mesh position={[0, 0.06, -6.9]}>
        <boxGeometry args={[14.5, 0.12, 0.14]} />
        <meshLambertMaterial color={skirtColor} />
      </mesh>
      {/* Baseboard — left */}
      <mesh position={[-6.9, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[14.5, 0.12, 0.14]} />
        <meshLambertMaterial color={skirtColor} />
      </mesh>
      {/* Baseboard — right */}
      <mesh position={[6.9, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[14.5, 0.12, 0.14]} />
        <meshLambertMaterial color={skirtColor} />
      </mesh>

      {/* Wall-top trim strips */}
      <mesh position={[0, wallH, -7]}>
        <boxGeometry args={[14.5, 0.12, 0.28]} />
        <meshLambertMaterial color="#B8AA9A" />
      </mesh>
      <mesh position={[-7, wallH, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[14.5, 0.12, 0.28]} />
        <meshLambertMaterial color="#B8AA9A" />
      </mesh>
      <mesh position={[7, wallH, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[14.5, 0.12, 0.28]} />
        <meshLambertMaterial color="#B8AA9A" />
      </mesh>
    </group>
  )
}

function DecorFurniture() {
  return (
    <Suspense fallback={null}>
      {/* Lounge area — back-left corner */}
      <ToonModel
        path="/office-assets/models/furniture/loungeSofa.glb"
        position={[-5.5, 0, -5]}
        rotation={[0, Math.PI / 4, 0]}
        scale={1}
      />
      <ToonModel
        path="/office-assets/models/furniture/tableCoffee.glb"
        position={[-4.5, 0, -4]}
        scale={0.85}
      />
      <ToonModel
        path="/office-assets/models/furniture/loungeDesignChair.glb"
        position={[-5, 0, -3]}
        rotation={[0, Math.PI / 3, 0]}
        scale={0.9}
      />

      {/* Plants in corners */}
      <ToonModel path="/office-assets/models/furniture/plantSmall1.glb" position={[-6.3, 0, 6]} scale={1.2} />
      <ToonModel path="/office-assets/models/furniture/pottedPlant.glb" position={[6.3, 0, 6]} scale={1.2} />
      <ToonModel path="/office-assets/models/furniture/plantSmall1.glb" position={[-6.3, 0, -5.5]} scale={1.0} />
      <ToonModel path="/office-assets/models/furniture/pottedPlant.glb" position={[6.3, 0, -5.5]} scale={1.0} />

      {/* Floor lamp near lounge */}
      <ToonModel path="/office-assets/models/furniture/lampRoundFloor.glb" position={[-6.1, 0, -3.5]} scale={1} />

      {/* Bookshelf — back-right wall */}
      <ToonModel path="/office-assets/models/furniture/bookcaseClosed.glb" position={[5.2, 0, -6.5]} scale={1.1} />

      {/* Meeting table — right front area */}
      <ToonModel path="/office-assets/models/furniture/tableRound.glb" position={[4.5, 0, 4.5]} scale={1} />
      <ToonModel
        path="/office-assets/models/furniture/chairModernCushion.glb"
        position={[3.3, 0, 4.5]}
        rotation={[0, Math.PI / 2, 0]}
        scale={0.9}
      />
      <ToonModel
        path="/office-assets/models/furniture/chairModernCushion.glb"
        position={[5.7, 0, 4.5]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={0.9}
      />
      <ToonModel
        path="/office-assets/models/furniture/chairModernCushion.glb"
        position={[4.5, 0, 3.3]}
        rotation={[0, 0, 0]}
        scale={0.9}
      />
    </Suspense>
  )
}

function SceneContent() {
  const { agents, selectedAgentId, activeAgentId, setSelectedAgent } = useAgentStore()

  return (
    <>
      <OfficeLighting />
      <OfficeFloor />
      <OfficeWalls />
      <DecorFurniture />

      {/* Task board repositioned on back wall */}
      <group position={[6, 0, 5.5]}>
        <TaskBoard3D />
      </group>

      {agents.map((agent) => (
        <AgentStation
          key={agent.id}
          agent={agent}
          isSelected={selectedAgentId === agent.id}
          isActive={activeAgentId === agent.id}
          onSelect={() => setSelectedAgent(selectedAgentId === agent.id ? null : agent.id)}
        />
      ))}

      {/* Invisible click plane to deselect */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        onClick={() => setSelectedAgent(null)}
        visible={false}
      >
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial />
      </mesh>
    </>
  )
}

interface OfficeSceneProps {
  selectedAgentId?: string | null
  onSelectAgent?: (id: string | null) => void
}

export default function OfficeScene(_props: OfficeSceneProps) {
  return (
    <Canvas
      shadows
      gl={{ antialias: false, toneMapping: THREE.NoToneMapping }}
      style={{ background: '#0a0a0f' }}
    >
      <OrthographicCamera
        makeDefault
        zoom={52}
        position={[15, 15, 15]}
        near={0.1}
        far={200}
      />
      <MapControls
        enableRotate={false}
        enableZoom={true}
        zoomSpeed={0.8}
        panSpeed={0.6}
        target={[0, 0, -0.5]}
      />
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  )
}

// Preload all models
useGLTF.preload('/office-assets/models/furniture/desk.glb')
useGLTF.preload('/office-assets/models/furniture/chairDesk.glb')
useGLTF.preload('/office-assets/models/furniture/computerScreen.glb')
useGLTF.preload('/office-assets/models/furniture/loungeSofa.glb')
useGLTF.preload('/office-assets/models/furniture/tableCoffee.glb')
useGLTF.preload('/office-assets/models/furniture/plantSmall1.glb')
useGLTF.preload('/office-assets/models/furniture/pottedPlant.glb')
useGLTF.preload('/office-assets/models/furniture/lampRoundFloor.glb')
useGLTF.preload('/office-assets/models/furniture/bookcaseClosed.glb')
useGLTF.preload('/office-assets/models/furniture/loungeDesignChair.glb')
useGLTF.preload('/office-assets/models/furniture/tableRound.glb')
useGLTF.preload('/office-assets/models/furniture/chairModernCushion.glb')
