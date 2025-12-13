/**
 * EmailService - Email sending functionality using Resend
 *
 * Handles all transactional emails including:
 * - Coach invitation emails to athletes
 * - Welcome emails for new users
 * - Notification emails
 *
 * @module email
 */
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly defaultFrom = 'RidePro <noreply@ridepro.app>';

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email service initialized');
    } else {
      this.logger.warn('RESEND_API_KEY not set - emails will be logged only');
    }
  }

  /**
   * Sends an email using Resend
   *
   * @param options - Email options (to, subject, html)
   * @returns Promise with send result or mock result if no API key
   */
  async send(options: SendEmailOptions): Promise<{ id: string; success: boolean }> {
    const { to, subject, html, from = this.defaultFrom } = options;

    // If no Resend client, log and return mock success (for development)
    if (!this.resend) {
      this.logger.log(`[DEV] Would send email to ${to}: ${subject}`);
      this.logger.debug(`[DEV] Email HTML: ${html.substring(0, 200)}...`);
      return { id: `dev-${Date.now()}`, success: true };
    }

    try {
      const result = await this.resend.emails.send({
        from,
        to,
        subject,
        html,
      });

      if (result.error) {
        this.logger.error(`Failed to send email: ${result.error.message}`);
        return { id: '', success: false };
      }

      this.logger.log(`Email sent to ${to}: ${result.data?.id}`);
      return { id: result.data?.id || '', success: true };
    } catch (error) {
      this.logger.error(`Email send error: ${error}`);
      return { id: '', success: false };
    }
  }

  /**
   * Sends a coach invitation email to an athlete
   *
   * @param options - Invitation email details
   */
  async sendCoachInvitation(options: {
    athleteEmail: string;
    athleteName?: string;
    coachName: string;
    invitationToken: string;
    personalMessage?: string;
    expiresAt: Date;
  }): Promise<{ id: string; success: boolean }> {
    const { athleteEmail, athleteName, coachName, invitationToken, personalMessage, expiresAt } = options;

    const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invitation/${invitationToken}`;
    const expiryDate = expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const greeting = athleteName ? `Hi ${athleteName}` : 'Hi';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to join RidePro</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🚴 RidePro</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your Training Journey Starts Here</p>
  </div>

  <div style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">${greeting},</h2>

    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>${coachName}</strong> has invited you to join their training team on RidePro!
    </p>

    ${personalMessage ? `
    <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-style: italic; color: #4a5568;">"${personalMessage}"</p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #718096;">— ${coachName}</p>
    </div>
    ` : ''}

    <p style="font-size: 16px; margin-bottom: 30px;">
      Click the button below to accept the invitation and start working with your coach:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
        Accept Invitation
      </a>
    </div>

    <p style="font-size: 14px; color: #718096; margin-top: 30px;">
      This invitation expires on <strong>${expiryDate}</strong>.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

    <p style="font-size: 12px; color: #a0aec0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${invitationUrl}" style="color: #667eea; word-break: break-all;">${invitationUrl}</a>
    </p>

    <p style="font-size: 12px; color: #a0aec0; margin-top: 20px;">
      If you didn't expect this invitation or don't want to join, you can safely ignore this email.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #a0aec0; font-size: 12px;">
    <p>© ${new Date().getFullYear()} RidePro. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();

    return this.send({
      to: athleteEmail,
      subject: `${coachName} invited you to join their training team on RidePro`,
      html,
    });
  }
}
