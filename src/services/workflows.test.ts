import { describe, it, expect, vi, afterEach } from 'vitest';
import { workflowsService } from './workflows.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const POWER_AUTOMATE_URL =
  'https://default.b0.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/486665a7c2be4f109eff8dfe7f26bbf8/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZIVFCi7oV6mVHEDMfU2RVTjhfRy29NnUa6hDumHwfrk';

describe('Workflows (Teams / Power Automate) service', () => {
  describe('parseUrl', () => {
    it('reconstructs the full HTTPS webhook URL, preserving port, path, and sig', () => {
      const url = new URL(POWER_AUTOMATE_URL.replace(/^https:\/\//, 'workflows://'));
      const config = workflowsService.parseUrl(url);
      expect(config).toEqual({
        service: 'workflows',
        webhookUrl: POWER_AUTOMATE_URL,
      });
    });

    it('supports Logic Apps style URLs', () => {
      const raw =
        'https://prod-12.westus.logic.azure.com:443/workflows/abc123/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=SECRET';
      const url = new URL(raw.replace(/^https:\/\//, 'workflows://'));
      const config = workflowsService.parseUrl(url);
      expect(config.webhookUrl).toBe(raw);
    });

    it('registers the workflow alias', () => {
      expect(workflowsService.schemas).toContain('workflow');
    });

    it('rejects loopback / private hosts (SSRF guard)', () => {
      const url = new URL('workflows://127.0.0.1/triggers/manual/paths/invoke?sig=x');
      expect(() => workflowsService.parseUrl(url)).toThrow(/loopback|private/i);
    });
  });

  describe('send', () => {
    it('posts a { text } payload to the reconstructed webhook URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await workflowsService.send(
        { service: 'workflows', webhookUrl: POWER_AUTOMATE_URL },
        { body: 'Hello Workflows' },
      );

      expect(result).toEqual({ success: true, service: 'workflows' });
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(POWER_AUTOMATE_URL);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ text: 'Hello Workflows' });
    });

    it('prepends a bold title', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await workflowsService.send(
        { service: 'workflows', webhookUrl: POWER_AUTOMATE_URL },
        { title: 'Alert', body: 'Something happened' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toBe('**Alert**\n\nSomething happened');
    });

    it('returns a failure result on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' }));

      const result = await workflowsService.send(
        { service: 'workflows', webhookUrl: POWER_AUTOMATE_URL },
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
