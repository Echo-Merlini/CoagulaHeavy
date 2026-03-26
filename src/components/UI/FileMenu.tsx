import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import {
  ChevronDown, FilePlus, FolderOpen, Download, Image, FileJson
} from 'lucide-react';

interface FileMenuProps {
  onExportWav: () => void;
}

export const FileMenu: React.FC<FileMenuProps> = ({ onExportWav }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newWidth, setNewWidth] = useState(1024);
  const [newHeight, setNewHeight] = useState(1024);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const { project, canvas, actions } = useStore();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNew = () => {
    setShowNewDialog(true);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    actions.newCanvas(newWidth, newHeight);
    setShowNewDialog(false);
  };

  const handleOpenImage = () => {
    fileInputRef.current?.click();
    setIsOpen(false);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        actions.loadImageData(imageData, file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    img.src = URL.createObjectURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleSaveImage = () => {
    if (!canvas.imageData) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.imageData.width;
    tempCanvas.height = canvas.imageData.height;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(canvas.imageData, 0, 0);
      const url = tempCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setIsOpen(false);
  };

  const handleSaveProject = () => {
    const projectData = actions.getProjectData();
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.coagula`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    actions.setModified(false);
    setIsOpen(false);
  };

  const handleOpenProject = () => {
    projectInputRef.current?.click();
    setIsOpen(false);
  };

  const handleProjectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        actions.loadProjectData(data);
        actions.setProjectName(file.name.replace(/\.[^/.]+$/, ''));
      } catch (err) {
        console.error('Failed to load project:', err);
        alert('Failed to load project file');
      }
    };
    reader.readAsText(file);

    e.target.value = '';
  };

  const handleExportWav = () => {
    onExportWav();
    setIsOpen(false);
  };

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-3 py-1.5 rounded hover:bg-white/10 text-sm"
        >
          File
          <ChevronDown size={14} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-surface border border-white/10 rounded-lg shadow-xl z-50">
            <div className="py-1">
              <button
                onClick={handleNew}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <FilePlus size={16} />
                New Canvas
                <span className="ml-auto text-text-dim text-xs">Ctrl+N</span>
              </button>

              <div className="h-px bg-white/10 my-1" />

              <button
                onClick={handleOpenImage}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <Image size={16} />
                Open Image...
                <span className="ml-auto text-text-dim text-xs">Ctrl+O</span>
              </button>

              <button
                onClick={handleOpenProject}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <FolderOpen size={16} />
                Open Project...
              </button>

              <div className="h-px bg-white/10 my-1" />

              <button
                onClick={handleSaveImage}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <Image size={16} />
                Save Image (PNG)
              </button>

              <button
                onClick={handleSaveProject}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <FileJson size={16} />
                Save Project
                <span className="ml-auto text-text-dim text-xs">Ctrl+S</span>
              </button>

              <div className="h-px bg-white/10 my-1" />

              <button
                onClick={handleExportWav}
                className="flex items-center gap-3 w-full px-4 py-2 text-left text-sm hover:bg-white/10"
              >
                <Download size={16} />
                Export WAV
                <span className="ml-auto text-text-dim text-xs">Ctrl+E</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".coagula,.json"
        className="hidden"
        onChange={handleProjectFileChange}
      />

      {/* New Canvas Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-white/10 rounded-lg p-6 w-80">
            <h2 className="text-lg font-medium mb-4">New Canvas</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-dim mb-1">Width (px)</label>
                <input
                  type="number"
                  value={newWidth}
                  onChange={(e) => setNewWidth(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded text-sm"
                  min={1}
                  max={4096}
                />
              </div>

              <div>
                <label className="block text-sm text-text-dim mb-1">Height (px)</label>
                <input
                  type="number"
                  value={newHeight}
                  onChange={(e) => setNewHeight(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded text-sm"
                  min={1}
                  max={4096}
                />
              </div>

              <div className="text-xs text-text-dim">
                Presets:
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => { setNewWidth(512); setNewHeight(512); }}
                    className="px-2 py-1 bg-white/5 rounded hover:bg-white/10"
                  >
                    512²
                  </button>
                  <button
                    onClick={() => { setNewWidth(1024); setNewHeight(1024); }}
                    className="px-2 py-1 bg-white/5 rounded hover:bg-white/10"
                  >
                    1024²
                  </button>
                  <button
                    onClick={() => { setNewWidth(2048); setNewHeight(512); }}
                    className="px-2 py-1 bg-white/5 rounded hover:bg-white/10"
                  >
                    2048×512
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowNewDialog(false)}
                className="px-4 py-2 text-sm hover:bg-white/10 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 text-sm bg-primary hover:bg-accent rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
