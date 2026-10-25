'use client';

import React, { useEffect } from 'react';
import { useDiscord } from '../store/discordStore';
import { useVoiceStreamStore } from '../store/voiceStreamStore';
import { DiscordServersRail } from '../components/discord/DiscordServersRail';
import { DiscordChannelsSidebar } from '../components/discord/DiscordChannelsSidebar';
import { DiscordChatView } from '../components/discord/DiscordChatView';
import { DiscordVoiceStage } from '../components/discord/DiscordVoiceStage';
import { DiscordMembersSidebar } from '../components/discord/DiscordMembersSidebar';
import { DiscordFriendsView } from '../components/discord/DiscordFriendsView';
import { DiscordShopView } from '../components/discord/DiscordShopView';
import { DiscordNitroView } from '../components/discord/DiscordNitroView';
import { DiscordMissionsView } from '../components/discord/DiscordMissionsView';
import { DiscordMemberProfilePopout } from '../components/discord/DiscordMemberProfilePopout';
import { DiscordSettingsModal } from '../components/discord/DiscordSettingsModal';
import { DiscordScreenShareModal } from '../components/discord/DiscordScreenShareModal';
import { DiscordServerSettingsModal } from '../components/discord/DiscordServerSettingsModal';
import { DiscordCreateChannelModal } from '../components/discord/DiscordCreateChannelModal';
import { DiscordCreateCategoryModal } from '../components/discord/DiscordCreateCategoryModal';
import { DiscordCreateServerModal } from '../components/discord/DiscordCreateServerModal';
import { DiscordQuickSwitcherModal } from '../components/discord/DiscordQuickSwitcherModal';
import { playNotificationSound } from '../services/notification-sounds';

export default function DiscordHome() {
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
    toggleQuickSwitcher,
    closeQuickSwitcher,
    closeSettingsModal,
    closeMemberPopout,
    closeServerSettings,
    closeCreateChannel,
    closeCreateCategory,
    isCreateServerModalOpen,
    closeCreateServerModal,
  } = useDiscord();

  const { initMic, stopMic, micStream, closeShareModal } = useVoiceStreamStore();

  const isHome = activeServerId === '@me';
  const isDm = isHome && activeChannelId.startsWith('dm-');

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

      // 4. Handle ESC key to close modals
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

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#1e1f22] text-[#dbdee1] font-sans antialiased select-none">
      {/* 1. Server Navigation Rail (72px) */}
      <DiscordServersRail />

      {/* 2. Channel / DM Navigation Sub-Sidebar (240px) */}
      <DiscordChannelsSidebar />

      {/* 3. Central Workspace: Friends / Shop / Nitro / Missions / Voice Stage / Chat */}
      {isHome && !isDm ? (
        activeHomeTab === 'friends' ? (
          <DiscordFriendsView />
        ) : activeHomeTab === 'shop' ? (
          <DiscordShopView />
        ) : activeHomeTab === 'nitro' ? (
          <DiscordNitroView />
        ) : activeHomeTab === 'missions' ? (
          <DiscordMissionsView />
        ) : (
          <DiscordFriendsView />
        )
      ) : activeView === 'voice-stage' ? (
        <DiscordVoiceStage />
      ) : (
        <DiscordChatView />
      )}

      {/* 4. Collapsible Member List Sidebar (240px) */}
      {!isHome && activeView === 'chat' && <DiscordMembersSidebar />}

      {/* 5. Floating Member Profile Popout Modal */}
      <DiscordMemberProfilePopout />

      {/* 6. User Settings Modal */}
      <DiscordSettingsModal />

      {/* 7. Screen Share Selector Modal (Discord style) */}
      <DiscordScreenShareModal />

      {/* 8. Server Settings Modal */}
      <DiscordServerSettingsModal />

      {/* 9. Create Channel Modal */}
      <DiscordCreateChannelModal />

      {/* 10. Create Category Modal */}
      <DiscordCreateCategoryModal />

      {/* 11. Create Server Modal */}
      <DiscordCreateServerModal
        isOpen={isCreateServerModalOpen}
        onClose={closeCreateServerModal}
      />

      {/* 12. Quick Switcher Spotlight Modal (Ctrl + K) */}
      <DiscordQuickSwitcherModal />
    </main>
  );
}
