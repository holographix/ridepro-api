/**
 * Email Invitations DTOs
 *
 * Data transfer objects for email invitation endpoints.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

/**
 * DTO for sending a new email invitation
 */
export class SendEmailInvitationDto {
  @ApiProperty({ description: 'Coach user ID sending the invitation' })
  @IsUUID()
  coachId: string;

  @ApiProperty({ description: 'Email address of the athlete to invite' })
  @IsEmail()
  athleteEmail: string;

  @ApiPropertyOptional({ description: 'Name of the athlete (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  athleteName?: string;

  @ApiPropertyOptional({ description: 'Personal message from the coach' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  personalMessage?: string;
}

/**
 * DTO for accepting an invitation
 */
export class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token from the email link' })
  @IsString()
  token: string;

  @ApiPropertyOptional({ description: 'Existing user ID if already registered' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Full name for new user registration' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;
}

/**
 * Response DTO for invitation details
 */
export class InvitationDetailsDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  athleteEmail: string;

  @ApiPropertyOptional()
  athleteName?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  coach: {
    id: string;
    fullName: string;
    email: string;
  };

  @ApiPropertyOptional()
  existingUser?: {
    id: string;
    fullName: string;
  };
}

/**
 * Response DTO for listing invitations
 */
export class InvitationListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  athleteEmail: string;

  @ApiPropertyOptional()
  athleteName?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  sentAt: Date;

  @ApiProperty()
  expiresAt: Date;
}
