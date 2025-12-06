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
├── app.module.ts        # Root module
└── main.ts              # Entry point

prisma/
├── schema.prisma        # Database schema
└── migrations/          # Migration files

prisma.config.ts         # Prisma configuration (URLs)
```

## Database Schema

### Tables
- `users` - User profiles (coach/athlete roles, Clerk integration ready)
- `workout_categories` - Workout category groupings
- `workouts` - Workout library with structure JSON
- `training_weeks` - Weekly training plan containers
- `scheduled_workouts` - Workouts scheduled on calendar
- `athlete_availability` - Weekly availability templates
- `goals` - Athlete training goals (A/B/C priority)

### Enums
- `UserRole`: COACH, ATHLETE
- `DurationCategory`: SHORT (<1h), MEDIUM (1-2h), LONG (>2h)
- `Environment`: INDOOR, OUTDOOR, ANY
- `Intensity`: EASY, MODERATE, HARD, VERY_HARD
- `TimeSlot`: MORNING, AFTERNOON, EVENING
- `GoalPriority`: A, B, C

## API Endpoints

### Users (`/api/users`)
- `GET /me` - Get current authenticated user
- `PUT /me` - Update current user profile
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
