# Quality steering for a small, single-maintainer OSS project — research

Research for [issue #162](https://github.com/aphp/fhir-mapbuilder/issues/162), part of wayfinder map
[#155](https://github.com/aphp/fhir-mapbuilder/issues/155) ("Pilotage de la qualité du code").
Destination: **ADR 0004 "Pilotage de la qualité du code"**. Feeds execution tickets
[#157](https://github.com/aphp/fhir-mapbuilder/issues/157),
[#158](https://github.com/aphp/fhir-mapbuilder/issues/158),
[#160](https://github.com/aphp/fhir-mapbuilder/issues/160),
[#161](https://github.com/aphp/fhir-mapbuilder/issues/161),
[#163](https://github.com/aphp/fhir-mapbuilder/issues/163).

## Scope and method

The question: what do current (~2023–2026) public best practices recommend for steering code
quality on a **small, single-maintainer** open-source project — coverage ratchets, moving lint
`warn` → `error` without blocking, "poor-man" dashboards (no SonarQube), realistic solo rituals,
Definition of Done / self-review for one person, whether CodeQL is worth it, and the known traps
(Goodhart, over-aggressive ratchets, coverage theatre).

Sources are primary or high-trust: Codecov docs and engineering blog, ESLint docs and release
blog, GitHub Docs (code scanning / CodeQL, community profile, billing), `coverage.py` /
`pytest-cov` docs, Martin Fowler, Hillel Wayne, the Betterer project, and named OSS engineering
write-ups. Each claim is cited inline. This repo's current state is summarised from
`docs/adr/0001-*`, `docs/adr/0002-*`, `CONTRIBUTING.md`, `codecov.yml`, `.github/workflows/`.

**Repo baseline (do not re-litigate — ADR 0001/0002/0003):** consolidated `ci.yml`; ESLint +
`prettier --check` + `tsc --noEmit` (TS); `spotless:check` + `spotbugs:check` (Java, blocking);
Codecov flags `ts` / `java`, each with a **blocking `project` 80 %** and the repo-wide
**`patch` 80 %**, repo `project` `auto`/0 % for trend; commitlint + DCO; OSV (PR advisory +
weekly blocking); grouped Dependabot + auto-merge. Out of scope for the map: SonarCloud/Sonar,
mutation testing, knip, `.vsix` size budget. CodeQL **is** in scope (ticket #163).

---

## 1. Coverage ratchets: progressive step-ups vs fixed floor vs "never decrease"

### 1.1 The three shapes, and which one to use when

| Shape | What it is | Trade-off |
|---|---|---|
| **Fixed floor** (`--fail-under=N`, `fail_under` in `pyproject.toml`, `codecov project target: N%`) | Build fails if *total* coverage drops below a constant. | Simple, but "allows you to add new code without tests as long as the total percentage does not fall under that value … you can have one file with 0 % coverage as long as other files … make up for this." ([pytest-cov config docs](https://pytest-cov.readthedocs.io/en/latest/config.html); [coverage.py CLI docs](https://coverage.readthedocs.io/en/latest/cmd.html#coverage-summary-text-report-fail-under)) |
| **"Never decrease"** (Codecov `project` with `target: auto`) | `auto` "compares against the base commit coverage"; the PR must **maintain or increase** repo-wide coverage. A `threshold` gives "wiggle room" (e.g. for deleting dead code). ([Codecov commit-status docs](https://docs.codecov.com/docs/commit-status); [codecov.yml reference](https://docs.codecov.com/docs/codecovyml-reference)) | Coverage only ratchets up, no dedicated catch-up effort, but noisy on refactors/large deletions unless `threshold` and `removed_code_behavior` are tuned. |
| **Progressive step-ups** | Set the floor near current coverage; raise it by hand (e.g. 80 → 82 → 85) as tests land. Described in the Codecov maturity model and the "ratchet" literature. ([Codecov "5 Levels of Code Coverage"](https://about.codecov.io/blog/the-5-levels-of-code-coverage-how-to-build-a-testing-culture-in-your-organization/); [Dusty Burwell, "Ratchets"](https://www.dustyburwell.com/2019/05/29/ratchets)) | Deliberate, visible in git history, but manual — needs a ritual to actually happen. |

### 1.2 The recommended combination: patch gate + trend, not a moving project floor

Codecov's own maturity model:

- **Level 1** — expose coverage on every PR with **non-blocking / informational** checks first, to build familiarity.
- **Level 2** — enforce on **new code only**: target `~80 %` on the *patch*, "avoiding the burden of retrofitting legacy code."
- **Level 3** — keep overall coverage from sliding: use **`target: auto`** so each PR "maintains or increases repository-wide coverage", "rather than pursuing arbitrary percentages."
- **Level 4/5** — only then chase a repo-wide 80 %+ number, and note 100 % "isn't always necessary."

Source: [Codecov, "The 5 Levels of Code Coverage"](https://about.codecov.io/blog/the-5-levels-of-code-coverage-how-to-build-a-testing-culture-in-your-organization/).

The "ratchet" pattern generalised: "require that coverage never decreases and that all new code
meets a minimum threshold. Over time, this naturally raises overall coverage without requiring a
dedicated catch-up effort." ([em-tools, Code Coverage Benchmarks & Best Practices](https://www.em-tools.io/engineering-metrics/code-coverage);
[Dusty Burwell, "Ratchets"](https://www.dustyburwell.com/2019/05/29/ratchets) — a good ratchet
"moves only forward", "does not block existing work", "signals which areas need attention", and
only "transitions from warnings to blockers once migration stabilises").

Tooling that automates the step-up so the floor "can never fall back": `jest-coverage-ratchet`,
Vitest's coverage-threshold auto-update, the Jenkins `coverage-ratcheting-plugin`. These bump the
committed threshold up whenever a run exceeds it. ([jest-coverage-ratchet on npm](https://www.npmjs.com/package/jest-coverage-ratchet);
[Vitest coverage thresholds](https://vitest.dev/config/#coverage-thresholds-100)).

### 1.3 Codecov flags vs components for per-area ratcheting

- **Flags** partition *uploaded reports* (e.g. `ts` unit + `ts` integration merged by union;
  `java`); `carryforward: true` reuses the last known coverage for a flag when a PR does not
  re-run that suite. ([codecov.yml reference](https://docs.codecov.com/docs/codecovyml-reference))
- **Components** partition *paths* after upload (`component_management.individual_components`,
  each with `paths` and its own `statuses`), so each area carries its own `project` / `patch`
  target without touching CI. ([codecov.yml reference](https://docs.codecov.com/docs/codecovyml-reference))
- `removed_code_behavior` (`off` | `removals_only` | `fully_covered_patch` | `adjust_base`)
  controls how deletions are scored — the usual cause of a false "coverage dropped" on a
  `target: auto` gate. ([codecov.yml reference](https://docs.codecov.com/docs/codecovyml-reference))

**Applies to fhir-mapbuilder:** the repo is already at Codecov Level 2–4 (patch 80 % + component
`project` 80 % on both stacks). The open decision for ADR 0004 / ticket #157 is the *shape above
80 %*: (a) leave the component floor at a **fixed 80 %** and rely on repo `project: auto` for the
trend (current), (b) hand-ratchet the component floor in small steps (80 → 83 → 85) at a monthly
review, or (c) switch the component `project` to `auto` + small `threshold` so it becomes
"never-decrease" per component. Recommendation: **(b)** — explicit, visible in `codecov.yml`
history, no new tooling, and it can't silently wander; cap it at ~85 % per Fowler/Codecov
(§7.3). Keep `patch` at 80 %. Set `removed_code_behavior: adjust_base` to stop refactors
tripping the gate.

---

## 2. Moving lint `warn` → `error` without blocking the flow

### 2.1 The default mechanics

- ESLint exits non-zero on any **error**; **warnings never fail the build** unless you pass
  `--max-warnings <n>`, which "force[s] ESLint to exit with an error status if the total warning
  count is greater than the specified threshold." ([ESLint CLI reference](https://eslint.org/docs/latest/use/command-line-interface)).
  `--max-warnings 0` is the crude "no new warnings ever" gate but it's all-or-nothing and gives
  no baseline.

### 2.2 The modern primitive: ESLint bulk suppressions (v9.24+, stable since v9.28)

Purpose, in ESLint's words: teams "want stricter linting rules but face overwhelming existing
violations … [when] the rule isn't auto-fixable, the path to enabling it as an error can be
challenging." ([ESLint blog, "Introducing bulk suppressions"](https://eslint.org/blog/2025/04/introducing-bulk-suppressions/)).

Workflow ([ESLint "Bulk Suppressions" docs](https://eslint.org/docs/latest/use/suppressions);
[ESLint v9.28 release notes](https://eslint.org/blog/2025/05/eslint-v9.28.0-released/)):

1. Set the rule to `"error"` in config.
2. `eslint --fix --suppress-all` (or `--suppress-rule <name>` one rule at a time) — auto-fixes
   what it can, records the rest in **`eslint-suppressions.json`** at the project root.
3. **Commit `eslint-suppressions.json`** so the baseline is shared.
4. The file is a **ratchet**: ESLint re-reports a rule/file pair as an error if its violation
   count *increases*; new code is fully enforced, legacy debt is frozen at its current count.
5. As you fix real violations, `eslint --prune-suppressions` shrinks the file;
   `--pass-on-unpruned-suppressions` keeps CI green in the meantime.

**Hard limitation:** "Only rules configured as `"error"` are suppressed. If a rule is enabled as
`"warn"`, ESLint will not suppress the violations." So the migration is genuinely `warn → error`,
not a way to keep things at `warn`. ([ESLint "Bulk Suppressions" docs](https://eslint.org/docs/latest/use/suppressions)).

### 2.3 Alternatives / prior art

- **`@rushstack/eslint-bulk`** — the pre-v9.24 community tool that inspired the built-in feature;
  same "baseline file, enforce on new code" idea. ([@rushstack/eslint-bulk on npm](https://www.npmjs.com/package/@rushstack/eslint-bulk))
- **Betterer** (`@betterer/eslint`, `@betterer/typescript`, `@betterer/regexp`) — Jest-snapshot
  style: first run captures a baseline, later runs **error on regression, silently update on
  improvement**; `--update` is "consciously increasing the technical debt." Good when you want
  *one* mechanism for lint **and** `tsc` strictness **and** banned-pattern counts, with a
  pre-commit hook + CI step. ([Betterer on GitHub](https://github.com/phenomnomnominal/betterer);
  [Charpentier, "Enforce Best Practices Incrementally With Betterer"](https://charpeni.com/blog/enforce-best-practices-incrementally-with-betterer))
- **Rules in waves** — the linter literature (RuboCop's `--auto-gen-config` /
  `.rubocop_todo.yml`, ESLint suppressions) all converge on: enable a *batch* of related rules
  globally, freeze existing violations in a todo/baseline file, burn the file down rule-by-rule.
  ([Dusty Burwell, "Ratchets"](https://www.dustyburwell.com/2019/05/29/ratchets))
- **`eslint-plugin-only-warn`** — downgrades *every* rule to warn; the opposite move, useful only
  as a very temporary "unblock CI now, triage later" escape hatch, not a strategy.
  ([eslint-plugin-only-warn](https://github.com/bfanger/eslint-plugin-only-warn))

**Applies to fhir-mapbuilder (ticket #158, "burn-down ESLint"):** TS lint is already blocking, so
there is no giant backlog to suppress — the lever is **adding stricter rules** (e.g.
`@typescript-eslint` type-checked set, `no-floating-promises`, `strict-boolean-expressions`) as
`error` in waves, each wave landing with an `eslint-suppressions.json` baseline that a later PR
prunes to zero. `eslint-suppressions.json` is the right primitive (built-in, no dependency,
already on ESLint 9). For the **Java** side there is no ESLint equivalent; SpotBugs has
`spotbugs-exclude.xml` filters that play the same "freeze the baseline" role, and Spotless is
all-or-nothing (already applied). Record in ADR 0004 that the `warn` level is **not** used as a
resting state in this repo — a rule is either `off` (with a dated reason) or `error` with a
shrinking suppressions baseline.

---

## 3. "Poor-man" quality dashboards (no SonarQube)

What small OSS projects actually do, in rough order of effort:

1. **README badges** — CI status, Codecov coverage %, release/version, licence. The coverage
   badge is the single most common "dashboard"; Codecov and Coveralls both generate one, and it
   doubles as social proof. (Repo currently has CI + Codecov wiring via `ci.yml` / `codecov.yml`;
   marketplace badge was just dropped in PR #154.)
2. **Codecov's own hosted views** — the per-PR comment, the "Sunburst"/tree map, the coverage
   trend graph, and the **Components** tab give a per-area breakdown over time with zero
   self-hosting. For a project already uploading to Codecov this *is* the dashboard.
   ([Codecov commit-status docs](https://docs.codecov.com/docs/commit-status);
   [codecov.yml reference](https://docs.codecov.com/docs/codecovyml-reference))
3. **GitHub repository "Community Standards"** (Insights → Community Standards) — a built-in
   checklist for README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, issue/PR templates, SECURITY.
   Free, no setup, and a concrete "is the project hygiene complete" gauge.
   ([GitHub Docs, "About community profiles for public repositories"](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories);
   [GitHub Docs, "Accessing a project's community profile"](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/accessing-a-projects-community-profile))
4. **GitHub Insights** (free tier) — Pulse (weekly activity), Contributors, Dependency graph,
   and the **Code scanning / Dependabot alert** counts in the Security tab. Enough to answer
   "what changed, what's open, what's rotting."
5. **A generated GitHub Pages site** — for orgs, `github-community-projects/org-metrics-dashboard`
   is an Actions-powered Pages dashboard of repo health pulled from the GraphQL API; the GitHub
   OSPO documents the health-metrics queries. Overkill for one repo, cited as the "next step up"
   if fhir-mapbuilder ever grows a sibling. ([github/github-ospo, open-source-health-metrics.md](https://github.com/github/github-ospo/blob/main/docs/open-source-health-metrics.md);
   [github-community-projects/org-metrics-dashboard](https://github.com/github-community-projects/org-metrics-dashboard))
6. **A recurring "quality" issue / label** — a single pinned tracking issue (or a `tech-debt` /
   `quality` label + a saved filter) is the debt backlog *and* the dashboard; the monthly review
   (§4) reads it. Tech-debt writers warn these "backlogs can be hard to maintain" — engineers
   "accumulate a mountain of refactoring tickets until they stop tracking" — so keep it short and
   groomed. ([Atlassian, "What is Tech Debt?"](https://www.atlassian.com/agile/software-development/technical-debt);
   [Knecht, "Managing Technical Debt", Slalom Build](https://medium.com/slalom-build/managing-technical-debt-8594f03f1099))

**Applies to fhir-mapbuilder (ticket #160, "tableau de bord"):** the pragmatic dashboard is
**Codecov Components + GitHub Community Standards + Security tab + one pinned `quality` tracking
issue**, all already free and mostly already wired. The ADR should explicitly say "no self-hosted
dashboard, no Pages site" and name those four surfaces as *the* dashboard, with the monthly
review as the human refresh. Add any missing README badges (coverage, CI, release) as the only
build step.

---

## 4. Realistic solo rituals: cadence, debt backlog, per-iteration budget, monthly review

- **Fixed cadence with built-in slack.** Solo/small-team practice converges on a regular
  development cycle plus a recurring hardening/cool-down slot: "a regular cadence of hardening
  sprints (say, every fourth or fifth sprint)"; solo devs "regularly address technical debt and
  deliver features on a 6-week cadence." (Basecamp's Shape Up "cool-down" is the canonical
  named version.) ([Knecht, "Managing Technical Debt"](https://medium.com/slalom-build/managing-technical-debt-8594f03f1099);
  [Robertson, "The Effective Solo Developer"](https://medium.com/better-programming/the-effective-solo-dev-8407d86c8a9e))
- **A per-iteration debt budget.** Reserve a *fixed fraction* of each cycle for debt/quality
  (commonly framed as ~20 %, or "one debt issue per feature issue"), so paydown is scheduled, not
  aspirational. ([Atlassian, "What is Tech Debt?"](https://www.atlassian.com/agile/software-development/technical-debt))
- **A groomed debt backlog, kept small.** Catalogue debt as issues under one label, but prune
  aggressively — an un-groomed refactor pile stops being read. ([Atlassian](https://www.atlassian.com/agile/software-development/technical-debt);
  [Knecht](https://medium.com/slalom-build/managing-technical-debt-8594f03f1099))
- **A monthly quality review.** "Regularly reviewing and updating your technical debt backlog"
  keeps the codebase "healthy and reliable in the long term." For a solo maintainer this is a
  ~30-minute calendar recurrence: read Codecov trend + Security alerts + `eslint-suppressions.json`
  size + the `quality` issue; decide the next cycle's step-ups and debt pick. ([Alex Omeyer,
  "Tools to Track and Manage Technical Debt"](https://medium.com/swlh/tools-to-track-and-manage-technical-debt-a08fa6778c89))
- **Guard against solo burnout.** OSS-maintainer survey data: 60 % of maintainers are unpaid,
  ~60 % have considered quitting, and unpaid ones are "more likely to be flying solo." The
  rituals must be *cheap* or they get dropped. Lightweight, automated gates beat manual audits.
  ([Socket, "The Unpaid Backbone of Open Source"](https://socket.dev/blog/the-unpaid-backbone-of-open-source);
  [jlowin, "An Open-Source Maintainer's Guide to Saying No"](https://jlowin.dev/blog/oss-maintainers-guide-to-saying-no))

**Applies to fhir-mapbuilder (ticket #161, "rituels"):** ADR 0004 should commit to: (1) a named
**monthly quality review** with a fixed short checklist (trend, alerts, suppressions count,
ratchet step decision); (2) a **per-cycle debt budget** — pragmatic form for a solo repo: "at
least one `quality`-labelled PR merged per calendar month, or the coverage floor does not
ratchet that month"; (3) one **pinned `quality` tracking issue** as the backlog; (4) an explicit
"if a ritual is skipped two months running, delete it or automate it" clause, to keep the
process honest about solo bandwidth.

---

## 5. Definition of Done / self-review for a single maintainer

- **A written DoD checklist, even for one person.** The DoD is "an agreed-upon list of the
  activities necessary to get a … increment to a done state." Solo-dev guidance makes it concrete:
  "Tests passing, no new linter warnings, acceptance criteria met, no TODOs left, docs updated."
  ([Agile Alliance, "Definition of Done"](https://agilealliance.org/glossary/definition-of-done/);
  [DEV, "From Chaos to Shipped — A Practical Workflow for Solo Developers"](https://dev.to/southwestmogrown/from-chaos-to-shipped-a-practical-workflow-for-solo-developers-1h9n))
- **Self-review is unreliable — compensate structurally.** "You are terrible at reviewing your
  own code … you see what you intended to write, not what you actually wrote." Counter-measures
  that survive solo: **read your own diff in the PR view** (not the editor) before merit;
  a **cooling-off gap** (open the PR, sleep on it, merge next day) to break the intent bias;
  run a **checklist**, not a vibe. ([GitAutoReview, "Solo Developer Code Review: A Complete
  Process Guide"](https://gitautoreview.com/guides/solo-developer-code-review);
  [Gorin, "Pre-Merge Verification for Developers"](https://maxim-gorin.medium.com/what-developers-must-check-before-shipping-code-c632af392330))
- **Still use a PR + PR template, even self-merging.** "A PR template … 5–7 checkboxes covering
  essentials"; "authors should self-review against the checklist before requesting a review."
  The PR is where CI runs, where the diff is readable, and where the DoD checklist lives.
  ([Gorin, "Pre-Merge Verification"](https://maxim-gorin.medium.com/what-developers-must-check-before-shipping-code-c632af392330);
  [DEV, "The Git Workflow That Actually Works for Solo Developers (2026)"](https://dev.to/armorbreak/the-git-workflow-that-actually-works-for-solo-developers-2026-2mna))
- **Self-merge discipline.** Keep the branch protection / ruleset in place (this repo's `main`
  ruleset already requires a PR, status checks, conversation resolution — approvals set to 0
  because there is no second reviewer). Merge only when CI is green *and* the DoD boxes are
  ticked; never push straight to `main`. Optionally require the PR to be open for N hours.
  (ADR 0001 §"`main` ruleset"; [DEV, "The Git Workflow That Actually Works for Solo Developers"](https://dev.to/armorbreak/the-git-workflow-that-actually-works-for-solo-developers-2026-2mna))
- **Automated DoD nudges** exist if a checklist-in-the-head keeps slipping:
  `platisd/definition-of-done` and the "Definition of Done (DoD) checker" Action parse a
  checklist in the PR body and block until it's ticked. Optional, low value for a disciplined
  solo dev, cited for completeness. ([platisd/definition-of-done](https://github.com/platisd/definition-of-done);
  [GitHub Marketplace, "Definition of Done (DoD) checker"](https://github.com/marketplace/actions/definition-of-done-dod-checker))

**Applies to fhir-mapbuilder:** the repo already has `PULL_REQUEST_TEMPLATE.md` (commit-policy
checklist per ADR 0001). ADR 0004 should extend it with a short **DoD block** — CI green; new
code ≥ 80 % patch; no new `eslint-suppressions.json` / SpotBugs baseline entries; ADR/README/
CONTRIBUTING updated if behaviour or process changed; `CHANGELOG.md` untouched (release-please
owns it). Add a norm: **PR open ≥ 1 working day before self-merge** for anything non-trivial
(the cooling-off gap), and always review the GitHub diff, not just the editor. No bot enforcement
needed initially.

---

## 6. CodeQL / GitHub code scanning for a small project — worth it or overhead? (feeds #163)

**The case for "yes, turn it on":**

- **Free on public repos.** "A subset of Advanced Security features are available to all public
  repositories on GitHub.com free of charge … all public repositories have access to code
  scanning, secret scanning, and dependency review." (Caveat: flipping the repo to **private**
  without a GHAS licence disables it.) ([GitHub Docs, "GitHub Advanced Security license
  billing"](https://docs.github.com/en/billing/concepts/product-billing/github-advanced-security);
  [GitHub Docs, "About the CodeQL CLI"](https://docs.github.com/en/code-security/codeql-cli/getting-started-with-the-codeql-cli/about-the-codeql-cli))
- **Near-zero setup via default setup.** "Default setup is the fastest way to get CodeQL to scan
  your code with minimal effort" — it "automatically chooses the languages to analyze, query
  suite to run, and events that trigger scans." No workflow file to maintain.
  ([GitHub Docs, "About code scanning with CodeQL"](https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql);
  [GitHub Docs, "Configuring advanced setup for code scanning"](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/configuring-advanced-setup-for-code-scanning))
- **Both this repo's languages are first-class.** `javascript-typescript` covers the extension;
  `java-kotlin` covers the validation service, and since CodeQL 2.16.5 Java can be scanned
  **without a build** ("CodeQL can be successfully enabled for over 90 % of Java repos without
  manual intervention"). ([GitHub Docs, "About code scanning with CodeQL"](https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql);
  [GitHub Changelog, "CodeQL can scan Java projects without a build"](https://github.blog/changelog/2024-03-26-codeql-can-scan-java-projects-without-a-build/))
- **Maintained rulesets, tuned for signal.** Default queries are "regularly updated to improve
  analysis and reduce any false positive results." Scheduled scans surface newly-discovered
  vulnerability classes in code that hasn't changed. ([GitHub Docs, "About code scanning with
  CodeQL"](https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql))

**The case for "it's overhead":**

- Extra CI minutes and a third scan surface (on top of SpotBugs for Java and ESLint for TS,
  which already catch a chunk of the same defect classes).
- CodeQL's strength is **injection / taint-tracking / auth** bugs; a FHIR-map-authoring VS Code
  extension has a small attack surface, and the embedded Matchbox engine is third-party (already
  covered by OSV). Net *new* findings may be few.
- Any code scanning produces some false positives that a solo maintainer must triage; the
  `security-events: write` permission and SARIF plumbing add moving parts (this repo already
  runs that plumbing for OSV in `audit.yml` / `audit-advisory`).

**Recommendation for fhir-mapbuilder (ticket #163):** enable **CodeQL default setup**, both
languages (`javascript-typescript` + `java-kotlin`, build-less), on `pull_request` to `main` +
weekly schedule, **non-blocking** initially (advisory only, alerts in the Security tab), mirroring
the existing OSV posture in ADR 0002 (PR advisory + weekly). Re-evaluate after ~2 months at a
monthly review: if it has produced actionable findings and low noise, promote the PR run to a
required check; if it's pure noise on a low-risk surface, document the decision to disable it in
ADR 0004 rather than leaving it half-on. Prefer **default setup** over a hand-written `codeql.yml`
to avoid a workflow file to maintain — only drop to advanced setup if path filters or a custom
query pack are actually needed.

---

## 7. Known traps

### 7.1 Goodhart's law — "when a measure becomes a target, it ceases to be a good measure"

- The strong form bites even honest actors: "even honest optimization of metrics eventually harms
  actual goals because metrics are imperfect proxies." Test coverage specifically "masks
  integration-level bugs"; DORA metrics "become proxies of proxies." Hillel Wayne's honest
  conclusion is that there's no clean fix — "use your best engineering judgement", and use
  *multiple* signals so you notice when optimising one hurts another. ([Hillel Wayne, "Goodhart's
  Law in Software Engineering"](https://buttondown.com/hillelwayne/archive/goodharts-law-in-software-engineering/))
- Practical mitigations from the metrics literature: keep gates **few**; treat numbers as
  **diagnostics that start conversations**, not acceptance criteria; pair every "more" metric
  (coverage) with a "less" metric (escaped-bug count, revert rate) so gaming one is visible.
  ([CodePulse, "Goodhart's Law in Engineering"](https://codepulsehq.com/guides/goodharts-law-engineering-metrics);
  [Jellyfish, "Goodhart's Law in Software Engineering"](https://jellyfish.co/blog/goodharts-law-in-software-engineering-and-how-to-avoid-gaming-your-metrics/))

### 7.2 Coverage theatre

"Developers write trivial unit tests that do not assert meaningful behavior, while necessary
integration tests are skipped … tests that technically cover lines but don't actually test
anything." Result: "a false sense of security where bugs slip to production." ([CodePulse,
"Goodhart's Law in Engineering"](https://codepulsehq.com/guides/goodharts-law-engineering-metrics)).
Martin Fowler: "high coverage numbers don't necessarily mean much"; he "warns against
coverage-focused dashboards that promote false confidence." ([Fowler, "TestCoverage"](https://martinfowler.com/bliki/TestCoverage.html)).

Counter-measures: judge tests by whether "bugs rarely escape production AND developers feel
confident modifying code without fear of breakage", not the percent; review *what* the new tests
assert during self-review (§5); resist pushing the floor into the 90s where the incentive to
write assertion-free tests spikes (§7.3).

### 7.3 Over-aggressive ratchets

- **Coverage:** Fowler expects "upper 80s or 90s" for thoughtful tests and "explicitly distrusts
  100 %"; Codecov notes 100 % "isn't always necessary"; research cited by em-tools: "beyond 85 %,
  the cost of achieving additional coverage increases significantly while the incremental quality
  benefit diminishes." So cap the ratchet around **85 %**, not 95–100 %.
  ([Fowler, "TestCoverage"](https://martinfowler.com/bliki/TestCoverage.html);
  [Codecov, "5 Levels of Code Coverage"](https://about.codecov.io/blog/the-5-levels-of-code-coverage-how-to-build-a-testing-culture-in-your-organization/);
  [em-tools, "Code Coverage Benchmarks"](https://www.em-tools.io/engineering-metrics/code-coverage))
- **Ratchet design:** a good ratchet "does not block existing work" and only "transitions from
  warnings to blockers once migration stabilises." A ratchet that jumps in big steps, or turns a
  whole rule family to blocking `error` at once, becomes a wall — the whole point is many small
  forward clicks. Give `codecov project: auto` a `threshold` and set `removed_code_behavior` so
  legitimate deletions/refactors don't fail the gate. ([Dusty Burwell, "Ratchets"](https://www.dustyburwell.com/2019/05/29/ratchets);
  [Codecov commit-status docs](https://docs.codecov.com/docs/commit-status))
- **`--max-warnings 0` as a lint ratchet** is the over-aggressive version: any stray warning
  (often from a dependency bump or a new ESLint minor) turns the build red with no baseline to
  fall back on. Prefer the `eslint-suppressions.json` baseline, which freezes *counts* and only
  fails on *increase*. ([ESLint "Bulk Suppressions" docs](https://eslint.org/docs/latest/use/suppressions))

### 7.4 Debt-backlog rot

Tech-debt backlogs "can be hard to maintain as engineers will accumulate a mountain of
refactoring tickets until they stop tracking this data." Keep the `quality` list short and
groomed; a stale 40-item refactor pile is worse than none because it hides the 3 that matter.
([Alex Omeyer, "Tools to Track and Manage Technical Debt"](https://medium.com/swlh/tools-to-track-and-manage-technical-debt-a08fa6778c89))

---

## 8. Consolidated recommendation for ADR 0004 (fhir-mapbuilder, solo, TS + Java)

| # | Recommendation | Primary source(s) | fhir-mapbuilder application | Ticket |
|---|---|---|---|---|
| R1 | Keep **patch 80 %** as the real gate on new code; keep repo `project: auto` for trend. | [Codecov "5 Levels"](https://about.codecov.io/blog/the-5-levels-of-code-coverage-how-to-build-a-testing-culture-in-your-organization/) | Already in `codecov.yml`. Lock it in the ADR. | #157 |
| R2 | Above 80 %, **hand-ratchet the per-component `project` floor in small steps** (≤ +3 pts) at the monthly review; **cap ~85 %**. Add `removed_code_behavior: adjust_base` + a small `threshold`. | [Dusty Burwell](https://www.dustyburwell.com/2019/05/29/ratchets); [Fowler](https://martinfowler.com/bliki/TestCoverage.html); [em-tools](https://www.em-tools.io/engineering-metrics/code-coverage); [codecov.yml ref](https://docs.codecov.com/docs/codecovyml-reference) | Edit `codecov.yml` component `statuses`. No new tooling. | #157 |
| R3 | **No `warn` resting state.** A lint rule is `off` (dated reason) or `error` with a shrinking **`eslint-suppressions.json`** baseline. Add stricter `@typescript-eslint` rules in **waves**, each with a baseline a later PR prunes to zero. | [ESLint "Bulk Suppressions"](https://eslint.org/docs/latest/use/suppressions); [ESLint blog](https://eslint.org/blog/2025/04/introducing-bulk-suppressions/) | TS: built-in, ESLint 9 already in use. Java: SpotBugs exclude-filter baseline plays the same role. | #158 |
| R4 | **Dashboard = Codecov Components + GitHub Community Standards + Security tab + one pinned `quality` issue.** No self-hosted dashboard / Pages site. Add README coverage/CI/release badges. | [Codecov](https://docs.codecov.com/docs/codecovyml-reference); [GitHub community profile docs](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories) | Mostly already wired; add badges + create the pinned issue. | #160 |
| R5 | **Monthly quality review** (~30 min, fixed checklist: trend, alerts, suppressions size, ratchet step). **Per-cycle debt budget**: ≥ 1 `quality` PR / month or the floor doesn't ratchet. Kill or automate any ritual skipped 2 months running. | [Slalom Build](https://medium.com/slalom-build/managing-technical-debt-8594f03f1099); [Omeyer](https://medium.com/swlh/tools-to-track-and-manage-technical-debt-a08fa6778c89); [Atlassian](https://www.atlassian.com/agile/software-development/technical-debt); [Socket](https://socket.dev/blog/the-unpaid-backbone-of-open-source) | New §in ADR 0004; backlog = pinned `quality` issue. | #161 |
| R6 | **DoD block in the PR template** (CI green, patch ≥ 80 %, no new suppression baseline entries, ADR/README/CONTRIBUTING updated, no `CHANGELOG` edit). **Cooling-off**: PR open ≥ 1 working day before self-merge for non-trivial changes; always review the GitHub diff. Keep the `main` ruleset. | [Agile Alliance](https://agilealliance.org/glossary/definition-of-done/); [GitAutoReview](https://gitautoreview.com/guides/solo-developer-code-review); [Gorin](https://maxim-gorin.medium.com/what-developers-must-check-before-shipping-code-c632af392330); ADR 0001 | Extend `PULL_REQUEST_TEMPLATE.md`; add the norm to `CONTRIBUTING.md`. | #161 |
| R7 | **Enable CodeQL default setup**, both languages, build-less, PR + weekly, **non-blocking**; re-evaluate in ~2 months → promote to required check or document disabling it. Prefer default setup over a `codeql.yml`. | [GitHub Docs, code scanning w/ CodeQL](https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql); [GHAS billing](https://docs.github.com/en/billing/concepts/product-billing/github-advanced-security); [Java build-less changelog](https://github.blog/changelog/2024-03-26-codeql-can-scan-java-projects-without-a-build/) | Free (public repo). Mirrors ADR 0002 OSV posture. | #163 |
| R8 | **Traps to name explicitly in the ADR:** Goodhart (few gates; pair coverage with escaped-bug/revert-rate; numbers start conversations); coverage theatre (review what tests assert; don't chase 90s); over-aggressive ratchets (small steps, `threshold`, no `--max-warnings 0`); debt-backlog rot (keep `quality` list short + groomed). | [Hillel Wayne](https://buttondown.com/hillelwayne/archive/goodharts-law-in-software-engineering/); [Fowler](https://martinfowler.com/bliki/TestCoverage.html); [CodePulse](https://codepulsehq.com/guides/goodharts-law-engineering-metrics); [Dusty Burwell](https://www.dustyburwell.com/2019/05/29/ratchets) | "What we explicitly do not do" section of ADR 0004. | ADR |

### One-paragraph gist

For a solo OSS repo, the consensus is: **gate hard on new code (patch ~80 %), ratchet the
overall floor upward only in small, deliberate, human-triggered steps, and cap it around 85 %.**
Move lint `warn → error` via a **committed baseline file** (`eslint-suppressions.json` / SpotBugs
exclude filter) that freezes legacy counts and fails only on regression, enabling rules in waves.
Don't build a dashboard — **Codecov Components, GitHub Community Standards, the Security tab, and
one pinned tracking issue** are the dashboard. Make the process **cheap**: a ~30-minute **monthly
review**, a small **per-cycle debt budget**, a **DoD checklist in the PR template**, a
**one-day cooling-off before self-merge**, and a rule that any ritual skipped twice gets killed or
automated. **CodeQL default setup** is low-cost and free on a public repo — turn it on
non-blocking and decide after two months. The traps to write into the ADR: Goodhart (a measure
that becomes a target stops measuring), coverage theatre (assertion-free tests to hit a number),
over-aggressive ratchets (big jumps, `--max-warnings 0`, chasing 100 %), and debt-backlog rot.
