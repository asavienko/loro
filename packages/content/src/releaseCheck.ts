/** Production gate, separate from structural validation of draft content. F-08. */
import starter from '../translations/starter.json' with { type: 'json' }
if (starter.reviewStatus !== 'reviewed') {
  throw new Error(
    'F-08 release blocked: Bulgarian/Russian starter translations require bilingual review. See plans/85-multilingual-app-and-language-selection.md.',
  )
}
