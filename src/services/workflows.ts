/**
 * Microsoft Teams service via Power Automate (Workflows) webhooks.
 *
 * This is the successor to the legacy Office 365 / `outlook.webhook.office.com`
 * incoming connectors handled by the `msteams` service. Microsoft is retiring
 * those connectors in favour of the **Workflows** app (powered by Power Automate),
 * which issues webhook URLs of the form:
 *
 *   https://<env>.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/<id>/triggers/manual/paths/invoke?api-version=1&sp=...&sv=1.0&sig=...
 *
 * Older flows issue Logic Apps URLs instead:
 *
 *   https://<host>.logic.azure.com:443/workflows/<id>/triggers/manual/paths/invoke?api-version=2016-06-01&sp=...&sv=1.0&sig=...
 *
 * These URLs carry a cryptographic `sig` query parameter that must be preserved
 * byte-for-byte, so notifly stores the entire HTTPS URL by swapping the scheme:
 *
 *   workflows://<env>.environment.api.powerplatform.com/powerautomate/.../invoke?...&sig=...
 *
 * The `https` scheme is reconstructed at send time.
 *
 * Message format: the simple `{ "text": "..." }` payload, which the built-in
 * "Send webhook alerts to a channel" workflow template accepts and renders with
 * basic Markdown. See:
 *   https://learn.microsoft.com/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook#create-webhooks-using-workflows
 *
 * Also registered under the `workflow` scheme as an alias.
 */
import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';
import { errorMessage, validateHost } from '../security.js';

interface WorkflowsConfig extends ServiceConfig {
  service: 'workflows';
  webhookUrl: string;
}

class WorkflowsService extends BaseService implements ServiceDefinition {
  schemas = ['workflows', 'workflow'];

  parseUrl(url: URL): WorkflowsConfig {
    // workflows://<host>[:port]/<path>?<query>  →  https://<host>[:port]/<path>?<query>
    // url.host preserves an explicit port (Power Automate URLs often include :443).
    validateHost(url.hostname);
    const webhookUrl = `https://${url.host}${url.pathname}${url.search}`;
    return { service: 'workflows', webhookUrl };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    if (config.service !== 'workflows') {
      throw new Error('Misrouted config: expected workflows');
    }
    const { webhookUrl } = config as WorkflowsConfig;

    const text = message.title
      ? `**${message.title}**\n\n${message.body}`
      : message.body;

    try {
      await this.httpPost(webhookUrl, { text });
      return { success: true, service: 'workflows' };
    } catch (err) {
      return { success: false, service: 'workflows', error: errorMessage(err) };
    }
  }
}

export const workflowsService = new WorkflowsService();
