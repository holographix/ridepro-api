# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

RidePro API - NestJS backend for the RidePro training platform.

## Commands

```bash
npm run start:dev   # Start development server with watch mode
npm run build       # Build for production
npm run start:prod  # Start production server
npm run test        # Run tests

# Prisma
npx prisma studio   # Open Prisma Studio (DB GUI)
npx prisma generate # Regenerate Prisma client after schema changes
DATABASE_URL="..." npx prisma db push  # Push schema changes (use direct URL, port 5432)
```

## Tech Stack

- **Framework**: NestJS
- **ORM**: Prisma
- **Database**: PostgreSQL (Supabase)
- **Auth**: Clerk

## Authentication

All endpoints require authentication via Clerk JWT token in the `Authorization` header:
```
Authorization: Bearer <clerk_token>
```

**Public endpoints** (no auth required):
- `GET /` - Health check
- `GET /health` - Health status
- `GET /api/workouts/*` - All workout library read endpoints

**Protected endpoints** require valid Clerk token. The user is auto-created in the database on first request.

### Auth decorators
- `@Public()` - Mark endpoint as public
- `@CurrentUser()` - Get current authenticated user in controller

## Database Connection

Supabase requires two connection URLs:
- **Pooled (port 6543)**: For app queries - uses pgbouncer
- **Direct (port 5432)**: For migrations/schema changes

When running Prisma migrations or db push, use the direct URL:
```bash
DATABASE_URL="postgresql://...@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" npx prisma db push
```

## Project Structure

```
src/
├── auth/                # Clerk authentication (guard, service, decorators)
├── prisma/              # Prisma service and module
├── users/               # User management
├── workouts/            # Workout library
├── calendar/            # Training weeks and scheduled workouts
├── availability/        # Athlete availability
├── goals/               # Training goals
├── relationships/       # Coach-athlete relationship management
├── email-invitations/   # Coach email invitations (Clerk integration)
├── athlete-settings/    # Combined availability + goals endpoint
├── email/               # Email service (Resend)
├── onboarding/          # Athlete onboarding (7-step wizard)
├── assessments/         # Fitness assessment tests
├── app.module.ts        # Root module
└── main.ts              # Entry point

prisma/
├── schema.prisma        # Database schema
├── seed.ts              # Database seeding (workouts, categories)
└── migrations/          # Migration files

prisma.config.ts         # Prisma configuration (URLs)
```

## Database Schema

### Tables
- `users` - User profiles (Clerk integration, no fixed role - users can be both coach and athlete). Includes tour state fields: tourCompleted, tourDismissed, setupChecklistCompleted[]
- `coach_athlete_relationships` - Many-to-many coach/athlete connections with status
- `coach_invite_codes` - Reusable invite codes for athlete onboarding
- `email_invitations` - Email-based invitations with Clerk integration
- `workout_categories` - Workout category groupings
- `workouts` - Workout library with structure JSON
- `training_weeks` - Weekly training plan containers
- `scheduled_workouts` - Workouts scheduled on calendar
- `athlete_availability` - Weekly availability templates
- `goals` - Athlete training goals (A/B/C priority)
- `athlete_disciplines` - Athlete discipline selections (MTB/Gravel/Road with sub-types)
- `athlete_activity_types` - Athlete activity type preferences
- `assessments` - Fitness assessment test results

### Enums
- `RelationshipStatus`: PENDING, ACTIVE, PAUSED, ENDED
- `InvitationStatus`: PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED
- `DurationCategory`: SHORT (<1h), MEDIUM (1-2h), LONG (>2h)
- `Environment`: INDOOR, OUTDOOR, ANY
- `Intensity`: EASY, MODERATE, HARD, VERY_HARD
- `TimeSlot`: MORNING, AFTERNOON, EVENING
- `GoalPriority`: A, B, C
- `Sex`: MALE, FEMALE
- `AthleteCategory`: AMATORE, JUNIORES, U23, ELITE, PRO
- `TerrainType`: HILLS, FLAT, MOUNTAINS
- `DisciplineType`: MTB, GRAVEL_CICLOCROSS, ROAD
- `DisciplineSubType`: MTB_XC_90MIN, MTB_GF_MARATHON_3H, MTB_NO_RACE, GRAVEL_RACE_1H, GRAVEL_RACE_2H, GRAVEL_ULTRA_6H, GRAVEL_NO_RACE, ROAD_CIRCUITS_1H, ROAD_GRAN_FONDO_2H, ROAD_ULTRA_6H, ROAD_NO_RACE
- `ActivityType`: OUTDOOR_CYCLING, INDOOR_CYCLING, WORKOUT_HOME, WORKOUT_GYM, CROSS_RUNNING, CROSS_SWIMMING, CROSS_SKIING
- `AssessmentType`: SPRINT_12MIN, POWER_1_2_5MIN

## API Endpoints

### Users (`/api/users`)
- `GET /me` - Get current authenticated user
- `PUT /me` - Update current user profile
- `GET /me/tour` - Get tour state (tourCompleted, tourDismissed, setupChecklistCompleted)
- `PUT /me/tour` - Update tour state (tourCompleted, tourDismissed)
- `POST /me/tour/checklist/:itemId` - Mark checklist item as completed
- `GET /` - List all users
- `GET /:id` - Get user by ID
- `GET /clerk/:clerkUserId` - Get user by Clerk ID
- `GET /:id/athletes` - Get coach's athletes
- `POST /` - Create user
- `PUT /:id` - Update user
- `DELETE /:id` - Delete user
- `POST /:athleteId/assign-coach/:coachId` - Assign coach to athlete
- `DELETE /:athleteId/coach` - Remove coach from athlete

### Workouts (`/api/workouts`)
- `GET /` - List workouts (filters: categoryId, environment, intensity, durationCategory, search)
- `GET /categories` - List all categories with workout counts
- `GET /categories/:slug` - Get category with workouts
- `GET /:id` - Get workout by ID
- `GET /slug/:slug` - Get workout by slug
- `POST /` - Create workout
- `PUT /:id` - Update workout
- `DELETE /:id` - Delete workout

### Calendar (`/api/calendar`)
- `GET /week/:athleteId?weekStart=` - Get training week
- `GET /week/id/:id` - Get week by ID
- `GET /weeks/:athleteId?start=&end=` - Get weeks in date range
- `POST /week` - Create training week
- `PUT /week/:id` - Update week notes
- `DELETE /week/:id` - Delete week
- `POST /scheduled` - Add workout to day
- `PUT /scheduled/:id` - Update scheduled workout
- `PUT /scheduled/:id/move` - Move workout to different day
- `DELETE /scheduled/:id` - Remove scheduled workout
- `PUT /scheduled/:id/complete` - Mark workout completed
- `PUT /week/:weekId/day/:dayIndex/reorder` - Reorder workouts in a day

### Availability (`/api/availability`)
- `GET /:athleteId` - Get athlete's weekly availability
- `PUT /:athleteId` - Set full week availability
- `PUT /:athleteId/day/:dayIndex` - Set single day availability
- `DELETE /:athleteId/day/:dayIndex` - Clear day availability
- `DELETE /:athleteId` - Clear all availability

### Goals (`/api/goals`)
- `GET /athlete/:athleteId` - Get athlete's goals
- `GET /athlete/:athleteId/upcoming` - Get upcoming goals
- `GET /athlete/:athleteId/priority/:priority` - Get goals by priority (A/B/C)
- `GET /:id` - Get goal by ID
- `POST /` - Create goal
- `PUT /:id` - Update goal
- `DELETE /:id` - Delete goal

### Athlete Settings (`/api/athlete-settings`)
- `GET /:athleteId` - Get combined availability + goals for an athlete

### Relationships (`/api/relationships`)
- `GET /coach/:coachId/athletes` - Get coach's athletes with relationship status
- `GET /athlete/:athleteId/coaches` - Get athlete's coaches
- `POST /` - Create new relationship (coachId, athleteId)
- `PUT /:id/status` - Update relationship status (PENDING/ACTIVE/PAUSED/ENDED)
- `DELETE /:id` - Remove relationship

### Email Invitations (`/api/email-invitations`)
- `POST /send` - Send invitation (coachId, athleteEmail, athleteName?, personalMessage?)
- `GET /validate/:token` - Validate invitation token (public)
- `POST /accept` - Accept invitation (token, name?, userId?)
- `GET /coach/:coachId` - List coach's sent invitations
- `PUT /:id/cancel` - Cancel pending invitation
- `PUT /:id/resend` - Resend invitation email

### Onboarding (`/api/onboarding`)
- `GET /:athleteId/status` - Get onboarding status (completed, currentStep)
- `POST /:athleteId/step/:stepNumber` - Save step data
- `POST /:athleteId/complete` - Mark onboarding as complete
- `GET /:athleteId/profile` - Get full athlete profile (for coach view)

**Step Data by Step Number:**
1. Personal: firstName, lastName, birthday, sex, lastMenstrualDate (if female)
2. Physical: heightCm, weightKg
3. Category: athleteCategory (AMATORE, JUNIORES, U23, ELITE, PRO)
4. Discipline: disciplines[] (discipline, subType)
5. Terrain: terrain (HILLS, FLAT, MOUNTAINS)
6. Availability: weeklyAvailability[] (dayIndex, isAvailable, maxHours, etc.)
7. Activities: activityTypes[], hasPowerMeter, hasHRMonitor

### Assessments (`/api/assessments`)
- `GET /athlete/:athleteId` - Get all athlete assessments
- `GET /athlete/:athleteId/latest` - Get latest assessment
- `GET /athlete/:athleteId/stats` - Get athlete stats with assessment data (for AthleteStatsPage)
- `GET /coach/:coachId/status` - Get assessment status for all athletes of a coach
- `GET /:id` - Get assessment by ID
- `POST /sprint-12min` - Create Sprint + 12min assessment
- `POST /power-125min` - Create Power 1/2/5min assessment
- `POST /athlete/:athleteId/update-ftp` - Update athlete's FTP from latest assessment
- `PUT /:id` - Update assessment
- `DELETE /:id` - Delete assessment

**Assessment Types:**
- `SPRINT_12MIN`: 15" sprint (PEAK power) + 12' climb (AVERAGE power)
- `POWER_1_2_5MIN`: 1'/2'/5' efforts (all AVERAGE power)

**Sprint + 12min Protocol Fields:**
- sprintPeakPower (PEAK power during 15" sprint)
- sprintMaxHR
- climb12AvgPower (AVERAGE power during 12' climb)
- climb12MaxHR

**Power 1/2/5min Protocol Fields:**
- effort1minAvgPower, effort1minMaxHR
- effort2minAvgPower, effort2minMaxHR
- effort5minAvgPower, effort5minMaxHR

## Clerk Integration

### Invitation Flow (with Clerk)

1. **Coach sends invitation**: `POST /api/email-invitations/send`
   - Creates invitation record in database
   - Calls Clerk's `invitations.createInvitation()` with:
     - `redirectUrl`: `/invite/accept/:token`
     - `publicMetadata`: `{ coachId, coachName, invitationId }`
   - Clerk sends email with invitation link containing `__clerk_ticket` param

2. **Athlete clicks email link**: Redirected to `/invite/accept/:token?__clerk_ticket=xxx`

3. **Frontend handles signup**: Uses Clerk's ticket strategy
   ```typescript
   const result = await signUp.create({
     strategy: 'ticket',
     ticket: clerkTicket,  // from URL param
     firstName,
     lastName,
     password,
   });
   ```

4. **Accept invitation**: After Clerk signup completes, call `POST /api/email-invitations/accept`
   - Creates coach-athlete relationship (auto-approved)
   - Marks invitation as accepted

### ClerkService Methods
- `createInvitation({ emailAddress, redirectUrl, publicMetadata, expiresInDays })`
- `revokeInvitation(invitationId)`
- `listInvitations()`
- `getUserPublicMetadata(clerkUserId)` - Get coach metadata from invitation

### Fallback Flow
If Clerk invitation fails (e.g., user already has Clerk account), falls back to Resend email with custom invitation link.

## MANDATORY: Documentation Maintenance

**CRITICAL**: After completing ANY feature, bug fix, or significant change, you MUST update the documentation.

### Required Updates

1. **Frontend docs** (`../ridepro-fe/docs/FEATURES-AND-USER-JOURNEYS.md`)
   - Update API endpoints if changed
   - Update data models if changed
   - Add/update user journeys for e2e testing

2. **This file (`CLAUDE.md`)** - API technical reference
   - Update API endpoints table if endpoints added/changed
   - Update Prisma schema section if database changed
   - Update enums section if enums added

### What Triggers Documentation Updates

- New API endpoint (add/modify/remove)
- Database schema changes (Prisma)
- Business logic changes
- Authentication/authorization changes
- New service integrations

### Documentation Checklist

Before marking a task complete, verify:
- [ ] API endpoint documented in endpoint tables above
- [ ] Database changes reflected in schema section
- [ ] Frontend docs updated if user-facing feature
- [ ] This file updated if API changed
