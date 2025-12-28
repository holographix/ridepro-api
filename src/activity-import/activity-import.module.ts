import { Module } from '@nestjs/common';
import { ActivityImportService } from './activity-import.service';
import { WorkoutImportService } from './workout-import.service';
import { ActivityImportController } from './activity-import.controller';
import { FitParserService } from './fit-parser.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ActivityImportService, WorkoutImportService, FitParserService],
  controllers: [ActivityImportController],
  exports: [ActivityImportService, WorkoutImportService, FitParserService],
})
export class ActivityImportModule {}
