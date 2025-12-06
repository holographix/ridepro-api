import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkService } from './clerk.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ClerkGuard implements CanActivate {
  constructor(
    private clerkService: ClerkService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const clerkUserId = await this.clerkService.verifyToken(token);

    if (!clerkUserId) {
      throw new UnauthorizedException('Invalid token');
    }

    // Get or create user in our database
    const user = await this.clerkService.getOrCreateUser(clerkUserId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Attach user to request
    request.user = user;
    request.clerkUserId = clerkUserId;

    return true;
  }
}
