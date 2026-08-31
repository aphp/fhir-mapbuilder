/**
 * Commit message policy — see docs/adr/0001-politique-de-commits.md.
 *
 * Enforced in CI by .github/workflows/commit-policy.yml (job `commitlint`,
 * wagoid/commitlint-github-action) on every non-merge commit of a pull request.
 * The same Conventional Commits grammar is expected of the PR title, which
 * becomes the subject of the merge commit and feeds release-please.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allowed commit types. Narrower than the Angular default on purpose:
    // these are the only types release-please is configured to act on.
    'type-enum': [2, 'always', ['feat', 'fix', 'test', 'docs', 'chore', 'build']],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    // Header (`type(scope): subject`) capped so it fits a merge-commit subject line.
    'header-max-length': [2, 'always', 72],
    // No trailing period on the subject.
    'subject-full-stop': [2, 'never', '.'],
    // Scopes are free-form: neither required nor constrained to a fixed list.
    'scope-enum': [0],
    // Let contributors phrase the subject however reads best (no case rule).
    'subject-case': [0],
    // Dependabot / release-please wrap long body and footer lines we don't control.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
