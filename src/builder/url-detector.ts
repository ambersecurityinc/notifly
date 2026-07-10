import { decomposeUrl } from './url-decomposer.js';
import { buildUrl } from './url-builder.js';

export interface DetectResult {
  service: string;
  notiflyUrl: string;
  fields: Record<string, string>;
}

/**
 * Detect a known service from a raw provider URL and convert it to a notifly Apprise URL.
 *
 * Supports pasting URLs directly from service configuration pages:
 *   - Discord:  https://discord.com/api/webhooks/{id}/{token}
 *   - Slack:    https://hooks.slack.com/services/{a}/{b}/{c}
 *   - Teams:    https://*.webhook.office.com/webhookb2/{...}/IncomingWebhook/{b}/{c}
 *   - Teams (Workflows): https://*.../triggers/manual/paths/invoke?...&sig=... (Power Automate)
 *   - Telegram: https://api.telegram.org/bot{token}/...  (chat_id is left empty — fill it in)
 *   - ntfy:     https://ntfy.sh/{topic}
 *   - Gotify:   https://{host}/message?token={token}
 *
 * Returns null if the URL does not match any known pattern.
 */
export function detectAndConvert(rawUrl: string): DetectResult | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Only handle http/https — Apprise URLs use custom schemes and are handled by decomposeUrl
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  // ── Discord ────────────────────────────────────────────────────────────────
  // https://discord.com/api/webhooks/{webhook_id}/{webhook_token}
  if (host === 'discord.com' || host === 'discordapp.com') {
    const m = path.match(/^\/api\/webhooks\/(\d+)\/([^/?#]+)/);
    if (m) {
      const webhook_id = m[1];
      const webhook_token = m[2];
      return {
        service: 'discord',
        notiflyUrl: `discord://${webhook_id}/${webhook_token}`,
        fields: { webhook_id, webhook_token },
      };
    }
  }

  // ── Slack ──────────────────────────────────────────────────────────────────
  // https://hooks.slack.com/services/{token_a}/{token_b}/{token_c}
  if (host === 'hooks.slack.com') {
    const m = path.match(/^\/services\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)/);
    if (m) {
      const token_a = m[1];
      const token_b = m[2];
      const token_c = m[3];
      return {
        service: 'slack',
        notiflyUrl: `slack://${token_a}/${token_b}/${token_c}`,
        fields: { token_a, token_b, token_c },
      };
    }
  }

  // ── Microsoft Teams ────────────────────────────────────────────────────────
  // https://*.webhook.office.com/webhookb2/{groupId[@tenantId]}/IncomingWebhook/{channelId}/{webhookId}
  if (host.endsWith('.webhook.office.com')) {
    const m = path.match(/^\/webhookb2\/([^/?#]+)\/IncomingWebhook\/([^/?#]+)\/([^/?#]+)/);
    if (m) {
      const tokenA = decodeURIComponent(m[1]); // may be GUID@TenantGUID
      const channel_id = m[2];
      const webhook_id = m[3];

      const atIdx = tokenA.indexOf('@');
      const hasAt = atIdx !== -1;
      const group_id = hasAt ? tokenA.slice(0, atIdx) : tokenA;
      const tenant_id = hasAt ? tokenA.slice(atIdx + 1) : '';

      // Build notifly URL: msteams://groupId@tenantId/channelId/webhookId
      const host_part = hasAt ? `${group_id}@${tenant_id}` : group_id;
      const notiflyUrl = `msteams://${host_part}/${channel_id}/${webhook_id}`;

      const fields: Record<string, string> = { group_id, channel_id, webhook_id };
      if (tenant_id) fields['tenant_id'] = tenant_id;

      return { service: 'msteams', notiflyUrl, fields };
    }
  }

  // ── Microsoft Teams (Workflows / Power Automate) ─────────────────────────────
  // https://<env>.environment.api.powerplatform.com/powerautomate/.../triggers/manual/paths/invoke?...&sig=...
  // https://<host>.logic.azure.com:443/workflows/.../triggers/manual/paths/invoke?...&sig=...
  // These carry a `sig` token in the query string and must be preserved verbatim,
  // so the whole HTTPS URL is stored by swapping https → workflows.
  if (path.endsWith('/triggers/manual/paths/invoke') && url.searchParams.has('sig')) {
    const notiflyUrl = rawUrl.replace(/^https?:\/\//i, 'workflows://');
    return {
      service: 'workflows',
      notiflyUrl,
      fields: { webhook_url: rawUrl },
    };
  }

  // ── Telegram ───────────────────────────────────────────────────────────────
  // https://api.telegram.org/bot{bot_token}/...
  // chat_id cannot be derived from this URL — returned as empty string for the caller to fill in
  if (host === 'api.telegram.org') {
    const m = path.match(/^\/bot([^/?#/]+)/);
    if (m) {
      const bot_token = m[1];
      return {
        service: 'telegram',
        notiflyUrl: `tgram://${bot_token}/`,
        fields: { bot_token, chat_id: '' },
      };
    }
  }

  // ── ntfy ───────────────────────────────────────────────────────────────────
  // https://ntfy.sh/{topic}  — public server
  if (host === 'ntfy.sh') {
    const topic = path.slice(1).split('/')[0];
    if (topic) {
      return {
        service: 'ntfy',
        notiflyUrl: `ntfy://${topic}`,
        fields: { topic, host: 'ntfy.sh' },
      };
    }
  }

  // ── Gotify ─────────────────────────────────────────────────────────────────
  // https://{host}/message?token={token}
  if (path === '/message' && url.searchParams.has('token')) {
    const token = url.searchParams.get('token') as string;
    return {
      service: 'gotify',
      notiflyUrl: `gotify://${host}/${token}`,
      fields: { host, token },
    };
  }

  return null;
}

/**
 * Returns true if the string looks like a raw service provider URL (http/https)
 * rather than an Apprise-format notifly URL (custom scheme like discord://).
 */
export function isRawServiceUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Parse any URL string — either a raw provider URL or an existing Apprise/notifly URL —
 * and return a normalised DetectResult. This is the "paste anything" function for UIs.
 *
 * Order of operations:
 *   1. Try detectAndConvert() for raw https:// provider URLs
 *   2. Fall back to decomposeUrl() for existing discord://, slack://, etc. URLs
 *   3. Return null if neither matches
 */
export function smartParse(input: string): DetectResult | null {
  // Step 1 — raw provider URL (https://discord.com/api/webhooks/…, etc.)
  const detected = detectAndConvert(input);
  if (detected) return detected;

  // Step 2 — existing Apprise URL (discord://…, slack://…, etc.)
  const decomposed = decomposeUrl(input);
  if (decomposed.service === 'unknown') return null;

  // Convert fields to Record<string, string>
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(decomposed.fields)) {
    fields[k] = String(v);
  }

  // Rebuild the canonical URL so we always return a clean notifly URL
  const { url: notiflyUrl } = buildUrl(decomposed.service, decomposed.fields);

  return {
    service: decomposed.service,
    notiflyUrl: notiflyUrl || input,
    fields,
  };
}
