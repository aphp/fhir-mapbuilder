# Security Policy

## Supported versions

There is a single active release line. Security fixes land on `main` and ship in
the next release; there are no backports to older tags.

| Version | Supported |
|---|---|
| `main` (development branch) | :white_check_mark: |
| Latest published release (currently `v1.6.0`) | :white_check_mark: |
| Any earlier release | :x: |

If you are on an older version, upgrade to the latest release published to the
VS Code Marketplace / Open VSX.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):
open a draft advisory at
<https://github.com/aphp/fhir-mapbuilder/security/advisories/new>.

Helpful things to include:

- the affected component (`vscode-extension` or `fhir-mapbuilder-validation`) and version,
- a description of the issue and its impact,
- reproduction steps or a proof of concept, if you have one.

## What to expect

This is a **best-effort** process with **no contractual SLA**:

- an acknowledgement within roughly **5 business days**;
- if the report is confirmed: a fix on `main`, a new release, and coordinated
  disclosure through a GitHub Security Advisory — crediting you unless you ask
  otherwise;
- if it is declined: a short explanation of why.

Response and fix times depend on severity and maintainer availability and are
not guaranteed.
