# RidePro Feature Documentation

## Table of Contents

1. [Coach-Athlete Relationships](#coach-athlete-relationships)
2. [Invitation Codes](#invitation-codes)
3. [User Management](#user-management)
4. [Workout Library](#workout-library)
5. [Training Calendar](#training-calendar)
6. [Athlete Availability](#athlete-availability)
7. [Training Goals](#training-goals)
8. [Athlete Onboarding](#athlete-onboarding)
9. [Fitness Assessments](#fitness-assessments)

---

## Coach-Athlete Relationships

### Overview

The RidePro platform uses a flexible many-to-many relationship model for coach-athlete connections. This design allows:

- **Dual roles**: A user can be both a coach AND an athlete simultaneously
- **Multiple coaches**: An athlete can have multiple coaches (e.g., cycling coach + strength coach)
- **Multiple athletes**: A coach can work with multiple athletes
- **No fixed roles**: Users don't have a permanent "coach" or "athlete" designation

### Relationship States

| State | Description | Transitions |
|-------|-------------|-------------|
| **PENDING** | Invitation sent, awaiting acceptance | → ACTIVE (accept) or deleted (decline) |
| **ACTIVE** | Active coaching relationship | → PAUSED, ENDED |
| **PAUSED** | Temporarily suspended | → ACTIVE (resume), ENDED |
| **ENDED** | Relationship terminated | Final state |

### Invitation Flow

```
1. Coach creates invitation (PENDING)
        ↓
2. Athlete receives notification
        ↓
3. Athlete accepts or declines
        ↓
   ┌────┴────┐
   ↓         ↓
ACTIVE   (deleted)
```

### Business Rules

1. **Self-coaching prohibited**: A user cannot create a relationship with themselves
2. **One relationship per pair**: Only one relationship can exist between a specific coach-athlete pair
3. **Timestamps tracked**:
   - `startedAt`: Set when relationship becomes ACTIVE
   - `endedAt`: Set when relationship becomes ENDED
4. **Private notes**: Coaches can add private notes about each athlete

### Use Cases

#### Scenario 1: Coach Invites Athlete by Email
1. Coach clicks "Invite Athlete"
2. Enters athlete's email address
3. System creates PENDING relationship
4. Athlete receives email notification
5. Athlete logs in and accepts invitation
6. Relationship becomes ACTIVE

#### Scenario 2: Athlete Uses Invite Code
1. Coach generates invite code
2. Coach shares code (via text, in person, etc.)
3. Athlete enters code in app
4. System creates PENDING relationship
5. Coach sees new pending invitation
6. Relationship becomes ACTIVE (auto-accepted via code)

#### Scenario 3: Seasonal Break
1. Coach pauses relationship for off-season
2. Status changes to PAUSED
3. Athlete still visible in coach's list (marked as paused)
4. Coach resumes relationship when new season starts

---

## Invitation Codes

### Overview

Invite codes provide an easy onboarding mechanism for coaches to connect with athletes without requiring email exchanges.

### Code Format

```
COACH-XXXXXX
```
- Prefix: `COACH-`
- Suffix: 6 alphanumeric characters
- Excluded: Ambiguous characters (0/O, 1/I/L) to prevent confusion

### Features

| Feature | Description |
|---------|-------------|
| **Usage limits** | Optional maximum number of uses |
| **Expiration** | Optional expiration date |
| **Activation** | Codes can be deactivated/reactivated |
| **Usage tracking** | Tracks how many times each code has been used |

### Validation

A code is valid if ALL conditions are met:
1. Code exists in database
2. `isActive` is true
3. Not expired (`expiresAt` is null or in the future)
4. Not at maximum uses (`usedCount < maxUses` or `maxUses` is null)

### Redemption Flow

```
1. Athlete enters code
        ↓
2. System validates code
        ↓
3. If valid:
   - Create PENDING relationship
   - Increment usedCount
        ↓
4. Athlete is now connected to coach
```

### Best Practices

1. **Limited-time codes**: Set expiration for time-sensitive promotions
2. **Single-use codes**: Set `maxUses: 1` for individual invitations
3. **Group codes**: Higher `maxUses` for team/group signups
4. **Deactivate old codes**: Clean up unused codes periodically

---

## User Management

### User Profile Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Internal unique identifier |
| `clerkUserId` | String | Clerk authentication ID |
| `email` | String | User's email (unique) |
| `fullName` | String | Display name |
| `ftp` | Integer | Functional Threshold Power (watts) |
| `avatarUrl` | String | Profile picture URL |

### Authentication

The platform uses Clerk for authentication:

1. **First login**: User profile created automatically from Clerk data
2. **Subsequent logins**: Local profile enriched with Clerk updates
3. **Session management**: Handled by Clerk on frontend

### Profile Updates

Users can update their own profile:
- `fullName`: Display name changes
- `ftp`: As fitness improves

Note: Email changes must go through Clerk authentication settings.

---

## Workout Library

### Overview

The workout library contains structured cycling workouts with detailed interval information.

### Workout Structure

```json
{
  "id": "uuid",
  "slug": "sweet-spot-intervals",
  "name": "Sweet Spot Intervals",
  "title": "Sweet Spot 2x20",
  "description": "Two 20-minute sweet spot intervals...",
  "durationSeconds": 4200,
  "durationCategory": "MEDIUM",
  "tssPlanned": 85,
  "ifPlanned": 0.88,
  "workoutType": "Bike",
  "environment": "ANY",
  "intensity": "HARD",
  "structure": {
    "steps": [
      { "type": "warmUp", "duration": 600, "powerZone": 2 },
      { "type": "active", "duration": 1200, "powerZone": 5 },
      { "type": "rest", "duration": 300, "powerZone": 1 },
      { "type": "active", "duration": 1200, "powerZone": 5 },
      { "type": "coolDown", "duration": 600, "powerZone": 2 }
    ]
  }
}
```

### Categories

- **Base Building**: Aerobic foundation workouts
- **Sweet Spot**: Threshold development
- **VO2max**: High-intensity intervals
- **Recovery**: Easy spinning sessions
- **Custom**: Coach-created workouts

### Filtering Options

- **Duration**: SHORT (< 1hr), MEDIUM (1-2hr), LONG (> 2hr)
- **Environment**: INDOOR, OUTDOOR, ANY
- **Intensity**: EASY, MODERATE, HARD, VERY_HARD
- **Category**: By workout category

---

## Training Calendar

### Overview

The training calendar organizes scheduled workouts by week for each athlete.

### Structure

```
TrainingWeek
  └── ScheduledWorkout[]
        └── Workout (reference)
```

### Features

1. **Week-based view**: Organized by Monday-Sunday weeks
2. **Multiple workouts per day**: Support for morning/evening sessions
3. **Sort order**: Workouts ordered within each day
4. **Completion tracking**: Mark workouts as completed
5. **Notes**: Add notes to scheduled workouts

### Coach vs Athlete Views

| Feature | Coach View | Athlete View |
|---------|------------|--------------|
| Schedule workouts | Yes | No |
| View calendar | All athletes | Own calendar |
| Mark complete | No | Yes |
| Add notes | Yes | Yes |

---

## Athlete Availability

### Overview

Athletes can specify their training availability to help coaches plan appropriate workouts.

### Configuration

For each day of the week (Monday = 0, Sunday = 6):

| Field | Description |
|-------|-------------|
| `available` | Whether the athlete can train that day |
| `timeSlots` | Available times (MORNING, AFTERNOON, EVENING) |
| `maxHours` | Maximum training hours for that day |
| `notes` | Additional context |

### Example

```json
{
  "dayIndex": 0,
  "available": true,
  "timeSlots": ["MORNING", "AFTERNOON"],
  "maxHours": 2.0,
  "notes": "Work from home Mondays"
}
```

### Use Case

Coach sees athlete's availability when planning training weeks:
- Monday: 2 hours morning/afternoon
- Tuesday: 1 hour evening only
- Wednesday: Rest day
- etc.

---

## Training Goals

### Overview

Athletes can set training goals (events, targets) that coaches use to plan periodization.

### Goal Structure

| Field | Description |
|-------|-------------|
| `name` | Goal name (e.g., "Gran Fondo Felice") |
| `eventDate` | Target date for the goal |
| `priority` | A (primary), B (secondary), C (other) |
| `eventType` | Type of event (Gran Fondo, Time Trial, etc.) |
| `targetDuration` | Expected duration/distance |
| `notes` | Additional details |

### Priority System

| Priority | Description | Training Focus |
|----------|-------------|----------------|
| **A** | Primary goal | Peak performance targeted |
| **B** | Secondary goal | Good form, not peaked |
| **C** | Training/other | Part of development |

### Example Goals

```json
[
  {
    "name": "National Championship TT",
    "eventDate": "2024-06-15",
    "priority": "A",
    "eventType": "Time Trial",
    "targetDuration": "40km"
  },
  {
    "name": "Club Road Race",
    "eventDate": "2024-05-01",
    "priority": "B",
    "eventType": "Road Race"
  }
]
```

### Coach Integration

Coaches can see athlete goals when:
1. Planning training blocks
2. Adjusting weekly volume
3. Scheduling taper periods
4. Setting workout intensities

---

## Athlete Onboarding

### Overview

New athletes complete a 7-step onboarding wizard to set up their profile before accessing the main app features. This ensures coaches have the information they need to create effective training plans.

### Onboarding Guard

- Athletes are redirected to `/onboarding` until they complete all steps
- Coaches skip onboarding (different workflow)
- Progress is saved after each step (users can resume later)

### Steps

| Step | Name | Data Collected |
|------|------|----------------|
| 1 | Personal Info | First name, last name, birthday, sex, menstrual date (if female) |
| 2 | Physical | Height (cm), weight (kg) |
| 3 | Category | Athlete category: Amatore, Juniores, U23, Elite, Pro |
| 4 | Discipline | Cycling disciplines with sub-types |
| 5 | Terrain | Preferred terrain: Hills (10-15' climbs), Flat, Mountains (1h+ climbs) |
| 6 | Availability | Weekly training availability (reuses availability editor) |
| 7 | Activities | Activity types + equipment (power meter, HR monitor) |

### Discipline Options

**MTB:**
- XC (90min race)
- GF/Marathon (3h+)
- No racing

**Gravel/Cyclocross:**
- Race (1h)
- Race (2h)
- Ultra (6h+)
- No racing

**Road:**
- Circuits (1h)
- Gran Fondo (2h+)
- Ultra (6h+)
- No racing

### Activity Types

| Type | Description |
|------|-------------|
| OUTDOOR_CYCLING | On-road or off-road cycling |
| INDOOR_CYCLING | Trainer/smart trainer sessions |
| WORKOUT_HOME | Home strength/flexibility |
| WORKOUT_GYM | Gym-based strength training |
| CROSS_RUNNING | Running cross-training |
| CROSS_SWIMMING | Swimming cross-training |
| CROSS_SKIING | Skiing (Nordic/Alpine) |

### User Journey: New Athlete Onboarding

```
1. Athlete signs up / accepts invitation
        ↓
2. Redirected to /onboarding
        ↓
3. Completes Step 1: Personal Info
        ↓
4. Progress saved, continues through steps
        ↓
5. Completes Step 7: Activities
        ↓
6. Clicks "Complete"
        ↓
7. onboardingCompleted = true
        ↓
8. Redirected to /dashboard
```

---

## Fitness Assessments

### Overview

Athletes can record fitness assessment test results to track progress over time. The system supports two standardized protocols commonly used in cycling coaching.

### Assessment Protocols

#### Protocol 1: Sprint + 12min Climb

A two-part test measuring explosive power and aerobic capacity.

| Effort | Duration | Metric Type | Description |
|--------|----------|-------------|-------------|
| Sprint | 15 seconds | **PEAK** power | Maximum power achieved during all-out sprint |
| Climb | 12 minutes | **AVERAGE** power | Mean power over sustained climb effort |

**Sprint Effort (15"):**
- Full recovery beforehand
- All-out maximal effort
- Record highest power value (PEAK)

**Climb Effort (12'):**
- Start fresh or after adequate recovery
- Sustained pacing (aim for even power distribution)
- Record mean power over 12 minutes (AVERAGE)

#### Protocol 2: 1/2/5 Minute Efforts

Three timed efforts to build a power curve profile.

| Effort | Duration | Metric Type | Description |
|--------|----------|-------------|-------------|
| 1 minute | 60s | **AVERAGE** power | Mean power over 1 minute all-out |
| 2 minutes | 120s | **AVERAGE** power | Mean power over 2 minutes all-out |
| 5 minutes | 300s | **AVERAGE** power | Mean power over 5 minutes all-out |

**All efforts:**
- Full recovery between efforts (10-15 min)
- All-out sustained effort for duration
- Record mean power (AVERAGE), not peak

### Assessment Data Structure

```json
{
  "id": "uuid",
  "athleteId": "uuid",
  "testType": "SPRINT_12MIN",
  "testDate": "2024-06-15",
  "sprintPeakPower": 1200,
  "sprintMaxHR": 185,
  "climb12AvgPower": 280,
  "climb12MaxHR": 175,
  "estimatedFTP": 265,
  "notes": "Felt strong today, good conditions"
}
```

### Key Terminology

| Term | Definition |
|------|------------|
| **PEAK Power** | Maximum power value achieved during the effort |
| **AVERAGE Power** | Mean power over the entire effort duration |
| **FTP** | Functional Threshold Power (estimated from test results) |
| **Max HR** | Highest heart rate recorded during the effort |

### User Journey: Record Assessment

```
1. Athlete opens Dashboard
        ↓
2. Clicks "New Assessment" on AssessmentCard
        ↓
3. Modal opens with protocol selector
        ↓
4. Selects protocol (Sprint+12min or 1/2/5min)
        ↓
5. Enters test date and results
        ↓
6. Submits form
        ↓
7. Assessment saved to database
        ↓
8. Dashboard shows latest assessment results
```

### Coach View

Coaches can view athlete assessments:
1. View latest assessment on athlete card
2. See assessment history over time
3. Track power progression
4. Compare assessments to inform training adjustments
