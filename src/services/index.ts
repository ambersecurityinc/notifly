import type { ServiceDefinition } from '../types.js';
import { discordService } from './discord.js';
import { slackService } from './slack.js';
import { telegramService } from './telegram.js';
import { ntfyService } from './ntfy.js';
import { gotifyService } from './gotify.js';
import { emailService } from './email.js';
import { msteamsService } from './msteams.js';
import { workflowsService } from './workflows.js';
import { pushoverService } from './pushover.js';
import { pushbulletService } from './pushbullet.js';
import { webhookService } from './webhook.js';

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
registerService(emailService);
registerService(msteamsService);
registerService(workflowsService);
registerService(pushoverService);
registerService(pushbulletService);
registerService(webhookService);

export { registerService, getService, registry };
