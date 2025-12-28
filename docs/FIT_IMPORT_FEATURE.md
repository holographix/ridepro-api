# FIT File Import System - Feature Documentation

## Table of Contents
1. [Overview](#overview)
2. [Business Logic & Rules](#business-logic--rules)
3. [User Journeys](#user-journeys)
4. [E2E Test Scenarios](#e2e-test-scenarios)
5. [API Specification](#api-specification)
6. [Database Schema](#database-schema)
7. [Technical Implementation](#technical-implementation)

---

## Overview

The FIT File Import System enables:
- **Athletes**: Upload completed rides (Zwift, Garmin, TrainingPeaks) with full telemetry
- **Coaches**: Import planned workouts from TrainingPeaks as library templates

### Supported File Types
1. **Completed Activities** - GPS, power, HR, cadence telemetry (second-by-second)
   - Zwift indoor rides
   - Garmin/TrainingPeaks outdoor rides
   - Auto-pairs with scheduled workouts

2. **Planned Workouts** - TrainingPeaks structured workouts
   - Workout steps with intervals
   - Power/HR targets
   - Converts to RidePro workout templates

---

## Business Logic & Rules

### 1. File Type Auto-Detection

**Rule 1.1: Automatic File Type Identification**
```
ON FIT FILE UPLOAD:
  Decompress if gzipped (.fit.gz)
  Parse with Garmin FIT SDK

  IF contains workoutMesgs OR workoutStepMesgs THEN
    File Type = "planned_workout"
    Route to Workout Import Service
  ELSE IF contains recordMesgs OR sessionMesgs THEN
    File Type = "completed_activity"
    Route to Activity Import Service
  ELSE
    REJECT with error "Unrecognized FIT file type"
  END IF
```

### 2. Activity Import Rules

**Rule 2.1: Activity Storage**
- Store raw telemetry as JSONB in `Activity.telemetryData`
- Store lap/segment data as JSONB in `Activity.laps`
- Extract summary stats: avg/max power, HR, cadence, speed
- Calculate GPS bounds if available
- Preserve original filename and file size

**Rule 2.2: Auto-Pairing with Scheduled Workouts**
```
IF autoPairWithScheduled === true THEN
  activity_day_of_week = extract_day_from_timestamp(activity.startTime)
  activity_week_start = get_monday_of_week(activity.startTime)

  training_week = FIND TrainingWeek WHERE
    athleteId = activity.athleteId
    AND weekStart <= activity.startTime
    AND weekStart > (activity_week_start - 7 days)

  IF training_week EXISTS THEN
    matching_workouts = FILTER training_week.scheduledWorkouts WHERE
      dayIndex = activity_day_of_week
      AND completed = false
      AND activities IS EMPTY

    IF matching_workouts.length > 0 THEN
      best_match = SELECT_BEST_MATCH(matching_workouts, activity.activityType)

      LINK activity.scheduledWorkoutId = best_match.id
      UPDATE best_match SET
        completed = true
        completedAt = activity.startTime
        actualDurationSeconds = activity.durationSeconds
        actualTSS = activity.tss
        actualIF = activity.intensityFactor
        avgPower = activity.avgPower
        avgHeartRate = activity.avgHeartRate
    END IF
  END IF
END IF
```

**Rule 2.3: Best Match Selection for Pairing**
```
FUNCTION SELECT_BEST_MATCH(workouts, activityType):
  IF workouts.length === 1 THEN
    RETURN workouts[0]
  END IF

  // Try type matching
  FOR EACH workout IN workouts:
    workout_type_lower = workout.workout.workoutType.toLowerCase()
    activity_type_lower = activityType.toLowerCase()

    IF activity_type_lower.includes("indoor") AND workout_type_lower.includes("indoor") THEN
      RETURN workout
    END IF

    IF activity_type_lower.includes("outdoor") AND workout_type_lower.includes("outdoor") THEN
      RETURN workout
    END IF

    IF activity_type_lower.includes("cycling") AND workout_type_lower.includes("cycling") THEN
      RETURN workout
    END IF
  END FOR

  // Fallback: return first workout
  RETURN workouts[0]
```

**Rule 2.4: Batch Import**
- Process files sequentially (not in parallel to avoid race conditions)
- Continue on individual file errors (log and skip)
- Return array of successfully imported activities
- Maximum: 50 files per batch request

### 3. Workout Import Rules

**Rule 3.1: Planned Workout Conversion**
```
FOR EACH workout_step IN fit_workout_steps:
  IF step.type === "repeat" THEN
    CREATE repetition_wrapper WITH
      count = step.repeatCount
      nested_steps = CONVERT_STEPS(step.repeatSteps)
  ELSE
    CREATE single_step WITH
      name = step.name
      intensityClass = MAP_INTENSITY(step.type)
      duration = CONVERT_DURATION(step.durationType, step.durationValue)
      targets = CONVERT_TARGETS(step.targetType, step.targetMin, step.targetMax)
  END IF
END FOR
```

**Rule 3.2: Intensity Class Mapping**
```
warmup → warmUp
cooldown → coolDown
rest → rest
active (default) → active
```

**Rule 3.3: Duration Conversion**
```
IF durationType === "time" AND durationValue EXISTS THEN
  RETURN { value: durationValue, unit: "second" }
ELSE IF durationType === "distance" AND durationValue EXISTS THEN
  RETURN { value: durationValue, unit: "meter" }
ELSE IF durationType === "open" THEN
  RETURN { value: 0, unit: "repetition" }
ELSE
  RETURN { value: 60, unit: "second" } // Default
END IF
```

**Rule 3.4: Target Conversion**
```
// TrainingPeaks stores power as % FTP in decimal (0.75 = 75%)
IF targetType === "power" THEN
  RETURN {
    minValue: targetMin, // Already as % FTP
    maxValue: targetMax || targetMin
  }
ELSE IF targetType === "heartRate" THEN
  RETURN {
    hrMin: targetMin,
    hrMax: targetMax || targetMin
  }
ELSE IF targetType === "cadence" THEN
  RETURN {
    cadenceMin: targetMin,
    cadenceMax: targetMax || targetMin
  }
END IF
```

**Rule 3.5: TSS Estimation**
```
total_weighted_power = 0
total_duration = 0

FOR EACH step WHERE step.targetType === "power":
  avg_power = (step.targetMin + step.targetMax) / 2
  duration = step.durationValue || 60

  // Weight by fourth power for NP approximation
  total_weighted_power += (avg_power ^ 4) * duration
  total_duration += duration
END FOR

normalized_power = (total_weighted_power / total_duration) ^ 0.25
intensity_factor = normalized_power // NP is already % FTP
duration_hours = total_duration / 3600

TSS = duration_hours * (intensity_factor ^ 2) * 100
```

**Rule 3.6: Auto-Category Creation**
```
IF categoryId NOT PROVIDED THEN
  category = FIND WorkoutCategory WHERE
    name = "Imported Workouts"
    AND coachId = current_coach_id

  IF category NOT FOUND THEN
    category = CREATE WorkoutCategory WITH
      name = "Imported Workouts"
      slug = "imported-workouts"
      description = "Workouts imported from TrainingPeaks"
      coachId = current_coach_id
  END IF

  USE category.id
END IF
```

### 4. GPS Coordinate Conversion

**Rule 4.1: Semicircle to Decimal Degrees**
```
// FIT stores GPS as semicircles (2^31 semicircles = 180°)
decimal_degrees = semicircles * (180 / 2^31)

EXAMPLE:
  position_lat: 527684015 semicircles
  → 527684015 * (180 / 2147483648)
  → 44.256° North
```

### 5. Data Source Detection

**Rule 5.1: Automatic Source Detection**
```
FUNCTION DETECT_SOURCE(filename):
  filename_lower = filename.toLowerCase()

  IF filename_lower.includes("zwift") THEN
    RETURN "ZWIFT"
  ELSE IF filename_lower.includes("tp-") OR filename_lower.includes("trainingpeaks") THEN
    RETURN "TRAININGPEAKS"
  ELSE IF filename_lower.includes("garmin") THEN
    RETURN "GARMIN"
  ELSE
    RETURN "MANUAL"
  END IF
```

### 6. Activity Type Mapping

**Rule 6.1: Sport and SubSport Mapping**
```
IF sport.includes("cycling") OR sport.includes("bike") THEN
  IF subSport.includes("indoor") OR subSport.includes("virtual") OR subSport.includes("trainer") THEN
    RETURN "INDOOR_CYCLING"
  ELSE
    RETURN "OUTDOOR_CYCLING"
  END IF
ELSE IF sport.includes("running") THEN
  RETURN "CROSS_RUNNING"
ELSE
  RETURN "OUTDOOR_CYCLING" // Default fallback
END IF
```

---

## User Journeys

### Journey 1: Athlete Imports Completed Zwift Ride

**Actor**: Emma (athlete with scheduled workout on Wednesday)

**Preconditions**:
- Emma completed "Sweet Spot Intervals" on Zwift yesterday (Wednesday)
- Coach Sarah has scheduled "Sweet Spot Intervals" for Emma's Wednesday
- Scheduled workout is marked incomplete

**Steps**:
1. Emma logs into RidePro
2. Emma navigates to Activities page
3. Emma clicks "Upload Activity" button
4. Upload modal appears with drag-drop zone
5. Emma selects `zwift-activity-2025-11-27.fit` file from Downloads folder
6. File appears in upload queue with filename and size (87 KB)
7. Emma clicks "Upload" button
8. System:
   - Shows progress indicator
   - Uploads file to `POST /api/activity-import/upload`
   - Backend:
     - Decompresses .gz file
     - Parses FIT file using Garmin SDK
     - Detects file type: "completed_activity"
     - Extracts 4,363 telemetry records
     - Calculates summary: 88min, 45.6km, 183W avg, 129 bpm avg
     - Auto-pairs with Wednesday's scheduled workout
     - Marks workout as completed
     - Saves to database
   - Returns: `{ activity: {...}, paired: true, pairedWorkoutName: "Sweet Spot Intervals" }`
9. Emma sees success message:
   - "Activity imported successfully!"
   - "Paired with: Sweet Spot Intervals"
10. Emma's calendar updates:
    - Wednesday shows workout completed ✅
    - Actual stats: 88min, 183W avg, TSS 87
11. Emma clicks "View Activity" link
12. Activity details page shows:
    - Header: "Sweet Spot Intervals - 27 Nov 2025"
    - Summary: Duration, Distance, Power, HR, Cadence
    - Power chart (time vs watts) with zones
    - HR chart (time vs bpm)
    - 18 laps table with segment stats

**Success Criteria**:
- Activity imported with full telemetry
- Auto-paired with correct scheduled workout
- Workout marked complete with actual stats
- Calendar reflects completion
- Activity viewable with charts

**Edge Cases**:
- No scheduled workout that day → Activity imported but not paired
- Multiple workouts that day → Pairs with best match (indoor/outdoor)
- Already completed workout → Still imports activity, doesn't unpair existing

---

### Journey 2: Athlete Batch Imports Week of Activities

**Actor**: John (athlete returning from training camp)

**Preconditions**:
- John completed 7 rides during training camp (offline)
- John has 7 FIT files from Garmin device
- Coach has scheduled workouts for that week

**Steps**:
1. John navigates to Activities page
2. John clicks "Upload Activity" → "Batch Upload"
3. Batch upload modal appears
4. John drags 7 FIT files into drop zone at once
5. System shows list of files with validation:
   ```
   ✓ garmin-ride-day1.fit (345 KB)
   ✓ garmin-ride-day2.fit (412 KB)
   ✓ garmin-ride-day3.fit (389 KB)
   ✓ garmin-ride-day4.fit (401 KB)
   ✓ garmin-ride-day5.fit (356 KB)
   ✓ garmin-ride-day6.fit (423 KB)
   ✓ garmin-ride-day7.fit (398 KB)

   Total: 7 files (2.7 MB)
   ```
6. John checks "Auto-pair with scheduled workouts" (default: ON)
7. John clicks "Upload All"
8. System shows progress:
   ```
   Processing: garmin-ride-day1.fit... ✓ Paired with Monday workout
   Processing: garmin-ride-day2.fit... ✓ Paired with Tuesday workout
   Processing: garmin-ride-day3.fit... ✓ No scheduled workout
   Processing: garmin-ride-day4.fit... ✓ Paired with Thursday workout
   Processing: garmin-ride-day5.fit... ✓ Paired with Friday workout
   Processing: garmin-ride-day6.fit... ✓ No scheduled workout
   Processing: garmin-ride-day7.fit... ✓ Paired with Sunday workout

   Success: 7 of 7 activities imported
   Paired: 5 activities
   ```
9. John sees summary:
   - "7 activities imported successfully"
   - "5 workouts completed"
   - Link to view activities
10. John's calendar shows completed workouts for Mon, Tue, Thu, Fri, Sun
11. Activities list shows all 7 rides with GPS routes

**Success Criteria**:
- All 7 files processed
- 5 auto-paired with scheduled workouts
- 2 stored as standalone activities
- Calendar updates correctly
- No duplicate activities created

---

### Journey 3: Coach Imports TrainingPeaks Workout Library

**Actor**: Sarah (coach migrating from TrainingPeaks)

**Preconditions**:
- Sarah has 25 planned workouts exported from TrainingPeaks as FIT files
- Sarah wants to add them to her RidePro workout library

**Steps**:
1. Sarah logs into RidePro (coach account)
2. Sarah navigates to Workout Library
3. Sarah clicks "Import Workout" button
4. Import modal appears with tabs: "From File" | "From URL" | "Create New"
5. "From File" tab selected (default)
6. Sarah clicks "Or upload TrainingPeaks FIT files (batch)"
7. Batch import modal appears
8. Sarah selects all 25 FIT files from her TrainingPeaks exports folder
9. System validates:
   ```
   ✓ tp-sweet-spot-intervals.fit (12 KB)
   ✓ tp-threshold-repeats.fit (9 KB)
   ✓ tp-endurance-ride.fit (8 KB)
   ... (22 more files)

   Total: 25 files (287 KB)
   ```
10. Sarah sees category dropdown: "Import to category"
    - Options: Base Training, Build, Peak, Recovery, + Create New
    - Sarah selects "+ Create New"
11. Modal appears: "Create Category"
    - Name: "TrainingPeaks Library"
    - Sarah clicks "Create"
12. System auto-fills category: "TrainingPeaks Library"
13. Sarah clicks "Import All Workouts"
14. System processes each file:
    ```
    Processing: tp-sweet-spot-intervals.fit
      ✓ Parsed: 5 steps, 90 min, TSS 75
      ✓ Saved as "Indoor - spin agility2 6x"

    Processing: tp-threshold-repeats.fit
      ✓ Parsed: 7 steps, 60 min, TSS 68
      ✓ Saved as "Threshold Repeats 4x8"

    ... (23 more)

    Success: 25 of 25 workouts imported
    ```
15. Sarah sees confirmation:
    - "25 workouts imported to TrainingPeaks Library"
    - Link: "View Library"
16. Sarah clicks "View Library"
17. Workout library shows new category "TrainingPeaks Library" with 25 workouts
18. Sarah clicks on "Indoor - spin agility2 6x"
19. Workout details show:
    - Name, Description (from FIT metadata)
    - Duration: 90 min
    - TSS: 75, IF: 0.85
    - Structure preview with intervals:
      ```
      1. Warm Up - 5 min @ 97-125W (40-50% FTP)
      2. Easy - 5 min @ 125-152W (50-60% FTP)
      3. Intervals - 6x (20s @ 360-554W, recovery)
      4. Cool Down - Open duration @ 97-125W
      ```
20. Sarah can now assign these workouts to athletes

**Success Criteria**:
- All 25 FIT files imported
- Workouts converted to RidePro format
- Intervals preserved correctly
- Power targets converted (% FTP)
- Category created and populated
- Workouts assignable to athletes

**Edge Cases**:
- Duplicate workout names → Append timestamp
- Invalid FIT file in batch → Skip and continue with others
- Missing power targets → Import with no targets (allow manual editing)

---

### Journey 4: Coach Customizes Imported Workout Before Saving

**Actor**: Sarah (coach)

**Preconditions**:
- Sarah is importing a TrainingPeaks FIT workout
- Workout name is generic: "Indoor - spin agility2 6x"

**Steps**:
1. Sarah uploads `tp-planned-workout.fit`
2. After parsing, system shows preview modal:
   ```
   Workout Preview
   ────────────────────────────────────────
   Name: Indoor - spin agility2 6x
   Duration: 90 minutes
   TSS: 75 | IF: 0.85

   Steps:
   1. Warm Up - 5 min @ 97-125W
   2. Easy - 5 min @ 125-152W
   3. Intervals - 6x (20s @ 360-554W + recovery)
   4. Cool Down - Open @ 97-125W

   [Edit] [Import] [Cancel]
   ```
3. Sarah clicks "Edit"
4. Edit modal allows changes:
   - Name: "Neuromuscular Sprint Intervals 6x20s"
   - Description: "High power sprint work for neuromuscular development"
   - Category: (dropdown) → Sarah selects "Build"
5. Sarah clicks "Save Changes"
6. System updates preview
7. Sarah clicks "Import"
8. Workout saved with custom name and description
9. Sarah sees it in "Build" category as "Neuromuscular Sprint Intervals 6x20s"

**Success Criteria**:
- Preview shown before import
- Name and description editable
- Category selectable
- Changes reflected in saved workout

---

### Journey 5: Athlete Uploads Non-FIT File (Error Handling)

**Actor**: Emma (athlete)

**Preconditions**:
- Emma has a GPX file from Strava export

**Steps**:
1. Emma navigates to Activities
2. Emma clicks "Upload Activity"
3. Emma selects `strava-ride.gpx` file
4. System validates file extension
5. System shows error:
   ```
   ❌ Unsupported File Format

   The file "strava-ride.gpx" is not supported.

   Supported formats:
   • .fit (Garmin/Zwift/TrainingPeaks)
   • .fit.gz (Compressed FIT files)

   Please export your activity as a FIT file from Strava.
   ```
6. Upload blocked, file not sent to server
7. Emma sees help link: "How to export FIT files from Strava"

**Success Criteria**:
- Invalid file rejected client-side
- Clear error message
- Helpful guidance provided
- No API call made

---

### Journey 6: Athlete Views Imported Activity with Full Telemetry

**Actor**: John (athlete)

**Preconditions**:
- John has imported a Zwift activity with full power/HR data

**Steps**:
1. John navigates to Activities list
2. John sees list of recent activities:
   ```
   🚴 Sweet Spot Intervals - 27 Nov 2025
      88 min | 45.6 km | 183W avg | 129 bpm
      [View Details]

   🚴 Endurance Ride - 25 Nov 2025
      120 min | 62.3 km | 165W avg | 135 bpm
      [View Details]
   ```
3. John clicks "View Details" on Sweet Spot Intervals
4. Activity detail page loads
5. John sees header:
   ```
   Sweet Spot Intervals
   Wednesday, 27 November 2025 at 17:24

   Source: Zwift | Indoor Cycling

   [Download FIT] [Delete] [Edit Notes]
   ```
6. John sees summary stats panel:
   ```
   Duration      88 min (72 min moving)
   Distance      45.6 km
   Elevation     +71m / -0m

   Power         183W avg | 289W max
   NP            195W (calculated)
   TSS           87 | IF 0.78

   Heart Rate    129 bpm avg | 168 bpm max
   Cadence       80 rpm avg | 107 rpm max
   Speed         31.3 km/h avg | 47.8 km/h max
   Calories      765 kcal
   ```
7. John scrolls to see charts section:
   - **Power Chart**: Time (x-axis) vs Watts (y-axis)
     - Line shows actual power
     - Background shaded by zones (Z1-Z6 colors)
     - Avg power line: 183W (dashed)
     - NP line: 195W (dashed, different color)

   - **Heart Rate Chart**: Time vs BPM
     - Line shows HR
     - HR zones shaded (Z1-Z5)
     - Avg HR line: 129 bpm

   - **Power Zones Distribution**: Pie chart
     - Z1 (Recovery): 5% (4 min)
     - Z2 (Endurance): 45% (32 min)
     - Z3 (Tempo): 35% (25 min)
     - Z4 (Threshold): 12% (9 min)
     - Z5 (VO2Max): 3% (2 min)

8. John scrolls to Laps table:
   ```
   Lap  | Duration | Distance | Avg Power | Avg HR
   -----+----------+----------+-----------+--------
   1    | 3:45     | 2.8 km   | 195W      | 140 bpm
   2    | 3:52     | 2.7 km   | 188W      | 145 bpm
   ... (16 more laps)
   ```

9. John hovers over power chart at 42-minute mark
10. Tooltip appears:
    ```
    Time: 18:06:47
    Power: 245W (Z4 - Threshold)
    HR: 158 bpm
    Cadence: 92 rpm
    Speed: 38.2 km/h
    ```

**Success Criteria**:
- Full activity details displayed
- All summary stats accurate
- Charts render correctly
- Power zones calculated from FTP
- HR zones calculated from maxHR
- Lap data table shown
- Interactive chart tooltips work

---

### Journey 7: Coach Reviews Athlete's Imported Activities

**Actor**: Sarah (coach reviewing Emma's week)

**Preconditions**:
- Emma has imported 5 activities this week
- 4 were auto-paired with scheduled workouts
- Sarah wants to review compliance

**Steps**:
1. Sarah navigates to Emma's calendar page
2. Sarah sees week view (Mon-Sun)
3. Each day shows:
   - Scheduled workout (planned)
   - Imported activity (actual) if completed
4. Wednesday shows:
   ```
   WEDNESDAY

   📋 Scheduled: Sweet Spot Intervals
      Planned: 90 min | TSS 75 | IF 0.85

   ✅ Completed: Sweet Spot Intervals (Zwift)
      Actual: 88 min | TSS 87 | IF 0.78
      [View Activity]

   Compliance: 98% (duration) | 116% (TSS)
   ```
5. Sarah clicks "View Activity"
6. Sarah sees Emma's actual workout:
   - Power chart shows Emma hit targets
   - Some intervals slightly under (90-95% of target)
   - Overall good compliance
7. Sarah adds coach note:
   ```
   Great effort Emma! Your power was consistent.
   Next time, try to hit 100% of target power in the main intervals.
   ```
8. Sarah saves note
9. Emma sees coach note on her activity page

**Success Criteria**:
- Coach can see scheduled vs actual
- Compliance % calculated
- Coach can view full activity details
- Coach can add notes
- Athlete sees coach feedback

---

## E2E Test Scenarios

### Test Suite 1: Activity Upload (Single File)

#### Test 1.1: Upload Zwift Activity Successfully
```typescript
describe('Activity Import - Single File Upload', () => {
  let athlete: User;
  let coach: User;
  let trainingWeek: TrainingWeek;
  let scheduledWorkout: ScheduledWorkout;

  beforeEach(async () => {
    // Setup test database
    athlete = await createTestUser({ role: 'athlete' });
    coach = await createTestUser({ role: 'coach' });

    // Create coach-athlete relationship
    await createRelationship(coach.id, athlete.id, 'ACTIVE');

    // Create training week
    trainingWeek = await createTrainingWeek({
      athleteId: athlete.id,
      coachId: coach.id,
      weekStart: '2025-11-24', // Monday
    });

    // Schedule workout for Wednesday
    scheduledWorkout = await createScheduledWorkout({
      trainingWeekId: trainingWeek.id,
      workoutId: 'sweet-spot-intervals-id',
      dayIndex: 2, // Wednesday
      completed: false,
    });
  });

  it('should upload Zwift activity and auto-pair with scheduled workout', async () => {
    // Load FIT file
    const fitBuffer = await fs.readFile(
      'test/fixtures/zwift-activity-wednesday.fit.gz',
    );

    // Upload via API
    const response = await request(app.getHttpServer())
      .post('/api/activity-import/upload')
      .field('athleteId', athlete.id)
      .field('autoPairWithScheduled', 'true')
      .attach('file', fitBuffer, 'zwift-activity.fit.gz')
      .expect(201);

    // Verify response
    expect(response.body).toMatchObject({
      activity: {
        name: expect.stringContaining('Activity'),
        activityType: 'INDOOR_CYCLING',
        source: 'ZWIFT',
        durationSeconds: expect.any(Number),
        avgPower: expect.any(Number),
        avgHeartRate: expect.any(Number),
        scheduledWorkoutId: scheduledWorkout.id,
      },
      paired: true,
      pairedWorkoutName: 'Sweet Spot Intervals',
    });

    // Verify activity saved to database
    const savedActivity = await prisma.activity.findUnique({
      where: { id: response.body.activity.id },
      include: { scheduledWorkout: true },
    });

    expect(savedActivity).toBeDefined();
    expect(savedActivity.telemetryData).toBeDefined();
    expect(savedActivity.telemetryData.records).toBeInstanceOf(Array);
    expect(savedActivity.telemetryData.records.length).toBeGreaterThan(0);

    // Verify scheduled workout marked complete
    const updatedWorkout = await prisma.scheduledWorkout.findUnique({
      where: { id: scheduledWorkout.id },
    });

    expect(updatedWorkout.completed).toBe(true);
    expect(updatedWorkout.completedAt).toBeDefined();
    expect(updatedWorkout.actualDurationSeconds).toBe(savedActivity.durationSeconds);
    expect(updatedWorkout.avgPower).toBe(savedActivity.avgPower);
  });

  it('should import activity without pairing if no scheduled workout', async () => {
    // Delete scheduled workout
    await prisma.scheduledWorkout.delete({
      where: { id: scheduledWorkout.id },
    });

    const fitBuffer = await fs.readFile(
      'test/fixtures/zwift-activity-wednesday.fit.gz',
    );

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/upload')
      .field('athleteId', athlete.id)
      .field('autoPairWithScheduled', 'true')
      .attach('file', fitBuffer, 'zwift-activity.fit.gz')
      .expect(201);

    expect(response.body).toMatchObject({
      activity: {
        activityType: 'INDOOR_CYCLING',
        scheduledWorkoutId: null,
      },
      paired: false,
      pairedWorkoutName: undefined,
    });
  });

  it('should reject planned workout FIT file on activity endpoint', async () => {
    const plannedWorkoutBuffer = await fs.readFile(
      'test/fixtures/tp-planned-workout.fit.gz',
    );

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/upload')
      .field('athleteId', athlete.id)
      .attach('file', plannedWorkoutBuffer, 'tp-workout.fit.gz')
      .expect(400);

    expect(response.body.message).toContain('planned workout');
    expect(response.body.message).toContain('Use the workout import endpoint');
  });

  it('should reject oversized file', async () => {
    // Create 51MB buffer
    const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024);

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/upload')
      .field('athleteId', athlete.id)
      .attach('file', oversizedBuffer, 'huge-activity.fit')
      .expect(400);

    expect(response.body.message).toContain('File size');
    expect(response.body.message).toContain('50MB');
  });
});
```

### Test Suite 2: Batch Activity Upload

#### Test 2.1: Upload Multiple Activities in Batch
```typescript
describe('Activity Import - Batch Upload', () => {
  let athlete: User;
  let trainingWeek: TrainingWeek;

  beforeEach(async () => {
    athlete = await createTestUser({ role: 'athlete' });
    trainingWeek = await createTrainingWeek({
      athleteId: athlete.id,
      weekStart: '2025-11-24',
    });

    // Schedule workouts for Mon, Wed, Fri
    await createScheduledWorkout({
      trainingWeekId: trainingWeek.id,
      workoutId: 'workout-1',
      dayIndex: 0, // Monday
    });
    await createScheduledWorkout({
      trainingWeekId: trainingWeek.id,
      workoutId: 'workout-2',
      dayIndex: 2, // Wednesday
    });
    await createScheduledWorkout({
      trainingWeekId: trainingWeek.id,
      workoutId: 'workout-3',
      dayIndex: 4, // Friday
    });
  });

  it('should batch import 5 activities and pair 3 of them', async () => {
    const files = [
      { path: 'test/fixtures/activity-monday.fit.gz', name: 'monday.fit.gz' },
      { path: 'test/fixtures/activity-tuesday.fit.gz', name: 'tuesday.fit.gz' },
      { path: 'test/fixtures/activity-wednesday.fit.gz', name: 'wednesday.fit.gz' },
      { path: 'test/fixtures/activity-thursday.fit.gz', name: 'thursday.fit.gz' },
      { path: 'test/fixtures/activity-friday.fit.gz', name: 'friday.fit.gz' },
    ];

    const request = app.getHttpServer()
      .post('/api/activity-import/upload-batch')
      .field('athleteId', athlete.id)
      .field('autoPairWithScheduled', 'true');

    for (const file of files) {
      const buffer = await fs.readFile(file.path);
      request.attach('files', buffer, file.name);
    }

    const response = await request.expect(201);

    expect(response.body).toHaveLength(5);

    const paired = response.body.filter(r => r.paired === true);
    expect(paired).toHaveLength(3); // Mon, Wed, Fri

    const unpaired = response.body.filter(r => r.paired === false);
    expect(unpaired).toHaveLength(2); // Tue, Thu

    // Verify all activities saved
    const activities = await prisma.activity.findMany({
      where: { athleteId: athlete.id },
    });
    expect(activities).toHaveLength(5);

    // Verify 3 workouts marked complete
    const completedWorkouts = await prisma.scheduledWorkout.findMany({
      where: {
        trainingWeekId: trainingWeek.id,
        completed: true,
      },
    });
    expect(completedWorkouts).toHaveLength(3);
  });

  it('should continue batch import even if one file fails', async () => {
    const files = [
      { buffer: await fs.readFile('test/fixtures/valid-activity.fit.gz'), name: 'valid.fit.gz' },
      { buffer: Buffer.from('invalid content'), name: 'corrupted.fit.gz' },
      { buffer: await fs.readFile('test/fixtures/another-valid.fit.gz'), name: 'valid2.fit.gz' },
    ];

    const request = app.getHttpServer()
      .post('/api/activity-import/upload-batch')
      .field('athleteId', athlete.id);

    for (const file of files) {
      request.attach('files', file.buffer, file.name);
    }

    const response = await request.expect(201);

    // Should successfully import 2 of 3 files
    expect(response.body).toHaveLength(2);
    expect(response.body.every(r => r.activity)).toBe(true);
  });
});
```

### Test Suite 3: Workout Import

#### Test 3.1: Import TrainingPeaks Planned Workout
```typescript
describe('Workout Import - TrainingPeaks FIT', () => {
  let coach: User;
  let category: WorkoutCategory;

  beforeEach(async () => {
    coach = await createTestUser({ role: 'coach' });
    category = await createWorkoutCategory({
      name: 'Build',
      slug: 'build',
      coachId: coach.id,
    });
  });

  it('should import planned workout from TrainingPeaks FIT file', async () => {
    const fitBuffer = await fs.readFile(
      'test/fixtures/tp-planned-sweet-spot.fit.gz',
    );

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/workout/upload')
      .field('coachId', coach.id)
      .field('categoryId', category.id)
      .attach('file', fitBuffer, 'tp-workout.fit.gz')
      .expect(201);

    expect(response.body).toMatchObject({
      workout: {
        name: expect.any(String),
        slug: expect.any(String),
        durationSeconds: expect.any(Number),
        tssPlanned: expect.any(Number),
        ifPlanned: expect.any(Number),
        structure: {
          structure: expect.arrayContaining([
            expect.objectContaining({
              type: 'step',
              steps: expect.any(Array),
            }),
          ]),
        },
        categoryId: category.id,
        coachId: coach.id,
        environment: 'INDOOR',
      },
      source: 'TrainingPeaks',
      originalName: expect.any(String),
    });

    // Verify workout saved
    const savedWorkout = await prisma.workout.findUnique({
      where: { id: response.body.workout.id },
    });

    expect(savedWorkout).toBeDefined();
    expect(savedWorkout.structure).toBeDefined();
    expect(savedWorkout.structure.structure).toBeInstanceOf(Array);
  });

  it('should auto-create "Imported Workouts" category if none specified', async () => {
    const fitBuffer = await fs.readFile(
      'test/fixtures/tp-planned-workout.fit.gz',
    );

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/workout/upload')
      .field('coachId', coach.id)
      // No categoryId specified
      .attach('file', fitBuffer, 'tp-workout.fit.gz')
      .expect(201);

    expect(response.body.workout.categoryId).toBeDefined();

    // Verify category created
    const importedCategory = await prisma.workoutCategory.findUnique({
      where: { id: response.body.workout.categoryId },
    });

    expect(importedCategory.name).toBe('Imported Workouts');
    expect(importedCategory.coachId).toBe(coach.id);
  });

  it('should reject completed activity FIT file on workout endpoint', async () => {
    const activityBuffer = await fs.readFile(
      'test/fixtures/zwift-completed-activity.fit.gz',
    );

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/workout/upload')
      .field('coachId', coach.id)
      .attach('file', activityBuffer, 'activity.fit.gz')
      .expect(400);

    expect(response.body.message).toContain('completed activity');
    expect(response.body.message).toContain('Use the activity import endpoint');
  });
});
```

### Test Suite 4: FIT Parser Logic

#### Test 4.1: Parse Different FIT File Types
```typescript
describe('FIT Parser Service', () => {
  let fitParser: FitParserService;

  beforeEach(() => {
    fitParser = new FitParserService();
  });

  it('should correctly identify planned workout FIT file', async () => {
    const buffer = await fs.readFile(
      'test/fixtures/tp-planned-workout.fit.gz',
    );

    const result = await fitParser.parse(buffer, 'tp-workout.fit.gz');

    expect(result.fileType).toBe('planned_workout');
    expect(result.plannedWorkout).toBeDefined();
    expect(result.plannedWorkout.steps).toBeInstanceOf(Array);
    expect(result.plannedWorkout.steps.length).toBeGreaterThan(0);
  });

  it('should correctly identify completed activity FIT file', async () => {
    const buffer = await fs.readFile(
      'test/fixtures/zwift-activity.fit.gz',
    );

    const result = await fitParser.parse(buffer, 'zwift.fit.gz');

    expect(result.fileType).toBe('completed_activity');
    expect(result.completedActivity).toBeDefined();
    expect(result.completedActivity.records).toBeInstanceOf(Array);
    expect(result.completedActivity.records.length).toBeGreaterThan(0);
  });

  it('should decompress gzipped FIT files', async () => {
    const gzippedBuffer = await fs.readFile(
      'test/fixtures/activity.fit.gz',
    );

    // Should not throw
    const result = await fitParser.parse(gzippedBuffer, 'activity.fit.gz');

    expect(result.fileType).toBe('completed_activity');
  });

  it('should convert GPS semicircles to decimal degrees', async () => {
    const buffer = await fs.readFile(
      'test/fixtures/outdoor-ride-with-gps.fit.gz',
    );

    const result = await fitParser.parse(buffer, 'outdoor.fit.gz');

    expect(result.completedActivity.hasGPS).toBe(true);
    expect(result.completedActivity.startLatitude).toBeDefined();
    expect(result.completedActivity.startLongitude).toBeDefined();

    // Verify reasonable coordinates (should be valid lat/long)
    expect(result.completedActivity.startLatitude).toBeGreaterThanOrEqual(-90);
    expect(result.completedActivity.startLatitude).toBeLessThanOrEqual(90);
    expect(result.completedActivity.startLongitude).toBeGreaterThanOrEqual(-180);
    expect(result.completedActivity.startLongitude).toBeLessThanOrEqual(180);
  });

  it('should calculate summary stats from session message', async () => {
    const buffer = await fs.readFile(
      'test/fixtures/zwift-activity.fit.gz',
    );

    const result = await fitParser.parse(buffer, 'zwift.fit.gz');

    expect(result.completedActivity.durationSeconds).toBeGreaterThan(0);
    expect(result.completedActivity.distanceMeters).toBeGreaterThan(0);
    expect(result.completedActivity.avgPower).toBeGreaterThan(0);
    expect(result.completedActivity.maxPower).toBeGreaterThan(0);
    expect(result.completedActivity.avgHeartRate).toBeGreaterThan(0);
    expect(result.completedActivity.maxHeartRate).toBeGreaterThan(0);
  });

  it('should parse lap/segment data', async () => {
    const buffer = await fs.readFile(
      'test/fixtures/zwift-activity-with-laps.fit.gz',
    );

    const result = await fitParser.parse(buffer, 'zwift.fit.gz');

    expect(result.completedActivity.laps).toBeInstanceOf(Array);
    expect(result.completedActivity.laps.length).toBeGreaterThan(0);

    const firstLap = result.completedActivity.laps[0];
    expect(firstLap.startTime).toBeDefined();
    expect(firstLap.durationSeconds).toBeGreaterThan(0);
  });
});
```

### Test Suite 5: Auto-Pairing Logic

#### Test 5.1: Workout Pairing Algorithm
```typescript
describe('Activity Auto-Pairing Logic', () => {
  let athlete: User;
  let trainingWeek: TrainingWeek;

  beforeEach(async () => {
    athlete = await createTestUser({ role: 'athlete' });
    trainingWeek = await createTrainingWeek({
      athleteId: athlete.id,
      weekStart: '2025-11-24', // Monday
    });
  });

  it('should pair activity with workout on same day', async () => {
    // Schedule workout for Wednesday
    const workout = await createScheduledWorkout({
      trainingWeekId: trainingWeek.id,
      workoutId: 'workout-1',
      dayIndex: 2, // Wednesday
      completed: false,
    });

    // Upload activity completed on Wednesday
    const fitBuffer = createMockFitBuffer({
      startTime: '2025-11-26T17:00:00Z', // Wednesday
      activityType: 'INDOOR_CYCLING',
    });

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/upload')
      .field('athleteId', athlete.id)
      .attach('file', fitBuffer, 'wednesday.fit')
      .expect(201);

    expect(response.body.paired).toBe(true);
    expect(response.body.activity.scheduledWorkoutId).toBe(workout.id);
  });

  it('should prefer type-matching workout when multiple scheduled same day', async () => {
    // Schedule 2 workouts on Wednesday: indoor and outdoor
    const indoorWorkout = await createScheduledWorkout({
      trainingWeekId: trainingWeek.id,
      workoutId: 'indoor-workout',
      dayIndex: 2,
      workout: { workoutType: 'indoorCycling' },
    });

    const outdoorWorkout = await createScheduledWorkout({
      trainingWeekId: trainingWeek.id,
      workoutId: 'outdoor-workout',
      dayIndex: 2,
      workout: { workoutType: 'outdoorCycling' },
    });

    // Upload Zwift activity (indoor)
    const fitBuffer = createMockFitBuffer({
      startTime: '2025-11-26T17:00:00Z', // Wednesday
      activityType: 'INDOOR_CYCLING',
    });

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/upload')
      .field('athleteId', athlete.id)
      .attach('file', fitBuffer, 'zwift.fit')
      .expect(201);

    expect(response.body.paired).toBe(true);
    expect(response.body.activity.scheduledWorkoutId).toBe(indoorWorkout.id);
    // Should NOT pair with outdoor workout
  });

  it('should not pair if workout already completed', async () => {
    // Workout already marked complete
    const workout = await createScheduledWorkout({
      trainingWeekId: trainingWeek.id,
      workoutId: 'workout-1',
      dayIndex: 2,
      completed: true,
    });

    const fitBuffer = createMockFitBuffer({
      startTime: '2025-11-26T17:00:00Z',
    });

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/upload')
      .field('athleteId', athlete.id)
      .attach('file', fitBuffer, 'activity.fit')
      .expect(201);

    expect(response.body.paired).toBe(false);
  });

  it('should not pair if autoPairWithScheduled is false', async () => {
    const workout = await createScheduledWorkout({
      trainingWeekId: trainingWeek.id,
      workoutId: 'workout-1',
      dayIndex: 2,
    });

    const fitBuffer = createMockFitBuffer({
      startTime: '2025-11-26T17:00:00Z',
    });

    const response = await request(app.getHttpServer())
      .post('/api/activity-import/upload')
      .field('athleteId', athlete.id)
      .field('autoPairWithScheduled', 'false') // Pairing disabled
      .attach('file', fitBuffer, 'activity.fit')
      .expect(201);

    expect(response.body.paired).toBe(false);
    expect(response.body.activity.scheduledWorkoutId).toBeNull();
  });
});
```

---

## API Specification

### Activity Import Endpoints

#### POST /api/activity-import/upload

Import single completed activity from FIT file.

**Request:**
```
Content-Type: multipart/form-data

file: <FIT file binary> (.fit or .fit.gz)
athleteId: string (UUID)
autoPairWithScheduled: boolean (optional, default: true)
```

**Response (201 Created):**
```json
{
  "activity": {
    "id": "uuid",
    "athleteId": "uuid",
    "name": "cycling Activity",
    "activityType": "INDOOR_CYCLING",
    "source": "ZWIFT",
    "fileFormat": "FIT",
    "startTime": "2025-11-27T17:24:47.000Z",
    "endTime": "2025-11-27T18:52:39.000Z",
    "durationSeconds": 5272,
    "movingTime": 4363,
    "distanceMeters": 45643.87,
    "elevationGain": 71,
    "elevationLoss": 0,
    "avgPower": 183,
    "maxPower": 289,
    "normalizedPower": null,
    "avgHeartRate": 129,
    "maxHeartRate": 168,
    "avgCadence": 80,
    "maxCadence": 107,
    "avgSpeed": 10.461,
    "maxSpeed": 13.29,
    "tss": null,
    "intensityFactor": null,
    "calories": 765,
    "hasGPS": true,
    "startLatitude": -11.637063,
    "startLongitude": 166.971684,
    "temperature": null,
    "telemetryData": {
      "records": [...]
    },
    "laps": {
      "laps": [...]
    },
    "originalFilename": "zwift-activity.fit.gz",
    "fileSize": 87014,
    "scheduledWorkoutId": "uuid",
    "createdAt": "2025-11-28T15:00:00.000Z"
  },
  "paired": true,
  "pairedWorkoutName": "Sweet Spot Intervals"
}
```

**Errors:**
- 400: Invalid FIT file, file too large (>50MB), planned workout instead of activity
- 404: Athlete not found

---

#### POST /api/activity-import/upload-batch

Import multiple completed activities in batch.

**Request:**
```
Content-Type: multipart/form-data

files: <FIT file binary>[] (up to 50 files)
athleteId: string (UUID)
autoPairWithScheduled: boolean (optional, default: true)
```

**Response (201 Created):**
```json
[
  {
    "activity": {...},
    "paired": true,
    "pairedWorkoutName": "Monday Workout"
  },
  {
    "activity": {...},
    "paired": false
  },
  ...
]
```

---

#### GET /api/activity-import/athlete/:athleteId

Get all activities for an athlete with pagination and filtering.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `limit` (optional): number (default: 50)
- `offset` (optional): number (default: 0)

**Response (200 OK):**
```json
{
  "activities": [
    {
      "id": "uuid",
      "name": "...",
      "startTime": "...",
      "durationSeconds": 5272,
      "avgPower": 183,
      "scheduledWorkout": {
        "id": "uuid",
        "workout": {
          "name": "Sweet Spot Intervals"
        }
      }
    },
    ...
  ],
  "total": 42
}
```

---

#### GET /api/activity-import/:activityId

Get single activity with full telemetry data.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "...",
  "activityType": "INDOOR_CYCLING",
  "startTime": "...",
  "telemetryData": {
    "records": [
      {
        "timestamp": "2025-11-27T17:24:47.000Z",
        "lat": -11.637063,
        "lng": 166.971684,
        "altitude": 12.8,
        "power": 61,
        "hr": 51,
        "cadence": 36,
        "speed": 0.968,
        "distance": 0.73
      },
      ...
    ]
  },
  "laps": {...},
  "athlete": {
    "id": "uuid",
    "fullName": "John Doe",
    "ftp": 250,
    "maxHR": 185
  },
  "scheduledWorkout": {
    "id": "uuid",
    "workout": {
      "name": "Sweet Spot Intervals"
    }
  }
}
```

---

#### DELETE /api/activity-import/:activityId

Delete activity.

**Response (200 OK):**
```json
{
  "deleted": true
}
```

---

### Workout Import Endpoints

#### POST /api/activity-import/workout/upload

Import planned workout from TrainingPeaks FIT file.

**Request:**
```
Content-Type: multipart/form-data

file: <FIT file binary>
coachId: string (UUID)
categoryId: string (UUID, optional)
overrideName: string (optional)
overrideDescription: string (optional)
```

**Response (201 Created):**
```json
{
  "workout": {
    "id": "uuid",
    "name": "Indoor - spin agility2 6x",
    "slug": "indoor-spin-agility2-6x",
    "description": "Imported from TrainingPeaks",
    "durationSeconds": 5400,
    "durationCategory": "MEDIUM",
    "tssPlanned": 75,
    "ifPlanned": 0.85,
    "structure": {
      "structure": [...]
    },
    "categoryId": "uuid",
    "coachId": "uuid",
    "workoutType": "indoorCycling",
    "environment": "INDOOR",
    "intensity": "HARD"
  },
  "source": "TrainingPeaks",
  "originalName": "Indoor - spin agility2 6x"
}
```

---

#### POST /api/activity-import/workout/upload-batch

Import multiple planned workouts in batch.

**Request:**
```
Content-Type: multipart/form-data

files: <FIT file binary>[] (up to 50 files)
coachId: string (UUID)
categoryId: string (UUID, optional)
```

**Response (201 Created):**
```json
[
  {
    "workout": {...},
    "source": "TrainingPeaks",
    "originalName": "..."
  },
  ...
]
```

---

## Database Schema

### Activity Model

```prisma
model Activity {
  id              String    @id @default(uuid())

  // Athlete who completed the activity
  athleteId       String    @map("athlete_id")
  athlete         User      @relation("AthleteActivities", fields: [athleteId], references: [id], onDelete: Cascade)

  // Optional pairing with scheduled workout
  scheduledWorkoutId String?           @map("scheduled_workout_id")
  scheduledWorkout   ScheduledWorkout? @relation(fields: [scheduledWorkoutId], references: [id], onDelete: SetNull)

  // Activity metadata
  name            String              // Activity name
  activityType    ActivityType        @map("activity_type")
  source          ActivitySource      // Where it came from
  fileFormat      ActivityFileFormat  @map("file_format")

  // Timing
  startTime       DateTime            @map("start_time")
  endTime         DateTime?           @map("end_time")
  durationSeconds Int                 @map("duration_seconds")
  movingTime      Int?                @map("moving_time")

  // Distance & Elevation
  distanceMeters  Float?              @map("distance_meters")
  elevationGain   Float?              @map("elevation_gain")
  elevationLoss   Float?              @map("elevation_loss")

  // Power metrics
  avgPower        Int?                @map("avg_power")
  maxPower        Int?                @map("max_power")
  normalizedPower Int?                @map("normalized_power")

  // Heart rate metrics
  avgHeartRate    Int?                @map("avg_heart_rate")
  maxHeartRate    Int?                @map("max_heart_rate")

  // Cadence
  avgCadence      Int?                @map("avg_cadence")
  maxCadence      Int?                @map("max_cadence")

  // Speed
  avgSpeed        Float?              @map("avg_speed")
  maxSpeed        Float?              @map("max_speed")

  // Training metrics
  tss             Float?
  intensityFactor Float?              @map("intensity_factor")
  calories        Int?

  // GPS data
  hasGPS          Boolean             @default(false) @map("has_gps")
  startLatitude   Float?              @map("start_latitude")
  startLongitude  Float?              @map("start_longitude")

  // Weather
  temperature     Float?

  // Raw telemetry data (JSONB)
  telemetryData   Json?               @map("telemetry_data") @db.JsonB

  // Lap/segment data (JSONB)
  laps            Json?               @db.JsonB

  // Original file
  originalFilename String?            @map("original_filename")
  fileSize         Int?               @map("file_size")

  // Notes
  notes            String?

  // Timestamps
  createdAt        DateTime           @default(now()) @map("created_at")
  updatedAt        DateTime           @updatedAt @map("updated_at")

  @@index([athleteId, startTime])
  @@index([scheduledWorkoutId])
  @@map("activities")
}

enum ActivitySource {
  ZWIFT
  TRAININGPEAKS
  GARMIN
  WAHOO
  STRAVA
  MANUAL
}

enum ActivityFileFormat {
  FIT
  TCX
  GPX
  MANUAL
}
```

---

## Technical Implementation

### FIT Parser Service

**Location**: `src/activity-import/fit-parser.service.ts`

**Dependencies**:
- `@garmin/fitsdk` - Official Garmin FIT SDK
- `zlib` - Gzip decompression

**Key Methods**:
```typescript
parse(buffer: Buffer, filename?: string): Promise<ParsedFitFile>
  → Auto-detects file type and routes to appropriate parser

parsePlannedWorkout(messages: any): ParsedPlannedWorkout
  → Extracts workout steps from TrainingPeaks FIT

parseCompletedActivity(messages: any, filename?: string): ParsedCompletedActivity
  → Extracts telemetry records from completed ride

semicirclesToDegrees(semicircles: number): number
  → Converts GPS coordinates from FIT format
```

---

### Activity Import Service

**Location**: `src/activity-import/activity-import.service.ts`

**Key Methods**:
```typescript
importActivity(dto: ImportActivityDto): Promise<ImportedActivity>
  → Import single activity with auto-pairing

importBatch(athleteId, files, autoPair): Promise<ImportedActivity[]>
  → Batch import multiple activities

autoPairWithScheduledWorkout(athleteId, activity): Promise<{paired, workoutName}>
  → Smart pairing algorithm

saveActivity(athleteId, data, filename, fileSize): Promise<Activity>
  → Convert parsed data to database format
```

---

### Workout Import Service

**Location**: `src/activity-import/workout-import.service.ts`

**Key Methods**:
```typescript
importPlannedWorkout(dto: ImportWorkoutDto): Promise<ImportedWorkout>
  → Import TrainingPeaks workout as template

convertToRideProStructure(steps: WorkoutStep[]): any[]
  → Convert TrainingPeaks steps to RidePro format

estimateTSS(steps, duration): number
  → Calculate TSS from power targets

estimateIF(steps): number
  → Calculate Intensity Factor
```

---

## Future Enhancements

1. **Additional File Formats**
   - TCX file support (Garmin Training Center XML)
   - GPX file support (GPS Exchange Format)
   - Strava API integration

2. **Advanced Analytics**
   - Power curve analysis (5s, 1min, 5min, 20min power)
   - FTP estimation from max efforts
   - Chronic Training Load (CTL), Acute Training Load (ATL)
   - Form (TSB - Training Stress Balance)

3. **Activity Visualization**
   - Interactive power/HR charts
   - GPS route maps (Leaflet/Mapbox)
   - Elevation profiles
   - Power zones distribution charts
   - Lap comparison tables

4. **Coach Review Tools**
   - Compliance dashboard
   - Target vs actual comparison
   - Flagging poor compliance
   - Automated coach notes

5. **Athlete Mobile App**
   - Upload activities from phone
   - Quick post-workout notes
   - Photo attachments
   - Voice notes for feedback

---

**Document Version**: 1.0
**Last Updated**: 28 December 2025
**Author**: Claude Code + Aaron (RidePro CEO)
