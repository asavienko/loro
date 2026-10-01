// The builds as they stood on 1 Oct 2026, in GitHub's release shape, so the same parser reads them.
// The page shows these only when it cannot reach GitHub: while the repository is private, or when
// the visitor is offline or rate-limited. A successful load replaces them; nobody updates this file
// for a new build.

export const SNAPSHOT_DATE = '2026-10-01'

const RELEASES = 'https://github.com/asavienko/loro/releases'

/**
 * @param {string} commit
 * @param {string} stamp The upload's millisecond timestamp in the tag.
 * @param {string} publishedAt
 * @param {number} size
 * @param {string} digest
 */
function release(commit, stamp, publishedAt, size, digest) {
  const short = commit.slice(0, 12)
  const tag = `apk-${short}-${stamp}`
  const apk = `loro-preview-${short}.apk`
  return {
    tag_name: tag,
    target_commitish: commit,
    published_at: publishedAt,
    html_url: `${RELEASES}/tag/${tag}`,
    draft: false,
    assets: [
      {
        name: apk,
        size,
        digest: `sha256:${digest}`,
        browser_download_url: `${RELEASES}/download/${tag}/${apk}`,
      },
      {
        name: `${apk}.sha256`,
        size: 96,
        browser_download_url: `${RELEASES}/download/${tag}/${apk}.sha256`,
      },
    ],
  }
}

export const SNAPSHOT_RELEASES = [
  release(
    'e30a8487d4b2c72a26bab16bf3080696eed2bca8',
    '1790893326453',
    '2026-10-01T22:22:18Z',
    62412690,
    '49328081528adece035529533e48e4373f7ac8d8cb90791eea0ce2a987956dca',
  ),
  release(
    'a71a9377ac08e23f076aacf14e346c2f7aa60e56',
    '1790889939599',
    '2026-10-01T21:25:51Z',
    62414722,
    '0d8ec5a78e8589b85dc35e16cf32ec3536ccd9ec57f5e5d3a725ddeb4ff98981',
  ),
  release(
    'b63c0d14cd7ad815e96e3ee3de1b503d3a3235fd',
    '1790887646396',
    '2026-10-01T20:47:38Z',
    62302558,
    '7b31250c5c10558a13869da3d3c248b204dfb4481b48b982d112e13c9e7e8e9d',
  ),
  release(
    '81861f04e2634e680cda0d5efb147cc4472e43c3',
    '1790885193230',
    '2026-10-01T20:07:10Z',
    61477665,
    '59659ffe39570d2419b936d5cba5543d964124df20b29dbd030af518047e20f3',
  ),
  release(
    'd5dc27ad2ca3ce36acbfd4b767fd94e298333072',
    '1790864413546',
    '2026-10-01T14:20:32Z',
    61475457,
    '5310088d7b4efefb29244e998c88d1d5aa7c56e5ecf061787fcedef8c9340e3f',
  ),
  release(
    '1b17cf1800ab6bd035ddcdbaf9d33a524ce19e47',
    '1790853182790',
    '2026-10-01T11:17:06Z',
    61454781,
    'f9f3db9a0c2d6b8a27486dfa3fb28a90a445373ec0b39c7d517c4b2a3e7e213f',
  ),
  release(
    '00e91047c10692a0e2e700815fc13e0625889e47',
    '1789037884170',
    '2026-09-10T11:00:02Z',
    51950960,
    '01646ac0e01382fc7c4283ae150b2b0522e1c5ff7187d1155eede24f995fc68b',
  ),
  release(
    '6891fe5316a436c9e6980bb1129fa63a88880e18',
    '1788787276781',
    '2026-09-07T13:26:42Z',
    45511837,
    'd7f63a93f47476f14daf325d660481bf9bd02539fc11dce93cab478aacc7e0c6',
  ),
]

/**
 * The commit each saved build was made from, by its first 12 characters: shown in place of GitHub's
 * compare, which needs GitHub. Builds whose commit is not in this checkout have none.
 *
 * @type {Record<string, string>}
 */
export const SNAPSHOT_COMMITS = {
  e30a8487d4b2: 'Let learners reuse earlier covers without drawing again (#62)',
  a71a9377ac08: 'docs(docs): loro teaches and speaks polish, czech and american english (F-08)',
  b63c0d14cd7a:
    'chore(ci): drop the cursor agent environment and the old sign-in image drafts (F-04)',
  '81861f04e263': 'docs(docs): plan 111 records what was measured and what is left (AI-05, LIB-04)',
  d5dc27ad2ca3:
    'feat(mobile): the bar above the tabs takes a rating and slides between items (P3-31, LIB-03)',
  '1b17cf1800ab': 'docs(docs): plan 108 is done and archived (AI-06, F-04)',
}
