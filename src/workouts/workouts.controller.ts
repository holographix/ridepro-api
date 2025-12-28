import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { WorkoutsService } from './workouts.service';
import { Prisma } from '@prisma/client';
import { Public } from '../auth/public.decorator';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('api/workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Public()
  @Get()
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('environment') environment?: string,
    @Query('intensity') intensity?: string,
    @Query('durationCategory') durationCategory?: string,
    @Query('search') search?: string,
    @Query('coachId') coachId?: string,
  ) {
    return this.workoutsService.findAll({
      categoryId,
      environment,
      intensity,
      durationCategory,
      search,
      coachId,
    });
  }

  @Public()
  @Get('categories')
  getCategories() {
    return this.workoutsService.getCategories();
  }

  @Public()
  @Get('categories/:slug')
  getCategoryBySlug(@Param('slug') slug: string) {
    return this.workoutsService.getCategoryBySlug(slug);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workoutsService.findOne(id);
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.workoutsService.findBySlug(slug);
  }

  @Post()
  create(@Body() data: Prisma.WorkoutCreateInput) {
    return this.workoutsService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Prisma.WorkoutUpdateInput) {
    return this.workoutsService.update(id, data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.workoutsService.delete(id);
  }

  @Post('upload-attachments')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads/workout-attachments',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Accept PDF, images, videos, documents
        const allowedMimes = [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new Error(
              `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`,
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
      },
    }),
  )
  uploadAttachments(@UploadedFiles() files: Express.Multer.File[]) {
    return {
      files: files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        url: `/uploads/workout-attachments/${file.filename}`,
        size: file.size,
        mimeType: file.mimetype,
      })),
    };
  }
}
