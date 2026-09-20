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
the top, each job `contents: read` unless noted (`dependency-review` has its own
workflow since 2026-09-20, see Amendments):

| Job | Extra permissions | What it does |
|---|---|---|
| `lint-ts` | — | ESLint + `prettier --check` on `vscode-extension/src`. |
| `lint-java` | — | `mvn compile spotless:check spotbugs:check` (palantir-java-format + SpotBugs, effort Max / threshold Medium). |
| `typecheck` | — | `tsc --noEmit`. |
| `test-ts` | `id-token: write` | Extension tests under `xvfb`, `--coverage`, upload lcov to Codecov (flag `ts`) via OIDC. |
| `test-java` | `id-token: write` | `mvn verify` (JaCoCo XML), upload to Codecov (flag `java`) via OIDC. |
| `build` | — | `mvn package -DskipTests`, smoke-test the jar (`.github/scripts/smoke-jar.sh`: `GET /health` → 200, run from a directory whose name has a space and an accent), upload it as the `validation-jar` artifact, bundle the jar, `vsce package`, assert the jar is inside the `.vsix`. |
| `os-smoke` | — | `windows-latest` and `macos-latest` matrix, `needs: build`: download the `validation-jar` artifact, run the same smoke script, then `npm run test:unit`. No Codecov upload. Advisory: not a required check of the `main` ruleset until it is stably green (ADR 0005, attribute 4). |
| `audit-advisory` | `actions: read`, `security-events: write` | PR only, **non-blocking** reusable OSV-Scanner PR workflow; pushes SARIF to the Security tab. |

Build tooling for the Java module (Spotless, SpotBugs, JaCoCo, Enforcer) is
pinned in `pom.xml` and bound to `verify`; `.pre-commit-config.yaml` offers the
same hooks locally (not mandatory).

### Coverage gate — Codecov (`codecov.yml`)

- Uploads per PR: two under flag `ts` (out-of-host unit layer +
  `@vscode/test-cli` integration) and one under flag `java`, all over
  **OIDC — no token**. Codecov merges the two `ts` reports by union.
- `project` status `auto` (**1 %** threshold, 0 % until 2026-09-20; advisory by the
  maintainer's choice, not a required check); `patch` status target **80 %**.
- `component_management`: a `ts` component (`paths: vscode-extension/src/**`)
  and a `java` component, **each carrying a `project` 90 % status** (80 % until
  2026-09-20; exact mirrors); both also inherit the repo `patch` 80 %. The
  `java` gate landed with socle #116, the `ts` gate with socle #136 (see
  Amendments).
- `ignore`: Spring entrypoint, `model/**`, `config/MatchboxEngineConfig.java`
  (was `config/**` until 2026-09-20), `test/**` (the last also covers
  `vscode-extension/src/test/**`).

### Dependency hygiene

- **On every PR**: `dependency-review` (block newly introduced high/critical
  advisories and strong-copyleft licences) + `audit-advisory` (OSV, advisory
  only).
- **Weekly**: `audit.yml` (cron Monday 06:00 UTC + `workflow_dispatch`)
  replays OSV-Scanner over `pom.xml` + `package-lock.json` and uploads the SARIF:
  each vulnerability is a Code scanning alert (category `osv-scanner`) that closes
  by itself once the dependency is fixed. No issue is opened (see the 2026-09-20
  amendment on Code scanning). A finding is a result, not a failure: the job stays
  green. It only fails when the scan itself cannot run (no package picked up,
  binary or network outage).
- **CodeQL** (GitHub default setup, no workflow file): static analysis of
  `actions`, `java-kotlin` and `javascript-typescript` on PRs, on pushes to `main`
  and on a schedule, reported as Code scanning alerts next to the OSV ones.
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
| `audit.yml` | `audit`: `security-events: write`, `actions: read`. |
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
| Code scanning — CodeQL default setup | on (`actions`, `java-kotlin`, `javascript-typescript`, `default` suite) — see Amendments |
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
  pre-existing dependencies; the PR scan is advisory and the weekly scan reports
  through the Security tab and an issue (see the 2026-09-20 amendment).
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

### 2026-09-20 — the weekly OSV scan no longer fails the job on findings

`audit.yml` ended with a step that ran `exit 1` whenever OSV-Scanner reported a
vulnerability (scanner exit code 1). The run then went red even though the
scan had completed, the SARIF was uploaded and the issue was opened, mixing up
"the scan found something" with "the pipeline is broken". A red run also
trains people to ignore the audit workflow.

- A finding (exit 1) is now a **result**: the job stays green, and the signal
  goes through the SARIF in the Security tab (alerts) and the deduplicated
  `dependencies` issue.
- Unchanged: exit 128 (no package picked up, i.e. a configuration error) and
  exit >= 127 (binary or network outage) still fail the job and open no issue.
- The job is renamed `osv-scanner (bloquant)` → `osv-scanner`; it was never a
  required check (scheduled workflow).
- The "weekly, blocking" wording in this ADR, `README.md`, `ci.yml` and
  `osv-scanner.toml` is aligned.

### 2026-09-20 — Code scanning alerts replace the OSV issue; CodeQL enabled

`audit.yml` uploaded the OSV SARIF **and** opened a `dependencies` issue,
deduplicated by title, on every detection. The two signals disagreed in time: on
2026-09-20 the two `CVE-2026-84375` alerts (`vscode-extension/package-lock.json`)
closed by themselves once a bump landed, while issue #176, opened for the same
detection, stayed open because nothing closes it.

- **OSV reports through Code scanning only.** The `open-issue` job, the
  `vulns-found` output and the `issues: write` permission are removed from
  `audit.yml` (least privilege: the file now holds only `security-events: write`
  and `actions: read`). An alert is opened by the scan, closed by the next scan
  once the dependency is fixed, and can be dismissed with a reason.
  `osv-scanner.toml` stays the suppression mechanism for false positives. The
  earlier amendment of the same date that mentions the deduplicated issue is
  superseded on that point only.
- **CodeQL default setup enabled** (repository setting, no workflow file; done
  with `PATCH /repos/aphp/fhir-mapbuilder/code-scanning/default-setup`):
  languages `actions`, `java-kotlin`, `javascript-typescript`, `default` query
  suite, `remote` threat model, run on PRs, on pushes to `main` and on a schedule.
  It complements OSV (static analysis of our code, where OSV only looks at
  dependencies), is free on a public repository, and its `actions` analysis reads
  the workflows this ADR is about. It is the approach of the reference repo.
- **First scan** on `main`: `actions` 0, `javascript-typescript` 0,
  `java-kotlin` 11 (8 `java/path-injection`, high, in `FileUtils` and
  `MatchBoxService`; 3 `java/error-message-exposure`, medium, in
  `MatchBoxController`). These are findings on the validation REST API to triage
  and are **not** fixed by this change.

**Not done, on purpose:** a `code_scanning` rule on the `main` ruleset (a PR
introducing an alert would be blocked). It overlaps `dependency-review`, which
already blocks newly introduced high/critical advisories, and an OSV scan that
blocks PRs was rejected above as too noisy. It can be added later per tool.
Notifications are a per-user GitHub setting (*Watch → Custom → Security
alerts*), not something the repository can configure; `CONTRIBUTING.md` says so.

The decision of record for CodeQL is now the "CodeQL" section of ADR 0005
(advisory, suite `default`, re-evaluation on 2026-11-30). This amendment stays
as history.

### 2026-09-20 — Codecov component floors go from 80 % to 90 %

ADR 0005 (section "Coverage") hardens the coverage gate. The floors had stayed at
80 % while Codecov measured `ts` 96.16 %, `java` 95.42 % and 96.09 % for the
repository, about 15 points above. §"Coverage gate" above is updated in place;
what changed in `codecov.yml`:

- **Component floors.** The `project` statuses of the `ts` and `java` components
  go from 80 % to **90 %**. This is the ceiling: no further steps. The status
  names do not change, so the required checks of the `main` ruleset
  (`codecov/project/ts`, `codecov/project/java`, `codecov/patch`) keep matching.
- **Repo `project` status.** It stays `auto`, and its threshold goes from 0 % to
  **1 %** (a PR cannot lower the total by more than one point), with no numeric
  target. It is **advisory**: `codecov/project` is not among the required checks
  of the `main` ruleset, so a breach shows a red check without blocking the merge.
  This is the maintainer's choice: the proposal to require it (#217) was closed as
  not planned, because the overall coverage rate is not to be mandatory. The
  component floors and `patch` stay required; the total of the repository does not.
- **Ignore.** `**/config/**` is replaced by `**/config/MatchboxEngineConfig.java`.
  The broad pattern hid `ApiTokenFilter`, the authentication code of the
  validation server, although its tests cover it fully. `MatchboxEngineConfig`
  stays out: it is Spring wiring (the engine bean, the port customizer) with no
  logic of its own.

Unchanged: repo `patch` 80 % (both stacks), the other ignores, the tokenless OIDC
uploads. After this change a floor is lowered only through a motivated, dated
exception decided at the monthly review (ADR 0005).

### 2026-09-20 — `dependency-review` moves to its own workflow

The Actions list of this repository is aligned on the sibling repositories
(`datahub-yaml-source`, and the reference repository of ADR 0001), where
`dependency-review` is a workflow of its own.

- **What moved.** The `dependency-review` job leaves `ci.yml` for
  `.github/workflows/dependency-review.yml`, unchanged: same action
  (`actions/dependency-review-action`, `fail-on-severity: high`, strong-copyleft
  `deny-licenses`), same job name. The check keeps the name `dependency-review`, so
  the required check of the `main` ruleset still matches. `audit.yml` is renamed
  "Audit dependencies" (it was "Audit dépendances") to match the English names of
  the other workflows.
- **Release PR.** release-please opens its PR with the `GITHUB_TOKEN`, which emits
  no `pull_request` (ADR 0003, amendment on the required checks). `release.yml`
  already re-triggers `ci.yml` and `commit-policy.yml` with `workflow_dispatch`; it
  now re-triggers `dependency-review.yml` too. The new workflow declares
  `workflow_dispatch` and its job is skipped there, as it was inside `ci.yml`: a
  skipped required check counts as passing.

Unchanged: the trigger (pull requests to `main`), the gates, the tag pin of the
action, and the rest of §"Dependency hygiene".
