# 5. Code quality steering

Date: 2026-09-20

## Status

Accepted.

Assembles the decisions of the wayfinder map "Pilotage de la qualité du code" (#155):
the quality attributes (#156), the ESLint debt policy (#157), the coverage ratchet
(#158), the dashboard (#160), the solo ritual (#161) and CodeQL (#163), on top of
two research notes (free quality signals, small-OSS practices). Companion records:
0001 (commit policy), 0002 (CI/CD chain), 0003 (versioning and release). It
decides nothing new: each decision lives in its ticket, this record is the one
place that states them together. It is numbered 0005 because 0004 (API token) was
merged while the map was under way.

## Context

The repository already has a quality machinery, decided in 0001 to 0003: ESLint,
Prettier and `tsc` for TypeScript; Spotless and SpotBugs (blocking) for Java;
Codecov gates at 80 % on the patch and on each component (`ts`, `java`); OSV
scanning; grouped Dependabot with auto-merge for safe updates; commitlint and DCO.

What it lacked on 2026-09-20:

- **Lint had no resting state.** Every project ESLint rule was `warn` ("migration
  phase"): 26 warnings (14 `no-unused-vars`, 7 `no-explicit-any`, 4 `prefer-const`,
  1 `no-unused-expressions`), and `npx eslint src` in CI never fails on a warning.
  Nothing prevented the count from growing.
- **Coverage floors lagged reality.** The component floors sat at 80 % while Codecov
  measured `ts` 96.10 %, `java` 95.42 % and the repo 96.04 %: a drop from 96 % to
  81 % would still pass. The `**/config/**` ignore also hid the authentication code
  added the same day.
- **No readout and no rhythm.** No trend view, no recurring review, a solo
  maintainer with no written cadence.
- **CodeQL was absent, then enabled.** It was switched on the same day (ADR 0002,
  amendment of 2026-09-20). Its first scan produced 11 alerts on the validation
  service and fed a published security advisory. The research had assumed a small
  attack surface; the product showed otherwise.

The product is a VS Code extension plus a local Java service embedding Matchbox,
maintained by one person.

## Decision

### Quality attributes

Six attributes, ranked by how badly a silent failure would mislead a mapping author.

| # | Attribute | Definition | Signal | Status |
|---|---|---|---|---|
| 1 | Result fidelity | What the extension shows (validation, errors, transformation) is what Matchbox produced, without loss or distortion | Regression tests on reference FML cases; escaped "wrong result" bugs | measured |
| 2 | Local surface security | What the local validation server exposes, and to whom | Open code scanning alerts (CodeQL + OSV); published advisories | measured |
| 3 | Java process lifecycle | Missing Java, busy port, crash and restart are handled | Release `smoke` job; lifecycle issues | measured |
| 4 | OS parity | Same behaviour on Windows, macOS and Linux | Smoke test on `windows-latest` and `macos-latest` | **unmeasured**: CI runs on `ubuntu-latest` only |
| 5 | Up-to-date documentation | ADRs, README and CONTRIBUTING contain no stale claim | Monthly checkpoint | measured |
| 6 | Code readability and navigability, for the maintainer and for agents | | ESLint warning count; churn × complexity hotspots | measured |

Result fidelity merges "translation exactness" and "validation fidelity": the FML
to StructureMap translation is done by Matchbox, and what this repository owns is
relaying the result and its error messages faithfully. **Not guaranteed**:
activation latency (no measurement, cost too high for a solo maintainer) and
offline operation (false today, FHIR packages are downloaded at runtime).

### ESLint: no `warn` state

- One batch, in a separate execution spec: fix the warnings and switch every
  project rule to `error` in the same PR, on `src` and `src/test` alike. Due
  **2026-10-31**.
- `no-explicit-any` is fixed in the batch when the typing is simple. What cannot be
  goes into a frozen `eslint-suppressions.json`, to be emptied by **2027-03-31**.
  If a date is missed, the monthly review decides a single, motivated postponement.
- A new rule arrives as `error` (with a baseline if needed), never as `warn`. A rule
  that is not wanted is `off`, with a dated reason in `eslint.config.js`.
- The ratchet is ESLint's own bulk suppressions (ESLint 10.10.0): a new violation of
  a suppressed rule fails, and so does a suppression whose violation was fixed until
  `--prune-suppressions` is run. `--suppress-all` only covers `error`-level
  violations, hence `error` first. No script, no numeric threshold.
- Java: no trajectory for SpotBugs. `spotbugs-exclude.xml` holds three exclusions,
  each scoped and commented; the rule in its header stays, and the list is re-read
  at the monthly review.

### Coverage

- Component floors (`ts`, `java`) go from 80 % to **90 %** in one step, which is the
  ceiling: no further steps. The measured level is about 5 points above, so this is
  not a wall.
- A floor is lowered only by a motivated, dated exception decided at the monthly
  review, with a date to return to the level.
- The repo-level `project` status stays `auto`, with `threshold: 1%` (a PR cannot
  lower the total by more than one point) and no numeric target.
- The `**/config/**` ignore is replaced by a targeted ignore of
  `MatchboxEngineConfig.java`, so `ApiTokenFilter` counts.
- A manual edit of `codecov.yml`, committed as `build`. Due **2026-10-31**.
- The Codecov read endpoints answer without a token on this public repository
  (checked on 2026-09-20), which corrects the free-signals research.

### Dashboard

No home-made dashboard. One pinned issue, "Quality dashboard", is a **journal**: one
dated comment per monthly review with the readings, and links to the live views
(Codecov, Security tab, Actions), which stay the source of truth. A journal, unlike
an alert, does not have to close itself, which is the point of ADR 0002's
amendment on OSV.

Seven readings, each tied to an attribute: `ts` and `java` coverage; the count of
`wrong-result` bugs; open code scanning alerts and advisories; the release `smoke`
result and lifecycle issues; the documentation checkpoint; ESLint warnings, then
the size of `eslint-suppressions.json`; churn × complexity hotspots (quarterly).
Dropped: PR cycle time, flaky rate, the SpotBugs counter, CI duration.

Community Standards (75 % on 2026-09-20) are completed with a bug issue template
and a `CODE_OF_CONDUCT` (the latter stays a governance choice of the maintainer).
The update is manual, with a written trigger to automate: if the readout takes more
than 30 minutes, or a month is skipped twice, add a `schedule` + `workflow_dispatch`
workflow, like `audit.yml`, that posts the comment.

### Monthly ritual and Definition of Done

- **Review** on the first Monday of the month, after the weekly OSV scan
  (Monday 06:00 UTC), about 30 minutes: the seven readings; the floors and the
  suppressions baseline against their dates, including any exception; the `quality`
  backlog; the documentation checkpoint; the flaky list. The agenda template lives
  in the body of the pinned issue.
- **Backlog**: a `quality` label on ordinary issues, no GitHub Project. At least one
  `quality` item closed per month when the backlog is not empty.
- **Definition of Done**, three lines in the PR template: I reviewed my own diff on
  GitHub; no new lint suppression, coverage exception or `off` rule without a
  written, dated reason; documentation is updated when a behaviour or a command
  changes. `/code-review` is not in the template, since it is the maintainer's
  tooling.
- **No `CODEOWNERS`**: without "review required" it would only request a review
  from a solo maintainer (see the 2026-09-02 amendment of ADR 0002).
- **Flaky tests**: fail-then-pass on re-run with no code change, twice in 30 days,
  means quarantine (`skip` linked to an issue labelled `quality` and `flaky`), fixed
  or deleted within 14 days.
- **Documentation checkpoint**, about 10 minutes: README workflow names and badges
  against `.github/workflows/`, documented commands still run, ADR statuses against
  the code.
- The adoption delay for dependency updates is already covered by Dependabot's
  `cooldown: default-days: 3`.

### CodeQL

Stays on, as a repository setting (default setup): advisory, no `code_scanning`
rule in the `main` ruleset; suite `default`; languages `java-kotlin`,
`javascript-typescript` and `actions`. On a pull request an alert is fixed, or
dismissed with a reason and a comment, before the merge; on `main` it is handled by
the next monthly review at the latest, with the reasons of CONTRIBUTING. Balance
since activation: 13 alerts, 0 open, 2 fixed in code, 11 dismissed as "won't fix",
0 false positive. **Re-evaluation on 2026-11-30** on three criteria: alerts opened,
fixed and dismissed by reason; triage time per month (about one hour, sustained, is
a noise signal); at least one alert that revealed a real defect. Outcomes left
open: keep, add the blocking rule, switch to `security-extended`, disable. This
section is the decision of record; the amendment of ADR 0002 stays as history.

### Not done, on purpose

SonarCloud and SonarQube, mutation testing, knip and a `.vsix` size budget are out
of scope: too heavy for a solo maintainer. They come back only if the destination
of this record is redrawn.

## Consequences

- Lint and coverage regressions fail a build instead of accumulating. The price is a
  baseline file to keep honest and a coverage floor that leaves about 5 points of
  margin, so a real drop is caught but a small one is not.
- A recurring 30 minutes per month and a journal to feed. If the ritual is skipped,
  the dates in this record lapse quietly: the single-postponement rule and the
  written automation trigger are the guard, not a guarantee.
- CodeQL stays advisory, so an alert can be ignored. The PR rule, the monthly review
  and the "open alerts" reading are what turn it into a signal.
- Goodhart: few gates, and coverage read next to the escaped-bug count, so that a
  rising number cannot hide a falling result fidelity. The 90 % ceiling is there on
  purpose.
- OS parity is listed but unmeasured, on purpose: the list says what is not covered.

## Alternatives considered

- **Coverage.** A fixed floor only (blind to a slide from 96 % to 81 %); `auto`
  only at component level (relative, with no absolute guarantee); progressive steps
  85 % then 90 % (pointless when the measured level is already above); automatic
  bump tools (`jest-coverage-ratchet` and similar), which move the floor without a
  decision.
- **Lint.** Keeping `warn` with `--max-warnings N` (an anti-pattern: a number to
  keep aligned by hand and no forced fix); Betterer or `@rushstack/eslint-bulk`
  (a dependency for what ESLint 10 does natively); rules in waves (more coordination
  than 26 warnings deserve); `eslint-plugin-only-warn` (the opposite move).
- **Dashboard.** A scheduled job writing JSON or CSV; a Pages metrics site; a
  GitHub Project; a versioned `docs/quality/` file. Each needs code or a file to
  keep from going stale, for a maintainer who is alone.
- **Ritual.** A per-PR debt budget (already imposed by the floors and the baseline);
  `CODEOWNERS`; `/code-review` as a template checkbox (verifies a ritual, not a
  result); one "Quality review YYYY-MM" issue per month (a pile of issues instead
  of a journal).
- **CodeQL.** `security-extended` (lower-precision queries, more triage);
  blocking now (friction, since 11 of 13 alerts were by-design); not enabling it
  (the first scan found real exposure).

## Execution specs to open next

Not executed by this record.

1. **ESLint batch** — fix the 26 warnings, switch every rule to `error`, freeze the
   residual `any` in `eslint-suppressions.json`. Due 2026-10-31; baseline empty by
   2027-03-31.
2. **`codecov.yml` hardening** — floors at 90 %, repo `project` `auto` with
   `threshold: 1%`, the `config/` ignore narrowed. A `build` commit, due 2026-10-31.
3. **Dashboard set-up** — the pinned "Quality dashboard" issue with the agenda
   template, a bug issue template, `CODE_OF_CONDUCT`, the `quality`, `flaky` and
   `wrong-result` labels, and the three Definition of Done lines in the PR template.
4. **OS parity** — a smoke matrix on `windows-latest` and `macos-latest` to give
   attribute 4 a signal; not yet specified.

CodeQL needs no spec: it is a repository setting.
