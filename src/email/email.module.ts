/**
 * EmailModule - Email service module
 *
 * Provides email sending capabilities across the application.
 *
 * @module email
 */
import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';

@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
