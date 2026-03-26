import React, { useState } from 'react';
import { useStore } from '../../store';
import { FilterPreset } from '../../types';
import { X, ChevronRight, ChevronDown } from 'lucide-react';

interface FilterBrowserProps {
  onClose: () => void;
  onApplyFilter: (filter: FilterPreset) => void;
}

const defaultFilters: FilterPreset[] = [
  {
    id: 'sine-sweep',
    name: 'Sine Sweep',
    category: 'bw',
    params: {
      amplitudeCurve: Array(256).fill(0).map((_, i) => Math.sin(i / 256 * Math.PI)),
      frequencyEnvelope: Array(256).fill(0).map((_, i) => i / 256),
      panCurve: Array(256).fill(0.5),
    },
  },
  {
    id: 'eq-curve',
    name: 'EQ Curve',
    category: 'bw',
    params: {
      amplitudeCurve: Array(256).fill(0).map((_, i) => Math.sin(i / 256 * Math.PI * 4)),
      frequencyEnvelope: Array(256).fill(0).map((_, i) => i / 256),
      panCurve: Array(256).fill(0.5),
    },
  },
  {
    id: 'stereo-pan',
    name: 'Stereo Pan',
    category: 'color',
    params: {
      amplitudeCurve: Array(256).fill(1),
      frequencyEnvelope: Array(256).fill(0).map((_, i) => i / 256),
      panCurve: Array(256).fill(0).map((_, i) => i / 256),
    },
  },
  {
    id: 'noise-rumble',
    name: 'Noise Rumble',
    category: 'misc',
    params: {
      amplitudeCurve: Array(256).fill(1),
      frequencyEnvelope: Array(256).fill(0).map((_, i) => Math.max(0, 1 - (i / 256) * 2)),
      panCurve: Array(256).fill(0.5),
      noiseMask: Array(256).fill(0).map(() => Math.random()),
    },
  },
];

export const FilterBrowser: React.FC<FilterBrowserProps> = ({ onClose, onApplyFilter }) => {
  const { filters } = useStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    bw: true,
    color: true,
    misc: true,
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const displayFilters = filters.length > 0 ? filters : defaultFilters;

  const categories = {
    bw: displayFilters.filter(f => f.category === 'bw'),
    color: displayFilters.filter(f => f.category === 'color'),
    misc: displayFilters.filter(f => f.category === 'misc'),
  };

  const applyFilter = (filter: FilterPreset) => {
    onApplyFilter(filter);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface w-[600px] max-h-[80vh] rounded-lg border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-lg font-medium">Filter Browser</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(['bw', 'color', 'misc'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`px-3 py-2 rounded text-sm font-medium capitalize transition-colors ${
                  selectedCategory === cat || selectedCategory === null
                    ? 'bg-primary text-white'
                    : 'bg-surface-light text-text-dim hover:bg-white/10'
                }`}
              >
                {cat} ({categories[cat].length})
              </button>
            ))}
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[400px]">
            {Object.entries(categories).map(([category, categoryFilters]) => {
              if (selectedCategory && selectedCategory !== category) return null;

              return (
                <div key={category}>
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [category]: !prev[category] }))}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-text-dim hover:bg-white/5 rounded"
                  >
                    {expanded[category] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="capitalize">{category}</span>
                    <span className="text-xs">({categoryFilters.length} filters)</span>
                  </button>

                  {expanded[category] && (
                    <div className="ml-4 grid grid-cols-2 gap-2 mt-1">
                      {categoryFilters.map(filter => (
                        <button
                          key={filter.id}
                          onClick={() => applyFilter(filter)}
                          className="px-3 py-2 text-left bg-surface-light rounded hover:bg-white/10 transition-colors"
                        >
                          <div className="text-sm font-medium">{filter.name}</div>
                          <div className="text-xs text-text-dim">{filter.id}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
