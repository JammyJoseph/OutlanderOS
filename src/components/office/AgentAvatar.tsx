"use client"

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface AgentAvatarProps {
  color: string
  status: 'active' | 'thinking' | 'idle' | 'offline'
  selected: boolean
  position: [number, number, number]
}

export function AgentAvatar({ color, status, selected, position }: AgentAvatarProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const time = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    time.current += delta

    if (status === 'active') {
      meshRef.current.position.y = Math.sin(time.current * 1.5) * 0.08
      meshRef.current.rotation.y += delta * 0.5
    } else if (status === 'thinking') {
      meshRef.current.position.y = Math.sin(time.current * 3) * 0.04
      meshRef.current.rotation.y += delta * 1.2
    } else {
      meshRef.current.position.y = 0
    }

    if (glowRef.current) {
      const scale = selected ? 1.0 + Math.sin(time.current * 2) * 0.08 : 0
      glowRef.current.scale.setScalar(scale)
    }
  })

  const emissiveIntensity = status === 'active' ? 0.6 : status === 'thinking' ? 0.4 : 0.1

  return (
    <group position={position}>
      {/* Glow ring when selected */}
      <mesh ref={glowRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.04, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>

      {/* Main avatar body — rounded octahedron-like shape */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.2}
          metalness={0.7}
        />
      </mesh>

      {/* Status pip */}
      <mesh position={[0.2, 0.2, 0.1]}>
        <sphereGeometry args={[0.06, 8, 8]} />
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
          emissiveIntensity={status === 'active' || status === 'thinking' ? 1.0 : 0}
        />
      </mesh>
    </group>
  )
}
