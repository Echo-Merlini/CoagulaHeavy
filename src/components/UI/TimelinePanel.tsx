import React, { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { useStore } from '../../store';
import { TimelineClip } from '../../types';
import { Plus, Upload, Trash2, Copy, GripVertical, ChevronLeft, ChevronRight, Music } from 'lucide-react';

interface TimelinePanelProps {
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (time: number) => void;
  onImportClip?: () => void;
}

// Calculate effective audio duration based on tempo
// At 120 BPM (base), duration = duration. At 60 BPM, duration doubles. At 240 BPM, duration halves.
const getEffectiveDuration = (baseDuration: number, tempo: number): number => {
  return baseDuration * (120 / (tempo || 120));
};

// Calculate base duration from effective duration and tempo
const getBaseDuration = (effectiveDuration: number, tempo: number): number => {
  return effectiveDuration / (120 / (tempo || 120));
};

// Time ruler component
const TimeRuler: React.FC<{
  totalDuration: number;
  currentTime: number;
  pixelsPerSecond: number;
  scrollLeft: number;
}> = memo(({ totalDuration, currentTime, pixelsPerSecond, scrollLeft }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw ticks
    ctx.strokeStyle = '#4a4a6a';
    ctx.fillStyle = '#8a8aaa';
    ctx.font = '10px monospace';

    const startTime = Math.floor(scrollLeft / pixelsPerSecond);
    const endTime = Math.ceil((scrollLeft + width) / pixelsPerSecond);

    for (let t = startTime; t <= endTime; t++) {
      const x = t * pixelsPerSecond - scrollLeft;

      // Major tick every second
      ctx.beginPath();
      ctx.moveTo(x, height - 10);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Label every second
      const label = `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
      ctx.fillText(label, x + 2, height - 12);

      // Minor ticks every 0.5s
      if (t < endTime) {
        const halfX = x + pixelsPerSecond / 2;
        ctx.beginPath();
        ctx.moveTo(halfX, height - 5);
        ctx.lineTo(halfX, height);
        ctx.stroke();
      }
    }

    // Draw playhead position
    const playheadX = currentTime * pixelsPerSecond - scrollLeft;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX - 5, 8);
      ctx.lineTo(playheadX + 5, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [totalDuration, currentTime, pixelsPerSecond, scrollLeft]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={24}
      className="w-full h-6 bg-surface-dark"
    />
  );
});
TimeRuler.displayName = 'TimeRuler';

// Individual clip component
const ClipItem: React.FC<{
  clip: TimelineClip;
  effectiveDuration: number;
  isActive: boolean;
  pixelsPerSecond: number;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onEffectiveDurationChange: (effectiveDuration: number) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}> = memo(({
  clip,
  effectiveDuration,
  isActive,
  pixelsPerSecond,
  onSelect,
  onDelete,
  onDuplicate,
  onEffectiveDurationChange,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const resizeStartX = useRef(0);
  const initialEffectiveDuration = useRef(0);

  // Width based on effective audio duration
  const width = Math.max(40, effectiveDuration * pixelsPerSecond);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    initialEffectiveDuration.current = effectiveDuration;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - resizeStartX.current;
      const deltaDuration = deltaX / pixelsPerSecond;
      const newEffectiveDuration = Math.max(0.5, initialEffectiveDuration.current + deltaDuration);
      onEffectiveDurationChange(Math.round(newEffectiveDuration * 10) / 10); // Round to 0.1s
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [effectiveDuration, pixelsPerSecond, onEffectiveDurationChange]);

  return (
    <div
      className={`relative flex-shrink-0 h-16 rounded overflow-hidden cursor-pointer transition-all ${
        isActive
          ? 'ring-2 ring-accent bg-accent/20'
          : 'bg-surface-light hover:bg-white/10'
      } ${isResizing ? 'opacity-80' : ''}`}
      style={{ width: `${width}px`, minWidth: '40px' }}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable={!isResizing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drag handle */}
      <div className="absolute left-0 top-0 bottom-0 w-4 flex items-center justify-center bg-black/20 cursor-grab active:cursor-grabbing">
        <GripVertical size={12} className="text-white/50" />
      </div>

      {/* Thumbnail */}
      <div className="absolute left-4 top-1 bottom-1 right-6 flex items-center justify-center">
        {clip.thumbnail ? (
          <img
            src={clip.thumbnail}
            alt={clip.name}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-black/30 flex items-center justify-center text-xs text-white/50">
            Empty
          </div>
        )}
      </div>

      {/* Clip info overlay */}
      <div className="absolute bottom-0 left-4 right-6 bg-black/60 px-1 py-0.5">
        <div className="text-xs text-white truncate">{clip.name}</div>
        <div className="text-[10px] text-white/60 flex items-center gap-1">
          <Music size={8} />
          <span>{effectiveDuration.toFixed(1)}s</span>
          <span className="text-white/40">({clip.settings.tempo}bpm)</span>
        </div>
      </div>

      {/* Action buttons on hover */}
      {isHovered && !isResizing && (
        <div className="absolute top-1 right-7 flex gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-0.5 bg-black/60 rounded hover:bg-accent/80 transition-colors"
            title="Duplicate clip"
          >
            <Copy size={10} className="text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-0.5 bg-black/60 rounded hover:bg-red-500/80 transition-colors"
            title="Delete clip"
          >
            <Trash2 size={10} className="text-white" />
          </button>
        </div>
      )}

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/10 hover:bg-accent/50 transition-colors"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
});
ClipItem.displayName = 'ClipItem';

export const TimelinePanel: React.FC<TimelinePanelProps> = memo(({
  currentTime,
  isPlaying,
  onSeek,
  onImportClip,
}) => {
  const { timeline, actions } = useStore();
  const { clips, activeClipId } = timeline;

  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const [, setDraggedClipId] = useState<string | null>(null);

  // Calculate effective durations for all clips (audio-centric view)
  const clipEffectiveDurations = useMemo(() => {
    const durations: Record<string, number> = {};
    clips.forEach(clip => {
      durations[clip.id] = getEffectiveDuration(clip.duration, clip.settings.tempo);
    });
    return durations;
  }, [clips]);

  // Calculate total effective duration (actual audio playback time)
  const totalEffectiveDuration = useMemo(() => {
    return clips.reduce((total, clip) => {
      return total + getEffectiveDuration(clip.duration, clip.settings.tempo);
    }, 0);
  }, [clips]);

  // Update scroll position when playing
  useEffect(() => {
    if (isPlaying && trackRef.current) {
      const playheadPosition = currentTime * pixelsPerSecond;
      const trackWidth = trackRef.current.clientWidth;

      if (playheadPosition > scrollLeft + trackWidth - 100) {
        setScrollLeft(playheadPosition - 100);
      }
    }
  }, [currentTime, isPlaying, pixelsPerSecond, scrollLeft]);

  const handleAddClip = useCallback(() => {
    actions.addClip();
  }, [actions]);

  const handleDeleteClip = useCallback((clipId: string) => {
    actions.removeClip(clipId);
  }, [actions]);

  const handleDuplicateClip = useCallback((clipId: string) => {
    actions.duplicateClip(clipId);
  }, [actions]);

  const handleSelectClip = useCallback((clipId: string) => {
    // Sync current canvas to active clip before switching
    actions.syncCanvasToActiveClip();
    actions.setActiveClip(clipId);
  }, [actions]);

  // When user resizes clip (changes effective duration), calculate and set the new base duration
  const handleEffectiveDurationChange = useCallback((clipId: string, newEffectiveDuration: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    // Convert effective duration back to base duration
    const newBaseDuration = getBaseDuration(newEffectiveDuration, clip.settings.tempo);
    actions.updateClipDuration(clipId, Math.max(0.1, newBaseDuration));
  }, [clips, actions]);

  const handleDragStart = useCallback((clipId: string, e: React.DragEvent) => {
    setDraggedClipId(clipId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', clipId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((targetClipId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceClipId = e.dataTransfer.getData('text/plain');

    if (sourceClipId && sourceClipId !== targetClipId) {
      // Reorder clips
      const sourceIndex = clips.findIndex(c => c.id === sourceClipId);
      const targetIndex = clips.findIndex(c => c.id === targetClipId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...clips.map(c => c.id)];
        newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, sourceClipId);
        actions.reorderClips(newOrder);
      }
    }
    setDraggedClipId(null);
  }, [clips, actions]);

  const handleZoomIn = useCallback(() => {
    setPixelsPerSecond(prev => Math.min(200, prev * 1.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPixelsPerSecond(prev => Math.max(10, prev / 1.5));
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  }, []);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (onSeek && e.target === trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft;
      const time = x / pixelsPerSecond;
      onSeek(Math.max(0, Math.min(totalEffectiveDuration, time)));
    }
  }, [onSeek, scrollLeft, pixelsPerSecond, totalEffectiveDuration]);

  // Calculate playhead position
  const playheadLeft = currentTime * pixelsPerSecond - scrollLeft;

  return (
    <div className="flex flex-col bg-surface border-t border-white/10">
      {/* Controls bar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-white/10 bg-surface-dark">
        <button
          onClick={handleAddClip}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors"
          title="Add new clip from canvas"
        >
          <Plus size={14} />
          Add Clip
        </button>
        {onImportClip && (
          <button
            onClick={onImportClip}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-surface-light text-text-dim rounded hover:bg-white/10 transition-colors border border-white/10"
            title="Import image as clip"
          >
            <Upload size={14} />
            Import
          </button>
        )}

        <div className="flex-1" />

        <span className="text-xs text-text-dim flex items-center gap-1">
          <Music size={12} />
          {clips.length} clip{clips.length !== 1 ? 's' : ''} | {totalEffectiveDuration.toFixed(1)}s audio
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1 text-text-dim hover:text-text transition-colors"
            title="Zoom out"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-text-dim w-12 text-center">
            {Math.round(pixelsPerSecond)}px/s
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 text-text-dim hover:text-text transition-colors"
            title="Zoom in"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Time ruler - shows actual audio time */}
      <TimeRuler
        totalDuration={totalEffectiveDuration}
        currentTime={currentTime}
        pixelsPerSecond={pixelsPerSecond}
        scrollLeft={scrollLeft}
      />

      {/* Clip track */}
      <div
        ref={trackRef}
        className="relative flex gap-1 p-2 overflow-x-auto min-h-[80px] bg-surface-dark/50"
        onScroll={handleScroll}
        onClick={handleTrackClick}
        style={{ scrollBehavior: 'smooth' }}
      >
        {clips.length === 0 ? (
          <div className="flex items-center justify-center w-full text-text-dim text-sm">
            No clips yet. Click "Add Clip" to create your first clip.
          </div>
        ) : (
          clips
            .sort((a, b) => a.order - b.order)
            .map((clip) => (
              <ClipItem
                key={clip.id}
                clip={clip}
                effectiveDuration={clipEffectiveDurations[clip.id] || 0}
                isActive={clip.id === activeClipId}
                pixelsPerSecond={pixelsPerSecond}
                onSelect={() => handleSelectClip(clip.id)}
                onDelete={() => handleDeleteClip(clip.id)}
                onDuplicate={() => handleDuplicateClip(clip.id)}
                onEffectiveDurationChange={(effectiveDuration) => handleEffectiveDurationChange(clip.id, effectiveDuration)}
                onDragStart={(e) => handleDragStart(clip.id, e)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(clip.id, e)}
              />
            ))
        )}

        {/* Playhead line */}
        {clips.length > 0 && playheadLeft >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
            style={{ left: `${playheadLeft + 8}px` }} // +8 for padding
          />
        )}
      </div>
    </div>
  );
});

TimelinePanel.displayName = 'TimelinePanel';
