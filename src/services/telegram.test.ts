import { describe, it, expect, vi, afterEach } from 'vitest';
import { telegramService } from './telegram.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Telegram service', () => {
  describe('parseUrl', () => {
    it('parses bot token and chat id', () => {
      const url = new URL('tgram://mybot123/chatid456');
      const config = telegramService.parseUrl(url);
      expect(config).toEqual({ service: 'telegram', botToken: 'mybot123', chatId: 'chatid456' });
    });

    it('defaults to MarkdownV2 (no parseMode in config)', () => {
      const url = new URL('tgram://mybot123/chatid456');
      const config = telegramService.parseUrl(url);
      expect(config).not.toHaveProperty('parseMode');
    });

    it('supports explicit HTML parse_mode opt-in', () => {
      const url = new URL('tgram://mybot123/chatid456?parse_mode=HTML');
      const config = telegramService.parseUrl(url);
      expect(config).toHaveProperty('parseMode', 'HTML');
    });
  });

  describe('send', () => {
    it('posts message with MarkdownV2 by default', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await telegramService.send(
        { service: 'telegram', botToken: 'bot123', chatId: '456' },
        { body: 'Hello Telegram' },
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123/sendMessage',
        expect.objectContaining({ method: 'POST' }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.chat_id).toBe('456');
      expect(body.parse_mode).toBe('MarkdownV2');
    });

    it('escapes MarkdownV2 reserved chars in title and body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await telegramService.send(
        { service: 'telegram', botToken: 'bot', chatId: 'chat' },
        { title: 'Alert!', body: 'Check [this](link).' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // title should be bold-wrapped with escaped chars
      expect(body.text).toContain('*Alert\\!*');
      // body should have escaped brackets, parens, dots
      expect(body.text).toContain('Check \\[this\\]\\(link\\)\\.');
      expect(body.parse_mode).toBe('MarkdownV2');
    });

    it('wraps title in bold MarkdownV2 syntax', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await telegramService.send(
        { service: 'telegram', botToken: 'bot', chatId: 'chat' },
        { title: 'Alert', body: 'Body text' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toMatch(/^\*Alert\*\nBody text$/);
    });

    it('uses HTML parse_mode when explicitly opted in', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await telegramService.send(
        { service: 'telegram', botToken: 'bot', chatId: 'chat', parseMode: 'HTML' },
        { title: 'Alert', body: 'Body text' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toBe('<b>Alert</b>\nBody text');
      expect(body.parse_mode).toBe('HTML');
    });

    it('returns failure on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' }));
      const result = await telegramService.send(
        { service: 'telegram', botToken: 'bad', chatId: 'bad' },
        { body: 'Test' },
      );
      expect(result.success).toBe(false);
    });
  });
});
