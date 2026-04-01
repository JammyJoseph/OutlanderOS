"use client"

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { AgentAvatar } from './AgentAvatar'
import type { Agent } from '@/lib/agents'

interface AgentDeskProps {
  agent: Agent
  selected: boolean
  active: boolean
  onSelect: () => void
}

export function AgentDesk({ agent, selected, active, onSelect }: AgentDeskProps) {
  const monitorGlowRef = useRef<THREE.Mesh>(null)
  const deskRef = useRef<THREE.Group>(null)
  const deskLightRef = useRef<THREE.PointLight>(null)
  const [hovered, setHovered] = useState(false)
  const time = useRef(Math.random() * Math.PI * 2)

  const px = agent.position.x
  const pz = agent.position.z

  useFrame((_, delta) => {
    time.current += delta

    if (monitorGlowRef.current) {
      const mat = monitorGlowRef.current.material as THREE.MeshStandardMaterial
      if (active) {
        mat.emissiveIntensity = 0.6 + Math.sin(time.current * 3) * 0.3
      } else if (agent.status === 'active') {
        mat.emissiveIntensity = 0.4 + Math.sin(time.current * 2) * 0.2
      } else if (agent.status === 'thinking') {
        mat.emissiveIntensity = 0.3 + Math.sin(time.current * 4) * 0.15
      } else {
        mat.emissiveIntensity = 0.05
      }
    }

    if (deskLightRef.current) {
      const baseIntensity = hovered ? 0.9 : selected || active ? 0.7 : 0.25
      deskLightRef.current.intensity = baseIntensity + Math.sin(time.current * 1.5) * 0.05
    }
  })

  const statusColor =
    active ? '#4ADE80' :
    agent.status === 'active' ? '#4ADE80' :
    agent.status === 'thinking' ? '#D4A853' :
    '#4B5563'

  const statusIntensity =
    active ? 1.2 :
    agent.status === 'active' ? 0.8 :
    agent.status === 'thinking' ? 0.5 :
    0.1

  const deskColor = selected || hovered ? '#2a2218' : '#1a1510'
  const deskEmissive = selected ? agent.color : active ? agent.color : '#000000'
  const deskEmissiveIntensity = selected ? 0.04 : active ? 0.06 : 0

  return (
    <group
      ref={deskRef}
      position={[px, 0, pz]}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerEnter={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {/* Per-desk ambient point light in agent color */}
      <pointLight
        ref={deskLightRef}
        position={[0, 1.2, 0]}
        color={agent.color}
        intensity={0.25}
        distance={3.5}
        decay={2}
      />

      {/* === DESK === */}
      {/* Desk surface — dark wood */}
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.06, 0.9]} />
        <meshStandardMaterial
          color={deskColor}
          roughness={0.35}
          metalness={0.25}
          emissive={deskEmissive}
          emissiveIntensity={deskEmissiveIntensity}
        />
      </mesh>

      {/* Desk legs */}
      {([[-0.65, -0.38], [0.65, -0.38], [-0.65, 0.38], [0.65, 0.38]] as [number, number][]).map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.16, lz]} castShadow>
          <boxGeometry args={[0.06, 0.32, 0.06]} />
          <meshStandardMaterial color="#111111" metalness={0.85} roughness={0.15} />
        </mesh>
      ))}

      {/* === MONITOR === */}
      {/* Monitor base */}
      <mesh position={[0, 0.42, -0.26]}>
        <boxGeometry args={[0.14, 0.04, 0.14]} />
        <meshStandardMaterial color="#0d0d0d" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Monitor stand */}
      <mesh position={[0, 0.56, -0.26]}>
        <boxGeometry args={[0.04, 0.24, 0.04]} />
        <meshStandardMaterial color="#0d0d0d" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Monitor bezel */}
      <mesh position={[0, 0.75, -0.25]}>
        <boxGeometry args={[0.82, 0.52, 0.025]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Monitor screen (emissive in agent color) */}
      <mesh ref={monitorGlowRef} position={[0, 0.75, -0.238]}>
        <boxGeometry args={[0.74, 0.44, 0.01]} />
        <meshStandardMaterial
          color={agent.color}
          emissive={agent.color}
          emissiveIntensity={0.2}
          roughness={0.05}
          metalness={0.05}
        />
      </mesh>

      {/* === KEYBOARD === */}
      <mesh position={[0, 0.418, 0.08]}>
        <boxGeometry args={[0.62, 0.018, 0.23]} />
        <meshStandardMaterial color="#0e0e0e" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Mouse */}
      <mesh position={[0.38, 0.418, 0.06]}>
        <boxGeometry args={[0.1, 0.015, 0.14]} />
        <meshStandardMaterial color="#111111" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* === STATUS STRIP === */}
      <mesh position={[0, 0.415, 0.455]}>
        <boxGeometry args={[1.3, 0.028, 0.018]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={statusIntensity}
        />
      </mesh>

      {/* === CHAIR === */}
      {/* Chair seat */}
      <mesh position={[0, 0.28, 0.72]} castShadow>
        <boxGeometry args={[0.55, 0.06, 0.52]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Chair back */}
      <mesh position={[0, 0.58, 0.96]} castShadow>
        <boxGeometry args={[0.52, 0.52, 0.055]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Chair back support */}
      <mesh position={[0, 0.34, 0.96]}>
        <boxGeometry args={[0.04, 0.14, 0.04]} />
        <meshStandardMaterial color="#141414" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Chair legs (5-star base) */}
      {([0, 72, 144, 216, 288] as number[]).map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        return (
          <mesh key={i} position={[Math.cos(rad) * 0.28, 0.08, 0.72 + Math.sin(rad) * 0.28]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.16, 6]} />
            <meshStandardMaterial color="#141414" metalness={0.9} roughness={0.1} />
          </mesh>
        )
      })}
      {/* Center post */}
      <mesh position={[0, 0.18, 0.72]}>
        <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
        <meshStandardMaterial color="#141414" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Armrests */}
      {([-0.3, 0.3] as number[]).map((ax, i) => (
        <mesh key={i} position={[ax, 0.42, 0.72]}>
          <boxGeometry args={[0.04, 0.04, 0.46]} />
          <meshStandardMaterial color="#181818" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* === AGENT AVATAR === */}
      <AgentAvatar
        agentId={agent.id}
        color={agent.color}
        status={active ? 'active' : agent.status}
        selected={selected || active}
        position={[0, 0.95, 0.1]}
      />

      {/* Name label */}
      <Html position={[0, 1.48, 0.1]} center>
        <span style={{
          color: selected || active ? agent.color : '#e5e7eb',
          fontSize: '13px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}>
          {agent.name}
        </span>
      </Html>

      {/* Role label */}
      <Html position={[0, 1.31, 0.1]} center>
        <span style={{ color: '#6b7280', fontSize: '9px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {agent.role}
        </span>
      </Html>

      {/* Current task */}
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
    </group>
  )
}
