import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ProjectSettings, DrawingTool, CanvasState, RenderState, FilterPreset, Selection, Clipboard, BrushPreset, BrushPresetSlot, RenderInfo, RecentImage, TimelineClip, TimelineState } from '../types';

interface AppState {
  project: {
    settings: ProjectSettings;
    name: string;
    modified: boolean;
  };
  canvas: CanvasState;
  render: RenderState;
  filters: FilterPreset[];
  history: {
    past: ImageData[];
    future: ImageData[];
  };
  selection: Selection | null;
  clipboard: Clipboard;
  brushPresets: Partial<Record<BrushPresetSlot, BrushPreset>>;
  cursorPosition: { x: number; y: number } | null;
  lastLoadedFilePath: string | null;
  originalImageData: ImageData | null;  // Store the original loaded image for refresh
  recentImages: RecentImage[];
  renderHistory: RenderInfo[];
  timeline: TimelineState;
  actions: {
    setSettings: (settings: Partial<ProjectSettings>) => void;
    setCanvasState: (state: Partial<CanvasState>) => void;
    setImageData: (imageData: ImageData) => void;
    pushHistory: (imageData: ImageData) => void;
    undo: () => void;
    redo: () => void;
    setRenderState: (state: Partial<RenderState>) => void;
    setFilters: (filters: FilterPreset[]) => void;
    setProjectName: (name: string) => void;
    setModified: (modified: boolean) => void;
    // Selection actions
    setSelection: (selection: Selection | null) => void;
    selectAll: () => void;
    clearSelection: () => void;
    copySelection: () => void;
    cutSelection: () => void;
    paste: () => void;
    deleteSelection: () => void;
    // File operations
    newCanvas: (width?: number, height?: number) => void;
    loadImageData: (imageData: ImageData, name?: string) => void;
    getProjectData: () => object;
    loadProjectData: (data: object) => void;
    // Brush presets
    saveBrushPreset: (slot: BrushPresetSlot) => void;
    loadBrushPreset: (slot: BrushPresetSlot) => boolean;
    // Cursor position
    setCursorPosition: (pos: { x: number; y: number } | null) => void;
    // File tracking
    setLastLoadedFilePath: (path: string | null) => void;
    refreshFromOriginal: () => boolean;  // Restore to originally loaded image
    // Render info storage
    saveRenderInfo: (name?: string) => RenderInfo | null;
    getRenderHistory: () => RenderInfo[];
    exportRenderBundle: () => string | null;  // Returns JSON string
    importRenderBundle: (json: string) => boolean;
    // Recent images
    addRecentImage: (name?: string) => void;
    loadRecentImage: (id: string) => boolean;
    toggleFavorite: (id: string) => void;
    removeRecentImage: (id: string) => void;
    getRecentImages: () => RecentImage[];
    clearRecentImages: () => void;
    // Timeline actions
    addClip: (imageData?: ImageData, settings?: ProjectSettings, name?: string) => string;
    removeClip: (clipId: string) => void;
    setActiveClip: (clipId: string) => void;
    updateClipSettings: (clipId: string, settings: Partial<ProjectSettings>) => void;
    updateClipDuration: (clipId: string, duration: number) => void;
    updateClipImage: (clipId: string, imageData: ImageData) => void;
    updateClipName: (clipId: string, name: string) => void;
    reorderClips: (clipIds: string[]) => void;
    duplicateClip: (clipId: string) => string | null;
    getClipAtTime: (time: number) => TimelineClip | null;
    syncActiveClipToCanvas: () => void;
    syncCanvasToActiveClip: () => void;
    calculateTotalDuration: () => number;
    initializeTimeline: () => void;
  };
}

const defaultTool: DrawingTool = {
  type: 'brush',
  size: 20,
  color: { r: 255, g: 255, b: 255 },
  secondaryColor: { r: 0, g: 0, b: 0 },
  hardness: 100,
  filled: true,
  noiseAmount: 0,
  mixMode: 'cover',
};

export const useStore = create<AppState>()(
  immer((set, get) => ({
    project: {
      settings: {
        width: 1024,
        height: 1024,
        sampleRate: 96000,
        lowFrequency: 20,
        highFrequency: 20000,
        duration: 10,
        amplitude: 0.8,
        noiseEnabled: true,
        noiseBandwidth: 50,
        frequencyScale: 'exponential',
        tempo: 120,
        pitch: 0,
      },
      name: 'Untitled',
      modified: false,
    },
    canvas: {
      zoom: 1,
      panX: 0,
      panY: 0,
      selectedTool: defaultTool,
      imageData: null,
    },
    render: {
      isPlaying: false,
      isRendering: false,
      isLooping: false,
      progress: 0,
      currentTime: 0,
    },
    filters: [],
    history: {
      past: [],
      future: [],
    },
    selection: null,
    clipboard: {
      imageData: null,
      width: 0,
      height: 0,
    },
    brushPresets: {},
    cursorPosition: null,
    lastLoadedFilePath: null,
    originalImageData: null,
    recentImages: [],
    renderHistory: [],
    timeline: {
      clips: [],
      activeClipId: null,
      totalDuration: 0,
    },
    actions: {
      setSettings: (settings) =>
        set((state) => {
          Object.assign(state.project.settings, settings);
          state.project.modified = true;
        }),
      setCanvasState: (newState) =>
        set((s) => {
          Object.assign(s.canvas, newState);
        }),
      setImageData: (imageData) =>
        set((state) => {
          state.canvas.imageData = imageData;
          state.project.modified = true;
        }),
      pushHistory: (imageData) =>
        set((state) => {
          if (state.canvas.imageData) {
            state.history.past.push(state.canvas.imageData);
            state.history.future = [];
          }
          state.canvas.imageData = imageData;
          state.project.modified = true;
        }),
      undo: () =>
        set((state) => {
          const previous = state.history.past.pop();
          if (previous && state.canvas.imageData) {
            state.history.future.push(state.canvas.imageData);
            state.canvas.imageData = previous;
            state.project.modified = true;
          }
        }),
      redo: () =>
        set((state) => {
          const next = state.history.future.pop();
          if (next && state.canvas.imageData) {
            state.history.past.push(state.canvas.imageData);
            state.canvas.imageData = next;
            state.project.modified = true;
          }
        }),
      setRenderState: (newState) =>
        set((s) => {
          Object.assign(s.render, newState);
        }),
      setFilters: (filters) =>
        set((state) => {
          state.filters = filters;
        }),
      setProjectName: (name) =>
        set((state) => {
          state.project.name = name;
        }),
      setModified: (modified) =>
        set((state) => {
          state.project.modified = modified;
        }),
      // Selection actions
      setSelection: (selection) =>
        set((state) => {
          state.selection = selection;
        }),
      selectAll: () =>
        set((state) => {
          const { width, height } = state.project.settings;
          state.selection = { x: 0, y: 0, width, height };
        }),
      clearSelection: () =>
        set((state) => {
          state.selection = null;
        }),
      copySelection: () => {
        const state = get();
        const { selection, canvas } = state;
        const { imageData } = canvas;

        if (!selection || !imageData) return;

        const { x, y, width: selWidth, height: selHeight } = selection;
        const { width: canvasWidth } = state.project.settings;

        // Create new ImageData for clipboard
        const clipboardData = new ImageData(selWidth, selHeight);

        for (let dy = 0; dy < selHeight; dy++) {
          for (let dx = 0; dx < selWidth; dx++) {
            const srcX = x + dx;
            const srcY = y + dy;
            const srcIdx = (srcY * canvasWidth + srcX) * 4;
            const dstIdx = (dy * selWidth + dx) * 4;

            clipboardData.data[dstIdx] = imageData.data[srcIdx];
            clipboardData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
            clipboardData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
            clipboardData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
          }
        }

        set((s) => {
          s.clipboard = {
            imageData: clipboardData,
            width: selWidth,
            height: selHeight,
          };
        });
      },
      cutSelection: () => {
        const { actions } = get();
        actions.copySelection();
        actions.deleteSelection();
      },
      paste: () => {
        const state = get();
        const { clipboard, canvas, selection } = state;
        const { imageData } = canvas;

        if (!clipboard.imageData || !imageData) return;

        const { width: canvasWidth, height: canvasHeight } = state.project.settings;
        const newImageData = new ImageData(
          new Uint8ClampedArray(imageData.data),
          canvasWidth,
          canvasHeight
        );

        // Paste at selection origin or top-left
        const pasteX = selection?.x ?? 0;
        const pasteY = selection?.y ?? 0;

        for (let dy = 0; dy < clipboard.height; dy++) {
          for (let dx = 0; dx < clipboard.width; dx++) {
            const dstX = pasteX + dx;
            const dstY = pasteY + dy;

            if (dstX >= 0 && dstX < canvasWidth && dstY >= 0 && dstY < canvasHeight) {
              const srcIdx = (dy * clipboard.width + dx) * 4;
              const dstIdx = (dstY * canvasWidth + dstX) * 4;

              newImageData.data[dstIdx] = clipboard.imageData.data[srcIdx];
              newImageData.data[dstIdx + 1] = clipboard.imageData.data[srcIdx + 1];
              newImageData.data[dstIdx + 2] = clipboard.imageData.data[srcIdx + 2];
              newImageData.data[dstIdx + 3] = clipboard.imageData.data[srcIdx + 3];
            }
          }
        }

        set((s) => {
          if (s.canvas.imageData) {
            s.history.past.push(s.canvas.imageData);
            s.history.future = [];
          }
          s.canvas.imageData = newImageData;
          s.project.modified = true;
          // Update selection to match pasted content
          s.selection = {
            x: pasteX,
            y: pasteY,
            width: clipboard.width,
            height: clipboard.height,
          };
        });
      },
      deleteSelection: () => {
        const state = get();
        const { selection, canvas } = state;
        const { imageData } = canvas;

        if (!selection || !imageData) return;

        const { x, y, width: selWidth, height: selHeight } = selection;
        const { width: canvasWidth, height: canvasHeight } = state.project.settings;

        const newImageData = new ImageData(
          new Uint8ClampedArray(imageData.data),
          canvasWidth,
          canvasHeight
        );

        // Fill selection with black (silence)
        for (let dy = 0; dy < selHeight; dy++) {
          for (let dx = 0; dx < selWidth; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 0 && px < canvasWidth && py >= 0 && py < canvasHeight) {
              const idx = (py * canvasWidth + px) * 4;
              newImageData.data[idx] = 0;
              newImageData.data[idx + 1] = 0;
              newImageData.data[idx + 2] = 0;
              newImageData.data[idx + 3] = 255;
            }
          }
        }

        set((s) => {
          if (s.canvas.imageData) {
            s.history.past.push(s.canvas.imageData);
            s.history.future = [];
          }
          s.canvas.imageData = newImageData;
          s.project.modified = true;
        });
      },
      // File operations
      newCanvas: (width?: number, height?: number) => {
        const state = get();
        const w = width ?? state.project.settings.width;
        const h = height ?? state.project.settings.height;

        const newImageData = new ImageData(w, h);
        for (let i = 0; i < newImageData.data.length; i += 4) {
          newImageData.data[i] = 0;
          newImageData.data[i + 1] = 0;
          newImageData.data[i + 2] = 0;
          newImageData.data[i + 3] = 255;
        }

        set((s) => {
          s.project.settings.width = w;
          s.project.settings.height = h;
          s.project.name = 'Untitled';
          s.project.modified = false;
          s.canvas.imageData = newImageData;
          s.canvas.zoom = 1;
          s.canvas.panX = 0;
          s.canvas.panY = 0;
          s.history.past = [];
          s.history.future = [];
          s.selection = null;
        });
      },
      loadImageData: (imageData: ImageData, name?: string) => {
        // Store a copy of the original for refresh functionality
        const originalCopy = new ImageData(
          new Uint8ClampedArray(imageData.data),
          imageData.width,
          imageData.height
        );
        set((s) => {
          s.project.settings.width = imageData.width;
          s.project.settings.height = imageData.height;
          s.project.name = name ?? 'Imported Image';
          s.project.modified = false;
          s.canvas.imageData = imageData;
          s.canvas.zoom = 1;
          s.canvas.panX = 0;
          s.canvas.panY = 0;
          s.history.past = [];
          s.history.future = [];
          s.selection = null;
          s.originalImageData = originalCopy;
        });
      },
      getProjectData: () => {
        const state = get();
        const { imageData } = state.canvas;

        // Convert ImageData to base64 for storage
        let imageBase64 = '';
        if (imageData) {
          const canvas = document.createElement('canvas');
          canvas.width = imageData.width;
          canvas.height = imageData.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.putImageData(imageData, 0, 0);
            imageBase64 = canvas.toDataURL('image/png');
          }
        }

        return {
          version: 1,
          project: {
            settings: state.project.settings,
            name: state.project.name,
          },
          canvas: {
            zoom: state.canvas.zoom,
            panX: state.canvas.panX,
            panY: state.canvas.panY,
            selectedTool: state.canvas.selectedTool,
          },
          imageBase64,
          filters: state.filters,
        };
      },
      loadProjectData: (data: any) => {
        if (!data || data.version !== 1) {
          console.error('Invalid project file');
          return;
        }

        // Load image from base64
        if (data.imageBase64) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, img.width, img.height);

              set((s) => {
                s.project.settings = data.project.settings;
                s.project.name = data.project.name;
                s.project.modified = false;
                s.canvas.imageData = imageData;
                s.canvas.zoom = data.canvas.zoom ?? 1;
                s.canvas.panX = data.canvas.panX ?? 0;
                s.canvas.panY = data.canvas.panY ?? 0;
                s.canvas.selectedTool = data.canvas.selectedTool ?? defaultTool;
                s.filters = data.filters ?? [];
                s.history.past = [];
                s.history.future = [];
                s.selection = null;
              });
            }
          };
          img.src = data.imageBase64;
        }
      },
      // Brush presets
      saveBrushPreset: (slot: BrushPresetSlot) => {
        const state = get();
        const tool = state.canvas.selectedTool;
        set((s) => {
          s.brushPresets[slot] = {
            tool: { ...tool },
            name: `Preset ${slot}`,
          };
        });
      },
      loadBrushPreset: (slot: BrushPresetSlot) => {
        const state = get();
        const preset = state.brushPresets[slot];
        if (preset) {
          set((s) => {
            s.canvas.selectedTool = { ...preset.tool };
          });
          return true;
        }
        return false;
      },
      // Cursor position
      setCursorPosition: (pos) =>
        set((s) => {
          s.cursorPosition = pos;
        }),
      // File tracking
      setLastLoadedFilePath: (path) =>
        set((s) => {
          s.lastLoadedFilePath = path;
        }),
      refreshFromOriginal: () => {
        const state = get();
        const { originalImageData } = state;
        if (!originalImageData) return false;

        // Create a fresh copy of the original
        const refreshedCopy = new ImageData(
          new Uint8ClampedArray(originalImageData.data),
          originalImageData.width,
          originalImageData.height
        );

        set((s) => {
          if (s.canvas.imageData) {
            s.history.past.push(s.canvas.imageData);
            s.history.future = [];
          }
          s.canvas.imageData = refreshedCopy;
          s.project.modified = false;
          s.selection = null;
        });
        return true;
      },
      // Render info storage
      saveRenderInfo: (name?: string) => {
        const state = get();
        const { imageData } = state.canvas;
        if (!imageData) return null;

        // Create thumbnail (64px max)
        const thumbCanvas = document.createElement('canvas');
        const scale = Math.min(64 / imageData.width, 64 / imageData.height);
        thumbCanvas.width = Math.round(imageData.width * scale);
        thumbCanvas.height = Math.round(imageData.height * scale);
        const thumbCtx = thumbCanvas.getContext('2d');

        // Create full canvas for thumbnail source
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = imageData.width;
        fullCanvas.height = imageData.height;
        const fullCtx = fullCanvas.getContext('2d');

        if (!thumbCtx || !fullCtx) return null;

        fullCtx.putImageData(imageData, 0, 0);
        thumbCtx.drawImage(fullCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

        const renderInfo: RenderInfo = {
          id: `render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          name: name ?? state.project.name,
          settings: { ...state.project.settings },
          thumbnail: thumbCanvas.toDataURL('image/png'),
        };

        set((s) => {
          s.renderHistory.unshift(renderInfo);
          // Keep last 50 renders
          if (s.renderHistory.length > 50) {
            s.renderHistory = s.renderHistory.slice(0, 50);
          }
        });

        // Persist to localStorage
        try {
          const history = get().renderHistory;
          localStorage.setItem('coagula-render-history', JSON.stringify(history));
        } catch (e) {
          console.warn('Failed to save render history to localStorage:', e);
        }

        return renderInfo;
      },
      getRenderHistory: () => {
        // Load from localStorage if empty
        const state = get();
        if (state.renderHistory.length === 0) {
          try {
            const stored = localStorage.getItem('coagula-render-history');
            if (stored) {
              const history = JSON.parse(stored) as RenderInfo[];
              set((s) => {
                s.renderHistory = history;
              });
              return history;
            }
          } catch (e) {
            console.warn('Failed to load render history:', e);
          }
        }
        return state.renderHistory;
      },
      exportRenderBundle: () => {
        const state = get();
        const { imageData } = state.canvas;
        if (!imageData) return null;

        // Create full image data URL
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.putImageData(imageData, 0, 0);
        const fullImage = canvas.toDataURL('image/png');

        const bundle = {
          version: 1,
          type: 'coagula-render-bundle',
          timestamp: Date.now(),
          name: state.project.name,
          settings: state.project.settings,
          image: fullImage,
        };

        return JSON.stringify(bundle, null, 2);
      },
      importRenderBundle: (json: string) => {
        try {
          const bundle = JSON.parse(json);
          if (bundle.type !== 'coagula-render-bundle' || !bundle.image) {
            return false;
          }

          // Load image from base64
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, img.width, img.height);

              set((s) => {
                s.project.settings = { ...s.project.settings, ...bundle.settings };
                s.project.name = bundle.name ?? 'Imported';
                s.project.modified = false;
                s.canvas.imageData = imageData;
                s.history.past = [];
                s.history.future = [];
                s.selection = null;
              });
            }
          };
          img.src = bundle.image;
          return true;
        } catch (e) {
          console.error('Failed to import render bundle:', e);
          return false;
        }
      },
      // Recent images
      addRecentImage: (name?: string) => {
        const state = get();
        const { imageData } = state.canvas;
        if (!imageData) return;

        // Create thumbnail (80px max)
        const thumbCanvas = document.createElement('canvas');
        const scale = Math.min(80 / imageData.width, 80 / imageData.height);
        thumbCanvas.width = Math.round(imageData.width * scale);
        thumbCanvas.height = Math.round(imageData.height * scale);
        const thumbCtx = thumbCanvas.getContext('2d');

        // Create full canvas
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = imageData.width;
        fullCanvas.height = imageData.height;
        const fullCtx = fullCanvas.getContext('2d');

        if (!thumbCtx || !fullCtx) return;

        fullCtx.putImageData(imageData, 0, 0);
        thumbCtx.drawImage(fullCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

        const recentImage: RecentImage = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: name ?? state.project.name,
          timestamp: Date.now(),
          thumbnail: thumbCanvas.toDataURL('image/png'),
          fullImage: fullCanvas.toDataURL('image/png'),
          settings: { ...state.project.settings },
          category: 'recent',
        };

        set((s) => {
          s.recentImages.unshift(recentImage);
          // Keep last 20 recent images
          if (s.recentImages.length > 20) {
            s.recentImages = s.recentImages.slice(0, 20);
          }
        });

        // Persist to localStorage
        try {
          const images = get().recentImages;
          localStorage.setItem('coagula-recent-images', JSON.stringify(images));
        } catch (e) {
          console.warn('Failed to save recent images to localStorage:', e);
        }
      },
      loadRecentImage: (id: string) => {
        const state = get();
        const recentImage = state.recentImages.find(img => img.id === id);
        if (!recentImage) return false;

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);

            set((s) => {
              if (s.canvas.imageData) {
                s.history.past.push(s.canvas.imageData);
                s.history.future = [];
              }
              s.project.settings = { ...recentImage.settings };
              s.project.name = recentImage.name;
              s.project.modified = false;
              s.canvas.imageData = imageData;
              s.selection = null;
            });
          }
        };
        img.src = recentImage.fullImage;
        return true;
      },
      toggleFavorite: (id: string) => {
        set((s) => {
          const img = s.recentImages.find(i => i.id === id);
          if (img) {
            img.category = img.category === 'favorites' ? 'recent' : 'favorites';
          }
        });
        // Persist
        try {
          const images = get().recentImages;
          localStorage.setItem('coagula-recent-images', JSON.stringify(images));
        } catch (e) {
          console.warn('Failed to save recent images:', e);
        }
      },
      removeRecentImage: (id: string) => {
        set((s) => {
          s.recentImages = s.recentImages.filter(i => i.id !== id);
        });
        // Persist
        try {
          const images = get().recentImages;
          localStorage.setItem('coagula-recent-images', JSON.stringify(images));
        } catch (e) {
          console.warn('Failed to save recent images:', e);
        }
      },
      getRecentImages: () => {
        // Load from localStorage if empty
        const state = get();
        if (state.recentImages.length === 0) {
          try {
            const stored = localStorage.getItem('coagula-recent-images');
            if (stored) {
              const images = JSON.parse(stored) as RecentImage[];
              set((s) => {
                s.recentImages = images;
              });
              return images;
            }
          } catch (e) {
            console.warn('Failed to load recent images:', e);
          }
        }
        return state.recentImages;
      },
      clearRecentImages: () => {
        set((s) => {
          s.recentImages = [];
        });
        try {
          localStorage.removeItem('coagula-recent-images');
        } catch (e) {
          console.warn('Failed to clear recent images:', e);
        }
      },
      // Timeline actions
      addClip: (imageData?: ImageData, settings?: ProjectSettings, name?: string) => {
        const state = get();
        const clipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Use provided data or current canvas/settings
        const clipImageData = imageData ?? state.canvas.imageData;
        const clipSettings = settings ?? { ...state.project.settings };

        if (!clipImageData) {
          // Create blank image if none exists
          const w = clipSettings.width;
          const h = clipSettings.height;
          const blankImageData = new ImageData(w, h);
          for (let i = 0; i < blankImageData.data.length; i += 4) {
            blankImageData.data[i] = 0;
            blankImageData.data[i + 1] = 0;
            blankImageData.data[i + 2] = 0;
            blankImageData.data[i + 3] = 255;
          }

          // Create thumbnail
          const thumbCanvas = document.createElement('canvas');
          const scale = Math.min(80 / w, 40 / h);
          thumbCanvas.width = Math.round(w * scale);
          thumbCanvas.height = Math.round(h * scale);
          const thumbCtx = thumbCanvas.getContext('2d');
          if (thumbCtx) {
            thumbCtx.fillStyle = '#000';
            thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
          }

          const newClip: TimelineClip = {
            id: clipId,
            name: name ?? `Clip ${state.timeline.clips.length + 1}`,
            imageData: blankImageData,
            settings: clipSettings,
            duration: clipSettings.duration,
            order: state.timeline.clips.length,
            thumbnail: thumbCanvas.toDataURL('image/png'),
          };

          set((s) => {
            s.timeline.clips.push(newClip);
            s.timeline.activeClipId = clipId;
            s.timeline.totalDuration += newClip.duration;
            s.canvas.imageData = blankImageData;
          });

          return clipId;
        }

        // Create thumbnail from existing image
        const thumbCanvas = document.createElement('canvas');
        const scale = Math.min(80 / clipImageData.width, 40 / clipImageData.height);
        thumbCanvas.width = Math.round(clipImageData.width * scale);
        thumbCanvas.height = Math.round(clipImageData.height * scale);
        const thumbCtx = thumbCanvas.getContext('2d');

        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = clipImageData.width;
        fullCanvas.height = clipImageData.height;
        const fullCtx = fullCanvas.getContext('2d');

        let thumbnail = '';
        if (thumbCtx && fullCtx) {
          fullCtx.putImageData(clipImageData, 0, 0);
          thumbCtx.drawImage(fullCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
          thumbnail = thumbCanvas.toDataURL('image/png');
        }

        // Make a copy of the imageData
        const imageCopy = new ImageData(
          new Uint8ClampedArray(clipImageData.data),
          clipImageData.width,
          clipImageData.height
        );

        const newClip: TimelineClip = {
          id: clipId,
          name: name ?? `Clip ${state.timeline.clips.length + 1}`,
          imageData: imageCopy,
          settings: clipSettings,
          duration: clipSettings.duration,
          order: state.timeline.clips.length,
          thumbnail,
        };

        set((s) => {
          s.timeline.clips.push(newClip);
          s.timeline.activeClipId = clipId;
          s.timeline.totalDuration += newClip.duration;
        });

        return clipId;
      },
      removeClip: (clipId: string) => {
        const state = get();
        const clipIndex = state.timeline.clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return;

        const clip = state.timeline.clips[clipIndex];

        set((s) => {
          s.timeline.clips.splice(clipIndex, 1);
          s.timeline.totalDuration -= clip.duration;

          // Reorder remaining clips
          s.timeline.clips.forEach((c, i) => {
            c.order = i;
          });

          // Update active clip if needed
          if (s.timeline.activeClipId === clipId) {
            if (s.timeline.clips.length > 0) {
              const newActiveIndex = Math.min(clipIndex, s.timeline.clips.length - 1);
              s.timeline.activeClipId = s.timeline.clips[newActiveIndex].id;
              s.canvas.imageData = s.timeline.clips[newActiveIndex].imageData;
            } else {
              s.timeline.activeClipId = null;
            }
          }
        });
      },
      setActiveClip: (clipId: string) => {
        const state = get();
        const clip = state.timeline.clips.find(c => c.id === clipId);
        if (!clip) return;

        // First sync current canvas to the previous active clip
        const { actions } = get();
        actions.syncCanvasToActiveClip();

        set((s) => {
          s.timeline.activeClipId = clipId;
          // Load the clip's image into the canvas
          s.canvas.imageData = new ImageData(
            new Uint8ClampedArray(clip.imageData.data),
            clip.imageData.width,
            clip.imageData.height
          );
          // Load the clip's settings
          s.project.settings = { ...clip.settings };
          // Clear history when switching clips
          s.history.past = [];
          s.history.future = [];
          s.selection = null;
        });
      },
      updateClipSettings: (clipId: string, settings: Partial<ProjectSettings>) => {
        set((s) => {
          const clip = s.timeline.clips.find(c => c.id === clipId);
          if (clip) {
            Object.assign(clip.settings, settings);
          }
        });
      },
      updateClipDuration: (clipId: string, duration: number) => {
        set((s) => {
          const clip = s.timeline.clips.find(c => c.id === clipId);
          if (clip) {
            s.timeline.totalDuration -= clip.duration;
            clip.duration = duration;
            clip.settings.duration = duration;
            s.timeline.totalDuration += duration;
          }
        });
      },
      updateClipImage: (clipId: string, imageData: ImageData) => {
        // Create thumbnail
        const thumbCanvas = document.createElement('canvas');
        const scale = Math.min(80 / imageData.width, 40 / imageData.height);
        thumbCanvas.width = Math.round(imageData.width * scale);
        thumbCanvas.height = Math.round(imageData.height * scale);
        const thumbCtx = thumbCanvas.getContext('2d');

        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = imageData.width;
        fullCanvas.height = imageData.height;
        const fullCtx = fullCanvas.getContext('2d');

        let thumbnail = '';
        if (thumbCtx && fullCtx) {
          fullCtx.putImageData(imageData, 0, 0);
          thumbCtx.drawImage(fullCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
          thumbnail = thumbCanvas.toDataURL('image/png');
        }

        set((s) => {
          const clip = s.timeline.clips.find(c => c.id === clipId);
          if (clip) {
            clip.imageData = new ImageData(
              new Uint8ClampedArray(imageData.data),
              imageData.width,
              imageData.height
            );
            clip.thumbnail = thumbnail;
          }
        });
      },
      updateClipName: (clipId: string, name: string) => {
        set((s) => {
          const clip = s.timeline.clips.find(c => c.id === clipId);
          if (clip) {
            clip.name = name;
          }
        });
      },
      reorderClips: (clipIds: string[]) => {
        set((s) => {
          const reordered: TimelineClip[] = [];
          clipIds.forEach((id, index) => {
            const clip = s.timeline.clips.find(c => c.id === id);
            if (clip) {
              clip.order = index;
              reordered.push(clip);
            }
          });
          s.timeline.clips = reordered;
        });
      },
      duplicateClip: (clipId: string) => {
        const state = get();
        const clip = state.timeline.clips.find(c => c.id === clipId);
        if (!clip) return null;

        // Create copies of image data
        const imageCopy = new ImageData(
          new Uint8ClampedArray(clip.imageData.data),
          clip.imageData.width,
          clip.imageData.height
        );

        const newClipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newClip: TimelineClip = {
          id: newClipId,
          name: `${clip.name} (Copy)`,
          imageData: imageCopy,
          settings: { ...clip.settings },
          duration: clip.duration,
          order: state.timeline.clips.length,
          thumbnail: clip.thumbnail,
        };

        set((s) => {
          s.timeline.clips.push(newClip);
          s.timeline.totalDuration += newClip.duration;
        });

        return newClipId;
      },
      getClipAtTime: (time: number) => {
        const state = get();
        let accumulatedTime = 0;

        for (const clip of state.timeline.clips) {
          if (time >= accumulatedTime && time < accumulatedTime + clip.duration) {
            return clip;
          }
          accumulatedTime += clip.duration;
        }

        return null;
      },
      syncActiveClipToCanvas: () => {
        const state = get();
        if (!state.timeline.activeClipId) return;

        const clip = state.timeline.clips.find(c => c.id === state.timeline.activeClipId);
        if (clip && clip.imageData) {
          set((s) => {
            s.canvas.imageData = new ImageData(
              new Uint8ClampedArray(clip.imageData.data),
              clip.imageData.width,
              clip.imageData.height
            );
          });
        }
      },
      syncCanvasToActiveClip: () => {
        const state = get();
        if (!state.timeline.activeClipId || !state.canvas.imageData) return;

        const { actions } = get();
        actions.updateClipImage(state.timeline.activeClipId, state.canvas.imageData);
        actions.updateClipSettings(state.timeline.activeClipId, state.project.settings);
      },
      calculateTotalDuration: () => {
        const state = get();
        return state.timeline.clips.reduce((total, clip) => total + clip.duration, 0);
      },
      initializeTimeline: () => {
        const state = get();
        // Only initialize if timeline is empty and canvas has content
        if (state.timeline.clips.length === 0 && state.canvas.imageData) {
          const { actions } = get();
          actions.addClip(state.canvas.imageData, state.project.settings, state.project.name);
        }
      },
    },
  }))
);
