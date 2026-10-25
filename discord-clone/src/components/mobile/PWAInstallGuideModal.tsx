import React from 'react';
import { X, Share, PlusSquare, Smartphone, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#1e1f22] border border-[#2b2d31] rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl flex flex-col text-white pb-safe animate-in slide-in-from-bottom duration-250"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2b2d31]">
          <div className="flex items-center gap-3">
            <img
              src="/logos/capy-white.png"
              alt="CapyChat"
              className="w-7 h-7 object-contain rounded-lg p-0.5 bg-[#5865f2]"
            />
            <div>
              <h2 id="pwa-install-title" className="text-base font-bold leading-tight">
                Instalar CapyChat no iPhone
              </h2>
              <p className="text-xs text-[#949ba4]">Adicione à Tela de Início como um App</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#949ba4] hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="py-4 space-y-4">
          {/* Passo 1 */}
          <div className="flex items-start gap-3.5 bg-[#2b2d31]/50 p-3 rounded-xl border border-white/5">
            <div className="w-7 h-7 rounded-full bg-[#5865f2] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
              1
            </div>
            <div className="flex-1 text-sm">
              <span className="font-semibold text-white">Abra no Safari:</span>
              <p className="text-xs text-[#b5bac1] mt-0.5 leading-relaxed">
                Acesse o CapyChat usando o navegador Safari do seu iPhone.
              </p>
            </div>
          </div>

          {/* Passo 2 */}
          <div className="flex items-start gap-3.5 bg-[#2b2d31]/50 p-3 rounded-xl border border-white/5">
            <div className="w-7 h-7 rounded-full bg-[#5865f2] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
              2
            </div>
            <div className="flex-1 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <span>Toque em Compartilhar</span>
                <Share className="w-4 h-4 text-[#5865f2]" />
              </div>
              <p className="text-xs text-[#b5bac1] mt-0.5 leading-relaxed">
                Localize o ícone do quadrado com a seta para cima na barra inferior do Safari.
              </p>
            </div>
          </div>

          {/* Passo 3 */}
          <div className="flex items-start gap-3.5 bg-[#2b2d31]/50 p-3 rounded-xl border border-white/5">
            <div className="w-7 h-7 rounded-full bg-[#5865f2] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
              3
            </div>
            <div className="flex-1 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <span>Adicionar à Tela de Início</span>
                <PlusSquare className="w-4 h-4 text-[#23a55a]" />
              </div>
              <p className="text-xs text-[#b5bac1] mt-0.5 leading-relaxed">
                Role o menu do Safari e selecione a opção “Adicionar à Tela de Início”.
              </p>
            </div>
          </div>

          {/* Passo 4 */}
          <div className="flex items-start gap-3.5 bg-[#2b2d31]/50 p-3 rounded-xl border border-white/5">
            <div className="w-7 h-7 rounded-full bg-[#5865f2] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
              4
            </div>
            <div className="flex-1 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <span>Confirmar em “Adicionar”</span>
                <Check className="w-4 h-4 text-[#23a55a]" />
              </div>
              <p className="text-xs text-[#b5bac1] mt-0.5 leading-relaxed">
                Toque em “Adicionar” no canto superior direito. O CapyChat aparecerá na tela do seu iPhone!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#5865f2] hover:bg-[#4752c4] active:scale-[0.99] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-[#5865f2]/25"
          >
            Entendi, vou instalar
          </button>
        </div>
      </div>
    </div>
  );
};
