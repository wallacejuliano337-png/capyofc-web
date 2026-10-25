import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Hash,
  Volume2,
  Megaphone,
  MessagesSquare,
  Server as ServerIcon,
  MessageSquare,
  ArrowRight,
  CornerDownLeft,
  X,
  Compass,
} from 'lucide-react';
import { useDiscord } from '../../store/discordStore';
import { getAvatarUrl } from '../../utils/avatar';

interface QuickSwitcherItem {
  id: string;
  type: 'channel' | 'dm' | 'server';
  name: string;
  subtitle: string;
  serverId?: string;
  channelId?: string;
  userId?: string;
  icon?: string;
  avatar?: string;
  channelType?: string;
  status?: string;
}

export const DiscordQuickSwitcherModal: React.FC = () => {
  const {
    isQuickSwitcherOpen,
    closeQuickSwitcher,
    servers,
    folders,
    communityMembers,
    setActiveServer,
    setActiveChannel,
    setActiveView,
  } = useDiscord();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isQuickSwitcherOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isQuickSwitcherOpen]);

  // Aggregate all searchable items
  const allItems: QuickSwitcherItem[] = useMemo(() => {
    const list: QuickSwitcherItem[] = [];

    // All servers (root + folders)
    const allServersList = [...servers];
    folders.forEach((f) => {
      f.servers.forEach((s) => {
        if (!allServersList.some((existing) => existing.id === s.id)) {
          allServersList.push(s);
        }
      });
    });

    // 1. Add Servers
    allServersList.forEach((srv) => {
      const channelCount = srv.categories?.reduce((acc, c) => acc + c.channels.length, 0) || 0;
      list.push({
        id: `srv-${srv.id}`,
        type: 'server',
        name: srv.name,
        subtitle: `${channelCount} canais • Servidor`,
        serverId: srv.id,
        channelId: srv.categories?.[0]?.channels?.[0]?.id || 'ch-geral',
        icon: srv.icon,
      });

      // 2. Add Channels
      srv.categories?.forEach((cat) => {
        cat.channels.forEach((ch) => {
          list.push({
            id: `ch-${srv.id}-${ch.id}`,
            type: 'channel',
            name: ch.name,
            subtitle: `${srv.name} • ${cat.name}`,
            serverId: srv.id,
            channelId: ch.id,
            channelType: ch.type,
          });
        });
      });
    });

    // 3. Add Direct Messages (Friends)
    (communityMembers || []).forEach((u) => {
      list.push({
        id: `dm-${u.id}`,
        type: 'dm',
        name: u.displayName || u.name,
        subtitle: `@${u.name}#${u.tag || '0001'} • Mensagem Direta`,
        userId: u.id,
        avatar: u.avatar,
        status: u.status,
      });
    });

    return list;
  }, [servers, folders, communityMembers]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      // Default: show popular / initial mix of channels and DMs
      return allItems.slice(0, 15);
    }

    if (trimmed.startsWith('@')) {
      const term = trimmed.slice(1).trim();
      return allItems
        .filter((i) => i.type === 'dm' && (term === '' || i.name.toLowerCase().includes(term)))
        .slice(0, 20);
    }

    if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
      const term = trimmed.slice(1).trim();
      return allItems
        .filter((i) => i.type === 'channel' && (term === '' || i.name.toLowerCase().includes(term)))
        .slice(0, 20);
    }

    if (trimmed.startsWith('*')) {
      const term = trimmed.slice(1).trim();
      return allItems
        .filter((i) => i.type === 'server' && (term === '' || i.name.toLowerCase().includes(term)))
        .slice(0, 20);
    }

    return allItems
      .filter((i) => i.name.toLowerCase().includes(trimmed) || i.subtitle.toLowerCase().includes(trimmed))
      .slice(0, 25);
  }, [allItems, query]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isQuickSwitcherOpen) return null;

  const handleSelect = (item: QuickSwitcherItem) => {
    if (item.type === 'channel') {
      if (item.serverId) setActiveServer(item.serverId);
      if (item.channelId) {
        setActiveChannel(item.channelId);
        setActiveView(item.channelType === 'voice' ? 'voice-stage' : 'chat');
      }
    } else if (item.type === 'dm') {
      setActiveServer('@me');
      if (item.userId) setActiveChannel(`dm-${item.userId}`);
      setActiveView('chat');
    } else if (item.type === 'server') {
      if (item.serverId) {
        setActiveServer(item.serverId);
        if (item.channelId) setActiveChannel(item.channelId);
      }
    }
    closeQuickSwitcher();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeQuickSwitcher();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={closeQuickSwitcher}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-[570px] bg-[#2b2d31] rounded-lg shadow-2xl border border-[#1f2023] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 z-10">
        {/* Top Search Input */}
        <div className="p-4 bg-[#1e1f22] border-b border-[#232428]">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Para onde você quer ir? (ou digite @, #, *)"
              className="w-full bg-[#111214] text-white text-[15px] font-medium pl-10 pr-10 py-3 rounded-md border border-[#2b2d31] focus:outline-none focus:border-[#5865f2] placeholder-[#80848e] transition-colors"
            />
            <Search className="w-5 h-5 text-[#80848e] absolute left-3.5 pointer-events-none" />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 text-[#80848e] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 space-y-0.5 scrollbar-thin select-none"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-[#949ba4] space-y-2">
              <Compass className="w-8 h-8 text-[#80848e] mx-auto opacity-60" />
              <p className="text-sm font-semibold">Nenhum resultado encontrado</p>
              <p className="text-xs text-[#80848e]">Tente buscar com termos diferentes ou use prefixos especiais.</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#404249] text-white'
                      : 'text-[#dbdee1] hover:bg-[#35373c]/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Item Icon / Avatar */}
                    {item.type === 'channel' ? (
                      <div className="w-7 h-7 rounded-md bg-[#1e1f22] flex items-center justify-center flex-shrink-0 text-[#949ba4]">
                        {item.channelType === 'voice' ? (
                          <Volume2 className="w-4 h-4 text-[#23a55a]" />
                        ) : item.channelType === 'announcement' ? (
                          <Megaphone className="w-4 h-4 text-[#5865f2]" />
                        ) : item.channelType === 'forum' ? (
                          <MessagesSquare className="w-4 h-4 text-[#faa61a]" />
                        ) : (
                          <Hash className="w-4 h-4" />
                        )}
                      </div>
                    ) : item.type === 'dm' ? (
                      <div className="relative flex-shrink-0">
                        <img
                          src={getAvatarUrl(item.avatar)}
                          alt={item.name}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#2b2d31] ${
                            item.status === 'online'
                              ? 'bg-[#23a55a]'
                              : item.status === 'idle'
                              ? 'bg-[#f0b232]'
                              : item.status === 'dnd'
                              ? 'bg-[#f23f43]'
                              : 'bg-[#80848e]'
                          }`}
                        />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-[#5865f2] flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                        {item.icon ? (
                          <img src={item.icon} alt={item.name} className="w-7 h-7 rounded-md object-cover" />
                        ) : (
                          <ServerIcon className="w-4 h-4" />
                        )}
                      </div>
                    )}

                    {/* Name & Subtitle */}
                    <div className="truncate min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{item.name}</span>
                        {item.type === 'channel' && item.channelType === 'voice' && (
                          <span className="text-[10px] bg-[#23a55a]/20 text-[#23a55a] font-bold px-1.5 py-0.2 rounded uppercase">
                            Voz
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#949ba4] truncate block">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  {/* Right indicator */}
                  {isSelected && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-[#b5bac1] bg-[#2b2d31] px-2 py-1 rounded shadow-sm border border-[#1f2023] flex-shrink-0 ml-2">
                      <span>Ir</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Discord ProTip Footer */}
        <div className="px-4 py-2.5 bg-[#1e1f22] border-t border-[#232428] flex items-center justify-between text-[11px] text-[#949ba4]">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#5865f2] uppercase tracking-wider">Dica Pro:</span>
            <span>Use <strong className="text-white">@</strong> para amigos, <strong className="text-white">#</strong> para canais e <strong className="text-white">*</strong> para servidores.</span>
          </div>
          <div className="flex items-center gap-1 text-[#80848e]">
            <kbd className="px-1.5 py-0.5 rounded bg-[#2b2d31] text-white text-[10px] font-mono border border-[#35363c]">ESC</kbd>
            <span>para fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
