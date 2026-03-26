import React, { useState, useCallback, useRef, useEffect, memo } from 'react';

interface ColorPickerProps {
  color: { r: number; g: number; b: number };
  onChange: (color: { r: number; g: number; b: number }) => void;
  label?: string;
}

// Convert HSV to RGB
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// Convert RGB to HSV
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h, s, v };
}

// Preset color palette (Coagula-style)
const presetColors = [
  // Row 1: Grayscale
  { r: 0, g: 0, b: 0 },
  { r: 64, g: 64, b: 64 },
  { r: 128, g: 128, b: 128 },
  { r: 192, g: 192, b: 192 },
  { r: 255, g: 255, b: 255 },
  // Row 2: Primary + Secondary
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 255, b: 0 },
  { r: 0, g: 255, b: 255 },
  { r: 255, g: 0, b: 255 },
  // Row 3: Coagula audio colors
  { r: 255, g: 0, b: 0 },     // Left only
  { r: 0, g: 255, b: 0 },     // Right only
  { r: 255, g: 255, b: 0 },   // Both channels (stereo center)
  { r: 255, g: 128, b: 0 },   // Left-biased stereo
  { r: 128, g: 255, b: 0 },   // Right-biased stereo
  { r: 0, g: 0, b: 255 },     // Noise only
  { r: 255, g: 0, b: 255 },   // Left + noise
  { r: 0, g: 255, b: 255 },   // Right + noise
  { r: 255, g: 255, b: 255 }, // Full (both + noise)
];

export const ColorPicker: React.FC<ColorPickerProps> = memo(({
  color,
  onChange,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hue, setHue] = useState(() => rgbToHsv(color.r, color.g, color.b).h);
  const [satVal, setSatVal] = useState(() => {
    const hsv = rgbToHsv(color.r, color.g, color.b);
    return { s: hsv.s, v: hsv.v };
  });

  const svCanvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draw saturation-value gradient
  useEffect(() => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Draw hue color
    const hueColor = hsvToRgb(hue, 1, 1);
    ctx.fillStyle = `rgb(${hueColor.r}, ${hueColor.g}, ${hueColor.b})`;
    ctx.fillRect(0, 0, width, height);

    // Overlay white gradient (left to right)
    const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
    whiteGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    whiteGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, width, height);

    // Overlay black gradient (bottom to top)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
    blackGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    blackGrad.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, width, height);
  }, [hue]);

  // Draw hue slider
  useEffect(() => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 6; i++) {
      const { r, g, b } = hsvToRgb(i / 6, 1, 1);
      grad.addColorStop(i / 6, `rgb(${r}, ${g}, ${b})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSVClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const s = x;
    const v = 1 - y;
    setSatVal({ s, v });
    onChange(hsvToRgb(hue, s, v));
  }, [hue, onChange]);

  const handleHueClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHue(x);
    onChange(hsvToRgb(x, satVal.s, satVal.v));
  }, [satVal, onChange]);

  const handlePresetClick = useCallback((presetColor: { r: number; g: number; b: number }) => {
    onChange(presetColor);
    const hsv = rgbToHsv(presetColor.r, presetColor.g, presetColor.b);
    setHue(hsv.h);
    setSatVal({ s: hsv.s, v: hsv.v });
  }, [onChange]);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div
          className="w-8 h-8 rounded border border-white/20"
          style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
        />
        {label && <span className="text-xs text-text-dim">{label}</span>}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-surface border border-white/20 rounded-lg shadow-xl z-50 w-64">
          {/* Saturation-Value picker */}
          <canvas
            ref={svCanvasRef}
            width={200}
            height={150}
            className="w-full h-36 rounded cursor-crosshair mb-2"
            onClick={handleSVClick}
            onMouseDown={(e) => {
              handleSVClick(e);
              const handleMove = (ev: MouseEvent) => {
                handleSVClick(ev as unknown as React.MouseEvent<HTMLCanvasElement>);
              };
              const handleUp = () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleUp);
              };
              document.addEventListener('mousemove', handleMove);
              document.addEventListener('mouseup', handleUp);
            }}
          />

          {/* Hue slider */}
          <canvas
            ref={hueCanvasRef}
            width={200}
            height={20}
            className="w-full h-5 rounded cursor-pointer mb-2"
            onClick={handleHueClick}
            onMouseDown={(e) => {
              handleHueClick(e);
              const handleMove = (ev: MouseEvent) => {
                handleHueClick(ev as unknown as React.MouseEvent<HTMLCanvasElement>);
              };
              const handleUp = () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleUp);
              };
              document.addEventListener('mousemove', handleMove);
              document.addEventListener('mouseup', handleUp);
            }}
          />

          {/* RGB inputs */}
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-[9px] text-text-dim">R</label>
              <input
                type="number"
                min={0}
                max={255}
                value={color.r}
                onChange={(e) => onChange({ ...color, r: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) })}
                className="w-full bg-background border border-white/10 rounded px-1 py-0.5 text-xs text-text"
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-text-dim">G</label>
              <input
                type="number"
                min={0}
                max={255}
                value={color.g}
                onChange={(e) => onChange({ ...color, g: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) })}
                className="w-full bg-background border border-white/10 rounded px-1 py-0.5 text-xs text-text"
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-text-dim">B</label>
              <input
                type="number"
                min={0}
                max={255}
                value={color.b}
                onChange={(e) => onChange({ ...color, b: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) })}
                className="w-full bg-background border border-white/10 rounded px-1 py-0.5 text-xs text-text"
              />
            </div>
          </div>

          {/* Preset palette */}
          <div className="grid grid-cols-10 gap-1">
            {presetColors.map((c, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded cursor-pointer border border-white/10 hover:border-white/50"
                style={{ backgroundColor: `rgb(${c.r}, ${c.g}, ${c.b})` }}
                onClick={() => handlePresetClick(c)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
