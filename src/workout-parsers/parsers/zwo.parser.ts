/**
 * ZWO Parser - Parses Zwift Workout XML files
 *
 * ZWO files are XML-based workout files used by Zwift.
 * Power values are expressed as decimal fractions of FTP (e.g., 0.75 = 75% FTP)
 *
 * Supported elements:
 * - Warmup: Ramp from PowerLow to PowerHigh
 * - Cooldown: Ramp from PowerHigh to PowerLow
 * - SteadyState: Constant power
 * - IntervalsT: Repeated intervals (OnPower/OffPower)
 * - FreeRide: Open duration segment
 * - Ramp: Power ramp
 */

import {
  ParsedWorkoutResult,
  ParsedSegment,
  IntensityClass,
  ParserInterface,
} from '../types/parser.types';

interface ZwoElement {
  tagName: string;
  duration?: number;
  power?: number;
  powerLow?: number;
  powerHigh?: number;
  onDuration?: number;
  offDuration?: number;
  onPower?: number;
  offPower?: number;
  repeat?: number;
  cadence?: number;
  cadenceLow?: number;
  cadenceHigh?: number;
}

export class ZwoParser implements ParserInterface {
  supports(filename: string): boolean {
    return filename.toLowerCase().endsWith('.zwo');
  }

  parse(content: string): ParsedWorkoutResult {
    const segments: ParsedSegment[] = [];
    let currentTime = 0;

    // Parse XML manually (no external dependencies)
    const name = this.extractTag(content, 'name') || 'Imported Workout';
    const author = this.extractTag(content, 'author');
    const description = this.extractTag(content, 'description');
    const sportType = this.extractTag(content, 'sportType') || 'bike';

    // Extract workout section
    const workoutMatch = content.match(/<workout>([\s\S]*?)<\/workout>/i);
    if (!workoutMatch) {
      throw new Error('No <workout> section found in ZWO file');
    }

    const workoutContent = workoutMatch[1];
    const elements = this.parseWorkoutElements(workoutContent);

    for (const element of elements) {
      const newSegments = this.processElement(element, currentTime);
      segments.push(...newSegments);

      // Update current time
      const lastSegment = newSegments[newSegments.length - 1];
      if (lastSegment) {
        currentTime = lastSegment.endTime;
      }
    }

    return {
      name,
      author: author || undefined,
      description: description || undefined,
      sportType: sportType === 'bike' ? 'bike' : 'other',
      segments,
      totalDuration: currentTime,
      sourceFormat: 'zwo',
    };
  }

  private extractTag(content: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  private parseWorkoutElements(workoutContent: string): ZwoElement[] {
    const elements: ZwoElement[] = [];

    // Match self-closing or regular tags
    const tagRegex =
      /<(Warmup|Cooldown|SteadyState|IntervalsT|FreeRide|Ramp)([^>]*?)(?:\/>|>[\s\S]*?<\/\1>)/gi;

    let match;
    while ((match = tagRegex.exec(workoutContent)) !== null) {
      const tagName = match[1];
      const attributes = match[2];

      const element: ZwoElement = {
        tagName: tagName.toLowerCase(),
        ...this.parseAttributes(attributes),
      };

      elements.push(element);
    }

    return elements;
  }

  private parseAttributes(
    attrString: string,
  ): Omit<ZwoElement, 'tagName'> {
    const attrs: Record<string, number> = {};

    const attrRegex = /(\w+)="([^"]*)"/g;
    let match;
    while ((match = attrRegex.exec(attrString)) !== null) {
      const key = match[1];
      const value = parseFloat(match[2]);
      if (!isNaN(value)) {
        attrs[this.toCamelCase(key)] = value;
      }
    }

    return attrs;
  }

  private toCamelCase(str: string): string {
    return str.replace(/([A-Z])/g, (match, p1, offset) =>
      offset === 0 ? p1.toLowerCase() : p1,
    );
  }

  private processElement(
    element: ZwoElement,
    startTime: number,
  ): ParsedSegment[] {
    switch (element.tagName) {
      case 'warmup':
        return this.processWarmup(element, startTime);
      case 'cooldown':
        return this.processCooldown(element, startTime);
      case 'steadystate':
        return this.processSteadyState(element, startTime);
      case 'intervalst':
        return this.processIntervals(element, startTime);
      case 'freeride':
        return this.processFreeRide(element, startTime);
      case 'ramp':
        return this.processRamp(element, startTime);
      default:
        return [];
    }
  }

  private processWarmup(
    element: ZwoElement,
    startTime: number,
  ): ParsedSegment[] {
    const duration = element.duration || 600; // Default 10 min
    const powerLow = this.toPercent(element.powerLow || 0.35);
    const powerHigh = this.toPercent(element.powerHigh || 0.65);

    // Create multiple segments for ramp visualization
    return this.createRampSegments(
      startTime,
      duration,
      powerLow,
      powerHigh,
      'warmUp',
      'Warm Up',
    );
  }

  private processCooldown(
    element: ZwoElement,
    startTime: number,
  ): ParsedSegment[] {
    const duration = element.duration || 600;
    const powerHigh = this.toPercent(element.powerHigh || 0.55);
    const powerLow = this.toPercent(element.powerLow || 0.35);

    return this.createRampSegments(
      startTime,
      duration,
      powerHigh,
      powerLow,
      'coolDown',
      'Cool Down',
    );
  }

  private processSteadyState(
    element: ZwoElement,
    startTime: number,
  ): ParsedSegment[] {
    const duration = element.duration || 300;
    const power = this.toPercent(element.power || 0.75);
    const intensity = this.getIntensityClass(power);

    return [
      {
        startTime,
        endTime: startTime + duration,
        duration,
        powerMin: power,
        powerMax: power,
        intensityClass: intensity,
        name: this.getSegmentName(power),
        cadenceMin: element.cadence,
        cadenceMax: element.cadence,
      },
    ];
  }

  private processIntervals(
    element: ZwoElement,
    startTime: number,
  ): ParsedSegment[] {
    const segments: ParsedSegment[] = [];
    const repeat = element.repeat || 1;
    const onDuration = element.onDuration || 60;
    const offDuration = element.offDuration || 60;
    const onPower = this.toPercent(element.onPower || 1.0);
    const offPower = this.toPercent(element.offPower || 0.5);

    let currentTime = startTime;

    for (let i = 0; i < repeat; i++) {
      // ON interval
      segments.push({
        startTime: currentTime,
        endTime: currentTime + onDuration,
        duration: onDuration,
        powerMin: onPower,
        powerMax: onPower,
        intensityClass: this.getIntensityClass(onPower),
        name: `Interval ${i + 1} - ON`,
        cadenceMin: element.cadence,
        cadenceMax: element.cadence,
      });
      currentTime += onDuration;

      // OFF interval
      segments.push({
        startTime: currentTime,
        endTime: currentTime + offDuration,
        duration: offDuration,
        powerMin: offPower,
        powerMax: offPower,
        intensityClass: 'rest',
        name: `Interval ${i + 1} - Recovery`,
      });
      currentTime += offDuration;
    }

    return segments;
  }

  private processFreeRide(
    element: ZwoElement,
    startTime: number,
  ): ParsedSegment[] {
    const duration = element.duration || 600;

    return [
      {
        startTime,
        endTime: startTime + duration,
        duration,
        powerMin: 40,
        powerMax: 80,
        intensityClass: 'active',
        name: 'Free Ride',
        cadenceMin: element.cadence,
        cadenceMax: element.cadence,
      },
    ];
  }

  private processRamp(
    element: ZwoElement,
    startTime: number,
  ): ParsedSegment[] {
    const duration = element.duration || 300;
    const powerLow = this.toPercent(element.powerLow || 0.5);
    const powerHigh = this.toPercent(element.powerHigh || 1.0);
    const intensity = this.getIntensityClass((powerLow + powerHigh) / 2);

    return this.createRampSegments(
      startTime,
      duration,
      powerLow,
      powerHigh,
      intensity,
      'Ramp',
    );
  }

  private createRampSegments(
    startTime: number,
    totalDuration: number,
    powerStart: number,
    powerEnd: number,
    intensity: IntensityClass,
    baseName: string,
  ): ParsedSegment[] {
    // Create 5 segments for smooth ramp visualization
    const segmentCount = 5;
    const segmentDuration = totalDuration / segmentCount;
    const powerStep = (powerEnd - powerStart) / segmentCount;
    const segments: ParsedSegment[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const segStart = startTime + i * segmentDuration;
      const segEnd = segStart + segmentDuration;
      const powerMin = powerStart + i * powerStep;
      const powerMax = powerStart + (i + 1) * powerStep;

      segments.push({
        startTime: segStart,
        endTime: segEnd,
        duration: segmentDuration,
        powerMin: Math.round(powerMin),
        powerMax: Math.round(powerMax),
        intensityClass: intensity,
        name: baseName,
      });
    }

    return segments;
  }

  private toPercent(decimal: number): number {
    // ZWO uses decimals (0.75 = 75%), convert to percentage
    return Math.round(decimal * 100);
  }

  private getIntensityClass(power: number): IntensityClass {
    if (power < 56) return 'rest';
    if (power < 76) return 'active';
    if (power < 90) return 'active';
    return 'active';
  }

  private getSegmentName(power: number): string {
    if (power < 56) return 'Recovery';
    if (power < 76) return 'Endurance';
    if (power < 90) return 'Tempo';
    if (power < 105) return 'Threshold';
    if (power < 120) return 'VO2max';
    return 'Anaerobic';
  }
}
