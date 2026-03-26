import { describe, it, expect } from 'vitest';
import { registry, registerService, getService } from './index.js';
import type { ServiceDefinition, ServiceConfig, NotiflyMessage, NotiflyResult } from '../types.js';

describe('Service registry', () => {
  it('has all built-in services registered', () => {
    expect(getService('discord')).toBeDefined();
    expect(getService('slack')).toBeDefined();
    expect(getService('tgram')).toBeDefined();
    expect(getService('ntfy')).toBeDefined();
    expect(getService('gotify')).toBeDefined();
  });

  it('returns undefined for unknown schema', () => {
    expect(getService('unknown-xyz')).toBeUndefined();
  });

  it('allows registering a custom service', () => {
    const customService: ServiceDefinition = {
      schemas: ['myservice'],
      parseUrl: (url: URL): ServiceConfig => ({ service: 'myservice', host: url.hostname }),
      send: async (_config: ServiceConfig, _message: NotiflyMessage): Promise<NotiflyResult> => ({
        success: true,
        service: 'myservice',
      }),
    };

    registerService(customService);
    expect(getService('myservice')).toBe(customService);
  });

  it('overwrites existing service when duplicate schema registered', async () => {
    const replacement: ServiceDefinition = {
      schemas: ['discord'],
      parseUrl: (url: URL): ServiceConfig => ({ service: 'discord-replacement', host: url.hostname }),
      send: async (_config: ServiceConfig, _message: NotiflyMessage): Promise<NotiflyResult> => ({
        success: true,
        service: 'discord-replacement',
      }),
    };

    registerService(replacement);
    expect(getService('discord')).toBe(replacement);

    // Restore the original discord service
    const { discordService } = await import('./discord.js');
    registerService(discordService);
  });
});
