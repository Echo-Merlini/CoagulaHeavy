export interface ProjectSettings {
  width: number;
  height: number;
  sampleRate: 44100 | 48000 | 96000 | 192000;
  lowFrequency: number;
  highFrequency: number;
  duration: number;
  amplitude: number;
  noiseEnabled: boolean;
  noiseBandwidth: number;  // 0-100: 0 = narrowband (tonal), 100 = wideband (white noise)
  frequencyScale: 'linear' | 'exponential' | 'bark';
  tempo: number;           // BPM (beats per minute), base 120
  pitch: number;           // Semitone offset (-24 to +24)
}

export interface DrawingTool {
  type: 'brush' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle' | 'spray' | 'select' | 'move' | 'noise' | 'boil';
  size: number;
  color: { r: number; g: number; b: number };
  secondaryColor: { r: number; g: number; b: number }; // Right-click color
  hardness: number;
  filled?: boolean; // For rect and circle - filled or outline only
  noiseAmount?: number; // 0-100 for noise variation
  mixMode?: 'cover' | 'add' | 'multiply' | 'screen' | 'filter'; // Color mixing mode
}

export interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Clipboard {
  imageData: ImageData | null;
  width: number;
  height: number;
}

export interface BrushPreset {
  tool: DrawingTool;
  name: string;
}

export type BrushPresetSlot = 'A' | 'B' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' |
                              'Shift+A' | 'Shift+B' | 'Shift+1' | 'Shift+2' | 'Shift+3' | 'Shift+4' | 'Shift+5' | 'Shift+6' | 'Shift+7' | 'Shift+8';

export interface FilterPreset {
  id: string;
  name: string;
  category: 'bw' | 'color' | 'misc';
  params: FilterParams;
  thumbnail?: string;
}

export interface FilterParams {
  amplitudeCurve: number[];
  frequencyEnvelope: number[];
  panCurve: number[];
  noiseMask?: number[];
}

export interface AudioChannel {
  left: Float32Array;
  right: Float32Array;
}

export interface RenderState {
  isPlaying: boolean;
  isRendering: boolean;
  isLooping: boolean;
  progress: number;
  currentTime: number;
}

export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  selectedTool: DrawingTool;
  imageData: ImageData | null;
}

// Render info for storing with images
export interface RenderInfo {
  id: string;
  timestamp: number;
  name: string;
  settings: ProjectSettings;
  thumbnail: string;  // Base64 data URL (small preview)
  fullImage?: string; // Base64 data URL (full image, optional)
}

// Recent image entry for Image Browser
export interface RecentImage {
  id: string;
  name: string;
  timestamp: number;
  thumbnail: string;
  fullImage: string;
  settings: ProjectSettings;
  category: 'recent' | 'favorites';
}

// Timeline clip for multi-image compositions
export interface TimelineClip {
  id: string;
  name: string;
  imageData: ImageData;
  settings: ProjectSettings;  // Per-clip settings
  duration: number;           // Clip duration in seconds
  order: number;              // Position in timeline
  thumbnail?: string;         // Base64 thumbnail for timeline display
}

// Timeline state for managing multiple clips
export interface TimelineState {
  clips: TimelineClip[];
  activeClipId: string | null;
  totalDuration: number;      // Sum of all clip durations
}
