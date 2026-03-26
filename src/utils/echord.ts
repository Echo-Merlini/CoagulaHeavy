// Echord System for Coagula Heavy
// Creates repeating copies of pixels with various parameters

export interface EchordSettings {
  direction: number;    // Angle in degrees (0-360)
  warp: number;         // Curved path amount (-100 to 100)
  hop: number;          // Pixel stepping distance (1-100)
  num: number;          // Number of copies (1-50)
  fade: number;         // Decay per step (0-100%)
  firstHop: number;     // First copy offset multiplier (0-200%)
  firstFade: number;    // First copy fade amount (0-100%)
  multiply: number;     // Stepped size/brightness change (50-200%)
  randomness: number;   // Length variation (0-100%)
  jitter: number;       // Pixel smearing (0-50)
  wrapEcho: boolean;    // Horizontal looping
  swapRG: boolean;      // Swap red/green at each hop
  altRG: boolean;       // Alternate swap red/green
}

export const defaultEchordSettings: EchordSettings = {
  direction: 0,
  warp: 0,
  hop: 20,
  num: 5,
  fade: 20,
  firstHop: 100,
  firstFade: 0,
  multiply: 100,
  randomness: 0,
  jitter: 0,
  wrapEcho: false,
  swapRG: false,
  altRG: false,
};

// Preset configurations
export const echordPresets: { name: string; settings: Partial<EchordSettings> }[] = [
  { name: 'Simple Echo', settings: { direction: 0, hop: 30, num: 5, fade: 20 } },
  { name: 'Reverse Echo', settings: { direction: 180, hop: 30, num: 5, fade: 20 } },
  { name: 'Down Echo', settings: { direction: 90, hop: 20, num: 8, fade: 15 } },
  { name: 'Up Echo', settings: { direction: 270, hop: 20, num: 8, fade: 15 } },
  { name: 'Diagonal Echo', settings: { direction: 45, hop: 25, num: 6, fade: 18 } },
  { name: 'Stereo Spread', settings: { direction: 0, hop: 15, num: 10, fade: 10, swapRG: true } },
  { name: 'Ping Pong', settings: { direction: 0, hop: 20, num: 8, fade: 15, altRG: true } },
  { name: 'Spiral', settings: { direction: 30, warp: 50, hop: 15, num: 12, fade: 8 } },
  { name: 'Curved Trail', settings: { direction: 0, warp: 30, hop: 20, num: 10, fade: 12 } },
  { name: 'Stutter', settings: { direction: 0, hop: 5, num: 20, fade: 5, randomness: 50 } },
  { name: 'Smear', settings: { direction: 0, hop: 3, num: 30, fade: 3, jitter: 10 } },
  { name: 'Cascade', settings: { direction: 90, hop: 10, num: 15, fade: 7, multiply: 95 } },
  { name: 'Wrap Around', settings: { direction: 0, hop: 50, num: 10, fade: 10, wrapEcho: true } },
  { name: 'Ghost Trail', settings: { direction: 0, hop: 40, num: 8, fade: 25, firstFade: 50 } },
  { name: 'Accelerate', settings: { direction: 0, hop: 10, num: 10, fade: 10, multiply: 120 } },
  { name: 'Decelerate', settings: { direction: 0, hop: 30, num: 10, fade: 10, multiply: 80 } },
  { name: 'Random Scatter', settings: { direction: 0, hop: 25, num: 12, fade: 15, randomness: 80, jitter: 20 } },
  { name: 'Frequency Shift', settings: { direction: 270, hop: 5, num: 20, fade: 5 } },
];

/**
 * Apply echord effect to an image
 * Creates repeating copies along a path with various transformations
 */
export function applyEchord(
  imageData: ImageData,
  settings: Partial<EchordSettings> = {},
  selection?: { x: number; y: number; width: number; height: number } | null
): ImageData {
  const opts = { ...defaultEchordSettings, ...settings };
  const { width, height } = imageData;

  // Create result with copy of original
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  // Determine area to process (selection or full image)
  const area = selection || { x: 0, y: 0, width, height };

  // Convert direction to radians
  const baseAngle = opts.direction * Math.PI / 180;

  // Process each pixel in the selection
  for (let sy = area.y; sy < area.y + area.height; sy++) {
    for (let sx = area.x; sx < area.x + area.width; sx++) {
      const srcIdx = (sy * width + sx) * 4;

      // Skip black/transparent pixels
      const srcR = imageData.data[srcIdx];
      const srcG = imageData.data[srcIdx + 1];
      const srcB = imageData.data[srcIdx + 2];
      if (srcR === 0 && srcG === 0 && srcB === 0) continue;

      // Create echoes
      let currentHop = opts.hop * (opts.firstHop / 100);
      let currentFade = 1 - (opts.firstFade / 100);
      let swapped = false;

      for (let i = 0; i < opts.num; i++) {
        // Calculate position for this echo
        const hopDistance = currentHop * (1 + (Math.random() - 0.5) * 2 * (opts.randomness / 100));

        // Apply warp to angle
        const warpOffset = (opts.warp / 100) * (i / opts.num) * Math.PI;
        const angle = baseAngle + warpOffset;

        // Calculate offset with jitter
        const jitterX = (Math.random() - 0.5) * 2 * opts.jitter;
        const jitterY = (Math.random() - 0.5) * 2 * opts.jitter;

        let dx = Math.cos(angle) * hopDistance * (i + 1) + jitterX;
        let dy = Math.sin(angle) * hopDistance * (i + 1) + jitterY;

        let destX = Math.round(sx + dx);
        let destY = Math.round(sy + dy);

        // Handle wrapping
        if (opts.wrapEcho) {
          destX = ((destX % width) + width) % width;
        }

        // Skip if out of bounds
        if (destX < 0 || destX >= width || destY < 0 || destY >= height) {
          continue;
        }

        const destIdx = (destY * width + destX) * 4;

        // Calculate faded colors
        let echoR = srcR * currentFade;
        let echoG = srcG * currentFade;
        let echoB = srcB * currentFade;

        // Apply stereo swap
        if (opts.swapRG || (opts.altRG && swapped)) {
          const temp = echoR;
          echoR = echoG;
          echoG = temp;
        }
        if (opts.altRG) {
          swapped = !swapped;
        }

        // Blend with existing pixel (additive)
        result.data[destIdx] = Math.min(255, result.data[destIdx] + echoR);
        result.data[destIdx + 1] = Math.min(255, result.data[destIdx + 1] + echoG);
        result.data[destIdx + 2] = Math.min(255, result.data[destIdx + 2] + echoB);
        result.data[destIdx + 3] = 255;

        // Update for next iteration
        currentHop *= opts.multiply / 100;
        currentFade *= (1 - opts.fade / 100);
      }
    }
  }

  return result;
}

/**
 * Apply echord effect only to non-black pixels
 * More efficient for sparse images
 */
export function applyEchordSparse(
  imageData: ImageData,
  settings: Partial<EchordSettings> = {}
): ImageData {
  return applyEchord(imageData, settings, null);
}
