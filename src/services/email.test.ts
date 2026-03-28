import { describe, it, expect, vi, afterEach } from 'vitest';
import { emailService } from './email.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Email service', () => {
  describe('parseUrl', () => {
    it('parses user, password, host, port, and to', () => {
      const url = new URL('mailto://user:pass@smtp.example.com:587/?to=recipient@example.com&gateway=resend');
      const config = emailService.parseUrl(url);
      expect(config).toMatchObject({
        service: 'email',
        user: 'user',
        password: 'pass',
        host: 'smtp.example.com',
        port: '587',
        to: 'recipient@example.com',
        gateway: 'resend',
      });
    });

    it('parses optional cc, bcc, and from', () => {
      const url = new URL('mailto://user:pass@host/?to=a@b.com&cc=c@d.com&bcc=e@f.com&from=g@h.com&gateway=mailchannels');
      const config = emailService.parseUrl(url);
      expect(config).toMatchObject({
        to: 'a@b.com',
        cc: 'c@d.com',
        bcc: 'e@f.com',
        from: 'g@h.com',
      });
    });

    it('returns undefined optional fields when absent', () => {
      const url = new URL('mailto://user:pass@host/?to=a@b.com');
      const config = emailService.parseUrl(url);
      expect(config.cc).toBeUndefined();
      expect(config.bcc).toBeUndefined();
      expect(config.from).toBeUndefined();
      expect(config.gateway).toBeUndefined();
    });
  });

  describe('send', () => {
    it('returns failure when no gateway is configured', async () => {
      const result = await emailService.send(
        { service: 'email', user: 'u', password: 'p', host: 'host', port: '', to: 'a@b.com' },
        { body: 'Hello' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SMTP is not supported/);
      expect(result.error).toMatch(/gateway/);
    });

    it('returns failure for unknown gateway', async () => {
      const result = await emailService.send(
        { service: 'email', user: 'u', password: 'p', host: 'host', port: '', to: 'a@b.com', gateway: 'unknown' },
        { body: 'Hello' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unknown gateway/);
    });

    it('POSTs to MailChannels API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await emailService.send(
        { service: 'email', user: 'user', password: 'pass', host: 'smtp.example.com', port: '', to: 'to@example.com', gateway: 'mailchannels' },
        { title: 'Subject', body: 'Hello' },
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mailchannels.net/tx/v1/send',
        expect.objectContaining({ method: 'POST' }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.subject).toBe('Subject');
      expect(body.to).toEqual([{ email: 'to@example.com' }]);
      expect(body.content[0].value).toBe('Hello');
    });

    it('POSTs to Resend API with Authorization header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await emailService.send(
        { service: 'email', user: 'user', password: 'resend-api-key', host: 'smtp.example.com', port: '', to: 'to@example.com', gateway: 'resend' },
        { body: 'Hello' },
      );

      expect(result.success).toBe(true);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(init.headers['Authorization']).toBe('Bearer resend-api-key');
    });

    it('uses from field when provided for MailChannels', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await emailService.send(
        { service: 'email', user: 'u', password: 'p', host: 'host', port: '', to: 'to@b.com', from: 'from@b.com', gateway: 'mailchannels' },
        { body: 'Hi' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.from.email).toBe('from@b.com');
    });

    it('returns failure result on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'Server Error' }));

      const result = await emailService.send(
        { service: 'email', user: 'u', password: 'p', host: 'host', port: '', to: 'a@b.com', gateway: 'mailchannels' },
        { body: 'Hi' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    // M4: Email validation
    it('rejects invalid "to" address', async () => {
      const result = await emailService.send(
        { service: 'email', user: 'u', password: 'p', host: 'host', port: '', to: 'not-an-email', gateway: 'mailchannels' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid email/);
    });

    it('rejects address with double @', async () => {
      const result = await emailService.send(
        { service: 'email', user: 'u', password: 'p', host: 'host', port: '', to: 'a@@b.com', gateway: 'mailchannels' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid email/);
    });

    it('rejects address with spaces', async () => {
      const result = await emailService.send(
        { service: 'email', user: 'u', password: 'p', host: 'host', port: '', to: 'a b@c.com', gateway: 'mailchannels' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid email/);
    });

    it('accepts valid email addresses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await emailService.send(
        { service: 'email', user: 'u', password: 'p', host: 'host', port: '', to: 'valid@example.com', gateway: 'mailchannels' },
        { body: 'test' },
      );
      expect(result.success).toBe(true);
    });

    // M6: Config guard
    it('throws on misrouted config', async () => {
      await expect(
        emailService.send({ service: 'discord', webhookId: 'x', webhookToken: 'y' }, { body: 'test' }),
      ).rejects.toThrow('Misrouted config: expected email');
    });
  });
});
