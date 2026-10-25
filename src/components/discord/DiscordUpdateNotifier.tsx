import React from 'react';
import { useAutoUpdate } from '../../services/autoUpdateService';
import { Download, Sparkles, RefreshCw, X, ShieldCheck } from 'lucide-react';

export const DiscordUpdateNotifier: React.FC = () => {
  const {
    isUpdateAvailable,
    isUpdating,
    updateProgress,
    availableVersion,
    currentVersion,
    releaseNotes,
    isModalOpen,
    applyUpdate,
    openUpdateModal,
    closeUpdateModal,
  } = useAutoUpdate();

  if (!isUpdateAvailable) return null;

  return (
    <>
      {/* ── 1. PÍLULA DISCRETA NO TOPO (ESTILO DISCORD) ───────────────── */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9990] flex items-center justify-center pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-300">
        <button
          onClick={openUpdateModal}
          className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#23a55a] via-[#1f934f] to-[#23a55a] hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-[0_4px_20px_rgba(35,165,90,0.5)] border border-emerald-300/30 transition-all cursor-pointer select-none"
        >
          <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
          <span>Nova atualização disponível. Reiniciar para atualizar</span>
          <span className="bg-black/20 px-2 py-0.5 rounded-full text-[10px] font-mono">
            v{availableVersion || 'nova'}
          </span>
        </button>
      </div>

      {/* ── 2. MODAL DE ATUALIZAÇÃO INTELIGENTE ──────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#18191c] border border-[#2e3150] rounded-2xl shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Ambient Top Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-gradient-to-b from-[#23a55a]/25 to-transparent blur-2xl pointer-events-none" />

            {/* Close Button */}
            {!isUpdating && (
              <button
                onClick={closeUpdateModal}
                className="absolute top-4 right-4 p-1 rounded-lg text-[#949ba4] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Modal Header */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#23a55a] to-[#5865f2] p-0.5 shadow-lg flex items-center justify-center">
                <div className="w-full h-full bg-[#111214] rounded-[14px] flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#23a55a]" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  Atualização do CapyChat
                </h3>
                <p className="text-xs text-[#949ba4]">
                  v{currentVersion} → <span className="text-[#23a55a] font-bold">v{availableVersion}</span>
                </p>
              </div>
            </div>

            {/* Release Notes */}
            <div className="bg-[#111214]/90 border border-[#26282d] rounded-xl p-3.5 mb-5 text-xs text-[#dbdee1] leading-relaxed">
              <span className="font-bold text-white block mb-1">O que há de novo:</span>
              <p>{releaseNotes || 'Melhorias de desempenho, estabilidade e atualização visual de componentes.'}</p>
            </div>

            {/* Updating Progress Indicator */}
            {isUpdating ? (
              <div className="space-y-3 pt-1 pb-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#dbdee1]">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#23a55a]" />
                    <span>Instalando nova versão...</span>
                  </span>
                  <span className="text-[#23a55a] font-mono">{updateProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#232428] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#23a55a] to-[#5865f2] transition-all duration-300 rounded-full"
                    style={{ width: `${updateProgress}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#80848e] pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#23a55a]" />
                  <span>Todos os seus dados e sessões estão 100% preservados.</span>
                </div>
              </div>
            ) : (
              /* Modal Actions */
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeUpdateModal}
                  className="px-4 py-2.5 text-xs font-semibold text-[#949ba4] hover:text-white transition-colors cursor-pointer"
                >
                  Lembrar mais tarde
                </button>
                <button
                  type="button"
                  onClick={applyUpdate}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#23a55a] to-[#1f934f] hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-lg shadow-[#23a55a]/30 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reiniciar e Atualizar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
