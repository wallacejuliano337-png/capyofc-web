import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDiscord, currentUser } from '../../store/discordStore';
import { useTheme } from '../../store/themeStore';
import { SettingsTab } from '../../types/discord';
import {
  X,
  User,
  Palette,
  Shield,
  AppWindow,
  Link2,
  Sparkles,
  Zap,
  Infinity,
  CreditCard,
  Monitor,
  Eye,
  Volume2,
  Bell,
  Keyboard,
  Globe,
  LogOut,
  Check,
  Mic,
  Camera,
  Play,
  Square,
  Radio,
  Sliders,
  ChevronDown,
  Pencil,
  Phone,
  Mail,
  ShieldAlert,
  Upload,
  RefreshCw,
  Award,
} from 'lucide-react';
import { DiscordUltraPassView } from './DiscordUltraPassView';
import { DiscordBadgesSettingsSection } from './DiscordBadgesSettingsSection';
import { CapyBadgeIcon } from './CapyBadgeIcon';
import { getUserUnlockedBadgeIds, getDisplayedBadgeIds } from '../../types/badges';
import { useAutoUpdate } from '../../services/autoUpdateService';

export const DiscordSettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    closeSettingsModal,
    activeSettingsTab,
    setActiveSettingsTab,
    currentUser,
    updateCurrentUser,
    isLoggingOut,
    logout,
  } = useDiscord();

  const {
    currentVersion,
    isUpdateAvailable,
    isChecking,
    checkForUpdates,
    simulateUpdate,
  } = useAutoUpdate();

  // ── 1. Estado da Aba Minha Conta & Perfis ──────────────────────────────────
  const [displayName, setDisplayName] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('lycDisplayName')) || currentUser.displayName || 'LycUser';
  });
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(displayName);

  const [username, setUsername] = useState<string>(currentUser.name);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState(username);

  const [isEmailRevealed, setIsEmailRevealed] = useState(false);
  const [avatar, setAvatar] = useState<string>(currentUser.avatar);
  const [bannerColor, setBannerColor] = useState<string>(currentUser.bannerColor || '#5865f2');
  const [bannerImage, setBannerImage] = useState<string | null>(currentUser.bannerImage || null);
  const [aboutMe, setAboutMe] = useState<string>(currentUser.aboutMe || 'Desenvolvedor & Membro Fundador da LYC Arena.');
  const [pronouns, setPronouns] = useState<string>('ele/dele');
  const [hasProfileChanges, setHasProfileChanges] = useState(false);

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerProfileFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isSettingsModalOpen) {
      setDisplayName((typeof window !== 'undefined' && localStorage.getItem('lycDisplayName')) || currentUser.displayName || 'LycUser');
      setUsername(currentUser.name);
      setAvatar(currentUser.avatar);
      setBannerColor(currentUser.bannerColor || '#5865f2');
      setBannerImage(currentUser.bannerImage || null);
      setAboutMe(currentUser.aboutMe || 'Desenvolvedor & Membro Fundador da LYC Arena.');
      setHasProfileChanges(false);
    }
  }, [isSettingsModalOpen, currentUser]);

  // Listener para fechar modal imediatamente com a tecla Escape
  useEffect(() => {
    if (!isSettingsModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSettingsModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, closeSettingsModal]);

  // ── 2. Estado da Aba Voz e Vídeo ──────────────────────────────────────────
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);

  const [selectedInputDevice, setSelectedInputDevice] = useState<string>(
    (typeof window !== 'undefined' && localStorage.getItem('lyc_selected_input_device')) || 'default'
  );
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>(
    (typeof window !== 'undefined' && localStorage.getItem('lyc_selected_output_device')) || 'default'
  );
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('default');

  const [inputVolume, setInputVolume] = useState<number>(100);
  const [outputVolume, setOutputVolume] = useState<number>(100);

  const [inputMode, setInputMode] = useState<'vad' | 'ptt'>('vad');
  const [pttKey, setPttKey] = useState<string>('Mouse 4');
  const [isRecordingPtt, setIsRecordingPtt] = useState(false);
  const [autoSensitivity, setAutoSensitivity] = useState(true);
  const [vadSensitivity, setVadSensitivity] = useState<number>(65);

  // Configurações Avançadas de Áudio (Perfil, Krisp, Echo Cancellation, AGC)
  const [audioProfile, setAudioProfile] = useState<'voice-isolation' | 'studio' | 'custom'>(() => {
    return (typeof window !== 'undefined' && (localStorage.getItem('lyc_audio_profile') as any)) || 'voice-isolation';
  });
  const [noiseSuppression, setNoiseSuppression] = useState<'krisp' | 'standard' | 'none'>(() => {
    return (typeof window !== 'undefined' && (localStorage.getItem('lyc_noise_suppression') as any)) || 'krisp';
  });
  const [echoCancellation, setEchoCancellation] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('lyc_echo_cancellation') !== 'false' : true;
  });
  const [automaticGainControl, setAutomaticGainControl] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('lyc_auto_gain') !== 'false' : true;
  });

  // Teste de microfone
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const testMicAudioCtxRef = useRef<AudioContext | null>(null);
  const testMicStreamRef = useRef<MediaStream | null>(null);
  const testMicRafRef = useRef<number>(0);

  // Teste de vídeo
  const [isTestingVideo, setIsTestingVideo] = useState(false);
  const testVideoRef = useRef<HTMLVideoElement | null>(null);
  const testVideoStreamRef = useRef<MediaStream | null>(null);

  // ── 3. Estado da Aba Aparência ────────────────────────────────────────────
  const { theme, setTheme } = useTheme();
  const isOled = theme === 'oled';
  const isLight = theme === 'light';
  const isUltraPassTab = activeSettingsTab === 'ultra-pass' || activeSettingsTab === 'nitro';
  const [messageDensity, setMessageDensity] = useState<'cozy' | 'compact'>('cozy');

  // Carrega lista real de dispositivos de hardware
  useEffect(() => {
    if (!isSettingsModalOpen) return;

    const loadDevices = async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices.filter((d) => d.kind === 'audioinput');
          const outputs = devices.filter((d) => d.kind === 'audiooutput');
          const cameras = devices.filter((d) => d.kind === 'videoinput');

          setAudioInputDevices(inputs);
          setAudioOutputDevices(outputs);
          setVideoDevices(cameras);

          if (inputs.length > 0 && selectedInputDevice === 'default') {
            setSelectedInputDevice(inputs[0].deviceId || 'default');
          }
          if (outputs.length > 0 && selectedOutputDevice === 'default') {
            setSelectedOutputDevice(outputs[0].deviceId || 'default');
          }
          if (cameras.length > 0 && selectedVideoDevice === 'default') {
            setSelectedVideoDevice(cameras[0].deviceId || 'default');
          }
        }
      } catch (err) {
        console.warn('Erro ao listar dispositivos de áudio/vídeo:', err);
      }
    };

    loadDevices();
  }, [isSettingsModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup de testes de áudio e vídeo ao fechar ou trocar de aba
  const stopMicTest = useCallback(() => {
    if (testMicRafRef.current) cancelAnimationFrame(testMicRafRef.current);
    testMicStreamRef.current?.getTracks().forEach((t) => t.stop());
    testMicStreamRef.current = null;
    testMicAudioCtxRef.current?.close().catch(() => {});
    testMicAudioCtxRef.current = null;
    setIsTestingMic(false);
    setMicVolumeLevel(0);
  }, []);

  const stopVideoTest = useCallback(() => {
    testVideoStreamRef.current?.getTracks().forEach((t) => t.stop());
    testVideoStreamRef.current = null;
    if (testVideoRef.current) testVideoRef.current.srcObject = null;
    setIsTestingVideo(false);
  }, []);

  useEffect(() => {
    return () => {
      stopMicTest();
      stopVideoTest();
    };
  }, [stopMicTest, stopVideoTest, activeSettingsTab, isSettingsModalOpen]);

  // Handler do teste de microfone em tempo real
  const toggleMicTest = async () => {
    if (isTestingMic) {
      stopMicTest();
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedInputDevice !== 'default' ? { deviceId: { exact: selectedInputDevice } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      testMicStreamRef.current = stream;

      const audioCtx = new AudioContext();
      testMicAudioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      setIsTestingMic(true);

      const loop = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        // Normaliza de 0 a 100
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolumeLevel(normalized);
        testMicRafRef.current = requestAnimationFrame(loop);
      };
      testMicRafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.warn('Erro ao iniciar teste de microfone:', err);
      setIsTestingMic(false);
    }
  };

  // Handler do teste de vídeo em tempo real
  const toggleVideoTest = async () => {
    if (isTestingVideo) {
      stopVideoTest();
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice !== 'default' ? { deviceId: { exact: selectedVideoDevice } } : true,
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      testVideoStreamRef.current = stream;
      if (testVideoRef.current) {
        testVideoRef.current.srcObject = stream;
        testVideoRef.current.play().catch(() => {});
      }
      setIsTestingVideo(true);
    } catch (err) {
      console.warn('Erro ao iniciar teste de câmera:', err);
      setIsTestingVideo(false);
    }
  };

  // Upload de Avatar
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          const dataUrl = ev.target.result;
          setAvatar(dataUrl);
          updateCurrentUser({ avatar: dataUrl });
          if (typeof window !== 'undefined') {
            localStorage.setItem('lycUserAvatar', dataUrl);
          }
          setHasProfileChanges(true);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';
    setAvatar(defaultAvatar);
    updateCurrentUser({ avatar: defaultAvatar });
    if (typeof window !== 'undefined') {
      localStorage.setItem('lycUserAvatar', defaultAvatar);
    }
    setHasProfileChanges(true);
  };

  // Upload de Banner
  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          const dataUrl = ev.target.result;
          setBannerImage(dataUrl);
          updateCurrentUser({ bannerImage: dataUrl });
          if (typeof window !== 'undefined') {
            localStorage.setItem('lycUserBannerImage', dataUrl);
          }
          setHasProfileChanges(true);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleRemoveBanner = () => {
    setBannerImage(null);
    setBannerColor('#5865f2');
    updateCurrentUser({ bannerImage: undefined, bannerColor: '#5865f2' });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lycUserBannerImage');
      localStorage.setItem('lycUserBannerColor', '#5865f2');
    }
    setHasProfileChanges(true);
  };

  // Salvar perfil
  const handleSaveProfile = () => {
    updateCurrentUser({
      displayName,
      name: username,
      bannerColor,
      bannerImage: bannerImage || undefined,
      aboutMe,
      avatar,
    });
    setHasProfileChanges(false);
  };

  const handleResetProfile = () => {
    setDisplayName((typeof window !== 'undefined' && localStorage.getItem('lycDisplayName')) || currentUser.displayName || 'LycUser');
    setUsername(currentUser.name);
    setBannerColor(currentUser.bannerColor || '#5865f2');
    setBannerImage(currentUser.bannerImage || null);
    setAboutMe(currentUser.aboutMe || '');
    setAvatar(currentUser.avatar);
    setHasProfileChanges(false);
  };

  if (!isSettingsModalOpen) return null;

  const colorPalette = [
    '#5865f2',
    '#57f287',
    '#fee75c',
    '#eb459e',
    '#ed4245',
    '#f47b67',
    '#6d28d9',
    '#00a8fc',
    '#2b2d31',
    '#1e1f22',
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center select-none animate-in fade-in duration-150 p-4 sm:p-6 md:p-8"
      onClick={closeSettingsModal}
    >
      {/* ── CONTAINER CENTRALIZADO DO MODAL (ESTILO DISCORD) ───────────────── */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-[85vw] max-w-[1020px] h-[85vh] max-h-[800px] ${
          isUltraPassTab
            ? 'bg-[#070810] border-[#3f4147]'
            : isOled
            ? 'bg-black border-[#222327]'
            : isLight
            ? 'bg-white border-[#e3e5e8]'
            : 'bg-[#313338] border-[#3f4147]'
        } border rounded-lg shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-150`}
      >
        {/* ── 1. SIDEBAR DE NAVEGAÇÃO DE CONFIGURAÇÕES (Lado Esquerdo, ~240px) ───── */}
        <div
          className={`w-60 ${
            isOled
              ? 'bg-[#0a0a0a]'
              : isLight
              ? 'bg-[#f2f3f5]'
              : 'bg-[#2b2d31]'
          } border-r border-[#3f4147] flex flex-col py-6 px-4 overflow-y-auto flex-shrink-0 scrollbar-none`}
        >
          <div className="w-full space-y-4 text-xs font-semibold">
            {/* Perfil do Usuário no Topo da Sidebar */}
            <div className="flex items-center gap-2.5 px-2.5 py-2 mb-2 bg-[#1e1f22]/70 rounded-lg border border-[#1f2023]">
              <div className="relative flex-shrink-0">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover bg-[#1e1f22]"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#23a55a] border-2 border-[#2b2d31]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-bold truncate leading-tight">{currentUser.displayName || currentUser.name}</p>
                <p className="text-[#949ba4] text-[10px] truncate leading-tight font-normal">Online</p>
              </div>
            </div>

            {/* Seção: Configurações de Usuário */}
            <div>
              <h4 className="text-[10px] sm:text-[11px] font-bold uppercase text-[#949ba4] tracking-wider mb-1.5 px-2">
                CONFIGURAÇÕES DE USUÁRIO
              </h4>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveSettingsTab('my-account')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'my-account'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <User className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'my-account' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Minha Conta</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('profiles')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'profiles'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Palette className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'profiles' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Perfis</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('insignias')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'insignias'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Award className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'insignias' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Insígnias</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('privacy-safety')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'privacy-safety'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Shield className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'privacy-safety' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Privacidade & Segurança</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('authorized-apps')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'authorized-apps'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <AppWindow className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'authorized-apps' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Aplicativos Autorizados</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('connections')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'connections'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Link2 className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'connections' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Conexões</span>
                </button>
              </div>
            </div>

            <div className="h-[1px] bg-[#3f4147]/50 my-1.5 mx-2" />

            {/* Seção: Configurações de Cobrança */}
            <div>
              <h4 className="text-[10px] sm:text-[11px] font-bold uppercase text-[#949ba4] tracking-wider mb-1.5 px-2">
                COBRANÇA
              </h4>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveSettingsTab('ultra-pass')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'ultra-pass' || activeSettingsTab === 'nitro'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50'
                  }`}
                >
                  <img
                    src="/ultra-pass.svg"
                    alt="Ultra Pass"
                    className="w-4 h-4 object-contain flex-shrink-0 drop-shadow-[0_0_8px_rgba(244,127,255,0.45)] group-hover:scale-110 transition-transform"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/brand/03_UI_Icons_SVG/icon_ultrapass.svg';
                    }}
                  />
                  <span className="font-semibold bg-gradient-to-r from-[#f47fff] to-[#ff73fa] bg-clip-text text-transparent group-hover:brightness-110 transition-all">
                    Ultra Pass
                  </span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('server-boost')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'server-boost'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Zap className="w-4 h-4 text-[#ff73fa] flex-shrink-0 drop-shadow-[0_0_6px_rgba(255,115,250,0.4)] group-hover:scale-110 transition-transform" />
                  <span className={activeSettingsTab === 'server-boost' ? 'text-white font-semibold' : 'group-hover:text-white transition-colors'}>
                    Impulso de Servidor
                  </span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('subscriptions')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'subscriptions'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <CreditCard className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'subscriptions' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Assinaturas</span>
                </button>
              </div>
            </div>

            <div className="h-[1px] bg-[#3f4147]/50 my-1.5 mx-2" />

            {/* Seção: Configurações do Aplicativo */}
            <div>
              <h4 className="text-[10px] sm:text-[11px] font-bold uppercase text-[#949ba4] tracking-wider mb-1.5 px-2">
                CONFIGURAÇÃO DO APP
              </h4>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveSettingsTab('appearance')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'appearance'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Eye className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'appearance' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Aparência</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('accessibility')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'accessibility'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Monitor className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'accessibility' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Acessibilidade</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('voice-video')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'voice-video'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Volume2 className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'voice-video' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Voz e Vídeo</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('notifications')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'notifications'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Bell className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'notifications' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Notificações</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('keybinds')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'keybinds'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Keyboard className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'keybinds' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Atalhos de Teclado</span>
                </button>

                <button
                  onClick={() => setActiveSettingsTab('language')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-pointer text-left group ${
                    activeSettingsTab === 'language'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                  }`}
                >
                  <Globe className={`w-4 h-4 flex-shrink-0 transition-colors ${activeSettingsTab === 'language' ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`} />
                  <span>Idioma</span>
                </button>
              </div>
            </div>

            <div className="h-[1px] bg-[#3f4147]/50 my-1.5 mx-2" />

            {/* Sair da conta e rodapé com versão */}
            <div className="pt-1">
              <button
                onClick={async () => {
                  if (isLoggingOut) return;
                  closeSettingsModal();
                  try {
                    await logout();
                  } catch (err) {
                    console.error('[DiscordSettingsModal] Logout error:', err);
                  }
                }}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[#f23f43] hover:bg-[#f23f43]/15 transition-colors cursor-pointer text-left group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="w-4 h-4 group-hover:scale-105 transition-transform" />
                <span className="font-medium">{isLoggingOut ? 'Saindo da conta...' : 'Sair da Conta'}</span>
              </button>
            </div>

          <div className="px-2 pt-3 text-[10px] text-[#80848e] leading-relaxed space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[#949ba4]">CapyChat v{currentVersion} (Stable)</p>
              {isUpdateAvailable && (
                <span className="bg-[#23a55a]/20 text-[#23a55a] px-1.5 py-0.5 rounded text-[9px] font-bold">
                  Atualização Pronta
                </span>
              )}
            </div>
            <p>Electron 33 • Chromium 130</p>
            <div className="pt-1 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => checkForUpdates(false)}
                className="w-full py-1.5 px-2 rounded-md bg-[#35373c] hover:bg-[#404249] text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Verificando...' : 'Verificar atualizações'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  simulateUpdate();
                  closeSettingsModal();
                }}
                className="w-full py-1 px-2 rounded-md bg-[#5865f2]/15 hover:bg-[#5865f2]/30 text-[#8b5cf6] hover:text-white text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>🧪 Testar Notificação de Update</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. ÁREA PRINCIPAL DE CONTEÚDO COM BOTÃO ESC ──────────────── */}
      {isUltraPassTab ? (
        <div className="flex-1 flex flex-col overflow-y-auto relative bg-[#070810] scrollbar-thin">
          <DiscordUltraPassView isSettingsTab={true} />

          {/* ── 3. BOTÃO DE FECHAR ESC NO CANTO SUPERIOR DIREITO DO MODAL ────────── */}
          <div className="absolute top-5 right-5 z-40 flex flex-col items-center">
            <button
              onClick={closeSettingsModal}
              title="Fechar (ESC)"
              className="w-9 h-9 rounded-full border-2 border-[#b5bac1] hover:border-white text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors cursor-pointer group hover:bg-white/10 shadow-lg"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
            </button>
            <span className="text-[11px] font-bold text-[#949ba4] mt-1 tracking-wider">ESC</span>
          </div>
        </div>
      ) : (
        <div
          className={`flex-1 flex py-8 px-8 md:px-12 pr-16 overflow-y-auto relative ${
            isOled ? 'bg-black' : isLight ? 'bg-white' : 'bg-[#313338]'
          } scrollbar-thin`}
        >
          <div className="max-w-2xl w-full space-y-8 pb-12">
          {/* ══════════════════════════════════════════════════════════════════════
              ABA 1: MINHA CONTA (my-account)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === 'my-account' && (
            <div className="space-y-8 animate-in fade-in duration-100">
              <h2 className="text-xl font-bold text-white">Minha Conta</h2>

              {/* Card de Perfil Estilizado com Banner e Avatar */}
              <div className="bg-[#1e1f22] rounded-xl overflow-hidden border border-[#2b2d31] shadow-xl">
                {/* Banner superior com cor personalizada ou imagem */}
                <div
                  className="h-28 w-full relative transition-all duration-200"
                  style={{
                    backgroundColor: bannerColor,
                    backgroundImage: bannerImage
                      ? `url(${bannerImage})`
                      : currentUser.bannerImage
                      ? `url(${currentUser.bannerImage})`
                      : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <button
                    onClick={() => setActiveSettingsTab('profiles')}
                    className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white text-xs font-semibold px-3 py-1 rounded-[4px] backdrop-blur-sm transition-colors cursor-pointer"
                  >
                    Editar Perfil de Usuário
                  </button>
                </div>

                <div className="px-6 pb-6 bg-[#2b2d31] relative">
                  {/* Avatar sobreposto */}
                  <div className="relative -top-10 mb-[-24px] flex items-end justify-between">
                    <div className="relative">
                      <img
                        src={currentUser.avatar}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full border-[6px] border-[#2b2d31] object-cover bg-[#1e1f22]"
                      />
                      <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#23a55a] border-2 border-[#2b2d31]" />
                    </div>

                    {(() => {
                      const displayed = getDisplayedBadgeIds(
                        getUserUnlockedBadgeIds(currentUser),
                        currentUser.displayedBadges
                      );
                      if (displayed.length === 0) return null;
                      return (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#111214]/80 rounded-full border border-[#35373c]/40 mb-1 shadow-xs">
                          {displayed.map((id) => (
                            <CapyBadgeIcon key={id} badgeId={id} size={15} showTooltip />
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Nome e Tag */}
                  <div className="mt-3">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {displayName}
                    </h3>
                    <span className="text-xs text-[#949ba4]">@{username}#{currentUser.tag || '0001'}</span>
                  </div>

                  {/* Card interno escuro (#1e1f22) agrupando os campos editáveis */}
                  <div className="mt-6 bg-[#1e1f22] rounded-lg p-4 space-y-4 text-xs border border-[#1f2023]">
                    {/* Nome de Exibição */}
                    <div className="flex justify-between items-center">
                      <div className="flex-1 mr-4">
                        <span className="text-[#949ba4] block uppercase font-bold text-[10px] tracking-wider mb-0.5">
                          Nome de Exibição
                        </span>
                        {isEditingDisplayName ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              autoFocus
                              value={tempDisplayName}
                              onChange={(e) => setTempDisplayName(e.target.value)}
                              className="bg-[#2b2d31] border border-[#5865f2] rounded px-2.5 py-1 text-white font-medium outline-none text-xs w-48"
                            />
                            <button
                              onClick={() => {
                                const trimmed = tempDisplayName.trim() || 'LycUser';
                                setDisplayName(trimmed);
                                localStorage.setItem('lycDisplayName', trimmed);
                                currentUser.displayName = trimmed;
                                setIsEditingDisplayName(false);
                              }}
                              className="px-2.5 py-1 bg-[#23a55a] hover:bg-[#1a8a4a] text-white rounded font-semibold text-xs"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setIsEditingDisplayName(false)}
                              className="px-2.5 py-1 bg-[#35373c] text-[#dbdee1] rounded font-semibold text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <span className="text-white font-semibold text-sm">{displayName}</span>
                        )}
                      </div>
                      {!isEditingDisplayName && (
                        <button
                          onClick={() => {
                            setTempDisplayName(displayName);
                            setIsEditingDisplayName(true);
                          }}
                          className="px-3.5 py-1.5 bg-[#4e5058] hover:bg-[#6d6f78] text-white font-semibold rounded-[4px] text-xs transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                      )}
                    </div>

                    {/* Nome de Usuário */}
                    <div className="flex justify-between items-center pt-3 border-t border-[#2b2d31]">
                      <div className="flex-1 mr-4">
                        <span className="text-[#949ba4] block uppercase font-bold text-[10px] tracking-wider mb-0.5">
                          Nome de Usuário
                        </span>
                        {isEditingUsername ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              autoFocus
                              value={tempUsername}
                              onChange={(e) => setTempUsername(e.target.value)}
                              className="bg-[#2b2d31] border border-[#5865f2] rounded px-2.5 py-1 text-white font-medium outline-none text-xs w-48"
                            />
                            <button
                              onClick={() => {
                                const trimmed = tempUsername.trim() || 'lycuser';
                                setUsername(trimmed);
                                currentUser.name = trimmed;
                                setIsEditingUsername(false);
                              }}
                              className="px-2.5 py-1 bg-[#23a55a] hover:bg-[#1a8a4a] text-white rounded font-semibold text-xs"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setIsEditingUsername(false)}
                              className="px-2.5 py-1 bg-[#35373c] text-[#dbdee1] rounded font-semibold text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <span className="text-white font-medium">{username}</span>
                        )}
                      </div>
                      {!isEditingUsername && (
                        <button
                          onClick={() => {
                            setTempUsername(username);
                            setIsEditingUsername(true);
                          }}
                          className="px-3.5 py-1.5 bg-[#4e5058] hover:bg-[#6d6f78] text-white font-semibold rounded-[4px] text-xs transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                      )}
                    </div>

                    {/* E-mail */}
                    <div className="flex justify-between items-center pt-3 border-t border-[#2b2d31]">
                      <div>
                        <span className="text-[#949ba4] block uppercase font-bold text-[10px] tracking-wider mb-0.5">
                          E-mail
                        </span>
                        <span className="text-white font-medium font-mono">
                          {isEmailRevealed ? 'usuario@lyc-arena.com' : 'us*****@lyc-arena.com'}
                        </span>
                      </div>
                      <button
                        onClick={() => setIsEmailRevealed(!isEmailRevealed)}
                        className="px-3.5 py-1.5 bg-[#4e5058] hover:bg-[#6d6f78] text-white font-semibold rounded-[4px] text-xs transition-colors cursor-pointer"
                      >
                        {isEmailRevealed ? 'Ocultar' : 'Revelar'}
                      </button>
                    </div>

                    {/* Número de Telefone */}
                    <div className="flex justify-between items-center pt-3 border-t border-[#2b2d31]">
                      <div>
                        <span className="text-[#949ba4] block uppercase font-bold text-[10px] tracking-wider mb-0.5">
                          Número de Telefone
                        </span>
                        <span className="text-[#949ba4] font-normal">
                          Você ainda não adicionou um número de telefone.
                        </span>
                      </div>
                      <button className="px-3.5 py-1.5 bg-[#4e5058] hover:bg-[#6d6f78] text-white font-semibold rounded-[4px] text-xs transition-colors cursor-pointer">
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção: Autenticação de Dois Fatores (2FA) */}
              <div className="pt-2 border-t border-[#2b2d31] space-y-3">
                <h4 className="text-base font-bold text-white">Autenticação de Dois Fatores</h4>
                <p className="text-xs text-[#949ba4] leading-relaxed">
                  Proteja sua conta do CapyChat com uma camada adicional de segurança. Sempre que fizer login em um novo dispositivo, você precisará informar o código do seu aplicativo autenticador.
                </p>
                <button className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold rounded-[4px] text-xs transition-colors cursor-pointer shadow-md shadow-[#5865f2]/20">
                  Habilitar autenticação de dois fatores
                </button>
              </div>

              {/* Seção: Desativação de Conta */}
              <div className="pt-4 border-t border-[#2b2d31] space-y-3">
                <h4 className="text-base font-bold text-white">Desativação de Conta</h4>
                <p className="text-xs text-[#949ba4]">
                  Desativar sua conta significa que você pode recuperá-la a qualquer momento após realizar esta ação.
                </p>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-[#f23f43] hover:bg-[#da373c] text-white font-semibold rounded-[4px] text-xs transition-colors cursor-pointer">
                    Desativar Conta
                  </button>
                  <button className="px-4 py-2 border border-[#f23f43] text-[#f23f43] hover:bg-[#f23f43]/10 font-semibold rounded-[4px] text-xs transition-colors cursor-pointer">
                    Excluir Conta
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              ABA 2: PERFIS (profiles)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === 'profiles' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <h2 className="text-xl font-bold text-white">Perfis de Usuário</h2>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Lado Esquerdo: Formulário de Edição */}
                <div className="md:col-span-7 space-y-5">
                  {/* Nome de Exibição */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                      Nome de Exibição
                    </label>
                    <input
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        setHasProfileChanges(true);
                      }}
                      className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] text-white text-xs p-2.5 rounded-[4px] outline-none"
                    />
                  </div>

                  {/* Pronomes */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                      Pronomes
                    </label>
                    <input
                      value={pronouns}
                      onChange={(e) => {
                        setPronouns(e.target.value);
                        setHasProfileChanges(true);
                      }}
                      placeholder="Adicione seus pronomes"
                      className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] text-white text-xs p-2.5 rounded-[4px] outline-none"
                    />
                  </div>

                  <div className="h-[1px] bg-[#2b2d31] my-2" />

                  {/* Avatar */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                      Avatar
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => avatarFileInputRef.current?.click()}
                        className="px-3.5 py-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold text-xs rounded-[4px] transition-colors cursor-pointer shadow"
                      >
                        Mudar Avatar
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="text-xs text-[#dbdee1] hover:underline cursor-pointer"
                      >
                        Remover Avatar
                      </button>
                      <input
                        type="file"
                        ref={avatarFileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                    </div>
                  </div>

                  {/* Banner do Perfil */}
                  <div className="space-y-2.5">
                    <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                      Cor e Imagem do Banner
                    </label>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            setBannerColor(color);
                            setBannerImage(null);
                            setHasProfileChanges(true);
                          }}
                          className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                            !bannerImage && bannerColor === color ? 'border-white scale-110 shadow-md ring-2 ring-white/50' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <input
                        type="color"
                        value={bannerColor}
                        onChange={(e) => {
                          setBannerColor(e.target.value);
                          setBannerImage(null);
                          setHasProfileChanges(true);
                        }}
                        className="w-7 h-7 rounded-full border border-white/20 bg-transparent cursor-pointer"
                        title="Escolha uma cor personalizada"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => bannerProfileFileInputRef.current?.click()}
                        className="bg-[#35373c] hover:bg-[#4752c4] hover:text-white text-[#dbdee1] text-xs font-semibold px-3 py-1.5 rounded-[4px] transition-colors cursor-pointer shadow flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Enviar imagem de banner</span>
                      </button>
                      {(bannerImage || bannerColor !== '#5865f2') && (
                        <button
                          type="button"
                          onClick={handleRemoveBanner}
                          className="text-xs text-[#949ba4] hover:text-[#dbdee1] hover:underline cursor-pointer"
                        >
                          Restaurar cor padrão
                        </button>
                      )}
                      <input
                        type="file"
                        ref={bannerProfileFileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleBannerFileChange}
                      />
                    </div>
                  </div>

                  {/* Sobre Mim */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                        Sobre Mim
                      </label>
                      <span className="text-[11px] text-[#949ba4]">
                        {aboutMe.length}/190
                      </span>
                    </div>
                    <textarea
                      value={aboutMe}
                      maxLength={190}
                      onChange={(e) => {
                        setAboutMe(e.target.value);
                        setHasProfileChanges(true);
                      }}
                      rows={3}
                      className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] text-white text-xs p-3 rounded-[4px] outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Lado Direito: Preview ao Vivo do Card de Perfil */}
                <div className="md:col-span-5">
                  <span className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block mb-2">
                    Pré-visualização
                  </span>

                  <div className="w-full max-w-[280px] bg-[#111214] rounded-2xl overflow-hidden shadow-2xl border border-[#222327]">
                    {/* Banner com a cor ou imagem dinâmica */}
                    <div
                      className="h-20 w-full transition-all duration-200"
                      style={{
                        backgroundColor: bannerColor,
                        backgroundImage: bannerImage ? `url(${bannerImage})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />

                    <div className="px-4 pb-4 bg-[#111214] relative">
                      {/* Avatar */}
                      <div className="relative -top-8 mb-[-20px] flex justify-between items-end">
                        <div
                          className="relative group cursor-pointer"
                          onClick={() => avatarFileInputRef.current?.click()}
                          title="Clique para mudar o avatar"
                        >
                          <img
                            src={avatar}
                            alt=""
                            className="w-16 h-16 rounded-full border-4 border-[#111214] object-cover bg-[#1e1f22] group-hover:opacity-85 transition-opacity"
                          />
                          <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-[#23a55a] border-2 border-[#111214]" />
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <h4 className="text-base font-bold text-white truncate">
                          {displayName}
                        </h4>
                        <span className="text-xs text-[#949ba4] block">@{username}</span>
                        {pronouns && (
                          <span className="text-[11px] text-[#dbdee1] font-medium block mt-0.5">
                            {pronouns}
                          </span>
                        )}
                      </div>

                      <div className="h-[1px] bg-[#2b2d31] my-3" />

                      <div className="text-xs space-y-2">
                        <span className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider block">
                          Sobre Mim
                        </span>
                        <p className="text-xs text-[#dbdee1] leading-relaxed break-words">
                          {aboutMe || 'Nada adicionado ainda.'}
                        </p>
                      </div>

                      {(() => {
                        const displayed = getDisplayedBadgeIds(
                          getUserUnlockedBadgeIds(currentUser),
                          currentUser.displayedBadges
                        );
                        if (displayed.length === 0) return null;
                        return (
                          <div className="mt-3 pt-2 border-t border-[#2b2d31] flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider mr-1">
                              Insígnias:
                            </span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#111214]/80 rounded-full border border-[#35373c]/40 shadow-xs">
                              {displayed.map((id) => (
                                <CapyBadgeIcon key={id} badgeId={id} size={15} showTooltip />
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra Flutuante de Salvar Alterações */}
              {hasProfileChanges && (
                <div className="p-3.5 bg-[#111214] border border-[#232428] rounded-lg shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
                  <span className="text-xs text-white font-medium">
                    Cuidado — você tem alterações não salvas!
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleResetProfile}
                      className="text-xs text-[#dbdee1] hover:underline cursor-pointer"
                    >
                      Redefinir
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      className="px-4 py-1.5 bg-[#23a55a] hover:bg-[#1a8a4a] text-white text-xs font-bold rounded-[4px] transition-colors cursor-pointer shadow"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              ABA: INSÍGNIAS (insignias) — Gestão de Distintivos Oficiais CapyChat
             ══════════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === 'insignias' && (
            <DiscordBadgesSettingsSection />
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              ABA 3: VOZ E VÍDEO (voice-video) — Layout Linear Limpo Oficial Discord
             ══════════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === 'voice-video' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <h2 className="text-xl font-bold text-white mb-2">Configurações de Voz</h2>

              {/* 1. Dispositivos de Entrada e Saída */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Dispositivo de Entrada */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                      Dispositivo de Entrada
                    </label>
                    <select
                      value={selectedInputDevice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedInputDevice(val);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('lyc_selected_input_device', val);
                        }
                      }}
                      className="w-full bg-[#1e1f22] border border-[#1f2023] hover:border-black text-white text-xs p-2.5 rounded-[4px] focus:outline-none cursor-pointer"
                    >
                      {audioInputDevices.length === 0 ? (
                        <option value="default">Microfone Padrão do Sistema</option>
                      ) : (
                        audioInputDevices.map((dev, idx) => (
                          <option key={dev.deviceId || idx} value={dev.deviceId}>
                            {dev.label || `Microfone ${idx + 1}`}
                          </option>
                        ))
                      )}
                    </select>

                    {/* Slider de Volume de Entrada */}
                    <div className="pt-2 space-y-1.5">
                      <div className="flex justify-between text-xs text-[#949ba4]">
                        <span className="font-medium">Volume de Entrada</span>
                        <span className="font-mono font-semibold text-white">{inputVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={inputVolume}
                        onChange={(e) => setInputVolume(Number(e.target.value))}
                        className="w-full h-1.5 bg-[#4e5058] accent-[#5865f2] rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Dispositivo de Saída */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                      Dispositivo de Saída
                    </label>
                    <select
                      value={selectedOutputDevice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedOutputDevice(val);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('lyc_selected_output_device', val);
                        }
                      }}
                      className="w-full bg-[#1e1f22] border border-[#1f2023] hover:border-black text-white text-xs p-2.5 rounded-[4px] focus:outline-none cursor-pointer"
                    >
                      {audioOutputDevices.length === 0 ? (
                        <option value="default">Alto-falantes / Fones Padrão</option>
                      ) : (
                        audioOutputDevices.map((dev, idx) => (
                          <option key={dev.deviceId || idx} value={dev.deviceId}>
                            {dev.label || `Saída de Áudio ${idx + 1}`}
                          </option>
                        ))
                      )}
                    </select>

                    {/* Slider de Volume de Saída */}
                    <div className="pt-2 space-y-1.5">
                      <div className="flex justify-between text-xs text-[#949ba4]">
                        <span className="font-medium">Volume de Saída</span>
                        <span className="font-mono font-semibold text-white">{outputVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={outputVolume}
                        onChange={(e) => setOutputVolume(Number(e.target.value))}
                        className="w-full h-1.5 bg-[#4e5058] accent-[#5865f2] rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-[1px] bg-[#2b2d31]" />

              {/* 2. Teste de Microfone */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                  Teste de Microfone
                </h4>
                <p className="text-xs text-[#949ba4]">
                  Está com problemas no microfone? Faça um teste aqui para checar sua captação ao vivo.
                </p>

                <div className="flex items-center gap-3">
                  {/* Botão Teste do microfone */}
                  <button
                    onClick={toggleMicTest}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors cursor-pointer flex-shrink-0 flex items-center justify-center gap-2 ${
                      isTestingMic
                        ? 'bg-[#da373c] hover:bg-[#a12828] text-white'
                        : 'bg-[#5865f2] hover:bg-[#4752c4] text-white'
                    }`}
                  >
                    {isTestingMic && <Square className="w-3.5 h-3.5 fill-current" />}
                    <span>{isTestingMic ? 'Parar teste' : 'Teste do microfone'}</span>
                  </button>

                  {/* Waveform / Medidor de Barras Verticais */}
                  <div className="flex-1 h-10 bg-[#1e1f22] rounded px-3.5 flex items-center justify-between gap-[3px] border border-[#2b2d31]/50 overflow-hidden">
                    {Array.from({ length: 32 }).map((_, i) => {
                      const baseHeight = [
                        8, 12, 16, 20, 24, 20, 16, 22, 26, 24, 18, 14, 22, 28, 24, 18,
                        14, 20, 26, 22, 16, 12, 18, 24, 20, 16, 12, 18, 14, 10, 8, 6,
                      ][i % 32];

                      const threshold = (i / 32) * 100;
                      const isActive = isTestingMic && micVolumeLevel > threshold;

                      const height = isTestingMic
                        ? isActive
                          ? Math.max(8, Math.min(28, Math.round(baseHeight * (0.6 + (micVolumeLevel / 100) * 0.6))))
                          : 6
                        : Math.round(baseHeight * 0.45);

                      const color = isActive
                        ? i > 28
                          ? 'bg-[#f23f43]'
                          : i > 22
                          ? 'bg-[#f0b232]'
                          : 'bg-[#23a55a]'
                        : 'bg-[#4e5058]/40';

                      return (
                        <div
                          key={i}
                          className={`flex-1 max-w-[5px] rounded-full transition-all duration-75 ${color}`}
                          style={{ height: `${height}px` }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="h-[1px] bg-[#2b2d31]" />

              {/* 3. Modo de Entrada */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                  Modo de Entrada
                </h4>

                <div className="space-y-3.5">
                  {/* Opção Detecção de Voz */}
                  <label
                    onClick={() => setInputMode('vad')}
                    className="flex items-start gap-3 cursor-pointer group select-none"
                  >
                    <div
                      className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        inputMode === 'vad' ? 'border-[#5865f2]' : 'border-[#80848e] group-hover:border-[#dbdee1]'
                      }`}
                    >
                      {inputMode === 'vad' && <div className="w-2.5 h-2.5 rounded-full bg-[#5865f2]" />}
                    </div>
                    <input
                      type="radio"
                      name="inputMode"
                      checked={inputMode === 'vad'}
                      onChange={() => setInputMode('vad')}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white group-hover:text-white transition-colors block">
                        Detecção de Voz
                      </span>
                      <span className="text-xs text-[#949ba4] mt-0.5 block leading-relaxed">
                        Transmite áudio automaticamente ao falar
                      </span>
                    </div>
                  </label>

                  {/* Opção PTT */}
                  <label
                    onClick={() => setInputMode('ptt')}
                    className="flex items-start gap-3 cursor-pointer group select-none"
                  >
                    <div
                      className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        inputMode === 'ptt' ? 'border-[#5865f2]' : 'border-[#80848e] group-hover:border-[#dbdee1]'
                      }`}
                    >
                      {inputMode === 'ptt' && <div className="w-2.5 h-2.5 rounded-full bg-[#5865f2]" />}
                    </div>
                    <input
                      type="radio"
                      name="inputMode"
                      checked={inputMode === 'ptt'}
                      onChange={() => setInputMode('ptt')}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white group-hover:text-white transition-colors block">
                        Aperte para Falar
                      </span>
                      <span className="text-xs text-[#949ba4] mt-0.5 block leading-relaxed">
                        Transmite apenas enquanto pressiona a tecla
                      </span>
                    </div>
                  </label>
                </div>

                {/* Sub-configuração do modo selecionado */}
                {inputMode === 'vad' ? (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#dbdee1] font-medium">
                        Determinar sensibilidade de entrada automaticamente
                      </span>
                      <button
                        onClick={() => setAutoSensitivity(!autoSensitivity)}
                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                          autoSensitivity ? 'bg-[#5865f2]' : 'bg-[#4e5058]'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-white block transition-transform shadow-md ${
                            autoSensitivity ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {!autoSensitivity && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs text-[#949ba4]">
                          <span className="font-medium">Limiar de Sensibilidade</span>
                          <span className="font-mono text-white">-{vadSensitivity} dB</span>
                        </div>
                        <input
                          type="range"
                          min={20}
                          max={90}
                          value={vadSensitivity}
                          onChange={(e) => setVadSensitivity(Number(e.target.value))}
                          className="w-full h-1.5 bg-[#1e1f22] accent-[#23a55a] rounded cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="text-xs text-white font-semibold block">Atalho de Tecla</span>
                      <span className="text-[11px] text-[#949ba4]">Pressione a tecla para falar</span>
                    </div>
                    <button
                      onClick={() => setIsRecordingPtt(!isRecordingPtt)}
                      className="px-4 py-2 bg-[#1e1f22] hover:bg-[#35373c] border border-[#3f4147] text-white font-mono text-xs rounded-md font-bold cursor-pointer transition-colors"
                    >
                      {isRecordingPtt ? 'Pressione uma tecla...' : pttKey}
                    </button>
                  </div>
                )}
              </div>

              <div className="h-[1px] bg-[#2b2d31]" />

              {/* 4. Perfil de Entrada */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                    Perfil de Entrada
                  </h4>
                  <p className="text-xs text-[#949ba4] mt-0.5">
                    Escolha o processamento sonoro que melhor se adapta ao seu microfone e ambiente acústico.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {/* Opção 1: Isolamento de Voz */}
                  <label
                    onClick={() => {
                      setAudioProfile('voice-isolation');
                      if (typeof window !== 'undefined') localStorage.setItem('lyc_audio_profile', 'voice-isolation');
                    }}
                    className="flex items-start gap-3 cursor-pointer group select-none"
                  >
                    <div
                      className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        audioProfile === 'voice-isolation' ? 'border-[#5865f2]' : 'border-[#80848e] group-hover:border-[#dbdee1]'
                      }`}
                    >
                      {audioProfile === 'voice-isolation' && <div className="w-2.5 h-2.5 rounded-full bg-[#5865f2]" />}
                    </div>
                    <input
                      type="radio"
                      name="audioProfile"
                      checked={audioProfile === 'voice-isolation'}
                      onChange={() => {}}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white group-hover:text-white transition-colors">
                          Isolamento de Voz
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#23a55a]/20 text-[#23a55a] text-[10px] font-bold rounded">
                          Recomendado
                        </span>
                      </div>
                      <p className="text-xs text-[#949ba4] mt-0.5 leading-relaxed">
                        Só a sua linda voz: deixe o app equalizar o ruído e filtrar sons ambientes indesejados.
                      </p>
                    </div>
                  </label>

                  {/* Opção 2: Estúdio */}
                  <label
                    onClick={() => {
                      setAudioProfile('studio');
                      if (typeof window !== 'undefined') localStorage.setItem('lyc_audio_profile', 'studio');
                    }}
                    className="flex items-start gap-3 cursor-pointer group select-none"
                  >
                    <div
                      className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        audioProfile === 'studio' ? 'border-[#5865f2]' : 'border-[#80848e] group-hover:border-[#dbdee1]'
                      }`}
                    >
                      {audioProfile === 'studio' && <div className="w-2.5 h-2.5 rounded-full bg-[#5865f2]" />}
                    </div>
                    <input
                      type="radio"
                      name="audioProfile"
                      checked={audioProfile === 'studio'}
                      onChange={() => {}}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white group-hover:text-white transition-colors block">
                        Estúdio
                      </span>
                      <p className="text-xs text-[#949ba4] mt-0.5 leading-relaxed">
                        Áudio puro: microfone aberto e sem processamento, ideal para instrumentos ou salas acusticamente tratadas.
                      </p>
                    </div>
                  </label>

                  {/* Opção 3: Personalizado */}
                  <label
                    onClick={() => {
                      setAudioProfile('custom');
                      if (typeof window !== 'undefined') localStorage.setItem('lyc_audio_profile', 'custom');
                    }}
                    className="flex items-start gap-3 cursor-pointer group select-none"
                  >
                    <div
                      className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        audioProfile === 'custom' ? 'border-[#5865f2]' : 'border-[#80848e] group-hover:border-[#dbdee1]'
                      }`}
                    >
                      {audioProfile === 'custom' && <div className="w-2.5 h-2.5 rounded-full bg-[#5865f2]" />}
                    </div>
                    <input
                      type="radio"
                      name="audioProfile"
                      checked={audioProfile === 'custom'}
                      onChange={() => {}}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white group-hover:text-white transition-colors block">
                        Personalizado
                      </span>
                      <p className="text-xs text-[#949ba4] mt-0.5 leading-relaxed">
                        Modo avançado: me dê todos os botões e mostradores para controle total de cada filtro!
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="h-[1px] bg-[#2b2d31]" />

              {/* 5. Processamento de Voz Avançado */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                    Processamento de Voz Avançado
                  </h4>
                  <p className="text-xs text-[#949ba4] mt-0.5">
                    Algoritmos de ponta para eliminar ruídos mecânicos, eco e estalos.
                  </p>
                </div>

                {/* Supressão de Ruído Krisp */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Supressão de Ruído</span>
                      <span className="px-1.5 py-0.5 bg-[#5865f2]/20 text-[#5865f2] text-[10px] font-bold rounded">
                        Fornecido por Krisp
                      </span>
                    </div>
                    <p className="text-[11px] text-[#949ba4] mt-0.5">
                      Remove ruído de teclado, ventilador e fundo usando redes neurais.
                    </p>
                  </div>
                  <select
                    value={noiseSuppression}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setNoiseSuppression(val);
                      if (typeof window !== 'undefined') localStorage.setItem('lyc_noise_suppression', val);
                    }}
                    className="bg-[#1e1f22] border border-[#2b2d31] text-white text-xs p-2 rounded focus:outline-none cursor-pointer"
                  >
                    <option value="krisp">Krisp (Inteligência Artificial)</option>
                    <option value="standard">Padrão (Filtro Básico)</option>
                    <option value="none">Desativado</option>
                  </select>
                </div>

                <div className="h-[1px] bg-[#2b2d31]/50" />

                {/* Cancelamento de Eco Toggle */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-xs font-bold text-white block">Cancelamento de Eco</span>
                    <p className="text-[11px] text-[#949ba4] mt-0.5">
                      Impede que o som emitido pelos seus alto-falantes retorne para a chamada.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !echoCancellation;
                      setEchoCancellation(next);
                      if (typeof window !== 'undefined') localStorage.setItem('lyc_echo_cancellation', String(next));
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                      echoCancellation ? 'bg-[#5865f2]' : 'bg-[#4e5058]'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white block transition-transform shadow-md ${
                        echoCancellation ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="h-[1px] bg-[#2b2d31]/50" />

                {/* Controle Automático de Ganho (AGC) */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-xs font-bold text-white block">Controle Automático de Ganho (AGC)</span>
                    <p className="text-[11px] text-[#949ba4] mt-0.5">
                      Normaliza dinamicamente o volume da sua fala para que você nunca soe baixo demais ou muito alto.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !automaticGainControl;
                      setAutomaticGainControl(next);
                      if (typeof window !== 'undefined') localStorage.setItem('lyc_auto_gain', String(next));
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                      automaticGainControl ? 'bg-[#5865f2]' : 'bg-[#4e5058]'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white block transition-transform shadow-md ${
                        automaticGainControl ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="h-[1px] bg-[#2b2d31]" />

              {/* 6. Configurações de Vídeo e Câmera */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider block">
                    Configurações de Vídeo
                  </h4>
                  <p className="text-xs text-[#949ba4] mt-0.5">
                    Selecione sua webcam e confira a pré-visualização ao vivo antes de transmitir.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                    Câmera
                  </label>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedVideoDevice}
                      onChange={(e) => setSelectedVideoDevice(e.target.value)}
                      className="flex-1 bg-[#1e1f22] border border-[#1f2023] hover:border-black text-white text-xs p-2.5 rounded-[4px] focus:outline-none cursor-pointer"
                    >
                      {videoDevices.length === 0 ? (
                        <option value="default">Câmera Integrada / Padrão</option>
                      ) : (
                        videoDevices.map((dev, idx) => (
                          <option key={dev.deviceId || idx} value={dev.deviceId}>
                            {dev.label || `Câmera ${idx + 1}`}
                          </option>
                        ))
                      )}
                    </select>

                    <button
                      onClick={toggleVideoTest}
                      className={`px-4 py-2 rounded-[3px] text-xs font-bold transition-all cursor-pointer shadow flex items-center gap-1.5 ${
                        isTestingVideo
                          ? 'bg-[#f23f43] hover:bg-[#da373c] text-white'
                          : 'bg-[#5865f2] hover:bg-[#4752c4] text-white'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isTestingVideo ? 'Parar Pré-visualização' : 'Testar Vídeo'}</span>
                    </button>
                  </div>
                </div>

                {/* Box de Pré-visualização de Vídeo */}
                <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-[#202225] relative flex items-center justify-center">
                  <video
                    ref={testVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isTestingVideo ? 'block' : 'hidden'}`}
                  />
                  {!isTestingVideo && (
                    <div className="text-center px-4">
                      <Camera className="w-10 h-10 text-[#4e5058] mx-auto mb-2" />
                      <p className="text-xs text-[#949ba4] font-medium">
                        Clique em "Testar Vídeo" para checar sua webcam antes de entrar na transmissão
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              ABA 4: APARÊNCIA (appearance)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <h2 className="text-xl font-bold text-white">Aparência</h2>

              {/* Temas */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                  Tema
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Escuro */}
                  <div
                    onClick={() => setTheme('dark')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col gap-2 ${
                      theme === 'dark'
                        ? 'bg-[#2b2d31] border-[#5865f2] ring-2 ring-[#5865f2]/40'
                        : 'bg-[#2b2d31] border-[#1e1f22] hover:border-[#3f4147]'
                    }`}
                  >
                    <div className="theme-card-preview-dark h-14 !bg-[#313338] rounded border border-[#1e1f22] p-2 flex flex-col justify-between">
                      <div className="w-8 h-2 bg-[#5865f2] rounded" />
                      <div className="w-full h-1.5 bg-[#4e5058] rounded" />
                    </div>
                    <span className="text-xs font-bold text-white">Escuro (Padrão)</span>
                  </div>

                  {/* Meia-noite (Preto OLED) */}
                  <div
                    onClick={() => setTheme('oled')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col gap-2 ${
                      theme === 'oled'
                        ? 'bg-[#2b2d31] border-[#5865f2] ring-2 ring-[#5865f2]/40'
                        : 'bg-[#2b2d31] border-[#1e1f22] hover:border-[#3f4147]'
                    }`}
                  >
                    <div className="theme-card-preview-oled h-14 !bg-black rounded border border-[#1e1f22] p-2 flex flex-col justify-between">
                      <div className="w-8 h-2 bg-[#5865f2] rounded" />
                      <div className="w-full h-1.5 bg-[#3f4147] rounded" />
                    </div>
                    <span className="text-xs font-bold text-white">Meia-noite (OLED)</span>
                  </div>

                  {/* Claro */}
                  <div
                    onClick={() => setTheme('light')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col gap-2 ${
                      theme === 'light'
                        ? 'bg-[#2b2d31] border-[#5865f2] ring-2 ring-[#5865f2]/40'
                        : 'bg-[#2b2d31] border-[#1e1f22] hover:border-[#3f4147]'
                    }`}
                  >
                    <div className="theme-card-preview-light h-14 !bg-[#ffffff] rounded border border-[#e3e5e8] p-2 flex flex-col justify-between">
                      <div className="w-8 h-2 bg-[#5865f2] rounded" />
                      <div className="w-full h-1.5 bg-[#d1d5db] rounded" />
                    </div>
                    <span className="text-xs font-bold text-white">Claro</span>
                  </div>
                </div>
              </div>

              {/* Densidade de Mensagens */}
              <div className="space-y-3 pt-4 border-t border-[#2b2d31]">
                <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                  Exibição de Mensagens
                </label>
                <div className="space-y-2">
                  <label
                    onClick={() => setMessageDensity('cozy')}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      messageDensity === 'cozy'
                        ? 'bg-[#2b2d31] border-[#5865f2]'
                        : 'bg-[#2b2d31] border-[#1e1f22] hover:border-[#3f4147]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="density"
                      checked={messageDensity === 'cozy'}
                      onChange={() => setMessageDensity('cozy')}
                      className="accent-[#5865f2] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Aconchegante</span>
                      <span className="text-[11px] text-[#949ba4]">
                        Visual moderno e espaçoso com avatares dos membros
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setMessageDensity('compact')}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      messageDensity === 'compact'
                        ? 'bg-[#2b2d31] border-[#5865f2]'
                        : 'bg-[#2b2d31] border-[#1e1f22] hover:border-[#3f4147]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="density"
                      checked={messageDensity === 'compact'}
                      onChange={() => setMessageDensity('compact')}
                      className="accent-[#5865f2] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Compacto</span>
                      <span className="text-[11px] text-[#949ba4]">
                        Mais mensagens na tela sem avatares (estilo IRC clássico)
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              ABA 5: NOTIFICAÇÕES (notifications)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <h2 className="text-xl font-bold text-white">Notificações</h2>

              <div className="space-y-4">
                <div className="p-3.5 bg-[#2b2d31] rounded-lg border border-[#1f2023] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Ativar Notificações na Área de Trabalho
                    </span>
                    <span className="text-[11px] text-[#949ba4]">
                      Receba avisos nativos do Windows ao ser mencionado ou receber mensagens
                    </span>
                  </div>
                  <button className="w-10 h-5 rounded-full bg-[#23a55a] p-0.5 cursor-pointer">
                    <span className="w-4 h-4 rounded-full bg-white block translate-x-5" />
                  </button>
                </div>

                <div className="p-3.5 bg-[#2b2d31] rounded-lg border border-[#1f2023] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Sons de Notificação
                    </span>
                    <span className="text-[11px] text-[#949ba4]">
                      Tocar sons para mensagens, conexões de voz e alertas
                    </span>
                  </div>
                  <button className="w-10 h-5 rounded-full bg-[#23a55a] p-0.5 cursor-pointer">
                    <span className="w-4 h-4 rounded-full bg-white block translate-x-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              ABA 6: ATALHOS DE TECLADO (keybinds)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === 'keybinds' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <h2 className="text-xl font-bold text-white">Atalhos de Teclado</h2>

              <div className="bg-[#1e1f22] rounded-lg border border-[#1f2023] overflow-hidden text-xs">
                <div className="p-3 bg-[#2b2d31] font-bold text-[#b5bac1] uppercase tracking-wider text-[10px]">
                  Atalhos Globais do Sistema
                </div>
                <div className="divide-y divide-[#2b2d31]">
                  {[
                    { action: 'Mutar Microfone', keys: 'Ctrl + Shift + M' },
                    { action: 'Ensurdecer Áudio', keys: 'Ctrl + Shift + D' },
                    { action: 'Pesquisa Rápida (Canais e DMs)', keys: 'Ctrl + K' },
                    { action: 'Navegar entre Servidores', keys: 'Ctrl + Alt + Cima/Baixo' },
                    { action: 'Alternar entre Canais', keys: 'Alt + Cima/Baixo' },
                    { action: 'Fechar Janela / Modal', keys: 'ESC' },
                  ].map((kb, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <span className="text-white font-medium">{kb.action}</span>
                      <kbd className="bg-[#2b2d31] border border-[#3f4147] px-2 py-1 rounded text-[#dbdee1] font-mono text-xs shadow-sm">
                        {kb.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Outras Abas Auxiliares */}
          {['privacy-safety', 'authorized-apps', 'connections', 'server-boost', 'subscriptions', 'accessibility', 'language'].includes(activeSettingsTab) && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <h2 className="text-xl font-bold text-white capitalize">
                {activeSettingsTab.replace('-', ' ')}
              </h2>
              <div className="p-6 bg-[#2b2d31] rounded-lg border border-[#1f2023] text-xs text-[#949ba4] leading-relaxed">
                As configurações para esta seção estão sincronizadas com sua conta do CapyChat Oficial. Nenhuma ação pendente necessária no momento.
              </div>
            </div>
          )}
        </div>

        {/* ── 3. BOTÃO DE FECHAR ESC NO CANTO SUPERIOR DIREITO DO MODAL ────────── */}
        <div className="absolute top-5 right-5 z-20 flex flex-col items-center">
          <button
            onClick={closeSettingsModal}
            title="Fechar (ESC)"
            className="w-9 h-9 rounded-full border-2 border-[#b5bac1] hover:border-white text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors cursor-pointer group hover:bg-white/10 shadow-lg"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
          </button>
          <span className="text-[11px] font-bold text-[#949ba4] mt-1 tracking-wider">ESC</span>
        </div>
      </div>
      )}
    </div>
  </div>
);
};
