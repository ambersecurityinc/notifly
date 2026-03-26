import { describe, it, expect, vi, afterEach } from 'vitest';
import { notify } from './dispatcher.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('notify()', () => {
  it('returns results for all URLs without throwing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', mockFetch);

    const results = await notify(
      { urls: ['discord://123/abc', 'invalid-url', 'unknown://foo'] },
      { body: 'Hello' },
    );

    expect(results).toHaveLength(3);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(false);
    expect(results[2]?.success).toBe(false);
  });

  it('returns partial results when one service fails', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('discord.com')) {
        return Promise.resolve({ ok: false, status: 500, text: async () => 'error' });
      }
      return Promise.resolve({ ok: true, text: async () => '' });
    });
    vi.stubGlobal('fetch', mockFetch);

    const results = await notify(
      { urls: ['discord://123/abc', 'tgram://bottoken/chatid'] },
      { body: 'Test' },
    );

    expect(results).toHaveLength(2);
    const discordResult = results.find((r) => r.service === 'discord');
    const telegramResult = results.find((r) => r.service === 'telegram');
    expect(discordResult?.success).toBe(false);
    expect(telegramResult?.success).toBe(true);
  });

  it('returns empty array for empty urls', async () => {
    const results = await notify({ urls: [] }, { body: 'test' });
    expect(results).toHaveLength(0);
  });
});
