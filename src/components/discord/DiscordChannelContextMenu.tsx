import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import {
  CheckCheck,
  UserPlus,
  Link,
  Copy,
  BellOff,
  Bell,
  ChevronUp,
  ChevronDown,
  Settings,
  CopyPlus,
  PlusCircle,
  Trash2,
  Hash,
  Volume2,
  Megaphone,
  MessagesSquare,
  Lock,
} from 'lucide-react';
import { Channel } from '../../types/discord';

interface Props {
  channel: Channel;
  categoryId: string;
  position: { x: number; y: number };
  canManageChannels?: boolean;
  canCreateInvites?: boolean;
  onClose: () => void;
  onMarkAsRead: () => void;
  onInvite: () => void;
  onCopyLink: () => void;
  onCopyId: () => void;
  onToggleMute: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCreateChannel: () => void;
  onDelete: () => void;
}

export const DiscordChannelContextMenu: React.FC<Props> = ({
  channel,
  position,
  canManageChannels = false,
  canCreateInvites = false,
  onClose,
  onMarkAsRead,
  onInvite,
  onCopyLink,
  onCopyId,
  onToggleMute,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDuplicate,
  onCreateChannel,
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
    highlight = false,
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    danger?: boolean;
    highlight?: boolean;
  }) => (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors cursor-pointer group text-left ${
        danger
          ? 'text-[#f23f43] hover:bg-[#f23f43] hover:text-white'
          : highlight
          ? 'text-[#5865f2] hover:bg-[#5865f2] hover:text-white'
          : 'text-[#dbdee1] hover:bg-[#5865f2] hover:text-white'
      }`}
    >
      <span className="truncate">{label}</span>
      <Icon
        className={`w-4 h-4 flex-shrink-0 ml-2 ${
          danger
            ? 'text-[#f23f43] group-hover:text-white'
            : highlight
            ? 'text-[#5865f2] group-hover:text-white'
            : 'text-[#949ba4] group-hover:text-white'
        }`}
      />
    </button>
  );

  const ChannelIcon = () => {
    if (channel.type === 'voice') return <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />;
    if (channel.type === 'announcement') return <Megaphone className="w-3.5 h-3.5 flex-shrink-0" />;
    if (channel.type === 'forum') return <MessagesSquare className="w-3.5 h-3.5 flex-shrink-0" />;
    return <Hash className="w-3.5 h-3.5 flex-shrink-0" />;
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#111214] border border-[#222327] rounded-lg p-1.5 shadow-2xl z-[9999] min-w-[220px] max-w-[260px] animate-in fade-in zoom-in-95 duration-75 select-none"
      style={{ top: coords.y, left: coords.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Channel Header */}
      <div className="px-2.5 py-1.5 mb-1 flex items-center justify-between text-[#949ba4] text-xs font-semibold uppercase tracking-wide truncate">
        <div className="flex items-center gap-1.5 truncate">
          <ChannelIcon />
          <span className="truncate">{channel.name}</span>
        </div>
        {channel.isPrivate && <Lock className="w-3 h-3 text-[#949ba4] flex-shrink-0 ml-1" />}
      </div>

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* 1. Marcar como lida */}
      <Item
        icon={CheckCheck}
        label="Marcar como lida"
        onClick={onMarkAsRead}
      />

      {/* 2. Silenciar canal */}
      <Item
        icon={channel.isMuted ? Bell : BellOff}
        label={channel.isMuted ? 'Desilenciar canal' : 'Silenciar canal'}
        onClick={onToggleMute}
      />

      {/* 3. Convidar para o canal */}
      {canCreateInvites && (
        <>
          <div className="h-[1px] bg-[#222327] my-1" />
          <Item
            icon={UserPlus}
            label={channel.type === 'voice' ? 'Convidar para a voz' : 'Convidar para o canal'}
            onClick={onInvite}
            highlight
          />
        </>
      )}

      {/* 4. Copiar link do canal */}
      <Item
        icon={Link}
        label="Copiar link do canal"
        onClick={onCopyLink}
      />

      {/* 5. Copiar ID */}
      <Item
        icon={Copy}
        label="Copiar ID do canal"
        onClick={onCopyId}
      />

      {/* Ações administrativas do canal */}
      {canManageChannels && (
        <>
          <div className="h-[1px] bg-[#222327] my-1" />

          {/* 6. Criar canal */}
          <Item
            icon={PlusCircle}
            label="Criar canal"
            onClick={onCreateChannel}
          />

          {/* 7. Duplicar canal */}
          <Item
            icon={CopyPlus}
            label="Duplicar canal"
            onClick={onDuplicate}
          />

          {/* 8. Reordenar canal */}
          {onMoveUp && (
            <Item
              icon={ChevronUp}
              label="Mover para cima"
              onClick={onMoveUp}
            />
          )}
          {onMoveDown && (
            <Item
              icon={ChevronDown}
              label="Mover para baixo"
              onClick={onMoveDown}
            />
          )}

          <div className="h-[1px] bg-[#222327] my-1" />

          {/* 9. Editar canal */}
          <Item
            icon={Settings}
            label="Editar canal"
            onClick={onEdit}
          />

          <div className="h-[1px] bg-[#222327] my-1" />

          {/* 10. Excluir canal */}
          <Item
            icon={Trash2}
            label="Excluir canal"
            onClick={onDelete}
            danger
          />
        </>
      )}
    </div>
  );
};
