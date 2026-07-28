#!/usr/bin/env node
// Checks whether the npm `overrides` in each manifest are still required.
//
// For every override we force-pin (e.g. `esbuild: ">=0.28.1"`), we ask a simple
// question: if the override were removed and the tree re-resolved from scratch,
// would npm naturally pick a version that already satisfies the pin? If so the
// ecosystem has caught up and the override is now redundant cruft that can be
// dropped. If not, the override is still doing real work and must stay.
//
// The check is deliberately conservative: anything it cannot prove redundant is
// reported as "keep", and any resolution failure aborts with a non-zero exit so
// the workflow surfaces it instead of silently claiming an override is removable.
//
// No third-party dependencies — Node built-ins plus `npm` only.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

// Manifests that carry overrides. Paths are relative to the repo root.
const MANIFESTS = ['.', 'website']

/** Parse a version string "a.b.c" into numeric parts (prerelease/build ignored). */
function parseVersion(v) {
  const core = String(v).replace(/^[^\d]*/, '').split(/[-+]/)[0]
  return core.split('.').map((n) => Number.parseInt(n, 10) || 0)
}

/** Compare two versions. Returns -1, 0, or 1. */
function compareVersions(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}

/** The floor version implied by a constraint string, e.g. ">=0.28.1" -> "0.28.1". */
function floorOf(constraint) {
  const m = String(constraint).match(/\d+\.\d+\.\d+/)
  return m ? m[0] : '0.0.0'
}

/**
 * Flatten a manifest's `overrides` object into a list of entries we can test.
 * Handles both top-level (`{ pkg: range }`) and single-level nested/parent-scoped
 * overrides (`{ parent: { pkg: range } }`).
 */
function collectOverrides(overrides) {
  const entries = []
  for (const [key, value] of Object.entries(overrides || {})) {
    if (value && typeof value === 'object') {
      for (const [pkg, range] of Object.entries(value)) {
        entries.push({ pkg, range, parent: key })
      }
    } else {
      entries.push({ pkg: key, range: value, parent: null })
    }
  }
  return entries
}

/** Return a deep clone of `overrides` with one entry removed, pruning empties. */
function overrideswithout(overrides, target) {
  const clone = JSON.parse(JSON.stringify(overrides))
  if (target.parent) {
    delete clone[target.parent][target.pkg]
    if (Object.keys(clone[target.parent]).length === 0) delete clone[target.parent]
  } else {
    delete clone[target.pkg]
  }
  return clone
}

/** All resolved versions of `pkg` in a freshly generated lockfile. */
function resolvedVersions(lockfile, pkg) {
  const versions = []
  for (const [path, meta] of Object.entries(lockfile.packages || {})) {
    if (!path) continue // the root package itself has an empty key
    const name = path.split('node_modules/').pop()
    if (name === pkg && meta && meta.version) versions.push(meta.version)
  }
  return versions
}

/**
 * Re-resolve `manifestDir` with `target` removed from overrides and decide
 * whether the override is still required.
 */
function evaluate(manifestDir, pkgJson, target) {
  const scratch = mkdtempSync(join(tmpdir(), 'override-check-'))
  try {
    const trimmed = JSON.parse(JSON.stringify(pkgJson))
    trimmed.overrides = overrideswithout(pkgJson.overrides, target)
    if (Object.keys(trimmed.overrides).length === 0) delete trimmed.overrides
    writeFileSync(join(scratch, 'package.json'), JSON.stringify(trimmed, null, 2))

    // Fresh resolution from scratch (no lockfile copied in) so we see what npm
    // would pick today given every parent's declared ranges.
    execFileSync(
      'npm',
      ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
      { cwd: scratch, stdio: 'pipe' },
    )

    const lockfile = JSON.parse(readFileSync(join(scratch, 'package-lock.json'), 'utf8'))
    const floor = floorOf(target.range)
    const floorMajor = parseVersion(floor)[0]
    const isCaret = String(target.range).trim().startsWith('^')

    // Only instances that could plausibly be what the override targets: same
    // major for caret pins, same-or-higher major otherwise. This deliberately
    // ignores unrelated older majors that a scoped override never touched
    // (e.g. a js-yaml 3.x copy while the override targets the 4.x line).
    const relevant = resolvedVersions(lockfile, target.pkg).filter((v) => {
      const major = parseVersion(v)[0]
      return isCaret ? major === floorMajor : major >= floorMajor
    })

    if (relevant.length === 0) {
      return { removable: true, detail: `no ${target.pkg} in the targeted range remains after removal` }
    }
    const belowFloor = relevant.filter((v) => compareVersions(v, floor) < 0)
    if (belowFloor.length === 0) {
      const seen = [...new Set(relevant)].sort(compareVersions).join(', ')
      return { removable: true, detail: `natural resolution yields ${target.pkg}@${seen}, already satisfying \`${target.range}\`` }
    }
    const worst = [...new Set(belowFloor)].sort(compareVersions).join(', ')
    return { removable: false, detail: `natural resolution still yields vulnerable ${target.pkg}@${worst} (below \`${target.range}\`)` }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

const results = []
for (const dir of MANIFESTS) {
  const pkgPath = join(repoRoot, dir, 'package.json')
  let pkgJson
  try {
    pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    continue
  }
  const overrides = collectOverrides(pkgJson.overrides)
  for (const target of overrides) {
    const label = target.parent ? `${target.parent} › ${target.pkg}` : target.pkg
    process.stderr.write(`Checking ${dir === '.' ? 'root' : dir}: ${label} (${target.range})…\n`)
    const outcome = evaluate(join(repoRoot, dir), pkgJson, target)
    results.push({ manifest: dir === '.' ? 'root (package.json)' : `${dir}/package.json`, label, range: target.range, ...outcome })
  }
}

const removable = results.filter((r) => r.removable)

// Human-readable report.
const lines = []
lines.push('## Dependency override audit')
lines.push('')
lines.push(`Checked ${results.length} override${results.length === 1 ? '' : 's'} across the project's manifests. An override is flagged **removable** when re-resolving the dependency tree without it already yields a version that satisfies the pin — meaning the upstream package has caught up and the manual pin is now redundant.`)
lines.push('')
if (removable.length === 0) {
  lines.push('✅ **All overrides are still required.** No action needed.')
} else {
  lines.push(`### 🧹 ${removable.length} override${removable.length === 1 ? '' : 's'} may be removable`)
  lines.push('')
  lines.push('| Manifest | Override | Pin | Why it looks removable |')
  lines.push('| --- | --- | --- | --- |')
  for (const r of removable) {
    lines.push(`| \`${r.manifest}\` | \`${r.label}\` | \`${r.range}\` | ${r.detail} |`)
  }
  lines.push('')
  lines.push('**Suggested next step:** remove the flagged override(s) from the relevant `package.json`, run `npm install` to regenerate the lockfile, and confirm the build/tests pass and the original Dependabot alert stays closed. If CI is green, the pin can be dropped.')
}
const stillNeeded = results.filter((r) => !r.removable)
if (stillNeeded.length > 0) {
  lines.push('')
  lines.push('<details><summary>Overrides still required</summary>')
  lines.push('')
  lines.push('| Manifest | Override | Pin | Reason |')
  lines.push('| --- | --- | --- | --- |')
  for (const r of stillNeeded) {
    lines.push(`| \`${r.manifest}\` | \`${r.label}\` | \`${r.range}\` | ${r.detail} |`)
  }
  lines.push('')
  lines.push('</details>')
}
lines.push('')
lines.push('<sub>Generated by the weekly override-audit workflow (`.github/workflows/override-audit.yml`).</sub>')

const report = lines.join('\n')
writeFileSync(join(repoRoot, 'override-audit-report.md'), `${report}\n`)
process.stdout.write(`${report}\n`)

if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `removable=${removable.length > 0}\ncount=${removable.length}\n`, { flag: 'a' })
}
