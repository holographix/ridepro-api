/**
 * Response DTOs for coach-athlete relationships
 *
 * These DTOs define the response shapes returned from the API
 * for relationship queries.
 *
 * @module relationships/dto
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationshipStatus } from '@prisma/client';

/**
 * Simplified user info included in relationship responses
 */
export class UserSummaryDto {
  @ApiProperty({
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiPropertyOptional({
    description: "User's full name",
    example: 'Marco Rossi',
  })
  fullName: string | null;

  @ApiProperty({
    description: 'User email address',
    example: 'marco.rossi@email.com',
  })
  email: string;

  @ApiPropertyOptional({
    description: "Athlete's FTP (only included for athletes)",
    example: 280,
  })
  ftp?: number | null;
}

/**
 * Full relationship response DTO
 *
 * @description Returned when querying relationships
 */
export class RelationshipResponseDto {
  @ApiProperty({
    description: 'Relationship UUID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  id: string;

  @ApiProperty({
    description: 'UUID of the coach',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  coachId: string;

  @ApiProperty({
    description: 'UUID of the athlete',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  athleteId: string;

  @ApiProperty({
    description: 'Current status of the relationship',
    enum: RelationshipStatus,
    example: 'ACTIVE',
  })
  status: RelationshipStatus;

  @ApiPropertyOptional({
    description: "Coach's private notes about the athlete",
    example: 'Focused on improving FTP',
  })
  notes: string | null;

  @ApiPropertyOptional({
    description: 'When the relationship became active',
    example: '2024-01-15T10:30:00.000Z',
  })
  startedAt: Date | null;

  @ApiPropertyOptional({
    description: 'When the relationship ended (if applicable)',
    example: null,
  })
  endedAt: Date | null;

  @ApiProperty({
    description: 'When the relationship was created',
    example: '2024-01-10T08:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the relationship was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Coach user details (when included)',
    type: UserSummaryDto,
  })
  coach?: UserSummaryDto;

  @ApiPropertyOptional({
    description: 'Athlete user details (when included)',
    type: UserSummaryDto,
  })
  athlete?: UserSummaryDto;
}

/**
 * Response for relationship with athlete details
 *
 * @description Used when a coach queries their athletes
 */
export class CoachAthleteListItemDto {
  @ApiProperty({ description: 'Relationship UUID' })
  id: string;

  @ApiProperty({ description: 'Relationship status', enum: RelationshipStatus })
  status: RelationshipStatus;

  @ApiPropertyOptional({ description: "Coach's notes" })
  notes: string | null;

  @ApiPropertyOptional({ description: 'When relationship became active' })
  startedAt: Date | null;

  @ApiProperty({ description: 'Athlete details', type: UserSummaryDto })
  athlete: UserSummaryDto;
}

/**
 * Response for relationship with coach details
 *
 * @description Used when an athlete queries their coaches
 */
export class AthleteCoachListItemDto {
  @ApiProperty({ description: 'Relationship UUID' })
  id: string;

  @ApiProperty({ description: 'Relationship status', enum: RelationshipStatus })
  status: RelationshipStatus;

  @ApiPropertyOptional({ description: 'When relationship became active' })
  startedAt: Date | null;

  @ApiProperty({ description: 'Coach details', type: UserSummaryDto })
  coach: UserSummaryDto;
}
