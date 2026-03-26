import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import {
  ChevronDown, Flame, RefreshCw, Wind, Droplet,
  FlipHorizontal, FlipVertical, ArrowLeftRight, Contrast, Sparkles
} from 'lucide-react';
import {
  applyHeat,
  applyCycle,
  applyDirectionalBlur,
  removeExcessBlue,
  applyGaussianBlur,
  applySharpen,
  applyInvert,
  swapRedGreen,
  flipHorizontal,
  flipVertical,
} from '../../utils/boil';

export const EffectsMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showBlurDialog, setShowBlurDialog] = useState(false);
  const [showHeatDialog, setShowHeatDialog] = useState(false);
  const [blurDirection, setBlurDirection] = useState(0);
  const [blurAmount, setBlurAmount] = useState(20);
  const [heatAmount, setHeatAmount] = useState(30);
  const [heatWrap, setHeatWrap] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const { canvas, actions } = useStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyEffect = useCallback((effectFn: (img: ImageData, ...args: any[]) => ImageData, ...args: any[]) => {
    if (!canvas.imageData) return;
    const result = effectFn(canvas.imageData, ...args);
    actions.pushHistory(result);
    setIsOpen(false);
  }, [canvas.imageData, actions]);

  const handleHeat = () => {
    setShowHeatDialog(true);
    setIsOpen(false);
  };

  const handleApplyHeat = () => {
    if (!canvas.imageData) return;
    const result = applyHeat(canvas.imageData, { amount: heatAmount, wrapColors: heatWrap });
    actions.pushHistory(result);
    setShowHeatDialog(false);
  };

  const handleCycle = () => {
    applyEffect(applyCycle, { amount: 30 });
  };

  const handleDirectionalBlur = () => {
    setShowBlurDialog(true);
    setIsOpen(false);
  };

  const handleApplyBlur = () => {
    if (!canvas.imageData) return;
    const result = applyDirectionalBlur(canvas.imageData, {
      amount: blurAmount,
      direction: blurDirection
    });
    actions.pushHistory(result);
    setShowBlurDialog(false);
  };

  const handleRemoveBlue = () => {
    applyEffect(removeExcessBlue);
  };

  const handleGaussianBlur = () => {
    applyEffect(applyGaussianBlur, 2);
  };

  const handleSharpen = () => {
    applyEffect(applySharpen, 50);
  };

  const handleInvert = () => {
    applyEffect(applyInvert);
  };

  const handleSwapRG = () => {
    applyEffect(swapRedGreen);
  };

  const handleFlipH = () => {
    applyEffect(flipHorizontal);
  };

  const handleFlipV = () => {
    applyEffect(flipVertical);
  };

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-3 py-1.5 rounded hover:bg-white/10 text-sm"
        >
          Effects
          <ChevronDown size={14} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-surface border border-white/10 rounded-lg shadow-xl z-50">
            <div className="py-1">
              {/* Boil Effects */}
              <div className="px-3 py-1 text-xs text-text-dim font-medium">Boil Effects</div>

              <button
                onClick={handleHeat}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <Flame size={16} className="text-orange-400" />
                Heat...
              </button>

              <button
                onClick={handleCycle}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <RefreshCw size={16} className="text-purple-400" />
                Cycle Colors
              </button>

              <button
                onClick={handleDirectionalBlur}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <Wind size={16} className="text-blue-400" />
                Directional Blur...
              </button>

              <button
                onClick={handleRemoveBlue}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <Droplet size={16} className="text-blue-300" />
                Remove Excess Blue
                <span className="ml-auto text-text-dim text-xs">Ctrl+B</span>
              </button>

              <div className="h-px bg-white/10 my-1" />

              {/* Standard Effects */}
              <div className="px-3 py-1 text-xs text-text-dim font-medium">Adjustments</div>

              <button
                onClick={handleGaussianBlur}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <Wind size={16} />
                Gaussian Blur
              </button>

              <button
                onClick={handleSharpen}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <Sparkles size={16} />
                Sharpen
              </button>

              <button
                onClick={handleInvert}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <Contrast size={16} />
                Invert Colors
              </button>

              <div className="h-px bg-white/10 my-1" />

              {/* Transform */}
              <div className="px-3 py-1 text-xs text-text-dim font-medium">Transform</div>

              <button
                onClick={handleSwapRG}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <ArrowLeftRight size={16} className="text-yellow-400" />
                Swap L/R (Red↔Green)
              </button>

              <button
                onClick={handleFlipH}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <FlipHorizontal size={16} />
                Flip Horizontal
              </button>

              <button
                onClick={handleFlipV}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <FlipVertical size={16} />
                Flip Vertical
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Heat Dialog */}
      {showHeatDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-white/10 rounded-lg p-6 w-80">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Flame size={20} className="text-orange-400" />
              Heat Effect
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-dim mb-1">
                  Amount: {heatAmount}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={heatAmount}
                  onChange={(e) => setHeatAmount(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={heatWrap}
                  onChange={(e) => setHeatWrap(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Wrap colors (255↔0)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowHeatDialog(false)}
                className="px-4 py-2 text-sm hover:bg-white/10 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyHeat}
                className="px-4 py-2 text-sm bg-primary hover:bg-accent rounded"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Directional Blur Dialog */}
      {showBlurDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-white/10 rounded-lg p-6 w-80">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Wind size={20} className="text-blue-400" />
              Directional Blur
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-dim mb-1">
                  Direction: {blurDirection}°
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={blurDirection}
                  onChange={(e) => setBlurDirection(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-text-dim mt-1">
                  <span>0° (→)</span>
                  <span>90° (↓)</span>
                  <span>180° (←)</span>
                  <span>270° (↑)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-dim mb-1">
                  Amount: {blurAmount}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={blurAmount}
                  onChange={(e) => setBlurAmount(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowBlurDialog(false)}
                className="px-4 py-2 text-sm hover:bg-white/10 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBlur}
                className="px-4 py-2 text-sm bg-primary hover:bg-accent rounded"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
