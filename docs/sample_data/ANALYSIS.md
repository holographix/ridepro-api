# FIT Files Analysis - CEO Sample Data

## Summary

Analyzed 7 FIT files from the CEO (pro athlete). The files contain a mix of:
- **2 PLANNED WORKOUTS** (from TrainingPeaks)
- **5 COMPLETED ACTIVITIES** (2 from TrainingPeaks outdoors, 3 from Zwift indoors)

---

## File Breakdown

### PLANNED WORKOUTS (TrainingPeaks)

#### 1. tp-3941009.2025-11-12-12-20-03-865Z.GarminPing.AAAAAGkUe3N1aA36.FIT
- **Type**: Planned Workout (FIT format)
- **Source**: TrainingPeaks (synced to Garmin)
- **Name**: "Indoor - spin agility2 6x"
- **Sport**: Cycling (generic/indoor)
- **Created**: 2025-11-12 11:26:24
- **Structure**: 5 workout steps
  - Warm up: 5 min @ 97-125W
  - Easy: 5 min @ 125-152W
  - Intervals: 6 repeats of 20s @ 360-554W (very high power)
  - Recovery: Open duration @ 97-125W
- **Target Type**: Power (3-second average)
- **Use Case**: Can be imported as a planned workout template

#### 2. tp-3941009.2025-11-26-14-25-43-160Z.GarminPing.AAAAAGknDea7K58G.FIT
- **Type**: Planned Workout (FIT format)
- **Source**: TrainingPeaks (synced to Garmin)
- **Similar structure to file #1** (another planned workout)

---

### COMPLETED ACTIVITIES (Outdoor Rides - TrainingPeaks)

#### 3. tp-5307876.2025-11-27-16-47-48-601Z.GarminPing.AAAAAGkogLT3KuGq.FIT
- **Type**: Completed Activity
- **Source**: TrainingPeaks (uploaded from Garmin device)
- **Sport**: Road Cycling (outdoor)
- **Date**: 2025-11-27
- **Duration**: 4h 51min (291.9 min moving time, 481.4 min elapsed)
- **Distance**: 65.9 km
- **Stats**:
  - Calories: 3,160
  - Avg HR: 131 bpm
  - Max HR: 175 bpm
- **Data Points**: 17,582 GPS/power/HR records
- **Use Case**: Completed workout that can show actual performance data

#### 4. tp-5307876.2025-11-28-13-20-04-237Z.GarminPing.AAAAAGkpoYOk4uZ1.FIT
- **Type**: Completed Activity
- **Source**: TrainingPeaks (uploaded from Garmin device)
- **Sport**: Cycling (outdoor)
- **Date**: 2025-11-28
- **Data Points**: 14,179 GPS/power/HR records
- **Use Case**: Another completed outdoor ride

---

### COMPLETED ACTIVITIES (Indoor - Zwift)

#### 5. zwift-activity-2016248599700062240.fit
- **Type**: Completed Activity
- **Source**: Zwift (indoor virtual cycling)
- **Sport**: Cycling (virtual_activity)
- **Date**: 2025-11-27
- **Duration**: 1h 28min (72.7 min moving time)
- **Distance**: 45.6 km
- **Stats**:
  - Avg Power: 183W
  - Max Power: 289W
  - Avg HR: 129 bpm
  - Max HR: 168 bpm
  - Avg Cadence: 80 rpm
  - Calories: 765
- **Laps**: 18 (Zwift segments/intervals)
- **Data Points**: 4,363 records
- **Use Case**: Indoor trainer workout with full power/HR/cadence data

#### 6. zwift-activity-2029830452566573056.fit
- **Type**: Completed Activity
- **Source**: Zwift
- **Data Points**: 3,324 records
- **Use Case**: Another Zwift indoor session

#### 7. zwift-activity-2031281821194403872.fit
- **Type**: Completed Activity
- **Source**: Zwift
- **Data Points**: 3,926 records
- **Use Case**: Another Zwift indoor session

---

## Technical Findings

### FIT File Structure

All files are standard FIT (Flexible and Interoperable Data Transfer) format used by:
- Garmin devices
- TrainingPeaks platform
- Zwift virtual cycling platform

### Data Types Present

**Planned Workouts** contain:
- `workout` messages (metadata: name, sport, sub-sport)
- `workout_step` messages (intervals with duration, power targets, intensity zones)
- Power targets in watts (absolute values)
- Duration in seconds or "open" (until user stops)
- Intensity classifications: warmup, active, rest, coolDown
- Repetition logic (e.g., "repeat 6 times")

**Completed Activities** contain:
- `session` messages (summary stats)
- `record` messages (GPS, power, HR, cadence every 1-2 seconds)
- `lap` messages (splits/segments)
- Full telemetry data from sensors

### Power Data Analysis

From the planned workout example:
- Warm-up: 97-125W (~40-50% FTP if FTP is ~250W)
- Easy: 125-152W (~50-60% FTP)
- High-intensity intervals: 360-554W (140-220% FTP) - sprint/neuromuscular power
- Recovery: 97-125W

This suggests the athlete's FTP is approximately 250-270W based on the zone distributions.

---

## Import Recommendations

### For Your RidePro Platform

1. **Planned Workouts (Files #1-2)**
   - These can be imported as workout templates
   - Parse the `workout_step` messages to extract intervals
   - Convert power watts to % FTP for flexibility
   - Store structure in your existing workout format
   - Add to workout library with appropriate categories

2. **Completed Activities (Files #3-7)**
   - These are NOT workout templates - they are historical performance data
   - Could be used for:
     - Analyzing the athlete's actual training load (TSS calculation)
     - Comparing planned vs. actual performance
     - Training history/dashboard stats
     - Assessment/FTP estimation from outdoor rides
   - **NOT suitable for direct import as "workouts to assign"**

### Priority Implementation

**Phase 1: Planned Workout Import**
- Focus on files #1-2 (planned workouts from TrainingPeaks)
- Build FIT parser to extract workout_step messages
- Convert to your internal workout structure format
- This enables coaches to import workouts from TrainingPeaks

**Phase 2: Activity Analysis** (Future)
- Import completed activities for training load tracking
- Calculate actual TSS, IF, NP from power data
- Compare planned vs. completed workouts
- Build training history/analytics dashboard

---

## File Format Notes

- All files are gzipped (.gz compression)
- Original files are FIT binary format
- FIT is a compact binary format (Garmin ANT+ protocol)
- Can be parsed using `fitparse` library (Python)
- Alternatively, use Garmin FIT SDK (C/C++/Java) or `fit-file-parser` (JavaScript/TypeScript)

---

## Next Steps

1. **Decide on import scope**: Planned workouts only, or also activity analysis?

2. **Build FIT parser endpoint**:
   ```
   POST /api/workout-parsers/fit/upload
   - Accept .fit or .fit.gz files
   - Parse workout_step messages
   - Convert to RidePro workout structure
   - Return preview before saving
   ```

3. **Handle power zones**:
   - Option A: Assume power values are absolute watts, ask for athlete's FTP to convert to %
   - Option B: Store absolute watts and calculate % when assigning to athletes
   - Option C: Allow coaches to edit targets after import

4. **Test with sample files**:
   - Use files #1-2 to test planned workout import
   - Use files #5-7 to test completed activity parsing (if Phase 2)

5. **Document import flow**:
   - Update frontend to support .fit/.fit.gz file upload
   - Add to WorkoutUploadModal supported formats
   - Show preview with intervals/power targets
   - Allow editing before saving to library
