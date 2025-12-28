import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FitParserService, ParsedPlannedWorkout, WorkoutStep } from './fit-parser.service';
import { Workout, Environment, Intensity } from '@prisma/client';

/**
 * Workout Import Service
 *
 * Imports PLANNED WORKOUTS from TrainingPeaks FIT files
 * Converts to RidePro workout template format
 */

export interface ImportWorkoutDto {
  coachId: string;
  buffer: Buffer;
  filename: string;
  categoryId?: string; // Optional category
  overrideName?: string; // Override workout name
  overrideDescription?: string;
}

export interface ImportedWorkout {
  workout: Workout;
  source: string;
  originalName: string;
}

@Injectable()
export class WorkoutImportService {
  private readonly logger = new Logger(WorkoutImportService.name);

  constructor(
    private prisma: PrismaService,
    private fitParser: FitParserService,
  ) {}

  /**
   * Import planned workout from TrainingPeaks FIT file
   */
  async importPlannedWorkout(dto: ImportWorkoutDto): Promise<ImportedWorkout> {
    const { coachId, buffer, filename, categoryId, overrideName, overrideDescription } = dto;

    // Verify coach exists
    const coach = await this.prisma.user.findUnique({
      where: { id: coachId },
    });

    if (!coach) {
      throw new BadRequestException(`Coach with ID ${coachId} not found`);
    }

    // Parse FIT file
    const parsed = await this.fitParser.parse(buffer, filename);

    if (parsed.fileType !== 'planned_workout') {
      throw new BadRequestException(
        'This FIT file is a completed activity, not a planned workout. Use the activity import endpoint instead.',
      );
    }

    const workoutData = parsed.plannedWorkout!;

    // Convert to RidePro workout format
    const workout = await this.saveWorkout(
      coachId,
      workoutData,
      categoryId,
      overrideName,
      overrideDescription,
    );

    this.logger.log(`Imported planned workout "${workout.name}" from ${filename}`);

    return {
      workout,
      source: 'TrainingPeaks',
      originalName: workoutData.name,
    };
  }

  /**
   * Import multiple planned workouts in batch
   */
  async importBatch(
    coachId: string,
    files: Array<{ buffer: Buffer; filename: string }>,
    categoryId?: string,
  ): Promise<ImportedWorkout[]> {
    this.logger.log(`Starting batch workout import: ${files.length} files for coach ${coachId}`);

    const results: ImportedWorkout[] = [];

    for (const file of files) {
      try {
        const result = await this.importPlannedWorkout({
          coachId,
          buffer: file.buffer,
          filename: file.filename,
          categoryId,
        });
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to import ${file.filename}: ${error.message}`);
        // Continue with other files
      }
    }

    this.logger.log(`Batch import completed: ${results.length}/${files.length} workouts imported`);

    return results;
  }

  /**
   * Save parsed workout as template in database
   */
  private async saveWorkout(
    coachId: string,
    data: ParsedPlannedWorkout,
    categoryId?: string,
    overrideName?: string,
    overrideDescription?: string,
  ): Promise<Workout> {
    const name = overrideName || data.name;
    const slug = this.generateSlug(name);
    const description = overrideDescription || data.description || `Imported from TrainingPeaks`;

    // Convert workout steps to RidePro structure
    const structure = this.convertToRideProStructure(data.steps);

    // Calculate metrics
    const durationSeconds = data.estimatedDuration;
    const durationCategory = this.getDurationCategory(durationSeconds);
    const tssPlanned = data.estimatedTSS || this.estimateTSS(data.steps, durationSeconds);
    const ifPlanned = this.estimateIF(data.steps);
    const intensity = this.getIntensity(ifPlanned);

    // Determine category - use provided or try to find/create default
    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      // Find or create "Imported Workouts" category
      const importedCategory = await this.prisma.workoutCategory.findFirst({
        where: {
          name: 'Imported Workouts',
          coachId,
        },
      });

      if (importedCategory) {
        finalCategoryId = importedCategory.id;
      } else {
        const newCategory = await this.prisma.workoutCategory.create({
          data: {
            name: 'Imported Workouts',
            slug: 'imported-workouts',
            description: 'Workouts imported from TrainingPeaks and other sources',
            coachId,
          },
        });
        finalCategoryId = newCategory.id;
      }
    }

    // Create workout
    return this.prisma.workout.create({
      data: {
        slug,
        name,
        description,
        durationSeconds,
        durationCategory,
        tssPlanned,
        ifPlanned,
        structure: { structure },
        categoryId: finalCategoryId,
        coachId,
        workoutType: 'indoorCycling',
        environment: Environment.INDOOR,
        intensity,
      },
      include: {
        category: true,
      },
    });
  }

  /**
   * Convert TrainingPeaks workout steps to RidePro structure format
   */
  private convertToRideProStructure(steps: WorkoutStep[]): any[] {
    const structure: any[] = [];

    for (const step of steps) {
      if (step.type === 'repeat' && step.repeatSteps) {
        // Handle repetitions
        structure.push({
          type: 'step',
          length: {
            value: step.repeatCount || 1,
            unit: 'repetition',
          },
          steps: step.repeatSteps.map(s => this.convertStepToRideProFormat(s)),
        });
      } else {
        // Regular step
        structure.push({
          type: 'step',
          length: {
            value: 1,
            unit: 'repetition',
          },
          steps: [this.convertStepToRideProFormat(step)],
        });
      }
    }

    return structure;
  }

  /**
   * Convert individual step to RidePro format
   */
  private convertStepToRideProFormat(step: WorkoutStep): any {
    // Map step type to intensity class
    const intensityClass = this.mapStepTypeToIntensityClass(step.type);

    // Duration
    const length = this.convertDuration(step);

    // Target zones
    const targets = this.convertTargets(step);

    return {
      name: step.name,
      intensityClass,
      length,
      targets: [targets],
      openDuration: step.durationType === 'open',
    };
  }

  /**
   * Convert step duration to RidePro format
   */
  private convertDuration(step: WorkoutStep): { value: number; unit: string } {
    if (step.durationType === 'open') {
      return {
        value: 0,
        unit: 'repetition',
      };
    }

    if (step.durationType === 'time' && step.durationValue) {
      return {
        value: step.durationValue,
        unit: 'second',
      };
    }

    if (step.durationType === 'distance' && step.durationValue) {
      return {
        value: step.durationValue,
        unit: 'meter',
      };
    }

    return {
      value: 60, // Default 60 seconds
      unit: 'second',
    };
  }

  /**
   * Convert target zones to RidePro format
   */
  private convertTargets(step: WorkoutStep): any {
    const targets: any = {};

    if (step.targetType === 'power' && step.targetMin !== undefined) {
      // Convert absolute watts to % FTP (assuming targets are already % FTP)
      // TrainingPeaks stores power as % FTP in decimal (e.g., 0.75 = 75% FTP)
      targets.minValue = step.targetMin;
      targets.maxValue = step.targetMax || step.targetMin;
    } else if (step.targetType === 'heartRate' && step.targetMin !== undefined) {
      targets.hrMin = step.targetMin;
      targets.hrMax = step.targetMax || step.targetMin;
    } else if (step.targetType === 'cadence' && step.targetMin !== undefined) {
      targets.cadenceMin = step.targetMin;
      targets.cadenceMax = step.targetMax || step.targetMin;
    }

    return targets;
  }

  /**
   * Map step type to RidePro intensity class
   */
  private mapStepTypeToIntensityClass(
    type: string,
  ): 'warmUp' | 'active' | 'rest' | 'coolDown' {
    switch (type) {
      case 'warmup':
        return 'warmUp';
      case 'cooldown':
        return 'coolDown';
      case 'rest':
        return 'rest';
      default:
        return 'active';
    }
  }

  /**
   * Estimate TSS from workout steps
   */
  private estimateTSS(steps: WorkoutStep[], durationSeconds: number): number {
    // Calculate weighted average intensity
    let totalWeightedPower = 0;
    let totalDuration = 0;

    for (const step of steps) {
      if (step.targetType === 'power' && step.targetMin !== undefined) {
        const avgPower = (step.targetMin + (step.targetMax || step.targetMin)) / 2;
        const duration = step.durationValue || 60;

        // Weight by fourth power for NP approximation
        totalWeightedPower += Math.pow(avgPower, 4) * duration;
        totalDuration += duration;
      }
    }

    if (totalDuration === 0) {
      return Math.round(durationSeconds / 3600 * 50); // Rough estimate: 50 TSS per hour
    }

    // Calculate normalized power (as % of FTP)
    const normalizedPower = Math.pow(totalWeightedPower / totalDuration, 0.25);

    // TSS = (duration in hours) × IF² × 100
    const durationHours = durationSeconds / 3600;
    const intensityFactor = normalizedPower; // NP is already as % FTP
    const tss = durationHours * Math.pow(intensityFactor, 2) * 100;

    return Math.round(tss);
  }

  /**
   * Estimate IF from workout steps
   */
  private estimateIF(steps: WorkoutStep[]): number {
    let totalWeightedPower = 0;
    let totalDuration = 0;

    for (const step of steps) {
      if (step.targetType === 'power' && step.targetMin !== undefined) {
        const avgPower = (step.targetMin + (step.targetMax || step.targetMin)) / 2;
        const duration = step.durationValue || 60;

        totalWeightedPower += Math.pow(avgPower, 4) * duration;
        totalDuration += duration;
      }
    }

    if (totalDuration === 0) {
      return 0.65; // Default moderate intensity
    }

    const normalizedPower = Math.pow(totalWeightedPower / totalDuration, 0.25);
    return Math.round(normalizedPower * 100) / 100;
  }

  /**
   * Get intensity category from IF
   */
  private getIntensity(intensityFactor: number): Intensity {
    if (intensityFactor < 0.65) return Intensity.EASY;
    if (intensityFactor < 0.80) return Intensity.MODERATE;
    if (intensityFactor < 0.95) return Intensity.HARD;
    return Intensity.VERY_HARD;
  }

  /**
   * Get duration category
   */
  private getDurationCategory(seconds: number): 'SHORT' | 'MEDIUM' | 'LONG' {
    const hours = seconds / 3600;
    if (hours < 1) return 'SHORT';
    if (hours < 2) return 'MEDIUM';
    return 'LONG';
  }

  /**
   * Generate URL-friendly slug
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}
