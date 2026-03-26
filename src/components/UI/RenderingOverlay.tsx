import React, { memo } from 'react';

interface RenderingOverlayProps {
  isRendering: boolean;
  progress: number;
  message?: string;
  onCancel?: () => void;
}

export const RenderingOverlay: React.FC<RenderingOverlayProps> = memo(({
  isRendering,
  progress,
  message = 'Rendering audio...',
  onCancel
}) => {
  if (!isRendering) return null;

  const percentage = Math.round(progress * 100);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-white/20 rounded-lg shadow-2xl p-6 w-80">
        <div className="text-center">
          {/* Spinner */}
          <div className="mb-4 flex justify-center">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>

          {/* Message */}
          <p className="text-text font-medium mb-2">{message}</p>

          {/* Progress bar */}
          <div className="w-full bg-surface-light rounded-full h-3 mb-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-150"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Progress text */}
          <p className="text-sm text-text-dim mb-4">{percentage}% complete</p>

          {/* Cancel button */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-surface-light hover:bg-white/10 rounded text-text-dim text-sm border border-white/10 transition-colors"
            >
              Cancel (Esc)
            </button>
          )}

          {/* Tip */}
          <p className="text-xs text-text-dim/60 mt-3">
            Tip: Reduce image size or frequency range for faster rendering
          </p>
        </div>
      </div>
    </div>
  );
});
