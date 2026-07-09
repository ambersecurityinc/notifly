import type { BuildUrlResult, DecomposeResult } from './types.js';
import { SERVICE_SCHEMAS } from './schemas.js';
import { validateFields } from './validate.js';

type Fields = Record<string, string | number | boolean>;

function buildDiscordUrl(fields: Fields): string {
  return `discord://${fields['webhook_id']}/${fields['webhook_token']}`;
}

function buildSlackUrl(fields: Fields): string {
  const base = `slack://${fields['token_a']}/${fields['token_b']}/${fields['token_c']}`;
  if (fields['channel']) {
    const encoded = encodeURIComponent(String(fields['channel']));
    return `${base}/${encoded}`;
  }
  return base;
}

function buildTelegramUrl(fields: Fields): string {
  return `tgram://${fields['bot_token']}/${fields['chat_id']}`;
}

function buildNtfyUrl(fields: Fields): string {
  const host = fields['host'] ? String(fields['host']) : 'ntfy.sh';
  const topic = String(fields['topic']);
  if (host === 'ntfy.sh' || !fields['host']) {
    return `ntfy://${topic}`;
  }
  return `ntfy://${host}/${topic}`;
}

function buildGotifyUrl(fields: Fields): string {
  return `gotify://${fields['host']}/${fields['token']}`;
}

function buildEmailUrl(fields: Fields): string {
  const user = fields['user'] ? String(fields['user']) : 'noreply';
  const apiKey = fields['api_key'] ? encodeURIComponent(String(fields['api_key'])) : '';
  const host = fields['host'] ? String(fields['host']) : 'example.com';
  const params = new URLSearchParams();
  params.set('to', String(fields['to']));
  params.set('gateway', String(fields['gateway']));
  if (fields['from']) params.set('from', String(fields['from']));
  if (fields['cc']) params.set('cc', String(fields['cc']));
  if (fields['bcc']) params.set('bcc', String(fields['bcc']));
  const credentials = apiKey ? `${encodeURIComponent(user)}:${apiKey}@` : `${encodeURIComponent(user)}@`;
  return `mailto://${credentials}${host}/?${params.toString()}`;
}

function buildMSTeamsUrl(fields: Fields): string {
  const groupId = String(fields['group_id']);
  const tenantId = fields['tenant_id'] ? String(fields['tenant_id']) : '';
  const channelId = String(fields['channel_id']);
  const webhookId = String(fields['webhook_id']);
  const host = tenantId ? `${groupId}@${tenantId}` : groupId;
  return `msteams://${host}/${channelId}/${webhookId}`;
}

function buildWorkflowsUrl(fields: Fields): string {
  // Store the full HTTPS webhook URL by swapping the scheme; the sig token and
  // all other query params are preserved verbatim.
  const raw = String(fields['webhook_url']).trim();
  return raw.replace(/^https?:\/\//i, 'workflows://');
}

function buildPushoverUrl(fields: Fields): string {
  const base = `pover://${fields['user_key']}/${fields['api_token']}`;
  if (fields['device']) return `${base}/${fields['device']}`;
  return base;
}

function buildPushbulletUrl(fields: Fields): string {
  const base = `pbul://${fields['access_token']}`;
  if (fields['channel']) return `${base}/${encodeURIComponent('#' + String(fields['channel']))}`;
  if (fields['device_id']) return `${base}/${fields['device_id']}`;
  return base;
}

function buildWebhookUrl(fields: Fields): string {
  const format = String(fields['format'] ?? 'json');
  const secure = fields['secure'] !== false && fields['secure'] !== 'false';
  const host = String(fields['host']);
  const path = fields['path'] ? String(fields['path']) : '/';
  const method = fields['method'] ? String(fields['method']) : 'POST';

  let scheme: string;
  if (format === 'form') {
    scheme = secure ? 'forms' : 'form';
  } else {
    scheme = secure ? 'jsons' : 'json';
  }

  const params = new URLSearchParams();
  if (method !== 'POST') params.set('method', method);

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const query = params.toString() ? `?${params.toString()}` : '';
  return `${scheme}://${host}${normalizedPath}${query}`;
}

const BUILDERS: Record<string, (fields: Fields) => string> = {
  discord: buildDiscordUrl,
  slack: buildSlackUrl,
  telegram: buildTelegramUrl,
  ntfy: buildNtfyUrl,
  gotify: buildGotifyUrl,
  email: buildEmailUrl,
  msteams: buildMSTeamsUrl,
  workflows: buildWorkflowsUrl,
  pushover: buildPushoverUrl,
  pushbullet: buildPushbulletUrl,
  webhook: buildWebhookUrl,
};

export function buildUrl(service: string, fields: Fields): BuildUrlResult {
  const schema = SERVICE_SCHEMAS.find(s => s.service === service);
  if (!schema) {
    return { url: '', errors: [{ field: 'service', message: `Unknown service: ${service}` }] };
  }

  const errors = validateFields(schema, fields);
  if (errors.length > 0) {
    return { url: '', errors };
  }

  const builder = BUILDERS[service];
  if (!builder) {
    return { url: '', errors: [{ field: 'service', message: `No URL builder for service: ${service}` }] };
  }

  return { url: builder(fields), errors: [] };
}

// Re-export for use in url-decomposer
export { BUILDERS };

export function fieldsFromDecomposed(service: string, parsed: Fields): DecomposeResult {
  return { service, fields: parsed };
}
