import React, { useState } from 'react';
import { useDiscord } from '../../store/discordStore';
import { User } from '../../types/discord';
import { DiscordUserContextMenu } from './DiscordUserContextMenu';
import { getAvatarUrl } from '../../utils/avatar';
import {
  Users,
  MessageSquare,
  MoreVertical,
  Inbox,
  HelpCircle,
  Gamepad2,
  Tv,
  Headphones,
  Check,
  X,
  UserPlus,
  ShieldAlert,
} from 'lucide-react';

export const DiscordFriendsView: React.FC = () => {
  const [userContextMenu, setUserContextMenu] = useState<{
    user: User;
    position: { x: number; y: number };
  } | null>(null);

  const {
    friendsFilter,
    setFriendsFilter,
    setActiveChannel,
    openMemberPopout,
    friendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    communityMembers,
    currentUser,
  } = useDiscord();

  const [addInput, setAddInput] = useState('');
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const memberPool = communityMembers || [];
  const friends = memberPool.filter((u) => u.id !== currentUser.id && u.id !== 'user-me');
  const onlineFriends = friends.filter((f) => f.status !== 'offline');
  const pendingCount = friendRequests.length;

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInput.trim()) return;
    const res = await sendFriendRequest(addInput);
    setFeedback(res);
    if (res.success) {
      setAddInput('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#313338] select-none min-w-0">
      {/* Top Navigation Bar with Tabs */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-[#1f2023] bg-[#313338] flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-semibold text-[#f2f3f5] pr-3 border-r border-[#3f4147]">
            <Users className="w-5 h-5 text-[#80848e]" />
            <span>Amigos</span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <button
              onClick={() => {
                setFriendsFilter('online');
                setFeedback(null);
              }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                friendsFilter === 'online'
                  ? 'bg-[#3f4147] text-white'
                  : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              Disponível
            </button>
            <button
              onClick={() => {
                setFriendsFilter('all');
                setFeedback(null);
              }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                friendsFilter === 'all'
                  ? 'bg-[#3f4147] text-white'
                  : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setFriendsFilter('pending');
                setFeedback(null);
              }}
              className={`px-2.5 py-1 rounded transition-colors relative cursor-pointer ${
                friendsFilter === 'pending'
                  ? 'bg-[#3f4147] text-white'
                  : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              Pendente
              {pendingCount > 0 && (
                <span className="ml-1.5 bg-[#f23f43] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setFriendsFilter('blocked');
                setFeedback(null);
              }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                friendsFilter === 'blocked'
                  ? 'bg-[#3f4147] text-white'
                  : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              Bloqueado
            </button>
            <button
              onClick={() => {
                setFriendsFilter('add');
                setFeedback(null);
              }}
              className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                friendsFilter === 'add'
                  ? 'text-[#23a55a] bg-transparent'
                  : 'bg-[#23a55a] text-white hover:bg-[#1f914f]'
              }`}
            >
              Adicionar amigo
            </button>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-3 text-[#b5bac1]">
          <button title="Caixa de Entrada" className="p-1 hover:text-[#dbdee1] cursor-pointer">
            <Inbox className="w-5 h-5" />
          </button>
          <button title="Ajuda" className="p-1 hover:text-[#dbdee1] cursor-pointer">
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Friends List & "Ativo Agora" Section */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conditional Content based on friendsFilter */}
        {friendsFilter === 'add' ? (
          /* ADICIONAR AMIGO VIEW */
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Adicionar amigo
            </h2>
            <p className="text-xs text-[#949ba4] mt-1 mb-4">
              Você pode adicionar amigos usando o nome de usuário do CapyChat.
            </p>

            <form
              onSubmit={handleSendRequest}
              className="relative flex items-center bg-[#1e1f22] rounded-lg p-3 border border-[#1f2023] focus-within:border-[#5865f2] transition-colors"
            >
              <input
                type="text"
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                placeholder="Você pode adicionar amigos usando o nome de usuário do CapyChat"
                className="bg-transparent flex-1 text-sm text-[#dbdee1] placeholder-[#80848e] outline-none pr-36"
                autoFocus
              />
              <button
                type="submit"
                disabled={!addInput.trim()}
                className={`absolute right-2 px-4 py-2 rounded text-xs font-semibold transition-all ${
                  addInput.trim()
                    ? 'bg-[#5865f2] hover:bg-[#4752c4] text-white cursor-pointer shadow-md'
                    : 'bg-[#3b3e45] text-[#80848e] cursor-not-allowed'
                }`}
              >
                Enviar pedido de amizade
              </button>
            </form>

            {feedback && (
              <div
                className={`mt-3 text-xs font-medium flex items-center gap-1.5 ${
                  feedback.success ? 'text-[#23a55a]' : 'text-[#f23f43]'
                }`}
              >
                {feedback.success ? <Check className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* Illustration / Empty State Guide */}
            <div className="mt-12 flex flex-col items-center justify-center text-center opacity-70">
              <div className="w-48 h-36 flex items-center justify-center rounded-2xl bg-[#2b2d31]/50 border border-[#35373c]/30 mb-4">
                <UserPlus className="w-16 h-16 text-[#5865f2]" />
              </div>
              <p className="text-xs text-[#949ba4] max-w-sm">
                Wumpus está aguardando seus amigos. Digite o nome de usuário acima para começar!
              </p>
            </div>
          </div>
        ) : friendsFilter === 'pending' ? (
          /* PEDIDOS PENDENTES VIEW */
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <h2 className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-4">
              Pendentes — {friendRequests.length}
            </h2>

            {friendRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-75">
                <Users className="w-16 h-16 text-[#4e5058] mb-3" />
                <p className="text-sm font-medium text-[#dbdee1]">Nenhum pedido de amizade pendente</p>
                <p className="text-xs text-[#949ba4] mt-1">Aqui você verá os convites recebidos e enviados.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {friendRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#35373c]/50 border-t border-[#35373c]/20 group transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={req.user.avatar}
                        alt={req.user.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-[#f2f3f5] truncate">
                            {req.user.displayName || req.user.name}
                          </span>
                          <span className="text-xs text-[#949ba4]">
                            @{req.user.name}#{req.user.tag}
                          </span>
                        </div>
                        <span className="text-xs text-[#949ba4]">
                          {req.type === 'incoming'
                            ? `Pedido de amizade recebido • ${req.timestamp}`
                            : `Pedido de amizade enviado • ${req.timestamp}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {req.type === 'incoming' ? (
                        <>
                          <button
                            onClick={() => acceptFriendRequest(req.id)}
                            title="Aceitar"
                            className="p-2 rounded-full bg-[#2b2d31] text-[#23a55a] hover:bg-[#23a55a] hover:text-white transition-colors cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => rejectFriendRequest(req.id)}
                            title="Ignorar"
                            className="p-2 rounded-full bg-[#2b2d31] text-[#f23f43] hover:bg-[#f23f43] hover:text-white transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => rejectFriendRequest(req.id)}
                          title="Cancelar"
                          className="p-2 rounded-full bg-[#2b2d31] text-[#949ba4] hover:text-[#f23f43] hover:bg-[#111214] transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : friendsFilter === 'blocked' ? (
          /* BLOQUEADOS VIEW */
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col items-center justify-center text-center opacity-70">
            <ShieldAlert className="w-16 h-16 text-[#4e5058] mb-3" />
            <p className="text-sm font-medium text-[#dbdee1]">Ninguém bloqueado</p>
            <p className="text-xs text-[#949ba4] mt-1">Você não tem usuários bloqueados no momento.</p>
          </div>
        ) : (
          /* ONLINE OU TODOS VIEW */
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <h2 className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-4">
              {friendsFilter === 'online'
                ? `Disponível — ${onlineFriends.length}`
                : `Todos os Amigos — ${friends.length}`}
            </h2>

            <div className="space-y-1">
              {(friendsFilter === 'online' ? onlineFriends : friends).map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#35373c]/50 border-t border-[#35373c]/20 group cursor-pointer transition-colors"
                  onClick={() => setActiveChannel(`dm-${friend.id}`)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setUserContextMenu({
                      user: friend,
                      position: { x: e.clientX, y: e.clientY },
                    });
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="relative flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        openMemberPopout(friend, {
                          top: rect.top,
                          right: window.innerWidth - rect.left + 10,
                        });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        openMemberPopout(friend, {
                          top: rect.top,
                          right: window.innerWidth - rect.left + 10,
                        });
                      }}
                    >
                      <img
                        src={getAvatarUrl(friend.avatar)}
                        alt={friend.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#313338] ${
                          friend.status === 'online'
                            ? 'bg-[#23a55a]'
                            : friend.status === 'idle'
                            ? 'bg-[#f0b232]'
                            : friend.status === 'dnd'
                            ? 'bg-[#f23f43]'
                            : 'bg-[#80848e]'
                        }`}
                      />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-[#f2f3f5] truncate">
                          {friend.displayName || friend.name}
                        </span>
                        <span className="text-xs text-[#949ba4] hidden group-hover:inline">
                          @{friend.name}
                        </span>
                      </div>

                      <span className="text-xs text-[#949ba4] truncate">
                        {friend.activity
                          ? `${
                              friend.activity.type === 'PLAYING'
                                ? 'Jogando '
                                : friend.activity.type === 'STREAMING'
                                ? 'Transmitindo '
                                : 'Ouvindo '
                            } ${friend.activity.name}`
                          : friend.customStatus ||
                            (friend.status === 'online' ? 'Online' : 'Offline')}
                      </span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveChannel(`dm-${friend.id}`);
                      }}
                      title="Enviar Mensagem"
                      className="p-2 rounded-full bg-[#2b2d31] text-[#b5bac1] hover:text-white hover:bg-[#111214] transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserContextMenu({
                          user: friend,
                          position: { x: e.clientX, y: e.clientY },
                        });
                      }}
                      title="Opções"
                      className="p-2 rounded-full bg-[#2b2d31] text-[#b5bac1] hover:text-white hover:bg-[#111214] transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right "Ativo Agora" Sidebar */}
        <aside className="w-80 border-l border-[#1f2023] p-4 hidden lg:block overflow-y-auto">
          <h3 className="font-bold text-lg text-[#f2f3f5] mb-4">Ativo agora</h3>

          <div className="space-y-4">
            {friends
              .filter((f) => f.activity)
              .map((friend) => (
                <div
                  key={friend.id}
                  className="bg-[#2b2d31] p-3 rounded-lg border border-[#1f2023] space-y-3"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={getAvatarUrl(friend.avatar)}
                      alt={friend.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs text-[#f2f3f5] truncate">
                        {friend.displayName || friend.name}
                      </span>
                      <span className="text-[11px] text-[#949ba4]">
                        {friend.activity?.name}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#1e1f22] p-2.5 rounded-md flex items-center gap-3">
                    <div className="p-2 rounded bg-[#5865f2]/20 text-[#5865f2]">
                      {friend.activity?.type === 'PLAYING' && <Gamepad2 className="w-5 h-5" />}
                      {friend.activity?.type === 'STREAMING' && <Tv className="w-5 h-5" />}
                      {friend.activity?.type === 'LISTENING' && <Headphones className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col text-xs min-w-0">
                      <span className="font-medium text-[#dbdee1] truncate">
                        {friend.activity?.name}
                      </span>
                      <span className="text-[10px] text-[#80848e] truncate">
                        {friend.activity?.details || 'Em execução há 42 minutos'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </aside>
      </div>

      {/* User Context Menu for Friends */}
      {userContextMenu && (
        <DiscordUserContextMenu
          user={userContextMenu.user}
          position={userContextMenu.position}
          context="friend"
          onClose={() => setUserContextMenu(null)}
          onOpenProfile={(u) => {
            openMemberPopout(u, {
              top: userContextMenu.position.y,
              right: window.innerWidth - userContextMenu.position.x,
            });
          }}
        />
      )}
    </div>
  );
};
