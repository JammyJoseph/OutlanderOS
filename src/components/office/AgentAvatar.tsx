"use client"

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface AgentAvatarProps {
  agentId: string
  color: string
  status: 'active' | 'thinking' | 'idle' | 'offline'
  selected: boolean
  position: [number, number, number]
}

function AvatarGeometry({ agentId }: { agentId: string }) {
  switch (agentId) {
    case 'operations':
      return <dodecahedronGeometry args={[0.28, 0]} />
    case 'finance':
      return <octahedronGeometry args={[0.28, 0]} />
    case 'email':
      return <icosahedronGeometry args={[0.28, 0]} />
    case 'production':
      return <coneGeometry args={[0.22, 0.5, 8]} />
    case 'sales':
      return <torusGeometry args={[0.2, 0.1, 8, 20]} />
    case 'content':
      return <torusKnotGeometry args={[0.18, 0.07, 64, 8]} />
    default:
      return <octahedronGeometry args={[0.28, 0]} />
  }
}

export function AgentAvatar({ agentId, color, status, selected, position }: AgentAvatarProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const time = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    time.current += delta

    if (status === 'active') {
      meshRef.current.position.y = Math.sin(time.current * 1.5) * 0.08
      meshRef.current.rotation.y += delta * 0.6
      meshRef.current.rotation.x += delta * 0.2
    } else if (status === 'thinking') {
      meshRef.current.position.y = Math.sin(time.current * 3) * 0.04
      meshRef.current.rotation.y += delta * 1.4
    } else {
      meshRef.current.position.y = 0
      meshRef.current.rotation.y += delta * 0.15
    }

    if (glowRef.current) {
      const scale = selected ? 1.0 + Math.sin(time.current * 2) * 0.1 : 0
      glowRef.current.scale.setScalar(scale)
    }
  })

  const emissiveIntensity = status === 'active' ? 0.7 : status === 'thinking' ? 0.45 : 0.15

  return (
    <group position={position}>
      {/* Glow ring when selected */}
      <mesh ref={glowRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.05, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>

      {/* Main avatar body — shape depends on agent */}
      <mesh ref={meshRef}>
        <AvatarGeometry agentId={agentId} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>

      {/* Status pip */}
      <mesh position={[0.22, 0.22, 0.1]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial
          color={
            status === 'active' ? '#4ADE80' :
            status === 'thinking' ? '#D4A853' :
            status === 'offline' ? '#6B7280' :
            '#4B5563'
          }
          emissive={
            status === 'active' ? '#4ADE80' :
            status === 'thinking' ? '#D4A853' : '#000000'
          }
          emissiveIntensity={status === 'active' || status === 'thinking' ? 1.2 : 0}
        />
      </mesh>
    </group>
  )
}
