import React, { useState, useRef, useEffect } from 'react';
import { useDiscord } from '../../store/discordStore';
import { useTheme } from '../../store/themeStore';
import { MessageAttachment, SERVER_TAG_BADGES, SERVER_TAG_COLORS, resolveServerTagColor, resolveServerTagBadge, resolveServerTagBadgeIcon, User } from '../../types/discord';
import { DiscordMarkdown } from './DiscordMarkdown';
import { DiscordEmojiPicker } from './DiscordEmojiPicker';
import { DiscordUserContextMenu } from './DiscordUserContextMenu';
import { getAvatarUrl } from '../../utils/avatar';
import { playNotificationSound } from '../../services/notification-sounds';
import {
  Hash,
  Volume2,
  Bell,
  Pin,
  Users,
  Search,
  Inbox,
  HelpCircle,
  PlusCircle,
  Gift,
  Film,
  Smile,
  SendHorizontal,
  Tv,
  Sticker,
  Phone,
  Video,
  CornerUpLeft,
  Edit3,
  Trash2,
  X,
  Check,
  Paperclip,
  Copy,
  ChevronLeft,
} from 'lucide-react';

export interface DiscordChatViewProps {
  onBack?: () => void;
  isMobile?: boolean;
}

export const DiscordChatView: React.FC<DiscordChatViewProps> = ({ onBack, isMobile }) => {
  const {
    servers,
    activeServerId,
    activeChannelId,
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    toggleReaction,
    editChannel,
    isMemberListOpen,
    toggleMemberList,
    setActiveView,
    voiceState,
    connectToVoice,
    openMemberPopout,
    getUserRoleColor,
    currentUser,
    communityMembers,
    canUserModerate,
  } = useDiscord();

  const { theme } = useTheme();
  const isOled = theme === 'oled';

  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; author: string; content: string } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiPickerTab, setEmojiPickerTab] = useState<'emoji' | 'sticker' | 'gif'>('emoji');
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [msgContextMenu, setMsgContextMenu] = useState<{
    msgId: string;
    content: string;
    authorId: string;
    authorName: string;
    position: { x: number; y: number };
  } | null>(null);

  const [userContextMenu, setUserContextMenu] = useState<{
    user: User;
    position: { x: number; y: number };
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputBarRef = useRef<HTMLInputElement>(null);

  const server = servers.find((s) => s.id === activeServerId) || servers[0];
  let channelName = 'geral';
  let channelTopic = 'Bate-papo principal da comunidade CapyChat Oficial.';
  let channelType: string = 'text';
  let currentCategoryId = '';

  const isDm = activeServerId === '@me';

  if (isDm) {
    const friendId = activeChannelId.replace('dm-', '');
    const userPool = communityMembers || [];
    const friend = userPool.find((u) => u.id === friendId);
    channelName = friend ? (friend.displayName || friend.name) : 'Mensagem Privada';
    channelTopic = friend?.customStatus || 'Início da sua conversa direta.';
  } else if (server) {
    server.categories.forEach((cat) => {
      const ch = cat.channels.find((c) => c.id === activeChannelId);
      if (ch) {
        currentCategoryId = cat.id;
        channelName = ch.name;
        channelTopic = ch.topic || '';
        channelType = ch.type;
      }
    });
  }

  const channelMessages = messages[activeChannelId] || [];
  const pinnedMessages = channelMessages.filter((m) => m.isPinned);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setIsEditingTopic(false);
  }, [activeChannelId]);

  useEffect(() => {
    scrollToBottom();
  }, [channelMessages.length, activeChannelId]);

  useEffect(() => {
    if (!msgContextMenu) return;
    const handleClick = () => setMsgContextMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMsgContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [msgContextMenu]);

  const handleSendMessage = () => {
    if (!inputText.trim() && pendingAttachments.length === 0) return;
    const isPing = inputText.includes('@everyone') || inputText.includes('@here') || inputText.includes('@');
    if (isPing) {
      playNotificationSound('mention');
    }
    sendMessage(
      activeChannelId,
      inputText,
      pendingAttachments.length > 0 ? pendingAttachments : undefined,
      replyingTo || undefined
    );
    setInputText('');
    setReplyingTo(null);
    setPendingAttachments([]);
    inputBarRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartEdit = (msgId: string, currentContent: string) => {
    setEditingMessageId(msgId);
    setEditText(currentContent);
  };

  const handleSaveEdit = (msgId: string) => {
    if (editText.trim()) {
      editMessage(activeChannelId, msgId, editText.trim());
    }
    setEditingMessageId(null);
    setEditText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setPendingAttachments((prev) => [
          ...prev,
          {
            id: `att-${Date.now()}-${i}`,
            name: file.name,
            url,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            type: file.type.startsWith('image/') ? 'image' : 'file',
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setPendingAttachments((prev) => [
          ...prev,
          {
            id: `att-${Date.now()}-${i}`,
            name: file.name,
            url,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            type: file.type.startsWith('image/') ? 'image' : 'file',
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col h-full ${
        isOled ? 'bg-black' : 'bg-[#313338]'
      } select-text min-w-0 relative`}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-[#5865f2]/20 border-2 border-dashed border-[#5865f2] backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none">
          <Paperclip className="w-12 h-12 text-white animate-bounce mb-2" />
          <p className="text-white font-bold text-lg">Solte o arquivo para enviar</p>
          <p className="text-white/80 text-xs">Imagens e documentos serão anexados ao chat</p>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept="image/*,video/*,audio/*,application/*,text/*"
      />

      {/* Channel Top Header */}
      <header
        className={`min-h-12 ${isMobile ? 'pt-safe py-2' : 'h-12'} px-3 sm:px-4 flex items-center justify-between border-b ${
          isOled ? 'bg-black border-[#1a1a1a]' : 'bg-[#313338] border-[#202225]'
        } flex-shrink-0 z-10 select-none shadow-sm`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 -ml-1 mr-0.5 text-[#dbdee1] hover:text-white rounded active:bg-white/10 flex items-center gap-0.5 flex-shrink-0"
              title="Voltar aos canais"
            >
              <ChevronLeft className="w-5 h-5 text-[#949ba4]" />
              <span className="text-xs font-semibold text-[#dbdee1] hidden xs:inline">Canais</span>
            </button>
          )}
          {isDm ? (
            <span className="text-[#80848e] font-bold text-base flex-shrink-0">@</span>
          ) : channelType === 'voice' ? (
            <Volume2 className="w-5 h-5 text-[#23a55a] flex-shrink-0" />
          ) : (
            <Hash className="w-5 h-5 text-[#80848e] flex-shrink-0" />
          )}
          <span className="text-[15px] font-semibold text-white truncate leading-none">
            {channelName}
          </span>

          {isDm ? (
            channelTopic && (
              <>
                <div className="h-4 w-[1px] bg-[#3f4147] mx-2 hidden sm:block" />
                <p className="text-[12px] text-[#949ba4] truncate hidden sm:block max-w-[420px] font-normal">
                  {channelTopic}
                </p>
              </>
            )
          ) : (
            <>
              <div className="h-4 w-[1px] bg-[#3f4147] mx-2 hidden sm:block" />
              {isEditingTopic ? (
                <div className="flex items-center gap-1.5 hidden sm:flex">
                  <input
                    type="text"
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        editChannel(server.id, currentCategoryId, activeChannelId, { topic: topicDraft.trim() });
                        setIsEditingTopic(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingTopic(false);
                      }
                    }}
                    autoFocus
                    placeholder="Adicionar um tópico para o canal..."
                    className="bg-[#1e1f22] text-xs text-white px-2 py-1 rounded border border-[#5865f2] focus:outline-none w-64 shadow-inner"
                  />
                  <button
                    onClick={() => {
                      editChannel(server.id, currentCategoryId, activeChannelId, { topic: topicDraft.trim() });
                      setIsEditingTopic(false);
                    }}
                    className="p-1 text-[#23a55a] hover:text-white hover:bg-[#23a55a] rounded transition-colors cursor-pointer"
                    title="Salvar tópico"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsEditingTopic(false)}
                    className="p-1 text-[#80848e] hover:text-white rounded transition-colors cursor-pointer"
                    title="Cancelar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => {
                    setTopicDraft(channelTopic);
                    setIsEditingTopic(true);
                  }}
                  className="group flex items-center gap-1.5 cursor-pointer max-w-[420px] hidden sm:flex select-none"
                  title="Clique para editar o tópico do canal"
                >
                  <p className="text-[12px] text-[#949ba4] group-hover:text-[#dbdee1] truncate font-normal">
                    {channelTopic || 'Adicionar tópico ao canal...'}
                  </p>
                  <Edit3 className="w-3 h-3 text-[#80848e] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Toolbar */}
        <div className="flex items-center gap-2.5 text-[#b5bac1]">
          {/* DM Call Buttons */}
          {isDm && (
            <>
              <button
                onClick={() => connectToVoice(activeChannelId, channelName, '@me', 'Mensagem Direta')}
                title="Iniciar chamada de voz"
                className="p-1.5 hover:text-[#23a55a] hover:bg-[#35373c] rounded transition-colors cursor-pointer"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={() => connectToVoice(activeChannelId, channelName, '@me', 'Mensagem Direta')}
                title="Iniciar chamada de vídeo"
                className="p-1.5 hover:text-[#23a55a] hover:bg-[#35373c] rounded transition-colors cursor-pointer"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Quick Voice / Screen Share Button */}
          {voiceState.isConnected && (
            <button
              onClick={() => setActiveView('voice-stage')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#23a55a]/15 text-[#23a55a] hover:bg-[#23a55a]/25 text-xs font-semibold transition-colors cursor-pointer"
              title="Abrir transmissão de voz/vídeo"
            >
              <Tv className="w-4 h-4" />
              <span className="hidden md:inline">Ver Transmissão</span>
            </button>
          )}

          <button
            title="Notificações"
            className="p-1 hover:text-[#dbdee1] transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5" />
          </button>

          {/* Pinned Messages Button */}
          <button
            onClick={() => setIsPinnedOpen(!isPinnedOpen)}
            title="Mensagens Fixadas"
            className={`p-1 transition-colors cursor-pointer relative ${
              isPinnedOpen ? 'text-[#5865f2]' : 'hover:text-[#dbdee1]'
            }`}
          >
            <Pin className="w-5 h-5" />
            {pinnedMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#5865f2] rounded-full" />
            )}
          </button>

          {!isDm && (
            <button
              onClick={toggleMemberList}
              title={isMemberListOpen ? 'Ocultar Lista de Membros' : 'Mostrar Lista de Membros'}
              className={`p-1 transition-colors cursor-pointer ${
                isMemberListOpen
                  ? 'text-[#f2f3f5]'
                  : 'text-[#b5bac1] hover:text-[#dbdee1]'
              }`}
            >
              <Users className="w-5 h-5" />
            </button>
          )}

          {/* Search Bar */}
          <div className="relative hidden md:flex items-center">
            <input
              type="text"
              placeholder="Buscar"
              className="w-36 focus:w-60 transition-all duration-200 bg-[#1e1f22] text-xs text-[#dbdee1] placeholder-[#949ba4] px-2 py-1 pr-6 rounded focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
            />
            <Search className="w-3.5 h-3.5 text-[#949ba4] absolute right-2 pointer-events-none" />
          </div>

          <button
            title="Caixa de Entrada"
            className="p-1 hover:text-[#dbdee1] transition-colors cursor-pointer"
          >
            <Inbox className="w-5 h-5" />
          </button>
          <button
            title="Ajuda"
            className="p-1 hover:text-[#dbdee1] transition-colors cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Pinned Messages Popover Panel */}
      {isPinnedOpen && (
        <div className="absolute right-4 top-14 w-96 max-h-96 bg-[#2b2d31] rounded-lg shadow-2xl border border-[#1f2023] z-30 flex flex-col overflow-hidden animate-in fade-in duration-150">
          <div className="p-3 bg-[#1e1f22] border-b border-[#232428] flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
              <Pin className="w-4 h-4 text-[#5865f2]" />
              <span>Mensagens Fixadas ({pinnedMessages.length})</span>
            </div>
            <button
              onClick={() => setIsPinnedOpen(false)}
              className="text-[#949ba4] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {pinnedMessages.length === 0 ? (
              <p className="text-xs text-[#949ba4] text-center py-6">
                Nenhuma mensagem fixada neste canal.
              </p>
            ) : (
              pinnedMessages.map((p) => (
                <div key={p.id} className="p-2.5 bg-[#313338] rounded-md border border-[#35363c]/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-white">
                      {p.author.displayName || p.author.name}
                    </span>
                    <button
                      onClick={() => pinMessage(activeChannelId, p.id)}
                      className="text-[#949ba4] hover:text-[#f23f43] text-[11px] cursor-pointer"
                      title="Desafixar"
                    >
                      Desafixar
                    </button>
                  </div>
                  <DiscordMarkdown content={p.content} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Message Feed Area */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-thin">
        {/* Welcome Banner (Official Discord 1:1) */}
        <div className="pt-4 pb-2 select-none max-w-2xl">
          {/* Big Gray Circle with # or @ */}
          <div className="w-14 h-14 rounded-full bg-[#404249] flex items-center justify-center mb-2.5">
            {isDm ? (
              <span className="text-2xl font-bold text-white">@</span>
            ) : (
              <Hash className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-white leading-tight">
            {isDm ? channelName : `Bem-vindo ao início de #${channelName}!`}
          </h1>
          <p className="text-[14px] text-[#949ba4] mt-1.5 leading-relaxed">
            {isDm
              ? `Este é o começo da história da sua mensagem direta com @${channelName}.`
              : `Este é o começo da história do canal #${channelName}.`}
          </p>
          <div className="h-[1px] bg-[#3f4147]/50 mt-4 mb-2 max-w-2xl" />
        </div>

        {/* Message Items */}
        {channelMessages.map((msg) => {
          const isOwn = msg.author.id === currentUser.id;
          const isEditing = editingMessageId === msg.id;
          const isMentioned = Boolean(
            msg.content?.includes(`@${currentUser.name}`) ||
            (currentUser.displayName && msg.content?.includes(`@${currentUser.displayName}`)) ||
            msg.content?.includes('@everyone') ||
            msg.content?.includes('@here')
          );

          return (
            <div
              key={msg.id}
              onContextMenu={(e) => {
                e.preventDefault();
                setMsgContextMenu({
                  msgId: msg.id,
                  content: msg.content,
                  authorId: msg.author.id,
                  authorName: msg.author.displayName || msg.author.name,
                  position: { x: e.clientX, y: e.clientY },
                });
              }}
              className={`group flex flex-col -mx-4 px-4 py-1 transition-colors relative ${
                isMentioned
                  ? 'bg-[#faa61a]/10 hover:bg-[#faa61a]/15 border-l-2 border-[#faa61a]'
                  : msg.isPinned
                  ? 'bg-[#5865f2]/5 border-l-2 border-[#5865f2] hover:bg-[#2e3035]/40'
                  : 'hover:bg-[#2e3035]/40'
              }`}
            >
              {/* Replying To Header */}
              {msg.replyTo && (
                <div className="flex items-center gap-1.5 text-xs text-[#b5bac1] mb-0.5 font-medium pl-10 relative">
                  <div className="absolute left-3 top-2 w-5 h-2.5 border-l-2 border-t-2 border-[#4e5058] rounded-tl" />
                  <span className="text-[#949ba4]">Respondendo a</span>
                  <span className="text-[#5865f2] font-semibold">@{msg.replyTo.author}:</span>
                  <span className="text-[#80848e] truncate max-w-sm italic">{msg.replyTo.content}</span>
                </div>
              )}

              <div className="flex gap-3.5">
                {/* Avatar with Popout Trigger & User Context Menu */}
                <img
                  src={getAvatarUrl(msg.author.avatar)}
                  alt={msg.author.name}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    openMemberPopout(msg.author, { top: rect.top, right: window.innerWidth - rect.left + 10 });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    openMemberPopout(msg.author, { top: rect.top, right: window.innerWidth - rect.left + 10 });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setUserContextMenu({
                      user: msg.author,
                      position: { x: e.clientX, y: e.clientY },
                    });
                  }}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 cursor-pointer hover:opacity-90 mt-0.5"
                />

                {/* Message Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 leading-none">
                    <span
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        openMemberPopout(msg.author, { top: rect.top, right: window.innerWidth - rect.left + 10 });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        openMemberPopout(msg.author, { top: rect.top, right: window.innerWidth - rect.left + 10 });
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setUserContextMenu({
                          user: msg.author,
                          position: { x: e.clientX, y: e.clientY },
                        });
                      }}
                      className="font-semibold text-sm hover:underline cursor-pointer"
                      style={{ color: getUserRoleColor(msg.author.id) }}
                    >
                      {msg.author.displayName || msg.author.name}
                    </span>

                    {/* Tag Oficial do Servidor (com badge customizada ou pré-definida e suporte a hex livre) */}
                    {!isDm && server?.serverTag && (() => {
                      const tagColor = resolveServerTagColor(server.serverTagColor);
                      const tagBadgeIcon = resolveServerTagBadgeIcon(server.serverTagBadge, server.serverTagBadgeImage);
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm select-none leading-none"
                          title={`Tag oficial: ${server.serverTag}`}
                          style={{
                            backgroundColor: `${tagColor.hex}25`,
                            color: tagColor.hex,
                            border: `1px solid ${tagColor.hex}50`,
                          }}
                        >
                          <img
                            src={tagBadgeIcon}
                            alt="Tag"
                            className="w-4 h-4 object-contain rounded-sm flex-shrink-0"
                            style={{ imageRendering: 'pixelated' }}
                          />
                          <span className="leading-none">{server.serverTag}</span>
                        </span>
                      );
                    })()}

                    {msg.author.isBot && (
                      <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1 rounded uppercase">
                        BOT
                      </span>
                    )}

                    <span className="text-[11px] text-[#949ba4]">
                      {msg.timestamp}
                    </span>

                    {msg.isPinned && (
                      <span title="Mensagem Fixada">
                        <Pin className="w-3 h-3 text-[#5865f2]" />
                      </span>
                    )}

                    {(msg.isEdited || msg.edited) && (
                      <span className="text-[10px] text-[#80848e]">(editado)</span>
                    )}
                  </div>

                  {/* Content or Edit Form */}
                  {isEditing ? (
                    <div className="mt-1 space-y-1">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(msg.id);
                          if (e.key === 'Escape') setEditingMessageId(null);
                        }}
                        autoFocus
                        className="w-full bg-[#1e1f22] text-sm text-[#f2f3f5] p-2 rounded border border-[#5865f2] outline-none"
                      />
                      <span className="text-[11px] text-[#949ba4] block">
                        escape para <button onClick={() => setEditingMessageId(null)} className="text-[#5865f2] hover:underline cursor-pointer">cancelar</button> • enter para <button onClick={() => handleSaveEdit(msg.id)} className="text-[#5865f2] hover:underline cursor-pointer">salvar</button>
                      </span>
                    </div>
                  ) : (
                    <div className="text-[14px] text-[#dbdee1] leading-[1.375rem] break-words mt-0.5">
                      <DiscordMarkdown content={msg.content} />
                    </div>
                  )}

                  {/* Message Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map((att, idx) => {
                        const isSticker =
                          att.type === 'sticker' ||
                          att.id?.startsWith('sticker-') ||
                          att.name?.toLowerCase().includes('figurinha') ||
                          att.url.includes('Stickers_3D');

                        if (isSticker) {
                          return (
                            <div key={att.id || idx} className="py-1">
                              <img
                                src={att.url}
                                alt={att.name || 'Figurinha'}
                                title={att.name || 'Figurinha'}
                                className="w-32 h-32 max-w-[128px] max-h-[128px] object-contain drop-shadow-md select-none transition-transform hover:scale-105 duration-150 cursor-pointer"
                              />
                            </div>
                          );
                        }

                        return (
                          <div key={att.id || idx}>
                            {att.type === 'image' || att.url.startsWith('data:image/') || att.url.includes('unsplash') ? (
                              <img
                                src={att.url}
                                alt={att.name}
                                className="max-w-md max-h-80 rounded-lg object-contain border border-[#232428] shadow"
                              />
                            ) : (
                              <div className="p-3 bg-[#2b2d31] rounded-lg border border-[#1f2023] inline-flex items-center gap-2 text-xs">
                                <Paperclip className="w-4 h-4 text-[#5865f2]" />
                                <span className="text-white font-medium">{att.name}</span>
                                {att.size && <span className="text-[#949ba4]">({att.size})</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Discord Rich Embed (if present) */}
                  {msg.embed && (
                    <div className="mt-2 max-w-xl bg-[#2b2d31] border-l-4 border-[#5865f2] rounded-r p-4 text-xs space-y-2">
                      {msg.embed.author && (
                        <div className="flex items-center gap-2">
                          {msg.embed.author.iconUrl && (
                            <img
                              src={msg.embed.author.iconUrl}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          )}
                          <span className="font-semibold text-[#dbdee1]">
                            {msg.embed.author.name}
                          </span>
                        </div>
                      )}

                      {msg.embed.title && (
                        <h4 className="font-bold text-sm text-white hover:underline cursor-pointer">
                          {msg.embed.title}
                        </h4>
                      )}

                      {msg.embed.description && (
                        <p className="text-[#949ba4] leading-relaxed">
                          {msg.embed.description}
                        </p>
                      )}

                      {msg.embed.fields && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#35363c]">
                          {msg.embed.fields.map((f, i) => (
                            <div key={i} className="flex flex-col">
                              <span className="font-bold text-[11px] text-[#dbdee1]">
                                {f.name}
                              </span>
                              <span className="text-[#949ba4]">{f.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.embed.footer && (
                        <div className="flex items-center gap-2 pt-2 text-[10px] text-[#80848e]">
                          {msg.embed.footer.iconUrl && (
                            <img
                              src={msg.embed.footer.iconUrl}
                              alt=""
                              className="w-4 h-4 rounded-full"
                            />
                          )}
                          <span>{msg.embed.footer.text}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reactions */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.reactions.map((react, i) => (
                        <button
                          key={i}
                          onClick={() => toggleReaction(activeChannelId, msg.id, react.emoji)}
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                            react.me
                              ? 'bg-[#5865f2]/20 border border-[#5865f2] text-[#f2f3f5]'
                              : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#b5bac1]'
                          }`}
                        >
                          <span>{react.emoji}</span>
                          <span className="font-semibold text-[11px]">{react.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hover Floating Action Bar */}
                <div className="absolute right-4 -top-3.5 hidden group-hover:flex items-center bg-[#313338] border border-[#232428] shadow-md rounded-md px-1 py-0.5 text-[#b5bac1] space-x-0.5 z-20">
                  <button
                    onClick={() => toggleReaction(activeChannelId, msg.id, '❤️')}
                    className="p-1 hover:text-white hover:bg-[#35373c] rounded text-xs cursor-pointer"
                    title="Reagir com ❤️"
                  >
                    ❤️
                  </button>
                  <button
                    onClick={() => toggleReaction(activeChannelId, msg.id, '👍')}
                    className="p-1 hover:text-white hover:bg-[#35373c] rounded text-xs cursor-pointer"
                    title="Reagir com 👍"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => toggleReaction(activeChannelId, msg.id, '🔥')}
                    className="p-1 hover:text-white hover:bg-[#35373c] rounded text-xs cursor-pointer"
                    title="Reagir com 🔥"
                  >
                    🔥
                  </button>
                  <button
                    onClick={() =>
                      setReplyingTo({
                        id: msg.id,
                        author: msg.author.displayName || msg.author.name,
                        content: msg.content,
                      })
                    }
                    className="p-1 hover:text-white hover:bg-[#35373c] rounded text-xs cursor-pointer"
                    title="Responder"
                  >
                    <CornerUpLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => pinMessage(activeChannelId, msg.id)}
                    className="p-1 hover:text-white hover:bg-[#35373c] rounded text-xs cursor-pointer"
                    title={msg.isPinned ? 'Desafixar' : 'Fixar'}
                  >
                    <Pin className={`w-4 h-4 ${msg.isPinned ? 'text-[#5865f2]' : ''}`} />
                  </button>
                  {(isOwn || currentUser.id === 'user-me') && (
                    <button
                      onClick={() => handleStartEdit(msg.id, msg.content)}
                      className="p-1 hover:text-white hover:bg-[#35373c] rounded text-xs cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  {(isOwn || currentUser.id === 'user-me') && (
                    <button
                      onClick={() => deleteMessage(activeChannelId, msg.id)}
                      className="p-1 hover:text-[#f23f43] hover:bg-[#35373c] rounded text-xs cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Typing Input Bar */}
      <div className="mx-2 sm:mx-6 mb-2 sm:mb-6 pb-safe select-none flex-shrink-0 relative">
        {/* Reply Preview Banner */}
        {replyingTo && (
          <div className="bg-[#2b2d31] rounded-t-lg px-4 py-1.5 flex items-center justify-between text-xs border-b border-[#232428]">
            <div className="flex items-center gap-1.5 truncate">
              <CornerUpLeft className="w-4 h-4 text-[#5865f2]" />
              <span className="text-[#949ba4]">Respondendo a</span>
              <span className="text-white font-semibold">@{replyingTo.author}</span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-[#949ba4] hover:text-white cursor-pointer"
              title="Cancelar resposta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attachment Preview Chips */}
        {pendingAttachments.length > 0 && (
          <div className="bg-[#2b2d31] px-4 py-2 flex items-center gap-3 overflow-x-auto border-b border-[#232428]">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className="relative bg-[#1e1f22] p-1.5 rounded-md flex items-center gap-2 group flex-shrink-0"
              >
                {att.type === 'image' || att.url.startsWith('data:image/') ? (
                  <img src={att.url} alt={att.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <Paperclip className="w-6 h-6 text-[#5865f2] p-1" />
                )}
                <div className="flex flex-col text-[11px] max-w-[120px] truncate">
                  <span className="text-white font-medium truncate">{att.name}</span>
                  {att.size && <span className="text-[#80848e]">{att.size}</span>}
                </div>
                <button
                  onClick={() =>
                    setPendingAttachments((prev) => prev.filter((p) => p.id !== att.id))
                  }
                  className="p-1 rounded-full bg-[#f23f43] text-white hover:opacity-90 cursor-pointer"
                  title="Remover anexo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Input Container */}
        <div
          className={`${
            isOled ? 'bg-[#111214]' : 'bg-[#383a40]'
          } px-3.5 py-2 min-h-[44px] flex items-center gap-2.5 border border-transparent focus-within:border-white/10 transition-colors ${
            replyingTo || pendingAttachments.length > 0 ? 'rounded-b-lg' : 'rounded-lg'
          }`}
        >
          {/* Attach Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Enviar anexo ou arquivo"
            className="text-[#b5bac1] hover:text-[#dbdee1] p-1 bg-[#4e5058]/50 hover:bg-[#4e5058] rounded-full transition-colors cursor-pointer flex-shrink-0"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <input
            ref={inputBarRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Conversar em #${channelName}`}
            className="flex-1 bg-transparent !border-0 !outline-none !shadow-none !ring-0 !p-0 text-base sm:text-[14px] leading-5 text-[#f2f3f5] placeholder-[#80848e] select-text py-0.5"
          />

          {/* Action Icons Right */}
          <div className="flex items-center gap-1.5 text-[#b5bac1] relative flex-shrink-0">
            <button
              title="Comprar presentes Ultra Pass"
              className="p-1 hover:text-[#dbdee1] transition-colors cursor-pointer"
            >
              <Gift className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setEmojiPickerTab('gif');
                setIsEmojiPickerOpen(true);
              }}
              title="Abrir seletor de GIF"
              className="p-1 hover:text-[#dbdee1] transition-colors cursor-pointer"
            >
              <Film className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setEmojiPickerTab('sticker');
                setIsEmojiPickerOpen(true);
              }}
              title="Figurinhas 3D"
              className="p-1 hover:text-[#8B5CF6] transition-colors cursor-pointer"
            >
              <Sticker className="w-5 h-5 text-[#8B5CF6]" />
            </button>
            <button
              onClick={() => {
                setEmojiPickerTab('emoji');
                setIsEmojiPickerOpen(!isEmojiPickerOpen);
              }}
              title="Inserir Emoji"
              className={`p-1 transition-colors cursor-pointer ${
                isEmojiPickerOpen ? 'text-[#f2f3f5]' : 'hover:text-[#dbdee1]'
              }`}
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Direct Send Button */}
            {(inputText.trim() || pendingAttachments.length > 0) && (
              <button
                onClick={handleSendMessage}
                className="p-1 text-[#8B5CF6] hover:text-[#7c3aed] transition-colors cursor-pointer"
                title="Enviar mensagem"
              >
                <SendHorizontal className="w-5 h-5" />
              </button>
            )}

            {/* Discord Emoji, Sticker & GIF Picker Popover */}
            <DiscordEmojiPicker
              isOpen={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
              initialTab={emojiPickerTab}
              onSelectEmoji={(emoji) => {
                setInputText((prev) => prev + emoji);
              }}
              onSelectSticker={(stickerUrl, stickerName) => {
                sendMessage(activeChannelId, '', [{
                  id: `sticker-${Date.now()}`,
                  name: stickerName || 'Figurinha',
                  url: stickerUrl,
                  type: 'sticker',
                }]);
                setIsEmojiPickerOpen(false);
              }}
              onSelectGif={(gifUrl) => {
                sendMessage(activeChannelId, '', [{
                  id: `gif-${Date.now()}`,
                  name: 'GIF',
                  url: gifUrl,
                  type: 'image',
                }]);
                setIsEmojiPickerOpen(false);
              }}
            />
          </div>
        </div>
      </div>

      {/* Message Right-Click Context Menu */}
      {msgContextMenu && (
        <div
          className="fixed bg-[#111214] border border-[#28292d] rounded-[4px] p-1 shadow-2xl z-[9999] min-w-[200px]"
          style={{
            top: Math.min(msgContextMenu.position.y, window.innerHeight - 240),
            left: Math.min(msgContextMenu.position.x, window.innerWidth - 220),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Reaction shortcut bar */}
          <div className="flex items-center justify-around px-2 py-1.5 bg-[#1e1f22] rounded mb-1 text-sm">
            {['❤️', '👍', '🔥', '😂', '🎉'].map((em) => (
              <button
                key={em}
                onClick={() => {
                  toggleReaction(activeChannelId, msgContextMenu.msgId, em);
                  setMsgContextMenu(null);
                }}
                className="hover:scale-125 transition-transform p-1 cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>
          <div className="h-[1px] bg-[#232428] mb-1" />

          <button
            onClick={() => {
              setReplyingTo({
                id: msgContextMenu.msgId,
                author: msgContextMenu.authorName,
                content: msgContextMenu.content,
              });
              setMsgContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer"
          >
            <CornerUpLeft className="w-4 h-4 flex-shrink-0" />
            <span>Responder</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(msgContextMenu.content).catch(() => {});
              setMsgContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer"
          >
            <Copy className="w-4 h-4 flex-shrink-0" />
            <span>Copiar texto</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(msgContextMenu.msgId).catch(() => {});
              setMsgContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer"
          >
            <Copy className="w-4 h-4 flex-shrink-0 opacity-70" />
            <span>Copiar ID da mensagem</span>
          </button>

          <button
            onClick={() => {
              pinMessage(activeChannelId, msgContextMenu.msgId);
              setMsgContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer"
          >
            <Pin className="w-4 h-4 flex-shrink-0" />
            <span>Fixar mensagem</span>
          </button>

          {/* Edit own message */}
          {(msgContextMenu.authorId === currentUser.id || currentUser.id === 'user-me') && (
            <>
              <div className="h-[1px] bg-[#232428] my-1" />
              <button
                onClick={() => {
                  handleStartEdit(msgContextMenu.msgId, msgContextMenu.content);
                  setMsgContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer"
              >
                <Edit3 className="w-4 h-4 flex-shrink-0" />
                <span>Editar mensagem</span>
              </button>
            </>
          )}

          {/* Delete message (own message OR moderator/admin permission) */}
          {(msgContextMenu.authorId === currentUser.id || currentUser.id === 'user-me' || canUserModerate(currentUser.id).canKick || canUserModerate(currentUser.id).isAdmin) && (
            <button
              onClick={() => {
                deleteMessage(activeChannelId, msgContextMenu.msgId);
                setMsgContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-sm font-medium text-[#f23f43] hover:bg-[#f23f43] hover:text-white transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              <span>Excluir mensagem</span>
            </button>
          )}
        </div>
      )}

      {/* User Context Menu from Chat */}
      {userContextMenu && (
        <DiscordUserContextMenu
          user={userContextMenu.user}
          position={userContextMenu.position}
          context="chat"
          onClose={() => setUserContextMenu(null)}
          onOpenProfile={(u) => {
            openMemberPopout(u, {
              top: userContextMenu.position.y,
              right: window.innerWidth - userContextMenu.position.x,
            });
          }}
          onMentionUser={(u) => {
            if (inputBarRef.current) {
              setInputText((prev) => (prev ? `${prev} @${u.name} ` : `@${u.name} `));
              inputBarRef.current.focus();
            }
          }}
        />
      )}
    </div>
  );
};
