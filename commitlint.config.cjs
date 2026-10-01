/**
 * Conventional Commits, with Loro's scopes.
 * See docs/process/git-workflow.md#commits
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'chore', 'content', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'mobile',
        'api',
        'landing',
        'core',
        'core-rs',
        'tokens',
        'content',
        'engines',
        'sync',
        'audio',
        'dsp',
        'widgets',
        'ci',
        'docs',
        'deps',
      ],
    ],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 100],
  },
}
