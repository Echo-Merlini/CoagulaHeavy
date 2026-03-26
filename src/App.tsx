import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from './store';
import { AudioEngine } from './engine';
import { ImageCanvas } from './components/Canvas';
import { Toolbar, Transport, ParameterPanel, StatusBar, FileMenu, EffectsMenu, RenderingOverlay, TimelinePanel } from './components/UI';
import { InlineSpectralAnalyzer } from './components/UI/InlineSpectralAnalyzer';
import { removeExcessBlue, applyHeat, applyGradientFill, GradientDirection } from './utils/boil';

const App: React.FC = () => {
  const { project, canvas, render, timeline, actions } = useStore();
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const animationRef = useRef<number>();
  const boilIntervalRef = useRef<number>();
  const [isBoiling, setIsBoiling] = useState(false);
  const [gradientDirection, setGradientDirection] = useState<GradientDirection>('right');
  const [showInlineAnalyzer, setShowInlineAnalyzer] = useState(false);

  useEffect(() => {
    audioEngineRef.current = new AudioEngine(project.settings);
    audioEngineRef.current.initialize();

    return () => {
      audioEngineRef.current?.dispose();
    };
  }, []);

  // Update audio engine when any setting changes
  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setSettings(project.settings);
    }
  }, [
    project.settings.sampleRate,
    project.settings.lowFrequency,
    project.settings.highFrequency,
    project.settings.duration,
    project.settings.amplitude,
    project.settings.noiseEnabled,
    project.settings.noiseBandwidth,
    project.settings.frequencyScale,
    project.settings.tempo,
    project.settings.pitch,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              actions.redo();
            } else {
              actions.undo();
            }
            break;
          case 'y':
            e.preventDefault();
            actions.redo();
            break;
          case 's':
            e.preventDefault();
            // Save project
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
            break;
          case 'e':
            e.preventDefault();
            handleExport();
            break;
          case 'n':
            e.preventDefault();
            // New canvas - show dialog via state
            actions.newCanvas();
            break;
          case 'a':
            e.preventDefault();
            actions.selectAll();
            break;
          case 'c':
            e.preventDefault();
            actions.copySelection();
            break;
          case 'x':
            e.preventDefault();
            actions.cutSelection();
            break;
          case 'v':
            e.preventDefault();
            actions.paste();
            break;
          case 'b':
            e.preventDefault();
            // Remove excess blue
            if (canvas.imageData) {
              const result = removeExcessBlue(canvas.imageData);
              actions.pushHistory(result);
            }
            break;
          case 'r':
            e.preventDefault();
            // Ctrl+R: Refresh from original loaded image
            actions.refreshFromOriginal();
            break;
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+F5: Render selection only
          handlePlaySelection();
        } else {
          // F5: Render full image
          handlePlayFull();
        }
      } else if (e.key === 'F6') {
        e.preventDefault();
        // F6: Play entire timeline
        handlePlayTimeline();
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+F12: Cycle gradient direction
          const directions: GradientDirection[] = ['right', 'down', 'diagonal', 'noise'];
          const currentIdx = directions.indexOf(gradientDirection);
          const nextIdx = (currentIdx + 1) % directions.length;
          setGradientDirection(directions[nextIdx]);
        } else if (canvas.imageData) {
          // F12: Apply gradient fill from brush color to secondary color
          const selection = useStore.getState().selection;
          const result = applyGradientFill(canvas.imageData, {
            fromColor: canvas.selectedTool.color,
            toColor: canvas.selectedTool.secondaryColor,
            direction: gradientDirection,
            selection,
          });
          actions.pushHistory(result);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        if (render.isPlaying) {
          handleStop();
        } else {
          handlePlay();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Abort render if rendering
        if (render.isRendering && audioEngineRef.current) {
          audioEngineRef.current.abortRender();
          actions.setRenderState({ isRendering: false });
        }
        // Stop playback if playing
        if (render.isPlaying) {
          handleStop();
        }
        actions.clearSelection();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        actions.deleteSelection();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setShowInlineAnalyzer(prev => !prev);
      } else {
        // Tool shortcuts (excluding C which is used for continuous boil)
        const toolShortcuts: Record<string, 'brush' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle' | 'spray' | 'select' | 'move' | 'noise' | 'boil'> = {
          'b': 'brush',
          'e': 'eraser',
          'g': 'fill',
          'l': 'line',
          'r': 'rect',
          's': 'spray',
          'v': 'select',
          'm': 'move',
          'n': 'noise',
          'h': 'boil',
        };
        const toolType = toolShortcuts[e.key.toLowerCase()];
        if (toolType) {
          e.preventDefault();
          actions.setCanvasState({
            selectedTool: { ...canvas.selectedTool, type: toolType }
          });
        }
        // Toggle filled/outline for shapes
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          actions.setCanvasState({
            selectedTool: { ...canvas.selectedTool, filled: !canvas.selectedTool.filled }
          });
        }
        // Brush presets: Alt+key to load, Ctrl+Alt+key to save
        const presetKeys = ['1', '2', '3', '4', '5', '6', '7', '8', 'a', 'b'];
        const keyLower = e.key.toLowerCase();
        if (e.altKey && presetKeys.includes(keyLower)) {
          e.preventDefault();
          const slotBase = keyLower === 'a' ? 'A' : keyLower === 'b' ? 'B' : keyLower;
          const slot = e.shiftKey ? `Shift+${slotBase}` : slotBase;
          if (e.ctrlKey || e.metaKey) {
            // Save preset
            actions.saveBrushPreset(slot as any);
          } else {
            // Load preset
            actions.loadBrushPreset(slot as any);
          }
        }
        // Continuous boil - hold C
        if (e.key.toLowerCase() === 'c' && !e.repeat && canvas.imageData) {
          e.preventDefault();
          setIsBoiling(true);
          // Apply heat immediately
          const result = applyHeat(canvas.imageData, { amount: 15, wrapColors: true });
          actions.setImageData(result);
          // Start interval for continuous effect
          boilIntervalRef.current = window.setInterval(() => {
            const currentState = useStore.getState();
            if (currentState.canvas.imageData) {
              const boiled = applyHeat(currentState.canvas.imageData, { amount: 15, wrapColors: true });
              currentState.actions.setImageData(boiled);
            }
          }, 100);
        }
        // Circle tool with Shift+C
        if (e.key.toLowerCase() === 'c' && e.shiftKey) {
          e.preventDefault();
          actions.setCanvasState({
            selectedTool: { ...canvas.selectedTool, type: 'circle' }
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Stop continuous boil when C is released
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && isBoiling) {
        setIsBoiling(false);
        if (boilIntervalRef.current) {
          clearInterval(boilIntervalRef.current);
          boilIntervalRef.current = undefined;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (boilIntervalRef.current) {
        clearInterval(boilIntervalRef.current);
      }
    };
  }, [render.isPlaying, actions, canvas.selectedTool, canvas.imageData, isBoiling, gradientDirection, timeline.clips]);

  useEffect(() => {
    const updateTime = () => {
      if (audioEngineRef.current && render.isPlaying) {
        actions.setRenderState({ 
          currentTime: audioEngineRef.current.getCurrentTime() 
        });
      }
      animationRef.current = requestAnimationFrame(updateTime);
    };

    if (render.isPlaying) {
      updateTime();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render.isPlaying, actions]);

  const handlePlay = useCallback(async () => {
    if (!canvas.imageData || !audioEngineRef.current) return;
    const state = useStore.getState();
    const selection = state.selection;
    const isLooping = state.render.isLooping;

    // Ensure AudioEngine has the latest settings before synthesis
    audioEngineRef.current.setSettings(state.project.settings);

    // Show rendering overlay immediately
    actions.setRenderState({ isRendering: true, progress: 0 });

    // Auto-save render info
    actions.saveRenderInfo();

    // Set callback for when playback ends naturally
    audioEngineRef.current.setOnPlaybackEnd(() => {
      actions.setRenderState({ isPlaying: false, currentTime: 0 });
    });

    try {
      await audioEngineRef.current.startPreview(canvas.imageData, {
        selection,
        loop: isLooping,
        onProgress: (progress) => {
          actions.setRenderState({ progress });
        }
      });
      actions.setRenderState({ isRendering: false, isPlaying: true });
    } catch (error) {
      console.error('Playback failed:', error);
      actions.setRenderState({ isRendering: false, isPlaying: false });
    }
  }, [canvas.imageData, actions]);

  // F5: Render full image (ignores selection)
  const handlePlayFull = useCallback(async () => {
    if (!canvas.imageData || !audioEngineRef.current) return;
    const state = useStore.getState();
    const isLooping = state.render.isLooping;

    // Ensure AudioEngine has the latest settings before synthesis
    audioEngineRef.current.setSettings(state.project.settings);

    // Show rendering overlay immediately
    actions.setRenderState({ isRendering: true, progress: 0 });

    audioEngineRef.current.setOnPlaybackEnd(() => {
      actions.setRenderState({ isPlaying: false, currentTime: 0 });
    });

    try {
      // Pass null selection to render full image
      await audioEngineRef.current.startPreview(canvas.imageData, {
        selection: null,
        loop: isLooping,
        onProgress: (progress) => {
          actions.setRenderState({ progress });
        }
      });
      actions.setRenderState({ isRendering: false, isPlaying: true });
    } catch (error) {
      console.error('Playback failed:', error);
      actions.setRenderState({ isRendering: false, isPlaying: false });
    }
  }, [canvas.imageData, actions]);

  // Shift+F5: Render selection only
  const handlePlaySelection = useCallback(async () => {
    if (!canvas.imageData || !audioEngineRef.current) return;
    const state = useStore.getState();
    const selection = state.selection;
    const isLooping = state.render.isLooping;

    if (!selection) {
      // No selection, render full image
      await handlePlayFull();
      return;
    }

    // Ensure AudioEngine has the latest settings before synthesis
    audioEngineRef.current.setSettings(state.project.settings);

    // Show rendering overlay immediately
    actions.setRenderState({ isRendering: true, progress: 0 });

    audioEngineRef.current.setOnPlaybackEnd(() => {
      actions.setRenderState({ isPlaying: false, currentTime: 0 });
    });

    try {
      await audioEngineRef.current.startPreview(canvas.imageData, {
        selection,
        loop: isLooping,
        onProgress: (progress) => {
          actions.setRenderState({ progress });
        }
      });
      actions.setRenderState({ isRendering: false, isPlaying: true });
    } catch (error) {
      console.error('Playback failed:', error);
      actions.setRenderState({ isRendering: false, isPlaying: false });
    }
  }, [canvas.imageData, actions, handlePlayFull]);

  const handleStop = useCallback(async () => {
    if (!audioEngineRef.current) return;

    await audioEngineRef.current.stopPreview();
    actions.setRenderState({ isPlaying: false, currentTime: 0 });
  }, [actions]);

  const handleToggleLoop = useCallback(() => {
    const newLooping = !useStore.getState().render.isLooping;
    actions.setRenderState({ isLooping: newLooping });
    if (audioEngineRef.current) {
      audioEngineRef.current.setLooping(newLooping);
    }
  }, [actions]);

  const handlePreviewRequest = useCallback(() => {
    if (render.isPlaying) {
      handleStop().then(() => {
        setTimeout(() => handlePlay(), 100);
      });
    }
  }, [render.isPlaying, handleStop, handlePlay]);

  const handleExport = useCallback(async () => {
    if (!canvas.imageData || !audioEngineRef.current) return;
    const selection = useStore.getState().selection;

    setIsExporting(true);
    actions.setRenderState({ isRendering: true, progress: 0 });

    try {
      const blob = await audioEngineRef.current.renderToWav(canvas.imageData, {
        selection,
        onProgress: (progress) => {
          actions.setRenderState({ progress });
        }
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\.[^/.]+$/, '')}_${project.settings.sampleRate / 1000}kHz.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      actions.setRenderState({ isRendering: false, progress: 0 });
    }
  }, [canvas.imageData, project, actions]);

  // Handle importing an image as a new clip
  const handleImportClip = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);

          // Create clip settings based on current settings but adjusted for image size
          const clipSettings = {
            ...project.settings,
            width: img.width,
            height: img.height,
          };

          actions.addClip(imageData, clipSettings, file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      img.src = URL.createObjectURL(file);
    };
    input.click();
  }, [project.settings, actions]);

  // Play entire timeline
  const handlePlayTimeline = useCallback(async () => {
    if (!audioEngineRef.current || timeline.clips.length === 0) return;

    const state = useStore.getState();
    const isLooping = state.render.isLooping;

    // Sync current canvas to active clip before playing
    actions.syncCanvasToActiveClip();

    // Show rendering overlay
    actions.setRenderState({ isRendering: true, progress: 0 });

    audioEngineRef.current.setOnPlaybackEnd(() => {
      actions.setRenderState({ isPlaying: false, currentTime: 0 });
    });

    try {
      await audioEngineRef.current.startPreviewTimeline(timeline.clips, {
        loop: isLooping,
        onProgress: (progress) => {
          actions.setRenderState({ progress });
        }
      });
      actions.setRenderState({ isRendering: false, isPlaying: true });
    } catch (error) {
      console.error('Timeline playback failed:', error);
      actions.setRenderState({ isRendering: false, isPlaying: false });
    }
  }, [timeline.clips, actions]);

  // Export entire timeline to WAV
  const handleExportTimeline = useCallback(async () => {
    if (!audioEngineRef.current || timeline.clips.length === 0) return;

    // Sync current canvas to active clip before export
    actions.syncCanvasToActiveClip();

    setIsExporting(true);
    actions.setRenderState({ isRendering: true, progress: 0 });

    try {
      const blob = await audioEngineRef.current.renderTimelineToWav(timeline.clips, {
        onProgress: (progress) => {
          actions.setRenderState({ progress });
        }
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}_timeline_${project.settings.sampleRate / 1000}kHz.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Timeline export failed:', error);
    } finally {
      setIsExporting(false);
      actions.setRenderState({ isRendering: false, progress: 0 });
    }
  }, [timeline.clips, project, actions]);

  useEffect(() => {
    if (!canvas.imageData) {
      const { width, height } = project.settings;
      const newImageData = new ImageData(width, height);
      for (let i = 0; i < newImageData.data.length; i += 4) {
        newImageData.data[i] = 0;
        newImageData.data[i + 1] = 0;
        newImageData.data[i + 2] = 0;
        newImageData.data[i + 3] = 255;
      }
      actions.setImageData(newImageData);
      actions.pushHistory(newImageData);
    }

    // Initialize timeline with first clip if empty
    if (timeline.clips.length === 0 && canvas.imageData) {
      actions.initializeTimeline();
    }
  }, []);

  // Sync canvas changes to active clip when canvas is modified
  useEffect(() => {
    if (canvas.imageData && timeline.activeClipId) {
      // Debounce updates to avoid too frequent syncs
      const timeoutId = setTimeout(() => {
        actions.syncCanvasToActiveClip();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [canvas.imageData, timeline.activeClipId]);

  return (
    <div className="flex flex-col h-screen bg-background text-text">
      <header className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-white/10">
        <h1 className="text-lg font-semibold tracking-wide mr-4">
          <span className="text-primary">Coagula</span>
          <span className="text-text-dim">Heavy</span>
        </h1>

        <FileMenu onExportWav={handleExport} />
        <EffectsMenu />

        <div className="flex-1" />

        {/* Analyzer toggle button */}
        <button
          onClick={() => setShowInlineAnalyzer(!showInlineAnalyzer)}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition-colors mr-4 ${
            showInlineAnalyzer
              ? 'bg-accent text-white'
              : 'bg-surface-light text-text-dim hover:bg-white/10 border border-white/10'
          }`}
          title="Toggle spectral analyzer (Tab)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h2v6H3zM7 8h2v10H7zM11 4h2v16h-2zM15 10h2v8h-2zM19 6h2v12h-2z"/>
          </svg>
          Analyzer
        </button>

        <div className="flex items-center gap-2 text-xs text-text-dim">
          <span>F5: Render</span>
          <span>•</span>
          <span>Space: Play/Stop</span>
          <span>•</span>
          <span>Ctrl+Z: Undo</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Canvas area */}
            <div className="flex-1 relative">
              <ImageCanvas onPreviewRequest={handlePreviewRequest} />
            </div>

            {/* Inline Spectral Analyzer Panel - Expanded Version */}
            {showInlineAnalyzer && (
              <InlineSpectralAnalyzer
                audioEngine={audioEngineRef.current}
                onClose={() => setShowInlineAnalyzer(false)}
              />
            )}
          </div>

          {/* Timeline Panel */}
          <TimelinePanel
            currentTime={render.currentTime}
            isPlaying={render.isPlaying}
            onImportClip={handleImportClip}
          />

          <Transport
            onPlay={timeline.clips.length > 1 ? handlePlayTimeline : handlePlay}
            onStop={handleStop}
            onExport={timeline.clips.length > 1 ? handleExportTimeline : handleExport}
            onToggleLoop={handleToggleLoop}
            isPlaying={render.isPlaying}
            isExporting={isExporting}
          />
        </main>

        <ParameterPanel audioEngine={audioEngineRef.current} />
      </div>

      <StatusBar />

      {/* Rendering overlay */}
      <RenderingOverlay
        isRendering={render.isRendering}
        progress={render.progress}
        message="Synthesizing audio..."
        onCancel={() => {
          if (audioEngineRef.current) {
            audioEngineRef.current.abortRender();
          }
          actions.setRenderState({ isRendering: false, isPlaying: false, progress: 0 });
        }}
      />
    </div>
  );
};

export default App;
