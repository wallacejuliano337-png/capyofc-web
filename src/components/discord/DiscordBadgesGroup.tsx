import React from 'react';
import { CapyBadgeIcon } from './CapyBadgeIcon';
import { getDisplayedBadgeIds, getUserUnlockedBadgeIds } from '../../types/badges';
import { User } from '../../types/discord';

interface Props {
  user?: (Partial<User> & { role?: string; displayedBadges?: string[] }) | null;
  badgeIds?: string[];
  size?: number;
  className?: string;
  showTooltip?: boolean;
  tooltipPlacement?: 'top' | 'bottom' | 'auto';
}

/**
 * Shared Discord-style Badges Container.
 * Renders badges inside a sleek, discrete, rounded container with exact 3-4px gap,
 * perfectly vertically aligned with user names / handles.
 */
export const DiscordBadgesGroup: React.FC<Props> = ({
  user,
  badgeIds,
  size = 16,
  className = '',
  showTooltip = true,
  tooltipPlacement = 'top',
}) => {
  const ids =
    badgeIds ??
    (user ? getDisplayedBadgeIds(getUserUnlockedBadgeIds(user), user.displayedBadges) : []);

  if (!ids || ids.length === 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-[3.5px] px-1.5 py-[2px] bg-[#111214] border border-[#2b2d31]/80 rounded-[6px] select-none flex-shrink-0 shadow-xs align-middle leading-none ${className}`}
      role="group"
      aria-label="Insígnias do usuário"
    >
      {ids.map((id) => (
        <CapyBadgeIcon
          key={id}
          badgeId={id}
          size={size}
          showTooltip={showTooltip}
          tooltipPlacement={tooltipPlacement}
        />
      ))}
    </div>
  );
};
