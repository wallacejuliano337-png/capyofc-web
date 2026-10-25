import React, { useState } from 'react';
import { AlertTriangle, LogOut, ShieldAlert, Loader2 } from 'lucide-react';
import { Server } from '../../types/discord';

interface Props {
  isOpen: boolean;
  server: Server | null;
  isOwner: boolean;
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

export const DiscordLeaveServerModal: React.FC<Props> = ({
  isOpen,
  server,
  isOwner,
  onConfirm,
  onCancel,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !server) return null;

  const handleConfirm = async () => {
    if (isOwner) {
      onCancel();
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await onConfirm();
      if (!res.success) {
        setErrorMessage(res.error || 'Falha ao sair do servidor. Tente novamente.');
      } else {
        onCancel();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro de conexão ao sair do servidor.');
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
            {isOwner ? (
              <div className="w-10 h-10 rounded-full bg-[#f1c40f]/15 flex items-center justify-center text-[#f1c40f] flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#f23f43]/15 flex items-center justify-center text-[#f23f43] flex-shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
            )}
            <h2 className="text-white text-lg font-bold leading-tight">
              {isOwner ? `Não é possível sair de '${server.name}'` : `Sair de '${server.name}'`}
            </h2>
          </div>

          <p className="text-[#dbdee1] text-sm leading-relaxed mt-2">
            {isOwner ? (
              <>
                Você é o <strong>proprietário</strong> do servidor <strong>{server.name}</strong>. Você não pode sair do servidor sem antes transferir a posse para outro membro. Se desejar encerrar a comunidade, acesse as configurações para excluí-la.
              </>
            ) : (
              <>
                Tem certeza de que deseja sair de <strong>{server.name}</strong>? Você precisará de um novo convite para entrar novamente. Suas mensagens e dados da comunidade não serão apagados.
              </>
            )}
          </p>
        </div>

        {/* Warning or Error Box */}
        {errorMessage ? (
          <div className="px-6 pb-4">
            <div className="flex items-start gap-3 bg-[#f23f43]/15 border border-[#f23f43]/40 rounded-md p-3">
              <AlertTriangle className="w-5 h-5 text-[#f23f43] flex-shrink-0 mt-0.5" />
              <p className="text-[#f23f43] text-xs leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        ) : !isOwner ? (
          <div className="px-6 pb-4">
            <div className="flex items-start gap-3 bg-[#f23f43]/10 border border-[#f23f43]/20 rounded-md p-3">
              <AlertTriangle className="w-4 h-4 text-[#f23f43] flex-shrink-0 mt-0.5" />
              <p className="text-[#dbdee1] text-xs">
                A saída removerá este servidor da sua barra lateral e sua presença entre os membros ativos.
              </p>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="px-6 py-4 bg-[#2b2d31] flex items-center justify-end gap-3 border-t border-[#232428]">
          {isOwner ? (
            <button
              onClick={onCancel}
              className="px-5 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-semibold rounded-[4px] transition-colors cursor-pointer"
            >
              Entendido
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white hover:underline transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 bg-[#f23f43] hover:bg-[#d83a3e] active:bg-[#c03438] text-white text-sm font-semibold rounded-[4px] transition-colors cursor-pointer disabled:opacity-50 shadow-md"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmitting ? 'Saindo...' : 'Sair do Servidor'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
