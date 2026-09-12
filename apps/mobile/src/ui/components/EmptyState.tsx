/**
 * `EmptyState` — a centred title, a line of body copy, and optionally one action.
 *
 * Four screens hand-rolled this shape and no two agreed on the gap or the padding, so both
 * are props with the commonest pair as the default. `align` exists for the same reason: the
 * two texts on phrase detail carry no `align` today, and while a single line looks identical
 * either way, at 310% text it wraps and the difference becomes visible.
 *
 * Copy is passed in. This component imports no strings — `src/lib/copy.ts` is the catalog and
 * the screen reads from it.
 */

import { View } from 'react-native'
import { Button, Text } from '../primitives'
import { emptyState, ink } from '../theme'

export function EmptyState({
  title,
  body,
  action,
  padding = emptyState.padding,
  gap = emptyState.gap,
  align = 'center',
}: {
  title: string
  body: string
  action?:
    | { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'destructive' }
    | undefined
  /** `0` for a state that sits inside a container which already pads. */
  padding?: number | undefined
  gap?: number | undefined
  /** `'left'` leaves the text at its natural alignment; the box is centred either way. */
  align?: 'left' | 'center' | undefined
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding, gap }}>
      <Text variant="title2" color={ink.ink} align={align}>
        {title}
      </Text>
      <Text variant="bodyMd" color={ink.ink2} align={align}>
        {body}
      </Text>
      {action !== undefined && (
        <Button label={action.label} onPress={action.onPress} variant={action.variant} />
      )}
    </View>
  )
}
