"use client"

import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Grid, Stars, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { AgentDesk } from './AgentDesk'
import { TaskBoard3D } from './TaskBoard3D'
import { useAgentStore } from '@/lib/agent-store'

function OfficeLighting() {
  return (
    <>
      {/* Warm ambient base */}
      <ambientLight intensity={0.18} color="#1a1410" />

      {/* Main overhead — warm white */}
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

      {/* Amber fill from center — Operations' desk zone (z=3) */}
      <pointLight position={[0, 2.5, 3.5]} intensity={1.0} color="#D4A853" distance={10} decay={2} />

      {/* Cool blue counter-fills from wall edges */}
      <pointLight position={[-12, 3.5, -4]} intensity={0.4} color="#1e3860" distance={16} decay={2} />
      <pointLight position={[12, 3.5, -4]} intensity={0.4} color="#1e3860" distance={16} decay={2} />

      {/* Ceiling strip fill */}
      <pointLight position={[0, 5.5, -2]} intensity={0.3} color="#ffeecc" distance={20} decay={1.5} />
    </>
  )
}

function OfficeFloor() {
  return (
    <group>
      {/* Main dark concrete floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[32, 26]} />
        <meshStandardMaterial
          color="#0c0c0c"
          roughness={0.75}
          metalness={0.25}
        />
      </mesh>

      {/* Tile grid overlay */}
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

      {/* Amber centerline accent strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <planeGeometry args={[0.05, 20]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.4} transparent opacity={0.45} />
      </mesh>

      {/* Cross strip */}
      <mesh rotation={[-Math.PI / 2, Math.PI / 2, 0]} position={[0, 0.003, -2]}>
        <planeGeometry args={[0.05, 20]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.2} transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

function OfficeWalls() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 3, -9]} receiveShadow>
        <boxGeometry args={[32, 6, 0.2]} />
        <meshStandardMaterial color="#080808" roughness={0.92} />
      </mesh>

      {/* Back wall accent panels */}
      {([-10, -4, 4, 10] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 2.8, -8.88]}>
          <boxGeometry args={[4.5, 4, 0.04]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.7} metalness={0.35} />
        </mesh>
      ))}

      {/* Side walls */}
      <mesh position={[-16, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[26, 6, 0.2]} />
        <meshStandardMaterial color="#080808" roughness={0.92} />
      </mesh>
      <mesh position={[16, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[26, 6, 0.2]} />
        <meshStandardMaterial color="#080808" roughness={0.92} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[32, 26]} />
        <meshStandardMaterial color="#050505" roughness={1} />
      </mesh>

      {/* Ceiling amber light strips (emissive bars) */}
      <mesh position={[0, 5.96, -1]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.35, 18]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.55} transparent opacity={0.55} />
      </mesh>
      <mesh position={[-5, 5.96, -2]} rotation={[Math.PI / 2, Math.PI / 2, 0]}>
        <planeGeometry args={[0.2, 10]} />
        <meshStandardMaterial color="#ffeecc" emissive="#ffeecc" emissiveIntensity={0.3} transparent opacity={0.3} />
      </mesh>
      <mesh position={[5, 5.96, -2]} rotation={[Math.PI / 2, Math.PI / 2, 0]}>
        <planeGeometry args={[0.2, 10]} />
        <meshStandardMaterial color="#ffeecc" emissive="#ffeecc" emissiveIntensity={0.3} transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

function GlassPartition() {
  return (
    <group>
      {/* Main glass partition between Operations (front, z=3) and back desks (z=0.5) */}
      {/* Left pane */}
      <mesh position={[-3.5, 1.4, 1.8]}>
        <boxGeometry args={[3.8, 2.8, 0.05]} />
        <meshStandardMaterial
          color="#88aacc"
          transparent
          opacity={0.08}
          roughness={0.05}
          metalness={0.1}
        />
      </mesh>
      {/* Left frame top */}
      <mesh position={[-3.5, 2.85, 1.8]}>
        <boxGeometry args={[3.85, 0.06, 0.07]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Left frame bottom */}
      <mesh position={[-3.5, 0.0, 1.8]}>
        <boxGeometry args={[3.85, 0.06, 0.07]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Right pane */}
      <mesh position={[3.5, 1.4, 1.8]}>
        <boxGeometry args={[3.8, 2.8, 0.05]} />
        <meshStandardMaterial
          color="#88aacc"
          transparent
          opacity={0.08}
          roughness={0.05}
          metalness={0.1}
        />
      </mesh>
      {/* Right frame top */}
      <mesh position={[3.5, 2.85, 1.8]}>
        <boxGeometry args={[3.85, 0.06, 0.07]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Center gap post */}
      <mesh position={[0, 1.4, 1.8]}>
        <boxGeometry args={[0.08, 2.85, 0.08]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Side posts */}
      {([-5.45, -1.55, 1.55, 5.45] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 1.4, 1.8]}>
          <boxGeometry args={[0.07, 2.85, 0.07]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
    </group>
  )
}

function MeetingArea() {
  return (
    <group position={[-10, 0, 1]}>
      {/* Meeting table top */}
      <mesh position={[0, 0.42, 0]} receiveShadow>
        <boxGeometry args={[2.8, 0.07, 1.4]} />
        <meshStandardMaterial color="#181210" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Table legs */}
      {([[-1.25, -0.58], [1.25, -0.58], [-1.25, 0.58], [1.25, 0.58]] as [number, number][]).map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.18, lz]}>
          <boxGeometry args={[0.06, 0.36, 0.06]} />
          <meshStandardMaterial color="#0f0f0f" metalness={0.85} roughness={0.15} />
        </mesh>
      ))}
      {/* Decorative chairs around table (simplified blocks) */}
      {([[-1.4, 0], [1.4, 0], [0, -0.8], [0, 0.8]] as [number, number][]).map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0.26, cz]}>
          <boxGeometry args={[0.42, 0.05, 0.4]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      ))}
      {/* Small accent light over table */}
      <pointLight position={[0, 2.5, 0]} color="#D4A853" intensity={0.4} distance={4} decay={2} />
    </group>
  )
}

function OfficeDecor() {
  return (
    <group>
      {/* Corner plants */}
      <mesh position={[-14, 0.55, -8]}>
        <cylinderGeometry args={[0.28, 0.32, 0.5, 8]} />
        <meshStandardMaterial color="#1a1008" roughness={1} />
      </mesh>
      <mesh position={[-14, 1.1, -8]}>
        <sphereGeometry args={[0.48, 8, 8]} />
        <meshStandardMaterial color="#0d2010" roughness={1} />
      </mesh>
      <mesh position={[14, 0.55, -8]}>
        <cylinderGeometry args={[0.28, 0.32, 0.5, 8]} />
        <meshStandardMaterial color="#1a1008" roughness={1} />
      </mesh>
      <mesh position={[14, 1.1, -8]}>
        <sphereGeometry args={[0.48, 8, 8]} />
        <meshStandardMaterial color="#0d2010" roughness={1} />
      </mesh>

      {/* Decorative objects on back shelf */}
      {([0, 1, 2, 3, 4] as number[]).map((x, i) => (
        <mesh key={i} position={[x * 1.4 + 4, 0.2, -8.6]}>
          <boxGeometry args={[0.28, 0.28 + i * 0.05, 0.28]} />
          <meshStandardMaterial
            color="#111111"
            metalness={0.7}
            roughness={0.3}
            emissive="#D4A853"
            emissiveIntensity={0.015}
          />
        </mesh>
      ))}

      {/* OutlanderOS logo text (simple glowing plane on back wall) */}
      <mesh position={[0, 4.2, -8.85]}>
        <boxGeometry args={[3.5, 0.6, 0.03]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.15} roughness={0.5} />
      </mesh>
    </group>
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
      <MeetingArea />
      <OfficeDecor />
      <TaskBoard3D />
      <Stars radius={90} depth={50} count={600} factor={2.5} saturation={0} fade speed={0.25} />

      {agents.map((agent) => (
        <AgentDesk
          key={agent.id}
          agent={agent}
          selected={selectedAgentId === agent.id}
          active={activeAgentId === agent.id}
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
  selectedAgentId: string | null
  onSelectAgent: (id: string | null) => void
}

export default function OfficeScene({ selectedAgentId, onSelectAgent }: OfficeSceneProps) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      style={{ background: '#060608' }}
    >
      <PerspectiveCamera makeDefault position={[0, 9, 14]} fov={52} near={0.1} far={200} />
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
      <SceneContent />
    </Canvas>
  )
}
