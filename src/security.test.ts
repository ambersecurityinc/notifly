import { describe, it, expect } from 'vitest';
import {
  validateHost,
  validateHeaderName,
  sanitizeHeaderValue,
  validateHttpMethod,
  escapeTelegramMarkdownV2,
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
