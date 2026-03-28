/**
 * Microsoft Teams service via incoming webhooks.
 *
 * Teams webhook URLs have this structure:
 *   https://xxxxx.webhook.office.com/webhookb2/{GUID}@{TenantGUID}/IncomingWebhook/{channelId}/{webhookId}
 *
 * The GUID@TenantGUID part maps to user@host in the URL, so the notifly URL scheme is:
 *   msteams://GUID@TenantGUID/channelId/webhookId
 *
 * Example:
 *   msteams://abc123@tenant456/channelId/webhookId
 *
 * Also registered under the `teams` scheme as an alias.
 *
 * Message format: simple message card `{ "text": "..." }` which is broadly supported.
 */
import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';
import { errorMessage } from '../security.js';

interface MSTeamsConfig extends ServiceConfig {
  service: 'msteams';
  groupId: string;
  tenantId: string;
  channelId: string;
  webhookId: string;
}

class MSTeamsService extends BaseService implements ServiceDefinition {
  schemas = ['msteams', 'teams'];

  parseUrl(url: URL): MSTeamsConfig {
    // msteams://GUID@TenantGUID/channelId/webhookId
    // URL parser puts GUID in username and TenantGUID in hostname
    const groupId = decodeURIComponent(url.username) || url.hostname;
    const tenantId = url.username ? url.hostname : '';
    const parts = url.pathname.split('/').filter(Boolean);
    const channelId = parts[0] ?? '';
    const webhookId = parts[1] ?? '';
    return { service: 'msteams', groupId, tenantId, channelId, webhookId };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    if (config.service !== 'msteams') {
      throw new Error('Misrouted config: expected msteams');
    }
    const { groupId, tenantId, channelId, webhookId } = config as MSTeamsConfig;

    const webhookUrl = tenantId
      ? `https://outlook.webhook.office.com/webhookb2/${groupId}@${tenantId}/IncomingWebhook/${channelId}/${webhookId}`
      : `https://outlook.webhook.office.com/webhookb2/${groupId}/IncomingWebhook/${channelId}/${webhookId}`;

    const text = message.title
      ? `**${message.title}**\n\n${message.body}`
      : message.body;

    try {
      await this.httpPost(webhookUrl, { text });
      return { success: true, service: 'msteams' };
    } catch (err) {
      return { success: false, service: 'msteams', error: errorMessage(err) };
    }
  }
}

export const msteamsService = new MSTeamsService();
