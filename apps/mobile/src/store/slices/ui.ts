/**
 * Transient UI state the whole app shares: the selected row, and the one toast.
 *
 * One toast at a time, deliberately — `showToast` replaces rather than queues, which is why
 * `ToastHost` needs no queue of its own.
 */

import type { Slice } from '../types'

export const createUiSlice: Slice<'select' | 'showToast' | 'clearToast'> = ({ set }) => ({
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
