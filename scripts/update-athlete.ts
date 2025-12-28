import { PrismaClient } from '@prisma/client';
import '../prisma.config';

const prisma = new PrismaClient();

async function main() {
  const athleteId = '32eef6db-e717-4bd5-a948-37aa40a06fb8';

  // Update athlete data
  const updated = await prisma.user.update({
    where: { id: athleteId },
    data: {
      heightCm: 180,
      weightKg: 80,
      maxHR: 180,
      hasPowerMeter: true,
    },
  });

  console.log('Updated athlete:');
  console.log('================');
  console.log('Name:', updated.fullName);
  console.log('Height:', updated.heightCm, 'cm');
  console.log('Weight:', updated.weightKg, 'kg');
  console.log('Max HR:', updated.maxHR, 'bpm');
  console.log('FTP:', updated.ftp, 'W');
  console.log('Power Meter:', updated.hasPowerMeter ? 'Yes' : 'No');
  console.log('================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
