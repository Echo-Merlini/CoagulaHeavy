import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { filterLibrary, applyFilter, BlendMode, FilterDefinition } from '../../utils/filters';
import { Layers, Paintbrush, RotateCcw } from 'lucide-react';

type Category = 'bw' | 'color' | 'misc' | 'all';

interface FilterThumbnailProps {
  filter: FilterDefinition;
  selected: boolean;
  onClick: () => void;
}

const FilterThumbnail: React.FC<FilterThumbnailProps> = ({ filter, selected, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate small preview
    const previewSize = 48;
    const filterImg = filter.generate(previewSize, previewSize);
    ctx.putImageData(filterImg, 0, 0);
  }, [filter]);

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-1 rounded transition-colors ${
        selected ? 'bg-primary/30 ring-1 ring-primary' : 'hover:bg-white/10'
      }`}
      title={filter.description}
    >
      <canvas
        ref={canvasRef}
        width={48}
        height={48}
        className="rounded border border-white/10"
      />
      <span className="text-[10px] text-text-dim truncate w-14 text-center">
        {filter.name}
      </span>
    </button>
  );
};

export const FilterBrowser: React.FC = () => {
  const { canvas, actions } = useStore();
  const [category, setCategory] = useState<Category>('all');
  const [selectedFilter, setSelectedFilter] = useState<FilterDefinition | null>(null);
  const [blendMode, setBlendMode] = useState<BlendMode>('multiply');
  const [intensity, setIntensity] = useState({ r: 1, g: 1, b: 1 });
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const filteredList = category === 'all'
    ? filterLibrary
    : filterLibrary.filter(f => f.category === category);

  // Generate preview when filter or settings change
  useEffect(() => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas || !selectedFilter) return;

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    const filterImg = selectedFilter.generate(128, 128);
    ctx.putImageData(filterImg, 0, 0);
  }, [selectedFilter]);

  const handleApplyFilter = useCallback(() => {
    if (!selectedFilter || !canvas.imageData) return;

    const { width, height } = canvas.imageData;
    const filterImg = selectedFilter.generate(width, height);
    const result = applyFilter(canvas.imageData, filterImg, blendMode, intensity);

    actions.pushHistory(result);
  }, [selectedFilter, canvas.imageData, blendMode, intensity, actions]);

  const handlePreviewToggle = useCallback(() => {
    if (!selectedFilter || !canvas.imageData) return;

    if (!previewEnabled) {
      // Apply preview (pushes to history so we can undo)
      const { width, height } = canvas.imageData;
      const filterImg = selectedFilter.generate(width, height);
      const result = applyFilter(canvas.imageData, filterImg, blendMode, intensity);
      actions.setImageData(result);
      setPreviewEnabled(true);
    } else {
      // Restore - undo the preview
      actions.undo();
      setPreviewEnabled(false);
    }
  }, [selectedFilter, canvas.imageData, blendMode, intensity, previewEnabled, actions]);

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'bw', label: 'B&W' },
    { key: 'color', label: 'Color' },
    { key: 'misc', label: 'Misc' },
  ];

  return (
    <div className="border-t border-white/10">
      <div className="p-3 border-b border-white/10 flex items-center gap-2">
        <Layers size={16} className="text-primary" />
        <h3 className="text-sm font-medium">Filters</h3>
        <span className="text-xs text-text-dim ml-auto">{filterLibrary.length} filters</span>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-white/10">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
              category === cat.key
                ? 'bg-primary/20 text-primary border-b-2 border-primary'
                : 'text-text-dim hover:text-text hover:bg-white/5'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Filter Grid */}
      <div className="p-2 grid grid-cols-4 gap-1 max-h-48 overflow-y-auto">
        {filteredList.map(filter => (
          <FilterThumbnail
            key={filter.id}
            filter={filter}
            selected={selectedFilter?.id === filter.id}
            onClick={() => setSelectedFilter(filter)}
          />
        ))}
      </div>

      {/* Selected Filter Controls */}
      {selectedFilter && (
        <div className="p-3 border-t border-white/10 space-y-3">
          {/* Filter Preview */}
          <div className="flex items-start gap-3">
            <canvas
              ref={previewCanvasRef}
              width={128}
              height={128}
              className="rounded border border-white/10 w-16 h-16"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedFilter.name}</p>
              <p className="text-xs text-text-dim">{selectedFilter.description}</p>
            </div>
          </div>

          {/* Blend Mode */}
          <div>
            <label className="block text-xs text-text-dim mb-1">Blend Mode</label>
            <select
              value={blendMode}
              onChange={(e) => setBlendMode(e.target.value as BlendMode)}
              className="w-full px-2 py-1.5 bg-surface-light rounded border border-white/10 text-text text-xs focus:border-primary outline-none"
            >
              <option value="multiply">Multiply</option>
              <option value="add">Add</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
            </select>
          </div>

          {/* Channel Intensity */}
          <div className="space-y-2">
            <label className="block text-xs text-text-dim">Channel Intensity</label>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={intensity.r}
                onChange={(e) => setIntensity({ ...intensity, r: parseFloat(e.target.value) })}
                className="flex-1 h-1"
              />
              <span className="text-xs text-text-dim w-8">{Math.round(intensity.r * 100)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={intensity.g}
                onChange={(e) => setIntensity({ ...intensity, g: parseFloat(e.target.value) })}
                className="flex-1 h-1"
              />
              <span className="text-xs text-text-dim w-8">{Math.round(intensity.g * 100)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={intensity.b}
                onChange={(e) => setIntensity({ ...intensity, b: parseFloat(e.target.value) })}
                className="flex-1 h-1"
              />
              <span className="text-xs text-text-dim w-8">{Math.round(intensity.b * 100)}%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handlePreviewToggle}
              disabled={!canvas.imageData}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                previewEnabled
                  ? 'bg-yellow-600 hover:bg-yellow-500'
                  : 'bg-surface-light hover:bg-white/20 border border-white/10'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <RotateCcw size={14} />
              {previewEnabled ? 'Undo Preview' : 'Preview'}
            </button>
            <button
              onClick={handleApplyFilter}
              disabled={!canvas.imageData}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-accent rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Paintbrush size={14} />
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
