/**
 * RidePro API Bootstrap
 *
 * This is the main entry point for the RidePro Training Platform API.
 * It initializes the NestJS application with:
 * - Swagger/OpenAPI documentation at /api/docs
 * - CORS enabled for cross-origin requests
 * - Validation pipes for request payload validation
 *
 * @module main
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Bootstrap function to initialize and start the NestJS application
 *
 * Sets up:
 * - Global validation pipe with whitelist and transform options
 * - Swagger documentation at /api/docs endpoint
 * - CORS for frontend communication
 *
 * @returns Promise<void>
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('RidePro Training Platform API')
    .setDescription(
      `
## Overview
The RidePro API provides endpoints for managing cycling training plans, workouts, and coach-athlete relationships.

## Features
- **User Management**: Create and manage user profiles
- **Coach-Athlete Relationships**: Flexible many-to-many relationships allowing users to be both coaches and athletes
- **Invite Codes**: Easy onboarding system for coaches to invite athletes
- **Workout Library**: Browse and manage structured workout templates
- **Training Calendar**: Schedule workouts and manage training weeks
- **Goals & Availability**: Track athlete goals and training availability

## Authentication
The API uses Clerk for authentication. Include the Clerk session token in the Authorization header.
    `,
    )
    .setVersion('1.0')
    .addTag('users', 'User profile management')
    .addTag('relationships', 'Coach-athlete relationship management')
    .addTag('invite-codes', 'Coach invitation codes for athlete onboarding')
    .addTag('workouts', 'Workout library and templates')
    .addTag('calendar', 'Training calendar and scheduling')
    .addTag('availability', 'Athlete training availability')
    .addTag('goals', 'Athlete training goals')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
