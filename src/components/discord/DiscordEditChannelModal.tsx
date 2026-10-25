import React, { useState, useEffect } from 'react';
import {
  Hash,
  Volume2,
  Megaphone,
  MessagesSquare,
  Lock,
  Trash2,
  X,
  Shield,
  Check,
  Radio,
  Sliders,
  Copy,
  Plus,
  Webhook,
  Bot,
  AlertTriangle,
  Link as LinkIcon,
  CheckCircle2,
  Tv,
  Search,
} from 'lucide-react';
import { Channel, Role, PermissionOverrideState, ChannelPermissionOverride } from '../../types/discord';
import { useDiscord } from '../../store/discordStore';

interface Props {
  isOpen: boolean;
  channel: Channel;
  categoryId: string;
  serverId: string;
  onClose: () => void;
  onDeleteRequest: () => void;
}

type TabType = 'overview' | 'permissions' | 'invites' | 'integrations';

const SLOWMODE_OPTIONS = [
  { value: 0, label: 'Desativado' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
  { value: 300, label: '5m' },
  { value: 600, label: '10m' },
  { value: 900, label: '15m' },
  { value: 1800, label: '30m' },
  { value: 3600, label: '1h' },
  { value: 7200, label: '2h' },
  { value: 21600, label: '6h' },
];

const ThreeStateToggle: React.FC<{
  label: string;
  description: string;
  value: PermissionOverrideState;
  onChange: (val: PermissionOverrideState) => void;
}> = ({ label, description, value, onChange }) => (
  <div className="flex items-center justify-between p-3.5 bg-[#1e1f22]/60 border border-[#2b2d31]/70 rounded-xl">
    <div className="min-w-0 pr-4">
      <span className="text-xs font-bold text-white block">{label}</span>
      <p className="text-[11px] text-[#949ba4] mt-0.5 leading-relaxed">{description}</p>
    </div>
    <div className="flex items-center bg-[#111214] p-1 rounded-lg border border-[#232428] flex-shrink-0 select-none gap-0.5">
      {/* Deny (Red X) */}
      <button
        type="button"
        onClick={() => onChange('deny')}
        title="Negar permissão (✗)"
        className={`w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer ${
          value === 'deny'
            ? 'bg-[#da373c] text-white shadow-sm font-bold'
            : 'text-[#949ba4] hover:text-[#da373c] hover:bg-[#35373c]/40'
        }`}
      >
        <X className="w-4 h-4 stroke-[2.5]" />
      </button>

      {/* Inherit (Neutral /) */}
      <button
        type="button"
        onClick={() => onChange('inherit')}
        title="Herdar do cargo / categoria (/)"
        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-mono font-bold transition-all cursor-pointer ${
          value === 'inherit'
            ? 'bg-[#4e5058] text-white shadow-sm'
            : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]/40'
        }`}
      >
        /
      </button>

      {/* Allow (Green Check) */}
      <button
        type="button"
        onClick={() => onChange('allow')}
        title="Permitir permissão (✓)"
        className={`w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer ${
          value === 'allow'
            ? 'bg-[#23a55a] text-white shadow-sm font-bold'
            : 'text-[#949ba4] hover:text-[#23a55a] hover:bg-[#35373c]/40'
        }`}
      >
        <Check className="w-4 h-4 stroke-[3]" />
      </button>
    </div>
  </div>
);

export const DiscordEditChannelModal: React.FC<Props> = ({
  isOpen,
  channel,
  categoryId,
  serverId,
  onClose,
  onDeleteRequest,
}) => {
  const { editChannel, roles } = useDiscord();

  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Form states
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic || '');
  const [slowmode, setSlowmode] = useState(channel.slowmode || 0);
  const [isNsfw, setIsNsfw] = useState(Boolean(channel.isNsfw));
  const [bitrate, setBitrate] = useState(channel.bitrate || 64);
  const [userLimit, setUserLimit] = useState(channel.userLimit || 0);
  const [videoQuality, setVideoQuality] = useState(channel.videoQuality || 'auto');

  // Permissions state
  const [isPrivate, setIsPrivate] = useState(Boolean(channel.isPrivate));
  const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>(
    channel.allowedRoleIds || ['role-admin', 'role-mod']
  );
  const [selectedRoleIdForPerms, setSelectedRoleIdForPerms] = useState<string>('role-everyone');
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [permissionOverrides, setPermissionOverrides] = useState<
    Record<string, ChannelPermissionOverride>
  >(channel.permissionOverrides || {});

  // Mock Invites & Webhooks State
  const [invites, setInvites] = useState([
    { code: 'capychat-oficial', creator: 'Você', uses: 48, expires: 'Nunca' },
    { code: 'ch-' + channel.name.slice(0, 6), creator: 'Coronel', uses: 12, expires: '7 dias' },
  ]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState([
    { id: 'wh-1', name: 'GitHub Alerts', avatar: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=100&auto=format&fit=crop&q=80' },
  ]);

  // Sincronizar estado local ao abrir canal
  useEffect(() => {
    setName(channel.name);
    setTopic(channel.topic || '');
    setSlowmode(channel.slowmode || 0);
    setIsNsfw(Boolean(channel.isNsfw));
    setBitrate(channel.bitrate || 64);
    setUserLimit(channel.userLimit || 0);
    setVideoQuality(channel.videoQuality || 'auto');
    setIsPrivate(Boolean(channel.isPrivate));
    setAllowedRoleIds(channel.allowedRoleIds || ['role-admin', 'role-mod']);
    setPermissionOverrides(channel.permissionOverrides || {});
    setRoleSearchQuery('');
    setActiveTab('overview');
  }, [channel, isOpen]);

  // ESC Listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isVoice = channel.type === 'voice';

  // Verificar se há alterações não salvas
  const hasChanges =
    name !== channel.name ||
    topic !== (channel.topic || '') ||
    slowmode !== (channel.slowmode || 0) ||
    isNsfw !== Boolean(channel.isNsfw) ||
    bitrate !== (channel.bitrate || 64) ||
    userLimit !== (channel.userLimit || 0) ||
    videoQuality !== (channel.videoQuality || 'auto') ||
    isPrivate !== Boolean(channel.isPrivate) ||
    JSON.stringify(allowedRoleIds) !== JSON.stringify(channel.allowedRoleIds || ['role-admin', 'role-mod']) ||
    JSON.stringify(permissionOverrides) !== JSON.stringify(channel.permissionOverrides || {});

  const handleReset = () => {
    setName(channel.name);
    setTopic(channel.topic || '');
    setSlowmode(channel.slowmode || 0);
    setIsNsfw(Boolean(channel.isNsfw));
    setBitrate(channel.bitrate || 64);
    setUserLimit(channel.userLimit || 0);
    setVideoQuality(channel.videoQuality || 'auto');
    setIsPrivate(Boolean(channel.isPrivate));
    setAllowedRoleIds(channel.allowedRoleIds || ['role-admin', 'role-mod']);
    setPermissionOverrides(channel.permissionOverrides || {});
  };

  const handleSave = () => {
    const finalName = name.trim() || channel.name;
    editChannel(serverId, categoryId, channel.id, {
      name: finalName,
      topic: topic.trim(),
      slowmode,
      isNsfw,
      bitrate,
      userLimit,
      videoQuality,
      isPrivate,
      allowedRoleIds,
      permissionOverrides,
    });
    onClose();
  };

  const handleNameInput = (val: string) => {
    if (isVoice) {
      setName(val);
    } else {
      setName(val.toLowerCase().replace(/\s+/g, '-'));
    }
  };

  const toggleRole = (roleId: string) => {
    setAllowedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const copyInvite = (code: string) => {
    navigator.clipboard.writeText(`https://capy.ofc/invite/${code}`).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Container Principal Estilo Overlay Discord */}
      <div className="w-full h-full max-w-6xl max-h-[92vh] bg-[#313338] border border-[#232428] rounded-xl shadow-2xl flex overflow-hidden relative">
        {/* ── 1. SIDEBAR ESQUERDA DE CONFIGURAÇÕES DO CANAL ──────────────── */}
        <div className="w-60 bg-[#2b2d31] p-6 pr-3 flex flex-col justify-between border-r border-[#202225] select-none flex-shrink-0">
          <div className="space-y-4 overflow-y-auto pr-2 scrollbar-thin">
            {/* Cabeçalho do Canal */}
            <div className="px-2">
              <div className="flex items-center gap-1.5 text-[#949ba4] text-xs font-bold uppercase tracking-wider truncate mb-1">
                {isVoice ? <Volume2 className="w-3.5 h-3.5 flex-shrink-0" /> : <Hash className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{channel.name}</span>
              </div>
              <span className="text-[10px] text-[#80848e] font-semibold uppercase tracking-wider">
                {isVoice ? 'Canal de Voz' : 'Canal de Texto'}
              </span>
            </div>

            <div className="h-[1px] bg-[#3f4147]/40 mx-2" />

            {/* Menu de Abas */}
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center px-2.5 py-2 rounded font-medium text-xs text-left transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-[#404249] text-white font-semibold'
                    : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                }`}
              >
                <span>Visão geral</span>
              </button>

              <button
                onClick={() => setActiveTab('permissions')}
                className={`w-full flex items-center px-2.5 py-2 rounded font-medium text-xs text-left transition-colors cursor-pointer ${
                  activeTab === 'permissions'
                    ? 'bg-[#404249] text-white font-semibold'
                    : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                }`}
              >
                <span>Permissões</span>
              </button>

              <button
                onClick={() => setActiveTab('invites')}
                className={`w-full flex items-center px-2.5 py-2 rounded font-medium text-xs text-left transition-colors cursor-pointer ${
                  activeTab === 'invites'
                    ? 'bg-[#404249] text-white font-semibold'
                    : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                }`}
              >
                <span>Convites</span>
              </button>

              <button
                onClick={() => setActiveTab('integrations')}
                className={`w-full flex items-center px-2.5 py-2 rounded font-medium text-xs text-left transition-colors cursor-pointer ${
                  activeTab === 'integrations'
                    ? 'bg-[#404249] text-white font-semibold'
                    : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                }`}
              >
                <span>Integrações</span>
              </button>
            </div>
          </div>

          {/* Rodapé da Sidebar: Excluir Canal */}
          <div className="pt-3 border-t border-[#3f4147]/40 px-1">
            <button
              onClick={() => {
                onClose();
                onDeleteRequest();
              }}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-semibold text-[#f23f43] hover:bg-[#f23f43]/15 transition-colors cursor-pointer group"
            >
              <span>Excluir canal</span>
              <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* ── 2. ÁREA PRINCIPAL DE CONTEÚDO COM BOTÃO ESC ──────────────── */}
        <div className="flex-1 px-10 py-10 overflow-y-auto relative scrollbar-thin">
          {/* Botão ESC flutuante no canto superior direito */}
          <div className="absolute top-8 right-8 flex flex-col items-center select-none z-10">
            <button
              onClick={onClose}
              title="Fechar (Esc)"
              className="w-9 h-9 rounded-full border-2 border-[#b5bac1] flex items-center justify-center text-[#b5bac1] hover:bg-[#b5bac1]/15 hover:text-white hover:border-white transition-colors cursor-pointer group"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            </button>
            <span className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider mt-1.5 group-hover:text-white">
              ESC
            </span>
          </div>

          {/* Conteúdo Dinâmico por Aba */}
          <div className="max-w-xl pb-20">
            {/* ─── ABA 1: VISÃO GERAL ──────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Visão Geral</h2>
                  <p className="text-xs text-[#949ba4]">
                    Configure as preferências essenciais de identificação e fluxo de mensagens deste canal.
                  </p>
                </div>

                {/* 1. Nome do Canal */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                    Nome do Canal
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-[#949ba4]">
                      {isVoice ? <Volume2 className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameInput(e.target.value)}
                      maxLength={100}
                      placeholder="nome-do-canal"
                      className="w-full bg-[#1e1f22] border border-[#202225] rounded p-2.5 pl-9 text-sm text-white placeholder-[#80848e] focus:border-[#5865f2] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* 2. Tópico do Canal (Apenas Texto/Anúncios/Fórum) */}
                {!isVoice && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                      Tópico do Canal
                    </label>
                    <textarea
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      maxLength={1024}
                      rows={3}
                      placeholder="Conte aos membros sobre o propósito deste canal..."
                      className="w-full bg-[#1e1f22] border border-[#202225] rounded p-2.5 text-sm text-white placeholder-[#80848e] focus:border-[#5865f2] focus:outline-none resize-none transition-colors scrollbar-thin"
                    />
                  </div>
                )}

                <div className="h-[1px] bg-[#3f4147]/40" />

                {/* 3. Modo Lento (Slowmode para canais de texto) */}
                {!isVoice && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                          Modo Lento
                        </label>
                        <p className="text-xs text-[#949ba4] mt-0.5">
                          Membros ficarão restritos a enviar uma mensagem por intervalo de tempo.
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold text-white bg-[#1e1f22] px-2.5 py-1 rounded border border-[#2b2d31]">
                        {SLOWMODE_OPTIONS.find((o) => o.value === slowmode)?.label || 'Desativado'}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={SLOWMODE_OPTIONS.length - 1}
                      value={Math.max(
                        0,
                        SLOWMODE_OPTIONS.findIndex((o) => o.value >= slowmode)
                      )}
                      onChange={(e) => {
                        const opt = SLOWMODE_OPTIONS[Number(e.target.value)];
                        if (opt) setSlowmode(opt.value);
                      }}
                      className="w-full h-1.5 bg-[#1e1f22] accent-[#5865f2] rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#80848e] font-mono">
                      <span>Desativado</span>
                      <span>1m</span>
                      <span>6h</span>
                    </div>
                  </div>
                )}

                {/* 4. Restrição de Idade (Canal NSFW para texto) */}
                {!isVoice && (
                  <div className="p-3.5 bg-[#1e1f22]/60 border border-[#2b2d31]/60 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-white block">
                        Canal com restrição de idade (NSFW)
                      </span>
                      <p className="text-xs text-[#949ba4] mt-0.5 max-w-md leading-relaxed">
                        Usuários devem confirmar que possuem 18 anos ou mais para visualizar este canal.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNsfw(!isNsfw)}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer flex-shrink-0 ${
                        isNsfw ? 'bg-[#5865f2]' : 'bg-[#4e5058]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-white block transition-transform shadow-md ${
                          isNsfw ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {/* 5. Configurações Exclusivas para Canais de Voz */}
                {isVoice && (
                  <div className="space-y-6">
                    {/* Taxa de bits */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                            Taxa de Bits
                          </label>
                          <p className="text-xs text-[#949ba4] mt-0.5">
                            Valores mais altos aumentam a fidelidade de áudio, mas consomem mais largura de banda.
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-white bg-[#1e1f22] px-2.5 py-1 rounded border border-[#2b2d31]">
                          {bitrate} kbps
                        </span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={128}
                        step={8}
                        value={bitrate}
                        onChange={(e) => setBitrate(Number(e.target.value))}
                        className="w-full h-1.5 bg-[#1e1f22] accent-[#5865f2] rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-[#80848e] font-mono">
                        <span>8 kbps</span>
                        <span>64 kbps (Padrão)</span>
                        <span>128 kbps</span>
                      </div>
                    </div>

                    <div className="h-[1px] bg-[#3f4147]/40" />

                    {/* Limite de Usuários */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                            Limite de Usuários
                          </label>
                          <p className="text-xs text-[#949ba4] mt-0.5">
                            Restringe a quantidade máxima de participantes conectados simultaneamente.
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-white bg-[#1e1f22] px-2.5 py-1 rounded border border-[#2b2d31]">
                          {userLimit === 0 ? 'Sem limite' : `${userLimit} usuários`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={99}
                        value={userLimit}
                        onChange={(e) => setUserLimit(Number(e.target.value))}
                        className="w-full h-1.5 bg-[#1e1f22] accent-[#5865f2] rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-[#80848e] font-mono">
                        <span>Sem limite</span>
                        <span>50</span>
                        <span>99</span>
                      </div>
                    </div>

                    <div className="h-[1px] bg-[#3f4147]/40" />

                    {/* Qualidade de Vídeo */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                          Qualidade de Vídeo
                        </label>
                        <p className="text-xs text-[#949ba4] mt-0.5">
                          Define a resolução de captura de câmera e transmissões de tela nesta sala.
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'auto', label: 'Automático', sub: 'Otimiza conforme a rede' },
                          { id: '720p', label: '720p (60fps)', sub: 'Fluidez e boa qualidade' },
                          { id: '1080p', label: '1080p (HQ)', sub: 'Máxima nitidez e detalhes' },
                        ].map((opt) => (
                          <div
                            key={opt.id}
                            onClick={() => setVideoQuality(opt.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              videoQuality === opt.id
                                ? 'bg-[#2b2d31] border-[#5865f2] shadow-sm'
                                : 'bg-[#1e1f22]/70 border-[#2b2d31]/60 hover:bg-[#2b2d31]/40'
                            }`}
                          >
                            <span className="text-xs font-bold text-white block">{opt.label}</span>
                            <span className="text-[10px] text-[#949ba4] mt-1 block leading-tight">{opt.sub}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── ABA 2: PERMISSÕES ───────────────────────────────────── */}
            {activeTab === 'permissions' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Permissões do Canal</h2>
                  <p className="text-xs text-[#949ba4]">
                    Controle quem pode visualizar, enviar mensagens ou participar deste canal.
                  </p>
                </div>

                {/* Alternador de Canal Privado */}
                <div className="p-4 bg-[#1e1f22]/70 border border-[#2b2d31] rounded-xl flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2b2d31] flex items-center justify-center flex-shrink-0 text-[#5865f2]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Canal Privado</span>
                      <p className="text-xs text-[#949ba4] mt-0.5 leading-relaxed max-w-md">
                        Apenas os membros e cargos selecionados poderão ver este canal na lista e acessar seu conteúdo.
                      </p>
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

                {/* 2. Sobrescrever Permissões por Cargo (Discord 3-State Overrides) */}
                <div className="space-y-4 pt-2 border-t border-[#3f4147]/40">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                      Permissões Avançadas por Cargo
                    </h3>
                    <p className="text-xs text-[#949ba4] mt-0.5">
                      Defina permissões personalizadas (Permitir ✓, Herdar / ou Negar ✗) para cada cargo neste canal.
                    </p>
                  </div>

                  {/* Seleção do Cargo ativo para editar permissões */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {roles.map((r) => {
                      const isSelected = selectedRoleIdForPerms === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRoleIdForPerms(r.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-[#5865f2] text-white shadow-sm'
                              : 'bg-[#1e1f22] text-[#dbdee1] hover:bg-[#35373c]'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: r.color }}
                          />
                          <span>{r.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Os 3 Seletores de 3 Estados */}
                  <div className="space-y-2.5">
                    <ThreeStateToggle
                      label="Ver Canal"
                      description="Permite que os membros com este cargo visualizem este canal na lista e acessem suas mensagens."
                      value={permissionOverrides[selectedRoleIdForPerms]?.viewChannel || 'inherit'}
                      onChange={(val) => {
                        setPermissionOverrides((prev) => ({
                          ...prev,
                          [selectedRoleIdForPerms]: {
                            ...prev[selectedRoleIdForPerms],
                            roleId: selectedRoleIdForPerms,
                            viewChannel: val,
                          },
                        }));
                      }}
                    />

                    <ThreeStateToggle
                      label={isVoice ? 'Falar no Canal de Voz' : 'Enviar Mensagens'}
                      description={
                        isVoice
                          ? 'Permite que os membros falem e transmitam áudio na sala.'
                          : 'Permite que os membros enviem mensagens de texto e anexos neste canal.'
                      }
                      value={permissionOverrides[selectedRoleIdForPerms]?.sendMessages || 'inherit'}
                      onChange={(val) => {
                        setPermissionOverrides((prev) => ({
                          ...prev,
                          [selectedRoleIdForPerms]: {
                            ...prev[selectedRoleIdForPerms],
                            roleId: selectedRoleIdForPerms,
                            sendMessages: val,
                          },
                        }));
                      }}
                    />

                    <ThreeStateToggle
                      label="Conectar em Voz"
                      description="Permite que os membros se conectem ao canal de voz e ouçam outros participantes."
                      value={permissionOverrides[selectedRoleIdForPerms]?.connectVoice || 'inherit'}
                      onChange={(val) => {
                        setPermissionOverrides((prev) => ({
                          ...prev,
                          [selectedRoleIdForPerms]: {
                            ...prev[selectedRoleIdForPerms],
                            roleId: selectedRoleIdForPerms,
                            connectVoice: val,
                          },
                        }));
                      }}
                    />
                  </div>
                </div>

                {/* Cargos e Membros com Acesso */}
                <div className="space-y-3 pt-2 border-t border-[#3f4147]/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                        Cargos com Acesso Permitido
                      </label>
                      <p className="text-xs text-[#949ba4]">
                        Marque quais grupos de usuários podem entrar e interagir neste canal.
                      </p>
                    </div>
                    <span className="text-[11px] text-[#949ba4]">
                      {allowedRoleIds.length} {allowedRoleIds.length === 1 ? 'selecionado' : 'selecionados'}
                    </span>
                  </div>

                  {/* Campo de Busca de Cargos com Ícone de Lupa */}
                  <div className="flex items-center bg-[#111214] border border-[#2b2d31] focus-within:border-[#5865f2] rounded-xl px-3 py-2 text-xs transition-colors">
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

                  <div className="border border-[#2b2d31] rounded-xl divide-y divide-[#2b2d31]/60 bg-[#1e1f22]/50 overflow-hidden">
                    {roles
                      .filter((r) => r.name.toLowerCase().includes(roleSearchQuery.toLowerCase()))
                      .map((role) => {
                        const isChecked = allowedRoleIds.includes(role.id);
                        return (
                          <div
                            key={role.id}
                            onClick={() => toggleRole(role.id)}
                            className="flex items-center justify-between p-3.5 hover:bg-[#2b2d31]/40 transition-colors cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                                style={{ backgroundColor: role.color }}
                              />
                              <div>
                                <span className="text-sm font-semibold text-white block">{role.name}</span>
                                <span className="text-[11px] text-[#949ba4]">
                                  {role.id === 'role-everyone'
                                    ? 'Aplica-se a todos os membros do servidor'
                                    : 'Membros com este cargo específico'}
                                </span>
                              </div>
                            </div>

                            {/* Checkbox Redondo (Estilo Discord) */}
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                isChecked
                                  ? 'bg-[#5865f2] border-[#5865f2] text-white'
                                  : 'border-[#4e5058] hover:border-[#80848e]'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    {roles.filter((r) => r.name.toLowerCase().includes(roleSearchQuery.toLowerCase())).length === 0 && (
                      <div className="py-6 text-center text-xs text-[#80848e]">
                        Nenhum cargo encontrado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── ABA 3: CONVITES ─────────────────────────────────────── */}
            {activeTab === 'invites' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Convites do Canal</h2>
                  <p className="text-xs text-[#949ba4]">
                    Links ativos criados diretamente para apontar novos membros para este canal.
                  </p>
                </div>

                <div className="border border-[#2b2d31] rounded-xl divide-y divide-[#2b2d31]/60 bg-[#1e1f22]/50 overflow-hidden">
                  {invites.map((inv) => (
                    <div key={inv.code} className="p-3.5 flex items-center justify-between hover:bg-[#2b2d31]/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2b2d31] flex items-center justify-center text-[#949ba4]">
                          <LinkIcon className="w-4 h-4 text-[#5865f2]" />
                        </div>
                        <div>
                          <span className="text-sm font-mono font-semibold text-white block">
                            capy.ofc/invite/{inv.code}
                          </span>
                          <span className="text-[11px] text-[#949ba4]">
                            Criado por {inv.creator} • {inv.uses} usos • Expira em: {inv.expires}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyInvite(inv.code)}
                          className="px-3 py-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedCode === inv.code ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar link</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setInvites((prev) => prev.filter((i) => i.code !== inv.code))}
                          title="Revogar convite"
                          className="p-1.5 text-[#949ba4] hover:text-[#f23f43] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    const newCode = `arena-${Math.random().toString(36).substring(2, 7)}`;
                    setInvites((prev) => [
                      { code: newCode, creator: 'Você', uses: 0, expires: '7 dias' },
                      ...prev,
                    ]);
                  }}
                  className="px-4 py-2 bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Gerar novo link de convite</span>
                </button>
              </div>
            )}

            {/* ─── ABA 4: INTEGRAÇÕES ──────────────────────────────────── */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Integrações e Webhooks</h2>
                  <p className="text-xs text-[#949ba4]">
                    Envie atualizações automatizadas, logs e feeds de jogos diretamente para #{channel.name}.
                  </p>
                </div>

                <div className="border border-[#2b2d31] rounded-xl p-4 bg-[#1e1f22]/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2]">
                        <Webhook className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-white block">Webhooks</span>
                        <span className="text-xs text-[#949ba4]">
                          {webhooks.length} {webhooks.length === 1 ? 'Webhook ativo' : 'Webhooks ativos'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const newWh = {
                          id: `wh-${Date.now()}`,
                          name: `Webhook #${webhooks.length + 1}`,
                          avatar: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=100&auto=format&fit=crop&q=80',
                        };
                        setWebhooks([...webhooks, newWh]);
                      }}
                      className="px-3.5 py-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Novo Webhook</span>
                    </button>
                  </div>

                  <div className="pt-2 divide-y divide-[#2b2d31]/50">
                    {webhooks.map((wh) => (
                      <div key={wh.id} className="py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <img src={wh.avatar} alt={wh.name} className="w-7 h-7 rounded-full object-cover" />
                          <span className="text-xs font-semibold text-white">{wh.name}</span>
                        </div>
                        <button
                          onClick={() => setWebhooks(webhooks.filter((w) => w.id !== wh.id))}
                          className="text-xs text-[#f23f43] hover:underline cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-[#2b2d31] rounded-xl p-4 bg-[#1e1f22]/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#23a55a]/20 flex items-center justify-center text-[#23a55a]">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Bots e Aplicações</span>
                      <span className="text-xs text-[#949ba4]">LYC Matchmaking Bot • MusicBot 24/7</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#23a55a] bg-[#23a55a]/15 px-2.5 py-1 rounded-full">
                    Ativo
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Barra Flutuante de Salvar Alterações (Estilo Discord) ─── */}
          {hasChanges && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#111214] border border-[#2b2d31] px-5 py-3 rounded-lg shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4 duration-150">
              <span className="text-xs text-white font-medium">
                Cuidado — você tem alterações não salvas!
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-white hover:underline transition-colors cursor-pointer"
                >
                  Redefinir
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-[#23a55a] hover:bg-[#1f9250] text-white text-xs font-bold rounded shadow transition-colors cursor-pointer"
                >
                  Salvar alterações
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
