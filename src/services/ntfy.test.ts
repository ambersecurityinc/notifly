import { describe, it, expect, vi, afterEach } from 'vitest';
import { ntfyService } from './ntfy.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ntfy service', () => {
  describe('parseUrl', () => {
    it('uses ntfy.sh as default host', () => {
      const url = new URL('ntfy://mytopic');
      const config = ntfyService.parseUrl(url);
      expect(config).toEqual({ service: 'ntfy', host: 'ntfy.sh', topic: 'mytopic' });
    });

    it('uses custom host for self-hosted', () => {
      const url = new URL('ntfy://myserver.com/mytopic');
      const config = ntfyService.parseUrl(url);
      expect(config).toEqual({ service: 'ntfy', host: 'myserver.com', topic: 'mytopic' });
    });
  });

  describe('send', () => {
    it('posts plain text to ntfy.sh', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'mytopic' },
        { body: 'Hello ntfy' },
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://ntfy.sh/mytopic',
        expect.objectContaining({ method: 'POST', body: 'Hello ntfy' }),
      );
    });

    it('sets Title header when title provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'topic' },
        { title: 'My Title', body: 'body' },
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Title']).toBe('My Title');
    });

    it('sets Priority and Tags for failure type', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'topic' },
        { body: 'Broken!', type: 'failure' },
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Priority']).toBe('5');
      expect(headers['Tags']).toBe('x');
    });

    it('returns failure on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'Too Many Requests' }));
      const result = await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'topic' },
        { body: 'Test' },
      );
      expect(result.success).toBe(false);
    });
  });
});
