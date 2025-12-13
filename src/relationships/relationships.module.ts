/**
 * RelationshipsModule - Coach-Athlete relationship management module
 *
 * This module provides functionality for managing many-to-many
 * coach-athlete relationships. It includes:
 * - RelationshipsService for business logic
 * - RelationshipsController for REST API endpoints
 *
 * Key features:
 * - Create/accept/decline coaching invitations
 * - Manage relationship status (active, paused, ended)
 * - Query relationships from coach or athlete perspective
 *
 * @module relationships
 */
import { Module } from '@nestjs/common';
import { RelationshipsService } from './relationships.service';
import { RelationshipsController } from './relationships.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * NestJS module for coach-athlete relationship management
 *
 * @class RelationshipsModule
 * @description Imports PrismaModule for database access and provides
 * RelationshipsService and RelationshipsController.
 */
@Module({
  imports: [PrismaModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService],
  exports: [RelationshipsService],
})
export class RelationshipsModule {}
