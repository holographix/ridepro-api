/**
 * DTOs for coach-athlete relationship creation
 *
 * These DTOs define the request/response shapes for creating
 * new coach-athlete relationships.
 *
 * @module relationships/dto
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString, IsEnum } from 'class-validator';
import { RelationshipStatus } from '@prisma/client';

/**
 * DTO for creating a new coach-athlete relationship
 *
 * @description Used when a coach invites an athlete or an athlete requests coaching.
 * The relationship starts in PENDING status by default.
 */
export class CreateRelationshipDto {
  @ApiProperty({
    description: 'UUID of the coach in the relationship',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  coachId: string;

  @ApiProperty({
    description: 'UUID of the athlete in the relationship',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  athleteId: string;

  @ApiPropertyOptional({
    description: "Private notes about this athlete (coach's eyes only)",
    example: 'Focused on improving FTP for upcoming time trial',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO for updating an existing relationship
 *
 * @description Used to change relationship status or update notes
 */
export class UpdateRelationshipDto {
  @ApiPropertyOptional({
    description: 'New status for the relationship',
    enum: RelationshipStatus,
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(RelationshipStatus)
  status?: RelationshipStatus;

  @ApiPropertyOptional({
    description: "Coach's private notes about the athlete",
    example: 'Ready to increase training volume',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
