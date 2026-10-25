import React, { useState } from 'react';
import { AlertTriangle, Trash2, ShieldAlert, Loader2 } from 'lucide-react';
import { Server } from '../../types/discord';

interface Props {
  isOpen: boolean;
  server: Server | null;
  isOwner: boolean;
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

export const DiscordDeleteServerModal: React.FC<Props> = ({
  isOpen,
  server,
  isOwner,
  onConfirm,
  onCancel,
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !server) return null;

  const isOfficial = server.id === 'server-lyc' || Boolean(server.isVerified);
  const canDelete = isOwner && !isOfficial && confirmInput.trim() === server.name.trim();

  const handleConfirm = async () => {
    if (!canDelete || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await onConfirm();
      if (!res.success) {
        setErrorMessage(res.error || 'Falha ao excluir o servidor. Tente novamente.');
      } else {
        onCancel();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Erro de conexão ao excluir o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={isSubmitting ? undefined : onCancel}
      />

      <div className="relative bg-[#313338] text-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-[#232428] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#f23f43]/15 flex items-center justify-center text-[#f23f43] flex-shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                Excluir &apos;{server.name}&apos;
              </h2>
              <p className="text-xs text-[#949ba4] mt-0.5">
                Esta ação é irreversível e permanente.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 pb-6 space-y-4 text-sm text-[#dbdee1]">
          {isOfficial ? (
            <div className="flex items-start gap-3 bg-[#f1c40f]/10 border border-[#f1c40f]/30 rounded-md p-3.5 text-xs text-[#f1c40f] leading-relaxed">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#f1c40f]" />
              <div>
                <p className="font-semibold mb-1">Servidor Oficial Protegido</p>
                <p className="text-[#dbdee1]/90">
                  O servidor oficial da comunidade CapyChat é protegido contra exclusão acidental e não pode ser removido.
                </p>
              </div>
            </div>
          ) : !isOwner ? (
            <div className="flex items-start gap-3 bg-[#f23f43]/10 border border-[#f23f43]/30 rounded-md p-3.5 text-xs text-[#f23f43] leading-relaxed">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Permissão Negada</p>
                <p className="text-[#dbdee1]/90">
                  Apenas o proprietário deste servidor tem autorização para excluí-lo permanentemente.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 bg-[#f23f43]/10 border border-[#f23f43]/30 rounded-md p-3 text-xs text-[#f23f43] leading-relaxed">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#f23f43]" />
                <p>
                  Tem certeza de que deseja excluir <strong>{server.name}</strong>? Todos os canais, mensagens, cargos, permissões e dados serão destruídos permanentemente.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                  Digite o nome do servidor para confirmar:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={server.name}
                  disabled={isSubmitting}
                  className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-sm text-white placeholder-[#5c5f66] focus:outline-none focus:border-[#f23f43] transition-colors"
                  autoFocus
                />
              </div>
            </>
          )}

          {errorMessage && (
            <div className="bg-[#f23f43]/10 border border-[#f23f43]/40 rounded p-2.5 text-xs text-[#f23f43]">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#2b2d31] flex items-center justify-end gap-3 border-t border-[#232428]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white hover:underline transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          {!isOfficial && isOwner && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canDelete || isSubmitting}
              className={`px-4 py-2 rounded-[3px] text-sm font-medium flex items-center gap-2 transition-all cursor-pointer ${
                canDelete && !isSubmitting
                  ? 'bg-[#f23f43] hover:bg-[#d83a3e] text-white shadow-md hover:shadow-lg'
                  : 'bg-[#f23f43]/40 text-white/50 cursor-not-allowed'
              }`}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Excluir Servidor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
