import { Injectable, BadRequestException } from '@nestjs/common';
import { ZwoParser, ErgParser } from './parsers';
import {
  ParsedWorkoutResult,
  ConvertedWorkout,
  WorkoutStructureItem,
  WorkoutStepWrapper,
  ParserInterface,
} from './types/parser.types';

@Injectable()
export class WorkoutParsersService {
  private parsers: ParserInterface[] = [new ZwoParser(), new ErgParser()];

  /**
   * Get list of supported file formats
   */
  getSupportedFormats(): string[] {
    return ['.zwo', '.erg', '.mrc'];
  }

  /**
   * Parse a workout file and return the parsed result
   */
  parseWorkout(content: string, filename: string): ParsedWorkoutResult {
    const parser = this.getParser(filename);
    if (!parser) {
      throw new BadRequestException(
        `Unsupported file format. Supported formats: ${this.getSupportedFormats().join(', ')}`,
      );
    }

    try {
      return parser.parse(content);
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse workout file: ${error.message}`,
      );
    }
  }

  /**
   * Convert a parsed workout to RidePro's internal format
   */
  convertToWorkout(
    parsed: ParsedWorkoutResult,
    options?: {
      name?: string;
      description?: string;
      categoryId?: string;
    },
  ): ConvertedWorkout {
    const name = options?.name || parsed.name;
    const slug = this.generateSlug(name);

    // Convert segments to workout structure
    const structure = this.convertToStructure(parsed.segments);

    // Calculate TSS and IF
    const { tss, intensityFactor } = this.calculateMetrics(parsed);

    // Determine intensity category
    const intensity = this.getIntensityCategory(intensityFactor);

    return {
      name,
      slug,
      description:
        options?.description ||
        parsed.description ||
        `Imported from ${parsed.sourceFormat.toUpperCase()} file`,
      durationSeconds: parsed.totalDuration,
      tssPlanned: tss,
      ifPlanned: intensityFactor,
      workoutType: 'indoorCycling',
      environment: 'INDOOR',
      intensity,
      structure,
      rawJson: {
        sourceFormat: parsed.sourceFormat,
        originalName: parsed.name,
        author: parsed.author,
        importedAt: new Date().toISOString(),
        segments: parsed.segments,
      },
      sourceFormat: parsed.sourceFormat,
    };
  }

  /**
   * Parse and convert in one step
   */
  parseAndConvert(
    content: string,
    filename: string,
    options?: {
      name?: string;
      description?: string;
      categoryId?: string;
    },
  ): ConvertedWorkout {
    const parsed = this.parseWorkout(content, filename);
    return this.convertToWorkout(parsed, options);
  }

  private getParser(filename: string): ParserInterface | undefined {
    return this.parsers.find((p) => p.supports(filename));
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  private convertToStructure(
    segments: ParsedWorkoutResult['segments'],
  ): WorkoutStructureItem[] {
    // Group consecutive segments by intensity class for cleaner structure
    const structure: WorkoutStructureItem[] = [];

    for (const segment of segments) {
      const step: WorkoutStepWrapper = {
        type: 'step',
        length: {
          value: 1,
          unit: 'repetition',
        },
        steps: [
          {
            name: segment.name,
            length: {
              value: segment.duration,
              unit: 'second',
            },
            targets: [
              {
                minValue: segment.powerMin,
                maxValue: segment.powerMax,
                cadenceMin: segment.cadenceMin,
                cadenceMax: segment.cadenceMax,
              },
            ],
            intensityClass: segment.intensityClass,
            openDuration: false,
          },
        ],
        begin: segment.startTime,
        end: segment.endTime,
      };

      structure.push(step);
    }

    return structure;
  }

  private calculateMetrics(parsed: ParsedWorkoutResult): {
    tss: number;
    intensityFactor: number;
  } {
    // Calculate weighted average power (normalized power approximation)
    let totalWeightedPower = 0;
    let totalDuration = 0;

    for (const segment of parsed.segments) {
      const avgPower = (segment.powerMin + segment.powerMax) / 2;
      // Weight by fourth power for NP calculation
      totalWeightedPower += Math.pow(avgPower / 100, 4) * segment.duration;
      totalDuration += segment.duration;
    }

    if (totalDuration === 0) {
      return { tss: 0, intensityFactor: 0 };
    }

    // Calculate normalized power (as % of FTP)
    const normalizedPower = Math.pow(
      totalWeightedPower / totalDuration,
      0.25,
    );

    // Intensity Factor = NP / FTP (where FTP = 100%)
    const intensityFactor = Math.round(normalizedPower * 100) / 100;

    // TSS = (duration in hours) * IF^2 * 100
    const durationHours = totalDuration / 3600;
    const tss = Math.round(
      durationHours * Math.pow(intensityFactor, 2) * 100,
    );

    return { tss, intensityFactor };
  }

  private getIntensityCategory(
    intensityFactor: number,
  ): 'EASY' | 'MODERATE' | 'HARD' | 'VERY_HARD' {
    if (intensityFactor < 0.65) return 'EASY';
    if (intensityFactor < 0.80) return 'MODERATE';
    if (intensityFactor < 0.95) return 'HARD';
    return 'VERY_HARD';
  }
}
