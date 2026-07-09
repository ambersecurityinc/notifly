import type { DecomposeResult } from './types.js';
import { SERVICE_SCHEMAS } from './schemas.js';

/**
 * Decompose a notifly/Apprise URL back into its service key and field values.
 * This enables round-trip editing: load an existing URL, display it in a form,
 * let the user modify fields, then rebuild the URL.
 *
 * Returns `{ service: 'unknown', fields: { url } }` for unrecognised schemes.
 */
export function decomposeUrl(urlString: string): DecomposeResult {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { service: 'unknown', fields: { url: urlString } };
  }

  const scheme = url.protocol.replace(/:$/, '');

  // Find the schema that handles this scheme
  const schema = SERVICE_SCHEMAS.find(s => s.schemes.includes(scheme));
  if (!schema) {
    return { service: 'unknown', fields: { url: urlString } };
  }

  const service = schema.service;
  const fields: Record<string, string | number | boolean> = {};

  switch (service) {
    case 'discord': {
      fields['webhook_id'] = url.hostname;
      fields['webhook_token'] = url.pathname.slice(1);
      break;
    }
    case 'slack': {
      const parts = url.pathname.split('/').filter(Boolean);
      fields['token_a'] = url.hostname;
      fields['token_b'] = parts[0] ?? '';
      fields['token_c'] = parts[1] ?? '';
      if (parts[2]) fields['channel'] = decodeURIComponent(parts[2]);
      break;
    }
    case 'telegram': {
      fields['bot_token'] = url.hostname;
      fields['chat_id'] = url.pathname.slice(1);
      break;
    }
    case 'ntfy': {
      const path = url.pathname.slice(1);
      if (!path) {
        fields['topic'] = url.hostname;
        fields['host'] = 'ntfy.sh';
      } else {
        fields['host'] = url.hostname;
        fields['topic'] = path;
      }
      break;
    }
    case 'gotify': {
      fields['host'] = url.hostname;
      fields['token'] = url.pathname.slice(1);
      break;
    }
    case 'email': {
      fields['user'] = decodeURIComponent(url.username);
      fields['api_key'] = decodeURIComponent(url.password);
      fields['host'] = url.hostname;
      fields['to'] = url.searchParams.get('to') ?? '';
      const gateway = url.searchParams.get('gateway');
      if (gateway) fields['gateway'] = gateway;
      const from = url.searchParams.get('from');
      if (from) fields['from'] = from;
      const cc = url.searchParams.get('cc');
      if (cc) fields['cc'] = cc;
      const bcc = url.searchParams.get('bcc');
      if (bcc) fields['bcc'] = bcc;
      break;
    }
    case 'msteams': {
      const groupId = decodeURIComponent(url.username) || url.hostname;
      const tenantId = url.username ? url.hostname : '';
      const parts = url.pathname.split('/').filter(Boolean);
      fields['group_id'] = groupId;
      if (tenantId) fields['tenant_id'] = tenantId;
      fields['channel_id'] = parts[0] ?? '';
      fields['webhook_id'] = parts[1] ?? '';
      break;
    }
    case 'workflows': {
      // workflows://<host>[:port]/<path>?<query>  →  full HTTPS webhook URL
      fields['webhook_url'] = `https://${url.host}${url.pathname}${url.search}`;
      break;
    }
    case 'pushover': {
      const parts = url.pathname.split('/').filter(Boolean);
      fields['user_key'] = url.hostname;
      fields['api_token'] = parts[0] ?? '';
      if (parts[1]) fields['device'] = parts[1];
      break;
    }
    case 'pushbullet': {
      fields['access_token'] = url.hostname;
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0]) {
        const target = decodeURIComponent(parts[0]);
        if (target.startsWith('#')) {
          fields['channel'] = target.slice(1);
        } else {
          fields['device_id'] = target;
        }
      }
      break;
    }
    case 'webhook': {
      const isJson = scheme === 'json' || scheme === 'jsons';
      const isSecure = scheme === 'jsons' || scheme === 'forms';
      fields['host'] = url.hostname;
      fields['path'] = url.pathname || '/';
      fields['format'] = isJson ? 'json' : 'form';
      fields['secure'] = isSecure;
      const method = url.searchParams.get('method');
      fields['method'] = method ? method.toUpperCase() : 'POST';
      break;
    }
  }

  return { service, fields };
}
