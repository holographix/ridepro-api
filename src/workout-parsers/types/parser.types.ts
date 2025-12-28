/**
 * Types for workout file parsing
 *
 * These types define the intermediate parsed format that gets converted
 * to RidePro's internal workout structure.
 */

export type IntensityClass = 'warmUp' | 'active' | 'rest' | 'coolDown';

export interface ParsedSegment {
  startTime: number; // seconds from start
  endTime: number; // seconds from start
  duration: number; // seconds
  powerMin: number; // % FTP (0-200+)
  powerMax: number; // % FTP (0-200+)
  intensityClass: IntensityClass;
  name: string;
  cadenceMin?: number;
  cadenceMax?: number;
}

export interface ParsedWorkoutResult {
  name: string;
  author?: string;
  description?: string;
  sportType: 'bike' | 'run' | 'swim' | 'other';
  segments: ParsedSegment[];
  totalDuration: number; // seconds
  sourceFormat: 'zwo' | 'erg' | 'mrc' | 'fit';
  ftp?: number; // FTP used for absolute watts conversion (ERG files)
}

export interface WorkoutTarget {
  minValue: number;        // Power % FTP (existing)
  maxValue: number;        // Power % FTP (existing)
  cadenceMin?: number;     // Optional RPM (30-200)
  cadenceMax?: number;     // Optional RPM (30-200)
  hrMin?: number;          // Optional BPM or %
  hrMax?: number;          // Optional BPM or %
  hrType?: 'bpm' | 'percent'; // Absolute vs percentage
}

export interface WorkoutStepData {
  type?: 'step';
  name?: string;
  length: {
    value: number;
    unit: 'second' | 'minute' | 'repetition';
  };
  targets: WorkoutTarget[];
  intensityClass: IntensityClass;
  openDuration: boolean;
}

export interface WorkoutStepWrapper {
  type: 'step';
  length: {
    value: number;
    unit: 'repetition';
  };
  steps: WorkoutStepData[];
  begin?: number;
  end?: number;
}

export interface WorkoutRepetition {
  type: 'repetition';
  length: {
    value: number;
    unit: 'repetition';
  };
  steps: (WorkoutStepData | WorkoutRepetition)[];
  begin?: number;
  end?: number;
}

export type WorkoutStructureItem = WorkoutStepWrapper | WorkoutRepetition;

export interface ConvertedWorkout {
  name: string;
  slug: string;
  description: string;
  durationSeconds: number;
  tssPlanned: number;
  ifPlanned: number;
  workoutType: string;
  environment: 'INDOOR' | 'OUTDOOR' | 'ANY';
  intensity: 'EASY' | 'MODERATE' | 'HARD' | 'VERY_HARD';
  structure: WorkoutStructureItem[];
  rawJson: Record<string, unknown>;
  sourceFormat: string;
}

export interface ParserInterface {
  parse(content: string): ParsedWorkoutResult;
  supports(filename: string): boolean;
}
