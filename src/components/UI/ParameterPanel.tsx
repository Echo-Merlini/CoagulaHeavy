import React, { lazy, Suspense, memo, useState, useCallback } from 'react';
import { useStore } from '../../store';
import { EnhancedSlider } from './EnhancedSlider';
import { CollapsibleSection } from './CollapsibleSection';
import { SpectralAnalyzer } from './SpectralAnalyzer';
import { AudioEngine } from '../../engine/AudioEngine';

// Lazy load heavy collapsible panels
const FilterBrowser = lazy(() => import('./FilterBrowser').then(m => ({ default: m.FilterBrowser })));
const EchordPanel = lazy(() => import('./EchordPanel').then(m => ({ default: m.EchordPanel })));
const ImageBrowser = lazy(() => import('./ImageBrowser').then(m => ({ default: m.ImageBrowser })));

// Fallback for lazy-loaded components
const PanelFallback = () => (
  <div className="p-4 text-center text-text-dim text-xs">Loading...</div>
);

const sampleRates = [44100, 48000, 96000, 192000] as const;
const frequencyScales = ['linear', 'exponential', 'bark'] as const;

// Frequency range presets for different use cases
const frequencyPresets = [
  { name: 'Full Range', low: 20, high: 20000, description: 'Full audible spectrum' },
  { name: 'Extended', low: 10, high: 22050, description: 'Maximum range for high sample rates' },
  { name: 'Voice', low: 80, high: 8000, description: 'Human voice range' },
  { name: 'Sub Bass', low: 20, high: 200, description: 'Deep bass frequencies' },
  { name: 'Bass', low: 40, high: 500, description: 'Low-mid frequencies' },
  { name: 'Mid', low: 200, high: 4000, description: 'Mid-range frequencies' },
  { name: 'High', low: 2000, high: 20000, description: 'High frequencies' },
  { name: 'Ultrasonic', low: 16000, high: 22050, description: 'Ultrasonic range' },
  { name: 'Classic 8k', low: 50, high: 8000, description: 'Original Coagula range' },
] as const;

interface ParameterPanelProps {
  audioEngine?: AudioEngine | null;
}

export const ParameterPanel: React.FC<ParameterPanelProps> = memo(({ audioEngine }) => {
  const { project, actions } = useStore();
  const { settings } = project;
  const [autoPitchHint, setAutoPitchHint] = useState<string | null>(null);

  const handleAutoPitch = useCallback(() => {
    const imageData = (useStore.getState() as any).canvas?.imageData as ImageData | null;
    if (!imageData || !audioEngine) {
      setAutoPitchHint('Load an image first');
      setTimeout(() => setAutoPitchHint(null), 3000);
      return;
    }
    const result = audioEngine.getAutoPitch(imageData, 7000);
    const clamped = Math.max(-48, Math.min(48, Math.round(result.pitchSemitones)));
    actions.setSettings({ pitch: clamped });
    const sign = clamped >= 0 ? '+' : '';
    setAutoPitchHint(sign + clamped + ' st — centre was ' + Math.round(result.currentCentreHz) + ' Hz → 7 kHz');
    setTimeout(() => setAutoPitchHint(null), 4000);
  }, [audioEngine, actions]);

  return (
    <div className="w-80 bg-surface border-l border-white/10 overflow-y-auto">
      {/* Spectral Analyzer at the top */}
      <div className="p-2 border-b border-white/10">
        <SpectralAnalyzer audioEngine={audioEngine ?? null} />
      </div>

      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-medium text-text">Parameters</h2>
      </div>

      <div className="p-4 space-y-6">
        <CollapsibleSection title="Audio" defaultOpen={true}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-dim mb-1">Sample Rate</label>
              <select
                value={settings.sampleRate}
                onChange={(e) => actions.setSettings({ 
                  sampleRate: Number(e.target.value) as typeof sampleRates[number] 
                })}
                className="w-full px-3 py-2 bg-surface-light rounded border border-white/10 text-text text-sm focus:border-primary outline-none"
              >
                {sampleRates.map(rate => (
                  <option key={rate} value={rate}>{rate / 1000} kHz</option>
                ))}
              </select>
            </div>

            {/* Frequency Range Presets */}
            <div>
              <label className="block text-xs text-text-dim mb-1">Frequency Preset</label>
              <select
                value=""
                onChange={(e) => {
                  const preset = frequencyPresets.find(p => p.name === e.target.value);
                  if (preset) {
                    actions.setSettings({
                      lowFrequency: preset.low,
                      highFrequency: preset.high
                    });
                  }
                }}
                className="w-full px-3 py-2 bg-surface-light rounded border border-white/10 text-text text-sm focus:border-primary outline-none"
              >
                <option value="" disabled>Select preset...</option>
                {frequencyPresets.map(preset => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name} ({preset.low}-{preset.high} Hz)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-dim mb-1">Low Freq (Hz)</label>
                <input
                  type="number"
                  value={settings.lowFrequency}
                  onChange={(e) => actions.setSettings({
                    lowFrequency: Number(e.target.value)
                  })}
                  min={1}
                  max={settings.highFrequency - 1}
                  className="w-full px-3 py-2 bg-surface-light rounded border border-white/10 text-text text-sm focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-dim mb-1">High Freq (Hz)</label>
                <input
                  type="number"
                  value={settings.highFrequency}
                  onChange={(e) => actions.setSettings({
                    highFrequency: Number(e.target.value)
                  })}
                  min={settings.lowFrequency + 1}
                  max={settings.sampleRate / 2}
                  className="w-full px-3 py-2 bg-surface-light rounded border border-white/10 text-text text-sm focus:border-primary outline-none"
                />
              </div>
            </div>

            {/* Current range display */}
            <div className="text-xs text-text-dim bg-surface-light/50 px-2 py-1 rounded">
              Range: {settings.highFrequency - settings.lowFrequency} Hz span |
              Nyquist: {settings.sampleRate / 2} Hz
            </div>

            <div>
              <label className="block text-xs text-text-dim mb-1">Frequency Scale</label>
              <select
                value={settings.frequencyScale}
                onChange={(e) => actions.setSettings({ 
                  frequencyScale: e.target.value as typeof frequencyScales[number] 
                })}
                className="w-full px-3 py-2 bg-surface-light rounded border border-white/10 text-text text-sm focus:border-primary outline-none"
              >
                <option value="linear">Linear</option>
                <option value="exponential">Exponential</option>
                <option value="bark">Bark Scale</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-dim mb-1">Duration (s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.duration}
                  onChange={(e) => actions.setSettings({ 
                    duration: Number(e.target.value) 
                  })}
                  className="w-full px-3 py-2 bg-surface-light rounded border border-white/10 text-text text-sm focus:border-primary outline-none"
                />
              </div>
              <div>
                <EnhancedSlider
                  label="Amplitude"
                  value={settings.amplitude}
                  onChange={(v) => actions.setSettings({ amplitude: v })}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.8}
                  valueFormatter={(v) => `${Math.round(v * 100)}%`}
                />
              </div>
            </div>

            {/* Pitch Control */}
            <div>
              <EnhancedSlider
                label="Pitch (semitones)"
                value={settings.pitch}
                onChange={(v) => actions.setSettings({ pitch: v })}
                min={-48}
                max={48}
                step={1}
                defaultValue={0}
                valueFormatter={(v) => {
                  if (v === 0) return '0 (original)';
                  const sign = v > 0 ? '+' : '';
                  const octaves = Math.floor(Math.abs(v) / 12);
                  const semis = Math.abs(v) % 12;
                  if (octaves > 0 && semis === 0) return `${sign}${v} (${v > 0 ? '+' : '-'}${octaves} oct)`;
                  if (octaves > 0) return `${sign}${v} (${v > 0 ? '+' : '-'}${octaves} oct ${semis}st)`;
                  return `${sign}${v}`;
                }}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-text-dim">Range: -48 to +48 (±4 octaves)</span>
                <button
                  onClick={handleAutoPitch}
                  title="Auto-tune: centres image energy at 3–15 kHz sweet spot"
                  className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/40 transition-colors font-medium"
                >
                  Auto ✦
                </button>
              </div>
              {autoPitchHint && (
                <div className="text-[10px] text-emerald-400 mt-1">
                  {autoPitchHint}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.noiseEnabled}
                onChange={(e) => actions.setSettings({
                  noiseEnabled: e.target.checked
                })}
                className="rounded bg-surface-light border-white/10"
              />
              <span className="text-sm text-text">Enable Blue Channel Noise</span>
            </label>

            {settings.noiseEnabled && (
              <EnhancedSlider
                label="Noise Bandwidth"
                value={settings.noiseBandwidth}
                onChange={(v) => actions.setSettings({ noiseBandwidth: v })}
                min={0}
                max={100}
                step={1}
                defaultValue={50}
                valueFormatter={(v) => v < 25 ? 'Tonal' : v > 75 ? 'White' : `${v}%`}
              />
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Color Mapping" defaultOpen={false}>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span className="text-text-dim">Left Channel (Sine)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span className="text-text-dim">Right Channel (Sine)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <span className="text-text-dim">Both Channels</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" />
              <span className="text-text-dim">Noise Synthesis</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-black border border-white/20" />
              <span className="text-text-dim">Silence</span>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Image Browser */}
      <Suspense fallback={<PanelFallback />}>
        <div className="p-4">
          <ImageBrowser />
        </div>
      </Suspense>

      {/* Filter Browser */}
      <Suspense fallback={<PanelFallback />}>
        <FilterBrowser />
      </Suspense>

      {/* Echord Panel */}
      <Suspense fallback={<PanelFallback />}>
        <EchordPanel />
      </Suspense>
    </div>
  );
});
