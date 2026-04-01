"use client"

import { useRef, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Html, Stars, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { AgentAvatar } from './AgentAvatar'
import { TaskBoard3D } from './TaskBoard3D'
import { useAgentStore } from '@/lib/agent-store'
import type { Agent } from '@/lib/agents'

// Load a GLB model component
function FurnitureModel({
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
  const cloned = scene.clone(true)
  return (
    <primitive
      object={cloned}
      position={position}
      rotation={rotation}
      scale={typeof scale === 'number' ? [scale, scale, scale] : scale}
    />
  )
}

// Agent desk station — real desk model + computer screen + chair
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
    '#4B5563'

  return (
    <group
      position={[agent.position.x, 0, agent.position.z]}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerEnter={() => { document.body.style.cursor = 'pointer' }}
      onPointerLeave={() => { document.body.style.cursor = 'auto' }}
    >
      {/* Per-desk ambient point light in agent color */}
      <pointLight
        position={[0, 1.2, 0]}
        color={agent.color}
        intensity={isSelected || isActive ? 0.7 : 0.25}
        distance={3.5}
        decay={2}
      />

      {/* Real desk model */}
      <FurnitureModel path="/office-assets/models/furniture/desk.glb" position={[0, 0, 0]} scale={1} />

      {/* Chair behind desk */}
      <FurnitureModel
        path="/office-assets/models/furniture/chairDesk.glb"
        position={[0, 0, 0.9]}
        rotation={[0, Math.PI, 0]}
        scale={1}
      />

      {/* Computer screen on desk */}
      <FurnitureModel
        path="/office-assets/models/furniture/computerScreen.glb"
        position={[0, 0.75, -0.25]}
        scale={0.85}
      />

      {/* Status strip on desk front edge */}
      <mesh position={[0, 0.42, 0.46]}>
        <boxGeometry args={[1.3, 0.025, 0.018]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={isActive || agent.status === 'active' ? 1.0 : agent.status === 'thinking' ? 0.5 : 0.1}
        />
      </mesh>

      {/* Agent avatar floating above desk */}
      <AgentAvatar
        agentId={agent.id}
        color={agent.color}
        status={isActive ? 'active' : agent.status}
        selected={isSelected || isActive}
        position={[0, 0.95, 0.1]}
      />

      {/* Name label */}
      <Html position={[0, 1.48, 0.1]} center>
        <span style={{
          color: isSelected || isActive ? agent.color : '#e5e7eb',
          fontSize: '13px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}>
          {agent.name}
        </span>
      </Html>
      <Html position={[0, 1.31, 0.1]} center>
        <span style={{ color: '#6b7280', fontSize: '9px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {agent.role}
        </span>
      </Html>
      {agent.currentTask && (
        <Html position={[0, 1.15, 0.1]} center>
          <span style={{
            color: agent.color,
            fontSize: '8px',
            whiteSpace: 'nowrap',
            maxWidth: '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
            pointerEvents: 'none',
          }}>
            {agent.currentTask}
          </span>
        </Html>
      )}

      {/* Selection glow ring */}
      {(isSelected || isActive) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.8, 32]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  )
}

function OfficeLighting() {
  return (
    <>
      <ambientLight intensity={0.18} color="#1a1410" />
      <directionalLight
        position={[0, 10, 4]}
        intensity={0.5}
        color="#fff5e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <pointLight position={[0, 2.5, 3.5]} intensity={1.0} color="#D4A853" distance={10} decay={2} />
      <pointLight position={[-12, 3.5, -4]} intensity={0.4} color="#1e3860" distance={16} decay={2} />
      <pointLight position={[12, 3.5, -4]} intensity={0.4} color="#1e3860" distance={16} decay={2} />
      <pointLight position={[0, 5.5, -2]} intensity={0.3} color="#ffeecc" distance={20} decay={1.5} />
    </>
  )
}

function OfficeFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[32, 26]} />
        <meshStandardMaterial color="#0c0c0c" roughness={0.75} metalness={0.25} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[32, 26]}
        cellSize={1.5}
        cellThickness={0.2}
        cellColor="#181818"
        sectionSize={6}
        sectionThickness={0.6}
        sectionColor="#222222"
        fadeDistance={28}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />
      {/* Amber centerline accent */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <planeGeometry args={[0.05, 20]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.4} transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

function OfficeWalls() {
  return (
    <group>
      <mesh position={[0, 3, -9]} receiveShadow>
        <boxGeometry args={[32, 6, 0.2]} />
        <meshStandardMaterial color="#080808" roughness={0.92} />
      </mesh>
      {([-10, -4, 4, 10] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 2.8, -8.88]}>
          <boxGeometry args={[4.5, 4, 0.04]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.7} metalness={0.35} />
        </mesh>
      ))}
      <mesh position={[-16, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[26, 6, 0.2]} />
        <meshStandardMaterial color="#080808" roughness={0.92} />
      </mesh>
      <mesh position={[16, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[26, 6, 0.2]} />
        <meshStandardMaterial color="#080808" roughness={0.92} />
      </mesh>
      <mesh position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[32, 26]} />
        <meshStandardMaterial color="#050505" roughness={1} />
      </mesh>
      {/* Ceiling amber light strips */}
      <mesh position={[0, 5.96, -1]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.35, 18]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.55} transparent opacity={0.55} />
      </mesh>
      {/* OutlanderOS logo bar */}
      <mesh position={[0, 4.2, -8.85]}>
        <boxGeometry args={[3.5, 0.6, 0.03]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.15} roughness={0.5} />
      </mesh>
    </group>
  )
}

function GlassPartition() {
  return (
    <group>
      <mesh position={[-3.5, 1.4, 1.8]}>
        <boxGeometry args={[3.8, 2.8, 0.05]} />
        <meshStandardMaterial color="#88aacc" transparent opacity={0.08} roughness={0.05} metalness={0.1} />
      </mesh>
      <mesh position={[-3.5, 2.85, 1.8]}>
        <boxGeometry args={[3.85, 0.06, 0.07]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[-3.5, 0.0, 1.8]}>
        <boxGeometry args={[3.85, 0.06, 0.07]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[3.5, 1.4, 1.8]}>
        <boxGeometry args={[3.8, 2.8, 0.05]} />
        <meshStandardMaterial color="#88aacc" transparent opacity={0.08} roughness={0.05} metalness={0.1} />
      </mesh>
      <mesh position={[3.5, 2.85, 1.8]}>
        <boxGeometry args={[3.85, 0.06, 0.07]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.4, 1.8]}>
        <boxGeometry args={[0.08, 2.85, 0.08]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>
      {([-5.45, -1.55, 1.55, 5.45] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 1.4, 1.8]}>
          <boxGeometry args={[0.07, 2.85, 0.07]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
    </group>
  )
}

function DecorFurniture() {
  return (
    <Suspense fallback={null}>
      {/* Lounge area */}
      <FurnitureModel path="/office-assets/models/furniture/loungeSofa.glb" position={[-10, 0, -5.5]} rotation={[0, Math.PI / 4, 0]} scale={1.2} />
      <FurnitureModel path="/office-assets/models/furniture/tableCoffee.glb" position={[-8, 0, -4.5]} scale={1} />
      <FurnitureModel path="/office-assets/models/furniture/loungeDesignChair.glb" position={[-9.5, 0, -3.5]} rotation={[0, Math.PI / 3, 0]} scale={1} />

      {/* Plants */}
      <FurnitureModel path="/office-assets/models/furniture/plantSmall1.glb" position={[-13.5, 0, 4]} scale={1.5} />
      <FurnitureModel path="/office-assets/models/furniture/pottedPlant.glb" position={[13.5, 0, -6.5]} scale={1.5} />
      <FurnitureModel path="/office-assets/models/furniture/plantSmall1.glb" position={[13.5, 0, 4]} scale={1.3} />

      {/* Lamp */}
      <FurnitureModel path="/office-assets/models/furniture/lampRoundFloor.glb" position={[-11, 0, -7]} scale={1.2} />
      <pointLight position={[-11, 2.5, -7]} color="#ffeecc" intensity={0.5} distance={5} decay={2} />

      {/* Bookcase */}
      <FurnitureModel path="/office-assets/models/furniture/bookcaseClosed.glb" position={[13.5, 0, -7]} scale={1.2} />

      {/* Kitchen corner */}
      <FurnitureModel path="/office-assets/models/furniture/kitchenCoffeeMachine.glb" position={[11, 0, 5.5]} scale={1} />
      <FurnitureModel path="/office-assets/models/furniture/kitchenFridgeSmall.glb" position={[12.5, 0, 5.5]} scale={1} />
      <FurnitureModel path="/office-assets/models/furniture/kitchenCabinet.glb" position={[13, 0, 4]} scale={1} />

      {/* Meeting table */}
      <FurnitureModel path="/office-assets/models/furniture/tableRound.glb" position={[-10, 0, 1]} scale={1.2} />
      <FurnitureModel path="/office-assets/models/furniture/chairModernCushion.glb" position={[-11.3, 0, 1]} rotation={[0, Math.PI / 2, 0]} scale={1} />
      <FurnitureModel path="/office-assets/models/furniture/chairModernCushion.glb" position={[-8.7, 0, 1]} rotation={[0, -Math.PI / 2, 0]} scale={1} />
      <FurnitureModel path="/office-assets/models/furniture/chairModernCushion.glb" position={[-10, 0, -0.3]} rotation={[0, 0, 0]} scale={1} />
      <FurnitureModel path="/office-assets/models/furniture/chairModernCushion.glb" position={[-10, 0, 2.3]} rotation={[0, Math.PI, 0]} scale={1} />
      <pointLight position={[-10, 2.5, 1]} color="#D4A853" intensity={0.4} distance={4} decay={2} />
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
      <GlassPartition />
      <DecorFurniture />
      <TaskBoard3D />
      <Stars radius={90} depth={50} count={600} factor={2.5} saturation={0} fade speed={0.25} />

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
        <planeGeometry args={[32, 26]} />
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
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      style={{ background: '#060608' }}
      camera={{ position: [0, 9, 14], fov: 52, near: 0.1, far: 200 }}
    >
      <OrbitControls
        makeDefault
        target={[0, 0.5, -1]}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={24}
        enablePan={true}
        panSpeed={0.5}
        rotateSpeed={0.45}
        zoomSpeed={0.75}
        dampingFactor={0.07}
        enableDamping
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
useGLTF.preload('/office-assets/models/furniture/kitchenCoffeeMachine.glb')
useGLTF.preload('/office-assets/models/furniture/kitchenFridgeSmall.glb')
useGLTF.preload('/office-assets/models/furniture/kitchenCabinet.glb')
useGLTF.preload('/office-assets/models/furniture/loungeDesignChair.glb')
useGLTF.preload('/office-assets/models/furniture/tableRound.glb')
useGLTF.preload('/office-assets/models/furniture/chairModernCushion.glb')
