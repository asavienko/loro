import { router } from 'expo-router'
import { EmptyState } from '../../src/ui/components'

/** Shared empty rotation for Stream, Speak and Review. Labels come from the caller so copy keys stay put. */
export function PracticeEmptyState({
  title,
  body,
  actionLabel,
  gap,
}: {
  title: string
  body: string
  actionLabel: string
  gap?: number
}) {
  return (
    <EmptyState
      title={title}
      body={body}
      action={{
        label: actionLabel,
        onPress: () => {
          router.push('/add')
        },
      }}
      gap={gap}
    />
  )
}
