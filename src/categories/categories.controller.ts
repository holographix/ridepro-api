/**
 * Categories Controller
 *
 * REST API endpoints for managing workout categories.
 *
 * Endpoints:
 * - GET    /api/categories          - List all categories (global + coach's own)
 * - GET    /api/categories/:id      - Get single category by ID
 * - POST   /api/categories          - Create new category
 * - PUT    /api/categories/:id      - Update existing category
 * - DELETE /api/categories/:id      - Delete category (if empty)
 * - POST   /api/categories/reorder  - Batch update sort order
 *
 * Authorization:
 * - All endpoints require authentication (except GET which is public for global categories)
 * - Coaches can only manage their own categories
 * - Global categories (coachId = null) are read-only for coaches
 */
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
import { CategoriesService, CreateCategoryDto, UpdateCategoryDto } from './categories.service';
import { Public } from '../auth/public.decorator';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * GET /api/categories
   *
   * List all categories accessible to the user.
   * If coachId is provided, returns global categories + coach's own categories.
   * Otherwise returns only global categories.
   *
   * @param coachId - Optional coach ID to include coach's private categories
   * @returns Array of categories with workout counts
   */
  @Public()
  @Get()
  findAll(@Query('coachId') coachId?: string) {
    return this.categoriesService.findAll(coachId);
  }

  /**
   * GET /api/categories/:id
   *
   * Get a single category by ID.
   *
   * @param id - Category UUID
   * @returns Category with workout count
   * @throws NotFoundException if category doesn't exist
   */
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  /**
   * POST /api/categories
   *
   * Create a new workout category.
   * Slug is auto-generated from name.
   * Sort order defaults to last position if not provided.
   *
   * @param dto.name - Category name (required)
   * @param dto.description - Optional description
   * @param dto.sortOrder - Optional sort position
   * @param dto.coachId - Coach ID for private categories (null for global)
   * @returns Created category
   */
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  /**
   * PUT /api/categories/:id
   *
   * Update an existing category.
   * Slug is regenerated if name changes.
   *
   * @param id - Category UUID
   * @param dto.name - New category name
   * @param dto.description - New description
   * @param dto.sortOrder - New sort position
   * @param coachId - Requesting coach's ID for authorization
   * @returns Updated category
   * @throws ForbiddenException if trying to update another coach's category
   */
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Query('coachId') coachId?: string,
  ) {
    return this.categoriesService.update(id, dto, coachId);
  }

  /**
   * DELETE /api/categories/:id
   *
   * Delete a category.
   * Only coach-owned categories can be deleted.
   * Category must be empty (no workouts assigned).
   *
   * @param id - Category UUID
   * @param coachId - Requesting coach's ID for authorization
   * @throws ForbiddenException if trying to delete global or another coach's category
   * @throws BadRequestException if category has workouts assigned
   */
  @Delete(':id')
  delete(@Param('id') id: string, @Query('coachId') coachId?: string) {
    return this.categoriesService.delete(id, coachId);
  }

  /**
   * POST /api/categories/reorder
   *
   * Batch update sort order for multiple categories.
   * Useful for drag-and-drop reordering in the UI.
   *
   * @param body.items - Array of { id, sortOrder } objects
   * @param coachId - Requesting coach's ID for authorization
   * @returns { success: true }
   * @throws ForbiddenException if trying to reorder global or another coach's categories
   */
  @Post('reorder')
  reorder(
    @Body() body: { items: Array<{ id: string; sortOrder: number }> },
    @Query('coachId') coachId?: string,
  ) {
    return this.categoriesService.reorder(body.items, coachId);
  }
}
