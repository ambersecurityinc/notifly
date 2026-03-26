import { describe, it, expect, vi, afterEach } from 'vitest';
import { gotifyService } from './gotify.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Gotify service', () => {
  describe('parseUrl', () => {
    it('parses host and token', () => {
      const url = new URL('gotify://myserver.com/mytoken');
      const config = gotifyService.parseUrl(url);
      expect(config).toEqual({ service: 'gotify', host: 'myserver.com', token: 'mytoken' });
    });
  });

  describe('send', () => {
    it('posts message to gotify API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await gotifyService.send(
        { service: 'gotify', host: 'myserver.com', token: 'abc123' },
        { title: 'Hello', body: 'World' },
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://myserver.com/message?token=abc123',
        expect.objectContaining({ method: 'POST' }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.title).toBe('Hello');
      expect(body.message).toBe('World');
    });

    it('sets higher priority for failure type', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await gotifyService.send(
        { service: 'gotify', host: 'server.com', token: 'tok' },
        { body: 'Critical', type: 'failure' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.priority).toBe(10);
    });

    it('returns failure on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' }));
      const result = await gotifyService.send(
        { service: 'gotify', host: 'server.com', token: 'bad' },
        { body: 'Test' },
      );
      expect(result.success).toBe(false);
    });
  });
});
