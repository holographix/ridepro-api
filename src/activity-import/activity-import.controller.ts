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
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { ActivityImportService, ImportedActivity } from './activity-import.service';
import { Activity } from '@prisma/client';

/**
 * Activity Import Controller
 *
 * Endpoints for importing completed activities from FIT files
 */
@ApiTags('activity-import')
@Controller('api/activity-import')
export class ActivityImportController {
  constructor(private activityImportService: ActivityImportService) {}

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
          new FileTypeValidator({
            fileType: /\.(fit|fit\.gz)$/i,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('athleteId') athleteId: string,
    @Body('autoPairWithScheduled') autoPairWithScheduled?: string,
  ): Promise<ImportedActivity> {
    const autoPair = autoPairWithScheduled === 'true' || autoPairWithScheduled === undefined;

    return this.activityImportService.importActivity({
      athleteId,
      buffer: file.buffer,
      filename: file.originalname,
      autoPairWithScheduled: autoPair,
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
}
