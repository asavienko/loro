// The three grades as the players and the bar above the tabs show them (plan 107): a phrase's rating and a song's.
import type { Grade } from '@shared/state/types';
import type { IconName } from './Icon';
import { colors, type ColorName } from './theme';

export const GRADES: { grade: Grade; icon: IconName; bg: string; ink: ColorName }[] = [
  { grade: 'missed', icon: 'replay', bg: colors.surfaceContainerHigh, ink: 'onSurface' },
  { grade: 'hard', icon: 'hourglass_empty', bg: colors.secondaryContainer, ink: 'onSurface' },
  { grade: 'easy', icon: 'check', bg: colors.tertiaryFixed, ink: 'onTertiaryFixed' },
];
