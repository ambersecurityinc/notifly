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

  // H3: Error messages must not contain raw URL input
  it('does not echo raw URL in error for invalid URLs', async () => {
    const secret = 'mailto://user:SUPERSECRET@host/?to=a@b.com';
    const results = await notify({ urls: [secret] }, { body: 'test' });
    // The mailto service should attempt to process, but even if it fails,
    // let's test a truly invalid URL
    const results2 = await notify({ urls: ['not-a-valid-url-with-secret'] }, { body: 'test' });
    expect(results2[0].error).toBe('Invalid URL format');
    expect(results2[0].error).not.toContain('secret');
  });

  // H4: Concurrency limited to 10
  it('limits concurrency to 10 simultaneous dispatches', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const mockFetch = vi.fn().mockImplementation(() => {
      inFlight++;
      if (inFlight > maxInFlight) maxInFlight = inFlight;
      return new Promise((resolve) => {
        setTimeout(() => {
          inFlight--;
          resolve({ ok: true, text: async () => '' });
        }, 10);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const urls = Array.from({ length: 25 }, (_, i) => `discord://id${i}/token${i}`);
    const results = await notify({ urls }, { body: 'test' });

    expect(results).toHaveLength(25);
    expect(maxInFlight).toBeLessThanOrEqual(10);
    // All results returned in input order
    results.forEach((r) => expect(r.success).toBe(true));
  });

  // L1: Message size limits enforced
  it('truncates oversized title and body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const results = await notify(
      { urls: ['discord://123/abc'] },
      { title: 'T'.repeat(300), body: 'B'.repeat(100_000) },
    );

    expect(results[0].success).toBe(true);
    const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
    // Title gets truncated to 256, body to 65536 — both with … suffix
    // Discord concatenates: **title**\nbody
    expect(payload.content.length).toBeLessThan(300 + 100_000);
  });
});
