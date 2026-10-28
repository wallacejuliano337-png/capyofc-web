import React, { useState, useEffect } from 'react';
import { Gem, Check, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { getInvitePreview, joinByInviteCode, InvitePreviewData } from '../../lib/invite';
import { useDiscord } from '../../store/discordStore';

interface DiscordInviteEmbedProps {
  code: string;
  rawUrl?: string;
}

export const DiscordInviteEmbed: React.FC<DiscordInviteEmbedProps> = ({ code, rawUrl }) => {
  const {
    currentUser,
    servers,
    setActiveServer,
    joinCommunityServer,
  } = useDiscord();

  const [preview, setPreview] = useState<InvitePreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setJoinError(null);

    const loadPreview = async () => {
      try {
        const data = await getInvitePreview(code, currentUser?.id);
        if (!isCancelled) {
          setPreview(data);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setPreview({
            status: 'invalid',
            code,
            error: err?.message || 'Não foi possível carregar os dados do convite.',
          });
          setIsLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      isCancelled = true;
    };
  }, [code, currentUser?.id, servers.length]);

  // Se o usuário já é membro do servidor localmente
  const isAlreadyMember = Boolean(
    preview?.is_already_member ||
    servers.some(
      (s) =>
        s.id === preview?.community_id ||
        s.communityId === preview?.community_id ||
        (preview?.community_id === 'server-lyc' && s.id === 'server-lyc')
    )
  );

  const handleAction = async () => {
    if (isAlreadyMember && preview?.community_id) {
      // Já é membro: apenas navegar diretamente para o servidor
      setActiveServer(preview.community_id);
      return;
    }

    // Não é membro: executar entrada atômica e segura
    setIsJoining(true);
    setJoinError(null);

    try {
      const joinRes = await joinByInviteCode(code);
      if (!joinRes.success || !joinRes.communityId) {
        setJoinError(joinRes.error || 'Não foi possível entrar no servidor.');
        setIsJoining(false);
        return;
      }

      // Conectar e abrir a comunidade no store local
      const storeRes = await joinCommunityServer(joinRes.communityId);
      if (!storeRes.success) {
        setJoinError(storeRes.error || 'Erro ao carregar os canais da comunidade.');
        setIsJoining(false);
        return;
      }

      // Atualizar estado de membro para refletir o sucesso
      setPreview((prev) => (prev ? { ...prev, is_already_member: true } : prev));
      setIsJoining(false);
    } catch (err: any) {
      setJoinError(err?.message || 'Falha ao processar o convite.');
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-2 w-full max-w-[430px] rounded-[8px] bg-[#2b2d31] border border-[#202225] p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-[#5865f2] animate-spin flex-shrink-0" />
        <span className="text-xs text-[#949ba4]">Carregando informações do convite...</span>
      </div>
    );
  }

  // Convite com erro ou inválido
  if (!preview || preview.status !== 'valid') {
    return (
      <div className="mt-2 w-full max-w-[430px] rounded-[8px] bg-[#2b2d31] border border-[#202225] p-3.5 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#f23f43] flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-semibold text-white">Convite indisponível</div>
          <div className="text-[#949ba4] mt-0.5">
            {preview?.error || 'Este convite expirou, foi revogado ou atingiu o limite de usos.'}
          </div>
        </div>
      </div>
    );
  }

  const serverName = preview.community_name || 'Comunidade';
  const serverInitials = (serverName || 'SRV').slice(0, 3).toUpperCase();
  const onlineCount = preview.online_count || Math.max(1, Math.round((preview.member_count || 1) * 0.2));
  const memberCount = preview.member_count || 1;
  const boostCount = preview.boost_count ?? 337;

  // Formatação amigável da data de criação
  const createdDateStr = preview.created_at
    ? `Desde ${new Date(preview.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`
    : 'Desde ago. de 2025';

  return (
    <div className="mt-2 w-full max-w-[430px] rounded-[8px] bg-[#2b2d31] border border-[#202225] shadow-lg overflow-hidden select-none animate-in fade-in duration-100">
      {/* Top Banner Gradient */}
      <div className="h-16 w-full bg-gradient-to-r from-[#1e1f22] via-[#2b2d31] to-[#18191c] relative" />

      {/* Main Content Card */}
      <div className="p-4 pt-0 relative">
        {/* Inset Server Avatar / Logo */}
        <div className="flex items-end justify-between -mt-7 mb-2">
          <div className="w-14 h-14 rounded-[16px] bg-[#111214] border-4 border-[#2b2d31] shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
            {preview.image_url ? (
              <img
                src={preview.image_url}
                alt={serverName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-extrabold text-sm text-white tracking-wider">
                {serverInitials}
              </span>
            )}
          </div>
        </div>

        {/* Server Name & Boost badge */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <h3 className="text-white font-bold text-[16px] leading-tight truncate">
            {serverName}
          </h3>
          {boostCount > 0 && (
            <span className="flex items-center gap-1 bg-[#232428] px-2 py-0.5 rounded-[4px] text-[11px] font-bold text-[#eb459e] border border-[#eb459e]/20">
              <Gem className="w-3 h-3 text-[#eb459e]" />
              <span>{boostCount}</span>
            </span>
          )}
        </div>

        {/* Member and Presence Counters */}
        <div className="flex items-center gap-3 text-xs text-[#949ba4] font-medium mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#23a55a]" />
            <span>{onlineCount} online</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#80848e]" />
            <span>{memberCount} membro{memberCount > 1 ? 's' : ''}</span>
          </span>
        </div>

        {/* Creation Date */}
        <p className="text-[11px] text-[#80848e] mb-3">
          {createdDateStr}
        </p>

        {/* Action Error Message */}
        {joinError && (
          <div className="mb-2 p-2 rounded bg-[#f23f43]/15 border border-[#f23f43]/40 text-[#f23f43] text-xs">
            {joinError}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleAction}
          disabled={isJoining}
          className={`w-full py-2.5 px-4 rounded-[4px] font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 text-white shadow-sm ${
            isJoining
              ? 'bg-[#23a55a]/70 cursor-wait'
              : 'bg-[#23a55a] hover:bg-[#1f924f] active:bg-[#1a7f44]'
          }`}
        >
          {isJoining ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Entrando no Servidor...</span>
            </>
          ) : isAlreadyMember ? (
            <>
              <span>Ir para o Servidor</span>
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>Entrar no Servidor</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
