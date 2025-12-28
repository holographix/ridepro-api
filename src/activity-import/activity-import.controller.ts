import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { ActivityImportService, ImportedActivity } from './activity-import.service';
import { WorkoutImportService, ImportedWorkout } from './workout-import.service';
import { Activity, Workout } from '@prisma/client';
import { FitFileValidator } from './fit-file.validator';

/**
 * Activity & Workout Import Controller
 *
 * Endpoints for importing:
 * - Completed activities from FIT files (athlete uploads)
 * - Planned workouts from TrainingPeaks FIT files (coach imports)
 */
@ApiTags('activity-import')
@Controller('api/activity-import')
export class ActivityImportController {
  constructor(
    private activityImportService: ActivityImportService,
    private workoutImportService: WorkoutImportService,
  ) {}

  /**
   * Import single activity from FIT file
   *
   * POST /api/activity-import/upload
   */
  @Post('upload')
  @ApiOperation({ summary: 'Import single activity from FIT file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        athleteId: {
          type: 'string',
          description: 'Athlete UUID',
        },
        autoPairWithScheduled: {
          type: 'boolean',
          description: 'Auto-pair with scheduled workouts (default: true)',
        },
        scheduledWorkoutId: {
          type: 'string',
          description: 'Specific scheduled workout to pair with (skips auto-matching)',
        },
      },
      required: ['file', 'athleteId'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadActivity(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FitFileValidator({}),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('athleteId') athleteId: string,
    @Body('autoPairWithScheduled') autoPairWithScheduled?: string,
    @Body('scheduledWorkoutId') scheduledWorkoutId?: string,
  ): Promise<ImportedActivity> {
    const autoPair = autoPairWithScheduled === 'true' || autoPairWithScheduled === undefined;

    return this.activityImportService.importActivity({
      athleteId,
      buffer: file.buffer,
      filename: file.originalname,
      autoPairWithScheduled: autoPair,
      scheduledWorkoutId,
    });
  }

  /**
   * Import multiple activities in batch
   *
   * POST /api/activity-import/upload-batch
   */
  @Post('upload-batch')
  @ApiOperation({ summary: 'Import multiple activities from FIT files (batch upload)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        athleteId: {
          type: 'string',
          description: 'Athlete UUID',
        },
        autoPairWithScheduled: {
          type: 'boolean',
          description: 'Auto-pair with scheduled workouts (default: true)',
        },
      },
      required: ['files', 'athleteId'],
    },
  })
  @UseInterceptors(FilesInterceptor('files', 50)) // Max 50 files per batch
  async uploadBatch(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB per file
          new FitFileValidator({}),
        ],
      }),
    )
    files: Express.Multer.File[],
    @Body('athleteId') athleteId: string,
    @Body('autoPairWithScheduled') autoPairWithScheduled?: string,
  ): Promise<ImportedActivity[]> {
    const autoPair = autoPairWithScheduled === 'true' || autoPairWithScheduled === undefined;

    const fileBuffers = files.map(file => ({
      buffer: file.buffer,
      filename: file.originalname,
    }));

    return this.activityImportService.importBatch(athleteId, fileBuffers, autoPair);
  }

  /**
   * Get all activities for an athlete
   *
   * GET /api/activity-import/athlete/:athleteId
   */
  @Get('athlete/:athleteId')
  @ApiOperation({ summary: 'Get all activities for an athlete' })
  async getAthleteActivities(
    @Param('athleteId') athleteId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ activities: Activity[]; total: number }> {
    const options: any = {};

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (limit) options.limit = parseInt(limit, 10);
    if (offset) options.offset = parseInt(offset, 10);

    return this.activityImportService.getAthleteActivities(athleteId, options);
  }

  /**
   * Get single activity with full telemetry
   *
   * GET /api/activity-import/:activityId
   */
  @Get(':activityId')
  @ApiOperation({ summary: 'Get single activity with full telemetry data' })
  async getActivity(@Param('activityId') activityId: string): Promise<Activity> {
    return this.activityImportService.getActivity(activityId);
  }

  /**
   * Delete activity
   *
   * DELETE /api/activity-import/:activityId
   */
  @Delete(':activityId')
  @ApiOperation({ summary: 'Delete activity' })
  async deleteActivity(@Param('activityId') activityId: string): Promise<{ deleted: boolean }> {
    await this.activityImportService.deleteActivity(activityId);
    return { deleted: true };
  }

  // ========================================
  // WORKOUT IMPORT ENDPOINTS (TrainingPeaks planned workouts)
  // ========================================

  /**
   * Import planned workout from TrainingPeaks FIT file
   *
   * POST /api/activity-import/workout/upload
   */
  @Post('workout/upload')
  @ApiOperation({ summary: 'Import planned workout from TrainingPeaks FIT file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        coachId: {
          type: 'string',
          description: 'Coach UUID',
        },
        categoryId: {
          type: 'string',
          description: 'Workout category UUID (optional)',
        },
        overrideName: {
          type: 'string',
          description: 'Override workout name (optional)',
        },
        overrideDescription: {
          type: 'string',
          description: 'Override workout description (optional)',
        },
      },
      required: ['file', 'coachId'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadWorkout(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FitFileValidator({}),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('coachId') coachId: string,
    @Body('categoryId') categoryId?: string,
    @Body('overrideName') overrideName?: string,
    @Body('overrideDescription') overrideDescription?: string,
  ): Promise<ImportedWorkout> {
    return this.workoutImportService.importPlannedWorkout({
      coachId,
      buffer: file.buffer,
      filename: file.originalname,
      categoryId,
      overrideName,
      overrideDescription,
    });
  }

  /**
   * Import multiple planned workouts in batch
   *
   * POST /api/activity-import/workout/upload-batch
   */
  @Post('workout/upload-batch')
  @ApiOperation({
    summary: 'Import multiple planned workouts from TrainingPeaks FIT files (batch)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        coachId: {
          type: 'string',
          description: 'Coach UUID',
        },
        categoryId: {
          type: 'string',
          description: 'Workout category UUID (optional)',
        },
      },
      required: ['files', 'coachId'],
    },
  })
  @UseInterceptors(FilesInterceptor('files', 50)) // Max 50 files
  async uploadWorkoutBatch(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB per file
          new FitFileValidator({}),
        ],
      }),
    )
    files: Express.Multer.File[],
    @Body('coachId') coachId: string,
    @Body('categoryId') categoryId?: string,
  ): Promise<ImportedWorkout[]> {
    const fileBuffers = files.map(file => ({
      buffer: file.buffer,
      filename: file.originalname,
    }));

    return this.workoutImportService.importBatch(coachId, fileBuffers, categoryId);
  }
}
