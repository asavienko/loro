import { Button, Sheet, Text } from '../../src/ui/primitives'
import { ink } from '../../src/ui/theme'

/**
 * NAV-04 Pause · End it here · Keep going. Labels are props so Stream can tell
 * the truth (no Today resume row) while Refrain keeps its checkpoint note.
 */
export function SessionExitSheet({
  visible,
  title,
  pauseLabel,
  endLabel,
  keepGoingLabel,
  note,
  dismissLabel,
  onPause,
  onEnd,
  onKeepGoing,
}: {
  visible: boolean
  title: string
  pauseLabel: string
  endLabel: string
  keepGoingLabel: string
  note: string
  dismissLabel: string
  onPause: () => void
  onEnd: () => void
  onKeepGoing: () => void
}) {
  return (
    <Sheet visible={visible} onDismiss={onKeepGoing} dismissLabel={dismissLabel}>
      <Text variant="title3" color={ink.ink}>
        {title}
      </Text>
      <Button label={pauseLabel} onPress={onPause} />
      <Button label={endLabel} variant="secondary" onPress={onEnd} />
      <Button label={keepGoingLabel} variant="secondary" onPress={onKeepGoing} />
      <Text variant="captionSm" color={ink.muted}>
        {note}
      </Text>
    </Sheet>
  )
}
