import { describe, it, expect, vi, afterEach } from 'vitest';
import { webhookService } from './webhook.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Webhook service', () => {
  describe('parseUrl', () => {
    it('parses jsons:// as HTTPS JSON endpoint', () => {
      const url = new URL('jsons://example.com/notify');
      const config = webhookService.parseUrl(url);
      expect(config).toMatchObject({ targetUrl: 'https://example.com/notify', isJson: true });
    });

    it('parses forms:// as HTTPS form-encoded endpoint', () => {
      const url = new URL('forms://example.com/hook');
      const config = webhookService.parseUrl(url);
      expect(config).toMatchObject({ targetUrl: 'https://example.com/hook', isJson: false });
    });

    it('extracts custom headers from + prefixed params', () => {
      const url = new URL('jsons://example.com/hook?+X-Custom=value&+X-Other=test');
      const config = webhookService.parseUrl(url);
      expect(config.extraHeaders).toEqual({ 'X-Custom': 'value', 'X-Other': 'test' });
    });

    it('extracts extra body fields from - prefixed params', () => {
      const url = new URL('jsons://example.com/hook?-source=myapp&-version=2');
      const config = webhookService.parseUrl(url);
      expect(config.extraFields).toEqual({ source: 'myapp', version: '2' });
    });

    it('extracts method override from method param', () => {
      const url = new URL('jsons://example.com/hook?method=PUT');
      const config = webhookService.parseUrl(url);
      expect(config.method).toBe('PUT');
    });

    it('registers all four schemes', () => {
      expect(webhookService.schemas).toEqual(expect.arrayContaining(['json', 'jsons', 'form', 'forms']));
    });

    // --- C1: SSRF protection ---
    it('blocks json:// (insecure scheme)', () => {
      const url = new URL('json://example.com/notify');
      expect(() => webhookService.parseUrl(url)).toThrow(/Insecure scheme/);
    });

    it('blocks form:// (insecure scheme)', () => {
      const url = new URL('form://example.com/hook');
      expect(() => webhookService.parseUrl(url)).toThrow(/Insecure scheme/);
    });

    it('blocks 127.0.0.1 (loopback)', () => {
      const url = new URL('jsons://127.0.0.1/hook');
      expect(() => webhookService.parseUrl(url)).toThrow(/not allowed/);
    });

    it('blocks 0.0.0.0', () => {
      const url = new URL('jsons://0.0.0.0/hook');
      expect(() => webhookService.parseUrl(url)).toThrow(/not allowed/);
    });

    it('blocks 169.254.169.254 (cloud metadata)', () => {
      const url = new URL('jsons://169.254.169.254/latest/meta-data');
      expect(() => webhookService.parseUrl(url)).toThrow(/not allowed/);
    });

    it('blocks 10.0.0.1 (RFC1918)', () => {
      const url = new URL('jsons://10.0.0.1/hook');
      expect(() => webhookService.parseUrl(url)).toThrow(/not allowed/);
    });

    it('blocks 192.168.1.1 (RFC1918)', () => {
      const url = new URL('jsons://192.168.1.1/hook');
      expect(() => webhookService.parseUrl(url)).toThrow(/not allowed/);
    });

    it('blocks ::1 (IPv6 loopback)', () => {
      const url = new URL('jsons://[::1]/hook');
      expect(() => webhookService.parseUrl(url)).toThrow(/not allowed/);
    });

    it('SSRF error does not contain the raw URL', () => {
      try {
        const url = new URL('jsons://10.0.0.1/secret-path?token=abc');
        webhookService.parseUrl(url);
      } catch (err) {
        const msg = (err as Error).message;
        expect(msg).not.toContain('10.0.0.1');
        expect(msg).not.toContain('secret-path');
        expect(msg).not.toContain('token=abc');
      }
    });

    it('allows legitimate HTTPS public hosts', () => {
      const url = new URL('jsons://example.com/webhook');
      expect(() => webhookService.parseUrl(url)).not.toThrow();
    });

    // --- C2: Header injection ---
    it('rejects Host header override via + params', () => {
      const url = new URL('jsons://example.com/hook?+Host=evil.com');
      expect(() => webhookService.parseUrl(url)).toThrow(/Blocked header/);
    });

    it('rejects Authorization header override via + params', () => {
      const url = new URL('jsons://example.com/hook?+Authorization=Bearer+token');
      expect(() => webhookService.parseUrl(url)).toThrow(/Blocked header/);
    });

    it('rejects Cookie header override via + params', () => {
      const url = new URL('jsons://example.com/hook?+Cookie=session=abc');
      expect(() => webhookService.parseUrl(url)).toThrow(/Blocked header/);
    });

    it('rejects header names with special characters', () => {
      const url = new URL('jsons://example.com/hook?+X%20Bad=val');
      expect(() => webhookService.parseUrl(url)).toThrow(/disallowed characters/);
    });

    it('allows legitimate custom headers', () => {
      const url = new URL('jsons://example.com/hook?+X-Custom=value');
      const config = webhookService.parseUrl(url);
      expect(config.extraHeaders['X-Custom']).toBe('value');
    });

    // --- H4: Method restriction ---
    it('rejects DELETE method', () => {
      const url = new URL('jsons://example.com/hook?method=DELETE');
      expect(() => webhookService.parseUrl(url)).toThrow(/not allowed/);
    });

    it('rejects CONNECT method', () => {
      const url = new URL('jsons://example.com/hook?method=CONNECT');
      expect(() => webhookService.parseUrl(url)).toThrow(/not allowed/);
    });

    // --- L6: Malformed percent-encoding ---
    it('throws descriptive error for malformed percent-encoding in key', () => {
      const url = new URL('jsons://example.com/hook');
      // Manually set a bad search string
      Object.defineProperty(url, 'search', { value: '?%ZZ=value' });
      expect(() => webhookService.parseUrl(url)).toThrow(/Malformed percent-encoding/);
    });

    it('throws descriptive error for malformed percent-encoding in value', () => {
      const url = new URL('jsons://example.com/hook');
      Object.defineProperty(url, 'search', { value: '?key=%ZZ' });
      expect(() => webhookService.parseUrl(url)).toThrow(/Malformed percent-encoding/);
    });
  });

  describe('send', () => {
    it('POSTs JSON body to target URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await webhookService.send(
        { service: 'webhook', targetUrl: 'https://example.com/hook', isJson: true, method: 'POST', extraHeaders: {}, extraFields: {} },
        { title: 'Alert', body: 'Something happened', type: 'warning' },
      );

      expect(result.success).toBe(true);
      expect(result.service).toBe('webhook');
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://example.com/hook');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');
      const body = JSON.parse(init.body);
      expect(body).toEqual({ title: 'Alert', body: 'Something happened', type: 'warning' });
    });

    it('POSTs form-encoded body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await webhookService.send(
        { service: 'webhook', targetUrl: 'https://example.com/hook', isJson: false, method: 'POST', extraHeaders: {}, extraFields: {} },
        { body: 'Hello' },
      );

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(init.body).toContain('body=Hello');
    });

    it('includes custom headers in request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await webhookService.send(
        { service: 'webhook', targetUrl: 'https://example.com/hook', isJson: true, method: 'POST', extraHeaders: { 'X-Custom': 'xyz' }, extraFields: {} },
        { body: 'Hi' },
      );

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['X-Custom']).toBe('xyz');
    });

    it('merges extra fields into JSON body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await webhookService.send(
        { service: 'webhook', targetUrl: 'https://example.com/hook', isJson: true, method: 'POST', extraHeaders: {}, extraFields: { source: 'myapp' } },
        { body: 'Hi' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.source).toBe('myapp');
    });

    it('uses method override', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await webhookService.send(
        { service: 'webhook', targetUrl: 'https://example.com/hook', isJson: true, method: 'PUT', extraHeaders: {}, extraFields: {} },
        { body: 'Hi' },
      );

      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe('PUT');
    });

    it('returns failure result on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'Not Found' }));

      const result = await webhookService.send(
        { service: 'webhook', targetUrl: 'https://example.com/missing', isJson: true, method: 'POST', extraHeaders: {}, extraFields: {} },
        { body: 'Test' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    // H2: Error message must not contain URL
    it('does not leak URL in error messages on HTTP failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' }));

      const result = await webhookService.send(
        { service: 'webhook', targetUrl: 'https://secret.example.com/path?key=abc', isJson: true, method: 'POST', extraHeaders: {}, extraFields: {} },
        { body: 'Test' },
      );

      expect(result.success).toBe(false);
      expect(result.error).not.toContain('secret.example.com');
      expect(result.error).not.toContain('key=abc');
    });

    // M1: fetch has AbortSignal.timeout
    it('passes AbortSignal.timeout to fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await webhookService.send(
        { service: 'webhook', targetUrl: 'https://example.com/hook', isJson: true, method: 'POST', extraHeaders: {}, extraFields: {} },
        { body: 'Hi' },
      );

      const init = mockFetch.mock.calls[0][1];
      expect(init.signal).toBeDefined();
    });

    // M6: Config guard
    it('throws on misrouted config', async () => {
      await expect(
        webhookService.send({ service: 'discord', webhookId: 'x', webhookToken: 'y' }, { body: 'test' }),
      ).rejects.toThrow('Misrouted config: expected webhook');
    });

    // M8: Base fields take precedence over extraFields
    it('does not allow extraFields to override message body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await webhookService.send(
        { service: 'webhook', targetUrl: 'https://example.com/hook', isJson: true, method: 'POST', extraHeaders: {}, extraFields: { body: 'injected' } },
        { body: 'real message' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.body).toBe('real message');
    });
  });
});
