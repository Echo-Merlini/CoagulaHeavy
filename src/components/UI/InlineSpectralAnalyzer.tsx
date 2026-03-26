import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { AudioEngine } from '../../engine/AudioEngine';
import { useStore } from '../../store';
import { X, GripVertical, Settings, RotateCcw } from 'lucide-react';

interface InlineSpectralAnalyzerProps {
  audioEngine: AudioEngine | null;
  onClose: () => void;
}

type ViewMode = 'spectrum' | 'waveform' | 'spectrogram' | 'combined' | '3d';

// 3D Settings interface
interface Settings3D {
  colorScheme: 'heat' | 'rainbow' | 'grayscale' | 'plasma' | 'viridis' | 'inferno' | 'cool' | 'neon';
  surfaceMode: 'full' | 'blackout' | 'disabled';
  meshMode: 'wireframe' | 'ridges' | 'disabled';
  surfaceOpacity: number;
  meshOpacity: number;
  showAxes: boolean;
  showLabels: boolean;
  zScale: number;
  freqResolution: number;
  heightScale: number;
  smoothing: number;
  peakHold: boolean;
  // Isolation settings
  isolationEnabled: boolean;
  // Frequency isolation
  freqIsolateLow: number;   // 0-1, maps to frequency range
  freqIsolateHigh: number;  // 0-1, maps to frequency range
  freqFalloff: number;      // How sharp the freq fade is (0-1)
  // Amplitude isolation
  ampIsolateLow: number;    // 0-1, minimum amplitude threshold
  ampIsolateHigh: number;   // 0-1, maximum amplitude threshold
  ampFalloff: number;       // How sharp the amplitude fade is (0-1)
}

const defaultSettings3D: Settings3D = {
  colorScheme: 'heat',
  surfaceMode: 'full',
  meshMode: 'disabled',
  surfaceOpacity: 0.9,
  meshOpacity: 0.6,
  showAxes: true,
  showLabels: true,
  zScale: 1,
  freqResolution: 64,
  heightScale: 1.5,
  smoothing: 0.3,
  peakHold: false,
  isolationEnabled: false,
  freqIsolateLow: 0.0,
  freqIsolateHigh: 1.0,
  freqFalloff: 0.5,
  ampIsolateLow: 0.0,
  ampIsolateHigh: 1.0,
  ampFalloff: 0.5,
};

// Enhanced color scheme functions
const getColor = (value: number, scheme: string): THREE.Color => {
  const v = Math.max(0, Math.min(1, value));

  switch (scheme) {
    case 'heat':
      if (v < 0.25) return new THREE.Color().setHSL(0, 1, v * 2);
      if (v < 0.5) return new THREE.Color().setHSL(0.05 * ((v - 0.25) / 0.25), 1, 0.5);
      if (v < 0.75) return new THREE.Color().setHSL(0.05 + 0.1 * ((v - 0.5) / 0.25), 1, 0.5 + (v - 0.5) * 0.5);
      return new THREE.Color().setHSL(0.15, 1 - (v - 0.75) * 4, 0.5 + v * 0.5);

    case 'rainbow':
      return new THREE.Color().setHSL((1 - v) * 0.75, 0.95, 0.35 + v * 0.3);

    case 'grayscale':
      return new THREE.Color(v * 0.9, v * 0.9, v * 0.9);

    case 'plasma':
      const pH = 0.85 - v * 0.55;
      const pS = 0.8 + v * 0.2;
      const pL = 0.15 + v * 0.55;
      return new THREE.Color().setHSL(pH, pS, pL);

    case 'viridis':
      const vH = 0.75 - v * 0.55;
      const vS = 0.7 + v * 0.25;
      const vL = 0.15 + v * 0.55;
      return new THREE.Color().setHSL(vH, vS, vL);

    case 'inferno':
      if (v < 0.33) return new THREE.Color().setHSL(0.8 - v * 0.3, 0.9, v * 1.2);
      if (v < 0.66) return new THREE.Color().setHSL(0.05 - (v - 0.33) * 0.05, 1, 0.4 + (v - 0.33) * 0.6);
      return new THREE.Color().setHSL(0.1 + (v - 0.66) * 0.05, 1, 0.6 + (v - 0.66) * 0.6);

    case 'cool':
      return new THREE.Color().setHSL(0.5 + v * 0.3, 0.8, 0.3 + v * 0.4);

    case 'neon':
      if (v < 0.33) return new THREE.Color().setHSL(0.3, 1, v * 1.5);
      if (v < 0.66) return new THREE.Color().setHSL(0.55, 1, 0.5);
      return new THREE.Color().setHSL(0.85, 1, 0.4 + (v - 0.66) * 0.9);

    default:
      return new THREE.Color().setHSL(0, 1, v * 0.5);
  }
};

// Apply isolation (frequency and amplitude) to value
const applyIsolation = (
  value: number,
  freqNormalized: number,
  settings: Settings3D
): number => {
  if (!settings.isolationEnabled) return value;

  let result = value;

  // Frequency isolation
  const { freqIsolateLow, freqIsolateHigh, freqFalloff } = settings;
  if (freqNormalized < freqIsolateLow || freqNormalized > freqIsolateHigh) {
    let distance = 0;
    if (freqNormalized < freqIsolateLow) {
      distance = freqIsolateLow - freqNormalized;
    } else {
      distance = freqNormalized - freqIsolateHigh;
    }
    const falloffStrength = 1 + freqFalloff * 10;
    const fade = Math.max(0, 1 - distance * falloffStrength);
    result *= fade;
  }

  // Amplitude isolation
  const { ampIsolateLow, ampIsolateHigh, ampFalloff } = settings;
  if (value < ampIsolateLow || value > ampIsolateHigh) {
    let distance = 0;
    if (value < ampIsolateLow) {
      distance = ampIsolateLow - value;
    } else {
      distance = value - ampIsolateHigh;
    }
    const falloffStrength = 1 + ampFalloff * 10;
    const fade = Math.max(0, 1 - distance * falloffStrength);
    result *= fade;
  }

  return result;
};

// 3D Mesh component with full settings
interface Inline3DMeshProps {
  frequencyHistory: Float32Array[];
  peakHistory: Float32Array[];
  settings: Settings3D;
}

const Inline3DMesh: React.FC<Inline3DMeshProps> = memo(({ frequencyHistory, peakHistory, settings }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ridgesRef = useRef<THREE.Group>(null);
  const peakMeshRef = useRef<THREE.Mesh>(null);

  const timeSlices = frequencyHistory.length;
  const freqBins = settings.freqResolution;

  useEffect(() => {
    if (timeSlices < 2 || !meshRef.current) return;

    const width = 3;
    const depth = 3 * settings.zScale;

    const geometry = new THREE.PlaneGeometry(width, depth, freqBins - 1, timeSlices - 1);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);

    const binCount = frequencyHistory[0]?.length || 256;

    for (let t = 0; t < timeSlices; t++) {
      const data = frequencyHistory[t];
      if (!data) continue;

      for (let f = 0; f < freqBins; f++) {
        const vertexIndex = t * freqBins + f;
        const normalizedF = f / freqBins;
        const logIndex = Math.pow(binCount, normalizedF);
        const dataIndex = Math.min(Math.floor(logIndex), binCount - 1);
        let value = data[dataIndex] || 0;

        // Apply depth fade
        value = applyIsolation(value, normalizedF, settings);

        positions.setY(vertexIndex, value * settings.heightScale);

        const color = getColor(value, settings.colorScheme);
        colors[vertexIndex * 3] = color.r;
        colors[vertexIndex * 3 + 1] = color.g;
        colors[vertexIndex * 3 + 2] = color.b;
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    if (meshRef.current.geometry) {
      meshRef.current.geometry.dispose();
    }
    meshRef.current.geometry = geometry;

    // Create ridges
    if (ridgesRef.current && settings.meshMode === 'ridges') {
      while (ridgesRef.current.children.length > 0) {
        const child = ridgesRef.current.children[0];
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
        ridgesRef.current.remove(child);
      }

      const ridgeInterval = Math.max(1, Math.floor(timeSlices / 20));
      for (let t = 0; t < timeSlices; t += ridgeInterval) {
        const points: THREE.Vector3[] = [];
        const data = frequencyHistory[t];
        if (!data) continue;

        for (let f = 0; f < freqBins; f++) {
          const normalizedF = f / freqBins;
          const logIndex = Math.pow(binCount, normalizedF);
          const dataIndex = Math.min(Math.floor(logIndex), binCount - 1);
          let value = data[dataIndex] || 0;
          value = applyIsolation(value, normalizedF, settings);

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

    // Peak mesh
    if (peakMeshRef.current && settings.peakHold && peakHistory.length > 0) {
      const peakGeometry = new THREE.PlaneGeometry(width, depth, freqBins - 1, timeSlices - 1);
      peakGeometry.rotateX(-Math.PI / 2);

      const peakPositions = peakGeometry.attributes.position as THREE.BufferAttribute;

      for (let t = 0; t < timeSlices && t < peakHistory.length; t++) {
        const data = peakHistory[t];
        if (!data) continue;

        for (let f = 0; f < freqBins; f++) {
          const vertexIndex = t * freqBins + f;
          const normalizedF = f / freqBins;
          const logIndex = Math.pow(binCount, normalizedF);
          const dataIndex = Math.min(Math.floor(logIndex), binCount - 1);
          let value = data[dataIndex] || 0;
          value = applyIsolation(value, normalizedF, settings);
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
    <group scale={[-1, 1, 1]}>
      {surfaceVisible && (
        <mesh ref={meshRef}>
          <planeGeometry args={[3, 3, 3, 3]} />
          <meshStandardMaterial
            vertexColors
            side={THREE.DoubleSide}
            transparent
            opacity={settings.surfaceOpacity}
            wireframe={showWireframe}
          />
        </mesh>
      )}

      {showRidges && <group ref={ridgesRef} />}

      {settings.peakHold && (
        <mesh ref={peakMeshRef}>
          <planeGeometry args={[3, 3, 3, 3]} />
          <meshBasicMaterial
            color={0xff0000}
            transparent
            opacity={0.3}
            wireframe
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {settings.showAxes && (
        <gridHelper args={[3, 15, 0x333333, 0x1a1a1a]} position={[0, -0.01, 0]} />
      )}
    </group>
  );
});
Inline3DMesh.displayName = 'Inline3DMesh';

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
    <group scale={[-1, 1, 1]}>
      {showLabels && (
        <group>
          <Text
            position={[0, 0.1, -1.7 * zScale]}
            fontSize={0.12}
            color="#ff6666"
            anchorX="center"
          >
            Freq ({lowFreq}-{highFreq}Hz)
          </Text>
          <Text
            position={[-1.7, 0.1, 0]}
            fontSize={0.12}
            color="#6666ff"
            anchorX="center"
            rotation={[0, Math.PI / 2, 0]}
          >
            Time
          </Text>
        </group>
      )}
    </group>
  );
};

// Camera controller
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
        camera.position.set(3, 2, 3);
        break;
      case 'top':
        camera.position.set(0, 4, 0.01);
        break;
      case 'front':
        camera.position.set(0, 1, 4);
        break;
      case 'side':
        camera.position.set(4, 1, 0);
        break;
    }
    camera.lookAt(0, 0, 0);
    onPresetApplied();
  }, [preset, camera, onPresetApplied]);

  return null;
};

// Settings panel component
interface SettingsPanelProps {
  settings: Settings3D;
  onChange: (settings: Partial<Settings3D>) => void;
  onReset: () => void;
  onCameraPreset: (preset: string) => void;
  lowFreq: number;
  highFreq: number;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange, onReset, onCameraPreset, lowFreq, highFreq }) => {
  // Calculate actual frequencies for isolation display
  const fadeRange = highFreq - lowFreq;
  const freqLowHz = Math.round(lowFreq + settings.freqIsolateLow * fadeRange);
  const freqHighHz = Math.round(lowFreq + settings.freqIsolateHigh * fadeRange);

  return (
    <div className="absolute top-0 right-0 bg-surface/95 border-l border-white/20 p-2 w-52 text-[10px] space-y-2 overflow-y-auto max-h-full z-10">
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <span className="font-medium text-text">3D Settings</span>
        <button onClick={onReset} className="p-0.5 hover:bg-white/10 rounded text-text-dim" title="Reset">
          <RotateCcw size={10} />
        </button>
      </div>

      {/* Camera Presets */}
      <div>
        <label className="block text-text-dim mb-1">Camera</label>
        <div className="flex gap-0.5">
          {[
            { id: 'perspective', label: '3D' },
            { id: 'top', label: 'Top' },
            { id: 'front', label: 'Front' },
            { id: 'side', label: 'Side' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => onCameraPreset(p.id)}
              className="flex-1 px-1 py-0.5 bg-surface-light hover:bg-white/10 rounded border border-white/10 text-text"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color Scheme */}
      <div>
        <label className="block text-text-dim mb-0.5">Color</label>
        <select
          value={settings.colorScheme}
          onChange={(e) => onChange({ colorScheme: e.target.value as Settings3D['colorScheme'] })}
          className="w-full px-1 py-0.5 bg-surface-light rounded border border-white/10 text-text"
        >
          <option value="heat">Heat</option>
          <option value="inferno">Inferno</option>
          <option value="plasma">Plasma</option>
          <option value="viridis">Viridis</option>
          <option value="rainbow">Rainbow</option>
          <option value="cool">Cool</option>
          <option value="neon">Neon</option>
          <option value="grayscale">Grayscale</option>
        </select>
      </div>

      {/* Surface & Mesh */}
      <div className="grid grid-cols-2 gap-1">
        <div>
          <label className="block text-text-dim mb-0.5">Surface</label>
          <select
            value={settings.surfaceMode}
            onChange={(e) => onChange({ surfaceMode: e.target.value as Settings3D['surfaceMode'] })}
            className="w-full px-1 py-0.5 bg-surface-light rounded border border-white/10 text-text"
          >
            <option value="full">Full</option>
            <option value="blackout">Dark</option>
            <option value="disabled">Off</option>
          </select>
        </div>
        <div>
          <label className="block text-text-dim mb-0.5">Mesh</label>
          <select
            value={settings.meshMode}
            onChange={(e) => onChange({ meshMode: e.target.value as Settings3D['meshMode'] })}
            className="w-full px-1 py-0.5 bg-surface-light rounded border border-white/10 text-text"
          >
            <option value="disabled">Off</option>
            <option value="wireframe">Wire</option>
            <option value="ridges">Ridges</option>
          </select>
        </div>
      </div>

      {/* Opacity sliders */}
      {settings.surfaceMode !== 'disabled' && (
        <div>
          <label className="block text-text-dim">Surface: {Math.round(settings.surfaceOpacity * 100)}%</label>
          <input
            type="range"
            min="10"
            max="100"
            value={settings.surfaceOpacity * 100}
            onChange={(e) => onChange({ surfaceOpacity: Number(e.target.value) / 100 })}
            className="w-full accent-primary h-1"
          />
        </div>
      )}

      {/* Resolution */}
      <div>
        <label className="block text-text-dim">Resolution: {settings.freqResolution}</label>
        <select
          value={settings.freqResolution}
          onChange={(e) => onChange({ freqResolution: Number(e.target.value) })}
          className="w-full px-1 py-0.5 bg-surface-light rounded border border-white/10 text-text"
        >
          <option value={32}>Low (32)</option>
          <option value={64}>Med (64)</option>
          <option value={128}>High (128)</option>
          <option value={256}>Ultra (256)</option>
        </select>
      </div>

      {/* Height & Z Scale */}
      <div className="grid grid-cols-2 gap-1">
        <div>
          <label className="block text-text-dim">Height: {settings.heightScale.toFixed(1)}x</label>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={settings.heightScale}
            onChange={(e) => onChange({ heightScale: Number(e.target.value) })}
            className="w-full accent-primary h-1"
          />
        </div>
        <div>
          <label className="block text-text-dim">Z: {settings.zScale.toFixed(1)}x</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.zScale}
            onChange={(e) => onChange({ zScale: Number(e.target.value) })}
            className="w-full accent-primary h-1"
          />
        </div>
      </div>

      {/* Smoothing */}
      <div>
        <label className="block text-text-dim">Smoothing: {Math.round(settings.smoothing * 100)}%</label>
        <input
          type="range"
          min="0"
          max="90"
          value={settings.smoothing * 100}
          onChange={(e) => onChange({ smoothing: Number(e.target.value) / 100 })}
          className="w-full accent-primary h-1"
        />
      </div>

      {/* Isolation Section */}
      <div className="border-t border-white/10 pt-2 mt-2">
        <label className="flex items-center gap-1.5 cursor-pointer mb-1.5">
          <input
            type="checkbox"
            checked={settings.isolationEnabled}
            onChange={(e) => onChange({ isolationEnabled: e.target.checked })}
            className="rounded accent-primary w-3 h-3"
          />
          <span className="text-text font-medium">Isolation Mode</span>
        </label>

        {settings.isolationEnabled && (
          <div className="space-y-2">
            {/* Frequency Isolation */}
            <div className="space-y-1.5 pl-1 border-l-2 border-accent/50 ml-1">
              <span className="text-text-dim font-medium">Frequency</span>
              <div>
                <label className="block text-text-dim">Low: {freqLowHz}Hz</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.freqIsolateLow * 100}
                  onChange={(e) => {
                    const newLow = Number(e.target.value) / 100;
                    onChange({ freqIsolateLow: Math.min(newLow, settings.freqIsolateHigh - 0.05) });
                  }}
                  className="w-full accent-accent h-1"
                />
              </div>
              <div>
                <label className="block text-text-dim">High: {freqHighHz}Hz</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.freqIsolateHigh * 100}
                  onChange={(e) => {
                    const newHigh = Number(e.target.value) / 100;
                    onChange({ freqIsolateHigh: Math.max(newHigh, settings.freqIsolateLow + 0.05) });
                  }}
                  className="w-full accent-accent h-1"
                />
              </div>
              <div>
                <label className="block text-text-dim">Falloff: {Math.round(settings.freqFalloff * 100)}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.freqFalloff * 100}
                  onChange={(e) => onChange({ freqFalloff: Number(e.target.value) / 100 })}
                  className="w-full accent-accent h-1"
                />
              </div>
            </div>

            {/* Amplitude Isolation */}
            <div className="space-y-1.5 pl-1 border-l-2 border-primary/50 ml-1">
              <span className="text-text-dim font-medium">Amplitude</span>
              <div>
                <label className="block text-text-dim">Min: {Math.round(settings.ampIsolateLow * 100)}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.ampIsolateLow * 100}
                  onChange={(e) => {
                    const newLow = Number(e.target.value) / 100;
                    onChange({ ampIsolateLow: Math.min(newLow, settings.ampIsolateHigh - 0.05) });
                  }}
                  className="w-full accent-primary h-1"
                />
              </div>
              <div>
                <label className="block text-text-dim">Max: {Math.round(settings.ampIsolateHigh * 100)}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.ampIsolateHigh * 100}
                  onChange={(e) => {
                    const newHigh = Number(e.target.value) / 100;
                    onChange({ ampIsolateHigh: Math.max(newHigh, settings.ampIsolateLow + 0.05) });
                  }}
                  className="w-full accent-primary h-1"
                />
              </div>
              <div>
                <label className="block text-text-dim">Falloff: {Math.round(settings.ampFalloff * 100)}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.ampFalloff * 100}
                  onChange={(e) => onChange({ ampFalloff: Number(e.target.value) / 100 })}
                  className="w-full accent-primary h-1"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toggles */}
      <div className="space-y-1 pt-1 border-t border-white/10">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showAxes}
            onChange={(e) => onChange({ showAxes: e.target.checked })}
            className="rounded accent-primary w-3 h-3"
          />
          <span className="text-text">Grid</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showLabels}
            onChange={(e) => onChange({ showLabels: e.target.checked })}
            className="rounded accent-primary w-3 h-3"
          />
          <span className="text-text">Labels</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.peakHold}
            onChange={(e) => onChange({ peakHold: e.target.checked })}
            className="rounded accent-primary w-3 h-3"
          />
          <span className="text-text">Peak Hold</span>
        </label>
      </div>
    </div>
  );
};

export const InlineSpectralAnalyzer: React.FC<InlineSpectralAnalyzerProps> = memo(({
  audioEngine,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [panelWidth, setPanelWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // 3D state
  const [frequencyHistory, setFrequencyHistory] = useState<Float32Array[]>([]);
  const [peakHistory, setPeakHistory] = useState<Float32Array[]>([]);
  const lastDataRef = useRef<Float32Array | null>(null);
  const [settings3D, setSettings3D] = useState<Settings3D>(defaultSettings3D);
  const [showSettings, setShowSettings] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<string | null>(null);

  const { render, project } = useStore();
  const { isPlaying } = render;
  const { settings } = project;

  const maxTimeSlices = useMemo(() => 60, []);

  // Canvas dimensions based on panel width
  const canvasWidth = panelWidth - 20;
  const canvasHeight = 280;

  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = resizeStartX.current - moveEvent.clientX;
      const newWidth = Math.max(280, Math.min(600, resizeStartWidth.current + deltaX));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  // Color gradient for spectrum bars
  const getBarColor = useCallback((value: number, index: number, total: number) => {
    const hue = (index / total) * 240;
    const lightness = 40 + (value / 255) * 30;
    return `hsl(${hue}, 80%, ${lightness}%)`;
  }, []);

  // Draw spectrum analyzer
  const drawSpectrum = useCallback((ctx: CanvasRenderingContext2D, frequencyData: Uint8Array, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gy = y + (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    const binCount = frequencyData.length;
    const logBins = 128;
    const logData = new Uint8Array(logBins);

    for (let i = 0; i < logBins; i++) {
      const logIndex = Math.pow(binCount, i / logBins);
      const index = Math.min(Math.floor(logIndex), binCount - 1);
      logData[i] = frequencyData[index];
    }

    const barWidth = w / logBins;

    for (let i = 0; i < logBins; i++) {
      const value = logData[i];
      const barHeight = (value / 255) * h;
      const bx = x + i * barWidth;
      const by = y + h - barHeight;

      const gradient = ctx.createLinearGradient(bx, y + h, bx, by);
      gradient.addColorStop(0, getBarColor(value, i, logBins));
      gradient.addColorStop(1, `hsla(${(i / logBins) * 240}, 90%, 60%, 0.9)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(bx, by, barWidth - 0.5, barHeight);

      if (value > 220) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(bx, by, barWidth - 0.5, 2);
      }
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    const freqLabels = ['100', '1k', '10k'];
    const sampleRate = audioEngine?.getSampleRate() ?? 48000;
    const nyquist = sampleRate / 2;

    freqLabels.forEach((label) => {
      const freq = parseFloat(label.replace('k', '000'));
      if (freq < nyquist) {
        const fx = x + Math.log(freq / 20) / Math.log(nyquist / 20) * w;
        ctx.fillText(label, fx, y + h - 3);
      }
    });
  }, [audioEngine, getBarColor]);

  // Draw waveform
  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, timeData: Uint8Array, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const sliceWidth = w / timeData.length;
    let px = x;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const py = y + (v * h) / 2;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
      px += sliceWidth;
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }, []);

  // Draw spectrogram
  const drawSpectrogram = useCallback((ctx: CanvasRenderingContext2D, frequencyData: Uint8Array, x: number, y: number, w: number, h: number) => {
    const spectroCanvas = spectrogramCanvasRef.current;
    if (!spectroCanvas) return;

    const spectroCtx = spectroCanvas.getContext('2d');
    if (!spectroCtx) return;

    const imageData = spectroCtx.getImageData(1, 0, spectroCanvas.width - 1, spectroCanvas.height);
    spectroCtx.putImageData(imageData, 0, 0);

    const binCount = frequencyData.length;
    for (let i = 0; i < spectroCanvas.height; i++) {
      const normalizedY = i / spectroCanvas.height;
      const binIndex = Math.floor(Math.pow(binCount, normalizedY));
      const value = frequencyData[Math.min(binIndex, binCount - 1)];

      const intensity = value / 255;
      const hue = 240 - intensity * 240;
      const lightness = intensity * 50;

      spectroCtx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
      spectroCtx.fillRect(spectroCanvas.width - 1, i, 1, 1);
    }

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(x, y, w, h);
    ctx.drawImage(spectroCanvas, x, y, w, h);
  }, []);

  // Draw static state when not playing (for 2D views)
  useEffect(() => {
    if (isPlaying || viewMode === '3d') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press Play to visualize', canvas.width / 2, canvas.height / 2);
  }, [isPlaying, canvasWidth, canvasHeight, viewMode]);

  // Animation loop for 2D views
  useEffect(() => {
    if (!isPlaying || !audioEngine || viewMode === '3d') return;

    const canvas = canvasRef.current;
    const spectroCanvas = spectrogramCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (spectroCanvas) {
      const spectroCtx = spectroCanvas.getContext('2d');
      if (spectroCtx) {
        spectroCtx.fillStyle = '#000';
        spectroCtx.fillRect(0, 0, spectroCanvas.width, spectroCanvas.height);
      }
    }

    const animate = () => {
      if (!audioEngine?.getIsPlaying()) return;

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const frequencyData = audioEngine.getFrequencyData();
      const timeData = audioEngine.getAnalyserData();

      const padding = 6;

      if (viewMode === 'spectrum') {
        drawSpectrum(ctx, frequencyData, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
      } else if (viewMode === 'waveform') {
        drawWaveform(ctx, timeData, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
      } else if (viewMode === 'spectrogram') {
        drawSpectrogram(ctx, frequencyData, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
      } else if (viewMode === 'combined') {
        const h1 = (canvas.height - padding * 3) * 0.4;
        const h2 = (canvas.height - padding * 3) * 0.6;
        const halfWidth = (canvas.width - padding * 3) / 2;

        drawSpectrum(ctx, frequencyData, padding, padding, canvas.width - padding * 2, h1);
        drawWaveform(ctx, timeData, padding, padding * 2 + h1, halfWidth, h2);
        drawSpectrogram(ctx, frequencyData, padding * 2 + halfWidth, padding * 2 + h1, halfWidth, h2);
      }

      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(canvas.width - 12, 12, 4, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, audioEngine, viewMode, drawSpectrum, drawWaveform, drawSpectrogram, canvasWidth, canvasHeight]);

  // Collect data for 3D view
  useEffect(() => {
    if (!isPlaying || !audioEngine || viewMode !== '3d') {
      return;
    }

    let lastTime = 0;
    const frameInterval = 1000 / 30;

    const collectData = (time: number) => {
      if (viewMode !== '3d' || !audioEngine?.getIsPlaying()) return;

      if (time - lastTime >= frameInterval) {
        lastTime = time;

        const frequencyData = audioEngine.getFrequencyData();
        const smoothedData = new Float32Array(frequencyData.length);

        if (lastDataRef.current && settings3D.smoothing > 0) {
          const alpha = settings3D.smoothing;
          for (let i = 0; i < frequencyData.length; i++) {
            smoothedData[i] = alpha * lastDataRef.current[i] + (1 - alpha) * (frequencyData[i] / 255);
          }
        } else {
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
        if (settings3D.peakHold) {
          setPeakHistory(prev => {
            if (prev.length === 0) return [smoothedData];

            const newPeaks = [...prev];
            const lastPeaks = newPeaks[newPeaks.length - 1] || smoothedData;
            const updatedPeaks = new Float32Array(smoothedData.length);

            for (let i = 0; i < smoothedData.length; i++) {
              updatedPeaks[i] = Math.max(smoothedData[i], lastPeaks[i] * 0.995);
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
        animationRef.current = null;
      }
    };
  }, [isPlaying, audioEngine, viewMode, maxTimeSlices, settings3D.smoothing, settings3D.peakHold]);

  // Clear 3D history when switching away
  useEffect(() => {
    if (viewMode !== '3d') {
      setFrequencyHistory([]);
      setPeakHistory([]);
      lastDataRef.current = null;
    }
  }, [viewMode]);

  const handleSettingsChange = useCallback((newSettings: Partial<Settings3D>) => {
    setSettings3D(prev => ({ ...prev, ...newSettings }));
  }, []);

  const handleReset = useCallback(() => {
    setSettings3D(defaultSettings3D);
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

  return (
    <div
      className="flex-shrink-0 border-l border-white/10 bg-surface flex"
      style={{ width: `${panelWidth}px` }}
    >
      {/* Resize handle */}
      <div
        className={`w-2 cursor-ew-resize flex items-center justify-center hover:bg-accent/30 transition-colors ${
          isResizing ? 'bg-accent/50' : 'bg-white/5'
        }`}
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      >
        <GripVertical size={12} className="text-white/30" />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-xs font-medium text-text">Live Analyzer</span>
          <div className="flex items-center gap-1">
            {viewMode === '3d' && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1 rounded transition-colors ${
                  showSettings ? 'bg-primary text-white' : 'text-text-dim hover:text-text hover:bg-white/10'
                }`}
                title="3D Settings"
              >
                <Settings size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-text-dim hover:text-text hover:bg-white/10 rounded transition-colors"
              title="Close (Tab)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* View mode tabs */}
        <div className="flex justify-center gap-1 px-2 py-1.5 border-b border-white/10 bg-surface-dark/50">
          {(['spectrum', 'waveform', 'spectrogram', 'combined', '3d'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                viewMode === mode
                  ? 'bg-primary text-white'
                  : 'bg-surface-light text-text-dim hover:bg-white/10'
              }`}
            >
              {mode === '3d' ? '3D' : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 p-2 bg-surface-dark/30 overflow-hidden relative">
          {viewMode === '3d' ? (
            <div className="w-full h-full rounded border border-white/10 bg-black/50 relative" style={{ minHeight: '300px' }}>
              {!isPlaying ? (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                  Press Play to visualize in 3D
                </div>
              ) : (
                <>
                  <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[5, 10, 5]} intensity={0.7} />
                    <OrbitControls
                      enablePan={true}
                      enableZoom={true}
                      enableRotate={true}
                      minDistance={1.5}
                      maxDistance={10}
                    />
                    <CameraController preset={cameraPreset} onPresetApplied={handleCameraPresetApplied} />
                    <Inline3DMesh
                      frequencyHistory={frequencyHistory}
                      peakHistory={peakHistory}
                      settings={settings3D}
                    />
                    <AxisLabels
                      visible={settings3D.showAxes}
                      showLabels={settings3D.showLabels}
                      zScale={settings3D.zScale}
                      lowFreq={settings.lowFrequency}
                      highFreq={settings.highFrequency}
                    />
                  </Canvas>

                  {/* Live indicator */}
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-red-400">LIVE</span>
                  </div>

                  {/* Isolation indicator */}
                  {settings3D.isolationEnabled && (
                    <div className="absolute bottom-2 left-2 text-[10px] text-accent space-x-2">
                      <span>Freq: {Math.round(settings.lowFrequency + settings3D.freqIsolateLow * (settings.highFrequency - settings.lowFrequency))}-
                      {Math.round(settings.lowFrequency + settings3D.freqIsolateHigh * (settings.highFrequency - settings.lowFrequency))}Hz</span>
                      <span className="text-primary">Amp: {Math.round(settings3D.ampIsolateLow * 100)}-{Math.round(settings3D.ampIsolateHigh * 100)}%</span>
                    </div>
                  )}
                </>
              )}

              {/* Settings panel overlay */}
              {showSettings && isPlaying && (
                <SettingsPanel
                  settings={settings3D}
                  onChange={handleSettingsChange}
                  onReset={handleReset}
                  onCameraPreset={handleCameraPreset}
                  lowFreq={settings.lowFrequency}
                  highFreq={settings.highFrequency}
                />
              )}
            </div>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                className="w-full rounded border border-white/10"
                style={{ height: `${canvasHeight}px` }}
              />
              <canvas
                ref={spectrogramCanvasRef}
                width={200}
                height={100}
                className="hidden"
              />
            </>
          )}
        </div>

        {/* Info footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 text-[10px] text-text-dim">
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Live
              </span>
            ) : (
              'Idle'
            )}
            <span>|</span>
            <span>{settings.lowFrequency}-{settings.highFrequency}Hz</span>
          </div>
          <span className="text-white/30">
            {viewMode === '3d' ? 'Drag: rotate | Wheel: zoom' : 'Drag edge to resize'}
          </span>
        </div>
      </div>
    </div>
  );
});

InlineSpectralAnalyzer.displayName = 'InlineSpectralAnalyzer';
