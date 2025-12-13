/**
 * EmailInvitationsController - REST API for email invitations
 *
 * Endpoints:
 * - POST /email-invitations - Send a new email invitation
 * - GET /email-invitations/validate/:token - Validate an invitation token
 * - POST /email-invitations/accept - Accept an invitation
 * - GET /email-invitations/coach/:coachId - Get all invitations for a coach
 * - POST /email-invitations/:id/cancel - Cancel a pending invitation
 * - POST /email-invitations/:id/resend - Resend an invitation email
 *
 * @module email-invitations
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EmailInvitationsService } from './email-invitations.service';
import {
  SendEmailInvitationDto,
  AcceptInvitationDto,
  InvitationDetailsDto,
  InvitationListItemDto,
} from './dto';
import { Public } from '../auth/public.decorator';

@ApiTags('email-invitations')
@ApiBearerAuth()
@Controller('email-invitations')
export class EmailInvitationsController {
  constructor(private readonly emailInvitationsService: EmailInvitationsService) {}

  /**
   * Sends a new email invitation to an athlete
   */
  @Post()
  @ApiOperation({
    summary: 'Send an email invitation',
    description: 'Sends an email invitation to a potential athlete to join the coach\'s team',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation sent successfully',
    type: InvitationDetailsDto,
  })
  @ApiResponse({ status: 404, description: 'Coach not found' })
  @ApiResponse({ status: 409, description: 'Invitation already pending or athlete already connected' })
  async sendInvitation(@Body() dto: SendEmailInvitationDto) {
    return this.emailInvitationsService.sendInvitation(dto);
  }

  /**
   * Validates an invitation token (public endpoint for invitation links)
   */
  @Public()
  @Get('validate/:token')
  @ApiOperation({
    summary: 'Validate an invitation token',
    description: 'Checks if an invitation token is valid and returns invitation details',
  })
  @ApiParam({ name: 'token', description: 'The invitation token from the email link' })
  @ApiResponse({
    status: 200,
    description: 'Validation result with invitation details if valid',
  })
  async validateToken(@Param('token') token: string) {
    return this.emailInvitationsService.validate(token);
  }

  /**
   * Accepts an invitation (public endpoint - new users can accept without auth)
   */
  @Public()
  @Post('accept')
  @ApiOperation({
    summary: 'Accept an invitation',
    description: 'Accepts an invitation and creates the coach-athlete relationship. Can create a new user if needed.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation accepted, relationship created',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired invitation' })
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.emailInvitationsService.accept(dto);
  }

  /**
   * Gets all invitations sent by a coach
   */
  @Get('coach/:coachId')
  @ApiOperation({
    summary: 'Get coach\'s invitations',
    description: 'Retrieves all email invitations sent by a specific coach',
  })
  @ApiParam({ name: 'coachId', description: 'Coach user UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
    description: 'Filter by invitation status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invitations',
    type: [InvitationListItemDto],
  })
  async getCoachInvitations(
    @Param('coachId', ParseUUIDPipe) coachId: string,
    @Query('status') status?: string,
  ) {
    return this.emailInvitationsService.getCoachInvitations(
      coachId,
      status as any, // Type cast since Swagger doesn't understand the enum
    );
  }

  /**
   * Cancels a pending invitation
   */
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an invitation',
    description: 'Cancels a pending invitation so it can no longer be accepted',
  })
  @ApiParam({ name: 'id', description: 'Invitation UUID' })
  @ApiResponse({ status: 200, description: 'Invitation cancelled' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 400, description: 'Cannot cancel non-pending invitation' })
  async cancelInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('coachId', ParseUUIDPipe) coachId: string,
  ) {
    return this.emailInvitationsService.cancel(id, coachId);
  }

  /**
   * Resends an invitation email
   */
  @Post(':id/resend')
  @ApiOperation({
    summary: 'Resend an invitation',
    description: 'Resends the invitation email and extends the expiration date',
  })
  @ApiParam({ name: 'id', description: 'Invitation UUID' })
  @ApiResponse({ status: 200, description: 'Invitation resent' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 400, description: 'Cannot resend non-pending invitation' })
  async resendInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('coachId', ParseUUIDPipe) coachId: string,
  ) {
    return this.emailInvitationsService.resend(id, coachId);
  }
}
