# notifly

Send notifications to multiple services from a single API using Apprise-compatible URLs.

[![npm version](https://img.shields.io/npm/v/@ambersecurityinc/notifly)](https://www.npmjs.com/package/@ambersecurityinc%2fnotifly)
[![CI](https://github.com/ambersecurityinc/notifly/actions/workflows/ci.yml/badge.svg)](https://github.com/ambersecurityinc/notifly/actions)
[![License: MIT](https://img.shields.io/npm/l/@ambersecurityinc/notifly)](LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@ambersecurityinc/notifly)](https://bundlephobia.com/package/@ambersecurityinc%2fnotifly)

## Features

- **Web API only** — built on `fetch`, no Node.js-specific dependencies
- **Multi-runtime** — works on Cloudflare Workers, Bun, Deno, and Node 18+
- **Apprise-compatible URLs** — one URL string encodes all connection details
- **Concurrent dispatch** — sends to all services in parallel via `Promise.allSettled()`
- **Plugin system** — register custom services with `registerService()`

## Install

```sh
npm install @ambersecurityinc/notifly
```

## Quick Start

```ts
import { notify } from '@ambersecurityinc/notifly';

const results = await notify(
  {
    urls: [
      'discord://1234567890/abcdefghijklmnop',
      'ntfy://my-alerts',
      'tgram://bot123456/987654321',
    ],
  },
  {
    title: 'Deployment complete',
    body: 'v1.2.3 is live!',
    type: 'success',
  },
);

console.log(results);
// [
//   { success: true, service: 'discord' },
//   { success: true, service: 'ntfy' },
//   { success: true, service: 'telegram' },
// ]
```

## Supported Services

| Service            | URL Scheme(s)               | Example URL                                                                  |
|--------------------|-----------------------------|------------------------------------------------------------------------------|
| Discord            | `discord`                   | `discord://webhook_id/webhook_token`                                         |
| Slack              | `slack`                     | `slack://token_a/token_b/token_c/%23channel`                                 |
| Telegram           | `tgram`                     | `tgram://bot_token/chat_id`                                                  |
| ntfy               | `ntfy`                      | `ntfy://topic` or `ntfy://host/topic`                                        |
| Gotify             | `gotify`                    | `gotify://host/token`                                                        |
| Email (via gateway)| `mailto`                    | `mailto://user:apikey@host/?to=addr@example.com&gateway=resend`              |
| Microsoft Teams    | `msteams`, `teams`          | `msteams://group_id@tenant_id/channel_id/webhook_id`                         |
| Teams (Workflows)  | `workflows`, `workflow`     | `workflows://host/powerautomate/.../triggers/manual/paths/invoke?...&sig=...` |
| Pushover           | `pover`                     | `pover://user_key/api_token` or `pover://user_key/api_token/device`          |
| Pushbullet         | `pbul`                      | `pbul://access_token` or `pbul://access_token/device_id`                     |
| Custom Webhook     | `json`, `jsons`, `form`, `forms` | `jsons://example.com/hook` or `forms://example.com/hook?method=PUT`     |

## URL Builder

A headless, framework-agnostic URL builder module ships as a separate subpath export. It provides service schemas, field definitions, validation, and URL generation — the logic layer for building notification URL configuration UIs without coupling to any framework.

### Import

```ts
import {
  getServiceSchemas,
  getServiceSchema,
  searchServices,
  getServicesByCategory,
  getCategories,
  validateFields,
  buildUrl,
  decomposeUrl,
} from '@ambersecurityinc/notifly/builder';
```

### 3-Step Form Flow

```ts
import { searchServices, validateFields, buildUrl } from '@ambersecurityinc/notifly/builder';

// Step 1 — Search and select a service
const results = searchServices('discord');
const schema = results[0]; // { service: 'discord', label: 'Discord', fields: [...], ... }

// Step 2 — Render a form using schema.fields, collect user input
const userInput = {
  webhook_id: '1234567890',
  webhook_token: 'abcdefghijklmnop',
};

// Step 3 — Validate and generate the URL
const errors = validateFields('discord', userInput);
if (errors.length === 0) {
  const { url } = buildUrl('discord', userInput);
  console.log(url); // discord://1234567890/abcdefghijklmnop
}
```

### Smart URL Paste

Users can paste the raw webhook URL they copied from a service's settings page — no manual conversion needed:

```ts
import { smartParse } from '@ambersecurityinc/notifly/builder';

// User pastes their raw Discord webhook URL
const result = smartParse('https://discord.com/api/webhooks/1234567890/abcdefghijklmnop');
// → { service: 'discord', notiflyUrl: 'discord://1234567890/abcdefghijklmnop',
//     fields: { webhook_id: '1234567890', webhook_token: 'abcdefghijklmnop' } }

// Also works with existing notifly URLs
const result2 = smartParse('discord://1234567890/abcdefghijklmnop');
// → { service: 'discord', notiflyUrl: 'discord://1234567890/abcdefghijklmnop',
//     fields: { webhook_id: '1234567890', webhook_token: 'abcdefghijklmnop' } }

// Unknown URLs return null
const result3 = smartParse('https://example.com/unknown');
// → null
```

`smartParse` tries `detectAndConvert` first (for raw provider URLs), then falls back to `decomposeUrl` (for existing Apprise URLs). You can also use each individually:

```ts
import { detectAndConvert, isRawServiceUrl } from '@ambersecurityinc/notifly/builder';

// Check if a pasted string is a raw provider URL before processing
if (isRawServiceUrl(input)) {
  const converted = detectAndConvert(input);
  // converted?.notiflyUrl — the notifly URL to store
}
```

**Detection patterns supported:**

| Raw URL pattern | Detected as |
|---|---|
| `https://discord.com/api/webhooks/{id}/{token}` | `discord` |
| `https://hooks.slack.com/services/{a}/{b}/{c}` | `slack` |
| `https://*.webhook.office.com/webhookb2/.../IncomingWebhook/...` | `msteams` |
| `https://*/.../triggers/manual/paths/invoke?...&sig=...` | `workflows` (Teams Power Automate) |
| `https://api.telegram.org/bot{token}/...` | `telegram` (chat_id left empty) |
| `https://ntfy.sh/{topic}` | `ntfy` |
| `https://{host}/message?token={token}` | `gotify` |

### Editing Existing URLs

```ts
import { decomposeUrl, buildUrl } from '@ambersecurityinc/notifly/builder';

// Load an existing URL into field values (for editing)
const { service, fields } = decomposeUrl('discord://1234567890/abcdefghijklmnop');
// { service: 'discord', fields: { webhook_id: '1234567890', webhook_token: 'abcdefghijklmnop' } }

// Modify a field and rebuild
const { url } = buildUrl(service, { ...fields, webhook_token: 'newtoken' });
```

### Browsing by Category

```ts
import { getCategories, getServicesByCategory } from '@ambersecurityinc/notifly/builder';

const categories = getCategories();
// [{ key: 'chat', label: 'Chat & Messaging', count: 4 }, ...]

const chatServices = getServicesByCategory('chat');
// schemas for Discord, Slack, Telegram, Microsoft Teams
```

### Service Schema Shape

Each schema describes all fields a user needs to fill in:

```ts
interface ServiceSchema {
  service: string;      // registry key, e.g. 'discord'
  label: string;        // display name
  description: string;  // one-liner
  schemes: string[];    // URL schemes, e.g. ['discord']
  category: 'chat' | 'push' | 'email' | 'webhook' | 'self-hosted';
  iconHint: string;     // icon name hint for your UI
  fields: ServiceField[];
}

interface ServiceField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  required: boolean;
  sensitive: boolean;   // true for tokens/passwords — UI should mask these
  placeholder?: string;
  helpText?: string;    // where to find the value (very useful for users)
  defaultValue?: string | number | boolean;
  options?: { label: string; value: string }[];  // for 'select' type
  validation?: { pattern?: string; minLength?: number; maxLength?: number };
}
```

This module is entirely framework-agnostic — bring your own UI (React, Vue, Svelte, plain HTML, etc.).

## Custom Services

```ts
import { registerService } from '@ambersecurityinc/notifly';
import type { ServiceDefinition, ServiceConfig, NotiflyMessage } from '@ambersecurityinc/notifly';

const myService: ServiceDefinition = {
  schemas: ['myscheme'],

  parseUrl(url: URL): ServiceConfig {
    return { service: 'myscheme', host: url.hostname, token: url.pathname.slice(1) };
  },

  async send(config: ServiceConfig, message: NotiflyMessage) {
    // send the notification...
    return { success: true, service: 'myscheme' };
  },
};

registerService(myService);

// Now use it
await notify({ urls: ['myscheme://host/token'] }, { body: 'Hello!' });
```

## API Reference

### `notify(options, message)`

Sends a notification to all URLs concurrently. Never throws — failures are captured in results.

```ts
function notify(options: NotiflyOptions, message: NotiflyMessage): Promise<NotiflyResult[]>
```

### `parseUrl(url)`

Parses an Apprise-compatible URL string into a `ServiceConfig` object. Throws `ParseError` for malformed or unknown URLs. Useful for validation before sending.

```ts
function parseUrl(url: string): ServiceConfig
```

### `registerService(service)`

Registers a custom service plugin. Overwrites any existing service registered for the same URL scheme(s).

```ts
function registerService(service: ServiceDefinition): void
```

### Types

```ts
interface NotiflyMessage {
  title?: string;
  body: string;
  type?: 'info' | 'success' | 'warning' | 'failure';
}

interface NotiflyResult {
  success: boolean;
  service: string;
  error?: string;
}

interface NotiflyOptions {
  urls: string[];
}

interface ServiceConfig {
  service: string;
  [key: string]: unknown;
}

interface ServiceDefinition {
  schemas: string[];
  parseUrl(url: URL): ServiceConfig;
  send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult>;
}
```

## URL Format

### Discord

```
discord://webhook_id/webhook_token
```

### Slack

```
slack://token_a/token_b/token_c/%23channel
```

The channel segment is optional and should be URL-encoded (e.g. `%23general` for `#general`).

### Telegram

```
tgram://bot_token/chat_id
```

### ntfy

```
ntfy://topic                  # uses ntfy.sh
ntfy://your-host.com/topic    # self-hosted
```

### Gotify

```
gotify://your-host.com/app_token
```

### Email (via HTTP gateway)

Raw SMTP requires TCP sockets not available in Web API environments. Use an HTTP gateway instead:

```
# MailChannels (free on Cloudflare Workers)
mailto://user@host/?to=recipient@example.com&gateway=mailchannels

# Resend (free tier — password is your API key)
mailto://user:re_apikey@host/?to=recipient@example.com&gateway=resend
```

Optional query params: `from`, `cc`, `bcc`.

### Microsoft Teams

Tokens come from the Teams webhook URL:
`https://outlook.webhook.office.com/webhookb2/{group_id}@{tenant_id}/IncomingWebhook/{channel_id}/{webhook_id}`

```
msteams://group_id@tenant_id/channel_id/webhook_id
```

Also registered as `teams://` alias.

### Microsoft Teams (Workflows / Power Automate)

Microsoft is [retiring the Office 365 connectors](https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/) used by `msteams://` in favour of the **Workflows** app (powered by Power Automate). In Teams, open a channel → **More options (⋯)** → **Workflows** → *"Post to a channel when a webhook request is received"*, then copy the generated URL. It looks like:

```
https://<env>.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/<id>/triggers/manual/paths/invoke?api-version=1&sp=...&sv=1.0&sig=...
```

(Older flows issue `https://<host>.logic.azure.com:443/workflows/.../triggers/manual/paths/invoke?...` URLs — both are supported.)

Because the URL carries a cryptographic `sig` token that must be preserved exactly, notifly stores the whole URL by swapping the scheme from `https` to `workflows`:

```
workflows://<env>.environment.api.powerplatform.com/powerautomate/.../triggers/manual/paths/invoke?...&sig=...
```

The easiest way to produce this is `smartParse()` (or `detectAndConvert()`) — paste the raw HTTPS URL and it converts automatically. Also registered as `workflow://` alias.

The message is posted as `{ "text": "..." }`, which the built-in *"Send webhook alerts to a channel"* template renders with basic Markdown (a `title`, if present, becomes a bold first line).

### Pushover

```
pover://user_key/api_token           # send to all devices
pover://user_key/api_token/device    # send to a specific device
```

Message `type` maps to Pushover priority: `info`/`success`=0, `warning`=1, `failure`=2.

### Pushbullet

```
pbul://access_token                  # push to all devices
pbul://access_token/device_iden      # push to specific device
pbul://access_token/%23channel_tag   # push to a channel
```

### Custom Webhook

```
json://host/path    # HTTP POST with JSON body
jsons://host/path   # HTTPS POST with JSON body
form://host/path    # HTTP POST with form-encoded body
forms://host/path   # HTTPS POST with form-encoded body
```

Default JSON body: `{ "title": "...", "body": "...", "type": "..." }`

Query parameter prefixes for customisation:
- `?+HeaderName=value` — add a custom request header
- `?-fieldname=value` — add/override a body field
- `?method=PUT` — override the HTTP method (default: POST)

## Error Handling

`notify()` never throws. All errors are returned as failed results:

```ts
const results = await notify({ urls: ['discord://bad/token'] }, { body: 'test' });
// [{ success: false, service: 'discord', error: 'HTTP 401 from ...' }]
```

`parseUrl()` throws `ParseError` for invalid or unknown URLs:

```ts
import { parseUrl, ParseError } from '@ambersecurityinc/notifly';

try {
  parseUrl('not-a-url');
} catch (err) {
  if (err instanceof ParseError) {
    console.error('Bad URL:', err.message);
  }
}
```

HTTP failures are exposed as `ServiceError` (with `.status` and `.body` properties) — these are caught internally and returned as failed `NotiflyResult` objects.

## Runtime Compatibility

| Runtime            | Supported |
|--------------------|-----------|
| Node.js 18+        | ✅        |
| Bun                | ✅        |
| Deno               | ✅        |
| Cloudflare Workers | ✅        |
| Browser            | ✅        |

No Node.js-specific APIs are used. Only `fetch` and the `URL` constructor are required.

## Publishing

### First Publish

This project uses a two-workflow setup for npm publishing.

**First publish** is done via `first-publish.yml` using a granular npm access token:

1. Create a granular npm token scoped to the `@ambersecurityinc/notifly` package (read-write access)
2. Add it as `NPM_TOKEN` in your GitHub repo → Settings → Secrets → Actions
3. Go to Actions tab → "First Publish" → "Run workflow"
4. Verify the package appears at https://www.npmjs.com/package/@ambersecurityinc%2fnotifly

### Ongoing Releases (OIDC Trusted Publishing)

After the first publish, switch to keyless publishing via OIDC:

1. Go to https://www.npmjs.com/package/@ambersecurityinc%2fnotifly/access
2. Under "Trusted Publisher", select **GitHub Actions**
3. Fill in: org `ambersecurityinc`, repository `notifly`, workflow filename `release.yml`
4. Enable "Require two-factor authentication and disallow tokens" (recommended)
5. In your GitHub repo: disable `first-publish.yml` and delete the `NPM_TOKEN` secret

Releases are triggered by pushing a git tag (`v*`) or via the `release.yml` workflow dispatch.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
