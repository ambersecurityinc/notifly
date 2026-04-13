import { describe, it, expect } from 'vitest';
import { parseUrl } from './url-parser.js';
import { ParseError } from './errors.js';

describe('parseUrl', () => {
  it('parses discord URLs', () => {
    const config = parseUrl('discord://123456/abctoken');
    expect(config).toEqual({ service: 'discord', webhookId: '123456', webhookToken: 'abctoken' });
  });

  it('parses slack URLs', () => {
    const config = parseUrl('slack://tokenA/tokenB/tokenC/%23general');
    expect(config).toMatchObject({ service: 'slack', tokenA: 'tokenA', tokenB: 'tokenB', tokenC: 'tokenC' });
  });

  it('parses telegram URLs', () => {
    const config = parseUrl('tgram://bottoken123/chatid456');
    expect(config).toEqual({ service: 'telegram', botToken: 'bottoken123', chatId: 'chatid456' });
  });

  it('parses ntfy URLs (default host)', () => {
    const config = parseUrl('ntfy://mytopic');
    expect(config).toEqual({ service: 'ntfy', host: 'ntfy.sh', topic: 'mytopic' });
  });

  it('parses ntfy URLs (self-hosted)', () => {
    const config = parseUrl('ntfy://myserver.com/mytopic');
    expect(config).toEqual({ service: 'ntfy', host: 'myserver.com', topic: 'mytopic' });
  });

  it('parses gotify URLs', () => {
    const config = parseUrl('gotify://myserver.com/mytoken');
    expect(config).toEqual({ service: 'gotify', host: 'myserver.com', token: 'mytoken' });
  });

  it('throws ParseError for completely invalid URL', () => {
    expect(() => parseUrl('not-a-url')).toThrow(ParseError);
  });

  it('throws ParseError for unknown scheme', () => {
    expect(() => parseUrl('unknown://something')).toThrow(ParseError);
  });

  // M5: Error does not echo raw URL input
  it('does not echo raw URL in ParseError message', () => {
    try {
      parseUrl('not-a-url-with-secret-token');
    } catch (err) {
      expect((err as Error).message).toBe('Invalid URL format');
      expect((err as Error).message).not.toContain('secret');
    }
  });
});
