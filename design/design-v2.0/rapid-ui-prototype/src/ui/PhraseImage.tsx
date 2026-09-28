import type { TopicTone } from '../content';
import type { IconName } from './icons';
import { TONE } from './SetCover';

/**
 * A phrase's picture (plan 105): its main icon large on its topic's colour, and up to two more in
 * small discs at the corners. Drawn from content, as covers are. Sized by the shorter side (the
 * box is a size container), so a 44 px tile, the player's cover and a card's wide band are one
 * composition. Give it a width and a height. Decorative: the phrase and its meaning are text, and
 * they are what a screen reader says.
 */
export function PhraseImage({ icons, tone = 'secondary', size, className = '' }: { icons: readonly string[]; tone?: TopicTone; size: 'sm' | 'lg'; className?: string }) {
  const [main, ...rest] = icons as readonly IconName[];
  return (
    <span aria-hidden="true" data-phrase-image={icons.join(' ')} className={`[container-type:size] relative block overflow-hidden ${TONE[tone]} ${className}`}>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className={`material-symbols-outlined opacity-90 ${size === 'sm' ? 'text-[length:60cqmin]' : 'text-[length:46cqmin]'}`}>{main}</span>
      </span>
      {size === 'lg' &&
        rest.map((icon, i) => (
          <span
            key={icon}
            className={`absolute ${i === 0 ? 'left-[7cqmin] top-[7cqmin]' : 'right-[7cqmin] bottom-[7cqmin]'} w-[26cqmin] h-[26cqmin] rounded-full bg-surface/65 flex items-center justify-center`}
          >
            <span className="material-symbols-outlined text-[length:15cqmin]">{icon}</span>
          </span>
        ))}
    </span>
  );
}
