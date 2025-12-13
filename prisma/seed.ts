/**
 * Seed script for RidePro database
 *
 * Creates test users and relationships for development:
 * - 1 Coach: Marco Rossi (has 3 athletes)
 * - 3 Athletes: Laura Bianchi, Giuseppe Verdi, Sofia Romano
 *
 * Run with: npx ts-node prisma/seed.ts
 */
import 'dotenv/config';
import { PrismaClient, RelationshipStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Seeding database...');

  // Clear existing data (in correct order due to foreign keys)
  await prisma.scheduledWorkout.deleteMany();
  await prisma.trainingWeek.deleteMany();
  await prisma.coachInviteCode.deleteMany();
  await prisma.coachAthleteRelationship.deleteMany();
  await prisma.athleteAvailability.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.workoutCategory.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data');

  // Create Coach
  const coach = await prisma.user.create({
    data: {
      email: 'marco.rossi@ridepro.test',
      fullName: 'Marco Rossi',
      ftp: 320, // Coach is also a cyclist
    },
  });
  console.log(`Created coach: ${coach.fullName}`);

  // Create Athletes
  const athletes = await Promise.all([
    prisma.user.create({
      data: {
        email: 'laura.bianchi@ridepro.test',
        fullName: 'Laura Bianchi',
        ftp: 245,
      },
    }),
    prisma.user.create({
      data: {
        email: 'giuseppe.verdi@ridepro.test',
        fullName: 'Giuseppe Verdi',
        ftp: 280,
      },
    }),
    prisma.user.create({
      data: {
        email: 'sofia.romano@ridepro.test',
        fullName: 'Sofia Romano',
        ftp: 210,
      },
    }),
  ]);

  console.log(`Created ${athletes.length} athletes`);

  // Create Coach-Athlete Relationships
  const relationships = await Promise.all(
    athletes.map((athlete) =>
      prisma.coachAthleteRelationship.create({
        data: {
          coachId: coach.id,
          athleteId: athlete.id,
          status: RelationshipStatus.ACTIVE,
          startedAt: new Date(),
        },
      })
    )
  );

  console.log(`Created ${relationships.length} coach-athlete relationships`);

  // Create availability for each athlete
  const daysOfWeek = [0, 1, 2, 3, 4, 5, 6]; // Mon-Sun

  for (const athlete of athletes) {
    await Promise.all(
      daysOfWeek.map((dayIndex) =>
        prisma.athleteAvailability.create({
          data: {
            athleteId: athlete.id,
            dayIndex,
            available: dayIndex !== 0 && dayIndex !== 4, // Available except Monday and Friday
            timeSlots: dayIndex === 5 || dayIndex === 6 ? ['MORNING', 'AFTERNOON'] : ['MORNING'],
            maxHours: dayIndex === 5 || dayIndex === 6 ? 3 : 1.5,
          },
        })
      )
    );
  }

  console.log('Created athlete availability');

  // Create workout categories
  const categories = await Promise.all([
    prisma.workoutCategory.create({
      data: {
        slug: 'endurance',
        name: 'Endurance',
        description: 'Base building and aerobic endurance workouts',
        sortOrder: 1,
      },
    }),
    prisma.workoutCategory.create({
      data: {
        slug: 'threshold',
        name: 'Threshold',
        description: 'FTP and lactate threshold workouts',
        sortOrder: 2,
      },
    }),
    prisma.workoutCategory.create({
      data: {
        slug: 'vo2max',
        name: 'VO2max',
        description: 'High-intensity intervals for aerobic capacity',
        sortOrder: 3,
      },
    }),
    prisma.workoutCategory.create({
      data: {
        slug: 'recovery',
        name: 'Recovery',
        description: 'Active recovery and easy spinning',
        sortOrder: 4,
      },
    }),
    prisma.workoutCategory.create({
      data: {
        slug: 'sprint',
        name: 'Sprint',
        description: 'Neuromuscular power and sprint training',
        sortOrder: 5,
      },
    }),
  ]);

  const [endurance, threshold, vo2max, recovery, sprint] = categories;

  // Create workouts
  const workouts = await Promise.all([
    // Endurance workouts
    prisma.workout.create({
      data: {
        slug: 'sweet-spot-30min',
        name: 'Sweet Spot 30min',
        title: 'Sweet Spot Training',
        description: '30 minute sweet spot session for building FTP',
        durationSeconds: 1800,
        durationCategory: 'SHORT',
        tssPlanned: 45,
        ifPlanned: 0.88,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'MODERATE',
        categoryId: endurance.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 10, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 65 }] }] },
            { type: 'step', steps: [{ name: 'Sweet Spot', intensityClass: 'active', length: { value: 15, unit: 'minute' }, targets: [{ minValue: 88, maxValue: 93 }] }] },
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 5, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),
    prisma.workout.create({
      data: {
        slug: 'endurance-60min',
        name: 'Endurance Ride 60min',
        title: 'Zone 2 Endurance',
        description: 'Steady state aerobic ride in Zone 2',
        durationSeconds: 3600,
        durationCategory: 'MEDIUM',
        tssPlanned: 50,
        ifPlanned: 0.70,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'EASY',
        categoryId: endurance.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 10, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 60 }] }] },
            { type: 'step', steps: [{ name: 'Endurance', intensityClass: 'active', length: { value: 45, unit: 'minute' }, targets: [{ minValue: 65, maxValue: 75 }] }] },
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 5, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),
    prisma.workout.create({
      data: {
        slug: 'tempo-45min',
        name: 'Tempo 45min',
        title: 'Tempo Intervals',
        description: 'Tempo effort with recovery intervals',
        durationSeconds: 2700,
        durationCategory: 'SHORT',
        tssPlanned: 55,
        ifPlanned: 0.82,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'MODERATE',
        categoryId: endurance.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 10, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 65 }] }] },
            { type: 'reps', reps: 3, steps: [
              { name: 'Tempo', intensityClass: 'active', length: { value: 8, unit: 'minute' }, targets: [{ minValue: 76, maxValue: 87 }] },
              { name: 'Recovery', intensityClass: 'recovery', length: { value: 3, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 60 }] },
            ]},
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 5, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),

    // Threshold workouts
    prisma.workout.create({
      data: {
        slug: 'ftp-intervals-60min',
        name: 'FTP Intervals 60min',
        title: '2x20 FTP',
        description: 'Classic 2x20 minute threshold intervals',
        durationSeconds: 3600,
        durationCategory: 'MEDIUM',
        tssPlanned: 75,
        ifPlanned: 0.90,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'HARD',
        categoryId: threshold.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 10, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 65 }] }] },
            { type: 'reps', reps: 2, steps: [
              { name: 'FTP Interval', intensityClass: 'active', length: { value: 20, unit: 'minute' }, targets: [{ minValue: 95, maxValue: 100 }] },
              { name: 'Recovery', intensityClass: 'recovery', length: { value: 5, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 60 }] },
            ]},
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 10, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),
    prisma.workout.create({
      data: {
        slug: 'threshold-over-unders',
        name: 'Over-Unders 45min',
        title: 'Threshold Over-Unders',
        description: 'Threshold intervals with surges above FTP',
        durationSeconds: 2700,
        durationCategory: 'SHORT',
        tssPlanned: 65,
        ifPlanned: 0.92,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'HARD',
        categoryId: threshold.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 10, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 65 }] }] },
            { type: 'reps', reps: 3, steps: [
              { name: 'Under', intensityClass: 'active', length: { value: 3, unit: 'minute' }, targets: [{ minValue: 90, maxValue: 95 }] },
              { name: 'Over', intensityClass: 'active', length: { value: 1, unit: 'minute' }, targets: [{ minValue: 105, maxValue: 110 }] },
              { name: 'Under', intensityClass: 'active', length: { value: 3, unit: 'minute' }, targets: [{ minValue: 90, maxValue: 95 }] },
              { name: 'Recovery', intensityClass: 'recovery', length: { value: 3, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 60 }] },
            ]},
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 5, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),

    // VO2max workouts
    prisma.workout.create({
      data: {
        slug: 'vo2max-intervals-45min',
        name: 'VO2max 5x3min',
        title: 'VO2max Intervals',
        description: '5x3 minute VO2max intervals at 110-120% FTP',
        durationSeconds: 2700,
        durationCategory: 'SHORT',
        tssPlanned: 70,
        ifPlanned: 0.95,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'VERY_HARD',
        categoryId: vo2max.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 15, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 70 }] }] },
            { type: 'reps', reps: 5, steps: [
              { name: 'VO2max', intensityClass: 'active', length: { value: 3, unit: 'minute' }, targets: [{ minValue: 110, maxValue: 120 }] },
              { name: 'Recovery', intensityClass: 'recovery', length: { value: 3, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] },
            ]},
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 10, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),
    prisma.workout.create({
      data: {
        slug: 'vo2max-short-intervals',
        name: 'VO2max 30/30s',
        title: '30/30 Micro Intervals',
        description: '30 seconds on, 30 seconds off micro intervals',
        durationSeconds: 2400,
        durationCategory: 'SHORT',
        tssPlanned: 60,
        ifPlanned: 0.90,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'VERY_HARD',
        categoryId: vo2max.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 15, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 70 }] }] },
            { type: 'reps', reps: 20, steps: [
              { name: 'ON', intensityClass: 'active', length: { value: 30, unit: 'second' }, targets: [{ minValue: 120, maxValue: 130 }] },
              { name: 'OFF', intensityClass: 'recovery', length: { value: 30, unit: 'second' }, targets: [{ minValue: 40, maxValue: 50 }] },
            ]},
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 5, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),

    // Recovery workouts
    prisma.workout.create({
      data: {
        slug: 'recovery-30min',
        name: 'Easy Spin 30min',
        title: 'Recovery Ride',
        description: 'Easy spinning for active recovery',
        durationSeconds: 1800,
        durationCategory: 'SHORT',
        tssPlanned: 20,
        ifPlanned: 0.55,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'EASY',
        categoryId: recovery.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Easy Spin', intensityClass: 'recovery', length: { value: 30, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),
    prisma.workout.create({
      data: {
        slug: 'recovery-45min',
        name: 'Active Recovery 45min',
        title: 'Active Recovery',
        description: 'Light spinning with leg openers',
        durationSeconds: 2700,
        durationCategory: 'SHORT',
        tssPlanned: 30,
        ifPlanned: 0.58,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'EASY',
        categoryId: recovery.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Easy Spin', intensityClass: 'recovery', length: { value: 15, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
            { type: 'reps', reps: 3, steps: [
              { name: 'Opener', intensityClass: 'active', length: { value: 30, unit: 'second' }, targets: [{ minValue: 90, maxValue: 100 }] },
              { name: 'Spin', intensityClass: 'recovery', length: { value: 5, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] },
            ]},
            { type: 'step', steps: [{ name: 'Easy Spin', intensityClass: 'recovery', length: { value: 13, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),

    // Sprint workouts
    prisma.workout.create({
      data: {
        slug: 'sprint-intervals',
        name: 'Sprint Power 45min',
        title: 'Neuromuscular Sprints',
        description: 'Short maximal sprints for peak power',
        durationSeconds: 2700,
        durationCategory: 'SHORT',
        tssPlanned: 55,
        ifPlanned: 0.85,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'VERY_HARD',
        categoryId: sprint.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 20, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 70 }] }] },
            { type: 'reps', reps: 6, steps: [
              { name: 'Sprint', intensityClass: 'active', length: { value: 15, unit: 'second' }, targets: [{ minValue: 150, maxValue: 200 }] },
              { name: 'Recovery', intensityClass: 'recovery', length: { value: 3, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] },
            ]},
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 7, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),
    prisma.workout.create({
      data: {
        slug: 'standing-starts',
        name: 'Standing Starts 40min',
        title: 'Explosive Power',
        description: 'Standing start sprints for acceleration',
        durationSeconds: 2400,
        durationCategory: 'SHORT',
        tssPlanned: 50,
        ifPlanned: 0.82,
        workoutType: 'Bike',
        environment: 'ANY',
        intensity: 'VERY_HARD',
        categoryId: sprint.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 15, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 70 }] }] },
            { type: 'reps', reps: 8, steps: [
              { name: 'Standing Start', intensityClass: 'active', length: { value: 10, unit: 'second' }, targets: [{ minValue: 180, maxValue: 250 }] },
              { name: 'Recovery', intensityClass: 'recovery', length: { value: 2, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] },
            ]},
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 8, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),

    // Long endurance workout
    prisma.workout.create({
      data: {
        slug: 'long-ride-90min',
        name: 'Long Endurance 90min',
        title: 'Weekend Long Ride',
        description: 'Extended aerobic ride with varied intensity',
        durationSeconds: 5400,
        durationCategory: 'LONG',
        tssPlanned: 85,
        ifPlanned: 0.72,
        workoutType: 'Bike',
        environment: 'OUTDOOR',
        intensity: 'MODERATE',
        categoryId: endurance.id,
        structure: {
          structure: [
            { type: 'step', steps: [{ name: 'Warm Up', intensityClass: 'warmUp', length: { value: 15, unit: 'minute' }, targets: [{ minValue: 50, maxValue: 60 }] }] },
            { type: 'step', steps: [{ name: 'Steady State', intensityClass: 'active', length: { value: 30, unit: 'minute' }, targets: [{ minValue: 65, maxValue: 75 }] }] },
            { type: 'reps', reps: 3, steps: [
              { name: 'Tempo Surge', intensityClass: 'active', length: { value: 5, unit: 'minute' }, targets: [{ minValue: 80, maxValue: 85 }] },
              { name: 'Recover', intensityClass: 'active', length: { value: 5, unit: 'minute' }, targets: [{ minValue: 65, maxValue: 70 }] },
            ]},
            { type: 'step', steps: [{ name: 'Cruise', intensityClass: 'active', length: { value: 15, unit: 'minute' }, targets: [{ minValue: 65, maxValue: 75 }] }] },
            { type: 'step', steps: [{ name: 'Cool Down', intensityClass: 'coolDown', length: { value: 10, unit: 'minute' }, targets: [{ minValue: 40, maxValue: 55 }] }] },
          ],
        },
      },
    }),
  ]);

  console.log(`Created ${workouts.length} workouts across ${categories.length} categories`);

  // Create invite code for coach
  await prisma.coachInviteCode.create({
    data: {
      coachId: coach.id,
      code: 'COACH-MARCO-2024',
      maxUses: 10,
      isActive: true,
    },
  });

  console.log('Created coach invite code');

  console.log('\n✅ Seeding complete!');
  console.log('\nTest Users:');
  console.log(`  Coach: ${coach.fullName} (${coach.email})`);
  athletes.forEach((a) => console.log(`  Athlete: ${a.fullName} (${a.email})`));
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
