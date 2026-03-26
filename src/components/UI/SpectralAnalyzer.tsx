import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { AudioEngine } from '../../engine/AudioEngine';
import { useStore } from '../../store';
import { Maximize2 } from 'lucide-react';
import { SpectralAnalyzerPopup } from './SpectralAnalyzerPopup';

interface SpectralAnalyzerProps {
  audioEngine: AudioEngine | null;
}

type ViewMode = 'spectrum' | 'waveform' | 'spectrogram';

export const SpectralAnalyzer: React.FC<SpectralAnalyzerProps> = memo(({ audioEngine }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrogramRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('spectrum');
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const { render, project } = useStore();
  const { isPlaying } = render;
  const { settings } = project;

  // Color gradient for spectrum bars
  const getBarColor = useCallback((value: number, index: number, total: number) => {
    // Map frequency position to color (low = red, mid = yellow/green, high = cyan/blue)
    const hue = (index / total) * 240; // 0 (red) to 240 (blue)
    const lightness = 40 + (value / 255) * 30;
    return `hsl(${hue}, 80%, ${lightness}%)`;
  }, []);

  // Draw spectrum analyzer (frequency bars)
  const drawSpectrum = useCallback((ctx: CanvasRenderingContext2D, frequencyData: Uint8Array) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Clear with dark background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const binCount = frequencyData.length;

    // Use logarithmic scaling for more musical frequency distribution
    const logBins = 128; // Number of visual bars
    const logData = new Uint8Array(logBins);

    for (let i = 0; i < logBins; i++) {
      // Logarithmic mapping
      const logIndex = Math.pow(binCount, i / logBins);
      const index = Math.min(Math.floor(logIndex), binCount - 1);
      logData[i] = frequencyData[index];
    }

    const visualBarWidth = width / logBins;

    for (let i = 0; i < logBins; i++) {
      const value = logData[i];
      const barHeight = (value / 255) * height;
      const x = i * visualBarWidth;
      const y = height - barHeight;

      // Gradient fill
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, getBarColor(value, i, logBins));
      gradient.addColorStop(1, `hsla(${(i / logBins) * 240}, 90%, 60%, 0.8)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, visualBarWidth - 1, barHeight);

      // Peak highlight
      if (value > 200) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(x, y, visualBarWidth - 1, 2);
      }
    }

    // Draw frequency labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px monospace';
    const freqLabels = ['50', '100', '200', '500', '1k', '2k', '5k', '10k', '20k'];
    const sampleRate = audioEngine?.getSampleRate() ?? 48000;
    const nyquist = sampleRate / 2;

    freqLabels.forEach((label) => {
      const freq = parseFloat(label.replace('k', '000'));
      if (freq < nyquist) {
        const x = Math.log(freq / 20) / Math.log(nyquist / 20) * width;
        ctx.fillText(label, x, height - 4);
      }
    });
  }, [audioEngine, getBarColor]);

  // Draw waveform (oscilloscope)
  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, timeData: Uint8Array) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Clear with dark background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Draw grid
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw waveform
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();

    // Glow effect
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 6;
    ctx.stroke();
  }, []);

  // Draw spectrogram (waterfall)
  // NOTE: Y-axis is FLIPPED to match canvas orientation where:
  //   - Top of display = low frequencies (matches top of image canvas)
  //   - Bottom of display = high frequencies (matches bottom of image canvas)
  // This is inverted from traditional audio spectrogram convention but ensures
  // the spectrogram visually matches what's drawn on the image canvas.
  const drawSpectrogram = useCallback((ctx: CanvasRenderingContext2D, frequencyData: Uint8Array) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Shift existing image left
    const imageData = ctx.getImageData(1, 0, width - 1, height);
    ctx.putImageData(imageData, 0, 0);

    // Draw new column on the right
    const binCount = frequencyData.length;

    for (let i = 0; i < height; i++) {
      // Map canvas Y to frequency bin (logarithmic)
      // FLIPPED: i/height instead of 1-(i/height) to match image canvas orientation
      const normalizedY = i / height;
      const binIndex = Math.floor(Math.pow(binCount, normalizedY));
      const value = frequencyData[Math.min(binIndex, binCount - 1)];

      // Color mapping (intensity to color)
      const intensity = value / 255;
      const hue = 240 - intensity * 240; // Blue (cold) to red (hot)
      const lightness = intensity * 50;

      ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
      ctx.fillRect(width - 1, i, 1, 1);
    }
  }, []);

  // Draw static "not playing" state - only once, not in animation loop
  useEffect(() => {
    if (isPlaying) return; // Skip if playing - animation loop handles it

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press Play to visualize', canvas.width / 2, canvas.height / 2);
  }, [isPlaying]);

  // Animation loop - ONLY runs when playing
  useEffect(() => {
    if (!isPlaying || !audioEngine) return;

    const canvas = canvasRef.current;
    const spectrogramCanvas = spectrogramRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const spectrogramCtx = spectrogramCanvas?.getContext('2d');
    if (!ctx) return;

    // Initialize spectrogram canvas
    if (spectrogramCtx && viewMode === 'spectrogram') {
      spectrogramCtx.fillStyle = '#000';
      spectrogramCtx.fillRect(0, 0, spectrogramCanvas!.width, spectrogramCanvas!.height);
    }

    const animate = () => {
      if (!audioEngine || !audioEngine.getIsPlaying()) {
        // Stop animation if playback stopped
        return;
      }

      const frequencyData = audioEngine.getFrequencyData();
      const timeData = audioEngine.getAnalyserData();

      if (viewMode === 'spectrum') {
        drawSpectrum(ctx, frequencyData);
      } else if (viewMode === 'waveform') {
        drawWaveform(ctx, timeData);
      } else if (viewMode === 'spectrogram' && spectrogramCtx) {
        drawSpectrogram(spectrogramCtx, frequencyData);
        // Also draw mini spectrum at bottom
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Copy spectrogram
        ctx.drawImage(spectrogramCanvas!, 0, 0, canvas.width, canvas.height * 0.7);

        // Draw current spectrum at bottom
        const miniHeight = canvas.height * 0.3;
        const binCount = frequencyData.length;
        const barWidth = canvas.width / 64;

        for (let i = 0; i < 64; i++) {
          const binIndex = Math.floor(Math.pow(binCount, i / 64));
          const value = frequencyData[Math.min(binIndex, binCount - 1)];
          const barHeight = (value / 255) * miniHeight;

          ctx.fillStyle = `hsl(${(i / 64) * 240}, 80%, 50%)`;
          ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, audioEngine, viewMode, drawSpectrum, drawWaveform, drawSpectrogram]);

  return (
    <>
    <div className="bg-surface rounded-lg overflow-hidden">
      {/* Header row 1: Title and expand button */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
        <span className="text-xs font-medium text-text-dim">Spectral Analyzer</span>
        <button
          onClick={() => setIsPopupOpen(true)}
          className="flex items-center gap-1 px-2 py-1 bg-primary/20 hover:bg-primary/40 rounded text-xs text-text border border-primary/30"
          title="Open larger view (popup)"
        >
          <Maximize2 size={12} />
          <span>Expand</span>
        </button>
      </div>
      {/* Header row 2: View mode tabs */}
      <div className="flex justify-center gap-1 px-2 py-1.5 border-b border-white/10 bg-surface-light/30">
        {(['spectrum', 'waveform', 'spectrogram'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              viewMode === mode
                ? 'bg-primary text-white'
                : 'bg-surface-light text-text-dim hover:bg-white/10'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={320}
          height={120}
          className="w-full h-[120px]"
        />
        <canvas
          ref={spectrogramRef}
          width={320}
          height={84}
          className="hidden"
        />

        {/* Frequency range indicator */}
        <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[8px] text-text-dim/50">
          <span>{settings.lowFrequency} Hz</span>
          <span>{settings.highFrequency} Hz</span>
        </div>

        {/* Playing indicator */}
        {isPlaying && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] text-red-400">LIVE</span>
          </div>
        )}
      </div>
    </div>

    {/* Popup */}
    <SpectralAnalyzerPopup
      audioEngine={audioEngine}
      isOpen={isPopupOpen}
      onClose={() => setIsPopupOpen(false)}
    />
    </>
  );
});
