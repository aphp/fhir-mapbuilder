# 2. CI/CD chain, dependency hygiene and security posture

Date: 2026-09-01

## Status

Accepted.

Part of the alignment of `fhir-mapbuilder` engineering practices on the reference
repository `davidouagne/datahub-healthdcat-ap-exporter` (spec #80, wayfinder map
#66). Companion records: 0001 (commit policy), 0003 (versioning & release). This
record collates the CI, dependency and security decisions from wayfinder tickets
#71–#77; it does not reopen them. Implemented across tickets T1, T2, T3, T4, T6
and T7 (#88).

## Context

Before this work:

- Two separate CI workflows (`test.yml`, `test-java.yml`) with no minimal
  `permissions:` per job. `default_workflow_permissions` was `write`.
- The Java module `fhir-mapbuilder-validation` had **no tests**; `test-java.yml`
  was green without verifying anything. No coverage gate. No Java static
  analysis, no formatter. TypeScript formatting was not checked in CI.
- No dependency vulnerability audit in CI, no `dependency-review`, no licence
  policy.
- `secret scanning`, `push protection` and `private vulnerability reporting`
  were disabled. No branch ruleset.

## Decision

### One consolidated `ci.yml`

A single workflow on `pull_request` and `push` to `main`, `permissions: {}` at
the top, each job `contents: read` unless noted:

| Job | Extra permissions | What it does |
|---|---|---|
| `lint-ts` | — | ESLint + `prettier --check` on `vscode-extension/src`. |
| `lint-java` | — | `mvn compile spotless:check spotbugs:check` (palantir-java-format + SpotBugs, effort Max / threshold Medium). |
| `typecheck` | — | `tsc --noEmit`. |
| `test-ts` | `id-token: write` | Extension tests under `xvfb`, `--coverage`, upload lcov to Codecov (flag `ts`) via OIDC. |
| `test-java` | `id-token: write` | `mvn verify` (JaCoCo XML), upload to Codecov (flag `java`) via OIDC. |
| `build` | — | `mvn package -DskipTests`, bundle the jar, `vsce package`, smoke-test the jar (`GET /health` → 200), assert the jar is inside the `.vsix`. |
| `dependency-review` | — | PR only: `actions/dependency-review-action`, `fail-on-severity: high`, strong-copyleft `deny-licenses`. |
| `audit-advisory` | `actions: read`, `security-events: write` | PR only, **non-blocking** reusable OSV-Scanner PR workflow; pushes SARIF to the Security tab. |

Build tooling for the Java module (Spotless, SpotBugs, JaCoCo, Enforcer) is
pinned in `pom.xml` and bound to `verify`; `.pre-commit-config.yaml` offers the
same hooks locally (not mandatory).

### Coverage gate — Codecov (`codecov.yml`)

- Two uploads per PR, flags `ts` and `java`, over **OIDC — no token**.
- `project` status `auto` (0 % threshold); `patch` status target **80 %**.
- `component_management`: a `ts` component (patch enforced) and a `java`
  component whose patch status is `informational` until the Java test socle
  reaches the target (trigger recorded in `codecov.yml`).
- `ignore`: Spring entrypoint, `model/**`, `config/**`, `test/**`.

### Dependency hygiene

- **On every PR**: `dependency-review` (block newly introduced high/critical
  advisories and strong-copyleft licences) + `audit-advisory` (OSV, advisory
  only).
- **Weekly, blocking**: `audit.yml` (cron Monday 06:00 UTC + `workflow_dispatch`)
  replays OSV-Scanner over `pom.xml` + `package-lock.json`, uploads SARIF, and on
  a real finding opens a `dependencies` issue deduplicated by title.
- **Suppression**: time-boxed `[[IgnoredVulns]]` entries in the root
  `osv-scanner.toml`, rationale kept in `CONTRIBUTING.md`. Empty today.
- **`dependabot.yml`**: three ecosystems — `maven` (`/fhir-mapbuilder-validation`),
  `npm` (`/vscode-extension`), `github-actions` (`/`). Weekly on Monday,
  `build` commit prefix, `dependencies` label, grouped (`dev-dependencies` +
  `prod-minor-patch`; `actions` group for the third).
- **`dependabot-auto-merge.yml`**: `pull_request`, `permissions: {}`; a
  `dependabot[bot]`-gated job reads `dependabot/fetch-metadata` and enables
  `gh pr merge --auto --merge` for `version-update:semver-patch`, or
  `semver-minor` on a `direct:development` dependency. All other updates stay
  manual. The bot's PRs still pass `commit-policy.yml` with no bypass.

### Least-privilege workflow permissions

**Every** workflow declares `permissions: {}` at the workflow level and each job
elevates explicitly to the minimum it needs. Current holdings:

| Workflow | Jobs elevating beyond `contents: read` |
|---|---|
| `ci.yml` | `test-ts`, `test-java`: `+id-token: write`. `audit-advisory`: `actions: read`, `security-events: write`. |
| `commit-policy.yml` | `pr-title`: `pull-requests: read` (instead of `contents: read`). |
| `audit.yml` | `audit`: `security-events: write`, `actions: read`. `open-issue`: `issues: write`. |
| `dependabot-auto-merge.yml` | `dependabot`: `contents: write`, `pull-requests: write`. |
| `release.yml` | `release-please`: `contents/pull-requests/issues: write`. `build`: `contents: write`. `publish-openvsx`: `+id-token: write`. `smoke`: `{}`. |

A `grep -nE 'permissions:' .github/workflows/*.yml` shows a workflow-level and a
per-job entry in each file.

### Security posture — repository settings to apply in T9

These are **not** settable from a workflow file; they are applied to the GitHub
repository in ticket T9:

| Setting | Target |
|---|---|
| Secret scanning | on |
| Push protection | on |
| Private vulnerability reporting | on |
| Dependabot alerts | on |
| Dependabot security updates | **off** (version updates + the audit workflows cover this) |
| `default_workflow_permissions` | `read` |
| `can_approve_pull_request_reviews` (Actions) | `false` |

The `main` ruleset itself is ADR 0001's domain.

## Consequences

- One workflow to read for the PR gate; the Java module is actually tested and
  measured, and formatting / static analysis fail the build.
- New high/critical advisories and strong-copyleft licences cannot enter through
  a PR; a fresh advisory on an existing dependency is caught within a week and
  raised as an issue.
- Most Dependabot noise merges itself; only prod minors and majors need a human.
- A workflow that needs a new permission must add it to the specific job, in the
  open, in the diff.
- The repository-level switches in the table above remain a manual step (T9)
  until applied.

## Alternatives considered

- **Keep `test.yml` + `test-java.yml` separate.** Rejected: duplicated setup, no
  shared `permissions:` discipline, and a green-but-empty Java job.
- **Blocking OSV scan on every PR.** Rejected as too noisy for advisories on
  pre-existing dependencies; the PR scan is advisory and the weekly scan is the
  blocking one.
- **Dependabot security updates on.** Rejected: they overlap the version-update
  PRs and the audit workflows, and would open ungrouped one-off PRs.
- **Broad `GITHUB_TOKEN` (`write`) by default.** Rejected: least privilege per
  job is the whole point of the `permissions: {}` baseline.
