import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClerkService } from './clerk.service';
import { ClerkGuard } from './clerk.guard';

@Global()
@Module({
  providers: [
    ClerkService,
    {
      provide: APP_GUARD,
      useClass: ClerkGuard,
    },
  ],
  exports: [ClerkService],
})
export class AuthModule {}
