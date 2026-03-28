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
    it('posts message to gotify API with token in header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await gotifyService.send(
        { service: 'gotify', host: 'myserver.com', token: 'abc123' },
        { title: 'Hello', body: 'World' },
      );

      expect(result.success).toBe(true);
      const [url, init] = mockFetch.mock.calls[0];
      // C4: Token must NOT be in the URL
      expect(url).toBe('https://myserver.com/message');
      expect(url).not.toContain('token=');
      expect(url).not.toContain('abc123');
      // C4: Token must be in X-Gotify-Key header
      const headers = JSON.parse(init.body);
      const requestHeaders = init.headers;
      expect(requestHeaders['X-Gotify-Key']).toBe('abc123');
      expect(headers.title).toBe('Hello');
      expect(headers.message).toBe('World');
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

    it('does not expose token in error messages', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' }));
      const result = await gotifyService.send(
        { service: 'gotify', host: 'server.com', token: 'supersecrettoken' },
        { body: 'Test' },
      );
      expect(result.success).toBe(false);
      // The error message should not contain the token
      expect(result.error).not.toContain('supersecrettoken');
    });
  });
});
