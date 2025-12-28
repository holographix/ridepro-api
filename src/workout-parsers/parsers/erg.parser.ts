/**
 * ERG Parser - Parses ERG/MRC workout files
 *
 * ERG format uses absolute watts at time points
 * MRC format uses FTP percentages at time points
 *
 * Format structure:
 * [COURSE HEADER]
 * VERSION = 2
 * UNITS = ENGLISH
 * DESCRIPTION = Workout Name
 * FILE NAME = workout.erg
 * FTP = 200 (only in ERG files)
 * MINUTES WATTS (or MINUTES PERCENT for MRC)
 * [END COURSE HEADER]
 * [COURSE DATA]
 * 0    150
 * 10   150
 * 10   200
 * 20   200
 * [END COURSE DATA]
 *
 * Note: Points define vertices - power changes happen at duplicate times
 */

import {
  ParsedWorkoutResult,
  ParsedSegment,
  IntensityClass,
  ParserInterface,
} from '../types/parser.types';

interface DataPoint {
  minutes: number;
  value: number; // watts or percent depending on format
}

export class ErgParser implements ParserInterface {
  private isPercentFormat = false;
  private ftp: number | undefined;

  supports(filename: string): boolean {
    const lower = filename.toLowerCase();
    return lower.endsWith('.erg') || lower.endsWith('.mrc');
  }

  parse(content: string): ParsedWorkoutResult {
    const lines = content.split('\n').map((l) => l.trim());

    // Determine format from filename in header or data type
    this.isPercentFormat = this.detectPercentFormat(content);

    // Parse header
    const header = this.parseHeader(lines);

    // Parse data points
    const dataPoints = this.parseDataPoints(lines);

    if (dataPoints.length < 2) {
      throw new Error('ERG/MRC file must have at least 2 data points');
    }

    // Convert points to segments
    const segments = this.createSegments(dataPoints);

    const totalDuration = dataPoints[dataPoints.length - 1].minutes * 60;

    return {
      name: header.description || 'Imported Workout',
      description: header.description,
      sportType: 'bike',
      segments,
      totalDuration,
      sourceFormat: this.isPercentFormat ? 'mrc' : 'erg',
      ftp: header.ftp,
    };
  }

  private detectPercentFormat(content: string): boolean {
    const upperContent = content.toUpperCase();
    if (upperContent.includes('MINUTES PERCENT')) return true;
    if (upperContent.includes('.MRC')) return true;
    if (upperContent.includes('MINUTES WATTS')) return false;
    if (upperContent.includes('.ERG')) return false;

    // Default: check values - if all under 200, likely percent
    const dataMatch = content.match(
      /\[COURSE DATA\]([\s\S]*?)\[END COURSE DATA\]/i,
    );
    if (dataMatch) {
      const values = dataMatch[1]
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => {
          const parts = l.trim().split(/[\t\s]+/);
          return parts.length >= 2 ? parseFloat(parts[1]) : 0;
        })
        .filter((v) => !isNaN(v));

      if (values.length > 0) {
        const maxValue = Math.max(...values);
        return maxValue <= 200; // Percent values typically 0-200%
      }
    }

    return false;
  }

  private parseHeader(lines: string[]): {
    description?: string;
    ftp?: number;
    version?: number;
  } {
    const header: {
      description?: string;
      ftp?: number;
      version?: number;
    } = {};

    let inHeader = false;

    for (const line of lines) {
      if (line.toUpperCase().includes('[COURSE HEADER]')) {
        inHeader = true;
        continue;
      }
      if (line.toUpperCase().includes('[END COURSE HEADER]')) {
        break;
      }
      if (!inHeader) continue;

      const match = line.match(/^(\w+[\w\s]*?)\s*=\s*(.+)$/);
      if (match) {
        const key = match[1].trim().toUpperCase();
        const value = match[2].trim();

        if (key === 'DESCRIPTION') {
          header.description = value;
        } else if (key === 'FTP') {
          header.ftp = parseInt(value, 10);
          this.ftp = header.ftp;
        } else if (key === 'VERSION') {
          header.version = parseInt(value, 10);
        }
      }
    }

    return header;
  }

  private parseDataPoints(lines: string[]): DataPoint[] {
    const points: DataPoint[] = [];
    let inData = false;

    for (const line of lines) {
      if (line.toUpperCase().includes('[COURSE DATA]')) {
        inData = true;
        continue;
      }
      if (line.toUpperCase().includes('[END COURSE DATA]')) {
        break;
      }
      if (!inData || !line.trim()) continue;

      // Parse tab or space separated values
      const parts = line.split(/[\t\s]+/).filter((p) => p.trim());
      if (parts.length >= 2) {
        const minutes = parseFloat(parts[0]);
        const value = parseFloat(parts[1]);

        if (!isNaN(minutes) && !isNaN(value)) {
          points.push({ minutes, value });
        }
      }
    }

    return points;
  }

  private createSegments(points: DataPoint[]): ParsedSegment[] {
    const segments: ParsedSegment[] = [];

    // Find segment boundaries (where power changes)
    // Points at same minute mark indicate a power change
    let i = 0;
    while (i < points.length - 1) {
      const startPoint = points[i];
      let endPoint = points[i + 1];
      let segmentEndIndex = i + 1;

      // Check if this is a ramp (gradually changing power) or step change
      // If consecutive points have same minute, it's an instant step change
      if (startPoint.minutes === endPoint.minutes) {
        // Step change - skip to next segment
        i++;
        continue;
      }

      // Find the end of this segment (next time value appears twice or end of data)
      while (segmentEndIndex < points.length - 1) {
        const curr = points[segmentEndIndex];
        const next = points[segmentEndIndex + 1];

        if (curr.minutes === next.minutes) {
          // Found step change - end segment here
          break;
        }
        segmentEndIndex++;
      }

      endPoint = points[segmentEndIndex];

      const startTimeSeconds = startPoint.minutes * 60;
      const endTimeSeconds = endPoint.minutes * 60;
      const duration = endTimeSeconds - startTimeSeconds;

      if (duration > 0) {
        const powerMin = this.toPowerPercent(
          Math.min(startPoint.value, endPoint.value),
        );
        const powerMax = this.toPowerPercent(
          Math.max(startPoint.value, endPoint.value),
        );
        const avgPower = (powerMin + powerMax) / 2;

        // Determine if this is a ramp
        const isRamp = Math.abs(startPoint.value - endPoint.value) > 5;

        segments.push({
          startTime: startTimeSeconds,
          endTime: endTimeSeconds,
          duration,
          powerMin: Math.round(powerMin),
          powerMax: Math.round(powerMax),
          intensityClass: this.getIntensityClass(avgPower),
          name: this.getSegmentName(avgPower, isRamp),
        });
      }

      i = segmentEndIndex;
    }

    // Merge consecutive segments with same power
    return this.mergeSegments(segments);
  }

  private mergeSegments(segments: ParsedSegment[]): ParsedSegment[] {
    if (segments.length === 0) return [];

    const merged: ParsedSegment[] = [];
    let current = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];

      // Merge if same power values and adjacent
      if (
        current.powerMin === next.powerMin &&
        current.powerMax === next.powerMax &&
        current.endTime === next.startTime
      ) {
        current.endTime = next.endTime;
        current.duration = current.endTime - current.startTime;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  private toPowerPercent(value: number): number {
    if (this.isPercentFormat) {
      // MRC: value is already a percentage
      return value;
    } else {
      // ERG: value is watts, convert to % FTP
      if (this.ftp && this.ftp > 0) {
        return (value / this.ftp) * 100;
      }
      // If no FTP provided, assume 200W as baseline
      return (value / 200) * 100;
    }
  }

  private getIntensityClass(power: number): IntensityClass {
    // Determine intensity based on segment position and power
    if (power < 50) return 'rest';
    if (power < 56) return 'rest';
    if (power < 76) return 'active';
    if (power >= 76) return 'active';
    return 'active';
  }

  private getSegmentName(power: number, isRamp: boolean): string {
    if (isRamp && power < 56) return 'Warm Up';
    if (isRamp && power > 50) return 'Ramp';
    if (power < 56) return 'Recovery';
    if (power < 76) return 'Endurance';
    if (power < 90) return 'Tempo';
    if (power < 105) return 'Threshold';
    if (power < 120) return 'VO2max';
    return 'Anaerobic';
  }
}
