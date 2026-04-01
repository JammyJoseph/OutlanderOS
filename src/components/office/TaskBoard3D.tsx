"use client"

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
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
        <meshLambertMaterial color="#C8B99A" />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[0.06, 0.22, 0.004]} />
        <meshLambertMaterial color={color} />
      </mesh>
      <Html position={[0.06, 0, 0.015]} center>
        <span style={{
          color: '#3a2e22',
          fontSize: '7px',
          maxWidth: '72px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
          pointerEvents: 'none',
          fontWeight: 600,
        }}>
          {text}
        </span>
      </Html>
    </group>
  )
}

export function TaskBoard3D() {
  const boardRef = useRef<THREE.Group>(null)
  const time = useRef(0)

  useFrame((_, delta) => {
    time.current += delta
    if (boardRef.current) {
      boardRef.current.position.y = 1.4 + Math.sin(time.current * 0.4) * 0.02
    }
  })

  const columns = [
    { label: 'To Do', tasks: TASKS.todo, color: '#9B8B6E', x: -1.05 },
    { label: 'In Progress', tasks: TASKS.inProgress, color: '#D4A853', x: 0 },
    { label: 'Done', tasks: TASKS.done, color: '#4ADE80', x: 1.05 },
  ]

  return (
    // Positioned on the back wall of the isometric room
    // (the wrapper group in SceneContent offsets this to the correct spot)
    <group ref={boardRef} position={[-5.5, 1.4, -1]}>
      {/* Board backing — warm cork board color */}
      <mesh>
        <boxGeometry args={[3.5, 2.0, 0.06]} />
        <meshLambertMaterial color="#C4A878" />
      </mesh>

      {/* Board frame */}
      <mesh>
        <boxGeometry args={[3.6, 2.1, 0.04]} />
        <meshLambertMaterial color="#8B6F4E" />
      </mesh>

      {/* Title */}
      <Html position={[0, 0.82, 0.05]} center>
        <span style={{
          color: '#3a2e22',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          TASK BOARD
        </span>
      </Html>

      {/* Columns */}
      {columns.map((col) => (
        <group key={col.label} position={[col.x, 0, 0.04]}>
          {/* Column header */}
          <mesh position={[0, 0.62, 0]}>
            <boxGeometry args={[0.92, 0.18, 0.02]} />
            <meshLambertMaterial color={col.color} />
          </mesh>
          <Html position={[0, 0.62, 0.015]} center>
            <span style={{
              color: '#fff',
              fontSize: '8px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}>
              {col.label}
            </span>
          </Html>

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

      {/* Mount pins */}
      {([-1.55, 1.55] as number[]).map((px, i) => (
        <mesh key={i} position={[px, 0.88, -0.04]}>
          <boxGeometry args={[0.08, 0.08, 0.1]} />
          <meshLambertMaterial color="#7A6855" />
        </mesh>
      ))}
    </group>
  )
}
