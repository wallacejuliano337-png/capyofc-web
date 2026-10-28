import React, { useState, useRef, useEffect } from 'react';
import { useDiscord, currentUser } from '../../store/discordStore';
import { useVoiceStreamStore } from '../../store/voiceStreamStore';
import { DiscordCurrentUserPopout } from './DiscordCurrentUserPopout';
import { getAvatarUrl, handleAvatarError } from '../../utils/avatar';
import { getAssetUrl } from '../../utils/assets';
import { resolveServerTagBadgeIcon } from '../../types/discord';
import {
  Mic,
  MicOff,
  Headphones,
  Settings,
  PhoneOff,
  Signal,
  Info,
  Maximize2,
  Video,
  VideoOff,
  MonitorUp,
  Rocket,
  AudioWaveform,
  X,
} from 'lucide-react';

export const DiscordUserFooter: React.FC = () => {
  const {
    currentUser,
    servers,
    activeServerId,
    updateCurrentUser,
    voiceState,
    isMicMuted,
    isDeafened,
    isVideoOn,
    toggleVideo,
    toggleMute,
    toggleDeafen,
    disconnectFromVoice,
    openSettingsModal,
    setActiveView,
    activeView,
  } = useDiscord();

  const [isPopoutOpen, setIsPopoutOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);
  const [isActivitiesModalOpen, setIsActivitiesModalOpen] = useState(false);
  const userCardRef = useRef<HTMLDivElement>(null);
  const soundboardRef = useRef<HTMLDivElement>(null);

  const {
    screenStream,
    activeSourceName,
    openShareModal,
    stopScreenShare,
    disconnectAll,
  } = useVoiceStreamStore();
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  // Re-bind screen stream to PiP video element
  useEffect(() => {
    if (pipVideoRef.current && screenStream) {
      pipVideoRef.current.srcObject = screenStream;
      pipVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, activeView]);

  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const displayName = currentUser.displayName || currentUser.name || 'Usuário';
  const tagBadgeIcon = currentServer?.serverTag
    ? resolveServerTagBadgeIcon(currentServer.serverTagBadge, currentServer.serverTagBadgeImage)
    : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-[#23a55a]';
      case 'idle':
        return 'bg-[#f0b232]';
      case 'dnd':
        return 'bg-[#f23f43]';
      default:
        return 'bg-[#80848e]';
    }
  };

  // Close soundboard on click outside
  useEffect(() => {
    if (!isSoundboardOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (soundboardRef.current && !soundboardRef.current.contains(e.target as Node)) {
        setIsSoundboardOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isSoundboardOpen]);

  // Web Audio native soundboard effects
  const playSoundEffect = (type: 'airhorn' | 'quack' | 'badumtss' | 'gg' | 'capivara') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      if (type === 'airhorn') {
        const freqs = [466.16, 466.16, 466.16, 466.16, 622.25];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, now + idx * 0.08);
          gain.gain.setValueAtTime(0.12, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.16);
        });
      } else if (type === 'badumtss') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'gg') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + i * 0.07);
          gain.gain.setValueAtTime(0.15, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.2);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(480, now + 0.08);
        osc.frequency.linearRampToValueAtTime(220, now + 0.22);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      }
    } catch {
      // ignore
    }
  };

  return (
    <footer className="w-full flex flex-col bg-[#232428] select-none border-t border-[#1f2023] flex-shrink-0 z-20 mt-auto">
      {/* Miniatura Flutuante Picture-in-Picture (quando a stream está ativa e o usuário está navegando em chat/outras abas) */}
      {voiceState.isConnected && screenStream && activeView !== 'voice-stage' && (
        <div className="p-2 border-b border-[#1f2023] bg-[#1a1b1e]">
          <div
            onClick={() => setActiveView('voice-stage')}
            className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-[#2b2d31] hover:border-[#5865f2] cursor-pointer group shadow-xl transition-all"
            title="Clique para voltar à transmissão"
          >
            <video
              ref={pipVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Live Badge */}
            <div className="absolute top-1.5 left-1.5 bg-[#f23f43] text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              AO VIVO
            </div>

            {/* Hover Overlay com botão "Voltar para o stream" */}
            <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity p-2 text-center pointer-events-none">
              <span className="text-white text-xs font-bold flex items-center gap-1 bg-[#5865f2] px-2.5 py-1 rounded shadow">
                <Maximize2 className="w-3.5 h-3.5" />
                Voltar para o stream
              </span>
              <span className="text-[10px] text-[#dbdee1] truncate max-w-full">
                {activeSourceName}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Voice Connection Status Bar & Quick Controls Panel */}
      {voiceState.isConnected && (
        <div className="flex flex-col px-3 pt-2.5 pb-2 border-b border-[#1f2023] bg-[#232428]/95 select-none gap-2">
          {/* Top Row: Connection Status, Ping, Channel/Server, Info, Hangup */}
          <div className="flex items-center justify-between">
            <div
              onClick={() => setActiveView('voice-stage')}
              className="flex items-center space-x-2 cursor-pointer flex-1 min-w-0 pr-2 group"
            >
              <div className="text-[#23a55a] flex items-center justify-center animate-pulse">
                <Signal className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-[12px] font-bold text-[#23a55a] tracking-tight group-hover:underline flex items-center gap-1.5 leading-none">
                  Voz conectada
                  <span className="text-[10px] font-normal text-[#949ba4]">
                    ({voiceState.pingMs || 24}ms)
                  </span>
                </span>
                <span className="text-[11px] text-[#949ba4] truncate mt-1 leading-none font-medium">
                  {voiceState.channelName} / {voiceState.serverName}
                </span>
              </div>
            </div>

            {/* Voice Bar Action Buttons */}
            <div className="flex items-center space-x-0.5">
              <button
                title="Informações de Conexão RTC"
                className="p-1.5 text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c] rounded transition-colors cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={disconnectAll}
                title="Desconectar da chamada"
                className="p-1.5 hover:opacity-80 rounded transition-all cursor-pointer flex items-center justify-center"
                aria-label="Desconectar"
              >
                <img
                  src={getAssetUrl('brand/03_UI_Icons_SVG/btn_call_hangup.svg')}
                  alt="Desconectar"
                  className="w-4 h-4"
                />
              </button>
            </div>
          </div>

          {/* Bottom Row: 4 Quick Control Rounded Buttons */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            {/* 1. Camera Toggle */}
            <button
              onClick={toggleVideo}
              title={isVideoOn ? 'Desligar Câmera' : 'Ligar Câmera'}
              className={`h-8 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                isVideoOn
                  ? 'bg-[#23a55a] text-white hover:bg-[#1a8a4a] shadow-sm'
                  : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] hover:text-white'
              }`}
            >
              {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            {/* 2. Screen Share Toggle (Monitor com seta) */}
            <button
              onClick={() => {
                if (screenStream) {
                  stopScreenShare();
                } else {
                  openShareModal();
                }
              }}
              title={screenStream ? 'Parar Compartilhamento de Tela' : 'Compartilhar sua Tela'}
              className={`h-8 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                screenStream
                  ? 'bg-[#5865f2] text-white hover:bg-[#4752c4] shadow-sm'
                  : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] hover:text-white'
              }`}
            >
              <MonitorUp className="w-4 h-4" />
            </button>

            {/* 3. Iniciar Atividades / Jogos */}
            <button
              onClick={() => setIsActivitiesModalOpen(true)}
              title="Iniciar uma Atividade"
              className="h-8 rounded-md bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] hover:text-white flex items-center justify-center transition-all cursor-pointer group"
            >
              <Rocket className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>

            {/* 4. Efeitos de Som / Placa de Som */}
            <button
              onClick={() => setIsSoundboardOpen((prev) => !prev)}
              title="Abrir Painel de Som"
              className={`h-8 rounded-md flex items-center justify-center transition-all cursor-pointer group ${
                isSoundboardOpen
                  ? 'bg-[#5865f2] text-white'
                  : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] hover:text-white'
              }`}
            >
              <AudioWaveform className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* User Info & Quick Controls Bar */}
      <div className="h-[52px] flex items-center justify-between px-2 bg-[#111214]/60">
        {/* User Card */}
        <div
          ref={userCardRef}
          onClick={() => setIsPopoutOpen((prev) => !prev)}
          className={`flex items-center gap-2 p-1 -ml-1 rounded-[4px] cursor-pointer flex-1 min-w-0 transition-colors group mr-1 ${
            isPopoutOpen ? 'bg-[#35373c]' : 'hover:bg-[#35373c]/50'
          }`}
          title={`${displayName} (@${currentUser.name || 'usuario'})`}
        >
          <div className="relative flex-shrink-0">
            <img
              src={getAvatarUrl(currentUser.avatar)}
              alt={displayName}
              onError={handleAvatarError}
              className="w-8 h-8 rounded-full object-cover bg-[#111214]"
            />
            {/* Status dot / Mascot expression */}
            {currentUser.status === 'idle' ? (
              <img
                src={getAssetUrl('brand/04_Recortes_PNG_Alta_Resolucao/Mascotes_Expressoes/06_Dormindo.png')}
                alt="Ausente"
                title="Ausente (Dormindo)"
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-[#232428] bg-[#1F1F26] object-cover shadow"
              />
            ) : currentUser.status === 'dnd' ? (
              <div
                title="Não perturbar"
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-[#232428] bg-[#f23f43] flex items-center justify-center"
              >
                <div className="w-1.5 h-0.5 bg-[#232428] rounded-full" />
              </div>
            ) : currentUser.status === 'offline' ? (
              <div
                title="Invisível"
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-[#232428] bg-[#80848e] flex items-center justify-center"
              >
                <div className="w-1 h-1 rounded-full bg-[#232428]" />
              </div>
            ) : (
              <span
                title="Disponível"
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-[#232428] ${getStatusColor(
                  currentUser.status
                )}`}
              />
            )}
          </div>

          <div className="flex flex-col min-w-0 leading-tight justify-center flex-1">
            <span className="text-sm font-semibold text-[#f2f3f5] truncate block group-hover:underline">
              {displayName}
            </span>
            {currentServer?.serverTag && tagBadgeIcon ? (
              <span className="text-[11px] text-[#949ba4] truncate flex items-center gap-1 font-medium mt-0.5">
                <img
                  src={tagBadgeIcon}
                  alt="Tag"
                  className="w-3 h-3 object-contain rounded-xs flex-shrink-0"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="truncate">{currentServer.serverTag}</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#949ba4] truncate font-normal mt-0.5">
                {currentUser.customStatus || `@${currentUser.name || 'usuario'}`}
              </span>
            )}
          </div>
        </div>

        {/* Audio / Settings Buttons */}
        <div className="flex items-center gap-0.5 text-[#b5bac1] flex-shrink-0">
          {/* Mute Mic */}
          <button
            onClick={toggleMute}
            title={isMicMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
            className={`w-8 h-8 rounded-[4px] flex items-center justify-center transition-colors cursor-pointer ${
              isMicMuted
                ? 'text-[#f23f43] bg-[#f23f43]/15 hover:bg-[#f23f43]/25'
                : 'hover:bg-[#35373c] hover:text-[#dbdee1]'
            }`}
          >
            {isMicMuted ? (
              <MicOff className="w-5 h-5 text-[#f23f43]" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Deafen Audio */}
          <button
            onClick={toggleDeafen}
            title={isDeafened ? 'Reativar Áudio' : 'Ensurdecer'}
            className={`w-8 h-8 rounded-[4px] flex items-center justify-center transition-colors cursor-pointer ${
              isDeafened
                ? 'text-[#f23f43] bg-[#f23f43]/15 hover:bg-[#f23f43]/25'
                : 'hover:bg-[#35373c] hover:text-[#dbdee1]'
            }`}
          >
            {isDeafened ? (
              <div className="relative flex items-center justify-center">
                <Headphones className="w-5 h-5 text-[#f23f43]" />
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="w-5 h-[2px] bg-[#f23f43] -rotate-45 rounded-[1px] shadow-xs" />
                </span>
              </div>
            ) : (
              <Headphones className="w-5 h-5" />
            )}
          </button>

          {/* User Settings */}
          <button
            onClick={openSettingsModal}
            title="Configurações de Usuário"
            className="w-8 h-8 rounded-[4px] flex items-center justify-center hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors cursor-pointer group"
          >
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* Floating User Profile Popout */}
      <DiscordCurrentUserPopout
        isOpen={isPopoutOpen}
        onClose={() => setIsPopoutOpen(false)}
        anchorRef={userCardRef}
      />

      {/* Floating Soundboard Popover */}
      {isSoundboardOpen && (
        <div
          ref={soundboardRef}
          className="fixed bottom-[118px] left-[78px] w-[260px] bg-[#111214] border border-[#222327] rounded-xl p-3 shadow-2xl z-[9999] select-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#232428]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <AudioWaveform className="w-4 h-4 text-[#5865f2]" />
              <span>Placa de Som</span>
            </div>
            <button
              onClick={() => setIsSoundboardOpen(false)}
              className="text-[#949ba4] hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'airhorn' as const, label: 'Corneta', icon: '🎺' },
              { id: 'quack' as const, label: 'Pato Quack', icon: '🦆' },
              { id: 'badumtss' as const, label: 'Ba-Dum-Tss', icon: '🥁' },
              { id: 'gg' as const, label: 'GG Vitória', icon: '🏆' },
              { id: 'capivara' as const, label: 'Capivara LYC', icon: '🦫' },
            ].map((sound) => (
              <button
                key={sound.id}
                onClick={() => playSoundEffect(sound.id)}
                className="flex items-center gap-2 p-2 rounded-lg bg-[#1e1f22] hover:bg-[#2b2d31] hover:border-[#5865f2] border border-[#232428] text-xs font-medium text-white transition-all cursor-pointer group active:scale-95"
              >
                <span className="text-base group-hover:scale-110 transition-transform">{sound.icon}</span>
                <span className="truncate text-[11px]">{sound.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activities / Jogos Modal */}
      {isActivitiesModalOpen && (
        <div
          onClick={() => setIsActivitiesModalOpen(false)}
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#313338] rounded-xl shadow-2xl border border-[#202225] p-5 space-y-4 animate-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#232428]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#5865f2]/20 text-[#5865f2]">
                  <Rocket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Atividades e Jogos</h3>
                  <p className="text-xs text-[#949ba4]">Jogue ou assista a vídeos juntos no canal de voz!</p>
                </div>
              </div>
              <button
                onClick={() => setIsActivitiesModalOpen(false)}
                className="text-[#949ba4] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {[
                { title: 'Putt Party', desc: 'Mini golfe casual para até 8 amigos.', icon: '⛳', tag: 'Divertido' },
                { title: 'Chess in the Park', desc: 'Xadrez estratégico clássico ao vivo.', icon: '♟️', tag: 'Estratégia' },
                { title: 'Watch Together', desc: 'Assista a vídeos do YouTube em sincronia.', icon: '🍿', tag: 'Vídeo' },
                { title: 'Gartic Esboço', desc: 'Adivinhe desenhos em tempo real.', icon: '🎨', tag: 'Social' },
              ].map((act) => (
                <div
                  key={act.title}
                  onClick={() => {
                    setActiveView('voice-stage');
                    setIsActivitiesModalOpen(false);
                  }}
                  className="bg-[#2b2d31] hover:bg-[#35373c] border border-[#202225] hover:border-[#5865f2] rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{act.icon}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1e1f22] text-[#949ba4] group-hover:text-white">
                      {act.tag}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-[#5865f2] transition-colors">
                      {act.title}
                    </h4>
                    <p className="text-[11px] text-[#949ba4] leading-tight mt-1">
                      {act.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
