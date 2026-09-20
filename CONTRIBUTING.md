# How to contribute to the `aphp/fhir-mapbuilder` project

Thanks for taking the time to contribute! This document covers what you need to
know before opening a pull request. The rationale behind the commit rules lives
in [`docs/adr/0001-politique-de-commits.md`](docs/adr/0001-politique-de-commits.md).

## Build and run

Building the two projects (the TypeScript VS Code extension and the Java
validation service) is described in the [README, "Setup & Installation"
section](README.md#-setup--installation). Follow it once to get a working
checkout before you start changing code.

## Run the tests before you push

A change is not ready until both suites pass locally:

```sh
# VS Code extension (TypeScript)
cd vscode-extension
npm ci
xvfb-run -a npm test        # on Linux; on macOS/Windows just: npm test

# Validation service (Java 21)
cd ../fhir-mapbuilder-validation
mvn -B verify
```

The extension test suite is self-contained: it does **not** need a running
`fhir-mapbuilder-validation` JAR. The packaged JAR is only exercised by the
`build` smoke check in CI, not by `npm test`.

## Formatting and hooks

Formatting is checked in CI, so fix it before you push:

```sh
cd vscode-extension && npm run format          # Prettier, TypeScript
cd fhir-mapbuilder-validation && mvn spotless:apply   # palantir-java-format
```

An optional [`.pre-commit-config.yaml`](.pre-commit-config.yaml) is provided (not
required). If you use [pre-commit](https://pre-commit.com/), run `pre-commit
install` once and it will apply the formatters on every commit. SpotBugs and
`tsc` stay CI-only.

## Commit style

- **Conventional Commits.** Every non-merge commit must be a valid
  [Conventional Commit](https://www.conventionalcommits.org/). Allowed types:
  `feat`, `fix`, `test`, `docs`, `chore`, `build`. The subject line (the whole
  `type(scope): subject` header) must be **72 characters or fewer** and must
  **not** end with a period. Scope is optional and free-form.
- **The PR title is also a Conventional Commit.** It becomes the subject of the
  merge commit and feeds release automation, so it is validated with the same
  grammar.
- **Sign off every commit (DCO).** Add a `Signed-off-by:` trailer with
  `git commit -s`. This certifies you wrote the change or have the right to
  submit it under the project licence (see the [Developer Certificate of
  Origin](https://developercertificate.org/)). To sign an existing branch:
  `git rebase --signoff <base>`.
- **No `CHANGELOG` edits.** The changelog and version bumps are produced by
  release automation from the commit history. Do not touch `CHANGELOG.md` in a
  feature PR.
- **A change to a shipped dependency is a `fix(deps)`.** release-please only
  opens a release PR when the generated changelog is non-empty, and it hides
  `build`. A dependency that ends up in the `.vsix` (the Matchbox jar and the
  other Maven production dependencies, the extension's bundled runtime
  dependencies) must therefore be committed as `fix(deps): …` so it produces a
  release; tooling (test, lint, build plugins, GitHub Actions) stays `build`.
  Dependabot already does this: `fix` for production dependencies, `build` for
  development ones. Apply the same rule to a manual commit such as a CVE pin.
  If a dependency is a dev tool, keep it under `devDependencies` — a tool listed
  as a production dependency would open false releases.

These rules apply to everyone, including bots (Dependabot, release automation);
there is no exemption path.

## Keep a clean branch history

`main` accepts **merge commits only** — squash and rebase merging are disabled at
the repository level, so every commit on your branch lands on `main` and is read
by release automation. Before opening (or updating) a PR:

- Rebase your branch onto the latest `main`.
- Squash fixup/WIP commits so each remaining commit is a self-contained,
  well-described change.
- Do not merge `main` into your branch to "catch up" — rebase instead.

## Releasing

Releases are automated by [release-please](https://github.com/googleapis/release-please)
(ADR 0003); nobody tags by hand.

- **The release PR.** Every push to `main` updates one standing PR
  (`chore(main): release X.Y.Z`) built from the Conventional Commits since the
  last tag. It only exists while the generated changelog is non-empty, and
  release-please hides `build`, `chore`, `docs` and `test`: a `feat`, a `fix` or
  a `fix(deps)` is what opens it (see the shipped-dependency rule above).
  Merging it bumps `vscode-extension/package.json`, its lockfile and
  `fhir-mapbuilder-validation/pom.xml`, cuts the `vX.Y.Z` tag and the GitHub
  Release, then `release.yml` builds the `.vsix` and publishes it to both
  registries. Nothing is published until you merge that PR.
- **Forcing a release.** When only hidden commit types have landed but you want
  to ship (for example a README-only fix), add a `Release-As: X.Y.Z` footer to a
  commit body, in a normal PR like any other change:

  ```
  build: force a 1.7.4 release

  Release-As: 1.7.4
  ```

  The footer must be part of a commit that lands on `main`; the release PR then
  proposes exactly that version.
- **Recovering a release.** If the automated run failed after release-please had
  already created the tag (so the build or a publish never completed), replay it
  from *Actions → Release → Run workflow*: set `publish_tag` to the existing
  `vX.Y.Z` tag and `dry_run` to `false`. The run rebuilds at that tag, checks that
  `package.json`, `pom.xml` and the `.vsix` carry its version, re-uploads the
  assets to the existing GitHub Release, publishes to both registries and runs
  the smoke check. With `dry_run: true` (the default) it stops after the checks
  and publishes nothing; with no `publish_tag` it is a rehearsal on `HEAD` that
  can never publish.

## Security and dependency audits

Vulnerability scanning (Maven + npm) runs through [OSV-Scanner](https://osv.dev/).
If a reported advisory is a false positive or cannot be actioned yet, add a
time-boxed suppression to the root [`osv-scanner.toml`](osv-scanner.toml):

```toml
[[IgnoredVulns]]
id = "GHSA-xxxx-xxxx-xxxx"
ignoreUntil = 2026-12-31   # revisit date; the entry expires on its own
reason = "Not exploitable: the vulnerable code path is never reached (…)."
```

Keep the `reason` specific and the `ignoreUntil` date short. To report a
vulnerability privately, see [`SECURITY.md`](SECURITY.md).
