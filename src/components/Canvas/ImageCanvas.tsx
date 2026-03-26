import React, { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react';
import { useStore } from '../../store';
import { Maximize2, X } from 'lucide-react';

interface ImageCanvasProps {
  onPreviewRequest?: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface DroppedImage {
  data: ImageData;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  rotation: number;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = memo(({ onPreviewRequest }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [currentPos, setCurrentPos] = useState<Point | null>(null);
  const [lastDrawPos, setLastDrawPos] = useState<Point | null>(null);
  const [marchingAntsOffset, setMarchingAntsOffset] = useState(0);
  const [drawingImageData, setDrawingImageData] = useState<ImageData | null>(null);
  const [useSecondaryColor, setUseSecondaryColor] = useState(false);
  const [extendSelection, setExtendSelection] = useState(false);
  const [transformMode, setTransformMode] = useState<'none' | 'move-image' | 'zoom-rotate' | 'skew'>('none');
  const [transformOrigin, setTransformOrigin] = useState<Point | null>(null);
  const [preTransformImageData, setPreTransformImageData] = useState<ImageData | null>(null);

  // Drag & drop image state
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedImage, setDroppedImage] = useState<DroppedImage | null>(null);
  const [imageTransformMode, setImageTransformMode] = useState<'none' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'resize-n' | 'resize-s' | 'resize-e' | 'resize-w'>('none');
  const [imageTransformStart, setImageTransformStart] = useState<{ x: number; y: number; image: DroppedImage } | null>(null);

  const { project, canvas, selection, render, actions } = useStore();
  const { width, height, duration, tempo = 120 } = project.settings;
  const { zoom, panX, panY, selectedTool, imageData } = canvas;
  const { isPlaying, currentTime } = render;

  // Calculate effective duration based on tempo (120 BPM = base)
  const effectiveDuration = useMemo(() => {
    const tempoFactor = 120 / tempo;
    return duration * tempoFactor;
  }, [duration, tempo]);

  // Initialize canvas
  useEffect(() => {
    const canvasEl = canvasRef.current;
    const ctx = canvasEl?.getContext('2d');
    if (!canvasEl || !ctx) return;

    if (!imageData) {
      const newImageData = ctx.createImageData(width, height);
      newImageData.data.fill(0);
      actions.setImageData(newImageData);
      return;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.putImageData(imageData, 0, 0);
  }, [width, height, imageData, actions]);

  // Marching ants animation
  useEffect(() => {
    if (!selection) return;

    const interval = setInterval(() => {
      setMarchingAntsOffset((prev) => (prev + 1) % 16);
    }, 100);

    return () => clearInterval(interval);
  }, [selection]);

  // Draw overlay (shape preview + selection)
  useEffect(() => {
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext('2d');
    if (!ctx || !overlay) return;

    ctx.clearRect(0, 0, width, height);

    // Draw selection preview while selecting
    if (isDrawing && startPos && currentPos && selectedTool.type === 'select') {
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const w = Math.abs(currentPos.x - startPos.x);
      const h = Math.abs(currentPos.y - startPos.y);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -marchingAntsOffset;
      ctx.strokeRect(x + 0.5, y + 0.5, w, h);

      ctx.strokeStyle = '#000';
      ctx.lineDashOffset = -marchingAntsOffset + 4;
      ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      ctx.setLineDash([]);
    }

    // Draw existing selection with marching ants
    if (selection && !isDrawing) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -marchingAntsOffset;
      ctx.strokeRect(selection.x + 0.5, selection.y + 0.5, selection.width, selection.height);

      ctx.strokeStyle = '#000';
      ctx.lineDashOffset = -marchingAntsOffset + 4;
      ctx.strokeRect(selection.x + 0.5, selection.y + 0.5, selection.width, selection.height);
      ctx.setLineDash([]);
    }

    // Draw shape preview
    if (isDrawing && startPos && currentPos && ['line', 'rect', 'circle'].includes(selectedTool.type)) {
      const { color, size } = selectedTool;
      ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';

      if (selectedTool.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();
      } else if (selectedTool.type === 'rect') {
        const x = Math.min(startPos.x, currentPos.x);
        const y = Math.min(startPos.y, currentPos.y);
        const w = Math.abs(currentPos.x - startPos.x);
        const h = Math.abs(currentPos.y - startPos.y);
        if (selectedTool.filled) {
          ctx.fillRect(x, y, w, h);
        } else {
          ctx.strokeRect(x, y, w, h);
        }
      } else if (selectedTool.type === 'circle') {
        const cx = (startPos.x + currentPos.x) / 2;
        const cy = (startPos.y + currentPos.y) / 2;
        const rx = Math.abs(currentPos.x - startPos.x) / 2;
        const ry = Math.abs(currentPos.y - startPos.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (selectedTool.filled) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
      }
    }

    // Draw playback line
    if (isPlaying && currentTime > 0) {
      const playbackX = (currentTime / effectiveDuration) * width;
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(playbackX, 0);
      ctx.lineTo(playbackX, height);
      ctx.stroke();

      // Add glow effect
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(playbackX, 0);
      ctx.lineTo(playbackX, height);
      ctx.stroke();
    }
  }, [isDrawing, startPos, currentPos, selectedTool, width, height, selection, marchingAntsOffset, isPlaying, currentTime, effectiveDuration]);

  const getCanvasCoords = useCallback((e: React.MouseEvent | MouseEvent): Point => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return { x: 0, y: 0 };

    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;

    return {
      x: Math.floor((e.clientX - rect.left) * scaleX),
      y: Math.floor((e.clientY - rect.top) * scaleY),
    };
  }, []);

  // Bresenham's line algorithm
  const drawLine = useCallback((x0: number, y0: number, x1: number, y1: number, imgData: ImageData) => {
    const { color, size } = selectedTool;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    const setPixelWithBrush = (cx: number, cy: number) => {
      const brushRadius = Math.floor(size / 2);
      for (let bdy = -brushRadius; bdy <= brushRadius; bdy++) {
        for (let bdx = -brushRadius; bdx <= brushRadius; bdx++) {
          if (bdx * bdx + bdy * bdy <= brushRadius * brushRadius) {
            const px = cx + bdx;
            const py = cy + bdy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = (py * width + px) * 4;
              imgData.data[idx] = color.r;
              imgData.data[idx + 1] = color.g;
              imgData.data[idx + 2] = color.b;
              imgData.data[idx + 3] = 255;
            }
          }
        }
      }
    };

    while (true) {
      setPixelWithBrush(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }, [selectedTool, width, height]);

  // Draw rectangle to image data
  const drawRect = useCallback((x0: number, y0: number, x1: number, y1: number, imgData: ImageData) => {
    const { color, filled } = selectedTool;
    const minX = Math.max(0, Math.min(x0, x1));
    const maxX = Math.min(width - 1, Math.max(x0, x1));
    const minY = Math.max(0, Math.min(y0, y1));
    const maxY = Math.min(height - 1, Math.max(y0, y1));

    if (filled) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = (y * width + x) * 4;
          imgData.data[idx] = color.r;
          imgData.data[idx + 1] = color.g;
          imgData.data[idx + 2] = color.b;
          imgData.data[idx + 3] = 255;
        }
      }
    } else {
      drawLine(minX, minY, maxX, minY, imgData);
      drawLine(maxX, minY, maxX, maxY, imgData);
      drawLine(maxX, maxY, minX, maxY, imgData);
      drawLine(minX, maxY, minX, minY, imgData);
    }
  }, [selectedTool, width, height, drawLine]);

  // Draw ellipse to image data
  const drawEllipse = useCallback((x0: number, y0: number, x1: number, y1: number, imgData: ImageData) => {
    const { color, size, filled } = selectedTool;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;

    if (rx === 0 || ry === 0) return;

    const setPixelWithBrush = (px: number, py: number) => {
      const brushRadius = Math.floor(size / 2);
      for (let bdy = -brushRadius; bdy <= brushRadius; bdy++) {
        for (let bdx = -brushRadius; bdx <= brushRadius; bdx++) {
          if (bdx * bdx + bdy * bdy <= brushRadius * brushRadius) {
            const npx = Math.floor(px) + bdx;
            const npy = Math.floor(py) + bdy;
            if (npx >= 0 && npx < width && npy >= 0 && npy < height) {
              const idx = (npy * width + npx) * 4;
              imgData.data[idx] = color.r;
              imgData.data[idx + 1] = color.g;
              imgData.data[idx + 2] = color.b;
              imgData.data[idx + 3] = 255;
            }
          }
        }
      }
    };

    if (filled) {
      const minY = Math.max(0, Math.floor(cy - ry));
      const maxY = Math.min(height - 1, Math.ceil(cy + ry));
      for (let y = minY; y <= maxY; y++) {
        const edy = y - cy;
        const edx = rx * Math.sqrt(1 - (edy * edy) / (ry * ry));
        const minX = Math.max(0, Math.floor(cx - edx));
        const maxX = Math.min(width - 1, Math.ceil(cx + edx));
        for (let x = minX; x <= maxX; x++) {
          const idx = (y * width + x) * 4;
          imgData.data[idx] = color.r;
          imgData.data[idx + 1] = color.g;
          imgData.data[idx + 2] = color.b;
          imgData.data[idx + 3] = 255;
        }
      }
    } else {
      const steps = Math.max(100, Math.floor(2 * Math.PI * Math.max(rx, ry)));
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        setPixelWithBrush(px, py);
      }
    }
  }, [selectedTool, width, height]);

  // Spray brush
  const spray = useCallback((x: number, y: number, imgData: ImageData) => {
    const { size, color, hardness } = selectedTool;
    const radius = size;
    const density = Math.floor(size * (hardness / 100) * 2) + 5;

    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const px = Math.floor(x + Math.cos(angle) * dist);
      const py = Math.floor(y + Math.sin(angle) * dist);

      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = (py * width + px) * 4;
        imgData.data[idx] = color.r;
        imgData.data[idx + 1] = color.g;
        imgData.data[idx + 2] = color.b;
        imgData.data[idx + 3] = 255;
      }
    }
  }, [selectedTool, width, height]);

  // Apply color with mixing mode
  const applyColorWithMixing = useCallback((data: ImageData, pixelIndex: number, r: number, g: number, b: number, px?: number, py?: number) => {
    const mixMode = selectedTool.mixMode || 'cover';
    const existingR = data.data[pixelIndex];
    const existingG = data.data[pixelIndex + 1];
    const existingB = data.data[pixelIndex + 2];

    let newR: number, newG: number, newB: number;

    switch (mixMode) {
      case 'add':
        newR = Math.min(255, existingR + r);
        newG = Math.min(255, existingG + g);
        newB = Math.min(255, existingB + b);
        break;
      case 'multiply':
        newR = Math.floor((existingR * r) / 255);
        newG = Math.floor((existingG * g) / 255);
        newB = Math.floor((existingB * b) / 255);
        break;
      case 'screen':
        newR = 255 - Math.floor(((255 - existingR) * (255 - r)) / 255);
        newG = 255 - Math.floor(((255 - existingG) * (255 - g)) / 255);
        newB = 255 - Math.floor(((255 - existingB) * (255 - b)) / 255);
        break;
      case 'filter':
        // Filter mode: blur/smooth by averaging with neighbors
        if (px !== undefined && py !== undefined) {
          let totalR = 0, totalG = 0, totalB = 0, count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = px + dx;
              const ny = py + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = (ny * width + nx) * 4;
                totalR += data.data[nIdx];
                totalG += data.data[nIdx + 1];
                totalB += data.data[nIdx + 2];
                count++;
              }
            }
          }
          newR = Math.round(totalR / count);
          newG = Math.round(totalG / count);
          newB = Math.round(totalB / count);
        } else {
          newR = existingR;
          newG = existingG;
          newB = existingB;
        }
        break;
      case 'cover':
      default:
        newR = r;
        newG = g;
        newB = b;
        break;
    }

    data.data[pixelIndex] = newR;
    data.data[pixelIndex + 1] = newG;
    data.data[pixelIndex + 2] = newB;
    data.data[pixelIndex + 3] = 255;
  }, [selectedTool.mixMode, width, height]);

  // Draw a single brush dab at a point
  const drawBrushDab = useCallback((x: number, y: number, data: ImageData, secondary: boolean = false) => {
    const { size, color, secondaryColor, type, noiseAmount = 0 } = selectedTool;
    const brushRadius = Math.ceil(size / 2);
    const activeColor = secondary ? secondaryColor : color;

    for (let bdy = -brushRadius; bdy <= brushRadius; bdy++) {
      for (let bdx = -brushRadius; bdx <= brushRadius; bdx++) {
        const dist = Math.sqrt(bdx * bdx + bdy * bdy);
        if (dist <= brushRadius) {
          const px = x + bdx;
          const py = y + bdy;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const pixelIndex = (py * width + px) * 4;

            if (type === 'eraser') {
              data.data[pixelIndex] = 0;
              data.data[pixelIndex + 1] = 0;
              data.data[pixelIndex + 2] = 0;
              data.data[pixelIndex + 3] = 255;
            } else if (type === 'noise') {
              // Noise brush - random color variation
              const noise = (noiseAmount / 100) * 255;
              const r = Math.max(0, Math.min(255, activeColor.r + (Math.random() - 0.5) * 2 * noise));
              const g = Math.max(0, Math.min(255, activeColor.g + (Math.random() - 0.5) * 2 * noise));
              const b = Math.max(0, Math.min(255, activeColor.b + (Math.random() - 0.5) * 2 * noise));
              applyColorWithMixing(data, pixelIndex, r, g, b, px, py);
            } else if (type === 'boil') {
              // Boil brush - apply heat/shimmer effect to existing pixels
              const intensity = 30; // Heat intensity
              const delta = (Math.random() - 0.5) * 2 * intensity;
              const existingR = data.data[pixelIndex];
              const existingG = data.data[pixelIndex + 1];
              const existingB = data.data[pixelIndex + 2];
              data.data[pixelIndex] = Math.max(0, Math.min(255, existingR + delta));
              data.data[pixelIndex + 1] = Math.max(0, Math.min(255, existingG + delta));
              data.data[pixelIndex + 2] = Math.max(0, Math.min(255, existingB + delta));
            } else {
              // Regular brush with optional noise
              let r = activeColor.r;
              let g = activeColor.g;
              let b = activeColor.b;

              if (noiseAmount > 0) {
                const noise = (noiseAmount / 100) * 50; // Subtle noise for regular brush
                r = Math.max(0, Math.min(255, r + (Math.random() - 0.5) * 2 * noise));
                g = Math.max(0, Math.min(255, g + (Math.random() - 0.5) * 2 * noise));
                b = Math.max(0, Math.min(255, b + (Math.random() - 0.5) * 2 * noise));
              }

              applyColorWithMixing(data, pixelIndex, r, g, b, px, py);
            }
          }
        }
      }
    }
  }, [selectedTool, width, height, applyColorWithMixing]);

  // Draw interpolated line between two points for smooth strokes
  const drawBrushLine = useCallback((x0: number, y0: number, x1: number, y1: number, data: ImageData, secondary: boolean = false) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      drawBrushDab(cx, cy, data, secondary);
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
  }, [drawBrushDab]);

  const draw = useCallback((x: number, y: number, prevX?: number, prevY?: number, workingData?: ImageData, secondary: boolean = false) => {
    const canvasEl = canvasRef.current;
    const ctx = canvasEl?.getContext('2d');
    const data = workingData || drawingImageData || imageData;
    if (!ctx || !data) return data;

    const { color, secondaryColor, type } = selectedTool;
    const activeColor = secondary ? secondaryColor : color;

    if (type === 'brush' || type === 'eraser' || type === 'noise') {
      // Draw interpolated line from previous point to current point
      if (prevX !== undefined && prevY !== undefined) {
        drawBrushLine(prevX, prevY, x, y, data, secondary);
      } else {
        drawBrushDab(x, y, data, secondary);
      }
    } else if (type === 'spray') {
      spray(x, y, data);
    } else if (type === 'fill') {
      if (x < 0 || x >= width || y < 0 || y >= height) return data;

      const targetColor = {
        r: data.data[(y * width + x) * 4],
        g: data.data[(y * width + x) * 4 + 1],
        b: data.data[(y * width + x) * 4 + 2],
      };

      if (targetColor.r === activeColor.r && targetColor.g === activeColor.g && targetColor.b === activeColor.b) return data;

      const stack = [[x, y]];
      const visited = new Set<string>();

      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;

        const idx = (cy * width + cx) * 4;
        if (data.data[idx] !== targetColor.r ||
            data.data[idx + 1] !== targetColor.g ||
            data.data[idx + 2] !== targetColor.b) continue;

        visited.add(key);
        data.data[idx] = activeColor.r;
        data.data[idx + 1] = activeColor.g;
        data.data[idx + 2] = activeColor.b;
        data.data[idx + 3] = 255;

        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    }

    // Update canvas display
    ctx.putImageData(data, 0, 0);
    return data;
  }, [width, height, imageData, drawingImageData, selectedTool, spray, drawBrushDab, drawBrushLine]);

  // Move selection content
  const moveSelectionContent = useCallback((deltaX: number, deltaY: number) => {
    if (!selection || !imageData) return;

    const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);

    // First, clear the original selection area
    for (let y = selection.y; y < selection.y + selection.height; y++) {
      for (let x = selection.x; x < selection.x + selection.width; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          newImageData.data[idx] = 0;
          newImageData.data[idx + 1] = 0;
          newImageData.data[idx + 2] = 0;
          newImageData.data[idx + 3] = 255;
        }
      }
    }

    // Then, copy content to new position
    for (let dy = 0; dy < selection.height; dy++) {
      for (let dx = 0; dx < selection.width; dx++) {
        const srcX = selection.x + dx;
        const srcY = selection.y + dy;
        const dstX = srcX + deltaX;
        const dstY = srcY + deltaY;

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height &&
            dstX >= 0 && dstX < width && dstY >= 0 && dstY < height) {
          const srcIdx = (srcY * width + srcX) * 4;
          const dstIdx = (dstY * width + dstX) * 4;

          newImageData.data[dstIdx] = imageData.data[srcIdx];
          newImageData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
          newImageData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
          newImageData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
        }
      }
    }

    return newImageData;
  }, [selection, imageData, width, height]);

  // Transform: Move entire image by offset
  const applyMoveTransform = useCallback((sourceData: ImageData, deltaX: number, deltaY: number): ImageData => {
    const newImageData = new ImageData(width, height);
    // Fill with black
    for (let i = 0; i < newImageData.data.length; i += 4) {
      newImageData.data[i + 3] = 255;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcX = x - deltaX;
        const srcY = y - deltaY;
        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const srcIdx = (srcY * width + srcX) * 4;
          const dstIdx = (y * width + x) * 4;
          newImageData.data[dstIdx] = sourceData.data[srcIdx];
          newImageData.data[dstIdx + 1] = sourceData.data[srcIdx + 1];
          newImageData.data[dstIdx + 2] = sourceData.data[srcIdx + 2];
          newImageData.data[dstIdx + 3] = sourceData.data[srcIdx + 3];
        }
      }
    }
    return newImageData;
  }, [width, height]);

  // Transform: Zoom and rotate around origin point
  const applyZoomRotateTransform = useCallback((
    sourceData: ImageData,
    origin: Point,
    zoomFactor: number,
    rotationAngle: number
  ): ImageData => {
    const newImageData = new ImageData(width, height);
    // Fill with black
    for (let i = 0; i < newImageData.data.length; i += 4) {
      newImageData.data[i + 3] = 255;
    }

    const cos = Math.cos(-rotationAngle);
    const sin = Math.sin(-rotationAngle);
    const scale = 1 / zoomFactor;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Translate to origin, apply inverse transform, translate back
        const dx = x - origin.x;
        const dy = y - origin.y;
        const srcX = Math.round((dx * cos - dy * sin) * scale + origin.x);
        const srcY = Math.round((dx * sin + dy * cos) * scale + origin.y);

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const srcIdx = (srcY * width + srcX) * 4;
          const dstIdx = (y * width + x) * 4;
          newImageData.data[dstIdx] = sourceData.data[srcIdx];
          newImageData.data[dstIdx + 1] = sourceData.data[srcIdx + 1];
          newImageData.data[dstIdx + 2] = sourceData.data[srcIdx + 2];
          newImageData.data[dstIdx + 3] = sourceData.data[srcIdx + 3];
        }
      }
    }
    return newImageData;
  }, [width, height]);

  // Transform: Skew (parallelogram distortion) around origin point
  const applySkewTransform = useCallback((
    sourceData: ImageData,
    origin: Point,
    skewX: number,
    skewY: number
  ): ImageData => {
    const newImageData = new ImageData(width, height);
    // Fill with black
    for (let i = 0; i < newImageData.data.length; i += 4) {
      newImageData.data[i + 3] = 255;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Translate to origin, apply inverse skew, translate back
        const dx = x - origin.x;
        const dy = y - origin.y;
        const srcX = Math.round(dx - dy * skewX + origin.x);
        const srcY = Math.round(dy - dx * skewY + origin.y);

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const srcIdx = (srcY * width + srcX) * 4;
          const dstIdx = (y * width + x) * 4;
          newImageData.data[dstIdx] = sourceData.data[srcIdx];
          newImageData.data[dstIdx + 1] = sourceData.data[srcIdx + 1];
          newImageData.data[dstIdx + 2] = sourceData.data[srcIdx + 2];
          newImageData.data[dstIdx + 3] = sourceData.data[srcIdx + 3];
        }
      }
    }
    return newImageData;
  }, [width, height]);

  // Handle drag over for image drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // Handle image drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(f => f.type.startsWith('image/'));

    if (!imageFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create a temporary canvas to get ImageData
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCtx.drawImage(img, 0, 0);
        const imgData = tempCtx.getImageData(0, 0, img.width, img.height);

        // Calculate initial size to fit within canvas while maintaining aspect ratio
        const maxSize = Math.min(width, height) * 0.8;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const scaledWidth = Math.round(img.width * scale);
        const scaledHeight = Math.round(img.height * scale);

        // Center the image
        const x = Math.round((width - scaledWidth) / 2);
        const y = Math.round((height - scaledHeight) / 2);

        setDroppedImage({
          data: imgData,
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
          originalWidth: img.width,
          originalHeight: img.height,
          rotation: 0,
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(imageFile);
  }, [width, height]);

  // Apply dropped image to canvas
  const applyDroppedImage = useCallback(() => {
    if (!droppedImage || !imageData) return;

    const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
    const { data: srcData, x: imgX, y: imgY, width: imgW, height: imgH, originalWidth, originalHeight } = droppedImage;

    // Scale and draw the dropped image onto the canvas
    for (let dy = 0; dy < imgH; dy++) {
      for (let dx = 0; dx < imgW; dx++) {
        const destX = imgX + dx;
        const destY = imgY + dy;

        if (destX >= 0 && destX < width && destY >= 0 && destY < height) {
          // Sample from source using nearest neighbor
          const srcX = Math.floor((dx / imgW) * originalWidth);
          const srcY = Math.floor((dy / imgH) * originalHeight);
          const srcIdx = (srcY * originalWidth + srcX) * 4;
          const destIdx = (destY * width + destX) * 4;

          const alpha = srcData.data[srcIdx + 3] / 255;
          if (alpha > 0) {
            newImageData.data[destIdx] = Math.round(srcData.data[srcIdx] * alpha + newImageData.data[destIdx] * (1 - alpha));
            newImageData.data[destIdx + 1] = Math.round(srcData.data[srcIdx + 1] * alpha + newImageData.data[destIdx + 1] * (1 - alpha));
            newImageData.data[destIdx + 2] = Math.round(srcData.data[srcIdx + 2] * alpha + newImageData.data[destIdx + 2] * (1 - alpha));
            newImageData.data[destIdx + 3] = 255;
          }
        }
      }
    }

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.putImageData(newImageData, 0, 0);
    }
    actions.pushHistory(newImageData);
    setDroppedImage(null);
    onPreviewRequest?.();
  }, [droppedImage, imageData, width, height, actions, onPreviewRequest]);

  // Cancel dropped image
  const cancelDroppedImage = useCallback(() => {
    setDroppedImage(null);
  }, []);

  // Handle dropped image mouse interactions
  const handleDroppedImageMouseDown = useCallback((e: React.MouseEvent, mode: typeof imageTransformMode) => {
    e.stopPropagation();
    if (!droppedImage) return;

    setImageTransformMode(mode);
    setImageTransformStart({
      x: e.clientX,
      y: e.clientY,
      image: { ...droppedImage },
    });
  }, [droppedImage]);

  const handleDroppedImageMouseMove = useCallback((e: React.MouseEvent) => {
    if (imageTransformMode === 'none' || !imageTransformStart || !droppedImage) return;

    const deltaX = e.clientX - imageTransformStart.x;
    const deltaY = e.clientY - imageTransformStart.y;
    const original = imageTransformStart.image;

    // Scale delta by zoom level
    const scaledDeltaX = Math.round(deltaX / zoom);
    const scaledDeltaY = Math.round(deltaY / zoom);

    let newImage = { ...droppedImage };

    if (imageTransformMode === 'move') {
      newImage.x = original.x + scaledDeltaX;
      newImage.y = original.y + scaledDeltaY;
    } else if (imageTransformMode.startsWith('resize')) {
      const aspectRatio = original.width / original.height;
      const shiftHeld = e.shiftKey; // Hold shift for proportional scaling

      switch (imageTransformMode) {
        case 'resize-se':
          newImage.width = Math.max(20, original.width + scaledDeltaX);
          newImage.height = shiftHeld ? Math.round(newImage.width / aspectRatio) : Math.max(20, original.height + scaledDeltaY);
          break;
        case 'resize-sw':
          newImage.width = Math.max(20, original.width - scaledDeltaX);
          newImage.x = original.x + (original.width - newImage.width);
          newImage.height = shiftHeld ? Math.round(newImage.width / aspectRatio) : Math.max(20, original.height + scaledDeltaY);
          break;
        case 'resize-ne':
          newImage.width = Math.max(20, original.width + scaledDeltaX);
          newImage.height = shiftHeld ? Math.round(newImage.width / aspectRatio) : Math.max(20, original.height - scaledDeltaY);
          newImage.y = original.y + (original.height - newImage.height);
          break;
        case 'resize-nw':
          newImage.width = Math.max(20, original.width - scaledDeltaX);
          newImage.height = shiftHeld ? Math.round(newImage.width / aspectRatio) : Math.max(20, original.height - scaledDeltaY);
          newImage.x = original.x + (original.width - newImage.width);
          newImage.y = original.y + (original.height - newImage.height);
          break;
        case 'resize-n':
          newImage.height = Math.max(20, original.height - scaledDeltaY);
          newImage.y = original.y + (original.height - newImage.height);
          break;
        case 'resize-s':
          newImage.height = Math.max(20, original.height + scaledDeltaY);
          break;
        case 'resize-e':
          newImage.width = Math.max(20, original.width + scaledDeltaX);
          break;
        case 'resize-w':
          newImage.width = Math.max(20, original.width - scaledDeltaX);
          newImage.x = original.x + (original.width - newImage.width);
          break;
      }
    }

    setDroppedImage(newImage);
  }, [imageTransformMode, imageTransformStart, droppedImage, zoom]);

  const handleDroppedImageMouseUp = useCallback(() => {
    setImageTransformMode('none');
    setImageTransformStart(null);
  }, []);

  // Fit dropped image to canvas
  const fitImageToCanvas = useCallback(() => {
    if (!droppedImage) return;

    const aspectRatio = droppedImage.originalWidth / droppedImage.originalHeight;
    let newWidth = width;
    let newHeight = Math.round(width / aspectRatio);

    if (newHeight > height) {
      newHeight = height;
      newWidth = Math.round(height * aspectRatio);
    }

    setDroppedImage({
      ...droppedImage,
      x: Math.round((width - newWidth) / 2),
      y: Math.round((height - newHeight) / 2),
      width: newWidth,
      height: newHeight,
    });
  }, [droppedImage, width, height]);

  // Fill canvas with dropped image (stretch)
  const fillCanvasWithImage = useCallback(() => {
    if (!droppedImage) return;

    setDroppedImage({
      ...droppedImage,
      x: 0,
      y: 0,
      width,
      height,
    });
  }, [droppedImage, width, height]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Prevent context menu on right-click
    if (e.button === 2) {
      e.preventDefault();
    }

    const coords = getCanvasCoords(e);
    const isSecondary = e.button === 2; // Right-click uses secondary color

    // Check for transform modes (Ctrl+Shift, Ctrl, or Shift with left-click on non-tool)
    if (e.button === 0 && imageData) {
      // Ctrl+Shift+drag = Skew transform
      if (e.ctrlKey && e.shiftKey) {
        setTransformMode('skew');
        setTransformOrigin(coords);
        setPreTransformImageData(new ImageData(new Uint8ClampedArray(imageData.data), width, height));
        setIsDrawing(true);
        setStartPos(coords);
        setCurrentPos(coords);
        return;
      }
      // Ctrl+drag = Zoom-rotate transform
      if (e.ctrlKey && !e.shiftKey) {
        setTransformMode('zoom-rotate');
        setTransformOrigin(coords);
        setPreTransformImageData(new ImageData(new Uint8ClampedArray(imageData.data), width, height));
        setIsDrawing(true);
        setStartPos(coords);
        setCurrentPos(coords);
        return;
      }
      // Shift+drag (without tool) = Move entire image
      if (e.shiftKey && !e.ctrlKey && selectedTool.type !== 'select') {
        setTransformMode('move-image');
        setPreTransformImageData(new ImageData(new Uint8ClampedArray(imageData.data), width, height));
        setIsDrawing(true);
        setStartPos(coords);
        setCurrentPos(coords);
        return;
      }
    }

    // Normal drawing/selection mode
    setTransformMode('none');
    const isExtending = e.shiftKey && selectedTool.type === 'select'; // Shift+drag extends selection
    setIsDrawing(true);
    setStartPos(coords);
    setCurrentPos(coords);
    setLastDrawPos(coords);
    setUseSecondaryColor(isSecondary);
    setExtendSelection(isExtending);

    // For select tool, start a new selection (unless extending with shift)
    if (selectedTool.type === 'select' && !isExtending) {
      actions.clearSelection();
    }

    // For brush/eraser/spray/fill/noise, create a working copy and draw immediately
    if (['brush', 'eraser', 'spray', 'fill', 'noise', 'boil'].includes(selectedTool.type) && imageData) {
      const workingData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
      setDrawingImageData(workingData);
      draw(coords.x, coords.y, undefined, undefined, workingData, isSecondary);
    }
  }, [getCanvasCoords, selectedTool.type, draw, actions, imageData, width, height]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);

    // Always track cursor position for status bar display
    if (coords.x >= 0 && coords.x < width && coords.y >= 0 && coords.y < height) {
      actions.setCursorPosition(coords);
    } else {
      actions.setCursorPosition(null);
    }

    if (!isDrawing) return;
    setCurrentPos(coords);

    // Handle transform modes
    if (transformMode !== 'none' && preTransformImageData && startPos) {
      const canvasEl = canvasRef.current;
      const ctx = canvasEl?.getContext('2d');
      if (!ctx) return;

      let transformedData: ImageData | null = null;

      if (transformMode === 'move-image') {
        const deltaX = coords.x - startPos.x;
        const deltaY = coords.y - startPos.y;
        transformedData = applyMoveTransform(preTransformImageData, deltaX, deltaY);
      } else if (transformMode === 'zoom-rotate' && transformOrigin) {
        // Vertical movement = zoom (up = zoom in, down = zoom out)
        const zoomDelta = (startPos.y - coords.y) / 200;
        const zoomFactor = Math.pow(2, zoomDelta);
        // Horizontal movement = rotation
        const rotationAngle = (coords.x - startPos.x) / 100;
        transformedData = applyZoomRotateTransform(preTransformImageData, transformOrigin, zoomFactor, rotationAngle);
      } else if (transformMode === 'skew' && transformOrigin) {
        // Horizontal movement = horizontal skew, vertical = vertical skew
        const skewX = (coords.x - startPos.x) / 200;
        const skewY = (coords.y - startPos.y) / 200;
        transformedData = applySkewTransform(preTransformImageData, transformOrigin, skewX, skewY);
      }

      if (transformedData) {
        ctx.putImageData(transformedData, 0, 0);
        setDrawingImageData(transformedData);
      }
      return;
    }

    // For brush/eraser/spray/noise, draw continuously with line interpolation
    if (['brush', 'eraser', 'spray', 'noise', 'boil'].includes(selectedTool.type) && drawingImageData) {
      draw(coords.x, coords.y, lastDrawPos?.x, lastDrawPos?.y, drawingImageData, useSecondaryColor);
      setLastDrawPos(coords);
    }
  }, [isDrawing, getCanvasCoords, selectedTool.type, draw, lastDrawPos, drawingImageData, useSecondaryColor, transformMode, preTransformImageData, startPos, transformOrigin, applyMoveTransform, applyZoomRotateTransform, applySkewTransform, width, height, actions]);


  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !startPos || !currentPos) {
      setIsDrawing(false);
      setStartPos(null);
      setCurrentPos(null);
      setLastDrawPos(null);
      setDrawingImageData(null);
      setTransformMode('none');
      setTransformOrigin(null);
      setPreTransformImageData(null);
      return;
    }

    // Handle transform modes - commit to history
    if (transformMode !== 'none' && drawingImageData) {
      actions.pushHistory(drawingImageData);
      setIsDrawing(false);
      setStartPos(null);
      setCurrentPos(null);
      setLastDrawPos(null);
      setDrawingImageData(null);
      setTransformMode('none');
      setTransformOrigin(null);
      setPreTransformImageData(null);
      onPreviewRequest?.();
      return;
    }

    // Handle selection tool
    if (selectedTool.type === 'select') {
      const newX = Math.max(0, Math.min(startPos.x, currentPos.x));
      const newY = Math.max(0, Math.min(startPos.y, currentPos.y));
      const newW = Math.min(width - newX, Math.abs(currentPos.x - startPos.x));
      const newH = Math.min(height - newY, Math.abs(currentPos.y - startPos.y));

      if (newW > 0 && newH > 0) {
        if (extendSelection && selection) {
          // Extend: compute bounding box of existing and new selection
          const minX = Math.min(selection.x, newX);
          const minY = Math.min(selection.y, newY);
          const maxX = Math.max(selection.x + selection.width, newX + newW);
          const maxY = Math.max(selection.y + selection.height, newY + newH);
          actions.setSelection({
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          });
        } else {
          actions.setSelection({ x: newX, y: newY, width: newW, height: newH });
        }
      }

      setIsDrawing(false);
      setStartPos(null);
      setCurrentPos(null);
      setLastDrawPos(null);
      setDrawingImageData(null);
      setExtendSelection(false);
      return;
    }

    // Handle move tool
    if (selectedTool.type === 'move' && selection && imageData) {
      const deltaX = currentPos.x - startPos.x;
      const deltaY = currentPos.y - startPos.y;

      if (deltaX !== 0 || deltaY !== 0) {
        const newImageData = moveSelectionContent(deltaX, deltaY);
        if (newImageData) {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
            ctx.putImageData(newImageData, 0, 0);
          }
          actions.pushHistory(newImageData);
          // Update selection position
          actions.setSelection({
            x: selection.x + deltaX,
            y: selection.y + deltaY,
            width: selection.width,
            height: selection.height,
          });
        }
      }

      setIsDrawing(false);
      setStartPos(null);
      setCurrentPos(null);
      setLastDrawPos(null);
      setDrawingImageData(null);
      onPreviewRequest?.();
      return;
    }

    if (!imageData) {
      setIsDrawing(false);
      setStartPos(null);
      setCurrentPos(null);
      setLastDrawPos(null);
      setDrawingImageData(null);
      return;
    }

    // Commit shape tools to image data
    if (['line', 'rect', 'circle'].includes(selectedTool.type)) {
      const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);

      if (selectedTool.type === 'line') {
        drawLine(startPos.x, startPos.y, currentPos.x, currentPos.y, newImageData);
      } else if (selectedTool.type === 'rect') {
        drawRect(startPos.x, startPos.y, currentPos.x, currentPos.y, newImageData);
      } else if (selectedTool.type === 'circle') {
        drawEllipse(startPos.x, startPos.y, currentPos.x, currentPos.y, newImageData);
      }

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.putImageData(newImageData, 0, 0);
      }
      actions.pushHistory(newImageData);
    } else if (['brush', 'eraser', 'spray', 'fill', 'noise', 'boil'].includes(selectedTool.type) && drawingImageData) {
      // Commit brush/eraser/spray/fill/noise drawing to history
      actions.pushHistory(new ImageData(new Uint8ClampedArray(drawingImageData.data), width, height));
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
    setLastDrawPos(null);
    setDrawingImageData(null);
    setExtendSelection(false);

    // Clear overlay
    const overlayCtx = overlayRef.current?.getContext('2d');
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, width, height);
    }

    onPreviewRequest?.();
  }, [isDrawing, startPos, currentPos, imageData, drawingImageData, selectedTool, width, height, actions, drawLine, drawRect, drawEllipse, onPreviewRequest, selection, moveSelectionContent, extendSelection, transformMode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, zoom * delta));
    actions.setCanvasState({ zoom: newZoom });
  }, [zoom, actions]);

  const cursor = useMemo(() => {
    switch (selectedTool.type) {
      case 'select':
        return 'crosshair';
      case 'move':
        return 'move';
      case 'brush':
      case 'eraser':
      case 'spray':
      case 'noise':
      case 'boil':
        return 'crosshair';
      case 'fill':
        return 'cell';
      case 'line':
      case 'rect':
      case 'circle':
        return 'crosshair';
      default:
        return 'default';
    }
  }, [selectedTool.type]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default context menu for right-click drawing
  }, []);

  // Render dropped image preview
  const renderDroppedImagePreview = useMemo(() => {
    if (!droppedImage) return null;

    const { width: imgW, height: imgH, data, originalWidth, originalHeight } = droppedImage;

    // Create a preview canvas
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = imgW;
    previewCanvas.height = imgH;
    const previewCtx = previewCanvas.getContext('2d');

    if (previewCtx) {
      // Draw scaled image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalWidth;
      tempCanvas.height = originalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(data, 0, 0);
        previewCtx.drawImage(tempCanvas, 0, 0, originalWidth, originalHeight, 0, 0, imgW, imgH);
      }
    }

    return previewCanvas.toDataURL();
  }, [droppedImage]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-surface"
      style={{ cursor: droppedImage ? 'default' : cursor }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseMove={droppedImage ? handleDroppedImageMouseMove : undefined}
      onMouseUp={droppedImage ? handleDroppedImageMouseUp : undefined}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        onWheel={handleWheel}
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="border border-white/10 shadow-2xl"
            style={{
              transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
              imageRendering: 'pixelated',
            }}
            onMouseDown={droppedImage ? undefined : handleMouseDown}
            onMouseMove={droppedImage ? undefined : handleMouseMove}
            onMouseUp={droppedImage ? undefined : handleMouseUp}
            onMouseLeave={() => { actions.setCursorPosition(null); if (!droppedImage) handleMouseUp(); }}
            onContextMenu={handleContextMenu}
          />
          <canvas
            ref={overlayRef}
            width={width}
            height={height}
            className="absolute top-0 left-0 pointer-events-none border border-transparent"
            style={{
              transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
              imageRendering: 'pixelated',
            }}
          />

          {/* Dropped image preview with transform handles */}
          {droppedImage && renderDroppedImagePreview && (
            <div
              className="absolute border-2 border-accent border-dashed"
              style={{
                left: droppedImage.x * zoom + panX,
                top: droppedImage.y * zoom + panY,
                width: droppedImage.width * zoom,
                height: droppedImage.height * zoom,
                backgroundImage: `url(${renderDroppedImagePreview})`,
                backgroundSize: '100% 100%',
                imageRendering: 'pixelated',
              }}
            >
              {/* Move handle (center) */}
              <div
                className="absolute inset-0 cursor-move"
                onMouseDown={(e) => handleDroppedImageMouseDown(e, 'move')}
              />

              {/* Resize handles - corners */}
              <div
                className="absolute -top-1 -left-1 w-3 h-3 bg-accent border border-white cursor-nw-resize"
                onMouseDown={(e) => handleDroppedImageMouseDown(e, 'resize-nw')}
              />
              <div
                className="absolute -top-1 -right-1 w-3 h-3 bg-accent border border-white cursor-ne-resize"
                onMouseDown={(e) => handleDroppedImageMouseDown(e, 'resize-ne')}
              />
              <div
                className="absolute -bottom-1 -left-1 w-3 h-3 bg-accent border border-white cursor-sw-resize"
                onMouseDown={(e) => handleDroppedImageMouseDown(e, 'resize-sw')}
              />
              <div
                className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent border border-white cursor-se-resize"
                onMouseDown={(e) => handleDroppedImageMouseDown(e, 'resize-se')}
              />

              {/* Resize handles - edges */}
              <div
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-accent/70 border border-white cursor-n-resize"
                onMouseDown={(e) => handleDroppedImageMouseDown(e, 'resize-n')}
              />
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-accent/70 border border-white cursor-s-resize"
                onMouseDown={(e) => handleDroppedImageMouseDown(e, 'resize-s')}
              />
              <div
                className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-4 bg-accent/70 border border-white cursor-w-resize"
                onMouseDown={(e) => handleDroppedImageMouseDown(e, 'resize-w')}
              />
              <div
                className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-4 bg-accent/70 border border-white cursor-e-resize"
                onMouseDown={(e) => handleDroppedImageMouseDown(e, 'resize-e')}
              />

              {/* Size info */}
              <div className="absolute -bottom-6 left-0 right-0 text-center text-[10px] text-accent whitespace-nowrap">
                {droppedImage.width} x {droppedImage.height}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-accent/20 border-4 border-dashed border-accent flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-surface/90 px-6 py-4 rounded-lg text-center">
            <p className="text-lg text-text font-medium">Drop image here</p>
            <p className="text-sm text-text-dim mt-1">Image will be placed on canvas</p>
          </div>
        </div>
      )}

      {/* Dropped image controls */}
      {droppedImage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface/95 px-3 py-2 rounded-lg border border-white/20 shadow-lg z-50">
          <span className="text-xs text-text-dim mr-2">Place Image:</span>

          <button
            onClick={fitImageToCanvas}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-surface-light hover:bg-white/10 rounded border border-white/10 text-text"
            title="Fit to canvas (maintain aspect ratio)"
          >
            <Maximize2 size={12} />
            Fit
          </button>

          <button
            onClick={fillCanvasWithImage}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-surface-light hover:bg-white/10 rounded border border-white/10 text-text"
            title="Fill canvas (stretch)"
          >
            Fill
          </button>

          <div className="w-px h-4 bg-white/20 mx-1" />

          <button
            onClick={applyDroppedImage}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-primary hover:bg-primary/80 rounded text-white font-medium"
            title="Apply image to canvas"
          >
            Apply
          </button>

          <button
            onClick={cancelDroppedImage}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 rounded border border-red-500/50 text-red-400"
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Canvas info */}
      <div className="absolute bottom-4 left-4 bg-surface/90 px-3 py-2 rounded text-xs text-text-dim">
        {width} x {height} | {zoom.toFixed(1)}x
        {selection && (
          <span className="ml-2">
            | Sel: {selection.width}x{selection.height} @ ({selection.x}, {selection.y})
          </span>
        )}
        {droppedImage && (
          <span className="ml-2 text-accent">
            | Image: {droppedImage.width}x{droppedImage.height} @ ({droppedImage.x}, {droppedImage.y})
          </span>
        )}
      </div>

      {/* Transform mode hints */}
      {!droppedImage && (
        <div className="absolute bottom-4 right-4 bg-surface/90 px-3 py-2 rounded text-[10px] text-text-dim">
          <div>Shift+Drag: Move image</div>
          <div>Ctrl+Drag: Zoom/Rotate</div>
          <div>Ctrl+Shift+Drag: Skew</div>
        </div>
      )}
    </div>
  );
});
