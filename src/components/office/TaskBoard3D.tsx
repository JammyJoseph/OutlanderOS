"use client"

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

const TASKS = {
  todo: ['Review Q2 plan', 'Update client list'],
  inProgress: ['Q1 invoice audit', 'Shoot schedule Apr'],
  done: ['March report', 'Crew bookings'],
}

interface TaskCard3DProps {
  text: string
  position: [number, number, number]
  color: string
}

function TaskCard3D({ text, position, color }: TaskCard3DProps) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.9, 0.22, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[0.06, 0.22, 0.004]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <Text
        position={[0.06, 0, 0.015]}
        fontSize={0.07}
        color="#d1d5db"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.72}
      >
        {text}
      </Text>
    </group>
  )
}

export function TaskBoard3D() {
  const boardRef = useRef<THREE.Group>(null)
  const time = useRef(0)

  useFrame((_, delta) => {
    time.current += delta
    if (boardRef.current) {
      boardRef.current.position.y = 1.6 + Math.sin(time.current * 0.4) * 0.03
    }
  })

  const columns = [
    { label: 'To Do', tasks: TASKS.todo, color: '#6b7280', x: -1.05 },
    { label: 'In Progress', tasks: TASKS.inProgress, color: '#D4A853', x: 0 },
    { label: 'Done', tasks: TASKS.done, color: '#4ADE80', x: 1.05 },
  ]

  return (
    <group ref={boardRef} position={[-5.5, 1.6, -1]}>
      {/* Board backing */}
      <mesh>
        <boxGeometry args={[3.5, 2.0, 0.05]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Board border */}
      <mesh>
        <boxGeometry args={[3.56, 2.06, 0.03]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Title */}
      <Text
        position={[0, 0.82, 0.04]}
        fontSize={0.13}
        color="#D4A853"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-medium.woff"
      >
        TASK BOARD
      </Text>

      {/* Columns */}
      {columns.map((col) => (
        <group key={col.label} position={[col.x, 0, 0.03]}>
          {/* Column header */}
          <mesh position={[0, 0.62, 0]}>
            <boxGeometry args={[0.92, 0.18, 0.01]} />
            <meshStandardMaterial color={col.color} emissive={col.color} emissiveIntensity={0.2} roughness={0.8} />
          </mesh>
          <Text
            position={[0, 0.62, 0.01]}
            fontSize={0.09}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {col.label}
          </Text>

          {/* Task cards */}
          {col.tasks.map((task, i) => (
            <TaskCard3D
              key={task}
              text={task}
              position={[0, 0.36 - i * 0.28, 0]}
              color={col.color}
            />
          ))}
        </group>
      ))}

      {/* Wall mount bracket */}
      <mesh position={[-1.4, 1.1, -0.04]}>
        <boxGeometry args={[0.08, 0.15, 0.08]} />
        <meshStandardMaterial color="#333333" metalness={0.8} />
      </mesh>
      <mesh position={[1.4, 1.1, -0.04]}>
        <boxGeometry args={[0.08, 0.15, 0.08]} />
        <meshStandardMaterial color="#333333" metalness={0.8} />
      </mesh>
    </group>
  )
}
