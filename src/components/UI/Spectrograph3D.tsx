import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { AudioEngine } from '../../engine/AudioEngine';
import { useStore } from '../../store';
import { X, Settings, RotateCcw } from 'lucide-react';

// Types for 3D Spectrograph settings
interface Spectrograph3DSettings {
  colorScheme: 'heat' | 'rainbow' | 'grayscale' | 'plasma' | 'viridis' | 'inferno' | 'cool' | 'neon';
  surfaceMode: 'full' | 'blackout' | 'disabled';
  meshMode: 'wireframe' | 'ridges' | 'disabled';
  surfaceOpacity: number;
  meshOpacity: number;
  showAxes: boolean;
  showLabels: boolean;
  zScale: number;
  timeScale: number;
  freqResolution: number; // Higher = more detail (64, 128, 256, 512)
  heightScale: number;
  smoothing: number;
  peakHold: boolean;
}

const defaultSettings: Spectrograph3DSettings = {
  colorScheme: 'heat',
  surfaceMode: 'full',
  meshMode: 'disabled',
  surfaceOpacity: 0.9,
  meshOpacity: 0.6,
  showAxes: true,
  showLabels: true,
  zScale: 1,
  timeScale: 2,
  freqResolution: 128,
  heightScale: 2,
  smoothing: 0.5,
  peakHold: false,
};

// Enhanced color scheme functions
const getColor = (value: number, scheme: string): THREE.Color => {
  const v = Math.max(0, Math.min(1, value));

  switch (scheme) {
    case 'heat':
      // Black -> Red -> Orange -> Yellow -> White
      if (v < 0.25) return new THREE.Color().setHSL(0, 1, v * 2);
      if (v < 0.5) return new THREE.Color().setHSL(0.05 * ((v - 0.25) / 0.25), 1, 0.5);
      if (v < 0.75) return new THREE.Color().setHSL(0.05 + 0.1 * ((v - 0.5) / 0.25), 1, 0.5 + (v - 0.5) * 0.5);
      return new THREE.Color().setHSL(0.15, 1 - (v - 0.75) * 4, 0.5 + v * 0.5);

    case 'rainbow':
      return new THREE.Color().setHSL((1 - v) * 0.75, 0.95, 0.35 + v * 0.3);

    case 'grayscale':
      return new THREE.Color(v * 0.9, v * 0.9, v * 0.9);

    case 'plasma':
      // Deep purple -> Magenta -> Orange -> Yellow
      const pH = 0.85 - v * 0.55;
      const pS = 0.8 + v * 0.2;
      const pL = 0.15 + v * 0.55;
      return new THREE.Color().setHSL(pH, pS, pL);

    case 'viridis':
      // Dark purple -> Teal -> Green -> Yellow
      const vH = 0.75 - v * 0.55;
      const vS = 0.7 + v * 0.25;
      const vL = 0.15 + v * 0.55;
      return new THREE.Color().setHSL(vH, vS, vL);

    case 'inferno':
      // Black -> Purple -> Red -> Orange -> Yellow
      if (v < 0.33) return new THREE.Color().setHSL(0.8 - v * 0.3, 0.9, v * 1.2);
      if (v < 0.66) return new THREE.Color().setHSL(0.05 - (v - 0.33) * 0.05, 1, 0.4 + (v - 0.33) * 0.6);
      return new THREE.Color().setHSL(0.1 + (v - 0.66) * 0.05, 1, 0.6 + (v - 0.66) * 0.6);

    case 'cool':
      // Cyan -> Blue -> Purple
      return new THREE.Color().setHSL(0.5 + v * 0.3, 0.8, 0.3 + v * 0.4);

    case 'neon':
      // Electric colors
      if (v < 0.33) return new THREE.Color().setHSL(0.3, 1, v * 1.5);
      if (v < 0.66) return new THREE.Color().setHSL(0.55, 1, 0.5);
      return new THREE.Color().setHSL(0.85, 1, 0.4 + (v - 0.66) * 0.9);

    default:
      return new THREE.Color().setHSL(0, 1, v * 0.5);
  }
};

// 3D Mesh component that renders the spectrogram data
interface SpectrogramMeshProps {
  frequencyHistory: Float32Array[];
  peakHistory: Float32Array[];
  settings: Spectrograph3DSettings;
}

const SpectrogramMesh: React.FC<SpectrogramMeshProps> = memo(({ frequencyHistory, peakHistory, settings }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ridgesRef = useRef<THREE.Group>(null);
  const peakMeshRef = useRef<THREE.Mesh>(null);

  const timeSlices = frequencyHistory.length;
  const freqBins = settings.freqResolution;

  // Create and update geometry
  useEffect(() => {
    if (timeSlices < 2 || !meshRef.current) return;

    const width = 4; // X axis (frequency)
    const depth = 4 * settings.zScale; // Z axis (time)

    // Create geometry with subdivisions matching data
    const geometry = new THREE.PlaneGeometry(
      width,
      depth,
      freqBins - 1,
      timeSlices - 1
    );

    // Rotate to lie in XZ plane
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);

    // Get source bin count from data
    const binCount = frequencyHistory[0]?.length || 256;

    for (let t = 0; t < timeSlices; t++) {
      const data = frequencyHistory[t];
      if (!data) continue;

      for (let f = 0; f < freqBins; f++) {
        const vertexIndex = t * freqBins + f;

        // Logarithmic frequency mapping
        const normalizedF = f / freqBins;
        const logIndex = Math.pow(binCount, normalizedF);
        const dataIndex = Math.min(Math.floor(logIndex), binCount - 1);

        const value = data[dataIndex] || 0;

        // Set height (Y) based on amplitude
        positions.setY(vertexIndex, value * settings.heightScale);

        // Set color based on amplitude and color scheme
        const color = getColor(value, settings.colorScheme);
        colors[vertexIndex * 3] = color.r;
        colors[vertexIndex * 3 + 1] = color.g;
        colors[vertexIndex * 3 + 2] = color.b;
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    // Update mesh geometry
    if (meshRef.current.geometry) {
      meshRef.current.geometry.dispose();
    }
    meshRef.current.geometry = geometry;

    // Create ridges (lines along frequency axis only)
    if (ridgesRef.current && settings.meshMode === 'ridges') {
      // Clear previous ridges
      while (ridgesRef.current.children.length > 0) {
        const child = ridgesRef.current.children[0];
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
        ridgesRef.current.remove(child);
      }

      // Create ridge lines for every few time slices
      const ridgeInterval = Math.max(1, Math.floor(timeSlices / 30));
      for (let t = 0; t < timeSlices; t += ridgeInterval) {
        const points: THREE.Vector3[] = [];
        const data = frequencyHistory[t];
        if (!data) continue;

        for (let f = 0; f < freqBins; f++) {
          const normalizedF = f / freqBins;
          const logIndex = Math.pow(binCount, normalizedF);
          const dataIndex = Math.min(Math.floor(logIndex), binCount - 1);
          const value = data[dataIndex] || 0;

          const x = (f / freqBins - 0.5) * width;
          const y = value * settings.heightScale;
          const z = (t / timeSlices - 0.5) * depth;

          points.push(new THREE.Vector3(x, y, z));
        }

        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: settings.meshOpacity,
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        ridgesRef.current.add(line);
      }
    }

    // Create peak mesh if peak hold is enabled
    if (peakMeshRef.current && settings.peakHold && peakHistory.length > 0) {
      const peakGeometry = new THREE.PlaneGeometry(width, depth, freqBins - 1, timeSlices - 1);
      peakGeometry.rotateX(-Math.PI / 2);

      const peakPositions = peakGeometry.attributes.position as THREE.BufferAttribute;

      for (let t = 0; t < timeSlices; t++) {
        const data = peakHistory[t];
        if (!data) continue;

        for (let f = 0; f < freqBins; f++) {
          const vertexIndex = t * freqBins + f;
          const normalizedF = f / freqBins;
          const logIndex = Math.pow(binCount, normalizedF);
          const dataIndex = Math.min(Math.floor(logIndex), binCount - 1);
          const value = data[dataIndex] || 0;
          peakPositions.setY(vertexIndex, value * settings.heightScale);
        }
      }

      peakGeometry.attributes.position.needsUpdate = true;

      if (peakMeshRef.current.geometry) {
        peakMeshRef.current.geometry.dispose();
      }
      peakMeshRef.current.geometry = peakGeometry;
    }
  }, [frequencyHistory, peakHistory, settings, timeSlices, freqBins]);

  const surfaceVisible = settings.surfaceMode !== 'disabled';
  const showWireframe = settings.meshMode === 'wireframe';
  const showRidges = settings.meshMode === 'ridges';

  return (
    <group position={[0, 0, 0]} scale={[-1, 1, 1]}>
      {/* Main surface mesh */}
      {surfaceVisible && (
        <mesh ref={meshRef}>
          <planeGeometry args={[4, 4, 3, 3]} />
          <meshStandardMaterial
            vertexColors
            side={THREE.DoubleSide}
            transparent
            opacity={settings.surfaceOpacity}
            wireframe={showWireframe}
            flatShading={false}
          />
        </mesh>
      )}

      {/* Ridges (lines along frequency axis) */}
      {showRidges && <group ref={ridgesRef} />}

      {/* Peak hold mesh */}
      {settings.peakHold && (
        <mesh ref={peakMeshRef}>
          <planeGeometry args={[4, 4, 3, 3]} />
          <meshBasicMaterial
            color={0xff0000}
            transparent
            opacity={0.3}
            wireframe
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
});

// Axis labels component
interface AxisLabelsProps {
  visible: boolean;
  showLabels: boolean;
  zScale: number;
  lowFreq: number;
  highFreq: number;
}

const AxisLabels: React.FC<AxisLabelsProps> = ({ visible, showLabels, zScale, lowFreq, highFreq }) => {
  if (!visible) return null;

  return (
    <group>
      {/* Grid on floor */}
      <gridHelper args={[4, 20, 0x333333, 0x1a1a1a]} position={[0, -0.01, 0]} />

      {/* Axes lines */}
      <group>
        {/* X axis (frequency) - Red */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([-2.2, 0, -2 * zScale, 2.2, 0, -2 * zScale])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={0xff4444} linewidth={2} />
        </line>

        {/* Z axis (time) - Blue */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([-2, 0, -2.2 * zScale, -2, 0, 2.2 * zScale])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={0x4444ff} linewidth={2} />
        </line>

        {/* Y axis (amplitude) - Green */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([-2, 0, -2 * zScale, -2, 2.5, -2 * zScale])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={0x44ff44} linewidth={2} />
        </line>
      </group>

      {/* Labels */}
      {showLabels && (
        <group>
          <Text
            position={[0, 0.1, -2.3 * zScale]}
            fontSize={0.15}
            color="#ff6666"
            anchorX="center"
          >
            Frequency ({lowFreq}Hz - {highFreq}Hz)
          </Text>
          <Text
            position={[-2.3, 0.1, 0]}
            fontSize={0.15}
            color="#6666ff"
            anchorX="center"
            rotation={[0, Math.PI / 2, 0]}
          >
            Time
          </Text>
          <Text
            position={[-2.3, 1.3, -2 * zScale]}
            fontSize={0.15}
            color="#66ff66"
            anchorX="center"
            rotation={[0, Math.PI / 2, 0]}
          >
            Amplitude
          </Text>
        </group>
      )}
    </group>
  );
};

// Camera controller component
interface CameraControllerProps {
  preset: string | null;
  onPresetApplied: () => void;
}

const CameraController: React.FC<CameraControllerProps> = ({ preset, onPresetApplied }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (!preset) return;

    switch (preset) {
      case 'perspective':
        camera.position.set(4, 3, 4);
        break;
      case 'top':
        camera.position.set(0, 6, 0.01);
        break;
      case 'front':
        camera.position.set(0, 1.5, 6);
        break;
      case 'side':
        camera.position.set(6, 1.5, 0);
        break;
    }
    camera.lookAt(0, 0, 0);
    onPresetApplied();
  }, [preset, camera, onPresetApplied]);

  return null;
};

// Main 3D scene component
interface Scene3DProps {
  frequencyHistory: Float32Array[];
  peakHistory: Float32Array[];
  settings: Spectrograph3DSettings;
  cameraPreset: string | null;
  onCameraPresetApplied: () => void;
  lowFreq: number;
  highFreq: number;
}

const Scene3D: React.FC<Scene3DProps> = ({
  frequencyHistory,
  peakHistory,
  settings,
  cameraPreset,
  onCameraPresetApplied,
  lowFreq,
  highFreq
}) => {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.7} />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} />
      <pointLight position={[0, 5, 0]} intensity={0.3} />

      {/* Camera controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1.5}
        maxDistance={25}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2 - 0.05}
        dampingFactor={0.1}
        enableDamping
      />

      {/* Camera preset controller */}
      <CameraController preset={cameraPreset} onPresetApplied={onCameraPresetApplied} />

      {/* Axes and labels */}
      <AxisLabels
        visible={settings.showAxes}
        showLabels={settings.showLabels}
        zScale={settings.zScale}
        lowFreq={lowFreq}
        highFreq={highFreq}
      />

      {/* Spectrogram mesh */}
      <SpectrogramMesh
        frequencyHistory={frequencyHistory}
        peakHistory={peakHistory}
        settings={settings}
      />
    </>
  );
};

// Settings panel component
interface SettingsPanelProps {
  settings: Spectrograph3DSettings;
  onChange: (settings: Partial<Spectrograph3DSettings>) => void;
  onReset: () => void;
  onCameraPreset: (preset: string) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange, onReset, onCameraPreset }) => {
  return (
    <div className="absolute top-12 right-2 bg-surface/95 border border-white/20 rounded-lg p-3 w-64 text-xs space-y-3 z-10 max-h-[calc(100%-100px)] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="font-medium text-text">3D Settings</span>
        <button
          onClick={onReset}
          className="p-1 hover:bg-white/10 rounded text-text-dim"
          title="Reset to defaults"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Camera Presets */}
      <div>
        <label className="block text-text-dim mb-1.5">Camera Presets</label>
        <div className="flex gap-1">
          {[
            { id: 'perspective', label: '3D' },
            { id: 'top', label: 'Top' },
            { id: 'front', label: 'Front' },
            { id: 'side', label: 'Side' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => onCameraPreset(p.id)}
              className="flex-1 px-2 py-1 bg-surface-light hover:bg-white/10 rounded border border-white/10 text-text text-[10px]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color Scheme */}
      <div>
        <label className="block text-text-dim mb-1">Color Scheme</label>
        <select
          value={settings.colorScheme}
          onChange={(e) => onChange({ colorScheme: e.target.value as any })}
          className="w-full px-2 py-1 bg-surface-light rounded border border-white/10 text-text"
        >
          <option value="heat">Heat (Black-Red-Yellow)</option>
          <option value="inferno">Inferno (Purple-Red-Yellow)</option>
          <option value="plasma">Plasma (Purple-Pink-Orange)</option>
          <option value="viridis">Viridis (Purple-Teal-Yellow)</option>
          <option value="rainbow">Rainbow</option>
          <option value="cool">Cool (Cyan-Blue-Purple)</option>
          <option value="neon">Neon (Electric)</option>
          <option value="grayscale">Grayscale</option>
        </select>
      </div>

      {/* Surface Mode */}
      <div>
        <label className="block text-text-dim mb-1">Surface</label>
        <select
          value={settings.surfaceMode}
          onChange={(e) => onChange({ surfaceMode: e.target.value as any })}
          className="w-full px-2 py-1 bg-surface-light rounded border border-white/10 text-text"
        >
          <option value="full">Full Surface</option>
          <option value="blackout">Blackout (dark base)</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {settings.surfaceMode !== 'disabled' && (
        <div>
          <label className="block text-text-dim mb-1">Surface Opacity: {Math.round(settings.surfaceOpacity * 100)}%</label>
          <input
            type="range"
            min="10"
            max="100"
            value={settings.surfaceOpacity * 100}
            onChange={(e) => onChange({ surfaceOpacity: Number(e.target.value) / 100 })}
            className="w-full accent-primary"
          />
        </div>
      )}

      {/* Mesh Mode */}
      <div>
        <label className="block text-text-dim mb-1">Mesh Overlay</label>
        <select
          value={settings.meshMode}
          onChange={(e) => onChange({ meshMode: e.target.value as any })}
          className="w-full px-2 py-1 bg-surface-light rounded border border-white/10 text-text"
        >
          <option value="disabled">Disabled</option>
          <option value="wireframe">Wireframe Net</option>
          <option value="ridges">Frequency Ridges</option>
        </select>
      </div>

      {settings.meshMode !== 'disabled' && (
        <div>
          <label className="block text-text-dim mb-1">Mesh Opacity: {Math.round(settings.meshOpacity * 100)}%</label>
          <input
            type="range"
            min="10"
            max="100"
            value={settings.meshOpacity * 100}
            onChange={(e) => onChange({ meshOpacity: Number(e.target.value) / 100 })}
            className="w-full accent-primary"
          />
        </div>
      )}

      {/* Resolution */}
      <div>
        <label className="block text-text-dim mb-1">Frequency Resolution: {settings.freqResolution} bins</label>
        <select
          value={settings.freqResolution}
          onChange={(e) => onChange({ freqResolution: Number(e.target.value) })}
          className="w-full px-2 py-1 bg-surface-light rounded border border-white/10 text-text"
        >
          <option value={32}>Low (32) - Fast</option>
          <option value={64}>Medium (64)</option>
          <option value={128}>High (128)</option>
          <option value={256}>Very High (256)</option>
          <option value={512}>Ultra (512) - Slow</option>
        </select>
      </div>

      {/* Height Scale */}
      <div>
        <label className="block text-text-dim mb-1">Height Scale: {settings.heightScale.toFixed(1)}x</label>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.1"
          value={settings.heightScale}
          onChange={(e) => onChange({ heightScale: Number(e.target.value) })}
          className="w-full accent-primary"
        />
      </div>

      {/* Z-Scale */}
      <div>
        <label className="block text-text-dim mb-1">Time Stretch (Z): {settings.zScale.toFixed(1)}x</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={settings.zScale}
          onChange={(e) => onChange({ zScale: Number(e.target.value) })}
          className="w-full accent-primary"
        />
      </div>

      {/* Time Scale */}
      <div>
        <label className="block text-text-dim mb-1">Time Window: {settings.timeScale.toFixed(1)}s</label>
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          value={settings.timeScale}
          onChange={(e) => onChange({ timeScale: Number(e.target.value) })}
          className="w-full accent-primary"
        />
      </div>

      {/* Smoothing */}
      <div>
        <label className="block text-text-dim mb-1">Smoothing: {Math.round(settings.smoothing * 100)}%</label>
        <input
          type="range"
          min="0"
          max="95"
          value={settings.smoothing * 100}
          onChange={(e) => onChange({ smoothing: Number(e.target.value) / 100 })}
          className="w-full accent-primary"
        />
      </div>

      {/* Toggles */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showAxes}
            onChange={(e) => onChange({ showAxes: e.target.checked })}
            className="rounded accent-primary"
          />
          <span className="text-text">Show Axes</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showLabels}
            onChange={(e) => onChange({ showLabels: e.target.checked })}
            className="rounded accent-primary"
          />
          <span className="text-text">Show Labels</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.peakHold}
            onChange={(e) => onChange({ peakHold: e.target.checked })}
            className="rounded accent-primary"
          />
          <span className="text-text">Peak Hold</span>
        </label>
      </div>
    </div>
  );
};

// Main component props
interface Spectrograph3DProps {
  audioEngine: AudioEngine | null;
  isOpen: boolean;
  onClose: () => void;
}

export const Spectrograph3D: React.FC<Spectrograph3DProps> = memo(({
  audioEngine,
  isOpen,
  onClose
}) => {
  const [settings, setSettings] = useState<Spectrograph3DSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [frequencyHistory, setFrequencyHistory] = useState<Float32Array[]>([]);
  const [peakHistory, setPeakHistory] = useState<Float32Array[]>([]);
  const [cameraPreset, setCameraPreset] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastDataRef = useRef<Float32Array | null>(null);

  const { render, project } = useStore();
  const { isPlaying } = render;
  const { lowFrequency, highFrequency } = project.settings;

  // Number of time slices: cover exactly effectiveDuration seconds of audio
  // so the 3D time axis matches the canvas width 1:1
  const effectiveDuration = audioEngine?.getEffectiveDuration() ?? 10;
  const maxTimeSlices = useMemo(
    () => Math.max(10, Math.floor(45 * effectiveDuration * settings.timeScale)),
    [effectiveDuration, settings.timeScale]
  );

  // Animation loop to collect frequency data
  useEffect(() => {
    if (!isOpen || !audioEngine || !isPlaying) {
      return;
    }

    let lastTime = 0;
    const frameInterval = 1000 / 45; // 45 FPS for smoother data

    const collectData = (time: number) => {
      if (!isOpen) return;

      // Throttle data collection
      if (time - lastTime >= frameInterval) {
        lastTime = time;

        const frequencyData = audioEngine.getFrequencyData();

        // Apply smoothing
        let smoothedData: Float32Array;
        if (lastDataRef.current && settings.smoothing > 0) {
          smoothedData = new Float32Array(frequencyData.length);
          const alpha = settings.smoothing;
          for (let i = 0; i < frequencyData.length; i++) {
            smoothedData[i] = alpha * lastDataRef.current[i] + (1 - alpha) * (frequencyData[i] / 255);
          }
        } else {
          smoothedData = new Float32Array(frequencyData.length);
          for (let i = 0; i < frequencyData.length; i++) {
            smoothedData[i] = frequencyData[i] / 255;
          }
        }

        lastDataRef.current = smoothedData;

        setFrequencyHistory(prev => {
          const newHistory = [...prev, smoothedData];
          if (newHistory.length > maxTimeSlices) {
            return newHistory.slice(-maxTimeSlices);
          }
          return newHistory;
        });

        // Update peak history
        if (settings.peakHold) {
          setPeakHistory(prev => {
            if (prev.length === 0) {
              return [smoothedData];
            }

            const newPeaks = [...prev];
            const lastPeaks = newPeaks[newPeaks.length - 1] || smoothedData;
            const updatedPeaks = new Float32Array(smoothedData.length);

            for (let i = 0; i < smoothedData.length; i++) {
              updatedPeaks[i] = Math.max(smoothedData[i], lastPeaks[i] * 0.995); // Slow decay
            }

            newPeaks.push(updatedPeaks);
            if (newPeaks.length > maxTimeSlices) {
              return newPeaks.slice(-maxTimeSlices);
            }
            return newPeaks;
          });
        }
      }

      animationRef.current = requestAnimationFrame(collectData);
    };

    animationRef.current = requestAnimationFrame(collectData);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, audioEngine, isPlaying, maxTimeSlices, settings.smoothing, settings.peakHold]);

  // Clear history when closed
  useEffect(() => {
    if (!isOpen) {
      setFrequencyHistory([]);
      setPeakHistory([]);
      lastDataRef.current = null;
    }
  }, [isOpen]);

  const handleSettingsChange = useCallback((newSettings: Partial<Spectrograph3DSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const handleReset = useCallback(() => {
    setSettings(defaultSettings);
    setFrequencyHistory([]);
    setPeakHistory([]);
    lastDataRef.current = null;
  }, []);

  const handleCameraPreset = useCallback((preset: string) => {
    setCameraPreset(preset);
  }, []);

  const handleCameraPresetApplied = useCallback(() => {
    setCameraPreset(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-surface border border-white/20 rounded-lg shadow-2xl w-[950px] h-[750px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-text">3D Spectrograph</h2>
            <span className="text-xs text-text-dim">
              Drag: rotate | Wheel: zoom | Right-drag: pan
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Info */}
            <div className="text-xs text-text-dim mr-2">
              {lowFrequency}-{highFrequency}Hz |
              {settings.freqResolution} bins |
              {frequencyHistory.length}/{maxTimeSlices} frames
            </div>

            {/* Settings toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded transition-colors ${
                showSettings ? 'bg-primary text-white' : 'hover:bg-white/10 text-text-dim'
              }`}
              title="Settings"
            >
              <Settings size={16} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded text-text-dim"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 3D Canvas */}
        <div className="flex-1 relative bg-black">
          <Canvas
            camera={{ position: [4, 3, 4], fov: 50 }}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => {
              gl.setClearColor(new THREE.Color(0x0a0a0f));
            }}
          >
            <Scene3D
              frequencyHistory={frequencyHistory}
              peakHistory={peakHistory}
              settings={settings}
              cameraPreset={cameraPreset}
              onCameraPresetApplied={handleCameraPresetApplied}
              lowFreq={lowFrequency}
              highFreq={highFrequency}
            />
          </Canvas>

          {/* Not playing overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center">
                <p className="text-text-dim text-lg">Press Play to visualize audio in 3D</p>
                <p className="text-text-dim/60 text-sm mt-2">
                  "It is possible to lose significant amounts of time to this type of analysis"
                </p>
              </div>
            </div>
          )}

          {/* Settings panel */}
          {showSettings && (
            <SettingsPanel
              settings={settings}
              onChange={handleSettingsChange}
              onReset={handleReset}
              onCameraPreset={handleCameraPreset}
            />
          )}

          {/* Live indicator */}
          {isPlaying && (
            <div className="absolute top-2 left-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-400">LIVE 3D</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-xs text-text-dim">
          <div className="flex items-center gap-4">
            <span>Color: {settings.colorScheme}</span>
            <span>Surface: {settings.surfaceMode}</span>
            <span>Mesh: {settings.meshMode}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Height: {settings.heightScale}x</span>
            <span>Z-Scale: {settings.zScale}x</span>
            <span>Window: {settings.timeScale}s</span>
            {settings.peakHold && <span className="text-accent">Peak Hold ON</span>}
          </div>
        </div>
      </div>
    </div>
  );
});
