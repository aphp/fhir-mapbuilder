# 4. Authenticate the validation server with an API token

Date: 2026-09-20

## Status

Accepted.

Follows the first CodeQL scan of `main` (#198).

## Context

The validation server is a local service started by the extension and shared by
all of a user's VS Code windows. Its endpoints take filesystem paths (FML source,
data file, output folder, IG package) as inputs: that is the API. The extension
sends the active editor file, the `dataFile` setting and the workspace or home
folder, none of which sits under a single root.

## Decision

- The server listens on the loopback interface only.
- Every endpoint except `/health` requires the `X-MapBuilder-Token` header. The
  **API token** is generated once by the extension, kept in VS Code
  `SecretStorage` so every window shares it, and handed to the server through an
  environment variable, never a command-line argument.
- If no token is configured (standalone jar), the server generates one at
  startup and logs it once.
- The `java/path-injection` alerts are dismissed as *won't fix*: the paths are
  the tool's API, reachable only through the authenticated, loopback-only server.
  The `java/error-message-exposure` alerts are fixed by returning a generic
  message from catch-all handlers; domain error messages remain because they are
  the extension's user-facing output.

## Considered options

- **Allowlist of path roots.** Rejected: legitimate inputs live outside the
  workspace (active editor file, `dataFile` setting, home-folder fallback) and
  roots fixed at launch go stale when the workspace changes.
- **Per-launch token.** Rejected: windows reuse a running server and would hold
  a token they did not create.
- **Per-window random port.** Deferred: cleaner, but a larger change than this
  record justifies.

## Consequences

- The server and the extension must ship together (already true: the jar is
  bundled). Standalone `curl` usage now needs the header.
- Path checks are not a second line of defence; the token is the boundary.
- A server left running with a different token answers `401` to every call
  except `/health`; restarting it fixes that.
