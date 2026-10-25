import React, { useState } from 'react';
import { CapyBadge, BADGE_MAP } from '../../types/badges';
import { Lock } from 'lucide-react';

interface Props {
  badgeId: string;
  size?: number;
  isLocked?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export const CapyBadgeIcon: React.FC<Props> = ({
  badgeId,
  size = 16,
  isLocked = false,
  showTooltip = true,
  className = '',
}) => {
  const badge = BADGE_MAP[badgeId];
  const [isHovered, setIsHovered] = useState(false);

  if (!badge) return null;

  const renderSvg = () => {
    switch (badge.iconType) {
      case 'founder':
        // Golden royal crown with jewel
        return (
          <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <defs>
              <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff3a8" />
                <stop offset="50%" stopColor="#f1c40f" />
                <stop offset="100%" stopColor="#d48806" />
              </linearGradient>
              <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#f1c40f" floodOpacity="0.4" />
              </filter>
            </defs>
            <path
              d="M3 17.5L4.5 7.5L8.5 12.5L12 5.5L15.5 12.5L19.5 7.5L21 17.5H3Z"
              fill="url(#gold-grad)"
              filter={isLocked ? undefined : 'url(#gold-glow)'}
              stroke="#874d00"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            <rect x="3" y="18.5" width="18" height="2" rx="1" fill="#d48806" />
            <circle cx="12" cy="14" r="1.3" fill="#ffffff" />
            <circle cx="7" cy="15" r="1" fill="#fff3a8" />
            <circle cx="17" cy="15" r="1" fill="#fff3a8" />
          </svg>
        );

      case 'staff':
        // Sleek CapyChat Staff emblem (Shield with wrench / star)
        return (
          <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <defs>
              <linearGradient id="staff-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8ea1ff" />
                <stop offset="50%" stopColor="#5865f2" />
                <stop offset="100%" stopColor="#3c45a5" />
              </linearGradient>
            </defs>
            <path
              d="M12 2L4 5.5V11.5C4 16.5 7.4 21.1 12 22C16.6 21.1 20 16.5 20 11.5V5.5L12 2Z"
              fill="url(#staff-grad)"
              stroke="#2c3275"
              strokeWidth="0.8"
            />
            <path
              d="M12 6.5L13.5 10.5H17.5L14.2 13L15.5 17L12 14.5L8.5 17L9.8 13L6.5 10.5H10.5L12 6.5Z"
              fill="#ffffff"
            />
          </svg>
        );

      case 'moderator':
        // Emerald Guardian Shield
        return (
          <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <defs>
              <linearGradient id="mod-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#72f1a6" />
                <stop offset="50%" stopColor="#2ecc71" />
                <stop offset="100%" stopColor="#1e8449" />
              </linearGradient>
            </defs>
            <path
              d="M12 2L3 6V12C3 17.5 6.8 21.6 12 23C17.2 21.6 21 17.5 21 12V6L12 2Z"
              fill="url(#mod-grad)"
              stroke="#145a32"
              strokeWidth="0.8"
            />
            <path
              d="M10 15.5L6.5 12L7.9 10.6L10 12.7L16.1 6.6L17.5 8L10 15.5Z"
              fill="#ffffff"
            />
          </svg>
        );

      case 'supporter':
        // Glowing Pink / Magenta Diamond Crystal
        return (
          <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <defs>
              <linearGradient id="sup-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff8adc" />
                <stop offset="50%" stopColor="#eb459e" />
                <stop offset="100%" stopColor="#a31d68" />
              </linearGradient>
            </defs>
            <path
              d="M12 2L20.5 8.5L12 22L3.5 8.5L12 2Z"
              fill="url(#sup-grad)"
              stroke="#7a144d"
              strokeWidth="0.8"
            />
            <path
              d="M12 2L15.5 8.5L12 22L8.5 8.5L12 2Z"
              fill="#ffffff"
              fillOpacity="0.3"
            />
            <circle cx="12" cy="8.5" r="1.5" fill="#ffffff" />
          </svg>
        );

      case 'community':
        // Cyan Spirit Capy Badge
        return (
          <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <defs>
              <linearGradient id="comm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#76d7ea" />
                <stop offset="50%" stopColor="#3498db" />
                <stop offset="100%" stopColor="#1b4f72" />
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="9.5" fill="url(#comm-grad)" stroke="#154360" strokeWidth="0.8" />
            <path
              d="M8.5 9.5C9.3 9.5 10 8.8 10 8C10 7.2 9.3 6.5 8.5 6.5C7.7 6.5 7 7.2 7 8C7 8.8 7.7 9.5 8.5 9.5Z"
              fill="#ffffff"
            />
            <path
              d="M15.5 9.5C16.3 9.5 17 8.8 17 8C17 7.2 16.3 6.5 15.5 6.5C14.7 6.5 14 7.2 14 8C14 8.8 14.7 9.5 15.5 9.5Z"
              fill="#ffffff"
            />
            <path
              d="M12 17C14.5 17 16 15 16 13.5C16 12 14.2 11 12 11C9.8 11 8 12 8 13.5C8 15 9.5 17 12 17Z"
              fill="#ffffff"
            />
            <circle cx="12" cy="13" r="1.2" fill="#1b4f72" />
          </svg>
        );

      case 'events':
        // Amber/Bronze Tournament Flame Trophy
        return (
          <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <defs>
              <linearGradient id="ev-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f8c471" />
                <stop offset="50%" stopColor="#e67e22" />
                <stop offset="100%" stopColor="#935116" />
              </linearGradient>
            </defs>
            <path
              d="M5 4H19V8C19 11.9 15.9 15 12 15C8.1 15 5 11.9 5 8V4Z"
              fill="url(#ev-grad)"
              stroke="#784212"
              strokeWidth="0.8"
            />
            <path d="M12 15V19M8 21H16" stroke="#e67e22" strokeWidth="2" strokeLinecap="round" />
            <path d="M3 5H5V8C5 9.5 6 10.7 7.3 11.2C6 9.8 5 8 5 6V5H3Z" fill="#f8c471" />
            <path d="M21 5H19V8C19 9.5 18 10.7 16.7 11.2C18 9.8 19 8 19 6V5H21Z" fill="#f8c471" />
            <circle cx="12" cy="8.5" r="2" fill="#ffffff" />
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none cursor-pointer group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsHovered((prev) => !prev)}
      tabIndex={0}
      role="img"
      aria-label={`${badge.name}: ${badge.description}`}
    >
      <div
        className={`transition-all duration-200 ${
          isLocked
            ? 'grayscale opacity-35 filter contrast-75'
            : 'hover:scale-105 active:scale-95'
        }`}
        style={{
          filter: isLocked
            ? 'grayscale(100%) opacity(0.35)'
            : `drop-shadow(0 0 2px ${badge.glowColor})`,
        }}
      >
        {renderSvg()}
      </div>

      {isLocked && (
        <span
          className="absolute -bottom-1 -right-1 bg-[#111214] text-[#80848e] rounded-full p-0.5 border border-[#2b2d31] shadow-xs"
          title="Bloqueada"
        >
          <Lock className="w-2.5 h-2.5" />
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && isHovered && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[99999] pointer-events-none animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: '160px', maxWidth: '240px' }}
        >
          <div className="bg-[#111214] text-white p-2.5 rounded-md shadow-2xl border border-[#2b2d31] text-left">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: badge.color }}
              />
              <span className="font-bold text-xs text-white leading-tight">
                {badge.name}
              </span>
              {isLocked && (
                <span className="text-[10px] text-[#f23f43] font-semibold ml-auto flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Bloqueada
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#b5bac1] leading-relaxed">
              {badge.description}
            </p>
          </div>
          {/* Tooltip beak */}
          <div className="w-2 h-2 bg-[#111214] border-r border-b border-[#2b2d31] rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
};
