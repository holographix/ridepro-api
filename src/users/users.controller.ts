/**
 * UsersController - REST API for user management
 *
 * This controller exposes endpoints for managing user profiles:
 * - GET /api/users/me - Get current authenticated user
 * - PUT /api/users/me - Update current user's profile
 * - GET /api/users - List all users
 * - GET /api/users/:id - Get a specific user
 * - GET /api/users/clerk/:clerkUserId - Get user by Clerk ID
 * - POST /api/users - Create a new user
 * - PUT /api/users/:id - Update a user
 * - DELETE /api/users/:id - Delete a user
 *
 * Note: Coach-athlete relationship management has been moved to
 * the /relationships endpoints for better separation of concerns.
 *
 * @module users
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';

/**
 * Controller for user profile management
 *
 * @class UsersController
 * @description Handles HTTP requests for user CRUD operations.
 * Coach-athlete relationships are handled by RelationshipsController.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Lists all users (public endpoint for dev/testing user switcher)
   */
  @Public()
  @Get('list')
  @ApiOperation({
    summary: 'List all users (public)',
    description: 'Public endpoint to list all users for the dev/testing user switcher',
  })
  @ApiResponse({ status: 200, description: 'List of users' })
  listUsers() {
    return this.usersService.findAll();
  }

  /**
   * Gets the current authenticated user's profile
   */
  @Get('me')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Retrieves the profile of the currently authenticated user',
  })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getMe(@CurrentUser() user: User) {
    return this.usersService.findOne(user.id);
  }

  /**
   * Updates the current authenticated user's profile
   */
  @Put('me')
  @ApiOperation({
    summary: 'Update current user',
    description: 'Updates the profile of the currently authenticated user',
  })
  @ApiResponse({ status: 200, description: 'User profile updated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updateMe(@CurrentUser() user: User, @Body() data: Prisma.UserUpdateInput) {
    return this.usersService.update(user.id, data);
  }

  // ============================================
  // TOUR & SETUP CHECKLIST (must be before :id routes)
  // ============================================

  /**
   * Gets the current user's tour state
   */
  @Get('me/tour')
  @ApiOperation({
    summary: 'Get tour state',
    description: 'Gets the current user tour and setup checklist state',
  })
  @ApiResponse({ status: 200, description: 'Tour state returned' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getTourState(@CurrentUser() user: User) {
    return this.usersService.getTourState(user.id);
  }

  /**
   * Updates the current user's tour state
   */
  @Put('me/tour')
  @ApiOperation({
    summary: 'Update tour state',
    description: 'Updates the current user tour state (completed/dismissed)',
  })
  @ApiResponse({ status: 200, description: 'Tour state updated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updateTourState(
    @CurrentUser() user: User,
    @Body()
    data: {
      tourCompleted?: boolean;
      tourDismissed?: boolean;
      setupChecklistCompleted?: string[];
    },
  ) {
    return this.usersService.updateTourState(user.id, data);
  }

  /**
   * Marks a checklist item as completed for the current user
   */
  @Post('me/tour/checklist/:itemId')
  @ApiOperation({
    summary: 'Complete checklist item',
    description: 'Marks a setup checklist item as completed',
  })
  @ApiParam({ name: 'itemId', description: 'Checklist item ID' })
  @ApiResponse({ status: 200, description: 'Checklist item completed' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  completeChecklistItem(
    @CurrentUser() user: User,
    @Param('itemId') itemId: string,
  ) {
    return this.usersService.completeChecklistItem(user.id, itemId);
  }

  /**
   * Lists all users
   */
  @Get()
  @ApiOperation({
    summary: 'List all users',
    description: 'Retrieves a list of all users with relationship counts',
  })
  @ApiResponse({ status: 200, description: 'List of users' })
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * Gets a specific user by ID (public endpoint for dev/testing)
   */
  @Public()
  @Get(':id/public')
  @ApiOperation({
    summary: 'Get user by ID (public)',
    description: 'Public endpoint to get a specific user for dev/testing user switcher',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOnePublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Gets a specific user by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieves a specific user by their UUID',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Gets a user by their Clerk ID
   */
  @Get('clerk/:clerkUserId')
  @ApiOperation({
    summary: 'Get user by Clerk ID',
    description: 'Retrieves a user by their Clerk authentication ID',
  })
  @ApiParam({ name: 'clerkUserId', description: 'Clerk user ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findByClerkId(@Param('clerkUserId') clerkUserId: string) {
    return this.usersService.findByClerkId(clerkUserId);
  }

  /**
   * Creates a new user
   */
  @Post()
  @ApiOperation({
    summary: 'Create a user',
    description: 'Creates a new user profile',
  })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() data: Prisma.UserCreateInput) {
    return this.usersService.create(data);
  }

  /**
   * Updates a user by ID
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update a user',
    description: 'Updates an existing user profile',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: Prisma.UserUpdateInput,
  ) {
    return this.usersService.update(id, data);
  }

  /**
   * Deletes a user by ID
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Permanently deletes a user and all their related data',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.delete(id);
  }
}
