/**
 * ClerkService - Clerk authentication integration
 *
 * This service handles Clerk authentication integration including:
 * - Token verification for API requests
 * - User synchronization between Clerk and local database
 * - Automatic user creation on first login
 *
 * Note: With the new many-to-many relationship model, users no longer
 * have a fixed "role". Any user can be both a coach and an athlete.
 *
 * @module auth
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service for Clerk authentication integration
 *
 * @class ClerkService
 * @description Handles JWT token verification and user synchronization
 * between Clerk's authentication system and the local database.
 */
@Injectable()
export class ClerkService implements OnModuleInit {
  private clerk;
  private secretKey: string;

  constructor(private prisma: PrismaService) {
    this.secretKey = process.env.CLERK_SECRET_KEY || '';
    console.log(
      'Clerk secret key loaded:',
      this.secretKey ? `${this.secretKey.slice(0, 10)}...` : 'NOT LOADED',
    );
    this.clerk = createClerkClient({
      secretKey: this.secretKey,
    });
  }

  /**
   * Lifecycle hook called when module is initialized
   */
  onModuleInit() {
    console.log('ClerkService initialized');
  }

  /**
   * Verifies a Clerk JWT token
   *
   * @param token - The JWT token to verify
   * @returns Promise containing the user's Clerk ID (sub claim) or null if invalid
   */
  async verifyToken(token: string) {
    try {
      const result = await verifyToken(token, {
        secretKey: this.secretKey,
      });
      console.log('Token verification result:', result);
      return result.sub;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Fetches user data from Clerk
   *
   * @param clerkUserId - The Clerk user ID
   * @returns Promise containing the Clerk user or null if not found
   */
  async getClerkUser(clerkUserId: string) {
    try {
      return await this.clerk.users.getUser(clerkUserId);
    } catch (error) {
      return null;
    }
  }

  /**
   * Gets or creates a local user from Clerk authentication
   *
   * @param clerkUserId - The Clerk user ID from the JWT token
   * @returns Promise containing the local user or null if failed
   * @description Creates a new user in the local database if they don't exist,
   * using data from their Clerk profile.
   */
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
          fullName:
            `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
            null,
          avatarUrl: clerkUser.imageUrl,
        },
      });
    }

    return user;
  }

  /**
   * Synchronizes user data from Clerk to local database
   *
   * @param clerkUserId - The Clerk user ID to sync
   * @returns Promise containing the synced user or null if failed
   * @description Uses upsert to create or update local user with latest Clerk data
   */
  async syncUserFromClerk(clerkUserId: string) {
    const clerkUser = await this.getClerkUser(clerkUserId);
    if (!clerkUser) return null;

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return null;

    return this.prisma.user.upsert({
      where: { clerkUserId },
      update: {
        email,
        fullName:
          `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
          null,
        avatarUrl: clerkUser.imageUrl,
      },
      create: {
        clerkUserId,
        email,
        fullName:
          `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
          null,
        avatarUrl: clerkUser.imageUrl,
      },
    });
  }

  /**
   * Creates a Clerk invitation for an athlete
   *
   * @param emailAddress - The email to invite
   * @param redirectUrl - URL to redirect after accepting (includes our invite token)
   * @param publicMetadata - Metadata that transfers to user on signup (coachId, invitationId)
   * @returns Promise containing the Clerk invitation
   */
  async createInvitation(params: {
    emailAddress: string;
    redirectUrl: string;
    publicMetadata?: Record<string, unknown>;
    expiresInDays?: number;
  }) {
    try {
      const invitation = await this.clerk.invitations.createInvitation({
        emailAddress: params.emailAddress,
        redirectUrl: params.redirectUrl,
        publicMetadata: params.publicMetadata,
        expiresInDays: params.expiresInDays || 7,
        notify: true, // Clerk sends the email
      });
      return invitation;
    } catch (error) {
      console.error('Failed to create Clerk invitation:', error);
      throw error;
    }
  }

  /**
   * Revokes a Clerk invitation
   *
   * @param invitationId - The Clerk invitation ID to revoke
   */
  async revokeInvitation(invitationId: string) {
    try {
      await this.clerk.invitations.revokeInvitation(invitationId);
      return { success: true };
    } catch (error) {
      console.error('Failed to revoke Clerk invitation:', error);
      throw error;
    }
  }

  /**
   * Lists all Clerk invitations
   */
  async listInvitations() {
    try {
      return await this.clerk.invitations.getInvitationList();
    } catch (error) {
      console.error('Failed to list Clerk invitations:', error);
      throw error;
    }
  }

  /**
   * Gets a user's public metadata (contains coachId if signed up via invitation)
   */
  async getUserPublicMetadata(clerkUserId: string) {
    const clerkUser = await this.getClerkUser(clerkUserId);
    return clerkUser?.publicMetadata || {};
  }
}
