import React from 'react';
import { useAutoUpdate } from '../../services/autoUpdateService';
import { Download, Sparkles, RefreshCw, X, ShieldCheck, AlertCircle } from 'lucide-react';

export const DiscordUpdateNotifier: React.FC = () => {
  const {
    isUpdateAvailable,
    isDownloading,
    isDownloaded,
    isUpdating,
    updateProgress,
    availableVersion,
    currentVersion,
    releaseNotes,
    updateError,
    isModalOpen,
    downloadUpdate,
    applyUpdate,
    openUpdateModal,
    closeUpdateModal,
  } = useAutoUpdate();

  if (!isUpdateAvailable && !updateError) return null;

  return (
    <>
      {/* ── 1. PÍLULA FLUTUANTE DISCRETA NO TOPO (ESTILO DISCORD) ───────────────── */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9990] flex items-center justify-center pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-300">
        {isDownloaded ? (
          <button
            onClick={openUpdateModal}
            className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#23a55a] via-[#1f934f] to-[#23a55a] hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-[0_4px_20px_rgba(35,165,90,0.5)] border border-emerald-300/30 transition-all cursor-pointer select-none"
          >
            <RefreshCw className="w-4 h-4 transition-transform group-hover:rotate-180 duration-500" />
            <span>Atualização pronta. Clique para reiniciar e atualizar</span>
            <span className="bg-black/25 px-2 py-0.5 rounded-full text-[10px] font-mono">
              v{availableVersion || 'nova'}
            </span>
          </button>
        ) : isDownloading ? (
          <button
            onClick={openUpdateModal}
            className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#5865f2] via-[#4752c4] to-[#5865f2] hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-[0_4px_20px_rgba(88,101,242,0.4)] border border-indigo-300/30 transition-all cursor-pointer select-none"
          >
            <RefreshCw className="w-4 h-4 animate-spin text-white" />
            <span>Baixando atualização... {updateProgress}%</span>
            <div className="w-12 h-1.5 rounded-full bg-black/30 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300 rounded-full"
                style={{ width: `${updateProgress}%` }}
              />
            </div>
          </button>
        ) : isUpdateAvailable ? (
          <button
            onClick={openUpdateModal}
            className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#18191c]/95 hover:bg-[#232428] active:scale-95 text-[#dbdee1] hover:text-white text-xs font-bold shadow-xl border border-[#3f4147] transition-all cursor-pointer select-none backdrop-blur-md"
          >
            <Download className="w-4 h-4 text-[#5865f2] transition-transform group-hover:-translate-y-0.5" />
            <span>Nova versão disponível: v{availableVersion || 'nova'}</span>
            <span className="bg-[#5865f2] text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
              Ver detalhes
            </span>
          </button>
        ) : null}
      </div>

      {/* ── 2. MODAL DE ATUALIZAÇÃO INTELIGENTE ──────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#18191c] border border-[#2e3150] rounded-2xl shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Ambient Top Glow */}
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 blur-2xl pointer-events-none ${
                isDownloaded
                  ? 'bg-gradient-to-b from-[#23a55a]/25 to-transparent'
                  : 'bg-gradient-to-b from-[#5865f2]/25 to-transparent'
              }`}
            />

            {/* Close Button */}
            {!isUpdating && (
              <button
                onClick={closeUpdateModal}
                className="absolute top-4 right-4 p-1 rounded-lg text-[#949ba4] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Modal Header */}
            <div className="flex items-center gap-3.5 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl p-0.5 shadow-lg flex items-center justify-center ${
                  isDownloaded
                    ? 'bg-gradient-to-tr from-[#23a55a] to-[#5865f2]'
                    : 'bg-gradient-to-tr from-[#5865f2] to-[#8b5cf6]'
                }`}
              >
                <div className="w-full h-full bg-[#111214] rounded-[14px] flex items-center justify-center">
                  <Sparkles
                    className={`w-6 h-6 ${
                      isDownloaded ? 'text-[#23a55a]' : 'text-[#5865f2]'
                    }`}
                  />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  Atualização do Capy.ofc
                </h3>
                <p className="text-xs text-[#949ba4]">
                  v{currentVersion} →{' '}
                  <span
                    className={`font-bold ${
                      isDownloaded ? 'text-[#23a55a]' : 'text-[#5865f2]'
                    }`}
                  >
                    v{availableVersion}
                  </span>
                </p>
              </div>
            </div>

            {/* Error Banner if any */}
            {updateError && (
              <div className="mb-4 bg-[#ef4444]/15 border border-[#ef4444]/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#ef4444]">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Falha no processo:</span>
                  <span>{updateError}</span>
                </div>
              </div>
            )}

            {/* Release Notes */}
            <div className="bg-[#111214]/90 border border-[#26282d] rounded-xl p-3.5 mb-5 text-xs text-[#dbdee1] leading-relaxed">
              <span className="font-bold text-white block mb-1">O que há de novo:</span>
              <p>{releaseNotes || 'Melhorias de desempenho, estabilidade de conexões e sincronização em tempo real.'}</p>
            </div>

            {/* Content & Actions per State */}
            {isDownloading ? (
              /* ESTADO: BAIXANDO EM SEGUNDO PLANO */
              <div className="space-y-3 pt-1 pb-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#dbdee1]">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#5865f2]" />
                    <span>Baixando arquivos da versão {availableVersion}...</span>
                  </span>
                  <span className="text-[#5865f2] font-mono">{updateProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#232428] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#5865f2] to-[#23a55a] transition-all duration-300 rounded-full"
                    style={{ width: `${updateProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#80848e] pt-1">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#23a55a]" />
                    <span>Todos os seus dados estão preservados.</span>
                  </span>
                  <button
                    type="button"
                    onClick={closeUpdateModal}
                    className="hover:underline text-[#dbdee1] cursor-pointer"
                  >
                    Ocultar e continuar usando
                  </button>
                </div>
              </div>
            ) : isDownloaded ? (
              /* ESTADO: PRONTO PARA INSTALAR */
              <div className="space-y-4 pt-1">
                <div className="bg-[#23a55a]/10 border border-[#23a55a]/30 rounded-xl p-3 text-xs text-[#23a55a] flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <span>
                    A atualização foi baixada e verificada com sucesso. Ao reiniciar, a nova versão será instalada automaticamente sem perda de dados.
                  </span>
                </div>
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeUpdateModal}
                    className="px-4 py-2 text-xs font-semibold text-[#949ba4] hover:text-white transition-colors cursor-pointer"
                  >
                    Lembrar mais tarde
                  </button>
                  <button
                    type="button"
                    onClick={applyUpdate}
                    disabled={isUpdating}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#23a55a] to-[#1f934f] hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-lg shadow-[#23a55a]/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                    <span>{isUpdating ? 'Reiniciando...' : 'Reiniciar e Atualizar'}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ESTADO: DISPONÍVEL (USUÁRIO ESCOLHE BAIXAR AGORA OU DEPOIS) */
              <div className="space-y-3 pt-1">
                <p className="text-xs text-[#949ba4]">
                  Você pode baixar a atualização agora ou deixar para depois. O aplicativo continuará funcionando normalmente durante o download.
                </p>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeUpdateModal}
                    className="px-4 py-2 text-xs font-semibold text-[#949ba4] hover:text-white transition-colors cursor-pointer"
                  >
                    Lembrar mais tarde
                  </button>
                  <button
                    type="button"
                    onClick={downloadUpdate}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5865f2] to-[#4752c4] hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-lg shadow-[#5865f2]/30 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Atualização</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
