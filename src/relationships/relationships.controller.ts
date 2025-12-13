/**
 * RelationshipsController - REST API for coach-athlete relationships
 *
 * This controller exposes endpoints for managing coach-athlete relationships:
 * - POST /relationships - Create a new relationship (invitation)
 * - GET /relationships/:id - Get a specific relationship
 * - PATCH /relationships/:id - Update relationship status/notes
 * - POST /relationships/:id/accept - Accept a pending invitation
 * - POST /relationships/:id/decline - Decline a pending invitation
 * - POST /relationships/:id/end - End an active relationship
 * - POST /relationships/:id/pause - Pause a relationship
 * - POST /relationships/:id/resume - Resume a paused relationship
 * - GET /relationships/coach/:coachId/athletes - Get coach's athletes
 * - GET /relationships/athlete/:athleteId/coaches - Get athlete's coaches
 * - DELETE /relationships/:id - Delete a relationship
 *
 * @module relationships
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RelationshipStatus } from '@prisma/client';
import { RelationshipsService } from './relationships.service';
import {
  CreateRelationshipDto,
  UpdateRelationshipDto,
  RelationshipResponseDto,
  CoachAthleteListItemDto,
  AthleteCoachListItemDto,
} from './dto';

/**
 * Controller for coach-athlete relationship management
 *
 * @class RelationshipsController
 * @description Handles HTTP requests for relationship CRUD operations
 * and relationship state transitions (accept, decline, pause, resume, end).
 */
@ApiTags('relationships')
@ApiBearerAuth()
@Controller('relationships')
export class RelationshipsController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  /**
   * Creates a new coach-athlete relationship invitation
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new relationship',
    description:
      'Creates a new coach-athlete relationship in PENDING status. The athlete must accept the invitation for it to become active.',
  })
  @ApiResponse({
    status: 201,
    description: 'Relationship created successfully',
    type: RelationshipResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input or self-coaching' })
  @ApiResponse({ status: 404, description: 'Coach or athlete not found' })
  @ApiResponse({ status: 409, description: 'Relationship already exists' })
  async create(@Body() createDto: CreateRelationshipDto) {
    return this.relationshipsService.create(createDto);
  }

  /**
   * Gets a specific relationship by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a relationship by ID',
    description: 'Retrieves full details of a specific coach-athlete relationship',
  })
  @ApiParam({ name: 'id', description: 'Relationship UUID' })
  @ApiResponse({
    status: 200,
    description: 'Relationship found',
    type: RelationshipResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.relationshipsService.findOne(id);
  }

  /**
   * Updates a relationship's status or notes
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a relationship',
    description: 'Updates the status or notes of an existing relationship',
  })
  @ApiParam({ name: 'id', description: 'Relationship UUID' })
  @ApiResponse({
    status: 200,
    description: 'Relationship updated',
    type: RelationshipResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateRelationshipDto,
  ) {
    return this.relationshipsService.update(id, updateDto);
  }

  /**
   * Accepts a pending relationship invitation
   */
  @Post(':id/accept')
  @ApiOperation({
    summary: 'Accept a relationship invitation',
    description:
      'Accepts a pending coaching invitation, setting status to ACTIVE',
  })
  @ApiParam({ name: 'id', description: 'Relationship UUID' })
  @ApiResponse({
    status: 200,
    description: 'Relationship accepted',
    type: RelationshipResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Relationship is not in PENDING status',
  })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async accept(@Param('id', ParseUUIDPipe) id: string) {
    return this.relationshipsService.accept(id);
  }

  /**
   * Declines a pending relationship invitation
   */
  @Post(':id/decline')
  @ApiOperation({
    summary: 'Decline a relationship invitation',
    description:
      'Declines and deletes a pending coaching invitation',
  })
  @ApiParam({ name: 'id', description: 'Relationship UUID' })
  @ApiResponse({
    status: 200,
    description: 'Relationship declined and deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'Relationship is not in PENDING status',
  })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async decline(@Param('id', ParseUUIDPipe) id: string) {
    return this.relationshipsService.decline(id);
  }

  /**
   * Ends an active coaching relationship
   */
  @Post(':id/end')
  @ApiOperation({
    summary: 'End a relationship',
    description:
      'Ends a coaching relationship, setting status to ENDED',
  })
  @ApiParam({ name: 'id', description: 'Relationship UUID' })
  @ApiResponse({
    status: 200,
    description: 'Relationship ended',
    type: RelationshipResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async end(@Param('id', ParseUUIDPipe) id: string) {
    return this.relationshipsService.end(id);
  }

  /**
   * Pauses an active relationship
   */
  @Post(':id/pause')
  @ApiOperation({
    summary: 'Pause a relationship',
    description:
      'Temporarily pauses a coaching relationship (e.g., for off-season)',
  })
  @ApiParam({ name: 'id', description: 'Relationship UUID' })
  @ApiResponse({
    status: 200,
    description: 'Relationship paused',
    type: RelationshipResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async pause(@Param('id', ParseUUIDPipe) id: string) {
    return this.relationshipsService.pause(id);
  }

  /**
   * Resumes a paused relationship
   */
  @Post(':id/resume')
  @ApiOperation({
    summary: 'Resume a paused relationship',
    description:
      'Resumes a paused coaching relationship, setting status back to ACTIVE',
  })
  @ApiParam({ name: 'id', description: 'Relationship UUID' })
  @ApiResponse({
    status: 200,
    description: 'Relationship resumed',
    type: RelationshipResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Relationship is not in PAUSED status',
  })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async resume(@Param('id', ParseUUIDPipe) id: string) {
    return this.relationshipsService.resume(id);
  }

  /**
   * Gets all athletes for a coach
   */
  @Public()
  @Get('coach/:coachId/athletes')
  @ApiOperation({
    summary: "Get a coach's athletes",
    description:
      'Retrieves all athletes for a specific coach, optionally filtered by status',
  })
  @ApiParam({ name: 'coachId', description: 'Coach user UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RelationshipStatus,
    description: 'Filter by relationship status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of athletes',
    type: [CoachAthleteListItemDto],
  })
  async getAthletesForCoach(
    @Param('coachId', ParseUUIDPipe) coachId: string,
    @Query('status') status?: RelationshipStatus,
  ) {
    return this.relationshipsService.getAthletesForCoach(coachId, status);
  }

  /**
   * Gets all coaches for an athlete
   */
  @Get('athlete/:athleteId/coaches')
  @ApiOperation({
    summary: "Get an athlete's coaches",
    description:
      'Retrieves all coaches for a specific athlete, optionally filtered by status',
  })
  @ApiParam({ name: 'athleteId', description: 'Athlete user UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RelationshipStatus,
    description: 'Filter by relationship status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of coaches',
    type: [AthleteCoachListItemDto],
  })
  async getCoachesForAthlete(
    @Param('athleteId', ParseUUIDPipe) athleteId: string,
    @Query('status') status?: RelationshipStatus,
  ) {
    return this.relationshipsService.getCoachesForAthlete(athleteId, status);
  }

  /**
   * Gets pending invitations for an athlete
   */
  @Get('athlete/:athleteId/pending')
  @ApiOperation({
    summary: 'Get pending invitations for an athlete',
    description:
      'Retrieves all pending coaching invitations sent to an athlete',
  })
  @ApiParam({ name: 'athleteId', description: 'Athlete user UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of pending invitations',
    type: [AthleteCoachListItemDto],
  })
  async getPendingInvitationsForAthlete(
    @Param('athleteId', ParseUUIDPipe) athleteId: string,
  ) {
    return this.relationshipsService.getPendingInvitationsForAthlete(athleteId);
  }

  /**
   * Gets pending invitations sent by a coach
   */
  @Get('coach/:coachId/pending')
  @ApiOperation({
    summary: 'Get pending invitations sent by a coach',
    description:
      'Retrieves all pending coaching invitations sent by a coach',
  })
  @ApiParam({ name: 'coachId', description: 'Coach user UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of pending invitations',
    type: [CoachAthleteListItemDto],
  })
  async getPendingInvitationsByCoach(
    @Param('coachId', ParseUUIDPipe) coachId: string,
  ) {
    return this.relationshipsService.getPendingInvitationsByCoach(coachId);
  }

  /**
   * Deletes a relationship permanently
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a relationship',
    description: 'Permanently deletes a coach-athlete relationship',
  })
  @ApiParam({ name: 'id', description: 'Relationship UUID' })
  @ApiResponse({ status: 200, description: 'Relationship deleted' })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.relationshipsService.delete(id);
  }
}
