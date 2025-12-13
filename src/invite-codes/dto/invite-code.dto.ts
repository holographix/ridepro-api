/**
 * DTOs for coach invite codes
 *
 * These DTOs define the request/response shapes for invite code
 * operations that allow coaches to onboard athletes easily.
 *
 * @module invite-codes/dto
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsString,
  Length,
} from 'class-validator';

/**
 * DTO for creating a new invite code
 *
 * @description Used when a coach generates a new invitation code
 * for athletes to use when connecting.
 */
export class CreateInviteCodeDto {
  @ApiProperty({
    description: 'UUID of the coach who owns this code',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  coachId: string;

  @ApiPropertyOptional({
    description: 'Maximum number of times this code can be used (null = unlimited)',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({
    description: 'When the code expires (ISO date string, null = never)',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

/**
 * DTO for redeeming an invite code
 *
 * @description Used when an athlete uses an invite code to connect with a coach
 */
export class RedeemInviteCodeDto {
  @ApiProperty({
    description: 'The invite code to redeem',
    example: 'COACH-ABC123',
    minLength: 6,
    maxLength: 20,
  })
  @IsString()
  @Length(6, 20)
  code: string;

  @ApiProperty({
    description: 'UUID of the athlete redeeming the code',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  athleteId: string;
}

/**
 * Response DTO for invite code
 *
 * @description Returned when querying or creating invite codes
 */
export class InviteCodeResponseDto {
  @ApiProperty({
    description: 'Invite code UUID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  id: string;

  @ApiProperty({
    description: 'The unique invite code string',
    example: 'COACH-ABC123',
  })
  code: string;

  @ApiProperty({
    description: 'UUID of the coach who owns this code',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  coachId: string;

  @ApiPropertyOptional({
    description: 'Maximum uses allowed (null = unlimited)',
    example: 10,
  })
  maxUses: number | null;

  @ApiProperty({
    description: 'Number of times this code has been used',
    example: 3,
  })
  usedCount: number;

  @ApiPropertyOptional({
    description: 'When the code expires (null = never)',
    example: '2025-12-31T23:59:59.000Z',
  })
  expiresAt: Date | null;

  @ApiProperty({
    description: 'Whether the code is currently active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'When the code was created',
    example: '2024-01-10T08:00:00.000Z',
  })
  createdAt: Date;
}

/**
 * Response DTO for code validation
 *
 * @description Returned when validating an invite code
 */
export class ValidateCodeResponseDto {
  @ApiProperty({
    description: 'Whether the code is valid',
    example: true,
  })
  valid: boolean;

  @ApiPropertyOptional({
    description: 'Coach details if code is valid',
  })
  coach?: {
    id: string;
    fullName: string | null;
    email: string;
  };

  @ApiPropertyOptional({
    description: 'Error message if code is invalid',
    example: 'Code has expired',
  })
  error?: string;
}
