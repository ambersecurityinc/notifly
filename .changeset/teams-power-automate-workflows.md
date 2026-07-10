---
"@ambersecurityinc/notifly": minor
---

Add Microsoft Teams **Workflows** (Power Automate) webhook support via the new `workflows://` (alias `workflow://`) scheme. This is the successor to the retiring Office 365 `msteams://` incoming connectors. The full HTTPS webhook URL — including its `sig` token — is preserved by swapping the scheme, and the builder's `smartParse`/`detectAndConvert` now recognize raw Power Automate and Logic Apps webhook URLs (`.../triggers/manual/paths/invoke?...&sig=...`).
