import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { RecentImage } from '../../types';
import { Star, Trash2, Clock, Heart, Download, Upload, X } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';

type TabType = 'recent' | 'favorites';

export const ImageBrowser: React.FC = () => {
  const { actions, recentImages } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>('recent');
  const [selectedImage, setSelectedImage] = useState<RecentImage | null>(null);

  // Load images from localStorage on mount
  useEffect(() => {
    actions.getRecentImages();
  }, [actions]);

  const filteredImages = recentImages.filter(img =>
    activeTab === 'favorites' ? img.category === 'favorites' : true
  );

  const handleImageClick = (img: RecentImage) => {
    setSelectedImage(img);
  };

  const handleLoad = () => {
    if (selectedImage) {
      actions.loadRecentImage(selectedImage.id);
      setSelectedImage(null);
    }
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    actions.toggleFavorite(id);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImage?.id === id) {
      setSelectedImage(null);
    }
    actions.removeRecentImage(id);
  };

  const handleExportBundle = () => {
    const bundle = actions.exportRenderBundle();
    if (bundle) {
      const blob = new Blob([bundle], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coagula-bundle-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImportBundle = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const success = actions.importRenderBundle(text);
        if (!success) {
          alert('Failed to import bundle. Invalid file format.');
        }
      }
    };
    input.click();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <CollapsibleSection title="Image Browser" defaultOpen={false}>
      <div className="space-y-3">
        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'recent'
                ? 'bg-primary text-white'
                : 'bg-surface-light text-text-dim hover:bg-white/10'
            }`}
          >
            <Clock size={12} />
            Recent
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'favorites'
                ? 'bg-primary text-white'
                : 'bg-surface-light text-text-dim hover:bg-white/10'
            }`}
          >
            <Heart size={12} />
            Favorites
          </button>
        </div>

        {/* Export/Import buttons */}
        <div className="flex gap-1">
          <button
            onClick={handleExportBundle}
            className="flex-1 px-2 py-1 text-[10px] rounded bg-surface-light text-text-dim hover:bg-white/10 flex items-center justify-center gap-1"
            title="Export current image with settings"
          >
            <Download size={10} />
            Export Bundle
          </button>
          <button
            onClick={handleImportBundle}
            className="flex-1 px-2 py-1 text-[10px] rounded bg-surface-light text-text-dim hover:bg-white/10 flex items-center justify-center gap-1"
            title="Import image with settings"
          >
            <Upload size={10} />
            Import Bundle
          </button>
        </div>

        {/* Image grid */}
        <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto">
          {filteredImages.length === 0 ? (
            <div className="col-span-4 text-center text-text-dim text-xs py-4">
              {activeTab === 'favorites' ? 'No favorites yet' : 'No recent images'}
            </div>
          ) : (
            filteredImages.map((img) => (
              <div
                key={img.id}
                onClick={() => handleImageClick(img)}
                className={`relative aspect-square cursor-pointer rounded overflow-hidden border-2 transition-all ${
                  selectedImage?.id === img.id
                    ? 'border-primary'
                    : 'border-transparent hover:border-white/30'
                }`}
              >
                <img
                  src={img.thumbnail}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
                {/* Favorite indicator */}
                {img.category === 'favorites' && (
                  <div className="absolute top-0.5 right-0.5">
                    <Star size={10} className="text-yellow-400 fill-yellow-400" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Selected image details */}
        {selectedImage && (
          <div className="bg-surface-light rounded p-2 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text truncate">{selectedImage.name}</div>
                <div className="text-[10px] text-text-dim">{formatDate(selectedImage.timestamp)}</div>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-0.5 hover:bg-white/10 rounded"
              >
                <X size={12} className="text-text-dim" />
              </button>
            </div>

            {/* Settings preview */}
            <div className="text-[9px] text-text-dim space-y-0.5">
              <div>Size: {selectedImage.settings.width}x{selectedImage.settings.height}</div>
              <div>Freq: {selectedImage.settings.lowFrequency}-{selectedImage.settings.highFrequency} Hz</div>
              <div>Duration: {selectedImage.settings.duration}s @ {selectedImage.settings.sampleRate / 1000}kHz</div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-1">
              <button
                onClick={handleLoad}
                className="flex-1 px-2 py-1 text-xs rounded bg-primary text-white hover:bg-primary/80"
              >
                Load
              </button>
              <button
                onClick={(e) => handleToggleFavorite(selectedImage.id, e)}
                className={`px-2 py-1 rounded ${
                  selectedImage.category === 'favorites'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-surface text-text-dim hover:bg-white/10'
                }`}
                title={selectedImage.category === 'favorites' ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={14} className={selectedImage.category === 'favorites' ? 'fill-yellow-400' : ''} />
              </button>
              <button
                onClick={(e) => handleDelete(selectedImage.id, e)}
                className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Save current button */}
        <button
          onClick={() => actions.addRecentImage()}
          className="w-full px-3 py-1.5 text-xs rounded bg-accent/50 text-white hover:bg-accent/70 transition-colors"
        >
          Save Current to Browser
        </button>
      </div>
    </CollapsibleSection>
  );
};
