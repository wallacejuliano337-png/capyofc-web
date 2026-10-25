import React, { useState, useEffect } from 'react';
import { useDiscord } from '../../store/discordStore';
import { ChannelType } from '../../types/discord';
import { X, Hash, Volume2, Lock, Search, Check, MessagesSquare } from 'lucide-react';

interface ChannelTypeOption {
  id: ChannelType;
  name: string;
  description: string;
  icon: React.ElementType;
}

const CHANNEL_TYPES: ChannelTypeOption[] = [
  {
    id: 'text',
    name: 'Texto',
    description: 'Postar mensagens, imagens, memes e opiniões',
    icon: Hash,
  },
  {
    id: 'voice',
    name: 'Voz',
    description: 'Conversar por voz, vídeo e compartilhar a tela',
    icon: Volume2,
  },
  {
    id: 'forum',
    name: 'Fórum',
    description: 'Criar tópicos de discussão organizados',
    icon: MessagesSquare,
  },
];

export const DiscordCreateChannelModal: React.FC = () => {
  const {
    isCreateChannelOpen,
    closeCreateChannel,
    targetCategoryIdForNewChannel,
    servers,
    activeServerId,
    addChannel,
    roles,
  } = useDiscord();

  const [channelType, setChannelType] = useState<ChannelType>('text');
  const [channelName, setChannelName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');

  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const targetCategory = currentServer?.categories.find(
    (c) => c.id === targetCategoryIdForNewChannel,
  ) || currentServer?.categories[0];

  useEffect(() => {
    if (isCreateChannelOpen) {
      setChannelType('text');
      setChannelName('');
      setIsPrivate(false);
      setSelectedRoleIds([]);
      setRoleSearchQuery('');
    }
  }, [isCreateChannelOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCreateChannelOpen) {
        closeCreateChannel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateChannelOpen, closeCreateChannel]);

  if (!isCreateChannelOpen || !currentServer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    const categoryId = targetCategory?.id || currentServer.categories[0]?.id;
    addChannel(currentServer.id, categoryId, {
      name: channelName.trim(),
      type: channelType,
      isPrivate,
    });
  };

  const filteredRoles = roles
    .filter((r) => r.id !== 'role-everyone')
    .filter((r) => r.name.toLowerCase().includes(roleSearchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#313338] w-full max-w-[460px] rounded-xl shadow-2xl border border-[#202225] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#202225] flex items-center justify-between bg-[#2b2d31]">
          <div>
            <h3 className="text-base font-bold text-white">Criar canal</h3>
            {targetCategory && (
              <p className="text-xs text-[#949ba4] mt-0.5">
                em <span className="font-semibold text-[#dbdee1]">{targetCategory.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={closeCreateChannel}
            className="text-[#b5bac1] hover:text-white p-1 rounded hover:bg-[#35373c] transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Seletor de Tipo de Canal (Formato de lista limpa e linear) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
              Tipo de Canal
            </label>

            <div className="space-y-1">
              {CHANNEL_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = channelType === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => setChannelType(t.id)}
                    className={`flex items-center gap-3.5 p-2.5 rounded-lg cursor-pointer transition-colors select-none ${
                      isSelected
                        ? 'bg-[#35373c]/70 text-white'
                        : 'text-[#dbdee1] hover:bg-[#35373c]/40 hover:text-white'
                    }`}
                  >
                    {/* Bolinha de Seleção (Radio Button) à Esquerda */}
                    <div
                      className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'border-[#5865f2]' : 'border-[#80848e]'
                      }`}
                    >
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#5865f2]" />}
                    </div>

                    {/* Ícone */}
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-[#949ba4]'}`} />

                    {/* Título e Descrição */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold block leading-tight">{t.name}</span>
                      <span className="text-xs text-[#949ba4] mt-0.5 block leading-tight">
                        {t.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nome do Canal */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
              Nome do Canal
            </label>
            <div className="flex items-center bg-[#111214] border border-[#202225] focus-within:border-[#5865f2] rounded-xl px-3 py-2.5 text-white text-sm transition-colors">
              <span className="text-[#949ba4] mr-2 font-bold flex-shrink-0">
                {channelType === 'voice' ? (
                  <Volume2 className="w-4 h-4" />
                ) : channelType === 'forum' ? (
                  <MessagesSquare className="w-4 h-4" />
                ) : (
                  <Hash className="w-4 h-4" />
                )}
              </span>
              <input
                autoFocus
                value={channelName}
                onChange={(e) => {
                  if (channelType === 'voice') {
                    setChannelName(e.target.value);
                  } else {
                    setChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }
                }}
                placeholder="novo-canal"
                className="bg-transparent flex-1 outline-none text-white text-sm font-medium placeholder-[#80848e]"
              />
            </div>
          </div>

          {/* Toggle: Canal Privado */}
          <div className="space-y-3 pt-1">
            <div className="bg-[#111214]/60 border border-[#202225] rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className={`w-4 h-4 flex-shrink-0 ${isPrivate ? 'text-[#5865f2]' : 'text-[#80848e]'}`} />
                <div>
                  <span className="text-sm font-semibold text-white block">Canal Privado</span>
                  <span className="text-xs text-[#949ba4] mt-0.5 block leading-tight">
                    Apenas membros e cargos selecionados podem ver
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer flex-shrink-0 ${
                  isPrivate ? 'bg-[#5865f2]' : 'bg-[#4e5058]'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white block transition-transform shadow-md ${
                    isPrivate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Painel de Cargos Permitidos com Busca e Checkboxes Redondos */}
            {isPrivate && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                    Quem pode acessar este canal?
                  </span>
                  <span className="text-[11px] text-[#949ba4]">
                    {selectedRoleIds.length} {selectedRoleIds.length === 1 ? 'selecionado' : 'selecionados'}
                  </span>
                </div>

                {/* Campo de Busca de Cargos com Ícone de Lupa */}
                <div className="flex items-center bg-[#111214] border border-[#202225] focus-within:border-[#5865f2] rounded-xl px-3 py-2 text-xs transition-colors">
                  <Search className="w-3.5 h-3.5 text-[#949ba4] mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    value={roleSearchQuery}
                    onChange={(e) => setRoleSearchQuery(e.target.value)}
                    placeholder="Buscar cargos ou membros..."
                    className="bg-transparent flex-1 outline-none text-white text-xs placeholder-[#80848e]"
                  />
                  {roleSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRoleSearchQuery('')}
                      className="text-[#949ba4] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Lista Limpa com Checkboxes Redondos */}
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredRoles.map((r) => {
                    const isSelected = selectedRoleIds.includes(r.id);
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedRoleIds((prev) =>
                            prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id],
                          );
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-[#2b2d31]/60 transition-colors cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: r.color }}
                          />
                          <span className="text-xs font-semibold text-white">{r.name}</span>
                        </div>

                        {/* Checkbox Redondo */}
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-[#5865f2] border-[#5865f2] text-white'
                              : 'border-[#4e5058] hover:border-[#80848e]'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                  {filteredRoles.length === 0 && (
                    <div className="py-4 text-center text-xs text-[#80848e]">
                      Nenhum cargo encontrado
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Padronizado com Botão Principal Roxo/Azul */}
          <div className="pt-3 border-t border-[#202225] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeCreateChannel}
              className="text-xs font-semibold text-white hover:underline px-3 py-2 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!channelName.trim()}
              className={`px-6 py-2 rounded text-xs font-semibold transition-all shadow ${
                channelName.trim()
                  ? 'bg-[#5865f2] hover:bg-[#4752c4] text-white cursor-pointer shadow-[#5865f2]/20'
                  : 'bg-[#35373c] text-[#80848e] cursor-not-allowed'
              }`}
            >
              Criar canal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
