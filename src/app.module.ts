/**
 * AppModule - Root module for the RidePro API
 *
 * This is the main application module that imports and configures
 * all feature modules for the RidePro Training Platform.
 *
 * Modules included:
 * - PrismaModule: Database access via Prisma ORM
 * - AuthModule: Clerk authentication integration
 * - UsersModule: User profile management
 * - RelationshipsModule: Coach-athlete relationship management
 * - InviteCodesModule: Coach invitation codes for athlete onboarding
 * - WorkoutsModule: Workout library management
 * - CalendarModule: Training calendar and scheduling
 * - AvailabilityModule: Athlete training availability
 * - GoalsModule: Athlete training goals
 * - ZonesModule: Power and HR zone management
 *
 * @module app
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { UsersModule } from './users/users.module';
import { CalendarModule } from './calendar/calendar.module';
import { AvailabilityModule } from './availability/availability.module';
import { GoalsModule } from './goals/goals.module';
import { AthleteSettingsModule } from './athlete-settings/athlete-settings.module';
import { RelationshipsModule } from './relationships/relationships.module';
import { InviteCodesModule } from './invite-codes/invite-codes.module';
import { EmailModule } from './email/email.module';
import { EmailInvitationsModule } from './email-invitations/email-invitations.module';
import { CategoriesModule } from './categories/categories.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { WorkoutParsersModule } from './workout-parsers/workout-parsers.module';
import { ZonesModule } from './zones/zones.module';

/**
 * Root application module
 *
 * @class AppModule
 * @description Configures and bootstraps all feature modules for the API.
 * The module hierarchy ensures proper dependency injection and separation of concerns.
 */
@Module({
  imports: [
    // Core infrastructure
    PrismaModule,
    AuthModule,
    EmailModule,

    // User management
    UsersModule,
    RelationshipsModule,
    InviteCodesModule,
    EmailInvitationsModule,

    // Training features
    WorkoutsModule,
    CategoriesModule,
    CalendarModule,
    AvailabilityModule,
    GoalsModule,
    AthleteSettingsModule,

    // Onboarding & Assessments
    OnboardingModule,
    AssessmentsModule,

    // Workout file parsing
    WorkoutParsersModule,

    // Training zones
    ZonesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
