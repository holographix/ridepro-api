const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupCorruptWorkouts() {
  try {
    console.log('🔍 Searching for corrupt scheduled workouts...\n');

    // Find all scheduled workouts with invalid dayIndex
    const corruptWorkouts = await prisma.scheduledWorkout.findMany({
      where: {
        OR: [
          { dayIndex: { lt: 0 } },
          { dayIndex: { gt: 6 } },
        ],
      },
      include: {
        workout: {
          select: {
            name: true,
          },
        },
        trainingWeek: {
          select: {
            weekStart: true,
            athlete: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (corruptWorkouts.length === 0) {
      console.log('✓ No corrupt workouts found. Database is clean!');
      return;
    }

    console.log(`Found ${corruptWorkouts.length} corrupt workout(s):\n`);

    // Log details of each corrupt workout
    corruptWorkouts.forEach((sw, index) => {
      console.log(`${index + 1}. Workout: ${sw.workout.name}`);
      console.log(`   Athlete: ${sw.trainingWeek.athlete.fullName}`);
      console.log(`   Week Start: ${sw.trainingWeek.weekStart}`);
      console.log(`   Invalid dayIndex: ${sw.dayIndex}`);
      console.log(`   ID: ${sw.id}\n`);
    });

    // Delete the corrupt workouts
    console.log('🗑️  Deleting corrupt workouts...\n');

    const deleteResult = await prisma.scheduledWorkout.deleteMany({
      where: {
        OR: [
          { dayIndex: { lt: 0 } },
          { dayIndex: { gt: 6 } },
        ],
      },
    });

    console.log(`✓ Successfully deleted ${deleteResult.count} corrupt workout(s)`);
    console.log('✓ Database cleanup complete!');
  } catch (error) {
    console.error('❌ Error cleaning up corrupt workouts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupCorruptWorkouts();
