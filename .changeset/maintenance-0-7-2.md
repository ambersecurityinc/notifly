---
"@ambersecurityinc/notifly": patch
---

Maintenance release: refresh dev tooling and the release pipeline.

- Upgrade test and release tooling: vitest 5, @vitest/coverage-v8 5, @changesets/cli 3, esbuild override 0.28.2.
- Fix the Release workflow for changesets/action v2 (`publish` input renamed to `publish-script`).
- Regenerate both `package-lock.json` files from scratch to drop stale nested duplicate entries.

No changes to the published API or runtime behavior.
