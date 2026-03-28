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

    // --- C3: CRLF injection ---
    it('sanitizes CRLF in title header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'topic' },
        { title: 'Injected\r\nX-Evil: value', body: 'body' },
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Title']).toBe('Injected X-Evil: value');
      expect(headers['Title']).not.toContain('\r');
      expect(headers['Title']).not.toContain('\n');
    });

    it('sanitizes lone \\n in title header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'topic' },
        { title: 'Line1\nLine2', body: 'body' },
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Title']).toBe('Line1 Line2');
    });

    it('passes clean titles through unchanged', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'topic' },
        { title: 'Normal Title', body: 'body' },
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Title']).toBe('Normal Title');
    });

    it('truncates title at 255 chars', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const longTitle = 'A'.repeat(300);
      await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'topic' },
        { title: longTitle, body: 'body' },
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Title']).toHaveLength(255);
    });

    // H5: SSRF validation
    it('blocks 127.0.0.1', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await ntfyService.send(
        { service: 'ntfy', host: '127.0.0.1', topic: 'topic' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not allowed/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks 10.0.0.1', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await ntfyService.send(
        { service: 'ntfy', host: '10.0.0.1', topic: 'topic' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks 192.168.1.1', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await ntfyService.send(
        { service: 'ntfy', host: '192.168.1.1', topic: 'topic' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks 169.254.169.254', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await ntfyService.send(
        { service: 'ntfy', host: '169.254.169.254', topic: 'topic' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks ::1', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      const result = await ntfyService.send(
        { service: 'ntfy', host: '::1', topic: 'topic' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    // M2: Timeout signal present
    it('passes AbortSignal.timeout to fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'topic' },
        { body: 'test' },
      );

      const init = mockFetch.mock.calls[0][1];
      expect(init.signal).toBeDefined();
    });

    // M6: Config guard
    it('throws on misrouted config', async () => {
      await expect(
        ntfyService.send({ service: 'discord', webhookId: 'x', webhookToken: 'y' }, { body: 'test' }),
      ).rejects.toThrow('Misrouted config: expected ntfy');
    });

    // L2: Non-Error thrown values handled
    it('handles non-Error thrown values gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('plain string error'));
      const result = await ntfyService.send(
        { service: 'ntfy', host: 'ntfy.sh', topic: 'topic' },
        { body: 'test' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('plain string error');
    });
  });
});
