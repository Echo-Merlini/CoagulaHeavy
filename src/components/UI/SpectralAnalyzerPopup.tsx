import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { AudioEngine } from '../../engine/AudioEngine';
import { useStore } from '../../store';
import { X, Maximize2, Minimize2, Box } from 'lucide-react';
import { Spectrograph3D } from './Spectrograph3D';

interface SpectralAnalyzerPopupProps {
  audioEngine: AudioEngine | null;
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'spectrum' | 'waveform' | 'spectrogram' | 'combined';

export const SpectralAnalyzerPopup: React.FC<SpectralAnalyzerPopupProps> = memo(({
  audioEngine,
  isOpen,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [isMaximized, setIsMaximized] = useState(false);
  const [is3DOpen, setIs3DOpen] = useState(false);

  const { render, project } = useStore();
  const { isPlaying } = render;
  const { settings } = project;

  // Get canvas dimensions based on maximized state
  const canvasWidth = isMaximized ? 800 : 600;
  const canvasHeight = isMaximized ? 500 : 350;

  // Color gradient for spectrum bars
  const getBarColor = useCallback((value: number, index: number, total: number) => {
    const hue = (index / total) * 240;
    const lightness = 40 + (value / 255) * 30;
    return `hsl(${hue}, 80%, ${lightness}%)`;
  }, []);

  // Draw spectrum analyzer
  const drawSpectrum = useCallback((ctx: CanvasRenderingContext2D, frequencyData: Uint8Array, x: number, y: number, w: number, h: number) => {
    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(x, y, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gy = y + (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    // dB scale labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const db = -i * 15;
      const gy = y + (i / 4) * h;
      ctx.fillText(`${db}dB`, x + w - 5, gy + 12);
    }

    const binCount = frequencyData.length;
    const logBins = 256;
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
        ctx.fillRect(bx, by, barWidth - 0.5, 3);
      }
    }

    // Frequency labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const freqLabels = ['20', '50', '100', '200', '500', '1k', '2k', '5k', '10k', '20k'];
    const sampleRate = audioEngine?.getSampleRate() ?? 48000;
    const nyquist = sampleRate / 2;

    freqLabels.forEach((label) => {
      const freq = parseFloat(label.replace('k', '000'));
      if (freq < nyquist) {
        const fx = x + Math.log(freq / 20) / Math.log(nyquist / 20) * w;
        ctx.fillText(label, fx, y + h - 5);
      }
    });

    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SPECTRUM', x + 8, y + 16);
  }, [audioEngine, getBarColor]);

  // Draw waveform
  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, timeData: Uint8Array, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(x, y, w, h);

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();

    // Grid
    ctx.setLineDash([2, 4]);
    for (let i = 1; i < 4; i++) {
      const gy = y + (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Waveform
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
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

    // Glow
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WAVEFORM', x + 8, y + 16);
  }, []);

  // Draw spectrogram
  // NOTE: Y-axis is FLIPPED to match canvas orientation where:
  //   - Top of display = low frequencies (matches top of image canvas)
  //   - Bottom of display = high frequencies (matches bottom of image canvas)
  // This is inverted from traditional audio spectrogram convention but ensures
  // the spectrogram visually matches what's drawn on the image canvas.
  const drawSpectrogram = useCallback((ctx: CanvasRenderingContext2D, frequencyData: Uint8Array, x: number, y: number, w: number, h: number) => {
    const spectroCanvas = spectrogramCanvasRef.current;
    if (!spectroCanvas) return;

    const spectroCtx = spectroCanvas.getContext('2d');
    if (!spectroCtx) return;

    // Shift existing image left
    const imageData = spectroCtx.getImageData(1, 0, spectroCanvas.width - 1, spectroCanvas.height);
    spectroCtx.putImageData(imageData, 0, 0);

    // Draw new column
    const binCount = frequencyData.length;
    for (let i = 0; i < spectroCanvas.height; i++) {
      // FLIPPED: i/height instead of 1-(i/height) to match image canvas orientation
      const normalizedY = i / spectroCanvas.height;
      const binIndex = Math.floor(Math.pow(binCount, normalizedY));
      const value = frequencyData[Math.min(binIndex, binCount - 1)];

      const intensity = value / 255;
      const hue = 240 - intensity * 240;
      const lightness = intensity * 50;

      spectroCtx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
      spectroCtx.fillRect(spectroCanvas.width - 1, i, 1, 1);
    }

    // Draw spectrogram to main canvas
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(x, y, w, h);
    ctx.drawImage(spectroCanvas, x, y, w, h);

    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SPECTROGRAM (Y-flipped to match canvas)', x + 8, y + 16);

    // Time scale
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('now', x + w - 5, y + h - 5);
  }, []);

  // Draw static "not playing" state - only once, not in animation loop
  useEffect(() => {
    if (!isOpen || isPlaying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press Play to visualize audio', canvas.width / 2, canvas.height / 2);
  }, [isOpen, isPlaying, canvasWidth, canvasHeight]);

  // Animation loop - ONLY runs when open AND playing
  useEffect(() => {
    if (!isOpen || !isPlaying || !audioEngine) return;

    const canvas = canvasRef.current;
    const spectroCanvas = spectrogramCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize spectrogram canvas
    if (spectroCanvas) {
      const spectroCtx = spectroCanvas.getContext('2d');
      if (spectroCtx) {
        spectroCtx.fillStyle = '#000';
        spectroCtx.fillRect(0, 0, spectroCanvas.width, spectroCanvas.height);
      }
    }

    const animate = () => {
      if (!isOpen || !audioEngine?.getIsPlaying()) {
        // Stop animation if closed or playback stopped
        return;
      }

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const frequencyData = audioEngine.getFrequencyData();
      const timeData = audioEngine.getAnalyserData();

      const padding = 10;

      if (viewMode === 'spectrum') {
        drawSpectrum(ctx, frequencyData, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
      } else if (viewMode === 'waveform') {
        drawWaveform(ctx, timeData, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
      } else if (viewMode === 'spectrogram') {
        drawSpectrogram(ctx, frequencyData, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
      } else if (viewMode === 'combined') {
        const halfHeight = (canvas.height - padding * 3) / 2;
        drawSpectrum(ctx, frequencyData, padding, padding, canvas.width - padding * 2, halfHeight);
        drawWaveform(ctx, timeData, padding, padding * 2 + halfHeight, (canvas.width - padding * 3) / 2, halfHeight);
        drawSpectrogram(ctx, frequencyData, padding * 2 + (canvas.width - padding * 3) / 2, padding * 2 + halfHeight, (canvas.width - padding * 3) / 2, halfHeight);
      }

      // Live indicator
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(canvas.width - 20, 20, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 68, 68, 0.5)';
      ctx.beginPath();
      ctx.arc(canvas.width - 20, 20, 10, 0, Math.PI * 2);
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
  }, [isOpen, isPlaying, audioEngine, viewMode, drawSpectrum, drawWaveform, drawSpectrogram, canvasWidth, canvasHeight]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className={`bg-surface border border-white/20 rounded-lg shadow-2xl flex flex-col ${
          isMaximized ? 'w-[850px]' : 'w-[650px]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-text">Spectral Analyzer</h2>

            {/* View mode tabs */}
            <div className="flex gap-1">
              {(['spectrum', 'waveform', 'spectrogram', 'combined'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    viewMode === mode
                      ? 'bg-primary text-white'
                      : 'bg-surface-light text-text-dim hover:bg-white/10'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* 3D Spectrograph button */}
            <button
              onClick={() => setIs3DOpen(true)}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-accent/30 text-accent hover:bg-accent/50 border border-accent/50 transition-colors"
              title="Open 3D Spectrograph view"
            >
              <Box size={12} />
              3D View
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Info display */}
            <div className="text-xs text-text-dim mr-4">
              {settings.lowFrequency} - {settings.highFrequency} Hz | {settings.sampleRate / 1000}kHz
            </div>

            {/* Maximize/Minimize */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 hover:bg-white/10 rounded text-text-dim"
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
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

        {/* Canvas */}
        <div className="p-4">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full rounded border border-white/10"
            style={{ height: isMaximized ? '500px' : '350px' }}
          />
          {/* Hidden spectrogram buffer canvas */}
          <canvas
            ref={spectrogramCanvasRef}
            width={400}
            height={200}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-xs text-text-dim">
          <div>
            {isPlaying ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Live Analysis
              </span>
            ) : (
              'Waiting for playback...'
            )}
          </div>
          <div>
            Tempo: {settings.tempo} BPM | Pitch: {settings.pitch > 0 ? '+' : ''}{settings.pitch} st
          </div>
        </div>
      </div>

      {/* 3D Spectrograph */}
      <Spectrograph3D
        audioEngine={audioEngine}
        isOpen={is3DOpen}
        onClose={() => setIs3DOpen(false)}
      />
    </div>
  );
});
