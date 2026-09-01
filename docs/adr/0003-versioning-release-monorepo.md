# 3. Versioning & release for the monorepo

Date: 2026-09-01

## Status

Accepted.

Part of the alignment of `fhir-mapbuilder` engineering practices on the reference
repository `davidouagne/datahub-healthdcat-ap-exporter` (spec #80, wayfinder map
#66). Companion records: 0001 (commit policy), 0002 (CI/CD chain). Implements
ticket #87 (T8).

## Context

Releases were manual: a hand-pushed `v*` tag triggered the old `release.yml`
(package the `.vsix`, attach it to a GitHub Release), and publication to the VS
Code Marketplace was a separate `workflow_dispatch` (`publish.yml`). Nothing
published to Open VSX. Versions had already drifted — `pom.xml` `1.5.0` vs
`package.json` `1.6.0` — and `CHANGELOG.md` was kept by hand.

The monorepo ships a **single user-facing artefact**, the VS Code extension. The
Java module `fhir-mapbuilder-validation` is bundled inside the `.vsix` as a jar;
its version only needs to move in lockstep with the extension.

## Decision

### release-please, manifest mode, `linked-versions`

Automated with [release-please](https://github.com/googleapis/release-please)
driven by `release-please-config.json` + `.release-please-manifest.json` at the
repo root.

**A local `npx release-please … --dry-run` was run before settling the config**
(acceptance criterion of #87). Findings:

- release-please 17.x **rejects `../` path segments** in both `changelog-path`
  and `extra-files` (`Error: illegal pathing characters in path:
  vscode-extension/../CHANGELOG.md`). The spec's first choice — a single
  `vscode-extension` package reaching up to `../CHANGELOG.md` and
  `../fhir-mapbuilder-validation/pom.xml` — is therefore **not viable**.
- The documented fallback is used instead: the **`linked-versions` plugin** with
  two components, `ext` and `val`.
- Output naming confirmed: `release-please-action` prefixes every output with the
  package path, so the extension's flag is
  **`vscode-extension--release_created`** (not `release_created`). `release.yml`
  guards on exactly that.
- The Maven version bump is done by release-please's native `maven` strategy,
  which touches **only `/project/version`** — the inherited
  `<parent><version>` (`spring-boot-starter-parent` `3.5.16`) is left alone. The
  fragile hand-written xpath the spec worried about is not needed. (Verified on a
  throwaway release PR opened against the feature branch, then discarded.)

`release-please-config.json`:

| Key | Value | Why |
|---|---|---|
| `bootstrap-sha` | `b92a3e0…` (adoption HEAD) | Fallback baseline. In practice the existing `v1.6.0` git tag is the baseline, so no changelog is generated retroactively either way. |
| `separate-pull-requests` | `false` | One release PR for both components. |
| `signoff` | `github-actions[bot] <…>` | Every release commit carries a DCO trailer, so `dco` / `commitlint` pass with no bot bypass (ADR 0001). |
| `plugins[].linked-versions` | `groupName: fhir-mapbuilder`, `components: [ext, val]` | `val` always gets `ext`'s version. |
| package `vscode-extension` | `release-type: node`, `component: ext`, `package-name: fhir-mapbuilder`, `include-component-in-tag: false`, `bump-minor-pre-major: false` | Tags are `vX.Y.Z` with no component prefix. |
| package `fhir-mapbuilder-validation` | `release-type: maven`, `component: val`, `skip-github-release: true`, `skip-snapshot: true` | Bumps `pom.xml`; no second GitHub Release/tag, no Maven `-SNAPSHOT` follow-up PR. |

`.release-please-manifest.json` starts both components at `1.6.0`.
`fhir-mapbuilder-validation/pom.xml` `<version>` was realigned `1.5.0 → 1.6.0` in
the same change.

### `CHANGELOG.md` moved under `vscode-extension/`

release-please writes each component's changelog **inside that component's
directory** and cannot be pointed elsewhere (the `../` rejection above). The
canonical changelog is now `vscode-extension/CHANGELOG.md`; the `git mv`
preserved its history. Bonus: `vsce package` picks it up, so the Marketplace
"Changelog" tab is populated for the first time. The `val` component gets its own
short `fhir-mapbuilder-validation/CHANGELOG.md` on the first automated release —
accepted as a minor artefact of the two-component layout.

PRs still must not touch any `CHANGELOG.md` by hand (ADR 0001, `CONTRIBUTING.md`).

### `.github/workflows/release.yml`

Replaces the old `release.yml` (tag) **and** `publish.yml` (dispatch), both
deleted.

- `on: push` to `main`; `permissions: {}` at workflow level; `concurrency:
  { group: release, cancel-in-progress: false }` — one release at a time, never
  cancel a run that may be mid-publish.
- Every job past `release-please` is guarded by
  `if: needs.release-please.outputs['vscode-extension--release_created'] == 'true'`
  and declares minimal `permissions:`.

| Job | Needs | Permissions | Environment | Role |
|---|---|---|---|---|
| `release-please` | — | `contents: write`, `pull-requests: write`, `issues: write` | — | Open/maintain the release PR; on merge, cut the tag + GitHub Release. |
| `build` | `release-please` | `contents: write` | — | Checkout the tag (`persist-credentials: false`), `mvn -B package -DskipTests`, bundle the jar, `vsce package`, `gh release upload` the `.vsix` + jar, `upload-artifact` the `.vsix`. **No re-test** — ci.yml already gated the release PR at merge. |
| `publish-marketplace` | `build` | `contents: read` | `vscode-marketplace` | `download-artifact` (**pinned by SHA**), `vsce publish --packagePath *.vsix -p "$VSCE_PAT"`. |
| `publish-openvsx` | `build` | `contents: read`, `id-token: write` | `open-vsx` | `download-artifact` (**pinned by SHA**), `ovsx publish *.vsix --trusted-publishing` (OIDC, no token). Runs in parallel with `publish-marketplace`. |
| `smoke` | `publish-marketplace`, `publish-openvsx` | `{}` | — | `continue-on-error: true`; retries `vsce show` + an Open VSX API probe. A lagging registry does not fail the release. |

### PAT debt — due 2026-12-01

`publish-marketplace` authenticates with a classic Personal Access Token
(`secrets.P_A_T`, exposed as `VSCE_PAT`). The VS Code Marketplace does not yet
support OIDC trusted publishing the way Open VSX does. This is tracked debt:
**revisit by 2026-12-01** — move to Marketplace trusted publishing if it has
shipped by then, otherwise rotate the PAT and re-confirm its scope
(Marketplace → Manage, `Marketplace: Publish` only).

### Manual prerequisites (outside #87, before the first real release)

- **Open VSX**: create an Eclipse account, sign the Publisher Agreement, run
  `ovsx create-namespace aphp`, request Namespace Access, and register the
  trusted publisher (`aphp/fhir-mapbuilder` + `release.yml`) at
  `open-vsx.org/user-settings/trusted-publishers`.
- **GitHub environments** `vscode-marketplace` and `open-vsx` must exist (add
  required reviewers / branch limits there if desired).
- **Confirm the `ovsx` invocation** against the CLI version resolved at
  first-release time. `release.yml` runs `ovsx publish *.vsix
  --trusted-publishing` (OIDC, no PAT); `ovsx` 1.1.1 exposes only `--pat`, so
  the trusted-publishing entry point may need a specific `ovsx` version or a
  flagless OIDC path. Pin `ovsx` in the workflow once verified.

## Consequences

- A merge to `main` either updates the standing release PR or, if that PR is the
  one being merged, ships a release end to end (tag → GitHub Release assets →
  Marketplace + Open VSX → smoke).
- `pom.xml` and `package.json` versions can no longer drift — `linked-versions`
  moves them together.
- The first automated release produces a one-line reformat of the `<project>`
  opening tag in `pom.xml` (release-please's XML serializer collapses the
  attributes onto one line). Cosmetic, valid XML, not formatter-checked.
- The release bot's commit (`chore(main): release …`) is signed off and
  Conventional, so it passes `dco` / `commitlint` with no special-casing.

## Alternatives considered

- **Single `vscode-extension` package with `../` paths.** The spec's first
  choice; rejected because release-please 17.x rejects `../` in path options
  (dry-run).
- **A third `simple` component at the repo root just to own `CHANGELOG.md`.**
  Rejected: the spec's fallback is explicitly two components, and moving the
  changelog next to the extension it documents is cleaner and feeds the
  Marketplace changelog tab.
- **Keep the manual tag + dispatch.** Rejected: it is the source of the version
  drift and the hand-maintained changelog this record removes.
- **Marketplace PAT stored per-environment with no expiry tracking.** Rejected:
  the debt is recorded here with a review date instead.
