/**
 * Transient UI state the whole app shares: the selected row, and the one toast.
 *
 * One toast at a time, deliberately — `showToast` replaces rather than queues, which is why
 * `ToastHost` needs no queue of its own.
 */

import type { Slice } from '../types'
import { importDraftKey } from '../../lib/importDraft'

export const createUiSlice: Slice<
  'select' | 'showToast' | 'clearToast' | 'saveImportDraft' | 'clearImportDraft'
> = ({ get, set }) => ({
  saveImportDraft: (importDraft) => {
    set({
      importDraft,
      importDrafts: { ...get().importDrafts, [importDraftKey(importDraft)]: importDraft },
    })
  },
  clearImportDraft: () => {
    const current = get().importDraft
    if (current === null) return
    const drafts = { ...get().importDrafts }
    delete drafts[importDraftKey(current)]
    set({ importDraft: null, importDrafts: drafts })
  },
  select: (id) => {
    set({ selectedId: id })
  },
  showToast: (message, undo) => {
    set({ toast: undo ? { message, undo } : { message } })
  },
  clearToast: () => {
    set({ toast: null })
  },
})
