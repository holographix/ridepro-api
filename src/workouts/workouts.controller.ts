import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { Prisma } from '@prisma/client';
import { Public } from '../auth/public.decorator';

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
  ) {
    return this.workoutsService.findAll({
      categoryId,
      environment,
      intensity,
      durationCategory,
      search,
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
}
