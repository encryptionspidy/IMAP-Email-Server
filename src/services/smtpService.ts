import nodemailer from 'nodemailer';
import { 
  SmtpConfig, 
  ComposeEmailRequest, 
  SendEmailResponse,
  EmailAttachment,
  ImapConnectionError 
} from '../types';

export class SmtpService {
  private transporter: nodemailer.Transporter | null = null;
  private config: SmtpConfig | null = null;

  /**
   * Initialize SMTP connection
   */
  async connect(config: SmtpConfig): Promise<void> {
    try {
      this.config = config;
      
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure, // true for 465, false for other ports
        auth: {
          user: config.username,
          pass: config.password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Verify connection
      if (this.transporter) {
        await this.transporter.verify();
      }
      console.log('SMTP connection established');
    } catch (error) {
      throw new ImapConnectionError(
        `Failed to connect to SMTP server ${config.host}:${config.port}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send email
   */
  async sendEmail(emailData: ComposeEmailRequest): Promise<SendEmailResponse> {
    if (!this.transporter || !this.config) {
      return {
        success: false,
        error: 'SMTP not connected. Call connect() first.',
      };
    }

    try {
      // Prepare attachments
      const attachments = emailData.attachments?.map(this.convertAttachment) || [];

      // Prepare email options
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.config.username,
        to: emailData.to.join(', '),
        cc: emailData.cc?.join(', '),
        bcc: emailData.bcc?.join(', '),
        subject: emailData.subject,
        text: emailData.body,
        html: emailData.htmlBody,
        attachments,
      };

      // Handle reply-to functionality
      if (emailData.replyToUid) {
        // In a real implementation, you'd fetch the original email
        // and set appropriate headers like In-Reply-To and References
        mailOptions.inReplyTo = `<${emailData.replyToUid}@${this.config.host}>`;
        mailOptions.references = `<${emailData.replyToUid}@${this.config.host}>`;
      }

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('Failed to send email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  /**
   * Send reply email
   */
  async replyToEmail(
    originalEmail: any,
    replyContent: string,
    replyHtml?: string,
    includeOriginal: boolean = true
  ): Promise<SendEmailResponse> {
    if (!this.transporter || !this.config) {
      return {
        success: false,
        error: 'SMTP not connected. Call connect() first.',
      };
    }

    try {
      let subject = originalEmail.subject;
      if (!subject.toLowerCase().startsWith('re:')) {
        subject = `Re: ${subject}`;
      }

      let body = replyContent;
      let htmlBody = replyHtml;

      // Include original email if requested
      if (includeOriginal) {
        const originalText = `\n\n--- Original Message ---\nFrom: ${originalEmail.from}\nDate: ${originalEmail.date}\nSubject: ${originalEmail.subject}\n\n${originalEmail.textBody || originalEmail.body}`;
        body += originalText;

        if (replyHtml && originalEmail.htmlBody) {
          const originalHtml = `
            <br><br>
            <div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 10px;">
              <p><strong>--- Original Message ---</strong></p>
              <p><strong>From:</strong> ${originalEmail.from}</p>
              <p><strong>Date:</strong> ${originalEmail.date}</p>
              <p><strong>Subject:</strong> ${originalEmail.subject}</p>
              <br>
              ${originalEmail.htmlBody}
            </div>
          `;
          htmlBody += originalHtml;
        }
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: this.config.username,
        to: originalEmail.from,
        subject,
        text: body,
        html: htmlBody,
        inReplyTo: originalEmail.messageId,
        references: [originalEmail.messageId, ...(originalEmail.references || [])].join(' '),
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('Failed to send reply:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send reply',
      };
    }
  }

  /**
   * Forward email
   */
  async forwardEmail(
    originalEmail: any,
    to: string[],
    forwardContent?: string,
    cc?: string[],
    bcc?: string[]
  ): Promise<SendEmailResponse> {
    if (!this.transporter || !this.config) {
      return {
        success: false,
        error: 'SMTP not connected. Call connect() first.',
      };
    }

    try {
      let subject = originalEmail.subject;
      if (!subject.toLowerCase().startsWith('fwd:') && !subject.toLowerCase().startsWith('fw:')) {
        subject = `Fwd: ${subject}`;
      }

      const forwardedText = `
${forwardContent || ''}

--- Forwarded Message ---
From: ${originalEmail.from}
Date: ${originalEmail.date}
Subject: ${originalEmail.subject}
To: ${originalEmail.to}

${originalEmail.textBody || originalEmail.body}
      `;

      const forwardedHtml = `
${forwardContent || ''}
<br><br>
<div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 10px;">
  <p><strong>--- Forwarded Message ---</strong></p>
  <p><strong>From:</strong> ${originalEmail.from}</p>
  <p><strong>Date:</strong> ${originalEmail.date}</p>
  <p><strong>Subject:</strong> ${originalEmail.subject}</p>
  <p><strong>To:</strong> ${originalEmail.to}</p>
  <br>
  ${originalEmail.htmlBody || originalEmail.body}
</div>
      `;

      const mailOptions: nodemailer.SendMailOptions = {
        from: this.config.username,
        to: to.join(', '),
        cc: cc?.join(', '),
        bcc: bcc?.join(', '),
        subject,
        text: forwardedText,
        html: forwardedHtml,
        attachments: originalEmail.attachments?.map(this.convertAttachment) || [],
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('Failed to forward email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to forward email',
      };
    }
  }

  /**
   * Send bulk emails (for newsletters, etc.)
   */
  async sendBulkEmails(
    emails: ComposeEmailRequest[],
    batchSize: number = 10,
    delayMs: number = 1000
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const promises = batch.map(async (email) => {
        try {
          const result = await this.sendEmail(email);
          if (result.success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push(result.error || 'Unknown error');
          }
        } catch (error) {
          results.failed++;
          results.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      });

      await Promise.all(promises);

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Test SMTP connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP not connected. Call connect() first.',
      };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Get SMTP server capabilities
   */
  async getCapabilities(): Promise<any> {
    if (!this.transporter) {
      throw new Error('SMTP not connected. Call connect() first.');
    }

    // Access the underlying connection to get capabilities
    // This is a simplified implementation
    return {
      host: this.config?.host,
      port: this.config?.port,
      secure: this.config?.secure,
      authenticated: true,
    };
  }

  /**
   * Create email template
   */
  createEmailTemplate(
    templateName: string,
    variables: Record<string, string>
  ): { subject: string; body: string; htmlBody?: string } {
    const templates = {
      welcome: {
        subject: 'Welcome to {{appName}}!',
        body: `Hello {{name}},\n\nWelcome to {{appName}}! We're excited to have you on board.\n\nBest regards,\nThe {{appName}} Team`,
        htmlBody: `
          <h2>Hello {{name}},</h2>
          <p>Welcome to <strong>{{appName}}</strong>! We're excited to have you on board.</p>
          <p>Best regards,<br>The {{appName}} Team</p>
        `,
      },
      passwordReset: {
        subject: 'Password Reset for {{appName}}',
        body: `Hello {{name}},\n\nYou have requested a password reset for your {{appName}} account.\n\nReset link: {{resetLink}}\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe {{appName}} Team`,
        htmlBody: `
          <h2>Hello {{name}},</h2>
          <p>You have requested a password reset for your {{appName}} account.</p>
          <p><a href="{{resetLink}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>The {{appName}} Team</p>
        `,
      },
    };

    const template = templates[templateName as keyof typeof templates];
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Replace variables
    const replaceVariables = (text: string) => {
      return Object.entries(variables).reduce(
        (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value),
        text
      );
    };

    return {
      subject: replaceVariables(template.subject),
      body: replaceVariables(template.body),
      htmlBody: template.htmlBody ? replaceVariables(template.htmlBody) : '',
    };
  }

  /**
   * Schedule email for later sending (simplified implementation)
   */
  async scheduleEmail(
    emailData: ComposeEmailRequest,
    sendAt: Date
  ): Promise<{ success: boolean; scheduledId?: string; error?: string }> {
    // In a real implementation, you'd store this in a database
    // and have a background job process scheduled emails
    const delay = sendAt.getTime() - Date.now();

    if (delay <= 0) {
      return {
        success: false,
        error: 'Scheduled time must be in the future',
      };
    }

    const scheduledId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setTimeout(async () => {
      try {
        await this.sendEmail(emailData);
        console.log(`Scheduled email ${scheduledId} sent successfully`);
      } catch (error) {
        console.error(`Failed to send scheduled email ${scheduledId}:`, error);
      }
    }, delay);

    return {
      success: true,
      scheduledId,
    };
  }

  /**
   * Disconnect from SMTP server
   */
  async disconnect(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      this.config = null;
      console.log('SMTP connection closed');
    }
  }

  /**
   * Convert EmailAttachment to nodemailer attachment format
   */
  private convertAttachment(attachment: EmailAttachment): any {
    return {
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
      contentDisposition: attachment.disposition,
      cid: attachment.contentId,
      encoding: attachment.encoding as any,
    };
  }

  /**
   * Validate email address
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Extract email addresses from a string
   */
  static extractEmails(text: string): string[] {
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
    return text.match(emailRegex) || [];
  }

  /**
   * Format email address with name
   */
  static formatEmailAddress(email: string, name?: string): string {
    if (name) {
      return `"${name}" <${email}>`;
    }
    return email;
  }
}
