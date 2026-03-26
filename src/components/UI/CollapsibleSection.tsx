import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Collapsible section with:
 * - Click header to toggle
 * - Double-click to quickly fold/unfold
 * - Visual indicator for collapsed state
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return (
    <section className={className}>
      <div
        className="flex items-center gap-2 cursor-pointer select-none py-2 hover:bg-white/5 -mx-4 px-4"
        onClick={handleToggle}
        onDoubleClick={handleDoubleClick}
      >
        {isOpen ? (
          <ChevronDown size={14} className="text-text-dim" />
        ) : (
          <ChevronRight size={14} className="text-text-dim" />
        )}
        <h3 className="text-sm font-medium text-text-dim">{title}</h3>
      </div>

      {isOpen && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </section>
  );
};
