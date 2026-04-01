"use client"

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { AgentAvatar } from './AgentAvatar'
import type { Agent } from '@/lib/agents'

interface AgentDeskProps {
  agent: Agent
  selected: boolean
  onSelect: () => void
}

export function AgentDesk({ agent, selected, onSelect }: AgentDeskProps) {
  const monitorGlowRef = useRef<THREE.Mesh>(null)
  const deskRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const time = useRef(Math.random() * Math.PI * 2)

  const px = agent.position.x
  const pz = agent.position.z

  useFrame((_, delta) => {
    time.current += delta
    if (monitorGlowRef.current) {
      const mat = monitorGlowRef.current.material as THREE.MeshStandardMaterial
      if (agent.status === 'active') {
        mat.emissiveIntensity = 0.4 + Math.sin(time.current * 2) * 0.2
      } else if (agent.status === 'thinking') {
        mat.emissiveIntensity = 0.3 + Math.sin(time.current * 4) * 0.15
      } else {
        mat.emissiveIntensity = 0.05
      }
    }
  })

  const statusColor =
    agent.status === 'active' ? '#4ADE80' :
    agent.status === 'thinking' ? '#D4A853' :
    '#4B5563'

  return (
    <group
      ref={deskRef}
      position={[px, 0, pz]}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Desk surface */}
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.06, 0.85]} />
        <meshStandardMaterial
          color={selected || hovered ? '#2a2218' : '#1a1510'}
          roughness={0.4}
          metalness={0.3}
          emissive={selected ? agent.color : '#000000'}
          emissiveIntensity={selected ? 0.04 : 0}
        />
      </mesh>

      {/* Desk legs */}
      {[[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.15, lz]} castShadow>
          <boxGeometry args={[0.06, 0.3, 0.06]} />
          <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Monitor base */}
      <mesh position={[0, 0.42, -0.22]}>
        <boxGeometry args={[0.12, 0.04, 0.12]} />
        <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Monitor stand */}
      <mesh position={[0, 0.55, -0.22]}>
        <boxGeometry args={[0.04, 0.22, 0.04]} />
        <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Monitor screen */}
      <mesh ref={monitorGlowRef} position={[0, 0.72, -0.22]}>
        <boxGeometry args={[0.72, 0.42, 0.04]} />
        <meshStandardMaterial
          color={agent.color}
          emissive={agent.color}
          emissiveIntensity={0.2}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>

      {/* Monitor bezel */}
      <mesh position={[0, 0.72, -0.2]}>
        <boxGeometry args={[0.78, 0.48, 0.02]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Keyboard */}
      <mesh position={[0, 0.42, 0.1]}>
        <boxGeometry args={[0.6, 0.02, 0.22]} />
        <meshStandardMaterial color="#0f0f0f" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Status indicator strip on desk edge */}
      <mesh position={[0, 0.415, 0.425]}>
        <boxGeometry args={[1.2, 0.03, 0.02]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={agent.status === 'active' ? 0.8 : agent.status === 'thinking' ? 0.5 : 0.1}
        />
      </mesh>

      {/* Agent avatar floating above desk */}
      <AgentAvatar
        color={agent.color}
        status={agent.status}
        selected={selected}
        position={[0, 0.95, 0.1]}
      />

      {/* Agent name label */}
      <Text
        position={[0, 1.45, 0.1]}
        fontSize={0.14}
        color={selected ? agent.color : '#e5e7eb'}
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-medium.woff"
        renderOrder={1}
      >
        {agent.name}
      </Text>

      {/* Role label */}
      <Text
        position={[0, 1.28, 0.1]}
        fontSize={0.09}
        color="#6b7280"
        anchorX="center"
        anchorY="middle"
        renderOrder={1}
      >
        {agent.role}
      </Text>

      {/* Current task label */}
      {agent.currentTask && (
        <Text
          position={[0, 1.12, 0.1]}
          fontSize={0.075}
          color={agent.color}
          anchorX="center"
          anchorY="middle"
          maxWidth={1.3}
          renderOrder={1}
        >
          {agent.currentTask}
        </Text>
      )}
    </group>
  )
}
