import React, { useState, useRef, useLayoutEffect } from 'react';
import { BADGE_MAP } from '../../types/badges';
import { Lock } from 'lucide-react';

interface Props {
  badgeId: string;
  size?: number;
  isLocked?: boolean;
  showTooltip?: boolean;
  tooltipPlacement?: 'top' | 'bottom' | 'auto';
  className?: string;
}

export const CapyBadgeIcon: React.FC<Props> = ({
  badgeId,
  size = 16,
  isLocked = false,
  showTooltip = true,
  tooltipPlacement = 'auto',
  className = '',
}) => {
  const badge = BADGE_MAP[badgeId];
  const [isHovered, setIsHovered] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [computedPlacement, setComputedPlacement] = useState<'top' | 'bottom'>('top');
  const [alignMode, setAlignMode] = useState<'center' | 'left' | 'right'>('center');

  useLayoutEffect(() => {
    if (!isHovered || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (tooltipPlacement === 'auto') {
      // If close to the top of the viewport or parent, flip downwards
      if (rect.top < 110) {
        setComputedPlacement('bottom');
      } else {
        setComputedPlacement('top');
      }
    } else {
      setComputedPlacement(tooltipPlacement);
    }

    if (rect.left + 140 > window.innerWidth - 16) {
      setAlignMode('right');
    } else if (rect.left - 100 < 16) {
      setAlignMode('left');
    } else {
      setAlignMode('center');
    }
  }, [isHovered, tooltipPlacement]);

  if (!badge) return null;

  const renderSvg = () => {
    switch (badge.iconType) {
      case 'founder':
        // Discord-grade Royal Founder Crown (Gold & Gems)
        return (
          <svg
            viewBox="0 0 16 16"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
            style={{ imageRendering: 'crisp-edges' }}
          >
            <defs>
              <linearGradient id="capy-founder-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff3a8" />
                <stop offset="50%" stopColor="#f1c40f" />
                <stop offset="100%" stopColor="#d48806" />
              </linearGradient>
              <linearGradient id="capy-founder-dark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f1c40f" />
                <stop offset="100%" stopColor="#b77900" />
              </linearGradient>
            </defs>
            <path
              d="M2 11.5L2.8 5L5.8 7.8L8 2.5L10.2 7.8L13.2 5L14 11.5H2Z"
              fill="url(#capy-founder-grad)"
              stroke="#7a5200"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
            <rect
              x="2"
              y="11.8"
              width="12"
              height="1.8"
              rx="0.6"
              fill="url(#capy-founder-dark)"
              stroke="#7a5200"
              strokeWidth="0.75"
            />
            <path d="M8 5.2L9.2 7.8L8 9.5L6.8 7.8L8 5.2Z" fill="#ffffff" fillOpacity="0.9" />
            <circle cx="4.5" cy="12.7" r="0.6" fill="#fff3a8" />
            <circle cx="8" cy="12.7" r="0.7" fill="#ffffff" />
            <circle cx="11.5" cy="12.7" r="0.6" fill="#fff3a8" />
          </svg>
        );

      case 'staff':
        // Discord-grade Staff Hexagonal Tech Emblem (Blurple)
        return (
          <svg
            viewBox="0 0 16 16"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
            style={{ imageRendering: 'crisp-edges' }}
          >
            <defs>
              <linearGradient id="capy-staff-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7983f5" />
                <stop offset="60%" stopColor="#5865f2" />
                <stop offset="100%" stopColor="#3c45a5" />
              </linearGradient>
            </defs>
            <path
              d="M8 1.5L14 4.5V10.5L8 14.5L2 10.5V4.5L8 1.5Z"
              fill="url(#capy-staff-grad)"
              stroke="#2c3275"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
            <path
              d="M8 4.2L9.2 6.8H11.8L9.7 8.4L10.5 11L8 9.3L5.5 11L6.3 8.4L4.2 6.8H6.8L8 4.2Z"
              fill="#ffffff"
            />
            <circle cx="8" cy="7.8" r="1.1" fill="#5865f2" />
          </svg>
        );

      case 'moderator':
        // Certified Guardian Shield (Emerald)
        return (
          <svg
            viewBox="0 0 16 16"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
            style={{ imageRendering: 'crisp-edges' }}
          >
            <defs>
              <linearGradient id="capy-mod-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#48e58a" />
                <stop offset="60%" stopColor="#2ecc71" />
                <stop offset="100%" stopColor="#1e8449" />
              </linearGradient>
            </defs>
            <path
              d="M8 1.5L13.5 3.8V8.5C13.5 11.8 11 14 8 14.8C5 14 2.5 11.8 2.5 8.5V3.8L8 1.5Z"
              fill="url(#capy-mod-grad)"
              stroke="#145a32"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
            <path
              d="M8 1.8V14.4C10.7 13.6 13.1 11.6 13.1 8.5V4.1L8 1.8Z"
              fill="#000000"
              fillOpacity="0.12"
            />
            <path
              d="M6.8 11.2L4.2 8.6L5.3 7.5L6.8 9L10.7 5.1L11.8 6.2L6.8 11.2Z"
              fill="#ffffff"
            />
          </svg>
        );

      case 'supporter':
        // Faceted Brilliant Diamond Gem (Neon Magenta)
        return (
          <svg
            viewBox="0 0 16 16"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
            style={{ imageRendering: 'crisp-edges' }}
          >
            <defs>
              <linearGradient id="capy-sup-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff8adc" />
                <stop offset="50%" stopColor="#eb459e" />
                <stop offset="100%" stopColor="#a31d68" />
              </linearGradient>
            </defs>
            <path
              d="M5 2.5H11L14.2 6.5L8 14.2L1.8 6.5L5 2.5Z"
              fill="url(#capy-sup-grad)"
              stroke="#6f0e44"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
            <path d="M5 2.5H11L9.2 6.5H6.8L5 2.5Z" fill="#ffb3ea" fillOpacity="0.8" />
            <path d="M5 2.5L1.8 6.5H6.8L5 2.5Z" fill="#eb459e" />
            <path d="M11 2.5L14.2 6.5H9.2L11 2.5Z" fill="#c41a77" />
            <path d="M6.8 6.5H9.2L8 14.2L6.8 6.5Z" fill="#ffffff" fillOpacity="0.45" />
            <circle cx="8" cy="6.5" r="1.1" fill="#ffffff" />
          </svg>
        );

      case 'community':
        // Stylized Capy Community Crest (Electric Cyan & Headset Silhouette)
        return (
          <svg
            viewBox="0 0 16 16"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
            style={{ imageRendering: 'crisp-edges' }}
          >
            <defs>
              <linearGradient id="capy-comm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="60%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>
            <path
              d="M8 1.5L13.8 4.2V9.2C13.8 12.2 11.2 14.2 8 15C4.8 14.2 2.2 12.2 2.2 9.2V4.2L8 1.5Z"
              fill="url(#capy-comm-grad)"
              stroke="#0c4a6e"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
            <path
              d="M8 1.8V14.6C10.8 13.8 13.4 12 13.4 9.2V4.4L8 1.8Z"
              fill="#000000"
              fillOpacity="0.12"
            />
            {/* Headset Arc */}
            <path
              d="M5.5 6C5.5 4.6 6.6 3.6 8 3.6C9.4 3.6 10.5 4.6 10.5 6"
              stroke="#ffffff"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
            {/* Earcups */}
            <rect x="4.8" y="5.6" width="1.2" height="2.2" rx="0.5" fill="#ffffff" />
            <rect x="10" y="5.6" width="1.2" height="2.2" rx="0.5" fill="#ffffff" />
            {/* Stylized Capy Silhouette */}
            <path
              d="M6.5 6.6H9.5C10.2 6.6 10.7 7.2 10.5 7.9L10 9.8C9.8 10.4 9.2 10.8 8.5 10.8H7.5C6.8 10.8 6.2 10.4 6 9.8L5.5 7.9C5.3 7.2 5.8 6.6 6.5 6.6Z"
              fill="#ffffff"
            />
            <circle cx="8" cy="9" r="0.6" fill="#0369a1" />
          </svg>
        );

      case 'events':
        // Tournament Trophy Cup (Amber / Gold)
        return (
          <svg
            viewBox="0 0 16 16"
            width={size}
            height={size}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
            style={{ imageRendering: 'crisp-edges' }}
          >
            <defs>
              <linearGradient id="capy-ev-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fcd34d" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            <path
              d="M4.5 2.5H11.5V6.8C11.5 8.8 9.9 10.2 8 10.2C6.1 10.2 4.5 8.8 4.5 6.8V2.5Z"
              fill="url(#capy-ev-grad)"
              stroke="#78350f"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
            <path
              d="M4.5 3.8H3C2.4 3.8 2 4.3 2 5C2 6.2 3 7.2 4.5 7.2M11.5 3.8H13C13.6 3.8 14 4.3 14 5C14 6.2 13 7.2 11.5 7.2"
              stroke="#d97706"
              strokeWidth="0.85"
              strokeLinecap="round"
            />
            <path
              d="M7.4 10.2H8.6V12.2H6V13.8H10V12.2H8.6V10.2"
              fill="#b45309"
              stroke="#78350f"
              strokeWidth="0.75"
            />
            <path
              d="M8 4.2L8.6 5.5L10 5.6L8.9 6.6L9.2 8L8 7.3L6.8 8L7.1 6.6L6 5.6L7.4 5.5L8 4.2Z"
              fill="#ffffff"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex items-center justify-center select-none cursor-pointer group leading-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={0}
      role="img"
      aria-label={`${badge.name}: ${badge.description}`}
      title={badge.name}
    >
      <div
        className={`flex items-center justify-center transition-transform duration-150 ${
          isLocked
            ? 'grayscale opacity-35 contrast-75'
            : 'hover:scale-110 active:scale-95'
        }`}
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

      {/* Explanatory Badge Card / Tooltip */}
      {showTooltip && isHovered && (
        <div
          className={`absolute ${
            computedPlacement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
          } ${
            alignMode === 'right'
              ? 'right-0'
              : alignMode === 'left'
              ? 'left-0'
              : 'left-1/2 -translate-x-1/2'
          } z-[99999] pointer-events-none animate-in fade-in zoom-in-95 duration-100 min-w-[160px] max-w-[240px]`}
        >
          {computedPlacement === 'bottom' && (
            <div
              className={`w-2 h-2 bg-[#111214] border-l border-t border-[#2b2d31] rotate-45 mb-[-4px] z-10 relative ${
                alignMode === 'right' ? 'mr-3 ml-auto' : alignMode === 'left' ? 'ml-3' : 'mx-auto'
              }`}
            />
          )}

          <div className="bg-[#111214] text-white px-2.5 py-2 rounded-[5px] shadow-2xl border border-[#2b2d31] text-left break-words [overflow-wrap:anywhere]">
            <div className="flex items-center gap-1.5 mb-1 min-w-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: badge.color }}
              />
              <span className="font-semibold text-xs text-white leading-tight truncate">
                {badge.name}
              </span>
              {isLocked && (
                <span className="text-[10px] text-[#f23f43] font-semibold ml-auto flex-shrink-0 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Bloqueada
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#dbdee1] leading-snug">
              {badge.description}
            </p>
          </div>

          {computedPlacement === 'top' && (
            <div
              className={`w-2 h-2 bg-[#111214] border-r border-b border-[#2b2d31] rotate-45 mt-[-4px] z-10 relative ${
                alignMode === 'right' ? 'mr-3 ml-auto' : alignMode === 'left' ? 'ml-3' : 'mx-auto'
              }`}
            />
          )}
        </div>
      )}
    </div>
  );
};
