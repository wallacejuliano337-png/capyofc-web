import React, { useState, useEffect } from 'react';
import { Search, Smile, Film, X, Sticker, Sparkles, Upload, Plus } from 'lucide-react';
import { useDiscord } from '../../store/discordStore';

interface DiscordEmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string) => void;
  onSelectSticker?: (stickerUrl: string, stickerName?: string) => void;
  initialTab?: 'emoji' | 'sticker' | 'gif';
}

const EMOJI_CATEGORIES = [
  {
    name: 'EXPRESSÕES',
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '😎', '🤓', '🧐', '🥳', '😏', '😒', '😞', '😢', '😭', '😤', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '🤔', '🤫', '💀', '🤡', '👻', '👽', '🤖'],
  },
  {
    name: 'GAMING & LYC',
    icon: '🎮',
    emojis: ['🎮', '🕹️', '🏆', '🥇', '🥈', '🥉', '👑', '⚔️', '🛡️', '🏹', '🎯', '🎲', '🔥', '⚡', '💎', '🚀', '🛸', '👾', '💣', '💥', '✨', '🌟', '⭐', '💫', '🎉', '🎊'],
  },
  {
    name: 'GESTOS & PESSOAS',
    icon: '👍',
    emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🧠', '👀', '👁️', '💯'],
  },
  {
    name: 'ANIMAIS & NATUREZA',
    icon: '🐱',
    emojis: ['🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦅', '🦆', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐲', '🐉', '🦖', '🦕', '🌸', '🌹', '🌺', '🌻', '🌼', '🌷', '🌱', '🌲', '🌳', '🌴', '🍀'],
  },
];

const CURATED_GIFS = [
  {
    title: 'Hype Celebration',
    category: 'hype',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
  },
  {
    title: 'GG Win',
    category: 'gg',
    url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&auto=format&fit=crop&q=80',
  },
  {
    title: 'Cyber Victory',
    category: 'gg',
    url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&auto=format&fit=crop&q=80',
  },
  {
    title: 'Neon Dance',
    category: 'dance',
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop&q=80',
  },
  {
    title: 'Laughing Out Loud',
    category: 'laugh',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
  },
  {
    title: 'Epic Gaming Glitch',
    category: 'epic',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80',
  },
  {
    title: 'Space Galaxy',
    category: 'vibe',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&auto=format&fit=crop&q=80',
  },
  {
    title: 'Fire Shield',
    category: 'hype',
    url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&auto=format&fit=crop&q=80',
  },
];

export const DiscordEmojiPicker: React.FC<DiscordEmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  initialTab = 'emoji',
}) => {
  const { servers, activeServerId, openServerSettings } = useDiscord();
  const currentServer = servers?.find((s) => s.id === activeServerId) || servers?.[0];
  const serverCustomStickers = currentServer?.stickers || [];

  const [activeTab, setActiveTab] = useState<'gif' | 'sticker' | 'emoji'>(initialTab);
  const [search, setSearch] = useState('');
  const [selectedGifCategory, setSelectedGifCategory] = useState<string>('all');

  // Synchronize tab when trigger icon in chat changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  const filteredServerStickers = serverCustomStickers.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.tags && s.tags.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-16 right-4 w-88 sm:w-[420px] bg-[#2b2d31] border border-[#1e1f22] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 select-none text-left"
    >
      {/* ── 1. Top Header Tabs (GIFs, Figurinhas, Emojis) ────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-[#232428] bg-[#232428]/80">
        <div className="flex items-center gap-1.5 p-0.5 bg-[#1e1f22] rounded-xl border border-[#2b2d31]">
          {/* Aba 1: GIFs */}
          <button
            type="button"
            onClick={() => setActiveTab('gif')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'gif'
                ? 'bg-[#eb459e] text-white shadow-md'
                : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]/50'
            }`}
          >
            <Film className="w-3.5 h-3.5 flex-shrink-0" />
            <span>GIFs</span>
          </button>

          {/* Aba 2: Figurinhas */}
          <button
            type="button"
            onClick={() => setActiveTab('sticker')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sticker'
                ? 'bg-[#8B5CF6] text-white shadow-md'
                : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]/50'
            }`}
          >
            <Sticker className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Figurinhas</span>
            {serverCustomStickers.length > 0 && (
              <span className="bg-white/20 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                {serverCustomStickers.length}
              </span>
            )}
          </button>

          {/* Aba 3: Emojis */}
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'emoji'
                ? 'bg-[#fee75c] text-black shadow-md'
                : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]/50'
            }`}
          >
            <Smile className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Emojis</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-[#949ba4] hover:text-white p-1.5 rounded-lg hover:bg-[#35373c] transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── 2. Search Input ──────────────────────────────────────────────────────── */}
      <div className="p-3 bg-[#2b2d31] border-b border-[#232428]/60 space-y-2">
        <div className="flex items-center bg-[#1e1f22] border border-[#232428] rounded-xl px-3 py-1.5 focus-within:border-[#8B5CF6] transition-colors shadow-inner">
          <Search className="w-3.5 h-3.5 text-[#949ba4] mr-2 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'gif'
                ? 'Buscar no Tenor / GIFs...'
                : activeTab === 'sticker'
                ? 'Buscar figurinhas...'
                : 'Buscar emojis...'
            }
            className="w-full bg-transparent text-xs text-white placeholder-[#80848e] focus:outline-none"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-[#949ba4] hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Chips de Categorias para GIFs */}
        {activeTab === 'gif' && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 text-[11px]">
            {['all', 'hype', 'gg', 'dance', 'laugh', 'epic', 'vibe'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedGifCategory(cat)}
                className={`px-2 py-0.5 rounded-full capitalize font-semibold transition-colors cursor-pointer flex-shrink-0 ${
                  selectedGifCategory === cat
                    ? 'bg-[#eb459e] text-white shadow'
                    : 'bg-[#1e1f22] text-[#949ba4] hover:text-white hover:bg-[#35373c]'
                }`}
              >
                {cat === 'all' ? 'Todos' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Content Area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 max-h-80 overflow-y-auto p-3 space-y-4 scrollbar-thin">
        {/* ========================================================================= */}
        {/* ── ABA 1: GIFs ────────────────────────────────────────────────────────── */}
        {/* ========================================================================= */}
        {activeTab === 'gif' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {CURATED_GIFS.filter((g) => {
                const matchSearch =
                  !search ||
                  g.title.toLowerCase().includes(search.toLowerCase()) ||
                  g.category.includes(search.toLowerCase());
                const matchCategory =
                  selectedGifCategory === 'all' || g.category === selectedGifCategory;
                return matchSearch && matchCategory;
              }).map((gif, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectGif(gif.url)}
                  className="group relative h-28 rounded-xl overflow-hidden bg-[#1e1f22] border border-[#232428] hover:border-[#eb459e] cursor-pointer transition-all shadow hover:shadow-xl hover:scale-[1.02]"
                >
                  <img
                    src={gif.url}
                    alt={gif.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                    <span className="text-[11px] font-semibold text-white truncate drop-shadow">
                      {gif.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ── ABA 2: FIGURINHAS DO SERVIDOR ──────────────────────────────────────── */}
        {/* ========================================================================= */}
        {activeTab === 'sticker' && (
          <div className="space-y-3">
            {/* SEÇÃO: FIGURINHAS DO SERVIDOR ATIVO */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-0.5">
                <span className="text-[11px] font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5 truncate">
                  <span className="w-4 h-4 rounded-full bg-[#5865f2] text-white text-[9px] font-extrabold flex items-center justify-center flex-shrink-0">
                    {currentServer?.name ? currentServer.name[0].toUpperCase() : 'S'}
                  </span>
                  <span className="truncate">{currentServer?.name || 'Servidor Atual'}</span>
                </span>
                <span className="text-[10px] text-[#949ba4] font-medium bg-[#1e1f22] px-2 py-0.5 rounded-full border border-[#2b2d31]">
                  {filteredServerStickers.length} disponíveis
                </span>
              </div>

              {filteredServerStickers.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#1e1f22]/70 border border-[#2b2d31] text-center space-y-1">
                  <p className="font-semibold text-xs text-white">Nenhuma figurinha personalizada enviada</p>
                  <p className="text-[11px] text-[#949ba4]">
                    Envie figurinhas exclusivas para este servidor no botão abaixo.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {filteredServerStickers.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => onSelectSticker?.(sticker.url, sticker.name)}
                      className="group flex flex-col items-center justify-center p-2 rounded-xl bg-[#1e1f22] hover:bg-[#35373c] border border-[#232428] hover:border-[#8B5CF6] transition-all cursor-pointer shadow hover:shadow-xl hover:scale-105 active:scale-95"
                      title={sticker.name}
                    >
                      <div className="w-16 h-16 flex items-center justify-center p-1 overflow-hidden">
                        <img
                          src={sticker.url}
                          alt={sticker.name}
                          className="w-full h-full object-contain drop-shadow transition-transform group-hover:scale-110"
                        />
                      </div>
                      <span className="text-[11px] font-bold text-[#E5E7EB] mt-1 truncate max-w-full text-center">
                        {sticker.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ── ABA 3: EMOJIS ──────────────────────────────────────────────────────── */}
        {/* ========================================================================= */}
        {activeTab === 'emoji' && (
          <div className="space-y-4">
            {EMOJI_CATEGORIES.map((cat) => {
              const filtered = cat.emojis.filter((e) => !search || e.includes(search));
              if (filtered.length === 0) return null;

              return (
                <div key={cat.name}>
                  <span className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </span>
                  <div className="grid grid-cols-8 gap-1.5">
                    {filtered.map((emoji, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onSelectEmoji(emoji)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-[#35373c] transition-transform hover:scale-125 cursor-pointer select-none active:scale-95"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. Barra Inferior de Atalho (Estilo Discord) ─────────────────────────── */}
      {activeTab === 'sticker' && (
        <div className="p-2.5 bg-[#232428] border-t border-[#1e1f22] flex items-center justify-between gap-3 text-xs select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-[#5865f2]/20 text-[#5865f2] flex items-center justify-center flex-shrink-0">
              <Upload className="w-3.5 h-3.5" />
            </div>
            <span className="text-[#dbdee1] font-semibold truncate text-[11px]">
              Enviar uma figurinha para este servidor
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              openServerSettings('stickers');
              onClose();
            }}
            className="px-3 py-1 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] text-white text-[11px] font-bold transition-all cursor-pointer shadow flex-shrink-0 flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3 h-3" />
            <span>Enviar</span>
          </button>
        </div>
      )}
    </div>
  );
};
