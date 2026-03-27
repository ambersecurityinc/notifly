# Pre-Publish Checklist

- [x] Update `repository.url` in `package.json` with your actual GitHub repo URL
- [x] Update badge URLs in `README.md` with your actual GitHub repo/npm package
- [ ] Create a granular npm access token (read-write, scoped to `@ambersecurityinc/notifly`)
- [x] Add the token as `NPM_TOKEN` secret in your GitHub repo settings
- [x] Run `first-publish.yml` via GitHub Actions (Actions tab → First Publish → Run workflow)
- [x] Verify the package appears at https://www.npmjs.com/package/@ambersecurityinc%2fnotifly

# Post-First-Publish

- [ ] Go to https://www.npmjs.com/package/@ambersecurityinc%2fnotifly/access
- [ ] Under "Trusted Publisher", select GitHub Actions
- [ ] Fill in: org `ambersecurityinc`, repository `notifly`, workflow filename `release.yml`
- [ ] Enable "Require two-factor authentication and disallow tokens" (recommended)
- [ ] Go to GitHub repo → Settings → Actions → first-publish.yml → Disable workflow
- [ ] Delete the `NPM_TOKEN` secret from GitHub repo settings
- [ ] Delete this file
