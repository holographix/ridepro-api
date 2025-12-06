import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.usersService.findOne(user.id);
  }

  @Put('me')
  updateMe(@CurrentUser() user: User, @Body() data: Prisma.UserUpdateInput) {
    return this.usersService.update(user.id, data);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get('clerk/:clerkUserId')
  findByClerkId(@Param('clerkUserId') clerkUserId: string) {
    return this.usersService.findByClerkId(clerkUserId);
  }

  @Get(':id/athletes')
  getAthletes(@Param('id') coachId: string) {
    return this.usersService.getAthletes(coachId);
  }

  @Post()
  create(@Body() data: Prisma.UserCreateInput) {
    return this.usersService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Prisma.UserUpdateInput) {
    return this.usersService.update(id, data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Post(':athleteId/assign-coach/:coachId')
  assignCoach(
    @Param('athleteId') athleteId: string,
    @Param('coachId') coachId: string,
  ) {
    return this.usersService.assignCoach(athleteId, coachId);
  }

  @Delete(':athleteId/coach')
  removeCoach(@Param('athleteId') athleteId: string) {
    return this.usersService.removeCoach(athleteId);
  }
}
