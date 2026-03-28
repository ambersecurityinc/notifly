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
      const requestHeaders = init.headers;
      expect(requestHeaders['X-Gotify-Key']).toBe('abc123');
      const body = JSON.parse(init.body);
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

    it('does not expose token in error messages', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' }));
      const result = await gotifyService.send(
        { service: 'gotify', host: 'server.com', token: 'supersecrettoken' },
        { body: 'Test' },
      );
      expect(result.success).toBe(false);
      expect(result.error).not.toContain('supersecrettoken');
    });

    // H6: SSRF validation
    it('blocks 127.0.0.1', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await gotifyService.send(
        { service: 'gotify', host: '127.0.0.1', token: 'tok' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not allowed/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks 10.0.0.1', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await gotifyService.send(
        { service: 'gotify', host: '10.0.0.1', token: 'tok' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks 192.168.1.1', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await gotifyService.send(
        { service: 'gotify', host: '192.168.1.1', token: 'tok' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks 169.254.169.254', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await gotifyService.send(
        { service: 'gotify', host: '169.254.169.254', token: 'tok' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks ::1', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await gotifyService.send(
        { service: 'gotify', host: '::1', token: 'tok' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    // H1: Timeout via httpPost
    it('passes AbortSignal.timeout via httpPost', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await gotifyService.send(
        { service: 'gotify', host: 'server.com', token: 'tok' },
        { body: 'test' },
      );

      const init = mockFetch.mock.calls[0][1];
      expect(init.signal).toBeDefined();
    });

    // M6: Config guard
    it('throws on misrouted config', async () => {
      await expect(
        gotifyService.send({ service: 'slack', tokenA: 'a', tokenB: 'b', tokenC: 'c' }, { body: 'test' }),
      ).rejects.toThrow('Misrouted config: expected gotify');
    });

    // L2: Non-Error thrown values
    it('handles non-Error thrown values gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));
      const result = await gotifyService.send(
        { service: 'gotify', host: 'server.com', token: 'tok' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });
});
