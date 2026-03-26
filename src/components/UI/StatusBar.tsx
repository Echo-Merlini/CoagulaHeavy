import React, { memo, useMemo } from 'react';
import { useStore } from '../../store';

// Convert frequency to musical note name and cents offset
function frequencyToNote(freq: number): { note: string; cents: number } {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75); // ~16.35 Hz

  if (freq <= 0) return { note: '-', cents: 0 };

  // Calculate number of semitones from C0
  const semitones = 12 * Math.log2(freq / C0);
  const roundedSemitones = Math.round(semitones);
  const cents = Math.round((semitones - roundedSemitones) * 100);

  // Calculate note and octave
  const octave = Math.floor(roundedSemitones / 12);
  const noteIndex = ((roundedSemitones % 12) + 12) % 12;
  const noteName = noteNames[noteIndex];

  return {
    note: `${noteName}${octave}`,
    cents: cents,
  };
}

// Calculate frequency from Y position on canvas
function yToFrequency(y: number, height: number, lowFreq: number, highFreq: number, scale: 'linear' | 'exponential' | 'bark'): number {
  // Y increases downward, but frequency increases upward (high freq at top)
  const normalizedY = 1 - (y / (height - 1));

  switch (scale) {
    case 'exponential':
      return lowFreq * Math.pow(highFreq / lowFreq, normalizedY);
    case 'bark':
      // Bark scale approximation
      const lowBark = 13 * Math.atan(0.00076 * lowFreq) + 3.5 * Math.atan(Math.pow(lowFreq / 7500, 2));
      const highBark = 13 * Math.atan(0.00076 * highFreq) + 3.5 * Math.atan(Math.pow(highFreq / 7500, 2));
      const bark = lowBark + (highBark - lowBark) * normalizedY;
      // Convert bark back to Hz (approximation)
      return 600 * Math.sinh(bark / 6);
    case 'linear':
    default:
      return lowFreq + (highFreq - lowFreq) * normalizedY;
  }
}

export const StatusBar: React.FC = memo(() => {
  const { project, render, cursorPosition } = useStore();
  const { settings, modified, name } = project;
  const { isPlaying, progress } = render;

  // Memoize frequency and pitch calculations
  const cursorInfo = useMemo(() => {
    if (!cursorPosition) return null;

    const freq = yToFrequency(
      cursorPosition.y,
      settings.height,
      settings.lowFrequency,
      settings.highFrequency,
      settings.frequencyScale
    );
    const { note, cents } = frequencyToNote(freq);
    const centsStr = cents >= 0 ? `+${cents}` : `${cents}`;
    const time = (cursorPosition.x / (settings.width - 1)) * settings.duration;

    return {
      freqDisplay: `${freq.toFixed(1)} Hz`,
      pitchDisplay: `${note} ${centsStr}¢`,
      timeDisplay: `${time.toFixed(3)}s`,
    };
  }, [cursorPosition, settings.height, settings.lowFrequency, settings.highFrequency, settings.frequencyScale, settings.width, settings.duration]);

  return (
    <div className="flex items-center gap-4 px-4 py-1 bg-surface-light text-xs text-text-dim border-t border-white/10">
      <span className="font-medium">{name}{modified ? ' *' : ''}</span>

      {cursorPosition && cursorInfo && (
        <>
          <span className="text-text">
            ({cursorPosition.x}, {cursorPosition.y})
          </span>
          <span className="text-primary">{cursorInfo.freqDisplay}</span>
          <span className="text-accent">{cursorInfo.pitchDisplay}</span>
          <span className="text-text">{cursorInfo.timeDisplay}</span>
        </>
      )}

      <div className="flex-1" />
      <span>{settings.sampleRate / 1000} kHz</span>
      <span>{settings.lowFrequency}-{settings.highFrequency} Hz</span>
      <span>{settings.duration}s</span>
      {isPlaying && (
        <span className="text-primary">Playing {progress.toFixed(1)}%</span>
      )}
    </div>
  );
});
