import React, { useState, useEffect } from 'react';
import {
  useVoiceStreamStore,
  StreamQuality,
  VideoResolution,
  VideoFrameRate,
  QualityPreset,
  BitrateMode,
} from '../../store/voiceStreamStore';
import { useDiscord } from '../../store/discordStore';
import { getAssetUrl } from '../../utils/assets';
import {
  X,
  Monitor,
  AppWindow,
  Radio,
  Check,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';

export const DiscordScreenShareModal: React.FC = () => {
  const {
    isShareModalOpen,
    closeShareModal,
    availableSources,
    selectedSource,
    setSelectedSource,
    quality,
    setQuality,
    startScreenShare,
  } = useVoiceStreamStore();

  const { setActiveView } = useDiscord();

  const [activeTab, setActiveTab] = useState<'screen' | 'window'>('screen');
  const [selectedQuality, setSelectedQuality] = useState<StreamQuality>(quality);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Sync internal quality with store
  useEffect(() => {
    setSelectedQuality(quality);
  }, [quality]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isShareModalOpen) {
        closeShareModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShareModalOpen, closeShareModal]);

  if (!isShareModalOpen) return null;

  const screens = availableSources.filter((s) => s.id.startsWith('screen:'));
  const windows = availableSources.filter((s) => !s.id.startsWith('screen:'));
  const currentList = activeTab === 'screen' ? screens : windows;

  const handlePresetSelect = (preset: QualityPreset) => {
    if (preset === 'economy') {
      setSelectedQuality((q) => ({
        ...q,
        preset: 'economy',
        resolution: '144p',
        frameRate: 10,
        bitrateKbps: 200,
      }));
    } else if (preset === 'low_internet') {
      setSelectedQuality((q) => ({
        ...q,
        preset: 'low_internet',
        resolution: '360p',
        frameRate: 15,
        bitrateKbps: 500,
      }));
    } else if (preset === 'balanced') {
      setSelectedQuality((q) => ({
        ...q,
        preset: 'balanced',
        resolution: '480p',
        frameRate: 30,
        bitrateKbps: 1000,
      }));
    } else if (preset === 'high') {
      setSelectedQuality((q) => ({
        ...q,
        preset: 'high',
        resolution: '720p',
        frameRate: 30,
        bitrateKbps: 2500,
      }));
    } else if (preset === 'ultra') {
      setSelectedQuality((q) => ({
        ...q,
        preset: 'ultra',
        resolution: '1080p',
        frameRate: 60,
        bitrateKbps: 5000,
      }));
    }
  };

  const handleResolutionChange = (res: VideoResolution) => {
    setSelectedQuality((q) => ({
      ...q,
      resolution: res,
      preset: 'custom',
    }));
  };

  const handleFrameRateChange = (fps: VideoFrameRate) => {
    setSelectedQuality((q) => ({
      ...q,
      frameRate: fps,
      preset: 'custom',
    }));
  };

  const handleStartShare = async () => {
    if (!selectedSource || isStarting) return;
    setIsStarting(true);
    try {
      setQuality(selectedQuality);
      await startScreenShare(selectedSource, selectedQuality);
      setActiveView('voice-stage');
    } finally {
      setIsStarting(false);
    }
  };

  const RESOLUTIONS: { id: VideoResolution; label: string }[] = [
    { id: '144p', label: '144p' },
    { id: '240p', label: '240p' },
    { id: '360p', label: '360p' },
    { id: '480p', label: '480p' },
    { id: '720p', label: '720p' },
    { id: '1080p', label: '1080p' },
  ];

  const FRAMERATES: VideoFrameRate[] = [10, 15, 24, 30, 60];

  const PRESETS: { id: QualityPreset; label: string; desc: string }[] = [
    { id: 'economy', label: 'Economia máxima', desc: '144p • 10 FPS' },
    { id: 'low_internet', label: 'Internet fraca', desc: '360p • 15 FPS' },
    { id: 'balanced', label: 'Equilibrado', desc: '480p • 30 FPS' },
    { id: 'high', label: 'Alta qualidade', desc: '720p • 30 FPS' },
    { id: 'ultra', label: 'Máxima qualidade', desc: '1080p • 60 FPS' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#2b2d31] w-full max-w-[700px] rounded-2xl shadow-2xl border border-[#35373c]/50 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 p-6 space-y-5">
        {/* 1. Header com Mascote Oficial CapyChat */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={getAssetUrl('assets/capy-avatar-screenshare.png')}
              alt="CapyChat Mascote"
              className="w-11 h-11 object-contain flex-shrink-0 drop-shadow-md"
            />
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Compartilhe sua tela
              </h2>
              <p className="text-xs text-[#949ba4] mt-0.5">
                Escolha o que você deseja compartilhar.
              </p>
            </div>
          </div>

          <button
            onClick={closeShareModal}
            className="text-[#949ba4] hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Abas: Telas (N) / Aplicativos (N) com indicador roxo */}
        <div className="flex items-center gap-8 border-b border-[#35373c] relative select-none">
          <button
            onClick={() => {
              setActiveTab('screen');
              if (screens.length > 0 && !selectedSource?.id.startsWith('screen:')) {
                setSelectedSource(screens[0]);
              }
            }}
            className={`pb-2.5 text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors relative ${
              activeTab === 'screen' ? 'text-white' : 'text-[#949ba4] hover:text-[#dbdee1]'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Telas ({screens.length})</span>
            {activeTab === 'screen' && (
              <div className="absolute -bottom-[1px] left-0 right-0 h-[2.5px] bg-[#5865f2] rounded-full" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('window');
              if (windows.length > 0 && selectedSource?.id.startsWith('screen:')) {
                setSelectedSource(windows[0]);
              }
            }}
            className={`pb-2.5 text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors relative ${
              activeTab === 'window' ? 'text-white' : 'text-[#949ba4] hover:text-[#dbdee1]'
            }`}
          >
            <AppWindow className="w-4 h-4" />
            <span>Aplicativos ({windows.length})</span>
            {activeTab === 'window' && (
              <div className="absolute -bottom-[1px] left-0 right-0 h-[2.5px] bg-[#5865f2] rounded-full" />
            )}
          </button>
        </div>

        {/* 3. Grid de Cartões de Prévia Amplos */}
        <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
          {currentList.length === 0 ? (
            <div className="col-span-full py-12 text-center text-[#949ba4] text-xs">
              Nenhuma fonte encontrada nesta categoria.
            </div>
          ) : (
            currentList.map((source) => {
              const isSelected = selectedSource?.id === source.id;

              return (
                <div
                  key={source.id}
                  onClick={() => setSelectedSource(source)}
                  className={`group relative flex flex-col p-2 bg-[#1e1f22] rounded-xl cursor-pointer transition-all border-2 ${
                    isSelected
                      ? 'border-[#5865f2] shadow-lg shadow-[#5865f2]/10'
                      : 'border-transparent hover:border-[#35373c] hover:bg-[#1e1f22]/90'
                  }`}
                >
                  {/* Thumbnail com proporção ampla */}
                  <div className="w-full aspect-[16/10] bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
                    <img
                      src={source.thumbnail}
                      alt={source.name}
                      className="w-full h-full object-contain"
                    />
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[#5865f2] text-white flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Nome da fonte no rodapé do cartão */}
                  <div className="pt-2 px-1 pb-0.5">
                    <span
                      className={`text-sm truncate block ${
                        isSelected
                          ? 'text-white font-bold'
                          : 'text-[#dbdee1] font-semibold group-hover:text-white'
                      }`}
                      title={source.name}
                    >
                      {source.name}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Seletores de Resolução e Taxa de Quadros */}
        <div className="grid grid-cols-2 gap-4 pt-1">
          {/* Seletor de Resolução */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
              RESOLUÇÃO
            </span>
            <div className="flex bg-[#1e1f22] p-1 rounded-xl border border-[#35373c]/50 gap-1">
              {RESOLUTIONS.map((res) => {
                const isSel = selectedQuality.resolution === res.id;
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => handleResolutionChange(res.id)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      isSel
                        ? 'bg-[#5865f2] text-white shadow-sm'
                        : 'text-[#949ba4] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {res.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seletor de Taxa de Quadros (FPS) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
              TAXA DE QUADROS
            </span>
            <div className="flex bg-[#1e1f22] p-1 rounded-xl border border-[#35373c]/50 gap-1">
              {FRAMERATES.map((fps) => {
                const isSel = selectedQuality.frameRate === fps;
                return (
                  <button
                    key={fps}
                    type="button"
                    onClick={() => handleFrameRateChange(fps)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      isSel
                        ? 'bg-[#5865f2] text-white shadow-sm'
                        : 'text-[#949ba4] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {fps} FPS
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 5. Configurações Avançadas Recolhidas por Padrão */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#949ba4] hover:text-white transition-colors cursor-pointer select-none"
          >
            <Sliders className="w-3.5 h-3.5 text-[#5865f2]" />
            <span>Configurações avançadas</span>
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3.5 bg-[#1e1f22] rounded-xl border border-[#35373c]/50 space-y-3 animate-in fade-in duration-150">
              {/* Perfis Rápidos */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                  Perfis rápidos de qualidade
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => {
                    const isActive = selectedQuality.preset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePresetSelect(p.id)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#5865f2]/20 border-[#5865f2] text-white'
                            : 'bg-[#2b2d31] border-[#35373c] text-[#949ba4] hover:text-white'
                        }`}
                        title={p.desc}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Otimizar para texto e código */}
              <div className="flex items-center justify-between pt-2 border-t border-[#2b2d31]">
                <div>
                  <label
                    htmlFor="text-opt"
                    className="text-xs font-semibold text-white block cursor-pointer"
                  >
                    Otimizar para texto e código
                  </label>
                  <span className="text-[11px] text-[#949ba4]">
                    Prioriza nitidez espacial de fontes finas e interfaces com texto pequeno.
                  </span>
                </div>
                <input
                  id="text-opt"
                  type="checkbox"
                  checked={Boolean(selectedQuality.optimizeForText)}
                  onChange={(e) =>
                    setSelectedQuality((q) => ({
                      ...q,
                      optimizeForText: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-[#5865f2] rounded cursor-pointer"
                />
              </div>

              {/* Transmitir áudio do computador */}
              <div className="flex items-center justify-between pt-2 border-t border-[#2b2d31]">
                <div>
                  <label
                    htmlFor="audio-opt"
                    className="text-xs font-semibold text-white block cursor-pointer"
                  >
                    Transmitir áudio do computador
                  </label>
                  <span className="text-[11px] text-[#949ba4]">
                    Compartilha o som do aplicativo ou do sistema operacional durante a chamada.
                  </span>
                </div>
                <input
                  id="audio-opt"
                  type="checkbox"
                  checked={Boolean(selectedQuality.includeAudio)}
                  onChange={(e) =>
                    setSelectedQuality((q) => ({
                      ...q,
                      includeAudio: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-[#5865f2] rounded cursor-pointer"
                />
              </div>

              {/* Controle de Bitrate */}
              <div className="pt-2 border-t border-[#2b2d31] flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Taxa de bits (Bitrate)</span>
                <div className="flex bg-[#2b2d31] p-0.5 rounded-lg border border-[#35373c] gap-0.5 text-xs">
                  {[
                    { val: 'auto' as BitrateMode, label: 'Auto' },
                    { val: 200 as BitrateMode, label: '200k' },
                    { val: 500 as BitrateMode, label: '500k' },
                    { val: 1000 as BitrateMode, label: '1M' },
                    { val: 2500 as BitrateMode, label: '2.5M' },
                    { val: 5000 as BitrateMode, label: '5M' },
                  ].map((item) => (
                    <button
                      key={String(item.val)}
                      type="button"
                      onClick={() =>
                        setSelectedQuality((q) => ({
                          ...q,
                          bitrateKbps: item.val,
                        }))
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        selectedQuality.bitrateKbps === item.val
                          ? 'bg-[#5865f2] text-white'
                          : 'text-[#949ba4] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Rodapé com Cancelar e Compartilhar tela */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={closeShareModal}
            className="text-sm font-semibold text-[#dbdee1] hover:underline cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleStartShare}
            disabled={!selectedSource || isStarting}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${
              selectedSource && !isStarting
                ? 'bg-[#5865f2] hover:bg-[#4752c4] text-white cursor-pointer active:scale-95 shadow-[#5865f2]/25'
                : 'bg-[#1e1f22] text-[#80848e] cursor-not-allowed border border-[#35373c]/50'
            }`}
          >
            <Radio className={`w-4 h-4 ${isStarting ? 'animate-pulse' : ''}`} />
            <span>{isStarting ? 'Iniciando...' : 'Compartilhar tela'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
