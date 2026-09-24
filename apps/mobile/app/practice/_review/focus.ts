import type { Tag } from '@loro/core'

export type ReviewFocus = 'pronunciation' | 'remember' | 'useful' | 'recall'

export function reviewFocus(tags: readonly Tag[]): ReviewFocus {
  if (tags.includes('pron')) return 'pronunciation'
  if (tags.includes('remember')) return 'remember'
  if (tags.includes('useful')) return 'useful'
  return 'recall'
}
