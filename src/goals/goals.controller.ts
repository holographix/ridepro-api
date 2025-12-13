import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { GoalsService } from './goals.service';
import { GoalPriority } from '@prisma/client';

@Public()
@Controller('api/goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get('athlete/:athleteId')
  getAthleteGoals(@Param('athleteId') athleteId: string) {
    return this.goalsService.getAthleteGoals(athleteId);
  }

  @Get('athlete/:athleteId/upcoming')
  getUpcomingGoals(@Param('athleteId') athleteId: string) {
    return this.goalsService.getUpcomingGoals(athleteId);
  }

  @Get('athlete/:athleteId/priority/:priority')
  getGoalsByPriority(
    @Param('athleteId') athleteId: string,
    @Param('priority') priority: GoalPriority,
  ) {
    return this.goalsService.getGoalsByPriority(athleteId, priority);
  }

  @Get(':id')
  getGoal(@Param('id') id: string) {
    return this.goalsService.getGoal(id);
  }

  @Post()
  createGoal(
    @Body()
    data: {
      athleteId: string;
      name: string;
      eventDate?: string;
      priority?: GoalPriority;
      eventType?: string;
      targetDuration?: string;
      notes?: string;
    },
  ) {
    return this.goalsService.createGoal({
      ...data,
      eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
    });
  }

  @Put(':id')
  updateGoal(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      eventDate?: string | null;
      priority?: GoalPriority;
      eventType?: string;
      targetDuration?: string;
      notes?: string;
    },
  ) {
    return this.goalsService.updateGoal(id, {
      ...data,
      eventDate:
        data.eventDate === null
          ? null
          : data.eventDate
            ? new Date(data.eventDate)
            : undefined,
    });
  }

  @Delete(':id')
  deleteGoal(@Param('id') id: string) {
    return this.goalsService.deleteGoal(id);
  }
}
