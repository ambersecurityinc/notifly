# Security Audit Report — @ambersecurityinc/notifly v0.3.0

**Date:** 2026-03-27
**Auditor:** Claude (automated)
**Scope:** Full codebase (src/), dependencies, build configuration

---

## 1. Dependency Vulnerabilities

```
$ npm audit
found 0 vulnerabilities
```

**Runtime dependencies: 0 (zero)**. The package has no runtime dependencies, which is
excellent from a supply-chain perspective. All HTTP is done via the native `fetch()` API.

| Dev Dependency         | Version | Status   | Notes                        |
|------------------------|---------|----------|------------------------------|
| typescript             | 6.0.2   | Current  | No known CVEs                |
| tsup                   | 8.5.1   | Current  | No known CVEs                |
| vitest                 | 4.1.2   | Current  | No known CVEs                |
| @vitest/coverage-v8    | 4.1.2   | Current  | No known CVEs                |

**Supply chain risk: LOW.** Zero runtime deps eliminates transitive vulnerability risk.
Renovate is configured with `pin` range strategy for reproducible builds.

---

## 2. Findings

### CRITICAL

| # | File : Line | Description | Recommendation |
|---|-------------|-------------|----------------|
| C1 | `src/services/webhook.ts:43` | **SSRF — no host validation.** The generic webhook service (`json://`, `form://`) constructs `targetUrl` from user-supplied hostname with zero validation. An attacker can target `http://127.0.0.1`, `http://169.254.169.254` (cloud metadata), or any internal IP. The `json://` and `form://` schemes also permit **plain HTTP**, sending credentials in cleartext. | Validate the resolved IP against a deny-list (RFC 1918, link-local, loopback, cloud metadata `169.254.169.254`). Consider requiring `jsons://`/`forms://` only, or adding an explicit opt-in for HTTP. |
| C2 | `src/services/webhook.ts:64-65` | **Arbitrary header injection.** Query params prefixed with `+` become HTTP headers with no restrictions. A URL like `jsons://evil.com/x?+Host=internal` can override `Host`, `Authorization`, `Cookie`, etc. | Maintain a deny-list of prohibited headers (`Host`, `Authorization`, `Cookie`, `Content-Length`, `Transfer-Encoding`) or use an allow-list. |
| C3 | `src/services/ntfy.ts:40` | **HTTP header injection via `Title`.** `message.title` is placed directly into the `Title` HTTP header. If the title contains `\r\n`, it can inject additional headers (CRLF injection). Modern Node.js `fetch` rejects bare `\r\n` in header values, but older runtimes (Cloudflare Workers, Deno) may not. | Strip or reject `\r` and `\n` from any value placed in an HTTP header. |
| C4 | `src/services/gotify.ts:31` | **Token in URL query string.** The Gotify app token is appended as `?token=...` in the URL. Tokens in query strings are logged by proxies, appear in server access logs, and leak via `Referer` headers. | Send the token in the `X-Gotify-Key` header instead (Gotify supports this). |
| C5 | `src/services/telegram.ts:21` | **HTML injection in Telegram messages.** `parse_mode: 'HTML'` is used but `message.title` and `message.body` are interpolated without escaping `<`, `>`, `&`. A body containing `<script>` or `<a href="...">` will be rendered by Telegram as HTML. | Escape HTML entities in title and body before interpolation, or switch to `MarkdownV2` parse mode with appropriate escaping. |

### HIGH

| # | File : Line | Description | Recommendation |
|---|-------------|-------------|----------------|
| H1 | `src/services/base.ts:5` | **No request timeout.** `fetch()` is called without an `AbortSignal`. A non-responsive server will cause the promise to hang indefinitely, potentially exhausting resources. | Use `AbortSignal.timeout(30_000)` (Node 18+) or create an `AbortController` with `setTimeout`. |
| H2 | `src/services/base.ts:13` | **Credential leakage in error messages.** `ServiceError` message includes the full URL: `HTTP ${status} from ${url}`. For services like Gotify (`?token=...`) and the webhook service (which may have `+Authorization=Bearer+...` in the query), this leaks secrets to callers. | Redact the URL in error messages — strip query parameters and authentication segments. |
| H3 | `src/services/email.ts:39` | **Credentials embedded in URL.** The Resend API key is passed as the URL password (`mailto://user:APIKEY@host/...`). URLs are often logged, stored in shell history, or visible in process lists. | Document the risk prominently. Consider supporting env-var references (e.g., `$RESEND_API_KEY`) or a separate config object. |
| H4 | `src/services/webhook.ts:63` | **Unrestricted HTTP method.** `?method=DELETE` or `?method=PATCH` are accepted without validation. Combined with SSRF (C1), this enables destructive operations against internal services. | Restrict `method` to an allow-list: `POST`, `PUT`, `GET`. |
| H5 | `src/dispatcher.ts:9` | **Unbounded concurrency.** All URLs are dispatched simultaneously with no concurrency limit. A large `urls` array (e.g., 1000 entries) can exhaust sockets/file descriptors and trigger rate limits on external services. | Add a concurrency limit (e.g., `p-limit` pattern or a simple semaphore, max 10 concurrent). |
| H6 | `src/services/ntfy.ts:28-34` | **No host validation on ntfy.** When a path is present (`ntfy://myhost.com/topic`), the hostname is used directly. Same SSRF risk as C1 — an attacker can target internal hosts. | Apply the same IP/hostname deny-list as recommended for C1. |
| H7 | `src/services/gotify.ts:21` | **No host validation on Gotify.** `gotify://HOST/TOKEN` uses `HOST` verbatim. Internal IPs are reachable. | Apply the same IP/hostname deny-list as recommended for C1. |

### MEDIUM

| # | File : Line | Description | Recommendation |
|---|-------------|-------------|----------------|
| M1 | `src/services/email.ts:42,69-70` | **No email address validation.** `to`, `from`, `cc`, `bcc` are passed through without format validation. Malformed addresses could cause gateway-specific errors or be used for header injection in email systems. | Validate email addresses with a basic RFC 5322 regex before sending. |
| M2 | `src/services/webhook.ts:84` | **Field override via `-` prefix.** `extraFields` can override `title`, `body`, and `type` in the payload. While this is documented as a feature, it could lead to unexpected behavior if users don't realize fields can be clobbered. | Document clearly, or apply `extraFields` first and let `baseFields` take precedence. |
| M3 | `src/dispatcher.ts:14` | **Full URL echoed in error result.** `Invalid URL: ${urlString}` returns the raw input (which may contain credentials) back to the caller in `NotiflyResult.error`. | Return a generic message like `"Invalid URL format"` without echoing the input. |
| M4 | `src/services/*.ts` (all) | **Unsafe `as XConfig` type assertions.** Every service casts `config as SpecificConfig` without runtime validation. If the wrong config object is passed (e.g., via a misregistered schema), properties will be `undefined` and cause silent failures or runtime errors. | Add a runtime guard (`if (config.service !== 'discord') throw ...`) or use a discriminated-union parser. |
| M5 | `src/errors.ts:9-11` | **`ServiceError.body` stores raw response text.** While truncated to 200 chars in `base.ts:15`, the `body` property is `public readonly` and may contain server error details, internal paths, or tokens returned by the upstream service. | Consider not exposing `body` publicly, or redacting it in `toString()`/serialization. |
| M6 | `src/services/webhook.ts:40-42` | **HTTP allowed for webhook schemes.** `json://` and `form://` resolve to `http://`, transmitting data in plaintext. | Log a warning when non-secure schemes are used, or default to HTTPS and require an explicit `insecure` flag. |

### LOW

| # | File : Line | Description | Recommendation |
|---|-------------|-------------|----------------|
| L1 | `src/services/*.ts` (all) | **No message size limits.** `message.body` and `message.title` are unbounded. Extremely large payloads could cause OOM or exceed upstream service limits. | Enforce reasonable max sizes (e.g., title: 256 chars, body: 64 KB). |
| L2 | `src/services/*.ts` (all) | **`(err as Error).message` cast.** If a non-Error object is thrown (e.g., a string or `null`), `.message` will be `undefined`. | Use `err instanceof Error ? err.message : String(err)`. |
| L3 | `tsconfig.json` | **Source maps enabled in production build.** `sourceMap: true` in tsconfig means `.js.map` files ship with the package, exposing the original TypeScript source. | Use source maps only for development; disable or exclude from `"files"` in package.json. |
| L4 | `src/services/webhook.ts:59-61` | **`decodeURIComponent` on raw query parts.** Malformed percent-encoding (e.g., `%ZZ`) will throw `URIError`, which is caught by the outer try/catch but produces an unhelpful error message. | Wrap `decodeURIComponent` in a try/catch with a descriptive error. |

---

## 3. Summary Table

| Severity | Count | Key Themes |
|----------|-------|------------|
| **Critical** | 5 | SSRF (C1), header injection (C2, C3), token in query string (C4), HTML injection (C5) |
| **High** | 7 | No timeouts (H1), credential leakage in errors (H2, H3), unrestricted HTTP methods (H4), unbounded concurrency (H5), host validation gaps (H6, H7) |
| **Medium** | 6 | Missing input validation (M1), field override (M2), URL echo in errors (M3), unsafe type casts (M4), response body exposure (M5), HTTP allowed (M6) |
| **Low** | 4 | No size limits (L1), error cast safety (L2), source maps in prod (L3), URI decode errors (L4) |
| **Total** | **22** | |

---

## 4. Positive Observations

- **Zero runtime dependencies** — eliminates transitive supply-chain risk entirely
- **`strict: true`** in tsconfig — good TypeScript hygiene baseline
- **No `as any` casts** anywhere in the source
- **HTTPS enforced** for all first-party service adapters (Discord, Slack, Telegram, Pushover, Pushbullet, MS Teams)
- **Response body truncated** to 200 chars in `ServiceError`
- **Native `fetch()`** — no third-party HTTP library attack surface
- **Good test coverage** (~130+ test cases, 80% threshold enforced)
- **Renovate configured** with `pin` strategy for deterministic builds

---

## 5. Priority Remediation Roadmap

### Immediate (before any production use)
1. **Add SSRF protection** — validate resolved IPs for webhook/ntfy/gotify hosts (C1, H6, H7)
2. **Add request timeouts** — `AbortSignal.timeout(30_000)` in `base.ts` (H1)
3. **Sanitize header values** — strip CRLF from any user input placed in headers (C3)
4. **Deny-list sensitive headers** in webhook service (C2)
5. **Move Gotify token to header** — use `X-Gotify-Key` instead of query string (C4)
6. **Escape HTML in Telegram** — or switch to MarkdownV2 (C5)
7. **Redact URLs in error messages** — strip credentials/query params (H2, M3)

### Short-term
8. **Add concurrency limits** to dispatcher (H5)
9. **Restrict webhook HTTP methods** to allow-list (H4)
10. **Validate email addresses** before sending (M1)
11. **Add runtime config type guards** in service `send()` methods (M4)

### Long-term
12. **Enforce message size limits** (L1)
13. **Support env-var credential references** as alternative to URL embedding (H3)
14. **Disable source maps in production** (L3)
