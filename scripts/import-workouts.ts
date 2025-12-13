/**
 * Import workouts from JSON files to database
 *
 * Run with: npx ts-node scripts/import-workouts.ts
 */

import 'dotenv/config';
import { PrismaClient, DurationCategory, Intensity, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

// Path to workout JSON files
const WORKOUTS_DIR = path.join(__dirname, '../../ridepro-fe/src/data/workouts');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJson = any;

interface WorkoutJson {
  id: string;
  name: string;
  workout: {
    id: number;
    type: string;
    attributes: {
      totalTimePlanned: number; // hours
      tssPlanned: number;
      ifPlanned: number;
      workoutTypeName: string;
      description: string;
      title: string;
      structure: AnyJson;
    };
  };
}

interface CategoryJson {
  id: string;
  name: string;
  description: string;
  workouts: WorkoutJson[];
}

function getDurationCategory(hours: number): DurationCategory {
  if (hours < 1) return 'SHORT';
  if (hours <= 2) return 'MEDIUM';
  return 'LONG';
}

function getIntensity(ifPlanned: number): Intensity {
  if (ifPlanned < 0.65) return 'EASY';
  if (ifPlanned < 0.80) return 'MODERATE';
  if (ifPlanned < 0.95) return 'HARD';
  return 'VERY_HARD';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function importWorkouts() {
  console.log('Starting workout import...\n');

  // Read all JSON files from workouts directory
  const files = fs.readdirSync(WORKOUTS_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');

  let totalWorkouts = 0;
  let totalCategories = 0;

  for (const file of files) {
    const filePath = path.join(WORKOUTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    let categoryData: CategoryJson;
    try {
      categoryData = JSON.parse(content);
    } catch (e) {
      console.error(`Failed to parse ${file}:`, e);
      continue;
    }

    // Skip if no workouts
    if (!categoryData.workouts || categoryData.workouts.length === 0) {
      console.log(`Skipping ${file} - no workouts`);
      continue;
    }

    // Create or update category
    const category = await prisma.workoutCategory.upsert({
      where: { slug: categoryData.id },
      update: {
        name: categoryData.name,
        description: categoryData.description,
      },
      create: {
        slug: categoryData.id,
        name: categoryData.name,
        description: categoryData.description,
        sortOrder: totalCategories,
      },
    });

    console.log(`Category: ${category.name} (${categoryData.workouts.length} workouts)`);
    totalCategories++;

    // Import workouts
    for (const w of categoryData.workouts) {
      const attrs = w.workout.attributes;
      const durationSeconds = Math.round((attrs.totalTimePlanned || 0) * 3600);
      const slug = w.id || slugify(w.name);

      try {
        const workoutData = {
          name: w.name,
          title: attrs.title || w.name,
          description: attrs.description || null,
          durationSeconds,
          durationCategory: getDurationCategory(attrs.totalTimePlanned || 0),
          tssPlanned: attrs.tssPlanned || null,
          ifPlanned: attrs.ifPlanned || null,
          workoutType: attrs.workoutTypeName || 'Bike',
          environment: 'ANY' as const,
          intensity: attrs.ifPlanned ? getIntensity(attrs.ifPlanned) : null,
          structure: attrs.structure as Prisma.InputJsonValue || {},
          rawJson: w.workout as Prisma.InputJsonValue,
          categoryId: category.id,
          isPublic: true,
        };

        await prisma.workout.upsert({
          where: { slug },
          update: workoutData,
          create: { slug, ...workoutData },
        });
        totalWorkouts++;
      } catch (e) {
        console.error(`  Failed to import workout "${w.name}":`, e);
      }
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Categories: ${totalCategories}`);
  console.log(`   Workouts: ${totalWorkouts}`);
}

// Run the import
importWorkouts()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
