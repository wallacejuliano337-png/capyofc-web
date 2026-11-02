import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  RefreshCw,
  Play,
  Tv,
  X,
  Radio,
  Clock,
  Layers,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';
import { voiceService } from '../../services/voiceService';
import { useVoiceStreamStore } from '../../store/voiceStreamStore';
import { useDiscord } from '../../store/discordStore';

export interface VideoElementDebugInfo {
  videoWidth: number;
  videoHeight: number;
  readyState: number;
  readyStateLabel: string;
  paused: boolean;
  muted: boolean;
  currentTime: number;
  lastEvent: string;
  lastEventTime: number | null;
  playResult: string;
}

interface WebRTCDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoEl: HTMLVideoElement | null;
  videoDebugInfo: VideoElementDebugInfo;
  activePresenterId?: string | null;
  onForceKeyframe?: () => void;
  onForcePlay?: () => void;
}

const READY_STATE_MAP: Record<number, string> = {
  0: 'HAVE_NOTHING (0)',
  1: 'HAVE_METADATA (1)',
  2: 'HAVE_CURRENT_DATA (2)',
  3: 'HAVE_FUTURE_DATA (3)',
  4: 'HAVE_ENOUGH_DATA (4)',
};

export const WebRTCDiagnosticsModal: React.FC<WebRTCDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  videoEl,
  videoDebugInfo,
  activePresenterId,
  onForceKeyframe,
  onForcePlay,
}) => {
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const currentUser = useDiscord((s) => s.currentUser);
  const activeSourceName = useVoiceStreamStore((s) => s.activeSourceName);

  const refreshData = async () => {
    try {
      const diag = await voiceService.getDiagnostics();
      setData(diag);
    } catch (e) {
      console.warn('[WebRTCDiagnostics] Error refreshing data:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void refreshData();
    const interval = setInterval(refreshData, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  // Pipeline status evaluation
  const localCap = data?.localCapture;
  const isLocalCapturing = Boolean(localCap?.isCapturing);
  const peerList = data?.peers || [];
  const targetPeer = activePresenterId
    ? peerList.find((p: any) => p.peerId === activePresenterId) || peerList[0]
    : peerList[0];

  const inStats = targetPeer?.inboundVideo || {};
  const outStats = targetPeer?.outboundVideo || {};

  // Pipeline diagnosis calculation
  let pipelineStep = 'AGUARDANDO';
  let pipelineColor = 'text-gray-400';
  let pipelineMessage = 'Nenhuma transmissão ativa detectada no momento.';

  if (isLocalCapturing) {
    if (!localCap.hasVideoTrack || localCap.readyState !== 'live') {
      pipelineStep = 'FALHA NA CAPTURA LOCAL';
      pipelineColor = 'text-red-400';
      pipelineMessage = 'A captura foi iniciada, mas o track de vídeo local não está live.';
    } else if (outStats.bytesSent === 0 && peerList.length > 0) {
      pipelineStep = 'FALHA NO ENVIO (RTP)';
      pipelineColor = 'text-orange-400';
      pipelineMessage = 'Track de vídeo capturada, mas nenhum byte RTP está saindo pelo sender.';
    } else {
      pipelineStep = 'TRANSMISSÃO LOCAL ATIVA';
      pipelineColor = 'text-green-400';
      pipelineMessage = `Transmitindo ativamente: ${outStats.bytesSent || 0} bytes enviados, ${outStats.framesSent || 0} frames.`;
    }
  } else if (activePresenterId) {
    if (!targetPeer) {
      pipelineStep = 'FALHA NA SINALIZAÇÃO';
      pipelineColor = 'text-red-400';
      pipelineMessage = `Nenhuma RTCPeerConnection encontrada para o apresentador ${activePresenterId}.`;
    } else if (targetPeer.iceConnectionState !== 'connected' && targetPeer.iceConnectionState !== 'completed') {
      pipelineStep = 'FALHA NO ICE';
      pipelineColor = 'text-yellow-400';
      pipelineMessage = `Conexão ICE ainda não conectada (Estado atual: ${targetPeer.iceConnectionState}).`;
    } else if ((inStats.bytesReceived || 0) === 0) {
      pipelineStep = 'FALHA NA RECEPÇÃO';
      pipelineColor = 'text-orange-400';
      pipelineMessage = 'Conexão ICE estabelecida, mas 0 bytes RTP de vídeo recebidos do apresentador.';
    } else if ((inStats.framesDecoded || 0) === 0) {
      pipelineStep = 'FALHA NA DECODIFICAÇÃO (FALTA KEYFRAME)';
      pipelineColor = 'text-purple-400';
      pipelineMessage = `Recebendo pacotes (${inStats.bytesReceived} bytes), mas 0 frames decodificados! Aguardando IDR/Keyframe.`;
    } else if (videoDebugInfo.videoWidth === 0 || videoDebugInfo.paused) {
      pipelineStep = 'FALHA NO PLAYER DE VÍDEO';
      pipelineColor = 'text-yellow-400';
      pipelineMessage = `Frames decodificados com sucesso (${inStats.framesDecoded}), mas o elemento <video> está paused=${videoDebugInfo.paused} com width=${videoDebugInfo.videoWidth}.`;
    } else {
      pipelineStep = 'RECEBENDO E REPRODUZINDO COM SUCESSO';
      pipelineColor = 'text-green-400';
      pipelineMessage = `Vídeo ativo: ${videoDebugInfo.videoWidth}x${videoDebugInfo.videoHeight}, ${inStats.framesDecoded} frames decodificados.`;
    }
  }

  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      currentUser: { id: currentUser.id, name: currentUser.name },
      pipelineStatus: { step: pipelineStep, message: pipelineMessage },
      localCapture: data?.localCapture,
      videoElement: {
        ...videoDebugInfo,
        videoWidth: videoEl?.videoWidth || videoDebugInfo.videoWidth,
        videoHeight: videoEl?.videoHeight || videoDebugInfo.videoHeight,
        paused: videoEl?.paused ?? videoDebugInfo.paused,
        readyState: videoEl?.readyState ?? videoDebugInfo.readyState,
        readyStateLabel: READY_STATE_MAP[videoEl?.readyState ?? videoDebugInfo.readyState] || 'DESCONHECIDO',
      },
      peers: data?.peers,
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#1e1f22] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-[#35373c] flex flex-col overflow-hidden text-[#dbdee1]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2d31] bg-[#111214]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#5865f2]/20 text-[#5865f2]">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Diagnóstico de Transmissão WebRTC
                </h2>
                <span className="text-[10px] bg-[#5865f2] text-white px-2 py-0.5 rounded-full font-semibold uppercase">
                  Capy.ofc 0.2.0
                </span>
              </div>
              <p className="text-xs text-[#949ba4]">
                Auditoria em tempo real de captura, ICE, codecs, recepção e decodificação
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              title="Atualizar agora"
              className="p-2 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-xs font-medium text-white transition-colors cursor-pointer border border-white/5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copiado!' : 'Copiar Relatório'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Bar: Diagnóstico do Pipeline */}
        <div className="px-6 py-3 bg-[#18191c] border-b border-[#2b2d31] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#949ba4] uppercase tracking-wider">
              Diagnóstico do Pipeline:
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded bg-black/40 border border-white/10 ${pipelineColor}`}>
              {pipelineStep}
            </span>
          </div>
          <div className="text-xs text-[#949ba4] truncate max-w-lg">
            {pipelineMessage}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 1. Etapas do Pipeline Visual (Stepper) */}
          <div className="bg-[#111214] p-4 rounded-xl border border-[#2b2d31]">
            <h3 className="text-xs font-bold uppercase text-[#949ba4] tracking-wider mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#5865f2]" />
              Status por Etapa do Pipeline
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center text-xs">
              {/* 1. Captura */}
              <div className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 ${
                localCap?.isCapturing ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#1e1f22] border-[#2b2d31] text-[#949ba4]'
              }`}>
                <Radio className="w-4 h-4" />
                <span className="font-semibold text-[11px]">1. Captura</span>
                <span className="text-[10px] opacity-80">{localCap?.isCapturing ? 'Ativa' : 'Inativa'}</span>
              </div>

              {/* 2. Envio */}
              <div className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 ${
                (outStats.bytesSent || 0) > 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#1e1f22] border-[#2b2d31] text-[#949ba4]'
              }`}>
                <ArrowUpCircle className="w-4 h-4" />
                <span className="font-semibold text-[11px]">2. Envio</span>
                <span className="text-[10px] opacity-80">{(outStats.bytesSent || 0) > 0 ? `${outStats.framesSent}f` : '0 bytes'}</span>
              </div>

              {/* 3. Negociação */}
              <div className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 ${
                targetPeer?.signalingState === 'stable' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#1e1f22] border-[#2b2d31] text-yellow-400'
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-semibold text-[11px]">3. SDP</span>
                <span className="text-[10px] opacity-80">{targetPeer?.signalingState || 'idle'}</span>
              </div>

              {/* 4. ICE */}
              <div className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 ${
                targetPeer?.iceConnectionState === 'connected' || targetPeer?.iceConnectionState === 'completed'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : targetPeer?.iceConnectionState === 'checking'
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                  : 'bg-[#1e1f22] border-[#2b2d31] text-[#949ba4]'
              }`}>
                <Activity className="w-4 h-4" />
                <span className="font-semibold text-[11px]">4. ICE</span>
                <span className="text-[10px] opacity-80">{targetPeer?.iceConnectionState || 'idle'}</span>
              </div>

              {/* 5. Recepção */}
              <div className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 ${
                (inStats.bytesReceived || 0) > 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#1e1f22] border-[#2b2d31] text-[#949ba4]'
              }`}>
                <ArrowDownCircle className="w-4 h-4" />
                <span className="font-semibold text-[11px]">5. Recepção</span>
                <span className="text-[10px] opacity-80">{(inStats.bytesReceived || 0) > 0 ? `${inStats.framesReceived}f` : '0 bytes'}</span>
              </div>

              {/* 6. Decodificação */}
              <div className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 ${
                (inStats.framesDecoded || 0) > 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' : (inStats.bytesReceived || 0) > 0 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-[#1e1f22] border-[#2b2d31] text-[#949ba4]'
              }`}>
                <Layers className="w-4 h-4" />
                <span className="font-semibold text-[11px]">6. Decode</span>
                <span className="text-[10px] opacity-80">{(inStats.framesDecoded || 0) > 0 ? `${inStats.framesDecoded}f` : '0 dec'}</span>
              </div>

              {/* 7. Player */}
              <div className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 ${
                videoDebugInfo.videoWidth > 0 && !videoDebugInfo.paused
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-[#1e1f22] border-[#2b2d31] text-[#949ba4]'
              }`}>
                <Play className="w-4 h-4" />
                <span className="font-semibold text-[11px]">7. Player</span>
                <span className="text-[10px] opacity-80">{videoDebugInfo.videoWidth > 0 ? `${videoDebugInfo.videoWidth}p` : 'vazio'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 2. Captura Local */}
            <div className="bg-[#111214] p-4 rounded-xl border border-[#2b2d31]">
              <h3 className="text-xs font-bold uppercase text-[#949ba4] tracking-wider mb-3 flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#23a55a]" />
                Captura Local (Transmissor)
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Captura Iniciada:</span>
                  <span className={`font-semibold ${localCap?.isCapturing ? 'text-green-400' : 'text-gray-400'}`}>
                    {localCap?.isCapturing ? 'SIM' : 'NÃO'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Track de Vídeo:</span>
                  <span className="font-semibold text-white">{localCap?.hasVideoTrack ? 'Encontrada' : 'Nenhuma'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Track readyState:</span>
                  <span className={`font-semibold ${localCap?.readyState === 'live' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {localCap?.readyState || 'none'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Track Muted:</span>
                  <span className="font-semibold text-white">{localCap?.muted === true ? 'MUTADA (Silenciada)' : localCap?.muted === false ? 'NÃO' : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Resolução Capturada:</span>
                  <span className="font-semibold text-white">{localCap?.width ? `${localCap.width} x ${localCap.height} @ ${localCap.frameRate || 30}fps` : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Fonte Selecionada:</span>
                  <span className="font-semibold text-[#8b5cf6]">{activeSourceName || 'Padrão'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#949ba4]">Frames Enviados (outbound):</span>
                  <span className="font-semibold text-white">{outStats.framesSent || 0} ({outStats.bytesSent ? `${(outStats.bytesSent / 1024).toFixed(1)} KB` : '0 KB'})</span>
                </div>
              </div>
            </div>

            {/* 3. Elemento <video> do Palco */}
            <div className="bg-[#111214] p-4 rounded-xl border border-[#2b2d31]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase text-[#949ba4] tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#5865f2]" />
                  Elemento de Vídeo (&lt;video&gt;)
                </h3>
                {onForcePlay && (
                  <button
                    onClick={onForcePlay}
                    className="px-2 py-0.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-[11px] font-semibold text-white transition-colors cursor-pointer"
                  >
                    Forçar Play
                  </button>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Dimensões Reais:</span>
                  <span className={`font-semibold ${videoDebugInfo.videoWidth > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {videoDebugInfo.videoWidth > 0 ? `${videoDebugInfo.videoWidth} x ${videoDebugInfo.videoHeight}` : '0 x 0 (Sem imagem)'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Estado de Prontidão (readyState):</span>
                  <span className="font-semibold text-white">
                    {READY_STATE_MAP[videoDebugInfo.readyState] || videoDebugInfo.readyState}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Pausado / Mudo:</span>
                  <span className="font-semibold text-white">
                    paused={String(videoDebugInfo.paused)}, muted={String(videoDebugInfo.muted)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Tempo Atual (currentTime):</span>
                  <span className="font-semibold text-white">{videoDebugInfo.currentTime?.toFixed(2) || '0.00'}s</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f2023]">
                  <span className="text-[#949ba4]">Resultado do play():</span>
                  <span className={`font-semibold ${videoDebugInfo.playResult.includes('OK') ? 'text-green-400' : videoDebugInfo.playResult.includes('Erro') ? 'text-red-400' : 'text-gray-400'}`}>
                    {videoDebugInfo.playResult || 'Aguardando'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#949ba4]">Último Evento DOM:</span>
                  <span className="font-semibold text-[#5865f2]">
                    {videoDebugInfo.lastEvent || 'Nenhum'} {videoDebugInfo.lastEventTime ? `(${((Date.now() - videoDebugInfo.lastEventTime) / 1000).toFixed(1)}s atrás)` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Conexão WebRTC & Transceivers */}
          <div className="bg-[#111214] p-4 rounded-xl border border-[#2b2d31]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase text-[#949ba4] tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#8b5cf6]" />
                WebRTC PeerConnection &amp; Transceivers
              </h3>
              {onForceKeyframe && (
                <button
                  onClick={onForceKeyframe}
                  className="px-2 py-0.5 rounded bg-[#8b5cf6] hover:bg-[#7c3aed] text-[11px] font-semibold text-white transition-colors cursor-pointer"
                >
                  Solicitar Keyframe (IDR)
                </button>
              )}
            </div>

            {peerList.length === 0 ? (
              <p className="text-xs text-[#949ba4] py-2">
                Nenhum peer remoto conectado no canal de voz atualmente.
              </p>
            ) : (
              peerList.map((p: any, idx: number) => {
                const tr = p.transceiver;
                return (
                  <div key={`peer-diag-${p.peerId || idx}`} className="space-y-2 text-xs border border-[#1f2023] p-3 rounded-lg mb-2">
                    <div className="flex items-center justify-between pb-1 border-b border-[#2b2d31]">
                      <span className="font-bold text-white">Peer: {p.peerId}</span>
                      <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                        p.connectionState === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        Connection: {p.connectionState}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1 text-[11px]">
                      <div>
                        <span className="text-[#949ba4]">ICE State: </span>
                        <span className="font-semibold text-white">{p.iceConnectionState}</span>
                      </div>
                      <div>
                        <span className="text-[#949ba4]">ICE Gathering: </span>
                        <span className="font-semibold text-white">{p.iceGatheringState}</span>
                      </div>
                      <div>
                        <span className="text-[#949ba4]">Signaling: </span>
                        <span className="font-semibold text-white">{p.signalingState}</span>
                      </div>
                      <div>
                        <span className="text-[#949ba4]">Sessão Remota: </span>
                        <span className="font-semibold text-white">{p.activeSession?.status || 'Inativa'}</span>
                      </div>
                    </div>

                    {tr && (
                      <div className="bg-[#18191c] p-2 rounded text-[11px] space-y-1 mt-1 border border-white/5">
                        <div className="flex justify-between">
                          <span className="text-[#949ba4]">Transceiver MID / Direção:</span>
                          <span className="font-semibold text-white">MID={tr.mid || 'none'}, dir={tr.direction} (atual={tr.currentDirection})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#949ba4]">Sender Track:</span>
                          <span className="font-semibold text-white">{tr.senderTrack ? `${tr.senderTrack.readyState} (muted=${tr.senderTrack.muted})` : 'none'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#949ba4]">Receiver Track:</span>
                          <span className="font-semibold text-white">{tr.receiverTrack ? `${tr.receiverTrack.readyState} (muted=${tr.receiverTrack.muted})` : 'none'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 5. Métricas RTP em Tempo Real (getStats) */}
          <div className="bg-[#111214] p-4 rounded-xl border border-[#2b2d31]">
            <h3 className="text-xs font-bold uppercase text-[#949ba4] tracking-wider mb-3 flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-[#23a55a]" />
              Métricas de Recepção de Vídeo (inbound-rtp via getStats)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded bg-[#18191c] border border-[#2b2d31]">
                <div className="text-[11px] text-[#949ba4]">Bytes Recebidos</div>
                <div className="text-sm font-bold text-white mt-1">
                  {inStats.bytesReceived ? `${(inStats.bytesReceived / 1024).toFixed(1)} KB` : '0 bytes'}
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#18191c] border border-[#2b2d31]">
                <div className="text-[11px] text-[#949ba4]">Frames Recebidos</div>
                <div className="text-sm font-bold text-white mt-1">{inStats.framesReceived || 0}</div>
              </div>
              <div className="p-2.5 rounded bg-[#18191c] border border-[#2b2d31]">
                <div className="text-[11px] text-[#949ba4]">Frames Decodificados</div>
                <div className={`text-sm font-bold mt-1 ${inStats.framesDecoded > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {inStats.framesDecoded || 0}
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#18191c] border border-[#2b2d31]">
                <div className="text-[11px] text-[#949ba4]">Keyframes Decodificados</div>
                <div className="text-sm font-bold text-purple-400 mt-1">{inStats.keyFramesDecoded || 0}</div>
              </div>
              <div className="p-2.5 rounded bg-[#18191c] border border-[#2b2d31]">
                <div className="text-[11px] text-[#949ba4]">Frames Descartados</div>
                <div className="text-sm font-bold text-white mt-1">{inStats.framesDropped || 0}</div>
              </div>
              <div className="p-2.5 rounded bg-[#18191c] border border-[#2b2d31]">
                <div className="text-[11px] text-[#949ba4]">FPS Medido</div>
                <div className="text-sm font-bold text-white mt-1">{inStats.framesPerSecond || 0} fps</div>
              </div>
              <div className="p-2.5 rounded bg-[#18191c] border border-[#2b2d31]">
                <div className="text-[11px] text-[#949ba4]">Resolução Recebida</div>
                <div className="text-sm font-bold text-white mt-1">
                  {inStats.frameWidth ? `${inStats.frameWidth} x ${inStats.frameHeight}` : 'N/A'}
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#18191c] border border-[#2b2d31]">
                <div className="text-[11px] text-[#949ba4]">Perda de Pacotes (Jitter)</div>
                <div className="text-sm font-bold text-white mt-1">
                  {inStats.packetsLost || 0} ({inStats.jitter ? `${(inStats.jitter * 1000).toFixed(1)}ms` : '0ms'})
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#2b2d31] bg-[#111214] flex items-center justify-between text-xs text-[#949ba4]">
          <span>Atualizado automaticamente a cada 1000ms</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium transition-colors cursor-pointer"
          >
            Fechar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
};
