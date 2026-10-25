import React, { useState, useEffect } from 'react';
import { X, Lock, Trash2 } from 'lucide-react';
import { ChannelCategory } from '../../types/discord';
import { useDiscord } from '../../store/discordStore';

interface Props {
  isOpen: boolean;
  category: ChannelCategory | null;
  serverId: string;
  onClose: () => void;
  onDeleteRequest: () => void;
}

export const DiscordEditCategoryModal: React.FC<Props> = ({
  isOpen,
  category,
  serverId,
  onClose,
  onDeleteRequest,
}) => {
  const { editCategory } = useDiscord();
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setIsPrivate(!!category.isPrivate);
    }
  }, [category, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !category) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    editCategory(serverId, category.id, {
      name: name.trim().toUpperCase(),
      isPrivate,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] bg-[#313338] rounded-lg shadow-2xl border border-[#202225] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#202225] flex items-center justify-between bg-[#2b2d31]">
          <h3 className="text-base font-bold text-white">Editar categoria</h3>
          <button
            onClick={onClose}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="NOME DA CATEGORIA"
              className="w-full bg-[#1e1f22] border border-[#1f2023] focus:border-[#5865f2] rounded-[4px] px-3 py-2 text-white text-xs font-semibold uppercase placeholder-[#80848e] outline-none"
            />
          </div>

          {/* Toggle: Categoria Privada */}
          <div className="flex items-center justify-between p-3 bg-[#2b2d31] rounded-[4px] border border-[#1f2023]">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#949ba4] flex-shrink-0" />
              <div>
                <span className="text-white text-sm font-semibold block leading-tight">
                  Categoria Privada
                </span>
                <span className="text-[#949ba4] text-[11px] leading-tight block mt-0.5">
                  Apenas membros e cargos selecionados podem ver esta categoria.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                isPrivate ? 'bg-[#5865f2]' : 'bg-[#4e5058]'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  isPrivate ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Opção de Excluir */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onDeleteRequest();
              }}
              className="flex items-center gap-2 text-xs font-semibold text-[#f23f43] hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Categoria</span>
            </button>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#202225] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-white hover:underline cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2 bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-[4px] transition-colors cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
