/**
 * EmailInvitationsModule - Email invitation feature module
 *
 * Provides email invitation functionality for coaches to invite athletes.
 *
 * @module email-invitations
 */
import { Module } from '@nestjs/common';
import { EmailInvitationsController } from './email-invitations.controller';
import { EmailInvitationsService } from './email-invitations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RelationshipsModule } from '../relationships/relationships.module';

@Module({
  imports: [PrismaModule, RelationshipsModule],
  controllers: [EmailInvitationsController],
  providers: [EmailInvitationsService],
  exports: [EmailInvitationsService],
})
export class EmailInvitationsModule {}
