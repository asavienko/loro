import { getTopic, PhraseSet, TopicTone } from '../content';

export const TONE: Record<TopicTone, string> = {
  primary: 'bg-primary-fixed text-on-primary-fixed',
  secondary: 'bg-secondary-container text-on-secondary-fixed',
  tertiary: 'bg-tertiary-fixed text-on-tertiary-fixed',
};

// Inline sizes: the icon font's own stylesheet fixes .material-symbols-outlined
// at 24px and would override a size utility.
const ICON_PX = { sm: 40, md: 112, lg: 180 } as const;

interface SetCoverProps {
  set: PhraseSet;
  size: keyof typeof ICON_PX;
  /** Sizing and rounding of the square; the cover fills it. */
  className?: string;
}

/**
 * A set's cover, drawn from content: the topic's colour and the set's icon,
 * cropped at the corner. The player's large cover also carries the title,
 * which the smaller covers already have beside them. Local, so it
 * works offline and never shows text or numbers the content doesn't have.
 */
export function SetCover({ set, size, className = '' }: SetCoverProps) {
  const tone = getTopic(set.topicId)?.tone ?? 'secondary';
  return (
    <span aria-hidden="true" className={`relative block overflow-hidden ${TONE[tone]} ${className}`}>
      <span
        className="material-symbols-outlined absolute -right-[12%] -bottom-[14%] opacity-80"
        style={{ fontSize: ICON_PX[size] }}
      >
        {set.coverIcon}
      </span>
      {size === 'lg' && (
        <span className="absolute left-0 top-0 max-w-[80%] p-5 font-serif text-[32px] font-bold leading-[1.05]">
          {set.title}
        </span>
      )}
    </span>
  );
}
