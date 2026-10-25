import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import {
  CheckCheck,
  ChevronDown,
  ChevronRight,
  BellOff,
  Bell,
  PlusCircle,
  Settings,
  Trash2,
  Folder,
  Lock,
} from 'lucide-react';
import { ChannelCategory } from '../../types/discord';

interface Props {
  category: ChannelCategory;
  isCollapsed: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onMarkAsRead: () => void;
  onToggleCollapse: () => void;
  onToggleMute: () => void;
  onCreateChannel: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const DiscordCategoryContextMenu: React.FC<Props> = ({
  category,
  isCollapsed,
  position,
  onClose,
  onMarkAsRead,
  onToggleCollapse,
  onToggleMute,
  onCreateChannel,
  onEdit,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: position.x, y: position.y });

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(position.x, window.innerWidth - rect.width - 12));
    const y = Math.max(8, Math.min(position.y, window.innerHeight - rect.height - 12));
    setCoords({ x, y });
  }, [position]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const Item = ({
    icon: Icon,
    label,
    onClick,
    danger = false,
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors cursor-pointer group text-left ${
        danger
          ? 'text-[#f23f43] hover:bg-[#f23f43] hover:text-white'
          : 'text-[#dbdee1] hover:bg-[#5865f2] hover:text-white'
      }`}
    >
      <span className="truncate">{label}</span>
      <Icon
        className={`w-4 h-4 flex-shrink-0 ml-2 ${
          danger
            ? 'text-[#f23f43] group-hover:text-white'
            : 'text-[#949ba4] group-hover:text-white'
        }`}
      />
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#111214] border border-[#222327] rounded-lg p-1.5 shadow-2xl z-[9999] min-w-[210px] max-w-[250px] animate-in fade-in zoom-in-95 duration-75 select-none"
      style={{ top: coords.y, left: coords.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Category Header */}
      <div className="px-2.5 py-1.5 mb-1 flex items-center justify-between text-[#949ba4] text-xs font-semibold uppercase tracking-wide truncate">
        <div className="flex items-center gap-1.5 truncate">
          <Folder className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{category.name}</span>
        </div>
        {category.isPrivate && <Lock className="w-3 h-3 text-[#949ba4] flex-shrink-0 ml-1" />}
      </div>

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* 1. Marcar como lida */}
      <Item
        icon={CheckCheck}
        label="Marcar como lida"
        onClick={onMarkAsRead}
      />

      {/* 2. Recolher / Expandir categoria */}
      <Item
        icon={isCollapsed ? ChevronRight : ChevronDown}
        label={isCollapsed ? 'Expandir categoria' : 'Recolher categoria'}
        onClick={onToggleCollapse}
      />

      {/* 3. Silenciar categoria */}
      <Item
        icon={category.isMuted ? Bell : BellOff}
        label={category.isMuted ? 'Desilenciar categoria' : 'Silenciar categoria'}
        onClick={onToggleMute}
      />

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* 4. Criar canal */}
      <Item
        icon={PlusCircle}
        label="Criar canal"
        onClick={onCreateChannel}
      />

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* 5. Editar categoria */}
      <Item
        icon={Settings}
        label="Editar categoria"
        onClick={onEdit}
      />

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* 6. Excluir categoria */}
      <Item
        icon={Trash2}
        label="Excluir categoria"
        onClick={onDelete}
        danger
      />
    </div>
  );
};
