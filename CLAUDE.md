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
├── workout-parsers/     # Workout file parsers (ZWO, ERG, MRC)
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

**2-Day Assessment Protocol:**
Day 1: 1'/2'/5' efforts on 6-7% gradient
Day 2: 5" sprint + 12' climb on 6-7% gradient
Athletes have 15 days to complete Day 2 after Day 1

**Workflow Endpoints:**
- `POST /start` - Start new 2-day assessment (creates DAY1_PENDING)
- `POST /:id/complete-day1` - Complete Day 1 (transitions to DAY1_COMPLETED, sets 15-day expiration)
- `POST /:id/start-day2` - Start Day 2 (validates Day 1 complete, transitions to DAY2_PENDING)
- `POST /:id/complete-day2` - Complete Day 2 (calculates FTP & maxHR, auto-updates athlete, transitions to COMPLETED)
- `GET /athlete/:athleteId/ongoing` - Get ongoing test (returns null if no active test)
- `POST /check-expired` - Check and mark expired tests (background job)

**Query Endpoints:**
- `GET /athlete/:athleteId` - Get all completed assessments
- `GET /athlete/:athleteId/latest` - Get latest completed assessment
- `GET /athlete/:athleteId/stats` - Get athlete stats with assessment data (for AthleteStatsPage)
- `GET /coach/:coachId/status` - Get assessment status for all athletes of a coach
- `GET /:id` - Get assessment by ID

**Management:**
- `DELETE /:id` - Delete assessment (only allowed for in-progress tests, not completed)

### Zones (`/api/zones`)
- `GET /:athleteId` - Get all zones (power + HR) with calculated values based on FTP/maxHR
- `GET /:athleteId/power` - Get power zones configuration
- `PUT /:athleteId/power` - Update power zones (zoneSystem, zone1Max..zone6Max)
- `GET /:athleteId/hr` - Get HR zones configuration
- `PUT /:athleteId/hr` - Update HR zones (zoneSystem, zone1Max..zone5Max)
- `PUT /:athleteId/data` - Update athlete's FTP, maxHR, restingHR
- `POST /calculate/power` - Calculate power zones from FTP (without saving)
- `POST /calculate/hr` - Calculate HR zones from maxHR (without saving)

**Zone Systems:**
- Power: `COGGAN` (default), `POLARIZED`, `CUSTOM`
- HR: `STANDARD` (default), `KARVONEN`, `CUSTOM`

**Coach's Zone Formulas (from "Calcolo zone.xlsx"):**
- FC Soglia (Threshold HR) = 93% of Max HR
- HR zones calculated as % of FC Soglia
- 6 Power zones (% of FTP): Z1 0-55%, Z2 55-75%, Z3 75-90%, Z4 90-105%, Z5 105-120%, Z6 120-150%
- 5 HR zones (% of FC Soglia): Z1 <68%, Z2 68-83%, Z3 83-94%, Z4 94-105%, Z5 105-120%

**Auto-update on Assessment:**
- When a new assessment is created, athlete's FTP is auto-updated from estimatedFTP
- MaxHR is auto-updated if test result is higher than current value (takes max from all HR measurements)
- When fetching athlete stats (`/athlete/:athleteId/stats`), if athlete has no maxHR but has assessments with HR data, maxHR is automatically calculated and updated (fixes old assessments created before auto-update feature)

### Workout Parsers (`/api/workout-parsers`)
- `GET /formats` - Get list of supported file formats
- `POST /parse` - Parse workout from text content (body: { content, filename })
- `POST /convert` - Parse and convert to RidePro format (body: { content, filename, name?, description? })
- `POST /upload` - Upload and parse a workout file (multipart form: file)
- `POST /upload-and-convert` - Upload, parse, and convert in one step (multipart form: file + name?, description?)

**Supported Formats:**
- `.zwo` - Zwift workout files (XML format, power as % FTP decimals like 0.75)
- `.erg` - ERG files (absolute watts at time points, includes FTP for conversion)
- `.mrc` - MRC files (FTP percentage at time points)

**Parsed Segment Structure:**
- `startTime`, `endTime`, `duration` - Time in seconds
- `powerMin`, `powerMax` - Power as % of FTP
- `intensityClass` - warmUp, active, rest, coolDown
- `name` - Segment name (Warm Up, Endurance, Tempo, etc.)

**Assessment Status Enum:**
- `DAY1_PENDING` - Test started, Day 1 not yet completed
- `DAY1_COMPLETED` - Day 1 complete, waiting for Day 2 (15-day window)
- `DAY2_PENDING` - Day 2 started but not completed
- `COMPLETED` - Both days completed
- `EXPIRED` - Day 1 completed but 15-day window elapsed

**Assessment Fields:**
Day 1 (1'/2'/5' efforts):
- effort1minAvgPower, effort1minMaxHR
- effort2minAvgPower, effort2minMaxHR
- effort5minAvgPower, effort5minMaxHR

Day 2 (5" sprint + 12' climb):
- sprint5secPeakPower (PEAK power), sprint5secMaxHR
- climb12minAvgPower (AVERAGE power), climb12minMaxHR

Calculated:
- estimatedFTP (climb12minAvgPower × 0.95)
- maxHR (highest HR across all 6 measurements from both days)

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
