import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { WorkoutParsersService } from './workout-parsers.service';
import { ParseWorkoutDto, ImportWorkoutDto } from './dto/workout-parser.dto';

@Controller('api/workout-parsers')
export class WorkoutParsersController {
  constructor(private readonly parsersService: WorkoutParsersService) {}

  /**
   * Get list of supported file formats
   */
  @Get('formats')
  getSupportedFormats() {
    return {
      formats: this.parsersService.getSupportedFormats(),
      description: 'Supported workout file formats for import',
    };
  }

  /**
   * Parse workout from JSON body (for text content)
   */
  @Post('parse')
  parseWorkout(@Body() dto: ParseWorkoutDto) {
    const parsed = this.parsersService.parseWorkout(dto.content, dto.filename);
    return {
      success: true,
      parsed,
    };
  }

  /**
   * Parse and convert to RidePro format
   */
  @Post('convert')
  convertWorkout(@Body() dto: ParseWorkoutDto & ImportWorkoutDto) {
    const converted = this.parsersService.parseAndConvert(
      dto.content,
      dto.filename,
      {
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
      },
    );
    return {
      success: true,
      workout: converted,
    };
  }

  /**
   * Upload and parse a workout file
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 1024 * 1024, // 1MB max
      },
      fileFilter: (req, file, callback) => {
        const allowedExtensions = ['.zwo', '.erg', '.mrc'];
        const ext = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));

        if (allowedExtensions.includes(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  uploadAndParse(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const content = file.buffer.toString('utf-8');
    const parsed = this.parsersService.parseWorkout(
      content,
      file.originalname,
    );

    return {
      success: true,
      filename: file.originalname,
      parsed,
    };
  }

  /**
   * Upload, parse, and convert to RidePro format in one step
   */
  @Post('upload-and-convert')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 1024 * 1024,
      },
      fileFilter: (req, file, callback) => {
        const allowedExtensions = ['.zwo', '.erg', '.mrc'];
        const ext = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));

        if (allowedExtensions.includes(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  uploadAndConvert(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportWorkoutDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const content = file.buffer.toString('utf-8');
    const converted = this.parsersService.parseAndConvert(
      content,
      file.originalname,
      {
        name: dto.name || file.originalname.replace(/\.[^.]+$/, ''),
        description: dto.description,
        categoryId: dto.categoryId,
      },
    );

    return {
      success: true,
      filename: file.originalname,
      workout: converted,
    };
  }
}
