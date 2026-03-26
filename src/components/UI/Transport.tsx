import React, { memo, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { Play, Square, Download, Repeat, Minus, Plus } from 'lucide-react';

interface TransportProps {
  onPlay: () => void;
  onStop: () => void;
  onExport: () => void;
  onToggleLoop: () => void;
  isPlaying: boolean;
  isExporting: boolean;
}

export const Transport: React.FC<TransportProps> = memo(({
  onPlay,
  onStop,
  onExport,
  onToggleLoop,
  isPlaying,
  isExporting,
}) => {
  const { render, project, actions } = useStore();
  const { currentTime, isLooping } = render;
  const { tempo } = project.settings;

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }, []);

  const formattedTime = useMemo(() => formatTime(currentTime), [formatTime, currentTime]);

  const handlePlayStop = useCallback(() => {
    if (isPlaying) {
      onStop();
    } else {
      onPlay();
    }
  }, [isPlaying, onPlay, onStop]);

  const handleTempoChange = useCallback((delta: number) => {
    const newTempo = Math.max(1, Math.min(999, tempo + delta));
    actions.setSettings({ tempo: newTempo });
  }, [tempo, actions]);

  const handleTempoInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 120;
    const newTempo = Math.max(1, Math.min(999, value));
    actions.setSettings({ tempo: newTempo });
  }, [actions]);

  // Calculate effective duration based on tempo (120 BPM = base)
  const effectiveDuration = useMemo(() => {
    const baseDuration = project.settings.duration;
    const tempoFactor = 120 / tempo;
    return (baseDuration * tempoFactor).toFixed(2);
  }, [project.settings.duration, tempo]);

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-surface border-t border-white/10">
      <button
        onClick={handlePlayStop}
        className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
          isPlaying
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-primary text-white hover:bg-accent'
        }`}
      >
        {isPlaying ? <Square size={18} /> : <Play size={18} />}
        {isPlaying ? 'Stop' : 'Play'}
      </button>

      <button
        onClick={onToggleLoop}
        className={`flex items-center gap-2 px-3 py-2 rounded font-medium transition-colors ${
          isLooping
            ? 'bg-accent/80 text-white'
            : 'bg-surface-light text-text-dim hover:bg-white/10 border border-white/10'
        }`}
        title="Toggle loop playback"
      >
        <Repeat size={18} />
        Loop
      </button>

      <div className="font-mono text-lg text-text">
        {formattedTime}
      </div>

      <div className="text-xs text-text-dim">
        {isLooping && <span className="text-accent">Looping</span>}
      </div>

      {/* Tempo Control */}
      <div className="flex items-center gap-1 px-3 py-1 bg-surface-light rounded border border-white/10">
        <span className="text-xs text-text-dim mr-1">BPM</span>
        <button
          onClick={() => handleTempoChange(-50)}
          className="px-1 py-0.5 hover:bg-white/10 rounded text-[10px] text-text-dim"
          title="Decrease tempo by 50"
        >
          -50
        </button>
        <button
          onClick={() => handleTempoChange(-10)}
          className="px-1 py-0.5 hover:bg-white/10 rounded text-[10px] text-text-dim"
          title="Decrease tempo by 10"
        >
          -10
        </button>
        <button
          onClick={() => handleTempoChange(-1)}
          className="p-1 hover:bg-white/10 rounded text-text-dim"
          title="Decrease tempo"
        >
          <Minus size={12} />
        </button>
        <input
          type="number"
          value={tempo}
          onChange={handleTempoInput}
          className="w-14 bg-transparent text-center text-sm font-mono text-text border-none outline-none"
          min={1}
          max={999}
        />
        <button
          onClick={() => handleTempoChange(1)}
          className="p-1 hover:bg-white/10 rounded text-text-dim"
          title="Increase tempo"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={() => handleTempoChange(10)}
          className="px-1 py-0.5 hover:bg-white/10 rounded text-[10px] text-text-dim"
          title="Increase tempo by 10"
        >
          +10
        </button>
        <button
          onClick={() => handleTempoChange(50)}
          className="px-1 py-0.5 hover:bg-white/10 rounded text-[10px] text-text-dim"
          title="Increase tempo by 50"
        >
          +50
        </button>
        <span className="text-[10px] text-text-dim ml-1" title="Effective duration at this tempo">
          ({effectiveDuration}s)
        </span>
      </div>

      <div className="flex-1" />

      <button
        onClick={onExport}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-surface-light rounded font-medium border border-white/10 hover:bg-white/10 disabled:opacity-50"
      >
        <Download size={18} />
        {isExporting ? 'Exporting...' : 'Export WAV'}
      </button>
    </div>
  );
});
