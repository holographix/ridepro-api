import { Injectable } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClerkService {
  private clerk;

  constructor(private prisma: PrismaService) {
    this.clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
  }

  async verifyToken(token: string) {
    try {
      const { sub: userId } = await this.clerk.verifyToken(token);
      return userId;
    } catch (error) {
      return null;
    }
  }

  async getClerkUser(clerkUserId: string) {
    try {
      return await this.clerk.users.getUser(clerkUserId);
    } catch (error) {
      return null;
    }
  }

  async getOrCreateUser(clerkUserId: string) {
    // Check if user exists in our database
    let user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      // Fetch user data from Clerk
      const clerkUser = await this.getClerkUser(clerkUserId);
      if (!clerkUser) return null;

      // Create user in our database
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) return null;

      user = await this.prisma.user.create({
        data: {
          clerkUserId,
          email,
          fullName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
          avatarUrl: clerkUser.imageUrl,
          role: 'ATHLETE', // Default role
        },
      });
    }

    return user;
  }

  async syncUserFromClerk(clerkUserId: string) {
    const clerkUser = await this.getClerkUser(clerkUserId);
    if (!clerkUser) return null;

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return null;

    return this.prisma.user.upsert({
      where: { clerkUserId },
      update: {
        email,
        fullName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
        avatarUrl: clerkUser.imageUrl,
      },
      create: {
        clerkUserId,
        email,
        fullName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
        avatarUrl: clerkUser.imageUrl,
        role: 'ATHLETE',
      },
    });
  }
}
