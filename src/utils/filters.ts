// Filter generation utilities for Coagula Heavy
// Ports classic Coagula Light filters

export interface FilterDefinition {
  id: string;
  name: string;
  category: 'bw' | 'color' | 'misc';
  description: string;
  generate: (width: number, height: number) => ImageData;
}

// Helper to create ImageData
function createImageData(width: number, height: number): ImageData {
  return new ImageData(width, height);
}

// Helper to set pixel
function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, r: number, g: number, b: number) {
  const idx = (y * width + x) * 4;
  data[idx] = Math.max(0, Math.min(255, r));
  data[idx + 1] = Math.max(0, Math.min(255, g));
  data[idx + 2] = Math.max(0, Math.min(255, b));
  data[idx + 3] = 255;
}

// ============================================
// BW FILTERS (Black & White / Amplitude)
// ============================================

const ampLinear: FilterDefinition = {
  id: 'amp-linear',
  name: 'Amp Linear',
  category: 'bw',
  description: 'Linear amplitude fade from left to right',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = Math.floor((x / width) * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const ampFadeIn: FilterDefinition = {
  id: 'amp-fade-in',
  name: 'Amp Fade In',
  category: 'bw',
  description: 'Smooth fade in from left',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = x / width;
        const v = Math.floor(Math.sin(t * Math.PI / 2) * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const ampFadeOut: FilterDefinition = {
  id: 'amp-fade-out',
  name: 'Amp Fade Out',
  category: 'bw',
  description: 'Smooth fade out to right',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = x / width;
        const v = Math.floor(Math.cos(t * Math.PI / 2) * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const ampEnvelope: FilterDefinition = {
  id: 'amp-envelope',
  name: 'Amp Envelope',
  category: 'bw',
  description: 'Attack-sustain-release envelope',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = x / width;
        let v: number;
        if (t < 0.1) {
          v = t / 0.1; // Attack
        } else if (t < 0.7) {
          v = 1; // Sustain
        } else {
          v = 1 - (t - 0.7) / 0.3; // Release
        }
        const val = Math.floor(v * 255);
        setPixel(img.data, width, x, y, val, val, val);
      }
    }
    return img;
  }
};

const eqLowPass: FilterDefinition = {
  id: 'eq-lowpass',
  name: 'EQ Low Pass',
  category: 'bw',
  description: 'Low pass filter - attenuates high frequencies',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const t = y / height;
      const v = Math.floor((1 - t) * 255);
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const eqHighPass: FilterDefinition = {
  id: 'eq-highpass',
  name: 'EQ High Pass',
  category: 'bw',
  description: 'High pass filter - attenuates low frequencies',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const t = y / height;
      const v = Math.floor(t * 255);
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const eqBandPass: FilterDefinition = {
  id: 'eq-bandpass',
  name: 'EQ Band Pass',
  category: 'bw',
  description: 'Band pass filter - emphasizes mid frequencies',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const t = y / height;
      const v = Math.floor(Math.sin(t * Math.PI) * 255);
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const formantVowelA: FilterDefinition = {
  id: 'formant-a',
  name: 'Formant A',
  category: 'bw',
  description: 'Vowel "A" formant pattern',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const formants = [0.15, 0.35, 0.55]; // Relative positions
    for (let y = 0; y < height; y++) {
      const t = y / height;
      let v = 0;
      for (const f of formants) {
        const dist = Math.abs(t - f);
        v += Math.exp(-dist * dist * 100) * 255;
      }
      v = Math.min(255, v);
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const stripesHorizontal: FilterDefinition = {
  id: 'stripes-h',
  name: 'Stripes Horizontal',
  category: 'bw',
  description: 'Horizontal stripe pattern',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const stripeWidth = Math.max(1, Math.floor(height / 16));
    for (let y = 0; y < height; y++) {
      const v = Math.floor(y / stripeWidth) % 2 === 0 ? 255 : 0;
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const stripesVertical: FilterDefinition = {
  id: 'stripes-v',
  name: 'Stripes Vertical',
  category: 'bw',
  description: 'Vertical stripe pattern (tremolo effect)',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const stripeWidth = Math.max(1, Math.floor(width / 32));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = Math.floor(x / stripeWidth) % 2 === 0 ? 255 : 0;
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const stripesDiagonal: FilterDefinition = {
  id: 'stripes-diag',
  name: 'Stripes Diagonal',
  category: 'bw',
  description: 'Diagonal stripe pattern',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const stripeWidth = Math.max(1, Math.floor(Math.min(width, height) / 16));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = Math.floor((x + y) / stripeWidth) % 2 === 0 ? 255 : 0;
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const sineWaveH: FilterDefinition = {
  id: 'sine-wave-h',
  name: 'Sine Wave Horizontal',
  category: 'bw',
  description: 'Horizontal sine wave pattern',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const v = Math.floor((Math.sin(y / height * Math.PI * 8) + 1) / 2 * 255);
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const sineWaveV: FilterDefinition = {
  id: 'sine-wave-v',
  name: 'Sine Wave Vertical',
  category: 'bw',
  description: 'Vertical sine wave pattern',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = Math.floor((Math.sin(x / width * Math.PI * 16) + 1) / 2 * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const pyramid: FilterDefinition = {
  id: 'pyramid',
  name: 'Pyramid',
  category: 'bw',
  description: 'Pyramid/triangle amplitude shape',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tx = x / width;
        const v = Math.floor((1 - Math.abs(tx - 0.5) * 2) * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const radialBeams: FilterDefinition = {
  id: 'radial-beams',
  name: 'Radial Beams',
  category: 'bw',
  description: 'Radial beam pattern from center',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const cx = width / 2;
    const cy = height / 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const angle = Math.atan2(y - cy, x - cx);
        const v = Math.floor((Math.sin(angle * 8) + 1) / 2 * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

// ============================================
// COLOR FILTERS (Stereo Panning)
// ============================================

const panLeftToRight: FilterDefinition = {
  id: 'pan-lr',
  name: 'Pan Left→Right',
  category: 'color',
  description: 'Stereo pan from left to right over time',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = x / width;
        const r = Math.floor((1 - t) * 255); // Left channel (red)
        const g = Math.floor(t * 255); // Right channel (green)
        setPixel(img.data, width, x, y, r, g, 0);
      }
    }
    return img;
  }
};

const panRightToLeft: FilterDefinition = {
  id: 'pan-rl',
  name: 'Pan Right→Left',
  category: 'color',
  description: 'Stereo pan from right to left over time',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = x / width;
        const r = Math.floor(t * 255);
        const g = Math.floor((1 - t) * 255);
        setPixel(img.data, width, x, y, r, g, 0);
      }
    }
    return img;
  }
};

const panPingPong: FilterDefinition = {
  id: 'pan-pingpong',
  name: 'Pan Ping Pong',
  category: 'color',
  description: 'Stereo ping-pong effect',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = (x / width) * 4;
        const pan = Math.abs((t % 2) - 1);
        const r = Math.floor((1 - pan) * 255);
        const g = Math.floor(pan * 255);
        setPixel(img.data, width, x, y, r, g, 0);
      }
    }
    return img;
  }
};

const panFrequency: FilterDefinition = {
  id: 'pan-freq',
  name: 'Pan by Frequency',
  category: 'color',
  description: 'Low frequencies left, high frequencies right',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const t = y / height;
      const r = Math.floor((1 - t) * 255);
      const g = Math.floor(t * 255);
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, r, g, 0);
      }
    }
    return img;
  }
};

const panCenter: FilterDefinition = {
  id: 'pan-center',
  name: 'Pan Center',
  category: 'color',
  description: 'All frequencies centered (mono)',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, 255, 255, 0);
      }
    }
    return img;
  }
};

const panWide: FilterDefinition = {
  id: 'pan-wide',
  name: 'Pan Wide Stereo',
  category: 'color',
  description: 'Wide stereo - low center, high spread',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const t = y / height;
      const spread = t; // More spread at higher frequencies
      const r = Math.floor((1 - spread * 0.5) * 255);
      const g = Math.floor((0.5 + spread * 0.5) * 255);
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, r, g, 0);
      }
    }
    return img;
  }
};

const colorGradientRYG: FilterDefinition = {
  id: 'gradient-ryg',
  name: 'Gradient R→Y→G',
  category: 'color',
  description: 'Red to Yellow to Green gradient',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = x / width;
        let r: number, g: number;
        if (t < 0.5) {
          r = 255;
          g = Math.floor(t * 2 * 255);
        } else {
          r = Math.floor((1 - (t - 0.5) * 2) * 255);
          g = 255;
        }
        setPixel(img.data, width, x, y, r, g, 0);
      }
    }
    return img;
  }
};

const colorCircular: FilterDefinition = {
  id: 'pan-circular',
  name: 'Pan Circular',
  category: 'color',
  description: 'Circular stereo panning',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = x / width * Math.PI * 4;
        const r = Math.floor((Math.sin(t) + 1) / 2 * 255);
        const g = Math.floor((Math.cos(t) + 1) / 2 * 255);
        setPixel(img.data, width, x, y, r, g, 0);
      }
    }
    return img;
  }
};

// ============================================
// MISC FILTERS (Noise, Special Patterns)
// ============================================

const noiseWhite: FilterDefinition = {
  id: 'noise-white',
  name: 'Noise White',
  category: 'misc',
  description: 'White noise pattern',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = Math.floor(Math.random() * 256);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const noiseBlue: FilterDefinition = {
  id: 'noise-blue',
  name: 'Noise Blue (High Freq)',
  category: 'misc',
  description: 'Blue noise - high frequency emphasis',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const freqBias = y / height;
      for (let x = 0; x < width; x++) {
        const v = Math.floor(Math.random() * freqBias * 256);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const noisePink: FilterDefinition = {
  id: 'noise-pink',
  name: 'Noise Pink (1/f)',
  category: 'misc',
  description: 'Pink noise - natural frequency distribution',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const freqBias = 1 - y / height;
      for (let x = 0; x < width; x++) {
        const v = Math.floor(Math.random() * freqBias * 256);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const noiseStereo: FilterDefinition = {
  id: 'noise-stereo',
  name: 'Noise Stereo',
  category: 'misc',
  description: 'Random stereo noise',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        setPixel(img.data, width, x, y, r, g, 0);
      }
    }
    return img;
  }
};

const diamonds: FilterDefinition = {
  id: 'diamonds',
  name: 'Diamonds',
  category: 'misc',
  description: 'Diamond grid pattern',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const size = Math.min(width, height) / 8;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x % size) - size / 2;
        const dy = (y % size) - size / 2;
        const v = (Math.abs(dx) + Math.abs(dy)) < size / 2 ? 255 : 0;
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const checkerboard: FilterDefinition = {
  id: 'checkerboard',
  name: 'Checkerboard',
  category: 'misc',
  description: 'Checkerboard pattern',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const size = Math.min(width, height) / 8;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cx = Math.floor(x / size);
        const cy = Math.floor(y / size);
        const v = (cx + cy) % 2 === 0 ? 255 : 0;
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const circles: FilterDefinition = {
  id: 'circles',
  name: 'Concentric Circles',
  category: 'misc',
  description: 'Concentric circle pattern from center',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const v = Math.floor((Math.sin(dist / maxDist * Math.PI * 16) + 1) / 2 * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const spiral: FilterDefinition = {
  id: 'spiral',
  name: 'Spiral',
  category: 'misc',
  description: 'Spiral pattern from center',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const cx = width / 2;
    const cy = height / 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const angle = Math.atan2(y - cy, x - cx);
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const v = Math.floor((Math.sin(angle * 4 + dist / 20) + 1) / 2 * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const waves: FilterDefinition = {
  id: 'waves',
  name: 'Waves',
  category: 'misc',
  description: 'Wavy interference pattern',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v1 = Math.sin(x / width * Math.PI * 8);
        const v2 = Math.sin(y / height * Math.PI * 8);
        const v = Math.floor((v1 + v2 + 2) / 4 * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const glassBoxes: FilterDefinition = {
  id: 'glass-boxes',
  name: 'Glass Boxes',
  category: 'misc',
  description: 'Grid of soft boxes',
  generate: (width, height) => {
    const img = createImageData(width, height);
    const sizeX = width / 8;
    const sizeY = height / 8;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bx = (x % sizeX) / sizeX;
        const by = (y % sizeY) / sizeY;
        const vx = Math.sin(bx * Math.PI);
        const vy = Math.sin(by * Math.PI);
        const v = Math.floor(vx * vy * 255);
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

const harmonicSeries: FilterDefinition = {
  id: 'harmonic-series',
  name: 'Harmonic Series',
  category: 'misc',
  description: 'Horizontal bands at harmonic intervals',
  generate: (width, height) => {
    const img = createImageData(width, height);
    for (let y = 0; y < height; y++) {
      let v = 0;
      const freq = (height - y) / height;
      // Add harmonics
      for (let h = 1; h <= 8; h++) {
        const harmFreq = freq * h;
        if (harmFreq <= 1) {
          v += Math.exp(-(((harmFreq % 0.125) / 0.02) ** 2)) / h;
        }
      }
      v = Math.min(255, Math.floor(v * 255));
      for (let x = 0; x < width; x++) {
        setPixel(img.data, width, x, y, v, v, v);
      }
    }
    return img;
  }
};

// ============================================
// EXPORT ALL FILTERS
// ============================================

export const filterLibrary: FilterDefinition[] = [
  // BW Filters
  ampLinear,
  ampFadeIn,
  ampFadeOut,
  ampEnvelope,
  eqLowPass,
  eqHighPass,
  eqBandPass,
  formantVowelA,
  stripesHorizontal,
  stripesVertical,
  stripesDiagonal,
  sineWaveH,
  sineWaveV,
  pyramid,
  radialBeams,

  // Color Filters
  panLeftToRight,
  panRightToLeft,
  panPingPong,
  panFrequency,
  panCenter,
  panWide,
  colorGradientRYG,
  colorCircular,

  // Misc Filters
  noiseWhite,
  noiseBlue,
  noisePink,
  noiseStereo,
  diamonds,
  checkerboard,
  circles,
  spiral,
  waves,
  glassBoxes,
  harmonicSeries,
];

// Apply filter to canvas with blend mode
export type BlendMode = 'multiply' | 'add' | 'overlay' | 'screen';

export function applyFilter(
  canvasData: ImageData,
  filterData: ImageData,
  mode: BlendMode = 'multiply',
  intensity: { r: number; g: number; b: number } = { r: 1, g: 1, b: 1 }
): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(canvasData.data),
    canvasData.width,
    canvasData.height
  );

  const cw = canvasData.width;
  const ch = canvasData.height;
  const fw = filterData.width;
  const fh = filterData.height;

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const cIdx = (y * cw + x) * 4;

      // Sample filter with scaling
      const fx = Math.floor((x / cw) * fw);
      const fy = Math.floor((y / ch) * fh);
      const fIdx = (fy * fw + fx) * 4;

      const cr = canvasData.data[cIdx];
      const cg = canvasData.data[cIdx + 1];
      const cb = canvasData.data[cIdx + 2];

      const fr = filterData.data[fIdx] * intensity.r;
      const fg = filterData.data[fIdx + 1] * intensity.g;
      const fb = filterData.data[fIdx + 2] * intensity.b;

      let nr: number, ng: number, nb: number;

      switch (mode) {
        case 'multiply':
          nr = (cr * fr) / 255;
          ng = (cg * fg) / 255;
          nb = (cb * fb) / 255;
          break;
        case 'add':
          nr = Math.min(255, cr + fr);
          ng = Math.min(255, cg + fg);
          nb = Math.min(255, cb + fb);
          break;
        case 'screen':
          nr = 255 - ((255 - cr) * (255 - fr)) / 255;
          ng = 255 - ((255 - cg) * (255 - fg)) / 255;
          nb = 255 - ((255 - cb) * (255 - fb)) / 255;
          break;
        case 'overlay':
          nr = cr < 128 ? (2 * cr * fr) / 255 : 255 - (2 * (255 - cr) * (255 - fr)) / 255;
          ng = cg < 128 ? (2 * cg * fg) / 255 : 255 - (2 * (255 - cg) * (255 - fg)) / 255;
          nb = cb < 128 ? (2 * cb * fb) / 255 : 255 - (2 * (255 - cb) * (255 - fb)) / 255;
          break;
        default:
          nr = cr;
          ng = cg;
          nb = cb;
      }

      result.data[cIdx] = Math.max(0, Math.min(255, nr));
      result.data[cIdx + 1] = Math.max(0, Math.min(255, ng));
      result.data[cIdx + 2] = Math.max(0, Math.min(255, nb));
      result.data[cIdx + 3] = 255;
    }
  }

  return result;
}
