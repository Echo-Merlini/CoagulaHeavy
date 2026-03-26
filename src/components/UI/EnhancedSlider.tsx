import React, { useCallback } from 'react';

interface EnhancedSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  label?: string;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
}

/**
 * Enhanced Slider with:
 * - Arrow key fine adjustment (small step), Shift+Arrow for larger steps
 * - Shift+Click to reset to default value
 * - Page Up/Down for larger jumps
 */
export const EnhancedSlider: React.FC<EnhancedSliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  defaultValue,
  label,
  showValue = true,
  valueFormatter = (v) => v.toFixed(2),
  className = '',
}) => {
  const range = max - min;
  const fineStep = step;
  const mediumStep = range * 0.05; // 5% of range
  const largeStep = range * 0.1;   // 10% of range

  const clamp = useCallback((val: number) => {
    return Math.max(min, Math.min(max, val));
  }, [min, max]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let newValue = value;
    const stepSize = e.shiftKey ? mediumStep : fineStep;

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        newValue = clamp(value + stepSize);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        newValue = clamp(value - stepSize);
        break;
      case 'PageUp':
        e.preventDefault();
        newValue = clamp(value + largeStep);
        break;
      case 'PageDown':
        e.preventDefault();
        newValue = clamp(value - largeStep);
        break;
      case 'Home':
        e.preventDefault();
        newValue = min;
        break;
      case 'End':
        e.preventDefault();
        newValue = max;
        break;
      default:
        return;
    }

    onChange(newValue);
  }, [value, onChange, min, max, fineStep, mediumStep, largeStep, clamp]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Shift+Click resets to default
    if (e.shiftKey && defaultValue !== undefined) {
      e.preventDefault();
      onChange(defaultValue);
    }
  }, [defaultValue, onChange]);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="block text-xs text-text-dim">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          className="flex-1 cursor-pointer accent-primary"
          title={defaultValue !== undefined ? 'Shift+Click to reset' : undefined}
        />
        {showValue && (
          <span className="text-xs text-text-dim w-12 text-right font-mono">
            {valueFormatter(value)}
          </span>
        )}
      </div>
    </div>
  );
};
