# 1. Commit policy

Date: 2026-08-31

## Status

Accepted.

Part of the alignment of `fhir-mapbuilder` engineering practices on the reference
repository `davidouagne/datahub-healthdcat-ap-exporter` (spec #80, wayfinder map
#66). Companion records: 0002 (CI/CD chain), 0003 (versioning & release).

## Context

`fhir-mapbuilder` had no commit policy: squash, rebase and merge-commit merging
were all enabled at the repository level, there was no Conventional Commits
enforcement, no Developer Certificate of Origin (DCO) sign-off, no
`CONTRIBUTING.md` and no PR template.

Release automation (release-please, see ADR 0003) derives the next version number
and the changelog from the commit history. That only works if:

- every commit that reaches `main` is a Conventional Commit it can parse, and
- the merge-commit subject (i.e. the PR title) is one too.

We also want a lightweight provenance guarantee on contributions without asking
external contributors to set up GPG signing.

## Decision

### Merge strategy — merge commits only

`main` accepts **merge commits only**. Repository settings:

| Setting | Value |
|---|---|
| `allow_squash_merge` | `false` |
| `allow_rebase_merge` | `false` |
| `allow_merge_commit` | `true` |
| `delete_branch_on_merge` | `true` |
| `web_commit_signoff_required` | `true` |

Every commit on a branch therefore lands on `main` verbatim and feeds the
changelog. Contributors are expected to rebase and tidy their branch history
before opening a PR (documented in `CONTRIBUTING.md`).

### `commitlint.config.mjs` (repository root)

```
extends: ['@commitlint/config-conventional']
rules:
  type-enum          [2, 'always', [feat, fix, test, docs, chore, build]]
  type-empty         [2, 'never']
  subject-empty      [2, 'never']
  header-max-length  [2, 'always', 72]
  subject-full-stop  [2, 'never', '.']
  scope-enum         [0]        # scope is free-form
  subject-case       [0]        # no case constraint on the subject
  body-max-line-length   [0]    # Dependabot / release-please bodies
  footer-max-line-length [0]    # Dependabot / release-please footers
```

The type list is deliberately narrower than the Angular default — these six are
the only types release-please is configured to act on.

### `.github/workflows/commit-policy.yml`

- Triggers: `pull_request` **and** `pull_request_target`, types
  `opened, edited, reopened, synchronize`.
- `permissions: {}` at workflow level; each job elevates to the minimum it needs.
- `concurrency` key includes `github.event_name` so the `pull_request` and
  `pull_request_target` runs of the same PR do not cancel each other.

Three jobs:

| Job | Runs on | Permissions | What it checks |
|---|---|---|---|
| `dco` | `pull_request` | `contents: read` | `git rev-list --no-merges BASE..HEAD`, each commit message must match `^Signed-off-by: .+ <.+>$` |
| `commitlint` | `pull_request` | `contents: read` | `wagoid/commitlint-github-action@v6` with `configFile: commitlint.config.mjs` |
| `pr-title` | `pull_request_target` | `pull-requests: read` | `amannn/action-semantic-pull-request@v6`, types `feat\|fix\|test\|docs\|chore\|build`, `requireScope: false` |

`pr-title` runs on `pull_request_target` (no repository checkout) so it can read
an up-to-date title, including edits, on PRs from forks. `dco` and `commitlint`
run only on `pull_request`, where the branch head is checked out.

### Same rule for bots

There is **no `if:` bypass** excluding `dependabot[bot]` or the release bot. One
rule for everyone:

- Dependabot already signs its commits (`Signed-off-by: dependabot[bot] …`) and
  prefixes subjects with `build(deps): …` (`build` is in `type-enum`).
- The release bot signs off via `signoff` in `release-please-config.json`
  (see ADR 0003).

### `main` ruleset

Enforced through a GitHub ruleset on `main`:

- Pull request required, `required_approving_review_count: 0`, no `CODEOWNERS`.
- `required_status_checks` with `strict_required_status_checks_policy: false`
  (checks added as each one first goes green — see spec #80).
- `required_conversation_resolution: true`.
- `non_fast_forward` (block force-push) and `deletion` blocked.
- **No** `required_linear_history` (incompatible with the merge-commit strategy).
- Bypass: `Repository admin`.

### Not retroactive

`dco` and `commitlint` only inspect the `BASE..HEAD` range of the PR, so the
pre-existing history is never re-judged. release-please starts from a
`bootstrap-sha` at the adoption HEAD for the same reason.

## Consequences

- Contributors must sign off (`git commit -s`) and keep a clean, rebased branch
  history. This is documented in `CONTRIBUTING.md` and restated in
  `.github/PULL_REQUEST_TEMPLATE.md` (checklist).
- A non-conforming commit, a missing sign-off, or a non-conforming PR title each
  block the PR until fixed.
- A Dependabot / release PR (`build(deps): …` title, signed-off commits) passes
  all three jobs with no special-casing.
- The changelog is owned by release automation; PRs must not edit `CHANGELOG.md`.
- Merge commits keep every branch commit visible on `main`; history is not
  linear by design.

## Alternatives considered

- **GPG/SSH-signed commits instead of DCO.** Rejected: too much friction for
  external contributors for the provenance guarantee we actually need. DCO
  (`Signed-off-by` trailer) is the lighter, widely understood equivalent.
- **Squash merging.** Rejected: collapsing a branch to one commit loses the
  per-commit Conventional Commit information release-please relies on, and makes
  `commitlint` on individual commits pointless.
- **Linear history (rebase merging).** Rejected: it conflicts with the
  merge-commit strategy and provides no benefit here.
- **Exempting bots from the checks with an `if:` condition.** Rejected: a single
  rule for humans and bots is simpler to reason about, and both Dependabot and
  release-please already produce conforming, signed-off commits.
