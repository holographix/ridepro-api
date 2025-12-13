/**
 * InviteCodesModule - Coach invitation code management module
 *
 * This module provides functionality for managing coach invite codes
 * that allow easy athlete onboarding. It includes:
 * - InviteCodesService for business logic
 * - InviteCodesController for REST API endpoints
 *
 * Key features:
 * - Generate unique, readable codes (e.g., COACH-ABC123)
 * - Validate codes before redemption
 * - Redeem codes to create coach-athlete relationships
 * - Support for usage limits and expiration dates
 *
 * @module invite-codes
 */
import { Module } from '@nestjs/common';
import { InviteCodesService } from './invite-codes.service';
import { InviteCodesController } from './invite-codes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RelationshipsModule } from '../relationships/relationships.module';

/**
 * NestJS module for coach invite code management
 *
 * @class InviteCodesModule
 * @description Imports PrismaModule for database access and RelationshipsModule
 * for creating relationships when codes are redeemed.
 */
@Module({
  imports: [PrismaModule, RelationshipsModule],
  controllers: [InviteCodesController],
  providers: [InviteCodesService],
  exports: [InviteCodesService],
})
export class InviteCodesModule {}
