/**
 * Email service via HTTP gateway (MailChannels or Resend).
 *
 * Raw SMTP requires TCP sockets which are not available in Web API environments
 * (Cloudflare Workers, browsers, Deno Deploy, etc.). This service therefore
 * requires an HTTP gateway:
 *
 *   - mailchannels: free for Cloudflare Workers (no API key needed)
 *   - resend: free tier available (requires API key as the password in the URL)
 *
 * URL scheme:
 *   mailto://user:password@host:port/?to=recipient@example.com&gateway=mailchannels
 *   mailto://user:apikey@host/?to=recipient@example.com&gateway=resend
 *
 * For generic SMTP URLs without a gateway param, this service throws a clear
 * error explaining the limitation and suggesting a gateway.
 *
 * **Security note (M3):** The Resend API key is passed as the URL password
 * field (mailto://user:APIKEY@host). URLs may appear in shell history,
 * process listings (`ps`), and server logs. For production use, construct the
 * URL programmatically from environment variables rather than hard-coding keys:
 *
 *   const url = `mailto://user:${process.env.RESEND_KEY}@host/?to=...&gateway=resend`;
 */
import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';
import { validateEmail, errorMessage } from '../security.js';

interface EmailConfig extends ServiceConfig {
  service: 'email';
  user: string;
  password: string;
  host: string;
  port: string;
  to: string;
  from?: string;
  cc?: string;
  bcc?: string;
  gateway?: string;
}

class EmailService extends BaseService implements ServiceDefinition {
  schemas = ['mailto'];

  /**
   * Parse a mailto:// URL into an EmailConfig.
   *
   * **Security note:** API keys in the password field of URLs appear in shell
   * history and process listings. See module-level JSDoc for guidance.
   */
  parseUrl(url: URL): EmailConfig {
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const host = url.hostname;
    const port = url.port;
    const to = url.searchParams.get('to') ?? '';
    const from = url.searchParams.get('from') ?? undefined;
    const cc = url.searchParams.get('cc') ?? undefined;
    const bcc = url.searchParams.get('bcc') ?? undefined;
    const gateway = url.searchParams.get('gateway') ?? undefined;
    return { service: 'email', user, password, host, port, to, from, cc, bcc, gateway };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    if (config.service !== 'email') {
      throw new Error('Misrouted config: expected email');
    }
    const { user, password, host, to, from, cc, bcc, gateway } = config as EmailConfig;

    try {
      if (!gateway) {
        throw new Error(
          'Raw SMTP is not supported in Web API environments (Cloudflare Workers, browsers, Deno, etc.) ' +
          'because they lack TCP socket access. Add ?gateway=mailchannels (free on Cloudflare Workers) ' +
          'or ?gateway=resend (free tier available) to your mailto:// URL.',
        );
      }

      // M4: Validate email addresses before sending
      validateEmail(to);
      if (from) validateEmail(from);
      if (cc) validateEmail(cc);
      if (bcc) validateEmail(bcc);

      const subject = message.title ?? '';
      const text = message.body;
      const sender = from ?? `${user}@${host}`;

      if (gateway === 'mailchannels') {
        await this.httpPost('https://api.mailchannels.net/tx/v1/send', {
          from: { email: sender },
          to: [{ email: to }],
          ...(cc ? { cc: [{ email: cc }] } : {}),
          ...(bcc ? { bcc: [{ email: bcc }] } : {}),
          subject,
          content: [{ type: 'text/plain', value: text }],
        });
      } else if (gateway === 'resend') {
        await this.httpPost('https://api.resend.com/emails', {
          from: sender,
          to: [to],
          ...(cc ? { cc: [cc] } : {}),
          ...(bcc ? { bcc: [bcc] } : {}),
          subject,
          text,
        }, { Authorization: `Bearer ${password}` });
      } else {
        throw new Error(
          `Unknown gateway: "${gateway}". Supported gateways: mailchannels, resend.`,
        );
      }

      return { success: true, service: 'email' };
    } catch (err) {
      return { success: false, service: 'email', error: errorMessage(err) };
    }
  }
}

export const emailService = new EmailService();
