/**
 * EmailInvitationsService - Coach email invitation management
 *
 * This service handles email invitations for coaches to invite athletes:
 * - Sending email invitations via Clerk's invitation API
 * - Checking if athlete already exists in the system
 * - Accepting invitations (existing and new users)
 * - Managing invitation lifecycle (expiration, cancellation)
 *
 * Clerk integration:
 * - Invitations are created via Clerk Backend API
 * - Clerk sends the email and handles verification
 * - Coach metadata is stored in publicMetadata, transferred to user on signup
 * - Frontend handles signup via Clerk's ticket strategy
 *
 * @module email-invitations
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RelationshipsService } from '../relationships/relationships.service';
import { ClerkService } from '../auth/clerk.service';
import { SendEmailInvitationDto, AcceptInvitationDto } from './dto';
import { InvitationStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class EmailInvitationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private relationshipsService: RelationshipsService,
    private clerkService: ClerkService,
  ) {}

  /**
   * Generates a secure invitation token
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Sends an email invitation to an athlete via Clerk
   *
   * @param dto - Invitation details
   * @returns The created invitation record
   */
  async sendInvitation(dto: SendEmailInvitationDto) {
    // Verify coach exists
    const coach = await this.prisma.user.findUnique({
      where: { id: dto.coachId },
    });

    if (!coach) {
      throw new NotFoundException(`Coach with ID ${dto.coachId} not found`);
    }

    // Check if athlete already exists in the system
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.athleteEmail.toLowerCase() },
    });

    // Check for existing pending invitation
    const existingInvitation = await this.prisma.emailInvitation.findFirst({
      where: {
        coachId: dto.coachId,
        athleteEmail: dto.athleteEmail.toLowerCase(),
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      throw new ConflictException('An invitation to this email is already pending');
    }

    // Check if relationship already exists
    if (existingUser) {
      const existingRelationship = await this.prisma.coachAthleteRelationship.findUnique({
        where: {
          coachId_athleteId: {
            coachId: dto.coachId,
            athleteId: existingUser.id,
          },
        },
      });

      if (existingRelationship) {
        throw new ConflictException('This athlete is already connected to you');
      }
    }

    // Generate our internal token and expiration (7 days from now)
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation record first (to get the ID for publicMetadata)
    const invitation = await this.prisma.emailInvitation.create({
      data: {
        token,
        coachId: dto.coachId,
        athleteEmail: dto.athleteEmail.toLowerCase(),
        athleteName: dto.athleteName,
        existingUserId: existingUser?.id,
        personalMessage: dto.personalMessage,
        expiresAt,
      },
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    // Build the redirect URL for Clerk - points to our invitation acceptance page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/invite/accept/${token}`;

    try {
      // Create Clerk invitation with coach metadata
      // This metadata transfers to the user's publicMetadata when they sign up
      const clerkInvitation = await this.clerkService.createInvitation({
        emailAddress: dto.athleteEmail.toLowerCase(),
        redirectUrl,
        publicMetadata: {
          coachId: dto.coachId,
          coachName: coach.fullName || coach.email,
          invitationId: invitation.id,
          personalMessage: dto.personalMessage,
        },
        expiresInDays: 7,
      });

      // Update our invitation with Clerk's invitation ID
      await this.prisma.emailInvitation.update({
        where: { id: invitation.id },
        data: { clerkInvitationId: clerkInvitation.id },
      });

      return {
        ...invitation,
        clerkInvitationId: clerkInvitation.id,
      };
    } catch (error: any) {
      // If Clerk fails (e.g., duplicate email), fall back to our custom email
      console.warn('Clerk invitation failed, falling back to custom email:', error.message);

      // Send the invitation email via Resend as fallback
      await this.emailService.sendCoachInvitation({
        athleteEmail: dto.athleteEmail,
        athleteName: dto.athleteName,
        coachName: coach.fullName || coach.email,
        invitationToken: token,
        personalMessage: dto.personalMessage,
        expiresAt,
      });

      return invitation;
    }
  }

  /**
   * Gets invitation details by token
   *
   * @param token - The invitation token
   * @returns Invitation details with coach info
   */
  async getByToken(token: string) {
    const invitation = await this.prisma.emailInvitation.findUnique({
      where: { token },
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
        existingUser: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  /**
   * Validates an invitation token
   *
   * @param token - The invitation token to validate
   * @returns Validation result with invitation details if valid
   */
  async validate(token: string) {
    try {
      const invitation = await this.getByToken(token);

      // Check status
      if (invitation.status !== InvitationStatus.PENDING) {
        return {
          valid: false,
          error: `Invitation has already been ${invitation.status.toLowerCase()}`,
          status: invitation.status,
        };
      }

      // Check expiration
      if (invitation.expiresAt < new Date()) {
        // Update status to expired
        await this.prisma.emailInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });

        return {
          valid: false,
          error: 'Invitation has expired',
          status: InvitationStatus.EXPIRED,
        };
      }

      return {
        valid: true,
        invitation: {
          id: invitation.id,
          athleteEmail: invitation.athleteEmail,
          athleteName: invitation.athleteName,
          coach: invitation.coach,
          existingUser: invitation.existingUser,
          expiresAt: invitation.expiresAt,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          valid: false,
          error: 'Invitation not found',
        };
      }
      throw error;
    }
  }

  /**
   * Accepts an invitation and creates the coach-athlete relationship
   *
   * @param dto - Acceptance details
   * @returns The created relationship
   */
  async accept(dto: AcceptInvitationDto) {
    const validation = await this.validate(dto.token);

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const invitation = await this.getByToken(dto.token);
    let athleteId: string;

    // Determine the athlete user ID
    if (invitation.existingUserId) {
      // User already exists
      athleteId = invitation.existingUserId;
    } else if (dto.userId) {
      // User provided their ID (already registered)
      athleteId = dto.userId;

      // Update invitation with user link
      await this.prisma.emailInvitation.update({
        where: { id: invitation.id },
        data: { existingUserId: dto.userId },
      });
    } else {
      // Create new user from invitation
      const newUser = await this.prisma.user.create({
        data: {
          email: invitation.athleteEmail,
          fullName: dto.fullName || invitation.athleteName,
        },
      });
      athleteId = newUser.id;

      // Update invitation with new user link
      await this.prisma.emailInvitation.update({
        where: { id: invitation.id },
        data: { existingUserId: newUser.id },
      });
    }

    // Create the relationship
    const relationship = await this.relationshipsService.create({
      coachId: invitation.coachId,
      athleteId,
    });

    // Auto-approve the relationship since it came from an invitation
    await this.relationshipsService.update(relationship.id, { status: 'ACTIVE' });

    // Mark invitation as accepted
    await this.prisma.emailInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    return {
      relationship,
      athleteId,
      isNewUser: !invitation.existingUserId && !dto.userId,
    };
  }

  /**
   * Gets all invitations sent by a coach
   *
   * @param coachId - The coach's user ID
   * @param status - Optional filter by status
   */
  async getCoachInvitations(coachId: string, status?: InvitationStatus) {
    const where: { coachId: string; status?: InvitationStatus } = { coachId };
    if (status) {
      where.status = status;
    }

    return this.prisma.emailInvitation.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
        athleteEmail: true,
        athleteName: true,
        status: true,
        sentAt: true,
        expiresAt: true,
        acceptedAt: true,
      },
    });
  }

  /**
   * Cancels a pending invitation
   *
   * @param id - The invitation ID
   * @param coachId - The coach's user ID (for authorization)
   */
  async cancel(id: string, coachId: string) {
    const invitation = await this.prisma.emailInvitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.coachId !== coachId) {
      throw new BadRequestException('You can only cancel your own invitations');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending invitations');
    }

    return this.prisma.emailInvitation.update({
      where: { id },
      data: { status: InvitationStatus.CANCELLED },
    });
  }

  /**
   * Resends an invitation email
   *
   * @param id - The invitation ID
   * @param coachId - The coach's user ID (for authorization)
   */
  async resend(id: string, coachId: string) {
    const invitation = await this.prisma.emailInvitation.findUnique({
      where: { id },
      include: {
        coach: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.coachId !== coachId) {
      throw new BadRequestException('You can only resend your own invitations');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Can only resend pending invitations');
    }

    // Extend expiration
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    // Update expiration
    await this.prisma.emailInvitation.update({
      where: { id },
      data: { expiresAt: newExpiresAt },
    });

    // Resend email
    await this.emailService.sendCoachInvitation({
      athleteEmail: invitation.athleteEmail,
      athleteName: invitation.athleteName || undefined,
      coachName: invitation.coach.fullName || invitation.coach.email,
      invitationToken: invitation.token,
      personalMessage: invitation.personalMessage || undefined,
      expiresAt: newExpiresAt,
    });

    return { success: true, newExpiresAt };
  }
}
