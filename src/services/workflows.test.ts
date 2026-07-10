import { describe, it, expect, vi, afterEach } from 'vitest';
import { workflowsService, buildWorkflowsPayload } from './workflows.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const POWER_AUTOMATE_URL =
  'https://default.b0.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/486665a7c2be4f109eff8dfe7f26bbf8/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZIVFCi7oV6mVHEDMfU2RVTjhfRy29NnUa6hDumHwfrk';

const notiflyUrl = (fragment = '') => POWER_AUTOMATE_URL.replace(/^https:\/\//, 'workflows://') + fragment;

describe('Workflows (Teams / Power Automate) service', () => {
  describe('parseUrl', () => {
    it('reconstructs the full HTTPS webhook URL, preserving port, path, and sig; defaults to card format', () => {
      const config = workflowsService.parseUrl(new URL(notiflyUrl()));
      expect(config).toEqual({
        service: 'workflows',
        webhookUrl: POWER_AUTOMATE_URL,
        format: 'card',
      });
    });

    it('does not leak the #format fragment into the webhook URL (sig stays byte-exact)', () => {
      const config = workflowsService.parseUrl(new URL(notiflyUrl('#format=message')));
      expect(config.webhookUrl).toBe(POWER_AUTOMATE_URL);
      expect(config.format).toBe('message');
    });

    it('reads the text format from the fragment', () => {
      expect(workflowsService.parseUrl(new URL(notiflyUrl('#format=text'))).format).toBe('text');
    });

    it('falls back to card format for an unknown fragment value', () => {
      expect(workflowsService.parseUrl(new URL(notiflyUrl('#format=bogus'))).format).toBe('card');
    });

    it('supports Logic Apps style URLs', () => {
      const raw =
        'https://prod-12.westus.logic.azure.com:443/workflows/abc123/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=SECRET';
      const url = new URL(raw.replace(/^https:\/\//, 'workflows://'));
      expect(workflowsService.parseUrl(url).webhookUrl).toBe(raw);
    });

    it('registers the workflow alias', () => {
      expect(workflowsService.schemas).toContain('workflow');
    });

    it('rejects loopback / private hosts (SSRF guard)', () => {
      const url = new URL('workflows://127.0.0.1/triggers/manual/paths/invoke?sig=x');
      expect(() => workflowsService.parseUrl(url)).toThrow(/loopback|private/i);
    });
  });

  describe('buildWorkflowsPayload', () => {
    it('builds a bare Adaptive Card by default (card)', () => {
      const payload = buildWorkflowsPayload({ title: 'Alert', body: 'Down', type: 'failure' }, 'card') as {
        type: string;
        version: string;
        $schema: string;
        body: Array<Record<string, unknown>>;
      };
      expect(payload.type).toBe('AdaptiveCard');
      expect(payload.$schema).toContain('adaptivecard');
      expect(payload.version).toBe('1.5');
      expect(payload.body[0]).toMatchObject({ type: 'TextBlock', text: 'Alert', weight: 'Bolder', color: 'Attention' });
      expect(payload.body[1]).toMatchObject({ type: 'TextBlock', text: 'Down', wrap: true });
    });

    it('omits the title block when there is no title, colouring the body instead', () => {
      const payload = buildWorkflowsPayload({ body: 'Just a body', type: 'success' }, 'card') as {
        body: Array<Record<string, unknown>>;
      };
      expect(payload.body).toHaveLength(1);
      expect(payload.body[0]).toMatchObject({ text: 'Just a body', color: 'Good' });
    });

    it('wraps the card in a message envelope (message)', () => {
      const payload = buildWorkflowsPayload({ body: 'Hi' }, 'message') as {
        type: string;
        attachments: Array<{ contentType: string; content: { type: string } }>;
      };
      expect(payload.type).toBe('message');
      expect(payload.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
      expect(payload.attachments[0].content.type).toBe('AdaptiveCard');
    });

    it('produces the legacy { text } payload (text) with a bold title', () => {
      expect(buildWorkflowsPayload({ title: 'Alert', body: 'Something' }, 'text')).toEqual({
        text: '**Alert**\n\nSomething',
      });
      expect(buildWorkflowsPayload({ body: 'no title' }, 'text')).toEqual({ text: 'no title' });
    });
  });

  describe('send', () => {
    it('posts a bare Adaptive Card by default', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await workflowsService.send(
        { service: 'workflows', webhookUrl: POWER_AUTOMATE_URL, format: 'card' },
        { title: 'Hi', body: 'there' },
      );

      expect(result).toEqual({ success: true, service: 'workflows' });
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(POWER_AUTOMATE_URL);
      expect(init.method).toBe('POST');
      const payload = JSON.parse(init.body);
      expect(payload.type).toBe('AdaptiveCard');
      expect(payload.body.map((b: { text: string }) => b.text)).toEqual(['Hi', 'there']);
    });

    it('defaults to card when the config omits format', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);
      await workflowsService.send(
        { service: 'workflows', webhookUrl: POWER_AUTOMATE_URL },
        { body: 'x' },
      );
      expect(JSON.parse(mockFetch.mock.calls[0][1].body).type).toBe('AdaptiveCard');
    });

    it('posts the legacy { text } payload when format is text', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);
      await workflowsService.send(
        { service: 'workflows', webhookUrl: POWER_AUTOMATE_URL, format: 'text' },
        { title: 'Alert', body: 'Something happened' },
      );
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ text: '**Alert**\n\nSomething happened' });
    });

    it('returns a failure result on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' }));

      const result = await workflowsService.send(
        { service: 'workflows', webhookUrl: POWER_AUTOMATE_URL, format: 'card' },
        { body: 'Test' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('throws on misrouted config', async () => {
      await expect(
        workflowsService.send({ service: 'discord' }, { body: 'x' }),
      ).rejects.toThrow(/Misrouted/);
    });
  });
});
