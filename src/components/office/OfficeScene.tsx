"use client"

import { useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Grid, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { AgentDesk } from './AgentDesk'
import { TaskBoard3D } from './TaskBoard3D'
import { AGENT_FLEET, type Agent } from '@/lib/agents'

// Ambient office lighting
function OfficeLighting() {
  return (
    <>
      <ambientLight intensity={0.15} color="#1a1a2e" />
      <directionalLight
        position={[0, 8, 0]}
        intensity={0.6}
        color="#fff8e7"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* Amber accent lights */}
      <pointLight position={[0, 3, 0]} intensity={1.2} color="#D4A853" distance={12} decay={2} />
      <pointLight position={[-6, 2, -3]} intensity={0.5} color="#c49040" distance={8} decay={2} />
      <pointLight position={[6, 2, 3]} intensity={0.5} color="#c49040" distance={8} decay={2} />
      {/* Cool blue fill from ceiling edges */}
      <pointLight position={[-8, 4, -6]} intensity={0.3} color="#1e3a5f" distance={14} decay={2} />
      <pointLight position={[8, 4, 6]} intensity={0.3} color="#1e3a5f" distance={14} decay={2} />
    </>
  )
}

// Office floor with grid
function OfficeFloor() {
  return (
    <group>
      {/* Main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[28, 22]} />
        <meshStandardMaterial
          color="#0a0a0a"
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Subtle grid overlay */}
      <Grid
        position={[0, 0, 0]}
        args={[28, 22]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#1a1a1a"
        sectionSize={4}
        sectionThickness={0.8}
        sectionColor="#222222"
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Floor accent strip — amber centerline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[0.04, 18]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.3} transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

// Back wall with logo
function OfficeWalls() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 3, -7]} receiveShadow>
        <boxGeometry args={[28, 6, 0.15]} />
        <meshStandardMaterial color="#080808" roughness={0.9} />
      </mesh>

      {/* Wall accent panels */}
      <mesh position={[-9, 2.5, -6.92]}>
        <boxGeometry args={[6, 3.5, 0.04]} />
        <meshStandardMaterial color="#0f0f0f" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[9, 2.5, -6.92]}>
        <boxGeometry args={[6, 3.5, 0.04]} />
        <meshStandardMaterial color="#0f0f0f" roughness={0.7} metalness={0.3} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[28, 22]} />
        <meshStandardMaterial color="#050505" roughness={1} />
      </mesh>

      {/* Ceiling light strip — amber */}
      <mesh position={[0, 5.98, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.3, 16]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.6} transparent opacity={0.5} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-14, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[22, 6, 0.15]} />
        <meshStandardMaterial color="#080808" roughness={0.9} />
      </mesh>
      <mesh position={[14, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[22, 6, 0.15]} />
        <meshStandardMaterial color="#080808" roughness={0.9} />
      </mesh>
    </group>
  )
}

// Decorative elements
function OfficeDecor() {
  return (
    <group>
      {/* Corner plant (cylinder + sphere approximation) */}
      <mesh position={[-12, 0.6, -6]}>
        <cylinderGeometry args={[0.25, 0.3, 0.5, 8]} />
        <meshStandardMaterial color="#1a1008" roughness={1} />
      </mesh>
      <mesh position={[-12, 1.15, -6]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshStandardMaterial color="#0d2010" roughness={1} />
      </mesh>

      {/* Small decorative cubes on back shelf */}
      {[-2, -1, 0, 1, 2].map((x, i) => (
        <mesh key={i} position={[x * 1.2 + 5, 0.2, -6.5]}>
          <boxGeometry args={[0.3, 0.3 + i * 0.05, 0.3]} />
          <meshStandardMaterial
            color="#111111"
            metalness={0.7}
            roughness={0.3}
            emissive="#D4A853"
            emissiveIntensity={0.02}
          />
        </mesh>
      ))}
    </group>
  )
}

interface SceneContentProps {
  selectedAgentId: string | null
  onSelectAgent: (id: string | null) => void
}

function SceneContent({ selectedAgentId, onSelectAgent }: SceneContentProps) {
  return (
    <>
      <OfficeLighting />
      <OfficeFloor />
      <OfficeWalls />
      <OfficeDecor />
      <TaskBoard3D />
      <Stars radius={80} depth={50} count={800} factor={3} saturation={0} fade speed={0.3} />

      {AGENT_FLEET.map((agent) => (
        <AgentDesk
          key={agent.id}
          agent={agent}
          selected={selectedAgentId === agent.id}
          onSelect={() => onSelectAgent(selectedAgentId === agent.id ? null : agent.id)}
        />
      ))}

      {/* Click on empty to deselect */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        onClick={() => onSelectAgent(null)}
        visible={false}
      >
        <planeGeometry args={[28, 22]} />
        <meshBasicMaterial />
      </mesh>
    </>
  )
}

interface OfficeSceneProps {
  selectedAgentId: string | null
  onSelectAgent: (id: string | null) => void
}

export default function OfficeScene({ selectedAgentId, onSelectAgent }: OfficeSceneProps) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      style={{ background: '#050505' }}
    >
      <PerspectiveCamera makeDefault position={[0, 7, 12]} fov={55} near={0.1} far={200} />
      <OrbitControls
        makeDefault
        target={[0, 0.5, 0]}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={4}
        maxDistance={22}
        enablePan={true}
        panSpeed={0.6}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        dampingFactor={0.08}
        enableDamping
      />
      <SceneContent selectedAgentId={selectedAgentId} onSelectAgent={onSelectAgent} />
    </Canvas>
  )
}
