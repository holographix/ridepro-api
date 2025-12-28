import { Module } from '@nestjs/common';
import { WorkoutParsersController } from './workout-parsers.controller';
import { WorkoutParsersService } from './workout-parsers.service';

@Module({
  controllers: [WorkoutParsersController],
  providers: [WorkoutParsersService],
  exports: [WorkoutParsersService],
})
export class WorkoutParsersModule {}
