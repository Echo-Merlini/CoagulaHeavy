import React, { memo, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import {
  Brush, Eraser, Square, Circle, Pipette,
  Undo, Redo, Minus, Spline, BoxSelect, SquareDashedBottom,
  MousePointer2, Move, Sparkles, Flame
} from 'lucide-react';
import { ColorPicker } from './ColorPicker';

const tools = [
  { type: 'select' as const, icon: MousePointer2, label: 'Select (V)' },
  { type: 'move' as const, icon: Move, label: 'Move (M)' },
  { type: 'brush' as const, icon: Brush, label: 'Brush (B)' },
  { type: 'eraser' as const, icon: Eraser, label: 'Eraser (E)' },
  { type: 'fill' as const, icon: Pipette, label: 'Fill (G)' },
  { type: 'noise' as const, icon: Sparkles, label: 'Noise Brush (N)' },
  { type: 'boil' as const, icon: Flame, label: 'Boil Brush (H)' },
  { type: 'line' as const, icon: Minus, label: 'Line (L)' },
  { type: 'rect' as const, icon: Square, label: 'Rectangle (R)' },
  { type: 'circle' as const, icon: Circle, label: 'Circle (C)' },
  { type: 'spray' as const, icon: Spline, label: 'Spray (S)' },
];

export const Toolbar: React.FC = memo(() => {
  const { canvas, actions, history } = useStore();
  const { selectedTool } = canvas;

  const isShapeTool = useMemo(() => ['rect', 'circle'].includes(selectedTool.type), [selectedTool.type]);
  const isBrushTool = useMemo(() => ['brush', 'eraser', 'spray', 'noise', 'boil'].includes(selectedTool.type), [selectedTool.type]);

  const handleToolSelect = useCallback((type: typeof selectedTool.type) => {
    actions.setCanvasState({ selectedTool: { ...selectedTool, type } });
  }, [actions, selectedTool]);

  const handleColorChange = useCallback((c: { r: number; g: number; b: number }) => {
    actions.setCanvasState({ selectedTool: { ...selectedTool, color: c } });
  }, [actions, selectedTool]);

  const handleSecondaryColorChange = useCallback((c: { r: number; g: number; b: number }) => {
    actions.setCanvasState({ selectedTool: { ...selectedTool, secondaryColor: c } });
  }, [actions, selectedTool]);

  const handleToggleFilled = useCallback(() => {
    actions.setCanvasState({ selectedTool: { ...selectedTool, filled: !selectedTool.filled } });
  }, [actions, selectedTool]);

  const handleMixModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    actions.setCanvasState({
      selectedTool: { ...selectedTool, mixMode: e.target.value as 'cover' | 'add' | 'multiply' | 'screen' | 'filter' }
    });
  }, [actions, selectedTool]);

  const handleNoiseAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    actions.setCanvasState({
      selectedTool: { ...selectedTool, noiseAmount: parseInt(e.target.value) }
    });
  }, [actions, selectedTool]);

  return (
    <div className="flex flex-col gap-2 p-2 bg-surface border-r border-white/10">
      <div className="flex flex-col gap-1">
        {tools.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => handleToolSelect(type)}
            className={`p-2 rounded transition-colors ${
              selectedTool.type === type
                ? 'bg-primary text-white'
                : 'hover:bg-white/10 text-text-dim'
            }`}
            title={label}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>

      <div className="h-px bg-white/10 my-2" />

      {/* Color pickers */}
      <div className="flex flex-col gap-2">
        <ColorPicker
          color={selectedTool.color}
          onChange={handleColorChange}
          label="L"
        />
        <ColorPicker
          color={selectedTool.secondaryColor}
          onChange={handleSecondaryColorChange}
          label="R"
        />
      </div>

      <div className="h-px bg-white/10 my-2" />

      {/* Shape fill mode toggle */}
      <div className="flex flex-col gap-1">
        <button
          onClick={handleToggleFilled}
          className={`p-2 rounded transition-colors ${
            selectedTool.filled
              ? 'bg-accent/80 text-white'
              : 'hover:bg-white/10 text-text-dim'
          }`}
          title={`${selectedTool.filled ? 'Filled' : 'Outline'} mode (F)`}
        >
          {selectedTool.filled ? <BoxSelect size={20} /> : <SquareDashedBottom size={20} />}
        </button>
      </div>

      {/* Mix mode selector for brush tools */}
      {isBrushTool && (
        <>
          <div className="h-px bg-white/10 my-2" />
          <div className="flex flex-col gap-1 px-1">
            <label className="text-[9px] text-text-dim uppercase">Mix</label>
            <select
              value={selectedTool.mixMode || 'cover'}
              onChange={handleMixModeChange}
              className="w-full bg-background border border-white/10 rounded px-1 py-0.5 text-[10px] text-text"
              title="Color mixing mode"
            >
              <option value="cover">Cover</option>
              <option value="add">Add</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="filter">Filter</option>
            </select>
          </div>
        </>
      )}

      {/* Noise amount for noise tool */}
      {selectedTool.type === 'noise' && (
        <>
          <div className="h-px bg-white/10 my-2" />
          <div className="flex flex-col gap-1 px-1">
            <label className="text-[9px] text-text-dim uppercase">Noise</label>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedTool.noiseAmount || 50}
              onChange={handleNoiseAmountChange}
              className="w-full h-2 accent-primary"
              title={`Noise amount: ${selectedTool.noiseAmount || 50}%`}
            />
            <span className="text-[9px] text-text-dim text-center">{selectedTool.noiseAmount || 50}%</span>
          </div>
        </>
      )}

      <div className="h-px bg-white/10 my-2" />

      <div className="flex flex-col gap-1">
        <button
          onClick={() => actions.undo()}
          disabled={history.past.length === 0}
          className="p-2 rounded hover:bg-white/10 text-text-dim disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={20} />
        </button>
        <button
          onClick={() => actions.redo()}
          disabled={history.future.length === 0}
          className="p-2 rounded hover:bg-white/10 text-text-dim disabled:opacity-30"
          title="Redo (Ctrl+Y)"
        >
          <Redo size={20} />
        </button>
      </div>

      {/* Tool info */}
      <div className="mt-auto pt-2 border-t border-white/10">
        <div className="text-[10px] text-text-dim text-center space-y-1">
          <div className="font-medium">{selectedTool.type.toUpperCase()}</div>
          <div>Size: {selectedTool.size}</div>
          {isShapeTool && (
            <div>{selectedTool.filled ? 'Filled' : 'Outline'}</div>
          )}
        </div>
      </div>
    </div>
  );
});
