import React, { useState, useEffect } from 'react';
import { useDiscord } from '../../store/discordStore';
import { X, Lock } from 'lucide-react';

export const DiscordCreateCategoryModal: React.FC = () => {
  const {
    isCreateCategoryOpen,
    closeCreateCategory,
    servers,
    activeServerId,
    addCategory,
  } = useDiscord();

  const [categoryName, setCategoryName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];

  useEffect(() => {
    if (isCreateCategoryOpen) {
      setCategoryName('');
      setIsPrivate(false);
    }
  }, [isCreateCategoryOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCreateCategoryOpen) {
        closeCreateCategory();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateCategoryOpen, closeCreateCategory]);

  if (!isCreateCategoryOpen || !currentServer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    addCategory(currentServer.id, {
      name: categoryName.trim(),
      isPrivate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#313338] w-full max-w-[460px] rounded-lg shadow-2xl border border-[#1f2023] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#202225] flex items-center justify-between bg-[#2b2d31]">
          <h3 className="text-base font-bold text-white">Criar categoria</h3>
          <button
            onClick={closeCreateCategory}
            className="text-[#b5bac1] hover:text-white p-1 rounded hover:bg-[#35373c] transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nome da Categoria */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
              Nome da Categoria
            </label>
            <input
              autoFocus
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value.toUpperCase())}
              placeholder="NOVOS CANAIS"
              className="w-full bg-[#1e1f22] border border-[#1f2023] focus:border-[#5865f2] rounded-[4px] px-3 py-2 text-white text-xs font-semibold uppercase placeholder-[#80848e] outline-none"
            />
          </div>

          {/* Toggle: Categoria Privada */}
          <div className="pt-2">
            <div className="flex items-center justify-between p-3 bg-[#2b2d31] rounded-lg border border-[#1f2023]">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-[#949ba4]" />
                <div>
                  <span className="text-xs font-bold text-white block">Categoria Privada</span>
                  <span className="text-[11px] text-[#949ba4]">
                    Ao tornar uma categoria privada, apenas os membros selecionados poderão visualizar seus canais
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`w-10 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer flex-shrink-0 ml-3 ${
                  isPrivate ? 'bg-[#23a55a]' : 'bg-[#4e5058]'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white block transition-transform ${
                    isPrivate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[#202225] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeCreateCategory}
              className="text-xs font-semibold text-[#dbdee1] hover:underline px-3 py-2 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!categoryName.trim()}
              className={`px-6 py-2 rounded-[4px] text-xs font-bold transition-all shadow ${
                categoryName.trim()
                  ? 'bg-[#5865f2] hover:bg-[#4752c4] text-white cursor-pointer shadow-[#5865f2]/20'
                  : 'bg-[#35373c] text-[#80848e] cursor-not-allowed'
              }`}
            >
              Criar categoria
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
