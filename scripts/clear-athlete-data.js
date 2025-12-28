const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearAthleteData() {
  try {
    const result = await prisma.user.update({
      where: { id: '32eef6db-e717-4bd5-a948-37aa40a06fb8' },
      data: {
        ftp: null,
        maxHR: null,
      },
    });

    console.log('✓ Athlete FTP and Max HR cleared successfully');
    console.log(`  User: ${result.fullName}`);
    console.log(`  FTP: ${result.ftp}`);
    console.log(`  Max HR: ${result.maxHR}`);
  } catch (error) {
    console.error('Error clearing athlete data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearAthleteData();
