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
  });

  describe('send', () => {
    it('posts message to telegram API', async () => {
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
      expect(body.parse_mode).toBe('HTML');
    });

    it('wraps title in HTML bold tags', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await telegramService.send(
        { service: 'telegram', botToken: 'bot', chatId: 'chat' },
        { title: 'Alert', body: 'Body text' },
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toBe('<b>Alert</b>\nBody text');
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
