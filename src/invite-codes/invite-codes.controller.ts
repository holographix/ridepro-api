/**
 * InviteCodesController - REST API for coach invite codes
 *
 * This controller exposes endpoints for managing coach invitation codes:
 * - POST /invite-codes - Create a new invite code
 * - GET /invite-codes/:id - Get a specific invite code
 * - GET /invite-codes/code/:code - Get code by code string
 * - GET /invite-codes/validate/:code - Validate a code
 * - POST /invite-codes/redeem - Redeem a code to create relationship
 * - GET /invite-codes/coach/:coachId - Get all codes for a coach
 * - POST /invite-codes/:id/deactivate - Deactivate a code
 * - POST /invite-codes/:id/reactivate - Reactivate a code
 * - DELETE /invite-codes/:id - Delete a code
 *
 * @module invite-codes
 */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InviteCodesService } from './invite-codes.service';
import {
  CreateInviteCodeDto,
  RedeemInviteCodeDto,
  InviteCodeResponseDto,
  ValidateCodeResponseDto,
} from './dto';

/**
 * Controller for coach invite code management
 *
 * @class InviteCodesController
 * @description Handles HTTP requests for invite code CRUD operations
 * and code validation/redemption.
 */
@ApiTags('invite-codes')
@ApiBearerAuth()
@Controller('invite-codes')
export class InviteCodesController {
  constructor(private readonly inviteCodesService: InviteCodesService) {}

  /**
   * Creates a new invite code for a coach
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new invite code',
    description:
      'Creates a new invite code that athletes can use to connect with the coach',
  })
  @ApiResponse({
    status: 201,
    description: 'Invite code created successfully',
    type: InviteCodeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Coach not found' })
  async create(@Body() createDto: CreateInviteCodeDto) {
    return this.inviteCodesService.create(createDto);
  }

  /**
   * Gets an invite code by its ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get an invite code by ID',
    description: 'Retrieves full details of a specific invite code',
  })
  @ApiParam({ name: 'id', description: 'Invite code UUID' })
  @ApiResponse({
    status: 200,
    description: 'Invite code found',
    type: InviteCodeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invite code not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inviteCodesService.findOne(id);
  }

  /**
   * Gets an invite code by its code string
   */
  @Get('code/:code')
  @ApiOperation({
    summary: 'Get an invite code by code string',
    description: 'Retrieves an invite code using the code string (e.g., COACH-ABC123)',
  })
  @ApiParam({ name: 'code', description: 'The invite code string' })
  @ApiResponse({
    status: 200,
    description: 'Invite code found',
    type: InviteCodeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invite code not found' })
  async findByCode(@Param('code') code: string) {
    return this.inviteCodesService.findByCode(code);
  }

  /**
   * Validates an invite code without redeeming it
   */
  @Get('validate/:code')
  @ApiOperation({
    summary: 'Validate an invite code',
    description:
      'Checks if an invite code is valid without redeeming it. Returns coach info if valid.',
  })
  @ApiParam({ name: 'code', description: 'The invite code string to validate' })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    type: ValidateCodeResponseDto,
  })
  async validate(@Param('code') code: string) {
    return this.inviteCodesService.validate(code);
  }

  /**
   * Redeems an invite code to create a coach-athlete relationship
   */
  @Post('redeem')
  @ApiOperation({
    summary: 'Redeem an invite code',
    description:
      'Redeems an invite code to create a coach-athlete relationship in PENDING status',
  })
  @ApiResponse({
    status: 201,
    description: 'Code redeemed, relationship created',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  @ApiResponse({
    status: 409,
    description: 'Relationship already exists with this coach',
  })
  async redeem(@Body() redeemDto: RedeemInviteCodeDto) {
    return this.inviteCodesService.redeem(redeemDto);
  }

  /**
   * Gets all invite codes for a coach
   */
  @Get('coach/:coachId')
  @ApiOperation({
    summary: "Get a coach's invite codes",
    description:
      'Retrieves all invite codes created by a specific coach',
  })
  @ApiParam({ name: 'coachId', description: 'Coach user UUID' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'If true, only returns active, non-expired codes',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invite codes',
    type: [InviteCodeResponseDto],
  })
  async getCodesForCoach(
    @Param('coachId', ParseUUIDPipe) coachId: string,
    @Query('activeOnly', new ParseBoolPipe({ optional: true }))
    activeOnly?: boolean,
  ) {
    return this.inviteCodesService.getCodesForCoach(coachId, activeOnly);
  }

  /**
   * Deactivates an invite code
   */
  @Post(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate an invite code',
    description:
      'Deactivates an invite code so it can no longer be used',
  })
  @ApiParam({ name: 'id', description: 'Invite code UUID' })
  @ApiResponse({
    status: 200,
    description: 'Code deactivated',
    type: InviteCodeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invite code not found' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.inviteCodesService.deactivate(id);
  }

  /**
   * Reactivates an invite code
   */
  @Post(':id/reactivate')
  @ApiOperation({
    summary: 'Reactivate an invite code',
    description:
      'Reactivates a previously deactivated invite code',
  })
  @ApiParam({ name: 'id', description: 'Invite code UUID' })
  @ApiResponse({
    status: 200,
    description: 'Code reactivated',
    type: InviteCodeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invite code not found' })
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.inviteCodesService.reactivate(id);
  }

  /**
   * Deletes an invite code permanently
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an invite code',
    description: 'Permanently deletes an invite code',
  })
  @ApiParam({ name: 'id', description: 'Invite code UUID' })
  @ApiResponse({ status: 200, description: 'Code deleted' })
  @ApiResponse({ status: 404, description: 'Invite code not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.inviteCodesService.delete(id);
  }
}
