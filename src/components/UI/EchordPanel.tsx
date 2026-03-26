import React, { useState } from 'react';
import { useStore } from '../../store';
import { Repeat, Play, RotateCcw } from 'lucide-react';
import { applyEchord, defaultEchordSettings, echordPresets, EchordSettings } from '../../utils/echord';

export const EchordPanel: React.FC = () => {
  const { canvas, selection, actions } = useStore();
  const [settings, setSettings] = useState<EchordSettings>(defaultEchordSettings);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const updateSetting = <K extends keyof EchordSettings>(key: K, value: EchordSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSelectedPreset(''); // Clear preset selection when manually editing
  };

  const handleApply = () => {
    if (!canvas.imageData) return;
    const result = applyEchord(canvas.imageData, settings, selection);
    actions.pushHistory(result);
  };

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = echordPresets.find(p => p.name === presetName);
    if (preset) {
      setSettings({ ...defaultEchordSettings, ...preset.settings });
    }
  };

  const handleReset = () => {
    setSettings(defaultEchordSettings);
    setSelectedPreset('');
  };

  return (
    <div className="border-t border-white/10">
      <div className="p-3 border-b border-white/10 flex items-center gap-2">
        <Repeat size={16} className="text-primary" />
        <h3 className="text-sm font-medium">Echord</h3>
        <span className="text-xs text-text-dim ml-auto">Echo/Chord</span>
      </div>

      <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
        {/* Presets */}
        <div>
          <label className="block text-xs text-text-dim mb-1">Preset</label>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full px-2 py-1.5 bg-surface-light rounded border border-white/10 text-text text-xs focus:border-primary outline-none"
          >
            <option value="">Custom</option>
            {echordPresets.map(preset => (
              <option key={preset.name} value={preset.name}>{preset.name}</option>
            ))}
          </select>
        </div>

        {/* Direction */}
        <div>
          <label className="block text-xs text-text-dim mb-1">
            Direction: {settings.direction}°
          </label>
          <input
            type="range"
            min="0"
            max="360"
            value={settings.direction}
            onChange={(e) => updateSetting('direction', parseInt(e.target.value))}
            className="w-full h-1"
          />
          <div className="flex justify-between text-[10px] text-text-dim">
            <span>→</span><span>↓</span><span>←</span><span>↑</span><span>→</span>
          </div>
        </div>

        {/* Warp */}
        <div>
          <label className="block text-xs text-text-dim mb-1">
            Warp: {settings.warp}
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={settings.warp}
            onChange={(e) => updateSetting('warp', parseInt(e.target.value))}
            className="w-full h-1"
          />
        </div>

        {/* Hop & Num */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-text-dim mb-1">Hop: {settings.hop}px</label>
            <input
              type="range"
              min="1"
              max="100"
              value={settings.hop}
              onChange={(e) => updateSetting('hop', parseInt(e.target.value))}
              className="w-full h-1"
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Copies: {settings.num}</label>
            <input
              type="range"
              min="1"
              max="50"
              value={settings.num}
              onChange={(e) => updateSetting('num', parseInt(e.target.value))}
              className="w-full h-1"
            />
          </div>
        </div>

        {/* Fade & Multiply */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-text-dim mb-1">Fade: {settings.fade}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.fade}
              onChange={(e) => updateSetting('fade', parseInt(e.target.value))}
              className="w-full h-1"
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Multiply: {settings.multiply}%</label>
            <input
              type="range"
              min="50"
              max="200"
              value={settings.multiply}
              onChange={(e) => updateSetting('multiply', parseInt(e.target.value))}
              className="w-full h-1"
            />
          </div>
        </div>

        {/* First Hop & First Fade */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-text-dim mb-1">1st Hop: {settings.firstHop}%</label>
            <input
              type="range"
              min="0"
              max="200"
              value={settings.firstHop}
              onChange={(e) => updateSetting('firstHop', parseInt(e.target.value))}
              className="w-full h-1"
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">1st Fade: {settings.firstFade}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.firstFade}
              onChange={(e) => updateSetting('firstFade', parseInt(e.target.value))}
              className="w-full h-1"
            />
          </div>
        </div>

        {/* Randomness & Jitter */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-text-dim mb-1">Random: {settings.randomness}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.randomness}
              onChange={(e) => updateSetting('randomness', parseInt(e.target.value))}
              className="w-full h-1"
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Jitter: {settings.jitter}px</label>
            <input
              type="range"
              min="0"
              max="50"
              value={settings.jitter}
              onChange={(e) => updateSetting('jitter', parseInt(e.target.value))}
              className="w-full h-1"
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.wrapEcho}
              onChange={(e) => updateSetting('wrapEcho', e.target.checked)}
              className="rounded"
            />
            <span className="text-xs">Wrap horizontally</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.swapRG}
              onChange={(e) => updateSetting('swapRG', e.target.checked)}
              className="rounded"
            />
            <span className="text-xs">Swap R/G (stereo swap)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.altRG}
              onChange={(e) => updateSetting('altRG', e.target.checked)}
              className="rounded"
            />
            <span className="text-xs">Alternate R/G swap</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-surface-light hover:bg-white/20 rounded text-xs border border-white/10"
          >
            <RotateCcw size={12} />
            Reset
          </button>
          <button
            onClick={handleApply}
            disabled={!canvas.imageData}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-primary hover:bg-accent rounded text-xs font-medium disabled:opacity-50"
          >
            <Play size={12} />
            Apply
          </button>
        </div>

        {selection && (
          <p className="text-[10px] text-text-dim text-center">
            Applying to selection ({selection.width}×{selection.height})
          </p>
        )}
      </div>
    </div>
  );
};
