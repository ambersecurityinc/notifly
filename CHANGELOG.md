# Changelog

## 0.7.0

### Minor Changes

- 67fbcec: Fix the Teams **Workflows** (`workflows://`) payload for Power Automate flows.

  The service previously always sent `{ "text": "..." }`, which the flowbot "Post card in a chat or channel" action rejects with `AdaptiveSerializationException: Property 'type' must be 'AdaptiveCard'`. It now sends a real **Adaptive Card** by default, and supports a `#format=` URL fragment to select the payload shape for any Workflows flow binding:

  - `card` (default) — a bare Adaptive Card `{ "type": "AdaptiveCard", … }`
  - `message` — the `{ "type": "message", "attachments": [ … ] }` envelope
  - `text` — the legacy `{ "text": "…" }` body

  The fragment is kept out of the signed query string and is never sent over the wire, so the `sig` token is preserved exactly. The builder exposes a **Payload Format** field, and `decomposeUrl` round-trips it.

  Also fixes a latent bug where `enforceMessageLimits` dropped `message.type`, so `type` never reached any service via `notify()` — Pushover priority, the webhook `type` field, and the new Teams Adaptive Card colour now receive it.

## 0.6.0

### Minor Changes

- 138fafd: Add Microsoft Teams **Workflows** (Power Automate) webhook support via the new `workflows://` (alias `workflow://`) scheme. This is the successor to the retiring Office 365 `msteams://` incoming connectors. The full HTTPS webhook URL — including its `sig` token — is preserved by swapping the scheme, and the builder's `smartParse`/`detectAndConvert` now recognize raw Power Automate and Logic Apps webhook URLs (`.../triggers/manual/paths/invoke?...&sig=...`).

## 0.5.0

### Minor Changes

- Add GitHub Packages as a publish target alongside npmjs.org

## 0.4.0 — 2026-03-28

### Security

#### High

- **H1** — Added 30-second `AbortSignal.timeout` to `BaseService.httpPost` (`src/services/base.ts`)
- **H2** — Made `ServiceError._debugUrl` non-enumerable to prevent credential leakage in serialization (`src/services/base.ts`)
- **H3** — Removed raw URL echo from dispatch error messages (`src/dispatcher.ts`)
- **H4** — Added concurrency limiter (max 10 parallel requests) to `notify()` (`src/dispatcher.ts`)
- **H5** — Added SSRF validation (`validateHost`) to ntfy service (`src/services/ntfy.ts`)
- **H6** — Added SSRF validation (`validateHost`) to Gotify service (`src/services/gotify.ts`)
- **H7** — Added HTML entity escaping for Telegram HTML-mode messages (`src/services/telegram.ts`)

#### Medium

- **M1** — Added `AbortSignal.timeout` to webhook service direct fetch (`src/services/webhook.ts`)
- **M2** — Added `AbortSignal.timeout` to ntfy service fetch (`src/services/ntfy.ts`)
- **M3** — Added JSDoc security warning about API keys in email URLs (`src/services/email.ts`)
- **M4** — Added email address validation before sending (`src/services/email.ts`)
- **M5** — Stopped echoing raw URL input in `ParseError` messages (`src/url-parser.ts`)
- **M6** — Added runtime config type guards to all 10 service `send()` methods
- **M7** — Made `ServiceError._body` non-enumerable to prevent body leakage in JSON serialization (`src/errors.ts`)
- **M8** — Fixed webhook field order so user-supplied extra fields cannot override base fields (`src/services/webhook.ts`)

#### Low

- **L1** — Enforced message size limits (title: 256 chars, body: 64 KB) in dispatcher (`src/dispatcher.ts`)
- **L2** — Replaced unsafe `(err as Error).message` with `errorMessage()` helper across all services (`src/security.ts`)
- **L3** — Documented IPv6 `fe80::/10` regex correctness in `validateHost` (`src/security.ts`)
- **L4** — Documented DNS rebinding limitation for `validateHost` (`src/security.ts`)
- **L5** — Disabled source maps in production build (`tsconfig.json`)
- **L6** — Wrapped `decodeURIComponent` in try/catch for malformed percent-encoding (`src/services/webhook.ts`)

## 0.3.0

Initial public release.
