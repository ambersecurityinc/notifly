import { describe, it, expect } from 'vitest';
import {
  validateHost,
  validateHeaderName,
  sanitizeHeaderValue,
  validateHttpMethod,
  escapeTelegramMarkdownV2,
  escapeTelegramHtml,
  truncate,
  enforceMessageLimits,
  validateEmail,
  errorMessage,
  MAX_TITLE_LENGTH,
  MAX_BODY_LENGTH,
} from './security.js';

describe('validateHost', () => {
  it('blocks 127.0.0.1', () => {
    expect(() => validateHost('127.0.0.1')).toThrow(/not allowed/);
  });

  it('blocks 127.0.0.2 (entire 127.0.0.0/8)', () => {
    expect(() => validateHost('127.0.0.2')).toThrow(/not allowed/);
  });

  it('blocks 0.0.0.0', () => {
    expect(() => validateHost('0.0.0.0')).toThrow(/not allowed/);
  });

  it('blocks 169.254.169.254 (cloud metadata)', () => {
    expect(() => validateHost('169.254.169.254')).toThrow(/not allowed/);
  });

  it('blocks 10.0.0.1 (RFC1918)', () => {
    expect(() => validateHost('10.0.0.1')).toThrow(/not allowed/);
  });

  it('blocks 172.16.0.1 (RFC1918)', () => {
    expect(() => validateHost('172.16.0.1')).toThrow(/not allowed/);
  });

  it('blocks 192.168.1.1 (RFC1918)', () => {
    expect(() => validateHost('192.168.1.1')).toThrow(/not allowed/);
  });

  it('blocks ::1 (IPv6 loopback)', () => {
    expect(() => validateHost('::1')).toThrow(/not allowed/);
  });

  it('blocks localhost', () => {
    expect(() => validateHost('localhost')).toThrow(/loopback/);
  });

  it('allows public hostnames', () => {
    expect(() => validateHost('example.com')).not.toThrow();
    expect(() => validateHost('ntfy.sh')).not.toThrow();
    expect(() => validateHost('8.8.8.8')).not.toThrow();
  });
});

describe('validateHeaderName', () => {
  it('rejects Host', () => {
    expect(() => validateHeaderName('Host')).toThrow(/Blocked header/);
  });

  it('rejects Authorization', () => {
    expect(() => validateHeaderName('Authorization')).toThrow(/Blocked header/);
  });

  it('rejects Cookie', () => {
    expect(() => validateHeaderName('Cookie')).toThrow(/Blocked header/);
  });

  it('rejects Set-Cookie', () => {
    expect(() => validateHeaderName('Set-Cookie')).toThrow(/Blocked header/);
  });

  it('rejects Transfer-Encoding', () => {
    expect(() => validateHeaderName('Transfer-Encoding')).toThrow(/Blocked header/);
  });

  it('rejects X-Forwarded-For', () => {
    expect(() => validateHeaderName('X-Forwarded-For')).toThrow(/Blocked header/);
  });

  it('rejects names with special characters', () => {
    expect(() => validateHeaderName('X Header')).toThrow(/disallowed characters/);
    expect(() => validateHeaderName('X:Header')).toThrow(/disallowed characters/);
    expect(() => validateHeaderName('X\nHeader')).toThrow(/disallowed characters/);
  });

  it('allows legitimate custom headers', () => {
    expect(() => validateHeaderName('X-Custom')).not.toThrow();
    expect(() => validateHeaderName('X-Request-Id')).not.toThrow();
    expect(() => validateHeaderName('Content-Type')).not.toThrow();
  });
});

describe('sanitizeHeaderValue', () => {
  it('strips \\r\\n sequences', () => {
    expect(sanitizeHeaderValue('hello\r\nworld')).toBe('hello world');
  });

  it('strips \\n alone', () => {
    expect(sanitizeHeaderValue('hello\nworld')).toBe('hello world');
  });

  it('strips \\r alone', () => {
    expect(sanitizeHeaderValue('hello\rworld')).toBe('hello world');
  });

  it('trims whitespace', () => {
    expect(sanitizeHeaderValue('  hello  ')).toBe('hello');
  });

  it('truncates to 255 chars by default', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeHeaderValue(long)).toHaveLength(255);
  });

  it('passes clean titles through unchanged', () => {
    expect(sanitizeHeaderValue('My Alert Title')).toBe('My Alert Title');
  });
});

describe('validateHttpMethod', () => {
  it('allows POST', () => {
    expect(validateHttpMethod('POST')).toBe('POST');
  });

  it('allows PUT', () => {
    expect(validateHttpMethod('put')).toBe('PUT');
  });

  it('allows GET', () => {
    expect(validateHttpMethod('get')).toBe('GET');
  });

  it('allows PATCH', () => {
    expect(validateHttpMethod('patch')).toBe('PATCH');
  });

  it('rejects DELETE', () => {
    expect(() => validateHttpMethod('DELETE')).toThrow(/not allowed/);
  });

  it('rejects CONNECT', () => {
    expect(() => validateHttpMethod('CONNECT')).toThrow(/not allowed/);
  });
});

describe('escapeTelegramMarkdownV2', () => {
  it('escapes all reserved characters', () => {
    expect(escapeTelegramMarkdownV2('_*[]()~`>#+-=|{}.!')).toBe(
      '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!',
    );
  });

  it('leaves normal text unchanged', () => {
    expect(escapeTelegramMarkdownV2('Hello World')).toBe('Hello World');
  });

  it('escapes backslashes', () => {
    expect(escapeTelegramMarkdownV2('back\\slash')).toBe('back\\\\slash');
  });
});

describe('escapeTelegramHtml', () => {
  it('escapes & < >', () => {
    expect(escapeTelegramHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('escapes <script> tags', () => {
    expect(escapeTelegramHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('leaves normal text unchanged', () => {
    expect(escapeTelegramHtml('Hello World')).toBe('Hello World');
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings with … suffix', () => {
    const result = truncate('a'.repeat(300), 256);
    expect(result).toHaveLength(256);
    expect(result.endsWith('\u2026')).toBe(true);
  });

  it('handles exact boundary', () => {
    const exact = 'a'.repeat(256);
    expect(truncate(exact, 256)).toBe(exact);
  });
});

describe('enforceMessageLimits', () => {
  it('truncates title > 256 chars', () => {
    const msg = enforceMessageLimits({ title: 'a'.repeat(300), body: 'short' });
    expect(msg.title!.length).toBe(MAX_TITLE_LENGTH);
    expect(msg.title!.endsWith('\u2026')).toBe(true);
  });

  it('truncates body > 65536 chars', () => {
    const msg = enforceMessageLimits({ body: 'b'.repeat(100_000) });
    expect(msg.body.length).toBe(MAX_BODY_LENGTH);
    expect(msg.body.endsWith('\u2026')).toBe(true);
  });

  it('passes through short messages unchanged', () => {
    const msg = enforceMessageLimits({ title: 'hello', body: 'world' });
    expect(msg).toEqual({ title: 'hello', body: 'world' });
  });

  it('returns undefined title when not provided', () => {
    const msg = enforceMessageLimits({ body: 'world' });
    expect(msg.title).toBeUndefined();
  });
});

describe('validateEmail', () => {
  it('accepts valid email addresses', () => {
    expect(() => validateEmail('user@example.com')).not.toThrow();
    expect(() => validateEmail('a@b.co')).not.toThrow();
  });

  it('rejects addresses without @', () => {
    expect(() => validateEmail('noatsign')).toThrow(/Invalid email/);
  });

  it('rejects addresses with double @', () => {
    expect(() => validateEmail('a@@b.com')).toThrow(/Invalid email/);
  });

  it('rejects addresses with spaces', () => {
    expect(() => validateEmail('a b@c.com')).toThrow(/Invalid email/);
  });

  it('rejects addresses without domain', () => {
    expect(() => validateEmail('a@')).toThrow(/Invalid email/);
  });
});

describe('errorMessage', () => {
  it('extracts message from Error objects', () => {
    expect(errorMessage(new Error('test'))).toBe('test');
  });

  it('converts strings to string', () => {
    expect(errorMessage('plain string')).toBe('plain string');
  });

  it('converts null to string', () => {
    expect(errorMessage(null)).toBe('null');
  });

  it('converts numbers to string', () => {
    expect(errorMessage(42)).toBe('42');
  });
});
