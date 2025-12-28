import { Test, TestingModule } from '@nestjs/testing';
import { WorkoutParsersService } from './workout-parsers.service';

describe('WorkoutParsersService', () => {
  let service: WorkoutParsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkoutParsersService],
    }).compile();

    service = module.get<WorkoutParsersService>(WorkoutParsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSupportedFormats', () => {
    it('should return supported formats', () => {
      const formats = service.getSupportedFormats();
      expect(formats).toContain('.zwo');
      expect(formats).toContain('.erg');
      expect(formats).toContain('.mrc');
    });
  });

  describe('ZWO Parser', () => {
    const zwoContent = `<workout_file>
  <author>massimo rosa (via TrainingPeaks)</author>
  <name>SAP</name>
  <description></description>
  <sportType>bike</sportType>
  <tags/>
  <workout>
    <Warmup Duration="2700" PowerHigh="0.55" PowerLow="0.35">
    </Warmup>
    <SteadyState Duration="3600" Power="0.75">
    </SteadyState>
    <SteadyState Duration="2700" Power="0.55">
    </SteadyState>
    <Cooldown Duration="1800" PowerHigh="0.35" PowerLow="0.55">
    </Cooldown>
  </workout>
</workout_file>`;

    it('should parse ZWO file', () => {
      const result = service.parseWorkout(zwoContent, 'test.zwo');

      expect(result.name).toBe('SAP');
      expect(result.author).toBe('massimo rosa (via TrainingPeaks)');
      expect(result.sportType).toBe('bike');
      expect(result.sourceFormat).toBe('zwo');
      expect(result.segments.length).toBeGreaterThan(0);
      // Total duration should be 2700 + 3600 + 2700 + 1800 = 10800 seconds (3 hours)
      expect(result.totalDuration).toBe(10800);
    });

    it('should convert ZWO to RidePro format', () => {
      const converted = service.parseAndConvert(zwoContent, 'test.zwo', {
        name: 'Custom SAP Workout',
      });

      expect(converted.name).toBe('Custom SAP Workout');
      expect(converted.durationSeconds).toBe(10800);
      expect(converted.structure.length).toBeGreaterThan(0);
      expect(converted.environment).toBe('INDOOR');
    });
  });

  describe('ERG Parser', () => {
    const ergContent = `[COURSE HEADER]
VERSION = 2
UNITS = ENGLISH
DESCRIPTION = SAP
FILE NAME = 2025-12-20_SAP.erg
FTP = 364
MINUTES WATTS
[END COURSE HEADER]
[COURSE DATA]
0	164
45	164
45	273
105	273
105	200
150	200
150	164
180	164
[END COURSE DATA]`;

    it('should parse ERG file', () => {
      const result = service.parseWorkout(ergContent, 'test.erg');

      expect(result.name).toBe('SAP');
      expect(result.sourceFormat).toBe('erg');
      expect(result.ftp).toBe(364);
      expect(result.segments.length).toBeGreaterThan(0);
      // Total duration: 180 minutes = 10800 seconds
      expect(result.totalDuration).toBe(10800);
    });

    it('should convert ERG to RidePro format', () => {
      const converted = service.parseAndConvert(ergContent, 'test.erg');

      expect(converted.durationSeconds).toBe(10800);
      expect(converted.structure.length).toBeGreaterThan(0);
    });
  });

  describe('MRC Parser', () => {
    const mrcContent = `[COURSE HEADER]
VERSION = 2
UNITS = ENGLISH
DESCRIPTION = SAP
FILE NAME = 2025-12-20_SAP.mrc
MINUTES PERCENT
[END COURSE HEADER]
[COURSE DATA]
0	45
45	45
45	75
105	75
105	55
150	55
150	45
180	45
[END COURSE DATA]`;

    it('should parse MRC file', () => {
      const result = service.parseWorkout(mrcContent, 'test.mrc');

      expect(result.name).toBe('SAP');
      expect(result.sourceFormat).toBe('mrc');
      expect(result.segments.length).toBeGreaterThan(0);
      // Total duration: 180 minutes = 10800 seconds
      expect(result.totalDuration).toBe(10800);
    });

    it('should convert MRC to RidePro format', () => {
      const converted = service.parseAndConvert(mrcContent, 'test.mrc');

      expect(converted.durationSeconds).toBe(10800);
      // Check power values are percentages (45%, 75%, 55%)
      const firstStep = converted.structure[0];
      if (firstStep.type === 'step' && 'steps' in firstStep) {
        expect(firstStep.steps[0].targets[0].minValue).toBeLessThanOrEqual(
          100,
        );
      }
    });
  });

  describe('Error handling', () => {
    it('should throw error for unsupported format', () => {
      expect(() => service.parseWorkout('content', 'test.fit')).toThrow(
        'Unsupported file format',
      );
    });

    it('should throw error for invalid ZWO content', () => {
      expect(() =>
        service.parseWorkout('<invalid>no workout</invalid>', 'test.zwo'),
      ).toThrow('No <workout> section found');
    });

    it('should throw error for ERG with insufficient data', () => {
      const badErg = `[COURSE HEADER]
[END COURSE HEADER]
[COURSE DATA]
0	100
[END COURSE DATA]`;
      expect(() => service.parseWorkout(badErg, 'test.erg')).toThrow(
        'at least 2 data points',
      );
    });
  });
});
