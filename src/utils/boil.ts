// Color Boil Operations for Coagula Heavy
// Implements Heat, Cycle, Blur, and other color manipulation effects

export interface BoilSettings {
  amount: number;      // Intensity 0-100
  direction?: number;  // Angle in degrees for directional effects
  wrapColors: boolean; // Whether colors wrap around (255->0)
}

const defaultSettings: BoilSettings = {
  amount: 10,
  wrapColors: true,
};

// Helper to wrap or clamp color values
function processColor(value: number, delta: number, wrap: boolean): number {
  const newValue = value + delta;
  if (wrap) {
    return ((newValue % 256) + 256) % 256;
  }
  return Math.max(0, Math.min(255, newValue));
}

/**
 * Heat Effect - Randomly brighten or darken pixels
 * Creates a shimmering/boiling visual effect
 */
export function applyHeat(
  imageData: ImageData,
  settings: Partial<BoilSettings> = {}
): ImageData {
  const opts = { ...defaultSettings, ...settings };
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  const intensity = opts.amount / 100 * 50; // Max change of 50 per channel

  for (let i = 0; i < result.data.length; i += 4) {
    const delta = (Math.random() - 0.5) * 2 * intensity;
    result.data[i] = processColor(result.data[i], delta, opts.wrapColors);
    result.data[i + 1] = processColor(result.data[i + 1], delta, opts.wrapColors);
    result.data[i + 2] = processColor(result.data[i + 2], delta, opts.wrapColors);
  }

  return result;
}

/**
 * Cycle Effect - Bleed colors between channels
 * R->G, G->B, B->R with mixing
 */
export function applyCycle(
  imageData: ImageData,
  settings: Partial<BoilSettings> = {}
): ImageData {
  const opts = { ...defaultSettings, ...settings };
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  const mix = opts.amount / 100; // How much to blend

  for (let i = 0; i < result.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];

    // Cycle: R gets some G, G gets some B, B gets some R
    result.data[i] = Math.min(255, r + (g - r) * mix);
    result.data[i + 1] = Math.min(255, g + (b - g) * mix);
    result.data[i + 2] = Math.min(255, b + (r - b) * mix);
  }

  return result;
}

/**
 * Directional Blur - Blur in a specific direction
 * Used for motion blur and smearing effects
 */
export function applyDirectionalBlur(
  imageData: ImageData,
  settings: Partial<BoilSettings> = {}
): ImageData {
  const opts = { ...defaultSettings, direction: 0, ...settings };
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  const angle = (opts.direction ?? 0) * Math.PI / 180;
  const distance = Math.ceil(opts.amount / 10) + 1;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let totalR = 0, totalG = 0, totalB = 0;
      let count = 0;

      // Sample along the blur direction
      for (let d = -distance; d <= distance; d++) {
        const sx = Math.round(x + dx * d);
        const sy = Math.round(y + dy * d);

        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
          const idx = (sy * width + sx) * 4;
          totalR += imageData.data[idx];
          totalG += imageData.data[idx + 1];
          totalB += imageData.data[idx + 2];
          count++;
        }
      }

      const idx = (y * width + x) * 4;
      result.data[idx] = Math.round(totalR / count);
      result.data[idx + 1] = Math.round(totalG / count);
      result.data[idx + 2] = Math.round(totalB / count);
    }
  }

  return result;
}

/**
 * Remove Excess Blue - Reduces blue channel to match stereo amplitude
 * Useful for cleaning up images that have too much noise
 */
export function removeExcessBlue(imageData: ImageData): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  for (let i = 0; i < result.data.length; i += 4) {
    const r = result.data[i];
    const g = result.data[i + 1];
    const b = result.data[i + 2];

    // Blue should not exceed the max of R and G (stereo amplitude)
    const maxStereo = Math.max(r, g);
    result.data[i + 2] = Math.min(b, maxStereo);
  }

  return result;
}

/**
 * Gaussian Blur - Standard blur effect
 */
export function applyGaussianBlur(
  imageData: ImageData,
  radius: number = 2
): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  // Simple box blur approximation
  const size = radius * 2 + 1;
  const kernel = 1 / (size * size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let totalR = 0, totalG = 0, totalB = 0;

      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const sx = Math.max(0, Math.min(width - 1, x + kx));
          const sy = Math.max(0, Math.min(height - 1, y + ky));
          const idx = (sy * width + sx) * 4;

          totalR += imageData.data[idx];
          totalG += imageData.data[idx + 1];
          totalB += imageData.data[idx + 2];
        }
      }

      const idx = (y * width + x) * 4;
      result.data[idx] = Math.round(totalR * kernel);
      result.data[idx + 1] = Math.round(totalG * kernel);
      result.data[idx + 2] = Math.round(totalB * kernel);
    }
  }

  return result;
}

/**
 * Sharpen Effect - Increases contrast at edges
 */
export function applySharpen(
  imageData: ImageData,
  amount: number = 50
): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  const strength = amount / 100;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const center = imageData.data[idx + c];
        const top = imageData.data[((y - 1) * width + x) * 4 + c];
        const bottom = imageData.data[((y + 1) * width + x) * 4 + c];
        const left = imageData.data[(y * width + (x - 1)) * 4 + c];
        const right = imageData.data[(y * width + (x + 1)) * 4 + c];

        const laplacian = 4 * center - top - bottom - left - right;
        result.data[idx + c] = Math.max(0, Math.min(255, center + laplacian * strength));
      }
    }
  }

  return result;
}

/**
 * Invert Colors
 */
export function applyInvert(imageData: ImageData): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  for (let i = 0; i < result.data.length; i += 4) {
    result.data[i] = 255 - result.data[i];
    result.data[i + 1] = 255 - result.data[i + 1];
    result.data[i + 2] = 255 - result.data[i + 2];
  }

  return result;
}

/**
 * Swap Red and Green channels (swap stereo)
 */
export function swapRedGreen(imageData: ImageData): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  for (let i = 0; i < result.data.length; i += 4) {
    const r = result.data[i];
    result.data[i] = result.data[i + 1];
    result.data[i + 1] = r;
  }

  return result;
}

/**
 * Flip Horizontal (mirror)
 */
export function flipHorizontal(imageData: ImageData): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (y * width + (width - 1 - x)) * 4;

      result.data[dstIdx] = imageData.data[srcIdx];
      result.data[dstIdx + 1] = imageData.data[srcIdx + 1];
      result.data[dstIdx + 2] = imageData.data[srcIdx + 2];
      result.data[dstIdx + 3] = imageData.data[srcIdx + 3];
    }
  }

  return result;
}

/**
 * Flip Vertical
 */
export function flipVertical(imageData: ImageData): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = ((height - 1 - y) * width + x) * 4;

      result.data[dstIdx] = imageData.data[srcIdx];
      result.data[dstIdx + 1] = imageData.data[srcIdx + 1];
      result.data[dstIdx + 2] = imageData.data[srcIdx + 2];
      result.data[dstIdx + 3] = imageData.data[srcIdx + 3];
    }
  }

  return result;
}

/**
 * Brightness/Contrast adjustment
 */
export function adjustBrightnessContrast(
  imageData: ImageData,
  brightness: number = 0,  // -100 to 100
  contrast: number = 0     // -100 to 100
): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  const brightnessOffset = brightness * 2.55;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < result.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let value = result.data[i + c];
      // Apply contrast
      value = contrastFactor * (value - 128) + 128;
      // Apply brightness
      value += brightnessOffset;
      result.data[i + c] = Math.max(0, Math.min(255, value));
    }
  }

  return result;
}

/**
 * Gradient Fill - Fill an area with a color gradient
 * Supports multiple directions: right, down, diagonal, noise
 */
export type GradientDirection = 'right' | 'down' | 'diagonal' | 'noise';

export interface GradientOptions {
  fromColor: { r: number; g: number; b: number };
  toColor: { r: number; g: number; b: number };
  direction: GradientDirection;
  selection?: { x: number; y: number; width: number; height: number } | null;
}

export function applyGradientFill(
  imageData: ImageData,
  options: GradientOptions
): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  const { fromColor, toColor, direction, selection } = options;

  // Determine the fill area
  const startX = selection?.x ?? 0;
  const startY = selection?.y ?? 0;
  const fillWidth = selection?.width ?? width;
  const fillHeight = selection?.height ?? height;

  for (let dy = 0; dy < fillHeight; dy++) {
    for (let dx = 0; dx < fillWidth; dx++) {
      const x = startX + dx;
      const y = startY + dy;

      if (x >= 0 && x < width && y >= 0 && y < height) {
        let t: number;

        switch (direction) {
          case 'right':
            t = dx / Math.max(1, fillWidth - 1);
            break;
          case 'down':
            t = dy / Math.max(1, fillHeight - 1);
            break;
          case 'diagonal':
            t = (dx + dy) / Math.max(1, fillWidth + fillHeight - 2);
            break;
          case 'noise':
            t = Math.random();
            break;
          default:
            t = dx / Math.max(1, fillWidth - 1);
        }

        const idx = (y * width + x) * 4;
        result.data[idx] = Math.round(fromColor.r + (toColor.r - fromColor.r) * t);
        result.data[idx + 1] = Math.round(fromColor.g + (toColor.g - fromColor.g) * t);
        result.data[idx + 2] = Math.round(fromColor.b + (toColor.b - fromColor.b) * t);
        result.data[idx + 3] = 255;
      }
    }
  }

  return result;
}

// Export all boil operations as a collection
export const boilOperations = {
  heat: applyHeat,
  cycle: applyCycle,
  directionalBlur: applyDirectionalBlur,
  removeExcessBlue,
  gaussianBlur: applyGaussianBlur,
  sharpen: applySharpen,
  invert: applyInvert,
  swapRedGreen,
  flipHorizontal,
  flipVertical,
  adjustBrightnessContrast,
  gradientFill: applyGradientFill,
};
