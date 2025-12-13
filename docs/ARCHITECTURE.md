# RidePro API Architecture

## Overview

The RidePro API is a NestJS-based backend service that powers the RidePro Training Platform. It provides RESTful endpoints for managing cycling training plans, workouts, and coach-athlete relationships.

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **NestJS** | Backend framework |
| **TypeScript** | Programming language |
| **Prisma** | Database ORM |
| **PostgreSQL** | Database (via Supabase) |
| **Clerk** | Authentication |
| **Swagger/OpenAPI** | API documentation |
| **Jest** | Testing framework |

## Project Structure

```
ridepro-api/
├── src/
│   ├── app.module.ts           # Root application module
│   ├── main.ts                 # Bootstrap and Swagger setup
│   │
│   ├── auth/                   # Authentication module
│   │   ├── auth.module.ts
│   │   ├── clerk.service.ts    # Clerk integration
│   │   └── current-user.decorator.ts
│   │
│   ├── prisma/                 # Database access
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   │
│   ├── users/                  # User management
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── users.controller.ts
│   │
│   ├── relationships/          # Coach-athlete relationships
│   │   ├── relationships.module.ts
│   │   ├── relationships.service.ts
│   │   ├── relationships.controller.ts
│   │   ├── relationships.service.spec.ts
│   │   └── dto/
│   │
│   ├── invite-codes/           # Invitation codes
│   │   ├── invite-codes.module.ts
│   │   ├── invite-codes.service.ts
│   │   ├── invite-codes.controller.ts
│   │   ├── invite-codes.service.spec.ts
│   │   └── dto/
│   │
│   ├── workouts/               # Workout library
│   ├── calendar/               # Training calendar
│   ├── availability/           # Athlete availability
│   └── goals/                  # Training goals
│
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration history
│
├── docs/
│   ├── ARCHITECTURE.md         # This file
│   ├── API.md                  # API endpoint documentation
│   └── FEATURES.md             # Feature details
│
└── test/                       # E2E tests
```

## Module Architecture

### Core Modules

#### AppModule
The root module that imports all feature modules and configures the application.

#### PrismaModule
Provides the `PrismaService` singleton for database access throughout the application.

#### AuthModule
Handles Clerk authentication integration:
- Token verification
- User synchronization
- Current user injection via decorator

### Feature Modules

#### UsersModule
Manages user profiles and accounts:
- CRUD operations for user data
- FTP (Functional Threshold Power) tracking
- User lookup by ID, email, or Clerk ID

#### RelationshipsModule
Manages coach-athlete relationships:
- Many-to-many relationship model
- Status management (PENDING, ACTIVE, PAUSED, ENDED)
- Accept/decline workflow for invitations

#### InviteCodesModule
Handles coach invitation codes:
- Code generation (format: COACH-XXXXXX)
- Validation and redemption
- Usage limits and expiration

#### WorkoutsModule
Manages the workout library:
- Workout templates with structured intervals
- Categories and filtering
- Coach custom workouts

#### CalendarModule
Handles training scheduling:
- Training weeks
- Scheduled workouts
- Completion tracking

#### AvailabilityModule
Manages athlete training availability:
- Day-by-day availability
- Time slot preferences
- Maximum hours per day

#### GoalsModule
Tracks athlete training goals:
- Event dates
- Priority levels (A, B, C)
- Goal types

## Data Model

### Key Relationships

```
User
  ├── coachingRelationships[] ──── CoachAthleteRelationship (as coach)
  ├── athleteRelationships[]  ──── CoachAthleteRelationship (as athlete)
  ├── inviteCodes[]          ──── CoachInviteCode
  ├── availability[]         ──── AthleteAvailability
  ├── goals[]                ──── Goal
  ├── trainingWeeks[]        ──── TrainingWeek
  └── customWorkouts[]       ──── Workout

CoachAthleteRelationship
  ├── coach                  ──── User
  └── athlete                ──── User

WorkoutCategory
  └── workouts[]             ──── Workout

TrainingWeek
  └── scheduledWorkouts[]    ──── ScheduledWorkout
                                   └── workout ──── Workout
```

### Coach-Athlete Relationship Model

The system uses a flexible many-to-many relationship model:

1. **No Fixed Roles**: Users don't have a fixed "coach" or "athlete" role
2. **Dual Capability**: Any user can be both a coach AND an athlete simultaneously
3. **Relationship States**: Each relationship has a status (PENDING → ACTIVE → PAUSED/ENDED)
4. **Invitation Flow**: Coaches invite athletes, athletes accept/decline

## API Design

### URL Structure
- `/api/users` - User management
- `/relationships` - Coach-athlete relationships
- `/invite-codes` - Invitation codes
- `/api/workouts` - Workout library
- `/api/calendar` - Training schedule
- `/api/availability` - Training availability
- `/api/goals` - Training goals

### Documentation
Interactive API documentation is available at `/api/docs` (Swagger UI).

## Authentication Flow

1. User authenticates via Clerk on frontend
2. Frontend sends Clerk JWT token with requests
3. `ClerkService` verifies the token
4. `@CurrentUser()` decorator injects the user into route handlers
5. User is auto-created in local DB on first login

## Error Handling

The API uses standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `500` - Internal Server Error

## Testing Strategy

### Unit Tests
- Located alongside source files (`*.spec.ts`)
- Test services in isolation with mocked dependencies
- Cover all business logic branches

### Integration Tests
- Located in `test/` directory
- Test complete request/response cycles
- Use test database

### E2E Tests
- Playwright tests in frontend project
- Test complete user flows

## Development

### Running Locally
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start development server
npm run start:dev
```

### Environment Variables
```env
DATABASE_URL=           # PostgreSQL connection (pooled)
DIRECT_URL=            # PostgreSQL connection (direct, for migrations)
CLERK_SECRET_KEY=      # Clerk authentication
PORT=3001              # Server port
```

## Deployment

The API is designed to be deployed to any Node.js hosting platform. Key considerations:
- Supabase for managed PostgreSQL
- Clerk for managed authentication
- Environment variables for configuration
