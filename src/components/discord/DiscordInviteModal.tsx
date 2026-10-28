import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Copy, AlertTriangle, ChevronDown, Sparkles } from 'lucide-react';
import { Server, Channel, User } from '../../types/discord';
import { useDiscord, mockUsers } from '../../store/discordStore';
import { getCapyInviteUrl, CAPY_OFFICIAL_SLUG } from '../../lib/invite';
import { communityAction } from '../../services/communities';
import { db } from '../../lib/supabase';

interface DiscordInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: Server;
  channel?: Channel | null;
}

export const DiscordInviteModal: React.FC<DiscordInviteModalProps> = ({
  isOpen,
  onClose,
  server,
  channel,
}) => {
  const {
    currentUser,
    communityMembers,
    sendMessage,
    activeServerId,
  } = useDiscord();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeInviteCode, setActiveInviteCode] = useState<string>('');
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState<Record<string, boolean>>({});
  const [isEditSettingsOpen, setIsEditSettingsOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [maxUses, setMaxUses] = useState<number>(0);

  // Fecha com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Obter ou gerar código de convite para o servidor
  useEffect(() => {
    if (!isOpen || !server) return;

    if (
      server.id === 'server-lyc' ||
      server.communityId === 'd3f2173f-79f0-4362-b60a-ad079f724b54' ||
      server.name.toLowerCase().includes('capychat oficial')
    ) {
      setActiveInviteCode(CAPY_OFFICIAL_SLUG);
      return;
    }

    const commId = server.communityId || server.id;
    let isCancelled = false;
    setIsGeneratingInvite(true);

    const resolveCode = async () => {
      try {
        // Verificar se já existe um convite válido existente
        const { data: existing } = await db()
          .from('community_invites')
          .select('code')
          .eq('community_id', commId)
          .is('revoked_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isCancelled && existing?.code) {
          setActiveInviteCode(existing.code);
          setIsGeneratingInvite(false);
          return;
        }

        // Caso contrário, gerar um novo convite através da RPC do Supabase
        const res = await communityAction<any>('create_invite', {
          community_id: commId,
          expires_in_hours: expiresInDays > 0 ? expiresInDays * 24 : null,
          max_uses: maxUses > 0 ? maxUses : null,
        });

        if (!isCancelled && res?.code) {
          setActiveInviteCode(res.code);
          setIsGeneratingInvite(false);
          return;
        }
      } catch (err) {
        console.warn('[DiscordInviteModal] Failed to get invite code:', err);
      }

      if (!isCancelled) {
        // Fallback para slug legível da comunidade
        const fallbackCode = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'convite';
        setActiveInviteCode(fallbackCode);
        setIsGeneratingInvite(false);
      }
    };

    void resolveCode();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, server?.id, server?.communityId, expiresInDays, maxUses]);

  // Lista de amigos filtrados para envio
  const friendsPool: User[] = useMemo(() => {
    const rawList = (communityMembers && communityMembers.length > 0)
      ? communityMembers
      : (mockUsers || []);

    return rawList.filter(
      (u) => u.id !== currentUser.id && u.id !== 'user-me'
    );
  }, [communityMembers, currentUser.id]);

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friendsPool;
    const q = searchQuery.toLowerCase();
    return friendsPool.filter(
      (f) =>
        (f.displayName && f.displayName.toLowerCase().includes(q)) ||
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.tag && f.tag.toLowerCase().includes(q))
    );
  }, [friendsPool, searchQuery]);

  if (!isOpen) return null;

  const currentInviteUrl = getCapyInviteUrl(activeInviteCode || 'capychat-oficial');
  const targetChannelName = channel ? channel.name : (server.categories?.[0]?.channels?.[0]?.name || 'geral');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentInviteUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleInviteFriend = (friend: User) => {
    // Envia o link de convite na DM do amigo
    const dmChannelId = `dm-${friend.id}`;
    sendMessage(
      dmChannelId,
      `Olá! Estou te convidando para entrar na comunidade **${server.name}**: ${currentInviteUrl}`
    );

    setInvitedFriends((prev) => ({
      ...prev,
      [friend.id]: true,
    }));
  };

  const handleCreateCustomInvite = async () => {
    setIsGeneratingInvite(true);
    const commId = server.communityId || server.id;

    try {
      const res = await communityAction<any>('create_invite', {
        community_id: commId,
        expires_in_hours: expiresInDays > 0 ? expiresInDays * 24 : null,
        max_uses: maxUses > 0 ? maxUses : null,
      });

      if (res?.code) {
        setActiveInviteCode(res.code);
      }
    } catch (err) {
      console.warn('[DiscordInviteModal] Failed to create custom invite:', err);
    } finally {
      setIsGeneratingInvite(false);
      setIsEditSettingsOpen(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-[#313338] rounded-[8px] shadow-2xl border border-[#202225] overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 pb-3 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight flex items-center gap-1.5">
              <span>Convidar amigos para {server.name}</span>
            </h2>
            <p className="text-xs text-[#949ba4] mt-0.5">
              Os destinatários chegarão em <strong className="text-[#dbdee1]">#{targetChannelName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#949ba4] hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-5 pb-2 flex-shrink-0">
          <div className="relative flex items-center bg-[#1e1f22] rounded-[4px] px-2.5 py-2 border border-[#202225]">
            <input
              type="text"
              placeholder="Buscar amigos"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-[#dbdee1] flex-1 outline-none placeholder-[#80848e]"
              autoFocus
            />
            <Search className="w-4 h-4 text-[#80848e] flex-shrink-0" />
          </div>

          {/* Aviso se canal for privado */}
          {channel?.isPrivate && (
            <div className="mt-2.5 p-2.5 rounded bg-[#f0b232]/10 border border-[#f0b232]/30 flex items-start gap-2 text-[#f0b232] text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Este canal é privado, somente membros e cargos selecionados poderão visualizar esse canal.
              </span>
            </div>
          )}
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1 scrollbar-thin min-h-[160px] max-h-[260px]">
          {filteredFriends.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#949ba4]">
              Nenhum amigo encontrado para "{searchQuery}".
            </div>
          ) : (
            filteredFriends.map((friend) => {
              const isInvited = !!invitedFriends[friend.id];

              return (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-[#35373c]/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <img
                        src={friend.avatar || '/placeholder-avatar.png'}
                        alt={friend.displayName || friend.name}
                        className="w-8 h-8 rounded-full object-cover bg-[#2b2d31]"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#313338] ${
                          friend.status === 'online'
                            ? 'bg-[#23a55a]'
                            : friend.status === 'idle'
                            ? 'bg-[#f0b232]'
                            : 'bg-[#80848e]'
                        }`}
                      />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-semibold text-white truncate">
                        {friend.displayName || friend.name}
                      </div>
                      <div className="text-xs text-[#949ba4] truncate">
                        {friend.tag || `@${friend.name}`}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleInviteFriend(friend)}
                    disabled={isInvited}
                    className={`px-4 py-1.5 rounded-[3px] text-xs font-semibold transition-all cursor-pointer flex-shrink-0 ${
                      isInvited
                        ? 'bg-transparent border border-[#23a55a] text-[#23a55a] cursor-default'
                        : 'border border-[#4e5058] text-white hover:border-[#5865f2] hover:bg-[#5865f2]'
                    }`}
                  >
                    {isInvited ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Enviado</span>
                      </span>
                    ) : (
                      'Convidar'
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Section: Or send server invite link */}
        <div className="p-5 pt-3 bg-[#2b2d31] border-t border-[#202225] flex-shrink-0 space-y-2">
          <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
            Ou, envie um convite do servidor a um amigo
          </label>

          <div className="flex items-center gap-2 bg-[#1e1f22] p-1.5 pl-3 rounded-[3px] border border-[#202225]">
            <input
              type="text"
              readOnly
              value={isGeneratingInvite ? 'Gerando link seguro...' : currentInviteUrl}
              className="bg-transparent text-sm text-[#dbdee1] flex-1 outline-none select-all font-mono"
            />
            <button
              onClick={handleCopyLink}
              className={`px-5 py-2 rounded-[3px] text-xs font-bold text-white transition-colors cursor-pointer ${
                copiedLink
                  ? 'bg-[#23a55a]'
                  : 'bg-[#5865f2] hover:bg-[#4752c4]'
              }`}
            >
              {copiedLink ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          {/* Expiration Note & Edit Link */}
          <div className="flex items-center justify-between pt-0.5 text-[11px] text-[#949ba4]">
            <span>
              {expiresInDays === 0
                ? 'Seu link de convite nunca expira.'
                : `Seu link de convite expira em ${expiresInDays} dia${expiresInDays > 1 ? 's' : ''}.`}
            </span>
            <button
              onClick={() => setIsEditSettingsOpen(!isEditSettingsOpen)}
              className="text-[#00a8fc] hover:underline cursor-pointer font-medium"
            >
              {isEditSettingsOpen ? 'Fechar configurações' : 'Editar link de convite'}
            </button>
          </div>

          {/* Settings Sub-Panel */}
          {isEditSettingsOpen && (
            <div className="pt-3 pb-1 border-t border-[#35373c] space-y-3 animate-in fade-in duration-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider block mb-1">
                    Expirar após
                  </label>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="w-full bg-[#1e1f22] border border-[#202225] rounded p-1.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value={1}>1 dia</option>
                    <option value={7}>7 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={0}>Nunca</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider block mb-1">
                    Número máximo de usos
                  </label>
                  <select
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="w-full bg-[#1e1f22] border border-[#202225] rounded p-1.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value={0}>Sem limite</option>
                    <option value={1}>1 uso</option>
                    <option value={5}>5 usos</option>
                    <option value={10}>10 usos</option>
                    <option value={25}>25 usos</option>
                    <option value={50}>50 usos</option>
                    <option value={100}>100 usos</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateCustomInvite}
                  disabled={isGeneratingInvite}
                  className="px-3 py-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                >
                  {isGeneratingInvite ? 'Gerando...' : 'Gerar novo link'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
