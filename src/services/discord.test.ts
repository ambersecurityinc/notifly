import { describe, it, expect, vi, afterEach } from 'vitest';
import { discordService } from './discord.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Discord service', () => {
  describe('parseUrl', () => {
    it('parses webhook id and token', () => {
      const url = new URL('discord://webhook123/tokenABC');
      const config = discordService.parseUrl(url);
      expect(config).toEqual({ service: 'discord', webhookId: 'webhook123', webhookToken: 'tokenABC' });
    });
  });

  describe('send', () => {
    it('posts message content to webhook URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await discordService.send(
        { service: 'discord', webhookId: 'wid', webhookToken: 'wtoken' },
        { body: 'Hello Discord' },
      );

      expect(result.success).toBe(true);
      expect(result.service).toBe('discord');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/wid/wtoken',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ content: 'Hello Discord' }) }),
      );
    });

    it('prepends bold title when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await discordService.send(
        { service: 'discord', webhookId: 'wid', webhookToken: 'wtoken' },
        { title: 'Alert', body: 'Something happened' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.content).toBe('**Alert**\nSomething happened');
    });

    it('returns failure result on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' }));

      const result = await discordService.send(
        { service: 'discord', webhookId: 'bad', webhookToken: 'bad' },
        { body: 'Test' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    // H1: Timeout via httpPost
    it('passes AbortSignal.timeout to fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await discordService.send(
        { service: 'discord', webhookId: 'wid', webhookToken: 'wtoken' },
        { body: 'test' },
      );

      const init = mockFetch.mock.calls[0][1];
      expect(init.signal).toBeDefined();
    });

    // M6: Config guard
    it('throws on misrouted config', async () => {
      await expect(
        discordService.send({ service: 'slack', tokenA: 'a', tokenB: 'b', tokenC: 'c' }, { body: 'test' }),
      ).rejects.toThrow('Misrouted config: expected discord');
    });
  });
});
