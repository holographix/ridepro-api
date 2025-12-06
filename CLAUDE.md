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
- **Auth**: Clerk (planned)

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
├── prisma/              # Prisma service and module
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

## API Structure (Planned)

```
/api/users          # User management
/api/workouts       # Workout library CRUD
/api/calendar       # Training week/scheduled workouts
/api/availability   # Athlete availability
/api/goals          # Training goals
```
