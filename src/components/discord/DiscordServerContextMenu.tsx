import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import {
  CheckCheck,
  UserPlus,
  BellOff,
  Bell,
  Check,
  Settings,
  Shield,
  Pencil,
  PlusCircle,
  FolderPlus,
  Calendar,
  ChevronUp,
  ChevronDown,
  Copy,
  LogOut,
  Trash2,
  Crown,
  UserCheck,
  Gem,
  Infinity,
} from 'lucide-react';
import { Server } from '../../types/discord';
import { isOfficialCommunity } from '../../services/communityLevel';

interface Props {
  server: Server;
  position: { x: number; y: number };
  isAdmin: boolean;
  isOwner: boolean;
  canManageChannels?: boolean;
  canManageServer?: boolean;
  hideMutedChannels?: boolean;
  onClose: () => void;
  onOpenServerBoost?: () => void;
  onMarkAsRead: () => void;
  onInvite: () => void;
  onToggleMute: () => void;
  onToggleHideMuted?: () => void;
  onOpenNotificationSettings: () => void;
  onOpenServerSettings: () => void;
  onOpenPrivacySettings: () => void;
  onEditServerProfile: () => void;
  onCreateChannel: () => void;
  onCreateCategory: () => void;
  onCreateEvent: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onCopyId: () => void;
  onLeaveOrDeleteServer: () => void;
}

export const DiscordServerContextMenu: React.FC<Props> = ({
  server,
  position,
  isAdmin,
  isOwner,
  canManageChannels = false,
  canManageServer = false,
  hideMutedChannels = false,
  onClose,
  onOpenServerBoost,
  onMarkAsRead,
  onInvite,
  onToggleMute,
  onToggleHideMuted,
  onOpenNotificationSettings,
  onOpenServerSettings,
  onOpenPrivacySettings,
  onEditServerProfile,
  onCreateChannel,
  onCreateCategory,
  onCreateEvent,
  onMoveUp,
  onMoveDown,
  onCopyId,
  onLeaveOrDeleteServer,
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
    trailing,
  }: {
    icon?: React.ElementType;
    label: string;
    onClick: () => void;
    danger?: boolean;
    highlight?: boolean;
    trailing?: React.ReactNode;
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
      {trailing ? (
        trailing
      ) : Icon ? (
        <Icon
          className={`w-4 h-4 flex-shrink-0 ml-2 ${
            danger
              ? 'text-[#f23f43] group-hover:text-white'
              : highlight
              ? 'text-[#5865f2] group-hover:text-white'
              : 'text-[#949ba4] group-hover:text-white'
          }`}
        />
      ) : null}
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#111214] border border-[#222327] rounded-lg p-1.5 shadow-2xl z-[9999] min-w-[230px] max-w-[260px] animate-in fade-in zoom-in-95 duration-75 select-none"
      style={{ top: coords.y, left: coords.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Server Header info */}
      <div className="px-2.5 py-1.5 mb-1 flex items-center justify-between text-[#949ba4] text-xs font-semibold uppercase tracking-wide truncate">
        <div className="flex items-center gap-2 truncate">
          {server.icon ? (
            <img
              src={server.icon}
              alt={server.name}
              className="w-4 h-4 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-[#5865f2] text-white flex items-center justify-center text-[9px] font-bold">
              {server.initials.slice(0, 2)}
            </div>
          )}
          <span className="truncate">{server.name}</span>
        </div>
        {isOwner ? (
          <span title="Dono do Servidor" className="flex items-center text-[#f1c40f]">
            <Crown className="w-3.5 h-3.5 flex-shrink-0" />
          </span>
        ) : isAdmin ? (
          <span title="Administrador" className="flex items-center text-[#5865f2]">
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
          </span>
        ) : (
          <span title="Membro" className="flex items-center text-[#949ba4]">
            <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
          </span>
        )}
      </div>

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* 0. Impulso de Servidor (Destaque Discord) */}
      {onOpenServerBoost && (
        <>
          <button
            onClick={() => {
              onOpenServerBoost();
              onClose();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] font-semibold text-[#eb459e] hover:bg-[#eb459e] hover:text-white transition-colors cursor-pointer group text-left"
          >
            <span className="truncate">Impulso de Servidor</span>
            {isOfficialCommunity(server) ? (
              <Infinity className="w-4 h-4 flex-shrink-0 ml-2 text-[#eb459e] group-hover:text-white" />
            ) : (
              <Gem className="w-4 h-4 flex-shrink-0 ml-2 text-[#eb459e] group-hover:text-white fill-[#eb459e] group-hover:fill-white" />
            )}
          </button>
          <div className="h-[1px] bg-[#222327] my-1" />
        </>
      )}

      {/* 1. Marcar como lida */}
      <Item
        icon={CheckCheck}
        label="Marcar como lida"
        onClick={onMarkAsRead}
      />

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* 2. Convidar para o servidor */}
      <Item
        icon={UserPlus}
        label="Convidar para o servidor"
        onClick={onInvite}
        highlight
      />

      {/* 3. Silenciar servidor */}
      <Item
        icon={server.isMuted ? Bell : BellOff}
        label={server.isMuted ? 'Desilenciar servidor' : 'Silenciar servidor'}
        onClick={onToggleMute}
      />

      {/* 4. Config. de notificações */}
      <Item
        icon={Bell}
        label="Config. de notificações"
        onClick={onOpenNotificationSettings}
      />

      {/* 5. Ocultar canais silenciados */}
      {onToggleHideMuted && (
        <Item
          label="Ocultar canais silenciados"
          onClick={onToggleHideMuted}
          trailing={
            <div
              className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors ml-2 ${
                hideMutedChannels
                  ? 'bg-[#5865f2] border-[#5865f2] group-hover:bg-white group-hover:border-white'
                  : 'border-[#4e5058] group-hover:border-white'
              }`}
            >
              {hideMutedChannels && (
                <Check className="w-3 h-3 text-white group-hover:text-[#5865f2] stroke-[3]" />
              )}
            </div>
          }
        />
      )}

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* ── SEÇÃO CONDICIONAL POR PERMISSÃO ── */}
      {/* Configurações do servidor (Apenas administradores/gerentes) */}
      {(isAdmin || canManageServer) && (
        <Item
          icon={Settings}
          label="Config. do servidor"
          onClick={onOpenServerSettings}
        />
      )}

      {/* Config. de privacidade */}
      <Item
        icon={Shield}
        label="Config. de privacidade"
        onClick={onOpenPrivacySettings}
      />

      {/* Editar perfil por servidor */}
      <Item
        icon={Pencil}
        label="Editar perfil no servidor"
        onClick={onEditServerProfile}
      />

      {/* Ações de canais (Apenas quem pode gerenciar canais) */}
      {(isAdmin || canManageChannels) && (
        <>
          <div className="h-[1px] bg-[#222327] my-1" />

          {/* Criar canal */}
          <Item
            icon={PlusCircle}
            label="Criar canal"
            onClick={onCreateChannel}
          />

          {/* Criar categoria */}
          <Item
            icon={FolderPlus}
            label="Criar categoria"
            onClick={onCreateCategory}
          />

          {/* Criar evento */}
          <Item
            icon={Calendar}
            label="Criar evento"
            onClick={onCreateEvent}
          />
        </>
      )}

      {/* Mover servidor (apenas admins ou quem organiza rail) */}
      {(onMoveUp || onMoveDown) && (
        <>
          <div className="h-[1px] bg-[#222327] my-1" />
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
        </>
      )}

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* Copiar ID do servidor */}
      <Item
        icon={Copy}
        label="Copiar ID do servidor"
        onClick={onCopyId}
      />

      <div className="h-[1px] bg-[#222327] my-1" />

      {/* Sair ou Excluir servidor */}
      {isOwner ? (
        <Item
          icon={Trash2}
          label="Excluir servidor"
          onClick={onLeaveOrDeleteServer}
          danger
        />
      ) : (
        <Item
          icon={LogOut}
          label="Sair do servidor"
          onClick={onLeaveOrDeleteServer}
          danger
        />
      )}
    </div>
  );
};
