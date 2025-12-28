/**
 * Test script for FIT file import
 * Run with: npx ts-node test-fit-import.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { FitParserService } from './src/activity-import/fit-parser.service';

async function testFitImport() {
  const parser = new FitParserService();

  console.log('\n🧪 Testing FIT File Import\n');
  console.log('=' .repeat(80));

  // Test 1: Planned Workout (TrainingPeaks)
  console.log('\n📋 TEST 1: Planned Workout from TrainingPeaks');
  console.log('-'.repeat(80));

  try {
    const plannedWorkoutPath = join(
      __dirname,
      'docs/sample_data/tp-3941009.2025-11-12-12-20-03-865Z.GarminPing.AAAAAGkUe3N1aA36.FIT.gz',
    );

    const plannedBuffer = readFileSync(plannedWorkoutPath);
    const plannedResult = await parser.parse(plannedBuffer, 'tp-planned-workout.fit.gz');

    console.log(`✅ File Type: ${plannedResult.fileType}`);

    if (plannedResult.fileType === 'planned_workout' && plannedResult.plannedWorkout) {
      const workout = plannedResult.plannedWorkout;
      console.log(`✅ Workout Name: ${workout.name}`);
      console.log(`✅ Sport: ${workout.sportType}`);
      console.log(`✅ Steps: ${workout.steps.length}`);
      console.log(`✅ Duration: ${Math.round(workout.estimatedDuration / 60)} minutes`);
      console.log(`✅ Estimated TSS: ${workout.estimatedTSS || 'N/A'}`);

      console.log('\n📝 Workout Steps:');
      workout.steps.forEach((step, i) => {
        const duration =
          step.durationType === 'time'
            ? `${Math.round(step.durationValue! / 60)}min`
            : step.durationType;
        const target =
          step.targetType === 'power'
            ? `${Math.round(step.targetMin! * 100)}-${Math.round(step.targetMax! * 100)}% FTP`
            : step.targetType;
        console.log(`  ${i + 1}. ${step.name} (${step.type}) - ${duration} @ ${target}`);
      });
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }

  // Test 2: Completed Activity (Zwift)
  console.log('\n\n🚴 TEST 2: Completed Activity from Zwift');
  console.log('-'.repeat(80));

  try {
    const activityPath = join(
      __dirname,
      'docs/sample_data/zwift-activity-2016248599700062240.fit.gz',
    );

    const activityBuffer = readFileSync(activityPath);
    const activityResult = await parser.parse(activityBuffer, 'zwift-activity.fit.gz');

    console.log(`✅ File Type: ${activityResult.fileType}`);

    if (activityResult.fileType === 'completed_activity' && activityResult.completedActivity) {
      const activity = activityResult.completedActivity;
      console.log(`✅ Activity Name: ${activity.name}`);
      console.log(`✅ Activity Type: ${activity.activityType}`);
      console.log(`✅ Source: ${activity.source}`);
      console.log(`✅ Start Time: ${activity.startTime.toLocaleString()}`);
      console.log(`✅ Duration: ${Math.round(activity.durationSeconds / 60)} minutes`);
      console.log(`✅ Distance: ${(activity.distanceMeters! / 1000).toFixed(2)} km`);

      console.log('\n📊 Summary Stats:');
      console.log(`  Average Power: ${activity.avgPower || 'N/A'} watts`);
      console.log(`  Max Power: ${activity.maxPower || 'N/A'} watts`);
      console.log(`  Normalized Power: ${activity.normalizedPower || 'N/A'} watts`);
      console.log(`  Average HR: ${activity.avgHeartRate || 'N/A'} bpm`);
      console.log(`  Max HR: ${activity.maxHeartRate || 'N/A'} bpm`);
      console.log(`  Average Cadence: ${activity.avgCadence || 'N/A'} rpm`);
      console.log(`  TSS: ${activity.tss || 'N/A'}`);
      console.log(`  IF: ${activity.intensityFactor || 'N/A'}`);
      console.log(`  Calories: ${activity.calories || 'N/A'}`);

      console.log(`\n🗺️  GPS: ${activity.hasGPS ? 'Yes' : 'No'}`);
      if (activity.hasGPS && activity.startLatitude) {
        console.log(
          `  Start Location: ${activity.startLatitude.toFixed(6)}, ${activity.startLongitude!.toFixed(6)}`,
        );
      }

      console.log(`\n📈 Telemetry Records: ${activity.records.length} data points`);
      console.log(`   Laps/Segments: ${activity.laps.length}`);

      // Show first 3 records
      console.log('\n🔬 Sample Telemetry (first 3 records):');
      activity.records.slice(0, 3).forEach((record, i) => {
        console.log(`  ${i + 1}. ${record.timestamp.toLocaleTimeString()}`);
        console.log(`     Power: ${record.power || 'N/A'}W, HR: ${record.heartRate || 'N/A'}bpm, Cadence: ${record.cadence || 'N/A'}rpm`);
        console.log(
          `     Speed: ${record.speed ? (record.speed * 3.6).toFixed(1) : 'N/A'}km/h, Altitude: ${record.altitude?.toFixed(1) || 'N/A'}m`,
        );
      });
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }

  // Test 3: Outdoor Activity (TrainingPeaks/Garmin)
  console.log('\n\n🌍 TEST 3: Completed Outdoor Activity from TrainingPeaks');
  console.log('-'.repeat(80));

  try {
    const outdoorPath = join(
      __dirname,
      'docs/sample_data/tp-5307876.2025-11-27-16-47-48-601Z.GarminPing.AAAAAGkogLT3KuGq.FIT.gz',
    );

    const outdoorBuffer = readFileSync(outdoorPath);
    const outdoorResult = await parser.parse(outdoorBuffer, 'tp-outdoor-ride.fit.gz');

    console.log(`✅ File Type: ${outdoorResult.fileType}`);

    if (outdoorResult.fileType === 'completed_activity' && outdoorResult.completedActivity) {
      const activity = outdoorResult.completedActivity;
      console.log(`✅ Activity Name: ${activity.name}`);
      console.log(`✅ Activity Type: ${activity.activityType}`);
      console.log(`✅ Source: ${activity.source}`);
      console.log(`✅ Duration: ${Math.round(activity.durationSeconds / 60)} minutes`);
      console.log(`✅ Distance: ${(activity.distanceMeters! / 1000).toFixed(2)} km`);

      console.log('\n📊 Outdoor Ride Stats:');
      console.log(`  Average HR: ${activity.avgHeartRate || 'N/A'} bpm`);
      console.log(`  Max HR: ${activity.maxHeartRate || 'N/A'} bpm`);
      console.log(`  Elevation Gain: ${activity.elevationGain?.toFixed(0) || 'N/A'} m`);
      console.log(`  Elevation Loss: ${activity.elevationLoss?.toFixed(0) || 'N/A'} m`);
      console.log(`  Temperature: ${activity.temperature || 'N/A'} °C`);

      console.log(`\n🗺️  GPS Data Available: ${activity.hasGPS ? 'Yes' : 'No'}`);
      if (activity.hasGPS && activity.startLatitude) {
        console.log(
          `  Start Location: ${activity.startLatitude.toFixed(6)}, ${activity.startLongitude!.toFixed(6)}`,
        );
      }

      console.log(`\n📈 Telemetry Records: ${activity.records.length} GPS points`);
      console.log(`   Note: Outdoor rides typically don't have power data (no power meter)`);
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All tests completed!\n');
}

testFitImport().catch(console.error);
