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
 * ## Payload format
 *
 * Teams Workflows templates disagree on what the request body must look like,
 * depending on how the flow's "Post card in a chat or channel" action binds its
 * input. notifly supports all three via a `#format=` URL fragment (kept in the
 * fragment so it never touches the signed query string, and is never sent over
 * the wire by `fetch`):
 *
 *   - `card` (default) — a bare Adaptive Card `{ "type": "AdaptiveCard", ... }`.
 *     Required by flows that bind the whole trigger body directly into the
 *     "Post card" action (the flowbot deserializes the body as an Adaptive Card
 *     and rejects anything without top-level `type: "AdaptiveCard"`).
 *   - `message` — the Bot Framework activity envelope
 *     `{ "type": "message", "attachments": [{ contentType, content: <card> }] }`,
 *     for flows that read `triggerBody()?['attachments']`.
 *   - `text` — the simple `{ "text": "..." }` payload accepted by the basic
 *     "Send webhook alerts to a channel" template.
 *
 * Adaptive Card reference:
 *   https://learn.microsoft.com/en-us/connectors/teams/#microsoft-teams-webhook
 *
 * Also registered under the `workflow` scheme as an alias.
 */
import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';
import { errorMessage, validateHost } from '../security.js';

export type WorkflowsFormat = 'card' | 'message' | 'text';

const ADAPTIVE_CARD_SCHEMA = 'http://adaptivecards.io/schemas/adaptive-card.json';
const ADAPTIVE_CARD_VERSION = '1.5';
const ADAPTIVE_CARD_CONTENT_TYPE = 'application/vnd.microsoft.card.adaptive';

/** Map a notifly message type to an Adaptive Card TextBlock colour. */
const TYPE_COLORS: Record<string, string> = {
  success: 'Good',
  warning: 'Warning',
  failure: 'Attention',
};

interface WorkflowsConfig extends ServiceConfig {
  service: 'workflows';
  webhookUrl: string;
  format: WorkflowsFormat;
}

function parseFormat(hash: string): WorkflowsFormat {
  // hash is like "#format=message" (or empty)
  const raw = hash.replace(/^#/, '');
  if (!raw) return 'card';
  const params = new URLSearchParams(raw);
  const value = (params.get('format') ?? '').toLowerCase();
  if (value === 'message' || value === 'text' || value === 'card') return value;
  return 'card';
}

/** Build a bare Adaptive Card from a notifly message. */
function buildAdaptiveCard(message: NotiflyMessage): Record<string, unknown> {
  const body: Array<Record<string, unknown>> = [];
  const color = message.type ? TYPE_COLORS[message.type] : undefined;

  if (message.title) {
    body.push({
      type: 'TextBlock',
      text: message.title,
      weight: 'Bolder',
      size: 'Medium',
      wrap: true,
      ...(color ? { color } : {}),
    });
  }
  body.push({
    type: 'TextBlock',
    text: message.body,
    wrap: true,
    // Colour the body line too when there is no title to carry it.
    ...(!message.title && color ? { color } : {}),
  });

  return {
    type: 'AdaptiveCard',
    $schema: ADAPTIVE_CARD_SCHEMA,
    version: ADAPTIVE_CARD_VERSION,
    body,
  };
}

/** Build the request payload for the configured format. */
export function buildWorkflowsPayload(message: NotiflyMessage, format: WorkflowsFormat): unknown {
  if (format === 'text') {
    const text = message.title ? `**${message.title}**\n\n${message.body}` : message.body;
    return { text };
  }

  const card = buildAdaptiveCard(message);
  if (format === 'message') {
    return {
      type: 'message',
      attachments: [{ contentType: ADAPTIVE_CARD_CONTENT_TYPE, content: card }],
    };
  }
  // 'card' (default) — the bare Adaptive Card.
  return card;
}

class WorkflowsService extends BaseService implements ServiceDefinition {
  schemas = ['workflows', 'workflow'];

  parseUrl(url: URL): WorkflowsConfig {
    // workflows://<host>[:port]/<path>?<query>[#format=...]  →  https://<host>[:port]/<path>?<query>
    // url.host preserves an explicit port (Power Automate URLs often include :443).
    // The `#format=` fragment selects the payload shape and is never sent to the server.
    validateHost(url.hostname);
    const webhookUrl = `https://${url.host}${url.pathname}${url.search}`;
    return { service: 'workflows', webhookUrl, format: parseFormat(url.hash) };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    if (config.service !== 'workflows') {
      throw new Error('Misrouted config: expected workflows');
    }
    const { webhookUrl, format } = config as WorkflowsConfig;

    try {
      await this.httpPost(webhookUrl, buildWorkflowsPayload(message, format ?? 'card'));
      return { success: true, service: 'workflows' };
    } catch (err) {
      return { success: false, service: 'workflows', error: errorMessage(err) };
    }
  }
}

export const workflowsService = new WorkflowsService();
