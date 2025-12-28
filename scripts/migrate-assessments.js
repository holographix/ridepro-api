/**
 * Migration script for 2-day assessment protocol
 *
 * This script:
 * 1. Deletes all existing assessments
 * 2. Pushes new schema changes to database
 *
 * IMPORTANT: This will permanently delete all assessment data!
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting assessment migration...\n');

  // Count existing assessments
  const count = await prisma.assessment.count();
  console.log(`📊 Found ${count} existing assessments`);

  if (count === 0) {
    console.log('✅ No assessments to delete\n');
  } else {
    // Delete all assessments
    console.log('🗑️  Deleting all existing assessments...');
    const result = await prisma.assessment.deleteMany({});
    console.log(`✅ Deleted ${result.count} assessments\n`);
  }

  console.log('✅ Migration complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: DATABASE_URL="..." npx prisma db push');
  console.log('   2. The new 2-day assessment protocol is now ready to use');
  console.log('\n🔍 New assessment flow:');
  console.log('   Day 1: 1\'/2\'/5\' efforts on 6-7% gradient');
  console.log('   Day 2: 5" sprint + 12\' climb on 6-7% gradient');
  console.log('   Athletes have 15 days to complete Day 2 after Day 1\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
