/**
 * Generic webhook service with JSON and form-encoded variants.
 *
 * URL schemes:
 *   jsons://host/path  — HTTPS POST with JSON body
 *   forms://host/path  — HTTPS POST with form-encoded body
 *
 * Insecure (non-TLS) schemes json:// and form:// are rejected.
 *
 * Default JSON body: { "title": "...", "body": "...", "type": "..." }
 *
 * Query parameter prefixes for customisation:
 *   ?+HeaderName=value  — add a custom request header (prefix with +)
 *   ?-fieldname=value   — add/override a body field (prefix with -)
 *   ?method=PUT         — override the HTTP method (default: POST)
 *
 * Examples:
 *   jsons://example.com/api/notify?+X-Custom=value&-source=myapp
 *   forms://hooks.example.com/notify?method=PUT
 */
import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { ServiceError } from '../errors.js';
import { BaseService } from './base.js';
import {
  validateHost,
  validateHeaderName,
  sanitizeHeaderValue,
  validateHttpMethod,
  DEFAULT_TIMEOUT_MS,
  errorMessage,
} from '../security.js';

interface WebhookConfig extends ServiceConfig {
  service: 'webhook';
  targetUrl: string;
  isJson: boolean;
  method: string;
  extraHeaders: Record<string, string>;
  extraFields: Record<string, string>;
}

class WebhookService extends BaseService implements ServiceDefinition {
  schemas = ['json', 'jsons', 'form', 'forms'];

  parseUrl(url: URL): WebhookConfig {
    const scheme = url.protocol.replace(/:$/, '');
    const isSecure = scheme === 'jsons' || scheme === 'forms';
    const isJson = scheme === 'json' || scheme === 'jsons';

    // C1: Block insecure (non-TLS) schemes
    if (!isSecure) {
      throw new Error(
        `Insecure scheme "${scheme}://" is not allowed. Use "${scheme}s://" (HTTPS) instead`,
      );
    }

    const httpScheme = 'https';
    const targetUrl = `${httpScheme}://${url.hostname}${url.pathname}`;

    // C1: Validate host against SSRF deny-list
    validateHost(url.hostname);

    let method = 'POST';
    const extraHeaders: Record<string, string> = {};
    const extraFields: Record<string, string> = {};

    // Parse the raw query string to preserve '+' at the start of keys.
    // URLSearchParams decodes '+' as a space, which would break prefix detection.
    const rawSearch = url.search.slice(1); // strip leading '?'
    if (rawSearch) {
      for (const part of rawSearch.split('&')) {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) continue;
        const rawKey = part.slice(0, eqIdx);
        const rawVal = part.slice(eqIdx + 1);

        // L6: Wrap decodeURIComponent in try/catch for malformed percent-encoding
        let key: string;
        let value: string;
        try {
          key = decodeURIComponent(rawKey);
        } catch {
          throw new Error('Malformed percent-encoding in URL parameter key');
        }
        try {
          value = decodeURIComponent(rawVal.replace(/\+/g, ' '));
        } catch {
          throw new Error('Malformed percent-encoding in URL parameter value');
        }

        if (key === 'method') {
          // H4: Restrict to allowed HTTP methods
          method = validateHttpMethod(value);
        } else if (key.startsWith('+')) {
          // C2: Validate header name against block-list
          const headerName = key.slice(1);
          validateHeaderName(headerName);
          extraHeaders[headerName] = sanitizeHeaderValue(value);
        } else if (key.startsWith('-')) {
          extraFields[key.slice(1)] = value;
        }
      }
    }

    return { service: 'webhook', targetUrl, isJson, method, extraHeaders, extraFields };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    if (config.service !== 'webhook') {
      throw new Error('Misrouted config: expected webhook');
    }
    const { targetUrl, isJson, method, extraHeaders, extraFields } = config as WebhookConfig;

    try {
      // M8: Base fields take precedence — spread extraFields first so base wins
      const baseFields: Record<string, string> = {
        title: message.title ?? '',
        body: message.body,
        type: message.type ?? 'info',
      };
      const fields = { ...extraFields, ...baseFields };

      let body: string;
      let contentType: string;

      if (isJson) {
        body = JSON.stringify(fields);
        contentType = 'application/json';
      } else {
        body = new URLSearchParams(fields).toString();
        contentType = 'application/x-www-form-urlencoded';
      }

      const headers: Record<string, string> = { 'Content-Type': contentType, ...extraHeaders };

      // M1: Add timeout to fetch
      const response = await fetch(targetUrl, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ServiceError(`HTTP ${response.status}`, response.status, text.slice(0, 200));
      }

      return { success: true, service: 'webhook' };
    } catch (err) {
      return { success: false, service: 'webhook', error: errorMessage(err) };
    }
  }
}

export const webhookService = new WebhookService();
