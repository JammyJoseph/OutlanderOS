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

// Humanoid body parts built from geometric primitives
function HumanoidBody({
  color,
  status,
  bodyRef,
}: {
  color: string
  status: 'active' | 'thinking' | 'idle' | 'offline'
  bodyRef: RefObject<THREE.Group | null>
}) {
  const skinColor = '#f5c5a3'
  const pantsColor = '#1a1a2e'
  const shoeColor = '#111111'

  return (
    <group ref={bodyRef}>
      {/* HEAD */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.135, 12, 12]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} metalness={0.0} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.045, 0.75, 0.125]}>
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.045, 0.75, 0.125]}>
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Mouth */}
      <mesh position={[0, 0.695, 0.128]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.055, 0.012, 0.01]} />
        <meshStandardMaterial color="#c0826a" />
      </mesh>

      {/* NECK */}
      <mesh position={[0, 0.565, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.08, 8]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>

      {/* TORSO (t-shirt in agent color) */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[0.28, 0.3, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Collar */}
      <mesh position={[0, 0.525, 0.06]}>
        <boxGeometry args={[0.12, 0.04, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>

      {/* LEFT ARM */}
      <group position={[-0.175, 0.44, 0]} rotation={[0, 0, 0.18]}>
        {/* Upper arm */}
        <mesh position={[0, -0.1, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.04, 0.2, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        {/* Forearm (slight bend) */}
        <mesh position={[-0.02, -0.28, 0.02]} rotation={[0.25, 0, -0.1]} castShadow>
          <cylinderGeometry args={[0.038, 0.034, 0.18, 8]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>
        {/* Hand */}
        <mesh position={[-0.04, -0.4, 0.04]}>
          <sphereGeometry args={[0.038, 6, 6]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>
      </group>

      {/* RIGHT ARM */}
      <group position={[0.175, 0.44, 0]} rotation={[0, 0, -0.18]}>
        {/* Upper arm */}
        <mesh position={[0, -0.1, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.04, 0.2, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        {/* Forearm */}
        <mesh position={[0.02, -0.28, 0.02]} rotation={[0.25, 0, 0.1]} castShadow>
          <cylinderGeometry args={[0.038, 0.034, 0.18, 8]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>
        {/* Hand */}
        <mesh position={[0.04, -0.4, 0.04]}>
          <sphereGeometry args={[0.038, 6, 6]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>
      </group>

      {/* WAIST */}
      <mesh position={[0, 0.215, 0]}>
        <boxGeometry args={[0.265, 0.06, 0.15]} />
        <meshStandardMaterial color={pantsColor} roughness={0.8} />
      </mesh>

      {/* LEFT LEG */}
      <group position={[-0.075, 0, 0]}>
        {/* Thigh */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.058, 0.052, 0.2, 8]} />
          <meshStandardMaterial color={pantsColor} roughness={0.8} />
        </mesh>
        {/* Shin */}
        <mesh position={[0, -0.08, 0.01]} castShadow>
          <cylinderGeometry args={[0.048, 0.042, 0.2, 8]} />
          <meshStandardMaterial color={pantsColor} roughness={0.8} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.21, 0.03]}>
          <boxGeometry args={[0.07, 0.06, 0.12]} />
          <meshStandardMaterial color={shoeColor} roughness={0.6} metalness={0.2} />
        </mesh>
      </group>

      {/* RIGHT LEG */}
      <group position={[0.075, 0, 0]}>
        {/* Thigh */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.058, 0.052, 0.2, 8]} />
          <meshStandardMaterial color={pantsColor} roughness={0.8} />
        </mesh>
        {/* Shin */}
        <mesh position={[0, -0.08, 0.01]} castShadow>
          <cylinderGeometry args={[0.048, 0.042, 0.2, 8]} />
          <meshStandardMaterial color={pantsColor} roughness={0.8} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.21, 0.03]}>
          <boxGeometry args={[0.07, 0.06, 0.12]} />
          <meshStandardMaterial color={shoeColor} roughness={0.6} metalness={0.2} />
        </mesh>
      </group>
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

    // Idle: gentle breathing bob
    // Active: slightly faster + subtle sway
    // Thinking: gentle nod
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
      // Idle breathing
      groupRef.current.position.y = Math.sin(time.current * 1.2) * 0.01
      if (bodyRef.current) {
        bodyRef.current.rotation.y = 0
        bodyRef.current.rotation.x = 0
      }
    }

    // Status ring pulse
    if (ringRef.current) {
      if (selected) {
        const s = 1.0 + Math.sin(time.current * 2.5) * 0.12
        ringRef.current.scale.setScalar(s)
        const mat = ringRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = 0.6 + Math.sin(time.current * 2.5) * 0.2
      } else if (status === 'active') {
        const s = 1.0 + Math.sin(time.current * 1.8) * 0.06
        ringRef.current.scale.setScalar(s)
        const mat = ringRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = 0.25 + Math.sin(time.current * 1.8) * 0.1
      } else if (status === 'thinking') {
        ringRef.current.scale.setScalar(1.0)
        const mat = ringRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = 0.15 + Math.sin(time.current * 3) * 0.08
      } else {
        ringRef.current.scale.setScalar(1.0)
        const mat = ringRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = 0.06
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
        <ringGeometry args={[0.28, 0.36, 32]} />
        <meshBasicMaterial color={selected ? color : statusColor} transparent opacity={0.15} />
      </mesh>

      {/* Humanoid body */}
      <HumanoidBody color={color} status={status} bodyRef={bodyRef} />

      {/* Status pip above head */}
      <mesh position={[0, 0.92, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={status === 'active' || status === 'thinking' ? 1.2 : 0.2}
        />
      </mesh>
    </group>
  )
}
