import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DiscordDeleteConfirmModal: React.FC<Props> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Excluir',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-[#313338] rounded-[4px] shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-white text-xl font-bold mb-2">{title}</h2>
          <p className="text-[#dbdee1] text-sm leading-relaxed">{description}</p>
        </div>

        {/* Warning */}
        <div className="px-6 pb-4">
          <div className="flex items-start gap-3 bg-[#f23f43]/10 border border-[#f23f43]/30 rounded p-3">
            <AlertTriangle className="w-5 h-5 text-[#f23f43] flex-shrink-0 mt-0.5" />
            <p className="text-[#f23f43] text-sm">Esta ação é permanente e não pode ser desfeita.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#2b2d31] flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-white hover:underline transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm();
            }}
            className="px-4 py-2 bg-[#f23f43] hover:bg-[#d32f2f] text-white text-sm font-medium rounded-[3px] transition-colors cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
