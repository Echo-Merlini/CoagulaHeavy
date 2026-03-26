import { AudioChannel, ProjectSettings, Selection, TimelineClip } from '../types';

export interface RenderOptions {
  selection?: Selection | null;
  onProgress?: (progress: number) => void;
  abortSignal?: AbortController;
  softEnvelope?: boolean;
  loop?: boolean;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isPlaying: boolean = false;
  private settings: ProjectSettings;
  private oscillators: OscillatorNode[] = [];
  private noiseNodes: AudioBufferSourceNode[] = [];
  private startTime: number = 0;
  private abortController: AbortController | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isLooping: boolean = false;
  private onPlaybackEnd: (() => void) | null = null;

  constructor(settings: ProjectSettings) {
    this.settings = settings;
  }

  async initialize(): Promise<void> {
    if (this.context) return;

    this.context = new AudioContext({ sampleRate: this.settings.sampleRate });
    this.masterGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.masterGain.gain.value = this.settings.amplitude;
  }

  setSettings(settings: Partial<ProjectSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (this.masterGain) {
      this.masterGain.gain.value = this.settings.amplitude;
    }
  }

  async startPreview(imageData: ImageData, options: RenderOptions = {}): Promise<void> {
    if (!this.context) await this.initialize();
    if (this.isPlaying) await this.stopPreview();

    await this.context!.resume();
    this.isPlaying = true;
    this.isLooping = options.loop ?? false;
    this.startTime = this.context!.currentTime;

    // Use async synthesis to avoid blocking UI
    const channels = await this.synthesizeAsync(imageData, options);

    // Check if we were aborted during synthesis
    if (options.abortSignal?.signal.aborted || !this.isPlaying) {
      return;
    }

    this.schedulePlayback(channels);
  }

  setOnPlaybackEnd(callback: (() => void) | null): void {
    this.onPlaybackEnd = callback;
  }

  setLooping(loop: boolean): void {
    this.isLooping = loop;
    if (this.currentSource) {
      this.currentSource.loop = loop;
    }
  }

  getIsLooping(): boolean {
    return this.isLooping;
  }

  async stopPreview(): Promise<void> {
    // Stop the buffer source if playing
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentSource = null;
    }
    // Legacy oscillator cleanup
    this.oscillators.forEach(osc => {
      try { osc.stop(); } catch (e) { /* ignore */ }
    });
    this.noiseNodes.forEach(node => {
      try { node.stop(); } catch (e) { /* ignore */ }
    });
    this.oscillators = [];
    this.noiseNodes = [];
    this.isPlaying = false;
  }

  private synthesize(imageData: ImageData, options: RenderOptions = {}): AudioChannel {
    const { lowFrequency, highFrequency, sampleRate, duration, noiseEnabled, noiseBandwidth, tempo = 120, pitch = 0 } = this.settings;
    const { selection, onProgress, abortSignal, softEnvelope = true } = options;

    // Apply tempo: 120 BPM is base, higher = faster/shorter, lower = slower/longer
    const tempoFactor = 120 / tempo;
    const effectiveDuration = duration * tempoFactor;

    // Calculate pitch shift multiplier: 2^(semitones/12)
    const pitchMultiplier = Math.pow(2, pitch / 12);

    // Determine render bounds
    const renderX = selection?.x ?? 0;
    const renderWidth = selection?.width ?? imageData.width;
    const renderY = selection?.y ?? 0;
    const renderHeight = selection?.height ?? imageData.height;

    const numSamples = Math.floor(sampleRate * effectiveDuration);
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    const data = imageData.data;
    const imgWidth = imageData.width;
    const samplesPerPixel = numSamples / renderWidth;

    for (let relY = 0; relY < renderHeight; relY++) {
      // Check for abort
      if (abortSignal?.signal.aborted) {
        break;
      }

      const y = renderY + relY;
      // Apply pitch shift to frequency
      const baseFrequency = this.frequencyFromY(relY, renderHeight, lowFrequency, highFrequency);
      const frequency = baseFrequency * pitchMultiplier;
      const phase = Math.random() * Math.PI * 2;

      for (let relX = 0; relX < renderWidth; relX++) {
        const x = renderX + relX;
        const pixelIndex = (y * imgWidth + x) * 4;
        const r = data[pixelIndex] / 255;
        const g = data[pixelIndex + 1] / 255;
        const b = data[pixelIndex + 2] / 255;

        const startSample = Math.floor(relX * samplesPerPixel);
        const endSample = Math.min(Math.floor((relX + 1) * samplesPerPixel), numSamples);

        for (let sample = startSample; sample < endSample; sample++) {
          const t = (sample / sampleRate) * frequency * Math.PI * 2;

          // Soft envelope: half-cosine for smoother attack/release
          let envelope: number;
          if (softEnvelope) {
            const progress = sample / numSamples;
            // Attack phase (first 5%)
            if (progress < 0.05) {
              envelope = (1 - Math.cos(progress / 0.05 * Math.PI)) / 2;
            }
            // Release phase (last 5%)
            else if (progress > 0.95) {
              envelope = (1 + Math.cos((progress - 0.95) / 0.05 * Math.PI)) / 2;
            }
            // Sustain phase
            else {
              envelope = 1;
            }
          } else {
            envelope = Math.sin((sample / numSamples) * Math.PI);
          }

          if (r > 0.01) {
            left[sample] += r * envelope * Math.sin(t + phase);
          }
          if (g > 0.01) {
            right[sample] += g * envelope * Math.sin(t + phase);
          }
          if (b > 0.01 && noiseEnabled) {
            // Bandwidth: 0 = tonal (sine), 100 = white noise
            const bwFactor = (noiseBandwidth ?? 50) / 100;
            const tonal = Math.sin(t + phase) * (1 - bwFactor);
            const white = (Math.random() * 2 - 1) * bwFactor;
            const noise = (tonal + white) * b * envelope;
            left[sample] += noise * 0.5;
            right[sample] += noise * 0.5;
          }
        }
      }

      // Report progress
      if (onProgress) {
        onProgress((relY + 1) / renderHeight);
      }
    }

    this.normalize(left);
    this.normalize(right);

    return { left, right };
  }

  // Async version of synthesize that yields to main thread to prevent UI blocking
  private async synthesizeAsync(imageData: ImageData, options: RenderOptions = {}): Promise<AudioChannel> {
    const { lowFrequency, highFrequency, sampleRate, duration, noiseEnabled, noiseBandwidth, tempo = 120, pitch = 0 } = this.settings;
    const { selection, onProgress, abortSignal, softEnvelope = true } = options;

    // Apply tempo and pitch
    const tempoFactor = 120 / tempo;
    const effectiveDuration = duration * tempoFactor;
    const pitchMultiplier = Math.pow(2, pitch / 12);

    // Determine render bounds
    const renderX = selection?.x ?? 0;
    const renderWidth = selection?.width ?? imageData.width;
    const renderY = selection?.y ?? 0;
    const renderHeight = selection?.height ?? imageData.height;

    const numSamples = Math.floor(sampleRate * effectiveDuration);
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    const data = imageData.data;
    const imgWidth = imageData.width;
    const samplesPerPixel = numSamples / renderWidth;

    // Process in chunks, yielding to main thread every N rows
    const ROWS_PER_CHUNK = Math.max(1, Math.floor(renderHeight / 50)); // ~50 progress updates
    let processedRows = 0;

    const processChunk = async (startRow: number, endRow: number): Promise<void> => {
      for (let relY = startRow; relY < endRow; relY++) {
        // Check for abort
        if (abortSignal?.signal.aborted) {
          return;
        }

        const y = renderY + relY;

        // Pre-pass: skip rows with no significant pixel energy (saves synthesis time)
        let rowHasEnergy = false;
        for (let relX = 0; relX < renderWidth; relX++) {
          const x = renderX + relX;
          const idx = (y * imgWidth + x) * 4;
          if (data[idx] > 2 || data[idx + 1] > 2 || data[idx + 2] > 2) {
            rowHasEnergy = true;
            break;
          }
        }
        if (!rowHasEnergy) {
          processedRows++;
          continue;
        }

        const baseFrequency = this.frequencyFromY(relY, renderHeight, lowFrequency, highFrequency);
        const frequency = baseFrequency * pitchMultiplier;
        const phase = Math.random() * Math.PI * 2;

        for (let relX = 0; relX < renderWidth; relX++) {
          const x = renderX + relX;
          const pixelIndex = (y * imgWidth + x) * 4;
          const r = data[pixelIndex] / 255;
          const g = data[pixelIndex + 1] / 255;
          const b = data[pixelIndex + 2] / 255;

          const startSample = Math.floor(relX * samplesPerPixel);
          const endSample = Math.min(Math.floor((relX + 1) * samplesPerPixel), numSamples);

          for (let sample = startSample; sample < endSample; sample++) {
            const t = (sample / sampleRate) * frequency * Math.PI * 2;

            // Soft envelope
            let envelope: number;
            if (softEnvelope) {
              const progress = sample / numSamples;
              if (progress < 0.05) {
                envelope = (1 - Math.cos(progress / 0.05 * Math.PI)) / 2;
              } else if (progress > 0.95) {
                envelope = (1 + Math.cos((progress - 0.95) / 0.05 * Math.PI)) / 2;
              } else {
                envelope = 1;
              }
            } else {
              envelope = Math.sin((sample / numSamples) * Math.PI);
            }

            if (r > 0.01) {
              left[sample] += r * envelope * Math.sin(t + phase);
            }
            if (g > 0.01) {
              right[sample] += g * envelope * Math.sin(t + phase);
            }
            if (b > 0.01 && noiseEnabled) {
              const bwFactor = (noiseBandwidth ?? 50) / 100;
              const tonal = Math.sin(t + phase) * (1 - bwFactor);
              const white = (Math.random() * 2 - 1) * bwFactor;
              const noise = (tonal + white) * b * envelope;
              left[sample] += noise * 0.5;
              right[sample] += noise * 0.5;
            }
          }
        }

        processedRows++;
      }
    };

    // Process in chunks with yields
    for (let startRow = 0; startRow < renderHeight; startRow += ROWS_PER_CHUNK) {
      const endRow = Math.min(startRow + ROWS_PER_CHUNK, renderHeight);

      await processChunk(startRow, endRow);

      // Report progress
      if (onProgress) {
        onProgress(processedRows / renderHeight);
      }

      // Yield to main thread
      await new Promise(resolve => setTimeout(resolve, 0));

      // Check abort after yield
      if (abortSignal?.signal.aborted) {
        break;
      }
    }

    this.normalize(left);
    this.normalize(right);

    return { left, right };
  }

  private frequencyFromY(y: number, height: number, low: number, high: number): number {
    const normalizedY = y / height;

    switch (this.settings.frequencyScale) {
      case 'linear':
        return low + normalizedY * (high - low);
      case 'exponential':
        return low * Math.pow(high / low, normalizedY);
      case 'bark':
        return this.barkScale(normalizedY);
      default:
        return low * Math.pow(high / low, normalizedY);
    }
  }

  private barkScale(x: number): number {
    const bark = x * 24;
    if (bark < 0.5) return 50 + bark * 100;
    if (bark < 12) return 100 + (bark - 0.5) * 54.6;
    return 2000 + (bark - 12) * 300;
  }

  private normalize(channel: Float32Array): void {
    let max = 0;
    for (let i = 0; i < channel.length; i++) {
      max = Math.max(max, Math.abs(channel[i]));
    }
    if (max > 0) {
      for (let i = 0; i < channel.length; i++) {
        channel[i] /= max;
      }
    }
  }

  private schedulePlayback(channels: AudioChannel): void {
    if (!this.context) return;

    const buffer = this.context.createBuffer(
      2,
      channels.left.length,
      this.settings.sampleRate
    );

    buffer.getChannelData(0).set(channels.left);
    buffer.getChannelData(1).set(channels.right);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = this.isLooping;
    source.connect(this.masterGain!);
    source.start();

    this.currentSource = source;

    source.onended = () => {
      if (this.isPlaying && !this.isLooping) {
        this.isPlaying = false;
        if (this.onPlaybackEnd) {
          this.onPlaybackEnd();
        }
      }
      this.currentSource = null;
    };
  }

  getAnalyserData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getAnalyserFFTSize(): number {
    return this.analyser?.fftSize ?? 2048;
  }

  getAnalyserFrequencyBinCount(): number {
    return this.analyser?.frequencyBinCount ?? 1024;
  }

  getSampleRate(): number {
    return this.context?.sampleRate ?? this.settings.sampleRate;
  }

  getEffectiveDuration(): number {
    const { duration, tempo = 120 } = this.settings;
    const tempoFactor = 120 / tempo;
    return duration * tempoFactor;
  }

  async renderToWav(imageData: ImageData, options: RenderOptions = {}): Promise<Blob> {
    this.abortController = new AbortController();
    const channels = this.synthesize(imageData, {
      ...options,
      abortSignal: this.abortController
    });
    return this.encodeWav(channels);
  }

  abortRender(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
  }

  private encodeWav(channels: AudioChannel): Blob {
    const { sampleRate } = this.settings;
    const numChannels = 2;
    const bitsPerSample = 32;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);

    const dataLength = channels.left.length * numChannels * 4;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 3, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    const offset = 44;
    for (let i = 0; i < channels.left.length; i++) {
      view.setFloat32(offset + i * 8, channels.left[i], true);
      view.setFloat32(offset + i * 8 + 4, channels.right[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  getCurrentTime(): number {
    if (!this.context || !this.isPlaying) return 0;
    return this.context.currentTime - this.startTime;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  async dispose(): Promise<void> {
    await this.stopPreview();
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  // Timeline rendering methods

  /**
   * Render multiple timeline clips into a single audio stream
   */
  async renderTimeline(
    clips: TimelineClip[],
    options: RenderOptions = {}
  ): Promise<AudioChannel> {
    const { onProgress, abortSignal } = options;
    const allLeft: Float32Array[] = [];
    const allRight: Float32Array[] = [];

    const sortedClips = [...clips].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedClips.length; i++) {
      const clip = sortedClips[i];

      // Check for abort
      if (abortSignal?.signal.aborted) {
        break;
      }

      // Temporarily apply clip's settings
      const previousSettings = { ...this.settings };
      this.setSettings(clip.settings);

      // Synthesize this clip
      const channels = await this.synthesizeAsync(clip.imageData, {
        ...options,
        onProgress: (p) => {
          // Calculate overall progress across all clips
          if (onProgress) {
            const clipProgress = (i + p) / sortedClips.length;
            onProgress(clipProgress);
          }
        },
        abortSignal
      });

      // Restore previous settings
      this.setSettings(previousSettings);

      if (abortSignal?.signal.aborted) {
        break;
      }

      allLeft.push(channels.left);
      allRight.push(channels.right);
    }

    // Concatenate all channels
    return this.concatenateChannels(allLeft, allRight);
  }

  /**
   * Concatenate multiple audio channel arrays into one
   */
  private concatenateChannels(
    leftChannels: Float32Array[],
    rightChannels: Float32Array[]
  ): AudioChannel {
    const totalLength = leftChannels.reduce((sum, ch) => sum + ch.length, 0);
    const left = new Float32Array(totalLength);
    const right = new Float32Array(totalLength);

    let offset = 0;
    for (let i = 0; i < leftChannels.length; i++) {
      left.set(leftChannels[i], offset);
      right.set(rightChannels[i], offset);
      offset += leftChannels[i].length;
    }

    return { left, right };
  }

  /**
   * Start preview playback of an entire timeline
   */
  async startPreviewTimeline(clips: TimelineClip[], options: RenderOptions = {}): Promise<void> {
    if (!this.context) await this.initialize();
    if (this.isPlaying) await this.stopPreview();

    await this.context!.resume();
    this.isPlaying = true;
    this.isLooping = options.loop ?? false;
    this.startTime = this.context!.currentTime;

    // Render the entire timeline
    const channels = await this.renderTimeline(clips, options);

    // Check if we were aborted during synthesis
    if (options.abortSignal?.signal.aborted || !this.isPlaying) {
      return;
    }

    this.schedulePlayback(channels);
  }

  /**
   * Render timeline to WAV file
   */
  async renderTimelineToWav(clips: TimelineClip[], options: RenderOptions = {}): Promise<Blob> {
    this.abortController = new AbortController();
    const channels = await this.renderTimeline(clips, {
      ...options,
      abortSignal: this.abortController
    });
    return this.encodeWav(channels);
  }

  /**
   * Calculate total duration of timeline based on clips
   */
  calculateTimelineDuration(clips: TimelineClip[]): number {
    return clips.reduce((total, clip) => {
      const tempoFactor = 120 / (clip.settings.tempo || 120);
      return total + clip.settings.duration * tempoFactor;
    }, 0);
  }

  // ── Auto-calibration ────────────────────────────────────────────────────────

  /**
   * Analyse per-row brightness energy in the image.
   * Returns a Float32Array of length imageData.height where each value is the
   * mean luminance (0–1) for that row.
   */
  analyzeRowEnergy(imageData: ImageData, selection?: Selection | null): Float32Array {
    const x0 = selection?.x ?? 0;
    const y0 = selection?.y ?? 0;
    const w  = selection?.width  ?? imageData.width;
    const h  = selection?.height ?? imageData.height;
    const data = imageData.data;
    const iw   = imageData.width;

    const energy = new Float32Array(h);
    for (let relY = 0; relY < h; relY++) {
      let sum = 0;
      for (let relX = 0; relX < w; relX++) {
        const idx = ((y0 + relY) * iw + (x0 + relX)) * 4;
        // Perceptual luminance weights
        sum += data[idx] * 0.2126 + data[idx + 1] * 0.7152 + data[idx + 2] * 0.0722;
      }
      energy[relY] = sum / (w * 255);
    }
    return energy;
  }

  /**
   * Given an image, compute the pitch offset (semitones) needed to shift the
   * energy centre-of-mass to targetFrequency within the current frequency range.
   *
   * Useful for the 3–15 kHz sweet-spot: pass targetFrequency = 7000.
   * Returns { pitchSemitones, currentCentreHz, targetHz, rowEnergy }.
   */
  getAutoPitch(
    imageData: ImageData,
    targetFrequency = 7000,
    selection?: Selection | null
  ): { pitchSemitones: number; currentCentreHz: number; targetHz: number; rowEnergy: Float32Array } {
    const rowEnergy = this.analyzeRowEnergy(imageData, selection);
    const h = rowEnergy.length;
    const { lowFrequency, highFrequency } = this.settings;

    // Weighted centre-of-mass in normalised Y (0 = top, 1 = bottom)
    let totalEnergy = 0;
    let weightedY   = 0;
    for (let y = 0; y < h; y++) {
      totalEnergy += rowEnergy[y];
      weightedY   += rowEnergy[y] * (y / h);
    }
    const centreY = totalEnergy > 0 ? weightedY / totalEnergy : 0.5;

    // Map centreY → frequency using the current scale
    const currentCentreHz = this.frequencyFromY(
      Math.round(centreY * h),
      h,
      lowFrequency,
      highFrequency
    );

    // Semitones needed to shift currentCentreHz → targetFrequency
    const pitchSemitones = 12 * Math.log2(targetFrequency / currentCentreHz);

    return {
      pitchSemitones: Math.round(pitchSemitones * 10) / 10, // 0.1 semitone resolution
      currentCentreHz,
      targetHz: targetFrequency,
      rowEnergy,
    };
  }
}
