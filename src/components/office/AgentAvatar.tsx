"use client"

import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface AgentAvatarProps {
  agentId: string
  color: string
  status: 'active' | 'thinking' | 'idle' | 'offline'
  selected: boolean
  position: [number, number, number]
}

// Blocky Minecraft/pixel-art character built entirely from boxes
function BlockyCharacter({
  color,
  status,
  bodyRef,
}: {
  color: string
  status: 'active' | 'thinking' | 'idle' | 'offline'
  bodyRef: RefObject<THREE.Group | null>
}) {
  const skinColor = '#E8C39E'
  const pantsColor = '#2D2D4E'
  const shoeColor = '#1A1A1A'

  return (
    <group ref={bodyRef}>
      {/* HEAD — blocky box */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshLambertMaterial color={skinColor} />
      </mesh>

      {/* Left eye */}
      <mesh position={[-0.1, 0.76, 0.21]}>
        <boxGeometry args={[0.08, 0.07, 0.01]} />
        <meshLambertMaterial color="#2D1A0E" />
      </mesh>
      {/* Right eye */}
      <mesh position={[0.1, 0.76, 0.21]}>
        <boxGeometry args={[0.08, 0.07, 0.01]} />
        <meshLambertMaterial color="#2D1A0E" />
      </mesh>
      {/* Mouth */}
      <mesh position={[0, 0.63, 0.21]}>
        <boxGeometry args={[0.1, 0.03, 0.01]} />
        <meshLambertMaterial color="#A0664E" />
      </mesh>

      {/* TORSO — agent color (like a t-shirt) */}
      <mesh position={[0, 0.375, 0]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.25]} />
        <meshLambertMaterial color={color} />
      </mesh>

      {/* LEFT ARM */}
      <mesh position={[-0.265, 0.375, 0]} castShadow>
        <boxGeometry args={[0.12, 0.45, 0.12]} />
        <meshLambertMaterial color={skinColor} />
      </mesh>

      {/* RIGHT ARM */}
      <mesh position={[0.265, 0.375, 0]} castShadow>
        <boxGeometry args={[0.12, 0.45, 0.12]} />
        <meshLambertMaterial color={skinColor} />
      </mesh>

      {/* LEFT LEG */}
      <mesh position={[-0.1, 0.07, 0]} castShadow>
        <boxGeometry args={[0.14, 0.4, 0.14]} />
        <meshLambertMaterial color={pantsColor} />
      </mesh>

      {/* RIGHT LEG */}
      <mesh position={[0.1, 0.07, 0]} castShadow>
        <boxGeometry args={[0.14, 0.4, 0.14]} />
        <meshLambertMaterial color={pantsColor} />
      </mesh>

      {/* LEFT SHOE */}
      <mesh position={[-0.1, -0.15, 0.02]}>
        <boxGeometry args={[0.16, 0.1, 0.18]} />
        <meshLambertMaterial color={shoeColor} />
      </mesh>
      {/* RIGHT SHOE */}
      <mesh position={[0.1, -0.15, 0.02]}>
        <boxGeometry args={[0.16, 0.1, 0.18]} />
        <meshLambertMaterial color={shoeColor} />
      </mesh>
    </group>
  )
}

export function AgentAvatar({ agentId, color, status, selected, position }: AgentAvatarProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const time = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    time.current += delta

    if (status === 'active') {
      groupRef.current.position.y = Math.sin(time.current * 2.2) * 0.03
      if (bodyRef.current) {
        bodyRef.current.rotation.y = Math.sin(time.current * 0.8) * 0.12
      }
    } else if (status === 'thinking') {
      groupRef.current.position.y = Math.sin(time.current * 3.5) * 0.015
      if (bodyRef.current) {
        bodyRef.current.rotation.x = Math.sin(time.current * 2) * 0.05
      }
    } else {
      groupRef.current.position.y = Math.sin(time.current * 1.2) * 0.01
      if (bodyRef.current) {
        bodyRef.current.rotation.y = 0
        bodyRef.current.rotation.x = 0
      }
    }

    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      if (selected) {
        const s = 1.0 + Math.sin(time.current * 2.5) * 0.12
        ringRef.current.scale.setScalar(s)
        mat.opacity = 0.6 + Math.sin(time.current * 2.5) * 0.2
      } else if (status === 'active') {
        const s = 1.0 + Math.sin(time.current * 1.8) * 0.06
        ringRef.current.scale.setScalar(s)
        mat.opacity = 0.3 + Math.sin(time.current * 1.8) * 0.1
      } else {
        ringRef.current.scale.setScalar(1.0)
        mat.opacity = 0.08
      }
    }
  })

  const statusColor =
    status === 'active' ? '#4ADE80' :
    status === 'thinking' ? '#D4A853' :
    status === 'offline' ? '#6B7280' :
    '#4B5563'

  return (
    <group ref={groupRef} position={position}>
      {/* Ground status ring */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.94, 0]}
      >
        <ringGeometry args={[0.28, 0.38, 32]} />
        <meshBasicMaterial color={selected ? color : statusColor} transparent opacity={0.15} />
      </mesh>

      {/* Blocky character */}
      <BlockyCharacter color={color} status={status} bodyRef={bodyRef} />

      {/* Status pip above head — small box for pixel-art feel */}
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[0.07, 0.07, 0.07]} />
        <meshLambertMaterial color={statusColor} />
      </mesh>
    </group>
  )
}
