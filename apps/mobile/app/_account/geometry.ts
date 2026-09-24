/** v1.3 sign-in hub measurements that are not on the space scale. */

export const EMBLEM = 112
export const EMBLEM_SM = 96
export const TILE = 80
export const TILE_SM = 64
/** HTML emblem tile `rounded-2xl`. */
export const TILE_RADIUS = 16
export const BADGE = 32
export const BADGE_SM = 28
/** HTML bolt badge `rounded-xl` / sign-out `rounded-lg`. */
export const BADGE_RADIUS = 12
export const BADGE_RADIUS_SM = 8
/** HTML badge `right-2 bottom-1`. */
export const BADGE_INSET_X = 8
export const BADGE_INSET_Y = 4
/** HTML sign-out badge `right-1 bottom-0`. */
export const BADGE_INSET_X_SM = 4
export const BADGE_INSET_Y_SM = 0
/** HTML dashed ring `border-2`. */
export const RING_BORDER = 2
/** HTML emblem `my-3`. */
export const EMBLEM_MY = 12
/** HTML sign-out emblem `my-2`. */
export const EMBLEM_MY_SM = 8
export const MARK = 34
export const MARK_SM = 32
/** HTML method-row mark `w-4 h-4` — letter G / , not brand-hex SVGs. */
export const METHOD_MARK = 16
/** HTML Apple SVG `mb-0.5` (`space['0.5']`). Not on unavailable letter . */
export const METHOD_APPLE_MARK_NUDGE = 2
/** HTML method `h-12`. */
export const METHOD_HEIGHT = 48
/** HTML method `rounded-xl`. */
export const METHOD_RADIUS = 12
/** HTML method `px-4`. */
export const METHOD_PAD_X = 16
/** HTML method row `gap-3` / stack `space-y-3`. */
export const METHOD_GAP = 12
/** HTML idle method label is `text-sm font-semibold` with no tracking. */
export const METHOD_LABEL_WEIGHT = '600'
export const METHOD_LABEL_TRACK = 0
/** HTML unavailable social tiles use `text-sm font-medium`. */
export const METHOD_DOWN_WEIGHT = '500'
/** HTML unavailable email primary is `text-sm font-semibold tracking-tight` (−0.025em on 14). */
export const METHOD_EMAIL_DOWN_TRACK = -0.35
/** HTML keep-practising is `text-sm font-medium`. bodySm is 14 / 400. */
export const KEEP_PRACTISING_WEIGHT = '500'
/** HTML keep-practising `underline-offset-4`. Connecting hub has no underline. */
export const KEEP_PRACTISING_UNDERLINE_OFFSET = 4
/** HTML device-progress is `text-xs` (12 / 400, no tracking). captionSm is 12 / 600 / 0.04em. */
export const DEVICE_PROGRESS = 12
export const DEVICE_PROGRESS_WEIGHT = '400'
export const DEVICE_PROGRESS_TRACK = 0
/** HTML social-down title is `text-xs font-bold tracking-tight` (−0.025em on 12). */
export const SOCIAL_DOWN = 12
export const SOCIAL_DOWN_WEIGHT = '700'
export const SOCIAL_DOWN_TRACK = -0.3
/** HTML social-down body is `text-xs` (12 / 400, no tracking). */
export const SOCIAL_DOWN_BODY_WEIGHT = '400'
export const SOCIAL_DOWN_BODY_TRACK = 0
export const STAY_HEIGHT = 52
/** HTML stay / leave are `text-sm font-semibold` with no tracking. body is 0.02em. */
export const SIGN_OUT_STAY_TRACK = 0
export const SIGN_OUT_LEAVE_TRACK = 0
/** HTML sign-out leave `h-12`. */
export const LEAVE_HEIGHT = 48
/** HTML sign-out safe-lines are `text-xs` (12). caption is 14. */
export const SIGN_OUT_SAFE = 12
/** HTML sign-out safe title is `text-sm font-semibold` with no tracking. body is 0.02em. */
export const SIGN_OUT_SAFE_TITLE_TRACK = 0
/** HTML sign-out footer is `text-xs font-normal` (12 / 400, no tracking). */
export const SIGN_OUT_NOTE = 12
export const SIGN_OUT_NOTE_WEIGHT = '400'
export const SIGN_OUT_NOTE_TRACK = 0
/** HTML sign-out actions `mt-5`. */
export const SIGN_OUT_ACTIONS_TOP = 20
/** HTML auth stack `mt-7`. */
export const METHOD_STACK_TOP = 28
/** HTML cancelled methods `mt-5` after the notice. */
export const METHOD_STACK_CANCELLED = 20
/** HTML error / unavailable methods `mt-4`. */
export const METHOD_STACK_COMPACT = 16
/** HTML body `px-6 pt-6`. */
export const HUB_PAD = 24
/** HTML heading `text-2xl`. */
export const HUB_TITLE = 24
export const HUB_TITLE_LINE = 32
/** HTML heading `font-bold tracking-tight`. */
export const HUB_TITLE_WEIGHT = '700'
export const HUB_TITLE_TRACK = -0.6
/** HTML hub/sign-out nav `text-lg font-semibold tracking-tight`. Not title3 20. */
export const HUB_NAV_TITLE = 18
export const HUB_NAV_TITLE_LINE = 28
export const HUB_NAV_TITLE_TRACK = -0.45
export const HUB_NAV_TITLE_WEIGHT = '600'
/** HTML hub Today is `text-sm font-semibold tracking-tight` (−0.025em on 14). */
export const HUB_NAV_TODAY = 14
export const HUB_NAV_TODAY_WEIGHT = '600'
export const HUB_NAV_TODAY_TRACK = -0.35
/** HTML hub body `text-sm leading-relaxed`. */
export const HUB_BODY = 14
export const HUB_BODY_LINE = 22.75
export const CONTENT_PAD_BOTTOM = 32
export const MAX_COPY_WIDTH = 320
/** HTML connecting helper `w-2.5` ping well — PulseRing sits in this 10px box. */
export const CONNECTING_DOT = 10
export const BANNER_DOT = 8
export const TILE_TILT_DEG = -6
/** Connecting and sign-out HTML use `-rotate-3`. */
export const TILE_TILT_BUSY_DEG = -3
export const BADGE_TILT_DEG = 6
export const RING_MS_IDLE = 20_000
export const RING_MS_BUSY = 8_000
export const UNAVAILABLE_BADGE_SIZE = 11
export const NOTICE_MARK = 20
/** HTML cancelled notice info mark `w-4`. */
export const INFO_MARK = 16
/** HTML cancelled notice `mt-4`. */
export const NOTICE_TOP = 16
/** HTML error notice `mt-5`. */
export const NOTICE_TOP_ERROR = 20
/** HTML cancelled notice `gap-2.5`. */
export const NOTICE_GAP = 10
/** HTML error notice `gap-3`. */
export const NOTICE_GAP_ERROR = 12
/** HTML cancelled / error notice `p-3.5`. */
export const NOTICE_PAD = 14
/** HTML cancelled hint is `text-xs` (12 / 400, no tracking). */
export const CANCELLED_HINT = 12
export const CANCELLED_HINT_WEIGHT = '400'
export const CANCELLED_HINT_TRACK = 0
/** HTML error-safe notice is `text-xs font-medium` (12 / 500, no tracking). */
export const ERROR_SAFE = 12
export const ERROR_SAFE_WEIGHT = '500'
export const ERROR_SAFE_TRACK = 0
/** HTML connecting card `mt-5`. */
export const PROGRESS_TOP = 20
/** HTML connecting card `p-4`. */
export const PROGRESS_PAD = 16
/** HTML cancel `h-10`. */
export const CANCEL_HEIGHT = 40
/** HTML cancel `rounded-lg` (0.5rem). */
export const CANCEL_RADIUS = 8
/** HTML connecting siblings `opacity-50`. */
export const SIBLING_OPACITY = 0.5
/** HTML unavailable social methods `opacity-60`. */
export const UNAVAILABLE_OPACITY = 0.6
/** HTML connecting helper is `text-xs font-medium` (12 / 500, no tracking). */
export const CONNECTING_HELP = 12
export const CONNECTING_HELP_WEIGHT = '500'
export const CONNECTING_HELP_TRACK = 0
/** HTML cancel is `text-xs font-semibold` (12 / 600, no tracking). */
export const CONNECTING_CANCEL = 12
export const CONNECTING_CANCEL_WEIGHT = '600'
export const CONNECTING_CANCEL_TRACK = 0
/** HTML connecting method `border-2`. */
export const CONNECTING_BORDER = 2
export const SAFE_MARK = 24

export const MARK_BOLT = '⚡'
export const MARK_CLOSE = '×'
export const MARK_WARN = '!'
/** HTML cancelled notice info mark — not a warning triangle. */
export const MARK_INFO = 'i'
export const MARK_MAIL = '✉'
export const MARK_GOOGLE = 'G'
export const MARK_APPLE = ''
export const MARK_CHECK = '✓'
export const MARK_LEAVE = '→'
