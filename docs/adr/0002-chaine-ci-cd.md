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

- Uploads per PR: two under flag `ts` (out-of-host unit layer +
  `@vscode/test-cli` integration) and one under flag `java`, all over
  **OIDC — no token**. Codecov merges the two `ts` reports by union.
- `project` status `auto` (0 % threshold); `patch` status target **80 %**.
- `component_management`: a `ts` component (`paths: vscode-extension/src/**`)
  and a `java` component, **each carrying a `project` 80 % status** (exact
  mirrors); both also inherit the repo `patch` 80 %. The `java` gate landed
  with socle #116, the `ts` gate with socle #136 (see Amendments).
- `ignore`: Spring entrypoint, `model/**`, `config/**`, `test/**` (the last
  also covers `vscode-extension/src/test/**`).

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
  `prod-minor-patch`; `actions` group for the third) — **every group is bounded
  to `update-types: [minor, patch]`**, so a major update is never bundled
  inside a group PR that otherwise looks safe; it surfaces as its own
  individual PR instead. (Initially `dev-dependencies` had no such bound; a
  `typescript ^5 -> ^7` major riding along with safe patches broke `npm ci`
  with an `@typescript-eslint` peer conflict — see PR #97 / the follow-up fix.)
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
| `can_approve_pull_request_reviews` (Actions) | `false` — **reverted to `true`, see Amendments** |

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

## Amendments

### 2026-09-03 — the `ts` Codecov component becomes blocking (`project` 80 %)

Two mentions in §"Coverage gate" above were stale: the `ts` component described
as carrying only the repo `patch` 80 %, and the `java` component as
`informational` until its socle.

- `java`: socle #116 made its `project` 80 % blocking (already in `codecov.yml`).
- `ts`: the VS Code extension coverage socle (wayfinder map #136) takes
  `vscode-extension/src/**` above 80 % line coverage. The `ts` component now
  carries a `project` 80 % status of its own, an exact mirror of `java`; its
  `paths` is narrowed from `vscode-extension/**` to `vscode-extension/src/**`.

Unchanged: repo `patch` 80 % (both stacks), repo `project` `auto`/0 % (trend),
tokenless OIDC upload. `ts` coverage is now pushed as **two uploads** under the
`ts` flag — an out-of-host unit layer (`mocha` + `sinon`, `require("vscode")`
stubbed via a `Module._load` hook; suites in `src/test/unit/`) and the existing
`@vscode/test-cli` integration suite — which Codecov merges by union. The
`test-ts` job carries both test steps and both `codecov-action` steps; both
c8 runs report every `src/**` file with a real denominator (unit run:
`c8 --all --src src`; integration run: `.vscode-test.mjs` `includeAll: true` +
`srcDir: 'src'`).

`codecov/project/ts` is added to the `main` ruleset's `required_status_checks`
once green (ADR 0001 "as each one first goes green"). (Wayfinder map #136,
tickets #137–#142; execution #144–#150.)

### 2026-09-02 — `can_approve_pull_request_reviews` set back to `true`

The security-posture table above set *"Allow GitHub Actions to create and
approve pull requests"* (`can_approve_pull_request_reviews`) to `false`. That
same toggle also governs Actions **creating** PRs, which ADR 0003's release
automation depends on: the first push to `main` with a releasable commit made
`release.yml`'s `release-please` job fail with *"GitHub Actions is not permitted
to create or approve pull requests."*

Resolution: the toggle is set back to **`true`** (`default_workflow_permissions`
stays `read`). release-please now opens its release PR with the built-in
`GITHUB_TOKEN`, and no additional long-lived PAT / GitHub App is introduced
(which keeps the ADR 0003 PAT debt from growing).

Residual exposure — Actions *can* now also approve PRs — is low for this repo:
the `main` ruleset requires zero approvals, there is no `CODEOWNERS`, and
Dependabot auto-merge uses `gh pr merge --auto`, not an Actions-side approval.
(Wayfinder map #109, ticket #121.)
