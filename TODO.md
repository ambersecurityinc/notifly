# Pre-Publish Checklist

- [ ] Update `repository.url` in `package.json` with your actual GitHub repo URL
- [ ] Update badge URLs in `README.md` with your actual GitHub repo/npm package
- [ ] Create a granular npm access token (read-write, scoped to `notifly`)
- [ ] Add the token as `NPM_TOKEN` secret in your GitHub repo settings
- [ ] Run `first-publish.yml` via GitHub Actions (Actions tab → First Publish → Run workflow)
- [ ] Verify the package appears at https://www.npmjs.com/package/notifly

# Post-First-Publish

- [ ] Go to https://www.npmjs.com/package/notifly/access
- [ ] Under "Trusted Publisher", select GitHub Actions
- [ ] Fill in: org/user, repository (`notifly`), workflow filename (`release.yml`)
- [ ] Enable "Require two-factor authentication and disallow tokens" (recommended)
- [ ] Go to GitHub repo → Settings → Actions → first-publish.yml → Disable workflow
- [ ] Delete the `NPM_TOKEN` secret from GitHub repo settings
- [ ] Delete this file
