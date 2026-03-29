import { EmailInterface } from '@gitroom/nestjs-libraries/emails/email.interface';

export class StudioToolsProvider implements EmailInterface {
  name = 'studio-tools';
  validateEnvKeys = ['STUDIO_TOOLS_API_URL', 'INTERNAL_API_KEY'];

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    emailFromName: string,
    emailFromAddress: string,
    replyTo?: string
  ) {
    const apiUrl = process.env.STUDIO_TOOLS_API_URL;
    const apiKey = process.env.INTERNAL_API_KEY;
    if (!apiUrl || !apiKey) {
      console.log('Studio Tools API URL or Internal API Key not configured');
      return { sent: false };
    }

    try {
      const res = await fetch(
        `${apiUrl.replace(/\/$/, '')}/api/internal/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Api-Key': apiKey,
          },
          body: JSON.stringify({ to, subject, html, replyTo }),
        }
      );

      if (!res.ok) {
        console.log(
          `Studio Tools send-email failed: ${res.status} ${res.statusText}`
        );
        return { sent: false };
      }

      return await res.json();
    } catch (err) {
      console.log('Studio Tools send-email error:', err);
      return { sent: false };
    }
  }
}
