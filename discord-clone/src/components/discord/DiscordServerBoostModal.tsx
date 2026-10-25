import React, { useState, useEffect } from 'react';
import {
  X,
  Gem,
  Sparkles,
  Rocket,
  BookOpen,
  Play,
  Check,
  Infinity,
} from 'lucide-react';
import { useDiscord, currentUser } from '../../store/discordStore';
import { isOfficialCommunity } from '../../services/communityLevel';

const PawIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4 text-[#c084fc]" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <ellipse cx="6" cy="8" rx="2" ry="3" />
    <ellipse cx="11" cy="5" rx="2.2" ry="3.5" />
    <ellipse cx="16" cy="5" rx="2.2" ry="3.5" />
    <ellipse cx="20.5" cy="8.5" rx="2" ry="3" />
    <path d="M13.5 12C11 12 8.5 13.5 8 16C7.5 18.5 9.5 21 13.5 21C17.5 21 19.5 18.5 19 16C18.5 13.5 16 12 13.5 12Z" />
  </svg>
);

interface ComparisonRow {
  label: string;
  sem: string | 'check' | 'cross';
  lvl1: string | 'check' | 'cross';
  lvl2: string | 'check' | 'cross';
  lvl3: string | 'check' | 'cross';
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Espaços de emoji', sem: '50', lvl1: '100', lvl2: '150', lvl3: '250' },
  { label: 'Espaços de figurinhas', sem: '5', lvl1: '15', lvl2: '30', lvl3: '60' },
  { label: 'Espaços de efeitos sonoros', sem: '8', lvl1: '24', lvl2: '36', lvl3: '48' },
  { label: 'Qualidade da transmissão', sem: '720p 30fps', lvl1: '720p 60fps', lvl2: '1440p 60fps', lvl3: '1440p 60fps' },
  { label: 'Qualidade de áudio', sem: '96kbps', lvl1: '128kbps', lvl2: '256kbps', lvl3: '384kbps' },
  { label: 'Limite de tamanho dos envios', sem: '10MB', lvl1: '10MB', lvl2: '50MB', lvl3: '100MB' },
  { label: 'Assentos no palco de vídeo', sem: '50', lvl1: '50', lvl2: '150', lvl3: '300' },
  { label: 'Ícone animado do servidor', sem: 'cross', lvl1: 'check', lvl2: 'check', lvl3: 'check' },
  { label: 'Plano de fundo do convite do servidor', sem: 'cross', lvl1: 'check', lvl2: 'check', lvl3: 'check' },
  { label: 'Faixa do servidor', sem: 'cross', lvl1: 'cross', lvl2: 'Estática', lvl3: 'Com animação' },
  { label: 'Ícones de cargos personalizados', sem: 'cross', lvl1: 'cross', lvl2: 'check', lvl3: 'check' },
  { label: 'Link de convite personalizado', sem: 'cross', lvl1: 'cross', lvl2: 'cross', lvl3: 'check' },
];

const renderComparisonCell = (val: string | 'check' | 'cross') => {
  if (val === 'check') {
    return (
      <svg
        className="w-5 h-5 text-[#9bb0ff]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (val === 'cross') {
    return (
      <svg
        className="w-4 h-4 text-[#4e4574]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  return <span>{val}</span>;
};

export const DiscordServerBoostModal: React.FC = () => {
  const {
    servers,
    activeServerId,
    isServerBoostModalOpen,
    closeServerBoostModal,
    updateServer,
    userBoostsAvailable,
    setUserBoostsAvailable,
    useBoostOnServer,
  } = useDiscord();

  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const isOfficial = isOfficialCommunity(currentServer);

  const [boostCount, setBoostCount] = useState<number>(currentServer?.boostCount ?? 0);
  const [boostToast, setBoostToast] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (currentServer) {
      setBoostCount(currentServer.boostCount ?? 0);
    }
  }, [currentServer, isServerBoostModalOpen]);

  // Escape key listener to close confirm modal or main modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isConfirmModalOpen) {
          setIsConfirmModalOpen(false);
        } else if (isServerBoostModalOpen) {
          closeServerBoostModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isServerBoostModalOpen, isConfirmModalOpen, closeServerBoostModal]);

  if (!isServerBoostModalOpen || !currentServer) return null;

  const currentLevel = boostCount >= 14 ? 3 : boostCount >= 7 ? 2 : boostCount >= 2 ? 1 : 0;
  const progressPercent = Math.min(100, Math.round((boostCount / 14) * 100));

  const handleApplyBoost = (newCount: number) => {
    const safeCount = Math.max(0, newCount);
    const newLevel = (safeCount >= 14 ? 3 : safeCount >= 7 ? 2 : safeCount >= 2 ? 1 : 0) as 0 | 1 | 2 | 3;
    setBoostCount(safeCount);
    updateServer(currentServer.id, {
      boostCount: safeCount,
      boostLevel: newLevel,
    });
  };

  const triggerBoostOne = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmBoost = () => {
    if (userBoostsAvailable <= 0) return;
    const success = useBoostOnServer(currentServer.id);
    if (success) {
      setBoostCount((prev) => prev + 1);
      setIsConfirmModalOpen(false);
      setBoostToast(
        `🎉 Você impulsionou ${currentServer.name}! Restam ${userBoostsAvailable - 1} ${
          userBoostsAvailable - 1 === 1 ? 'impulso disponível' : 'impulsos disponíveis'
        }.`
      );
      setTimeout(() => setBoostToast(null), 3500);
    }
  };

  // Cálculos dinâmicos da barra contínua de progressão dos níveis
  const seg1Progress = boostCount >= 2 ? 100 : Math.min(100, Math.max(0, (boostCount / 2) * 100));
  const seg2Progress = boostCount < 2 ? 0 : boostCount >= 7 ? 100 : Math.min(100, Math.max(0, ((boostCount - 2) / 5) * 100));
  const seg3Progress = boostCount < 7 ? 0 : boostCount >= 14 ? 100 : Math.min(100, Math.max(0, ((boostCount - 7) / 7) * 100));

  return (
    <div className="fixed inset-0 z-[9990] flex flex-col bg-[#111214] text-[#dbdee1] overflow-hidden select-none animate-in fade-in duration-200">
      {/* Toast Flutuante de Notificação */}
      {boostToast && (
        <div className="fixed top-6 right-20 z-[9999] flex items-center gap-3 bg-gradient-to-r from-[#eb459e] via-[#f47fff] to-[#5865f2] text-white px-5 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-200">
          <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            {isOfficial ? (
              <Infinity className="w-4 h-4 text-white" />
            ) : (
              <Gem className="w-4 h-4 text-white fill-white" />
            )}
          </div>
          <span className="text-xs font-bold">{boostToast}</span>
        </div>
      )}

      {/* ── INDICADOR DE IMPULSOS DISPONÍVEIS DO USUÁRIO NO TOPO ESQUERDO ── */}
      <div className="fixed top-6 left-8 z-50 flex items-center gap-2.5 bg-[#18112d]/85 border border-[#8b5cf6]/40 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl transition-all hover:border-[#8b5cf6]/70">
        <PawIcon className="w-4 h-4 text-[#c084fc] drop-shadow-[0_0_8px_#c084fc]" />
        <span className="text-xs font-bold text-white tracking-wide">
          Seus impulsos:{' '}
          <strong className="text-[#f47fff] font-black">{userBoostsAvailable}</strong>
        </span>
      </div>

      {/* ── BOTÃO DE FECHAR FIXO NO CANTO SUPERIOR DIREITO (PADRÃO DISCORD × ESC) ── */}
      <div className="fixed top-6 right-8 z-50 flex flex-col items-center gap-1 group">
        <button
          type="button"
          onClick={closeServerBoostModal}
          className="w-9 h-9 rounded-full border-2 border-[#b5bac1] flex items-center justify-center text-[#b5bac1] group-hover:border-white group-hover:text-white transition-all cursor-pointer bg-[#1e1f22]/80 backdrop-blur-sm shadow-xl active:scale-95"
          title="Fechar (ESC)"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>
        <span className="text-[10px] font-bold text-[#949ba4] group-hover:text-white transition-colors select-none">
          ESC
        </span>
      </div>

      {/* ── MODAL DE CONFIRMAÇÃO DE IMPULSO (POPUP CENTRALIZADO) ─────────── */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setIsConfirmModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-[28px] bg-gradient-to-b from-[#1b1233] via-[#110e24] to-[#0a0814] border border-[#a855f7]/50 shadow-[0_0_60px_rgba(168,85,247,0.35)] p-6 sm:p-7 text-center overflow-hidden animate-in zoom-in-95 duration-200 select-none">
            {/* Brilho ambiente no topo */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#a855f7]/20 via-[#ec4899]/10 to-transparent pointer-events-none" />

            {/* Botão Fechar no canto superior direito */}
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Ícone / Avatar do Servidor com Rocket Badge */}
            <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 mb-4 mt-1">
              <div className="w-full h-full rounded-2xl bg-[#0a0a14] border-2 border-[#8b5cf6] p-1.5 shadow-[0_0_25px_rgba(139,92,246,0.5)] overflow-hidden flex items-center justify-center">
                {currentServer.icon ? (
                  <img
                    src={currentServer.icon}
                    alt={currentServer.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <span className="text-xl sm:text-2xl font-black text-white">
                    {currentServer.initials || 'LYC'}
                  </span>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-tr from-[#ec4899] to-[#8b5cf6] border-2 border-[#18112d] flex items-center justify-center shadow-lg">
                {isOfficial ? (
                  <Infinity className="w-4 h-4 text-white" />
                ) : (
                  <Rocket className="w-4 h-4 text-white fill-white" />
                )}
              </div>
            </div>

            {/* Título & Mensagem Clara de Confirmação */}
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Confirmar Impulso
            </h3>
            <p className="text-xs sm:text-sm text-[#dbdee1] font-medium mt-1.5 leading-relaxed max-w-sm mx-auto">
              Você está impulsionando a comunidade <strong className="text-white font-bold">{currentServer.name}</strong>. Tem certeza?
            </p>

            {/* Painel de Gestão de Impulsos e Saldo */}
            <div className="mt-5 p-4 rounded-2xl bg-[#121024]/90 border border-[#34295c] flex items-center justify-between text-left shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <PawIcon className="w-5 h-5 text-[#c084fc] drop-shadow-[0_0_8px_#c084fc]" />
                </div>
                <div>
                  <span className="text-[11px] text-[#949ba4] font-medium block">
                    Seus impulsos disponíveis
                  </span>
                  <span className="text-sm sm:text-base font-extrabold text-white">
                    {userBoostsAvailable} {userBoostsAvailable === 1 ? 'impulso' : 'impulsos'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-[#949ba4] block">Custo</span>
                <span className="text-xs sm:text-sm font-black text-[#f47fff]">1 impulso</span>
              </div>
            </div>

            {/* Se tem impulsos disponíveis */}
            {userBoostsAvailable > 0 ? (
              <>
                <p className="text-[11px] text-[#949ba4] font-medium mt-3">
                  Ao confirmar, o servidor passará de <strong className="text-white font-bold">{boostCount}</strong> para <strong className="text-[#a855f7] font-bold">{boostCount + 1}</strong> impulsos.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="w-full sm:w-1/2 py-2.5 rounded-xl bg-[#1f1d33] hover:bg-[#282642] text-[#dbdee1] hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBoost}
                    className="w-full sm:w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-[#6032f6] via-[#7336f6] to-[#a855f7] hover:brightness-110 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-[0_0_20px_rgba(115,54,246,0.6)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isOfficial ? (
                      <Infinity className="w-4 h-4 text-white" />
                    ) : (
                      <Rocket className="w-4 h-4 text-white fill-white" />
                    )}
                    <span>Confirmar</span>
                  </button>
                </div>
              </>
            ) : (
              /* Se NÃO tem impulsos disponíveis */
              <>
                <div className="mt-4 p-3.5 rounded-2xl bg-[#ec4899]/15 border border-[#ec4899]/35 text-left">
                  <div className="flex items-start gap-3">
                    <span className="text-base leading-none">⚠️</span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-[#f47fff]">Sem impulsos disponíveis</h4>
                      <p className="text-[11px] text-[#dbdee1] leading-relaxed">
                        Você não possui impulsos na sua conta. Obtenha mais impulsos para continuar apoiando esta comunidade.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="w-full sm:w-1/3 py-2.5 rounded-xl bg-[#1f1d33] hover:bg-[#282642] text-[#dbdee1] hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserBoostsAvailable(2);
                      setBoostToast('✨ Você adicionou 2 impulsos à sua conta!');
                      setTimeout(() => setBoostToast(null), 3000);
                    }}
                    className="w-full sm:w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] hover:brightness-110 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-[0_0_20px_rgba(236,72,153,0.5)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Infinity className="w-4 h-4 text-white" />
                    <span>Obter +2 Impulsos</span>
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ── CONTEÚDO PRINCIPAL COM SCROLL FULLSCREEN ────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* ── 1. HERO SECTION: FULLSCREEN CINEMÁTICA CAPYCHAT IMPULSO ───────────── */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <div className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0c0d16] py-5 sm:py-6 md:py-8 px-4 sm:px-6">
          {/* ── Camadas de Fundo da Cena (100% Fullscreen e Imersivo com Rochas) ── */}
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
            {/* 1. Fundo Cósmico das Montanhas */}
            <img
              src="/assets/impulso/fundo.png"
              alt="Fundo Cósmico"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-95"
            />

            {/* 2. Ambient Glows Suaves */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[750px] h-[550px] rounded-full bg-[#8b5cf6]/20 blur-[140px]" />
            <div className="absolute top-10 left-10 w-[450px] h-[450px] rounded-full bg-[#d946ef]/15 blur-[130px]" />
            <div className="absolute top-10 right-10 w-[450px] h-[450px] rounded-full bg-[#eab308]/15 blur-[130px]" />

            {/* 3. Partículas e Efeitos de Brilho */}
            <img
              src="/assets/impulso/efeito.png"
              alt="Efeito de Brilho"
              className="absolute inset-0 w-full h-full object-cover object-center mix-blend-screen opacity-80"
            />

            {/* 4. Grande Cristal Roxo Flutuante ao Fundo à Esquerda */}
            <div className="absolute -left-4 sm:-left-6 md:-left-8 lg:-left-10 xl:-left-12 top-1/2 -translate-y-[44%] w-64 sm:w-80 md:w-96 lg:w-[460px] xl:w-[510px] 2xl:w-[550px] max-w-[34vw] pointer-events-none transition-transform duration-700 hover:scale-105 z-10 flex items-center justify-center select-none">
              <img
                src="/assets/impulso/cristal-principal.png"
                alt="Cristal de Impulso Principal"
                className="w-full h-auto object-contain drop-shadow-[0_0_65px_rgba(217,70,239,0.8)]"
              />
            </div>

            {/* 5. Mascote Capivara Gamer com Raio à Direita (Deslocada à Esquerda e Acomodada nas Rochas) */}
            <div className="absolute right-2 sm:right-4 md:right-6 lg:right-10 xl:right-14 2xl:right-18 top-1/2 -translate-y-[38%] w-64 sm:w-80 md:w-96 lg:w-[460px] xl:w-[510px] 2xl:w-[550px] max-w-[34vw] pointer-events-none transition-transform duration-700 hover:scale-105 z-10 flex items-center justify-center select-none">
              <img
                src="/assets/impulso/capy.png"
                alt="Capivara Gamer com Raio"
                className="w-full h-auto object-contain drop-shadow-[0_0_65px_rgba(250,204,21,0.5)]"
              />
            </div>

            {/* 6. Formações Rochosas da Base e Laterais (Sobrepondo Pés da Mascote e Base dos Cristais) */}
            <img
              src="/assets/impulso/pedras.png"
              alt="Formações Rochosas"
              className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none z-14"
            />

            {/* 7. Cristais Menores Flutuantes no Céu */}
            <img
              src="/assets/impulso/cristais-menores.png"
              alt="Cristais Menores"
              className="absolute inset-0 w-full h-full object-cover object-center mix-blend-screen opacity-90 pointer-events-none z-16"
            />
          </div>

          {/* ── Conteúdo Central da Hero (Perfeitamente Centralizado e Proporcionado) ── */}
          <div className="relative z-30 max-w-lg lg:max-w-xl xl:max-w-[620px] mx-auto w-full flex flex-col items-center text-center my-auto space-y-2 sm:space-y-2.5">

            {/* 1. Selo Superior da Comunidade */}
            <div className="flex flex-col items-center space-y-1">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0a0b14] p-1.5 border-2 border-[#8b5cf6]/80 shadow-[0_0_20px_rgba(139,92,246,0.45)] flex items-center justify-center overflow-hidden">
                {currentServer.icon ? (
                  <img
                    src={currentServer.icon}
                    alt={currentServer.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <span className="text-base sm:text-lg font-black text-white tracking-wider uppercase">
                    {currentServer.initials || 'LYC'}
                  </span>
                )}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#8b5cf6]/20 to-transparent pointer-events-none" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {currentServer.name || 'LYC Arena'}
                </h3>
                <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-[#b5bac1] font-semibold">
                  {isOfficial ? (
                    <Infinity className="w-3.5 h-3.5 text-[#c084fc]" />
                  ) : (
                    <Rocket className="w-3.5 h-3.5 text-[#c084fc]" />
                  )}
                  <span>{boostCount} impulsos</span>
                </div>
              </div>
            </div>

            {/* 2. Título e Subtítulo de Destaque */}
            <div className="space-y-0.5 max-w-xl mx-auto">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-[1.12] drop-shadow-lg">
                Sua comunidade <br className="hidden sm:inline" />
                merece um{' '}
                <span className="bg-gradient-to-r from-[#9055ff] via-[#b871fe] to-[#e879f9] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(184,113,254,0.4)]">
                  impulso.
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#dbdee1] font-medium max-w-md mx-auto">
                Desbloqueie vantagens para todos no CapyChat.
              </p>
            </div>

            {/* 3. Botões de Ação Principais (CTA) */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={triggerBoostOne}
                className="bg-gradient-to-r from-[#6032f6] via-[#7336f6] to-[#9d50f7] hover:brightness-110 active:scale-95 text-white font-bold text-xs sm:text-sm px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl shadow-[0_0_20px_rgba(115,54,246,0.5)] flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
              >
                {isOfficial ? (
                  <Infinity className="w-4 h-4 text-white" />
                ) : (
                  <Rocket className="w-4 h-4 text-white fill-white" />
                )}
                <span>Impulsionar comunidade</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBoostToast('✨ Conheça o Ultra Pass na próxima aba!');
                  setTimeout(() => setBoostToast(null), 3000);
                }}
                className="bg-[#0c0d18]/70 hover:bg-[#151624] text-white font-semibold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-white/15 hover:border-white/30 shadow-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
              >
                <BookOpen className="w-4 h-4 text-[#a78bfa]" />
                <span>Conhecer o Ultra Pass</span>
              </button>
            </div>

            {/* 4. Player Central Ilustrativo (Cena Gamers) */}
            <div className="relative w-full max-w-lg lg:max-w-xl mx-auto rounded-2xl overflow-hidden border-2 border-[#8b5cf6]/60 shadow-[0_0_30px_rgba(139,92,246,0.3)] bg-[#0d0e15] aspect-[16/9.2] group cursor-pointer transition-transform hover:scale-[1.01] my-0.5">
              <img
                src="/assets/impulso/capy-gamer.png"
                alt="CapyChat Gamers"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/15 group-hover:bg-black/5 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-white text-[#18112e] flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.7)] group-hover:scale-115 group-active:scale-95 transition-all duration-200">
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-[#18112e] text-[#18112e] ml-0.5" />
                </div>
              </div>
            </div>

            {/* 5. Barra de Progressão dos Níveis (Card Contínuo de Níveis 1, 2 e 3 com Cristais) */}
            <div className="w-full max-w-lg lg:max-w-xl mx-auto rounded-2xl bg-[#0c0d18]/90 border border-[#23253b]/90 p-2.5 sm:p-3 shadow-2xl backdrop-blur-md">
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 items-center">
                {/* Nível 1 */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <img
                    src="/assets/impulso/cristal-1.png"
                    alt="Nível 1"
                    className={`w-8 h-8 sm:w-10 sm:h-10 object-contain flex-shrink-0 transition-all duration-500 ${
                      boostCount >= 2 ? 'scale-110 drop-shadow-[0_0_14px_rgba(236,72,153,0.95)] opacity-100' : 'opacity-80'
                    }`}
                  />
                  <div className="text-left min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1">
                      <span>Nível 1</span>
                      {boostCount >= 2 && <Check className="w-3 h-3 text-[#23a55a] stroke-[3]" />}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-[#949ba4] font-medium whitespace-nowrap">2 impulsos</div>
                  </div>

                  {/* Progress track contínuo para Nível 2 */}
                  <div className="flex flex-1 items-center px-1 sm:px-1.5 min-w-[36px]">
                    <div className="relative w-full h-1 sm:h-1.5 rounded-full bg-[#1b1c2b]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#d946ef] to-[#c026d3] transition-all duration-500 ease-out"
                        style={{ width: `${seg1Progress}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#d946ef] shadow-[0_0_10px_#d946ef] transition-all duration-500 ease-out"
                        style={{ left: `calc(${seg1Progress}% - 5px)` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Nível 2 */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <img
                    src="/assets/impulso/cristal-2.png"
                    alt="Nível 2"
                    className={`w-8 h-8 sm:w-10 sm:h-10 object-contain flex-shrink-0 transition-all duration-500 ${
                      boostCount >= 7 ? 'scale-110 drop-shadow-[0_0_14px_rgba(168,85,247,0.95)] opacity-100' : 'opacity-80'
                    }`}
                  />
                  <div className="text-left min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1">
                      <span>Nível 2</span>
                      {boostCount >= 7 && <Check className="w-3 h-3 text-[#23a55a] stroke-[3]" />}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-[#949ba4] font-medium whitespace-nowrap">7 impulsos</div>
                  </div>

                  {/* Progress track contínuo para Nível 3 */}
                  <div className="flex flex-1 items-center px-1 sm:px-1.5 min-w-[36px]">
                    <div className="relative w-full h-1 sm:h-1.5 rounded-full bg-[#1b1c2b]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#c026d3] to-[#8b5cf6] transition-all duration-500 ease-out"
                        style={{ width: `${seg2Progress}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#c084fc] shadow-[0_0_10px_#c084fc] transition-all duration-500 ease-out"
                        style={{ left: `calc(${seg2Progress}% - 5px)` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Nível 3 */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <img
                    src="/assets/impulso/cristal-3.png"
                    alt="Nível 3"
                    className={`w-8 h-8 sm:w-10 sm:h-10 object-contain flex-shrink-0 transition-all duration-500 ${
                      boostCount >= 14 ? 'scale-110 drop-shadow-[0_0_14px_rgba(234,179,8,0.95)] opacity-100' : 'opacity-80'
                    }`}
                  />
                  <div className="text-left min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1">
                      <span>Nível 3</span>
                      {boostCount >= 14 && <Check className="w-3.5 h-3.5 text-[#eab308] stroke-[3]" />}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-[#949ba4] font-medium whitespace-nowrap">14 impulsos</div>
                  </div>

                  {/* Terminal track contínuo final */}
                  <div className="flex flex-1 items-center px-1 sm:px-1.5 min-w-[36px]">
                    <div className="relative w-full h-1 sm:h-1.5 rounded-full bg-[#1b1c2b]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#eab308] transition-all duration-500 ease-out"
                        style={{ width: `${seg3Progress}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#eab308] shadow-[0_0_10px_#eab308] transition-all duration-500 ease-out"
                        style={{ left: `calc(${seg3Progress}% - 5px)` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Barra Inferior Flutuante (Card do Servidor + Ação) */}
            <div className="w-full max-w-lg lg:max-w-xl mx-auto rounded-2xl bg-[#0c0d18]/95 border border-[#23253b]/90 p-2 sm:p-2.5 px-4 flex items-center justify-between shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0a0a14] border border-[#2b2d42] flex items-center justify-center font-black text-xs text-white overflow-hidden shadow-inner flex-shrink-0">
                  {currentServer.icon ? (
                    <img
                      src={currentServer.icon}
                      alt={currentServer.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{currentServer.initials || 'LYC'}</span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#23a55a] border-2 border-[#0c0d18]" />
                </div>
                <div className="text-left">
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                    {currentServer.name || 'LYC Arena'}
                  </h4>
                  <div className="text-[11px] text-[#949ba4] font-medium flex items-center gap-1.5 mt-0.5">
                    {isOfficial ? (
                      <Infinity className="w-3.5 h-3.5 text-[#a855f7]" />
                    ) : (
                      <Rocket className="w-3.5 h-3.5 text-[#a855f7]" />
                    )}
                    <span>{boostCount} impulsos</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={triggerBoostOne}
                className="bg-gradient-to-r from-[#6032f6] via-[#7336f6] to-[#a855f7] hover:opacity-95 text-white font-bold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-[0_0_20px_rgba(115,54,246,0.5)] flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                {isOfficial ? (
                  <Infinity className="w-4 h-4 text-white" />
                ) : (
                  <Rocket className="w-4 h-4 text-white fill-white" />
                )}
                <span>Impulsionar comunidade</span>
              </button>
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* ── 2. SEÇÃO DE VANTAGENS EXTRAS (ESTILO CAPYCHAT) ────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <section className="relative w-full py-20 sm:py-24 md:py-28 lg:py-32 px-4 sm:px-8 bg-gradient-to-b from-[#090814] via-[#0c0a1a] to-[#080712] overflow-hidden border-t border-[#8b5cf6]/20">
          {/* Fundo sutil com gradiente roxo e brilho ambiente */}
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
            <img
              src="/assets/impulso/parte2/fundo.png"
              alt="Fundo Vantagens Extras"
              className="w-full h-full object-cover opacity-60 mix-blend-screen"
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#8b5cf6]/12 blur-[150px] rounded-full" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
            {/* 1. Cabeçalho da Seção */}
            <div className="text-center space-y-3 max-w-2xl mx-auto mb-14 sm:mb-16 md:mb-20">
              <h2 className="text-2xl sm:text-3xl md:text-[34px] lg:text-[36px] font-black text-white tracking-tight leading-tight">
                Impulsione sua comunidade com vantagens extras
              </h2>
              <p className="text-sm sm:text-base text-[#949ba4] font-medium leading-relaxed">
                Desbloqueie cada vantagem individualmente, sem precisar atingir um nível de impulso.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setBoostToast('✨ As vantagens extras podem ser desbloqueadas avulsas para sua comunidade!');
                    setTimeout(() => setBoostToast(null), 3000);
                  }}
                  className="text-[#a855f7] hover:text-[#c084fc] hover:underline font-semibold cursor-pointer transition-colors inline-block ml-0.5"
                >
                  Saiba mais
                </button>
              </p>
            </div>

            {/* 2. Grid de Cards de Vantagens Extras */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 w-full max-w-5xl mx-auto">
              
              {/* Card 1: Estilos de cargo aprimorados */}
              <div className="relative rounded-[28px] sm:rounded-[32px] bg-gradient-to-b from-[#18112d]/90 via-[#0e0f1c]/95 to-[#090a12] border border-[#6b21a8]/40 hover:border-[#a855f7]/70 p-8 sm:p-10 md:p-12 flex flex-col items-center text-center justify-between shadow-[0_10px_35px_rgba(0,0,0,0.4),0_0_40px_rgba(107,33,168,0.2)] hover:shadow-[0_15px_45px_rgba(0,0,0,0.5),0_0_55px_rgba(168,85,247,0.35)] transition-all duration-300 group">
                {/* Glow suave no topo do card */}
                <div className="absolute top-0 inset-x-0 h-36 bg-gradient-to-b from-[#a855f7]/15 to-transparent rounded-t-[28px] sm:rounded-t-[32px] pointer-events-none" />

                {/* Ilustração CapyLíder */}
                <div className="relative w-full h-40 sm:h-44 md:h-48 flex items-center justify-center">
                  <div className="flex items-center justify-center gap-2 sm:gap-3 transition-transform duration-300 group-hover:scale-105">
                    <img
                      src="/assets/impulso/parte2/capy.png"
                      alt="Capy Gamer"
                      className="h-28 sm:h-34 md:h-36 object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.45)]"
                    />
                    <img
                      src="/assets/impulso/parte2/capylider.png"
                      alt="CapyLíder"
                      className="h-20 sm:h-24 md:h-26 object-contain drop-shadow-[0_0_25px_rgba(236,72,153,0.5)]"
                    />
                  </div>
                </div>

                {/* Conteúdo textual */}
                <div className="flex flex-col items-center">
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-6">
                    Estilos de cargo aprimorados
                  </h3>
                  <p className="text-sm sm:text-base text-[#949ba4] font-medium mt-2 max-w-sm leading-relaxed">
                    Destaque seus cargos com gradientes vibrantes e exclusivos.
                  </p>
                </div>

                {/* Pílula de custo */}
                <div className="mt-8 px-5 py-2 rounded-full bg-[#181928]/90 border border-[#2b2d42] group-hover:border-[#a855f7]/60 flex items-center gap-2.5 shadow-inner transition-colors">
                  <PawIcon className="w-4 h-4 text-[#c084fc] drop-shadow-[0_0_6px_#c084fc]" />
                  <span className="text-sm font-bold text-white tracking-wide">3 impulsos</span>
                </div>
              </div>

              {/* Card 2: Tag da comunidade */}
              <div className="relative rounded-[28px] sm:rounded-[32px] bg-gradient-to-b from-[#18112d]/90 via-[#0e0f1c]/95 to-[#090a12] border border-[#6b21a8]/40 hover:border-[#a855f7]/70 p-8 sm:p-10 md:p-12 flex flex-col items-center text-center justify-between shadow-[0_10px_35px_rgba(0,0,0,0.4),0_0_40px_rgba(107,33,168,0.2)] hover:shadow-[0_15px_45px_rgba(0,0,0,0.5),0_0_55px_rgba(168,85,247,0.35)] transition-all duration-300 group">
                {/* Glow suave no topo do card */}
                <div className="absolute top-0 inset-x-0 h-36 bg-gradient-to-b from-[#a855f7]/15 to-transparent rounded-t-[28px] sm:rounded-t-[32px] pointer-events-none" />

                {/* Ilustração Bloquinhos 3D */}
                <div className="relative w-full h-40 sm:h-44 md:h-48 flex items-center justify-center">
                  <img
                    src="/assets/impulso/parte2/bloquinhos.png"
                    alt="Tags da Comunidade CAPY e LYC"
                    className="h-28 sm:h-34 md:h-36 object-contain drop-shadow-[0_0_25px_rgba(236,72,153,0.5)] transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Conteúdo textual */}
                <div className="flex flex-col items-center">
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-6">
                    Tag da comunidade
                  </h3>
                  <p className="text-sm sm:text-base text-[#949ba4] font-medium mt-2 max-w-sm leading-relaxed">
                    Represente sua comunidade em qualquer lugar do CapyChat.
                  </p>
                </div>

                {/* Pílula de custo */}
                <div className="mt-8 px-5 py-2 rounded-full bg-[#181928]/90 border border-[#2b2d42] group-hover:border-[#a855f7]/60 flex items-center gap-2.5 shadow-inner transition-colors">
                  <PawIcon className="w-4 h-4 text-[#c084fc] drop-shadow-[0_0_6px_#c084fc]" />
                  <span className="text-sm font-bold text-white tracking-wide">3 impulsos</span>
                </div>
              </div>

            </div>
          </div>
        </section>

          {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* ── 3. TABELA COMPARATIVA DE VANTAGENS (PARTE 3 - FINAL DEFINITIVO) ───── */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <section className="relative w-full pt-24 sm:pt-28 md:pt-36 pb-28 sm:pb-36 px-4 sm:px-8 bg-[#07060f] overflow-hidden border-t border-[#8b5cf6]/20">
          {/* Fundo imersivo com lago e caverna de cristais */}
          <div className="absolute inset-0 pointer-events-none select-none">
            <img
              src="/assets/impulso/parte3/fundo.png"
              alt="Cenário Caverna de Cristais"
              className="w-full h-full object-cover object-bottom opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#080712] via-transparent to-[#040409]/95" />
            <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#05040a] to-transparent" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
            {/* 1. Cabeçalho da Seção */}
            <div className="text-center space-y-3 max-w-2xl mx-auto mb-20 sm:mb-24 md:mb-28">
              <h2 className="text-2xl sm:text-3xl md:text-[36px] font-black text-white tracking-tight leading-tight">
                Suba o nível da sua comunidade
              </h2>
              <p className="text-sm sm:text-base text-[#b5bac1] font-medium mt-2">
                Compare as vantagens de cada nível de impulso.
              </p>
            </div>

            {/* 2. Container da Tabela com a Mascote Debruçada */}
            <div className="relative w-full max-w-5xl">
              {/* Mascote Capivara debruçada apoiada com as patinhas na borda superior direita do card */}
              <img
                src="/assets/impulso/parte3/capy.png"
                alt="Capivara CapyChat"
                className="absolute bottom-full translate-y-3 sm:translate-y-4 right-4 sm:right-8 md:right-12 w-44 sm:w-56 md:w-64 z-20 pointer-events-none drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)] object-contain"
              />

              {/* Moldura da Tabela com Borda Neon e Fundo Escuro */}
              <div className="relative rounded-[24px] sm:rounded-[28px] border border-[#7c3aed]/50 bg-[#0c0d1c]/90 backdrop-blur-md overflow-hidden shadow-[0_0_50px_rgba(124,58,237,0.15)]">
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[760px] p-5 sm:p-7 md:p-8">
                    
                    <div className="relative w-full">
                      {/* Coluna Nível 2 em Destaque (Borda contínua e tag RECOMENDADO perfeitamente centralizadas) */}
                      <div
                        style={{ left: '64%', width: '18%' }}
                        className="absolute -top-3 -bottom-2 rounded-2xl border-2 border-[#d946ef] bg-[#d946ef]/[0.035] shadow-[0_0_30px_rgba(217,70,239,0.22)] pointer-events-none z-10 flex justify-center"
                      >
                        <span className="absolute -top-3.5 px-3.5 py-0.5 rounded-full bg-gradient-to-r from-[#ec4899] to-[#c026d3] text-white text-[10px] font-black tracking-wider uppercase shadow-[0_0_14px_rgba(236,72,153,0.7)] whitespace-nowrap">
                          RECOMENDADO
                        </span>
                      </div>

                      {/* Cabeçalho da Tabela */}
                      <div className="grid grid-cols-[28%_18%_18%_18%_18%] items-end pb-6 border-b border-[#252044]">
                        {/* Vantagens */}
                        <div className="text-base sm:text-lg font-bold text-white pl-3 sm:pl-4 mb-2">
                          Vantagens
                        </div>

                        {/* Sem impulsos */}
                        <div className="flex flex-col items-center justify-center text-center">
                          <img
                            src="/assets/impulso/parte3/bronze.png"
                            alt="Sem impulsos"
                            className="w-12 h-12 object-contain mb-2 drop-shadow-md"
                          />
                          <span className="text-sm font-bold text-white tracking-wide">Sem impulsos</span>
                          <span className="text-xs text-[#949ba4] font-medium mt-0.5">Nenhum impulso</span>
                        </div>

                        {/* Nível 1 */}
                        <div className="flex flex-col items-center justify-center text-center">
                          <img
                            src="/assets/impulso/parte3/prata.png"
                            alt="Nível 1"
                            className="w-12 h-12 object-contain mb-2 drop-shadow-md"
                          />
                          <span className="text-sm font-bold text-white tracking-wide">Nível 1</span>
                          <span className="text-xs text-[#949ba4] font-medium mt-0.5">2 impulsos</span>
                        </div>

                        {/* Nível 2 */}
                        <div className="flex flex-col items-center justify-center text-center relative z-20">
                          <img
                            src="/assets/impulso/parte3/ouro.png"
                            alt="Nível 2"
                            className="w-12 h-12 object-contain mb-2 drop-shadow-md"
                          />
                          <span className="text-sm font-bold text-white tracking-wide">Nível 2</span>
                          <span className="text-xs text-[#949ba4] font-medium mt-0.5">7 impulsos</span>
                        </div>

                        {/* Nível 3 */}
                        <div className="flex flex-col items-center justify-center text-center">
                          <img
                            src="/assets/impulso/parte3/esmeralda.png"
                            alt="Nível 3"
                            className="w-12 h-12 object-contain mb-2 drop-shadow-md"
                          />
                          <span className="text-sm font-bold text-white tracking-wide">Nível 3</span>
                          <span className="text-xs text-[#949ba4] font-medium mt-0.5">14 impulsos</span>
                        </div>
                      </div>

                      {/* Linhas de Dados da Tabela */}
                      <div className="divide-y divide-[#252044]/60">
                        {COMPARISON_ROWS.map((row, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-[28%_18%_18%_18%_18%] items-center py-3.5 sm:py-4 hover:bg-white/[0.015] transition-colors"
                          >
                            <div className="text-sm font-medium text-[#dbdee1] pl-3 sm:pl-4 pr-2">
                              {row.label}
                            </div>
                            <div className="text-center text-sm font-medium text-white flex items-center justify-center">
                              {renderComparisonCell(row.sem)}
                            </div>
                            <div className="text-center text-sm font-medium text-white flex items-center justify-center">
                              {renderComparisonCell(row.lvl1)}
                            </div>
                            <div className="text-center text-sm font-semibold text-white flex items-center justify-center relative z-20">
                              {renderComparisonCell(row.lvl2)}
                            </div>
                            <div className="text-center text-sm font-medium text-white flex items-center justify-center">
                              {renderComparisonCell(row.lvl3)}
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>

                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
};
