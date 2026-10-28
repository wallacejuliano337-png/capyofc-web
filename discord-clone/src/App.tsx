import React, { useEffect } from 'react';
import { useDiscord } from './store/discordStore';
import { useTheme } from './store/themeStore';
import { useVoiceStreamStore } from './store/voiceStreamStore';
import { WindowTitleBar } from './components/WindowTitleBar';
import { DiscordServersRail } from './components/discord/DiscordServersRail';
import { DiscordChannelsSidebar } from './components/discord/DiscordChannelsSidebar';
import { DiscordChatView } from './components/discord/DiscordChatView';
import { DiscordVoiceStage } from './components/discord/DiscordVoiceStage';
import { DiscordMembersSidebar } from './components/discord/DiscordMembersSidebar';
import { DiscordFriendsView } from './components/discord/DiscordFriendsView';
import { DiscordShopView } from './components/discord/DiscordShopView';
import { DiscordUltraPassView } from './components/discord/DiscordUltraPassView';
import { DiscordMissionsView } from './components/discord/DiscordMissionsView';
import { DiscordMemberProfilePopout } from './components/discord/DiscordMemberProfilePopout';
import { DiscordUserProfileModal } from './components/discord/DiscordUserProfileModal';
import { DiscordSettingsModal } from './components/discord/DiscordSettingsModal';
import { DiscordScreenShareModal } from './components/discord/DiscordScreenShareModal';
import { DiscordServerSettingsModal } from './components/discord/DiscordServerSettingsModal';
import { DiscordServerBoostModal } from './components/discord/DiscordServerBoostModal';
import { DiscordCreateChannelModal } from './components/discord/DiscordCreateChannelModal';
import { DiscordCreateCategoryModal } from './components/discord/DiscordCreateCategoryModal';
import { DiscordCreateServerModal } from './components/discord/DiscordCreateServerModal';
import { DiscordQuickSwitcherModal } from './components/discord/DiscordQuickSwitcherModal';
import { DiscordLoginView } from './components/discord/DiscordLoginView';
import { DiscordUpdateNotifier } from './components/discord/DiscordUpdateNotifier';
import { useIsMobile } from './hooks/useIsMobile';
import { DiscordMobileLayout } from './components/mobile/DiscordMobileLayout';
import { OfflineBanner } from './components/mobile/OfflineBanner';
import { initAutoUpdatePoller } from './services/autoUpdateService';
import { playNotificationSound } from './services/notification-sounds';
import { supabase } from './lib/supabase';

export function App() {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const {
    activeServerId,
    activeChannelId,
    activeHomeTab,
    activeView,
    voiceState,
    isMicMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
    isQuickSwitcherOpen,
    toggleQuickSwitcher,
    closeQuickSwitcher,
    closeSettingsModal,
    closeMemberPopout,
    closeServerSettings,
    closeCreateChannel,
    closeCreateCategory,
    isCreateServerModalOpen,
    closeCreateServerModal,
    disconnectFromVoice,
    isAuthenticated,
    login,
    logout,
    syncProfileFromSupabase,
    stopPresenceTracking,
  } = useDiscord();

  const { initMic, stopMic, micStream, closeShareModal } = useVoiceStreamStore();

  const isHome = activeServerId === '@me';
  const isDm = isHome && activeChannelId.startsWith('dm-');

  useEffect(() => {
    (window as any).__DISCORD_STORE__ = useDiscord;
  }, []);

  // Sincronização e restauração automática de sessão Supabase
  useEffect(() => {
    if (!supabase) return;

    let active = true;

    // Verificar e restaurar sessão persistida
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.session) return;
      if (data.session.user) {
        void syncProfileFromSupabase(data.session.user.id);
      }
    });

    // Escutar eventos de auth (login, logout, renovação de token)
    const { data: subData } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          void syncProfileFromSupabase(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        stopPresenceTracking();
        // Break any infinite loop: session is already signed out in Supabase
        void logout({ skipSupabaseSignOut: true });
      }
    });

    return () => {
      active = false;
      subData.subscription.unsubscribe();
      stopPresenceTracking();
    };
  }, [syncProfileFromSupabase, logout, stopPresenceTracking]);

  // Atalhos Globais de Voz do Electron (Ctrl+Shift+M / Ctrl+Shift+P) & Tray Disconnect
  useEffect(() => {
    const unbindMute = window.arena?.onVoiceToggleMute?.(() => {
      toggleMute();
    });
    const unbindPtt = window.arena?.onVoicePtt?.(() => {
      toggleMute();
    });
    const unbindDisconnect = window.arena?.onVoiceDisconnect?.(() => {
      disconnectFromVoice();
    });
    return () => {
      unbindMute?.();
      unbindPtt?.();
      unbindDisconnect?.();
    };
  }, [toggleMute, disconnectFromVoice]);

  // Gerenciamento global do ciclo de vida do microfone e VAD (persiste na navegação)
  useEffect(() => {
    if (voiceState.isConnected) {
      initMic();
    } else {
      stopMic();
    }
  }, [voiceState.isConnected, initMic, stopMic]);

  // Sincroniza estado de mutar com a track física de áudio
  useEffect(() => {
    if (micStream) {
      const track = micStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !isMicMuted;
      }
    }
  }, [isMicMuted, micStream]);

  // Atalhos Globais de Teclado (Ctrl+K Quick Switcher, Ctrl+Shift+M Mute, Ctrl+Shift+D Deafen, ESC Modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Quick Switcher: Ctrl + K / Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleQuickSwitcher();
        return;
      }

      // 2. Mute Toggle: Ctrl + Shift + M
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
        playNotificationSound(isMicMuted ? 'unmute' : 'mute');
        return;
      }

      // 3. Deafen Toggle: Ctrl + Shift + D
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleDeafen();
        playNotificationSound(isDeafened ? 'undeafen' : 'deafen');
        return;
      }

      // 4. Handle ESC key to close all modals
      if (e.key === 'Escape') {
        closeQuickSwitcher();
        closeSettingsModal();
        closeMemberPopout();
        closeShareModal();
        closeServerSettings();
        closeCreateChannel();
        closeCreateCategory();
        closeCreateServerModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isMicMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
    toggleQuickSwitcher,
    closeQuickSwitcher,
    closeSettingsModal,
    closeMemberPopout,
    closeShareModal,
    closeServerSettings,
    closeCreateChannel,
    closeCreateCategory,
    closeCreateServerModal,
  ]);

  // Poller de auto-update inteligente em segundo plano (estilo Discord)
  useEffect(() => {
    const unbindPoller = initAutoUpdatePoller();
    return () => unbindPoller();
  }, []);

  if (!isAuthenticated) {
    return (
      <div
        data-theme={theme}
        className={`theme-${theme} flex flex-col h-screen w-screen overflow-hidden bg-[#060814] text-[#dbdee1] font-sans antialiased select-none`}
      >
        <OfflineBanner />
        {!isMobile && <WindowTitleBar />}
        {!isMobile && <DiscordUpdateNotifier />}
        <DiscordLoginView onLogin={login} />
      </div>
    );
  }

  // Se estiver em modo mobile (iPhone Safari ou tela < 768px), renderiza a experiência móvel dedicada
  if (isMobile) {
    return (
      <div
        data-theme={theme}
        className={`theme-${theme} flex flex-col h-screen w-screen overflow-hidden bg-[#1e1f22] text-[#dbdee1] font-sans antialiased select-none`}
      >
        <DiscordMobileLayout />

        {/* Modais flutuantes compatíveis com mobile */}
        <DiscordMemberProfilePopout />
        <DiscordUserProfileModal />
        <DiscordSettingsModal />
        <DiscordServerSettingsModal />
        <DiscordServerBoostModal />
        <DiscordCreateChannelModal />
        <DiscordCreateCategoryModal />
        <DiscordCreateServerModal
          isOpen={isCreateServerModalOpen}
          onClose={closeCreateServerModal}
        />
      </div>
    );
  }

  return (
    <div
      data-theme={theme}
      className={`theme-${theme} flex flex-col h-screen w-screen overflow-hidden bg-[#1e1f22] text-[#dbdee1] font-sans antialiased select-none`}
    >
      {/* 1. Electron Window Title Bar (Draggable window header with minimize, maximize, close) */}
      <WindowTitleBar />

      {/* 2. Main 1:1 Discord Layout Workspace */}
      <div className="flex-1 w-full flex overflow-hidden relative">
        {/* Extreme-Left Server Sidebar (72px) */}
        <DiscordServersRail />

        {/* Sub-Sidebar: Channels or Direct Messages (240px) */}
        <DiscordChannelsSidebar />

        {/* Central Workspace Area */}
        {isHome && !isDm ? (
          /* Home Tabs: Amigos, Loja, Nitro, Missões */
          activeHomeTab === 'friends' ? (
            <DiscordFriendsView />
          ) : activeHomeTab === 'shop' ? (
            <DiscordShopView />
          ) : activeHomeTab === 'ultra-pass' || activeHomeTab === 'nitro' ? (
            <DiscordUltraPassView />
          ) : activeHomeTab === 'missions' ? (
            <DiscordMissionsView />
          ) : (
            <DiscordFriendsView />
          )
        ) : activeView === 'voice-stage' ? (
          /* Voice & Screen Share Stage */
          <DiscordVoiceStage />
        ) : (
          /* Text Chat View (Server Channel or Private DM) */
          <DiscordChatView />
        )}

        {/* Right Collapsible Member List Sidebar (240px) */}
        {!isHome && activeView === 'chat' && <DiscordMembersSidebar />}
      </div>

      {/* 3. Floating User Profile Popout */}
      <DiscordMemberProfilePopout />

      {/* 3.1 Full Extended User Profile Modal (Discord Mural & Server Profile) */}
      <DiscordUserProfileModal />

      {/* 4. Full User Settings Modal */}
      <DiscordSettingsModal />

      {/* 5. Screen Share Selector Modal (Discord style) */}
      <DiscordScreenShareModal />

      {/* 6. Server Settings Modal */}
      <DiscordServerSettingsModal />

      {/* 6.1 Server Boost Dedicated Modal/Page */}
      <DiscordServerBoostModal />

      {/* 7. Create Channel Modal */}
      <DiscordCreateChannelModal />

      {/* 8. Create Category Modal */}
      <DiscordCreateCategoryModal />

      {/* 9. Create Server Modal */}
      <DiscordCreateServerModal
        isOpen={isCreateServerModalOpen}
        onClose={closeCreateServerModal}
      />

      {/* 10. Quick Switcher Spotlight Modal (Ctrl + K) */}
      <DiscordQuickSwitcherModal />

      {/* 11. Discord-style Auto-Update Discreet Notifier & Modal */}
      <DiscordUpdateNotifier />
    </div>
  );
}

export default App;
