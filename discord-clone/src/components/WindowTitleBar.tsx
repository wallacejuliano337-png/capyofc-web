import React from 'react';
import { Minus, Square, X, Sparkles, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDiscord } from '../store/discordStore';
import { useAutoUpdate } from '../services/autoUpdateService';
import type { UpdateInfoPayload } from '../types';
import { getAssetUrl } from '../utils/assets';

export interface WindowTitleBarProps {
  title?: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  updateStatus?: UpdateInfoPayload | null;
  onOpenUpdateModal?: () => void;
}

export function WindowTitleBar({
  title,
  updateStatus: propUpdateStatus,
  onOpenUpdateModal: propOnOpenUpdateModal,
}: WindowTitleBarProps) {
  const { activeServerId, servers, folders, isAuthenticated } = useDiscord();
  const autoUpdate = useAutoUpdate();
  const updateStatus: UpdateInfoPayload | null = propUpdateStatus ?? (autoUpdate.isUpdateAvailable ? {
    state: autoUpdate.isUpdating ? 'downloading' : (autoUpdate.updateProgress === 100 ? 'downloaded' : 'available'),
    currentVersion: autoUpdate.currentVersion,
    availableVersion: autoUpdate.availableVersion || undefined,
    progressPercent: autoUpdate.updateProgress,
  } : null);
  const onOpenUpdateModal = propOnOpenUpdateModal || autoUpdate.openUpdateModal;
  const isHome = activeServerId === '@me';
  const currentServer =
    servers.find((s) => s.id === activeServerId) ||
    (folders || []).flatMap((f) => f.servers).find((s) => s.id === activeServerId) ||
    servers[0];
  const dynamicTitle =
    title || (isHome ? 'Mensagens diretas' : currentServer?.name || 'Capy.ofc');

  return (
    <header
      className={`h-[22px] w-full ${
        isAuthenticated ? 'bg-[#1e1f22] border-b border-[#111214]/60' : 'bg-transparent border-b border-transparent'
      } flex items-center justify-between px-2 select-none z-[9999] flex-shrink-0 relative`}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      aria-label="Barra de título da janela"
    >
      {/* Left Navigation Arrows */}
      <div
        className="flex items-center gap-0.5 h-full z-10"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => window.history?.back?.()}
          className="w-4.5 h-4.5 flex items-center justify-center text-[#949ba4] hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
          title="Voltar"
          aria-label="Voltar"
        >
          <ChevronLeft size={12} />
        </button>
        <button
          type="button"
          onClick={() => window.history?.forward?.()}
          className="w-4.5 h-4.5 flex items-center justify-center text-[#949ba4] hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
          title="Avançar"
          aria-label="Avançar"
        >
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Center: Brand Icon (capy-white.png) + Dynamic Screen Name */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src={getAssetUrl('logos/capy-white.png')}
          alt=""
          className="w-3.5 h-3.5 object-contain mr-1.5"
        />
        <span className="text-[11px] font-semibold text-[#949ba4] tracking-wide truncate max-w-[320px]">
          {dynamicTitle}
        </span>
      </div>

      {/* Right Controls & Update status */}
      <div
        className="flex items-center h-full ml-auto z-10"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {updateStatus?.state === 'downloading' && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 mr-2 rounded text-[10px] font-semibold bg-[#5865f2]/20 text-[#5865f2] border border-[#5865f2]/40"
            title={`Baixando atualização (${updateStatus.progressPercent ?? 0}%)...`}
          >
            <ArrowDown size={11} className="animate-bounce" />
            <span>{updateStatus.progressPercent ?? 0}%</span>
          </div>
        )}

        {updateStatus?.state === 'downloaded' && (
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-0.5 mr-2 rounded text-[10px] font-semibold bg-gradient-to-r from-[#5865f2] to-[#7289da] text-white hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
            onClick={onOpenUpdateModal}
            title={`Atualização v${updateStatus.availableVersion || ''} pronta. Clique para reiniciar.`}
          >
            <Sparkles size={11} />
            <span>Atualizar</span>
          </button>
        )}

        {/* Window Controls (Minimize, Maximize, Close) */}
        <div className="flex items-center h-full">
          <button
            type="button"
            className="h-[22px] w-7 flex items-center justify-center text-[#949ba4] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            onClick={() => void window.arena?.window('minimize')}
            title="Minimizar"
            aria-label="Minimizar"
          >
            <Minus size={11} />
          </button>
          <button
            type="button"
            className="h-[22px] w-7 flex items-center justify-center text-[#949ba4] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            onClick={() => void window.arena?.window('maximize')}
            title="Maximizar ou restaurar"
            aria-label="Maximizar ou restaurar"
          >
            <Square size={9} />
          </button>
          <button
            type="button"
            className="h-[22px] w-7 flex items-center justify-center text-[#949ba4] hover:text-white hover:bg-[#ed4245] transition-colors cursor-pointer"
            onClick={() => void window.arena?.window('close')}
            title="Fechar"
            aria-label="Fechar janela"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </header>
  );
}
