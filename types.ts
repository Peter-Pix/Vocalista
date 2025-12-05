export enum UserMode {
  SINGER = 'SINGER',
  RAPPER = 'RAPPER',
  SPEAKER = 'SPEAKER',
}

export type AppTheme = 'default' | 'brutalist';
export type MicSensitivity = 'low' | 'medium' | 'high';

export interface Note {
  name: string;
  frequency: number;
  octave: number;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  instructions?: string; // Detailed instructions for the user
  exampleText?: string; // Text for AI to perform
  type: 'scale' | 'rhythm' | 'range' | 'articulation';
  difficulty: 'easy' | 'medium' | 'hard';
  durationSeconds: number;
  targetNotes?: Note[]; // For scales
  bpm?: number; // For rhythm
}

export interface SessionResult {
  id: string;
  timestamp: number;
  exerciseId: string;
  mode: UserMode;
  score: number; // 0-100
  feedbackText: string;
  stats: {
    avgPitchDeviation?: number; // In cents
    rhythmConsistency?: number; // 0-100
    rangeDetected?: { min: number; max: number };
    participationPct?: number;
    singingDurationSeconds?: number;
  };
}

export interface AudioAnalysis {
  pitch: number; // Hz
  note: string;
  centsOff: number;
  volume: number; // 0-1 (RMS)
  clarity: number; // Confidence of pitch detection
}