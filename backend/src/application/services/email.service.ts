import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(
    toEmail: string,
    resetToken: string,
  ): Promise<boolean> {
    const server = this.config.get<string>('app.mailServer') ?? '';
    if (!server) {
      return false;
    }

    const sender =
      this.config.get<string>('app.mailDefaultSender') ||
      this.config.get<string>('app.mailUsername');
    if (!sender) {
      this.logger.warn(
        'MAIL_DEFAULT_SENDER or MAIL_USERNAME required to send email',
      );
      return false;
    }

    const base = this.config.get<string>('app.passwordResetFrontendUrl') ?? '';
    const body = base
      ? `You requested a password reset for your MRV account.\n\nOpen this link (valid for a limited time):\n${base}?token=${resetToken}\n\nIf you did not request this, ignore this email.`
      : `You requested a password reset for your MRV account.\n\nUse this token in the reset form:\n\n${resetToken}\n\nIf you did not request this, ignore this email.`;

    const port = this.config.get<number>('app.mailPort', 587);
    const useTls = this.config.get<boolean>('app.mailUseTls', true);
    const user = this.config.get<string>('app.mailUsername') ?? '';
    const password = this.config.get<string>('app.mailPassword') ?? '';

    const transporter = nodemailer.createTransport({
      host: server,
      port,
      secure: port === 465,
      auth: user ? { user, pass: password } : undefined,
      requireTLS: useTls,
    });

    await transporter.sendMail({
      from: sender,
      to: toEmail,
      subject: 'Password reset — MRV',
      text: body,
    });

    return true;
  }
}
