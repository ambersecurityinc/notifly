---
"@ambersecurityinc/notifly": minor
---

Fix the Teams **Workflows** (`workflows://`) payload for Power Automate flows.

The service previously always sent `{ "text": "..." }`, which the flowbot "Post card in a chat or channel" action rejects with `AdaptiveSerializationException: Property 'type' must be 'AdaptiveCard'`. It now sends a real **Adaptive Card** by default, and supports a `#format=` URL fragment to select the payload shape for any Workflows flow binding:

- `card` (default) — a bare Adaptive Card `{ "type": "AdaptiveCard", … }`
- `message` — the `{ "type": "message", "attachments": [ … ] }` envelope
- `text` — the legacy `{ "text": "…" }` body

The fragment is kept out of the signed query string and is never sent over the wire, so the `sig` token is preserved exactly. The builder exposes a **Payload Format** field, and `decomposeUrl` round-trips it.

Also fixes a latent bug where `enforceMessageLimits` dropped `message.type`, so `type` never reached any service via `notify()` — Pushover priority, the webhook `type` field, and the new Teams Adaptive Card colour now receive it.
