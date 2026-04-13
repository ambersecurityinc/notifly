import { describe, it, expect, vi, afterEach } from 'vitest';
import { slackService } from './slack.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Slack service', () => {
  describe('parseUrl', () => {
    it('parses three tokens and channel', () => {
      const url = new URL('slack://tokenA/tokenB/tokenC/%23general');
      const config = slackService.parseUrl(url);
      expect(config).toMatchObject({ service: 'slack', tokenA: 'tokenA', tokenB: 'tokenB', tokenC: 'tokenC', channel: '#general' });
    });

    it('parses URL without channel', () => {
      const url = new URL('slack://tokenA/tokenB/tokenC');
      const config = slackService.parseUrl(url);
      expect(config).toMatchObject({ service: 'slack', tokenA: 'tokenA', tokenB: 'tokenB', tokenC: 'tokenC' });
      expect(config.channel).toBeUndefined();
    });
  });

  describe('send', () => {
    it('posts text to slack webhook', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await slackService.send(
        { service: 'slack', tokenA: 'a', tokenB: 'b', tokenC: 'c' },
        { body: 'Hello Slack' },
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/a/b/c',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes channel when set', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await slackService.send(
        { service: 'slack', tokenA: 'a', tokenB: 'b', tokenC: 'c', channel: '#general' },
        { body: 'Test' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.channel).toBe('#general');
    });

    it('returns failure on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' }));
      const result = await slackService.send(
        { service: 'slack', tokenA: 'a', tokenB: 'b', tokenC: 'c' },
        { body: 'Test' },
      );
      expect(result.success).toBe(false);
    });

    // M6: Config guard
    it('throws on misrouted config', async () => {
      await expect(
        slackService.send({ service: 'discord', webhookId: 'x', webhookToken: 'y' }, { body: 'test' }),
      ).rejects.toThrow('Misrouted config: expected slack');
    });
  });
});
