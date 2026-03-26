import type { ServiceDefinition } from '../types.js';
import { discordService } from './discord.js';
import { slackService } from './slack.js';
import { telegramService } from './telegram.js';
import { ntfyService } from './ntfy.js';
import { gotifyService } from './gotify.js';

const registry = new Map<string, ServiceDefinition>();

function registerService(service: ServiceDefinition): void {
  for (const schema of service.schemas) {
    registry.set(schema, service);
  }
}

function getService(schema: string): ServiceDefinition | undefined {
  return registry.get(schema);
}

// Register built-in services
registerService(discordService);
registerService(slackService);
registerService(telegramService);
registerService(ntfyService);
registerService(gotifyService);

export { registerService, getService, registry };
