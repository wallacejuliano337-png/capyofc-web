import React from 'react';

interface Props {
  style?: 'blue' | 'gold';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showTooltip?: boolean;
}

export const LycVerifiedBadge: React.FC<Props> = ({
  style = 'blue',
  size = 'sm',
  className = '',
  showTooltip = true,
}) => {
  const isGold = style === 'gold';

  const sizeMap = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const badgeSize = sizeMap[size] || sizeMap.sm;

  const tooltipText = isGold
    ? 'Servidor Verificado Oficialmente — Categoria Ouro / CapyChat Partner'
    : 'Servidor Verificado Oficialmente — CapyChat';

  return (
    <span
      title={showTooltip ? tooltipText : undefined}
      className={`inline-flex items-center justify-center flex-shrink-0 align-middle select-none cursor-help ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${badgeSize} ${
          isGold
            ? 'text-[#f1c40f] drop-shadow-[0_1px_6px_rgba(241,196,15,0.45)]'
            : 'text-[#00a8fc] drop-shadow-[0_1px_6px_rgba(0,168,252,0.45)]'
        } transition-transform hover:scale-110 duration-150`}
      >
        {/* Starburst badge background */}
        <path
          d="M10.29 2.308a2.5 2.5 0 0 1 3.42 0l.974.92c.44.417 1.026.657 1.63.668l1.341.026a2.5 2.5 0 0 1 2.45 2.45l.026 1.341c.011.604.251 1.19.668 1.63l.92.974a2.5 2.5 0 0 1 0 3.42l-.92.974a2.502 2.502 0 0 0-.668 1.63l-.026 1.341a2.5 2.5 0 0 1-2.45 2.45l-1.341.026a2.502 2.502 0 0 0-1.63.668l-.974.92a2.5 2.5 0 0 1-3.42 0l-.974-.92a2.502 2.502 0 0 0-1.63-.668l-1.341-.026a2.5 2.5 0 0 1-2.45-2.45l-.026-1.341a2.502 2.502 0 0 0-.668-1.63l-.92-.974a2.5 2.5 0 0 1 0-3.42l.92-.974c.417-.44.657-1.026.668-1.63l.026-1.341a2.5 2.5 0 0 1 2.45-2.45l1.341-.026c.604-.011 1.19-.251 1.63-.668l.974-.92Z"
          fill="currentColor"
        />
        {/* White checkmark inside */}
        <path
          d="M9.25 12.25l2 2 4-4.5"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
};
